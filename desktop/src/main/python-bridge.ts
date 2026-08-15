import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { EventEmitter } from 'events'
import { existsSync } from 'fs'
import { createInterface, type Interface } from 'readline'
import { join } from 'path'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'

/** One line of the NDJSON protocol coming back from the daemon. */
type DaemonMessage =
  | { type: 'result'; id: string | null; ok: true; data: unknown }
  | { type: 'result'; id: string | null; ok: false; error: string }
  | { type: 'event'; event: string; [key: string]: unknown }

interface Pending {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
}

const MAX_RESTARTS = 3

/**
 * Owns the Python daemon child process and the request/response correlation on
 * top of its stdio pipes.
 *
 * Emits:
 *   'event'  (name, payload)  — forwarded daemon events (progress/status/…)
 *   'crash'  ()               — the daemon died with requests or jobs in flight
 */
export class PythonBridge extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null
  private reader: Interface | null = null
  private pending = new Map<string, Pending>()
  private nextId = 1
  private restarts = 0
  private shuttingDown = false

  constructor(private readonly ffmpegDir: string) {
    super()
  }

  /* ---------------------------------------------------------------- */
  /* Lifecycle                                                        */
  /* ---------------------------------------------------------------- */

  start(): void {
    if (this.child) return

    const { command, args } = this.resolveCommand()
    if (!existsSync(command)) {
      throw new Error(
        `Backend not found at ${command}. ` +
          (is.dev
            ? 'Create the venv first: python -m venv python/.venv && python/.venv/Scripts/python.exe -m pip install -r python/requirements.txt'
            : 'The installation looks incomplete — reinstall the app.')
      )
    }

    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' }
    })
    this.child = child

    this.reader = createInterface({ input: child.stdout })
    this.reader.on('line', (line) => this.onLine(line))

    child.stderr.on('data', (buf: Buffer) => {
      // Daemon logging — surfaced in the terminal running `npm run dev`.
      process.stderr.write(`[daemon] ${buf.toString()}`)
    })

    child.on('exit', (code, signal) => this.onExit(code, signal))
    child.on('error', (err) => {
      this.rejectAll(new Error(`Backend failed to start: ${err.message}`))
    })
  }

  private resolveCommand(): { command: string; args: string[] } {
    const common = ['--ffmpeg-dir', this.ffmpegDir]

    if (is.dev) {
      const root = join(app.getAppPath(), 'python')
      return {
        command: join(root, '.venv', 'Scripts', 'python.exe'),
        args: [join(root, 'daemon.py'), ...common]
      }
    }

    // Packaged: the PyInstaller sidecar lives in extraResources.
    return {
      command: join(process.resourcesPath, 'python', 'ud-daemon.exe'),
      args: common
    }
  }

  private onExit(code: number | null, signal: string | null): void {
    this.child = null
    this.reader?.close()
    this.reader = null

    if (this.shuttingDown) return

    const hadWork = this.pending.size > 0
    this.rejectAll(new Error(`Backend stopped unexpectedly (code ${code ?? signal}).`))

    if (this.restarts < MAX_RESTARTS) {
      this.restarts += 1
      const delay = this.restarts * 500
      setTimeout(() => {
        try {
          this.start()
          if (hadWork) this.emit('crash')
        } catch {
          this.emit('crash')
        }
      }, delay)
    } else {
      this.emit('crash')
    }
  }

  async stop(): Promise<void> {
    this.shuttingDown = true
    const child = this.child
    if (!child) return

    try {
      await Promise.race([
        this.request('shutdown'),
        new Promise((r) => setTimeout(r, 1500))
      ])
    } catch {
      // The daemon may already be gone; killing below covers it.
    }

    if (!child.killed) child.kill()
    this.child = null
  }

  /* ---------------------------------------------------------------- */
  /* Protocol                                                         */
  /* ---------------------------------------------------------------- */

  private onLine(line: string): void {
    const trimmed = line.trim()
    if (!trimmed) return

    let msg: DaemonMessage
    try {
      msg = JSON.parse(trimmed)
    } catch {
      process.stderr.write(`[daemon] unparseable line: ${trimmed}\n`)
      return
    }

    if (msg.type === 'result') {
      if (msg.id == null) return
      const pending = this.pending.get(msg.id)
      if (!pending) return
      this.pending.delete(msg.id)
      if (msg.ok) pending.resolve(msg.data)
      else pending.reject(new Error(msg.error))
      return
    }

    if (msg.type === 'event') {
      const { type: _type, event, ...payload } = msg
      void _type
      this.emit('event', event, payload)
    }
  }

  /** Send a command and await its `result` line. */
  request<T = unknown>(cmd: string, payload: Record<string, unknown> = {}): Promise<T> {
    if (!this.child) {
      return Promise.reject(new Error('Backend is not running.'))
    }

    const id = String(this.nextId++)
    const line = JSON.stringify({ id, cmd, ...payload }) + '\n'

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      this.child!.stdin.write(line, (err) => {
        if (err) {
          this.pending.delete(id)
          reject(new Error(`Could not reach the backend: ${err.message}`))
        }
      })
    })
  }

  private rejectAll(error: Error): void {
    for (const { reject } of this.pending.values()) reject(error)
    this.pending.clear()
  }
}
