"""Headless download daemon.

Speaks newline-delimited JSON over stdio:
  stdin  — one request object per line
  stdout — one response/event object per line (protocol only, never logging)
  stderr — free-form logging, piped into Electron's console

Requests
    {"id":"1","cmd":"ping"}
    {"id":"2","cmd":"ffmpeg_status"}
    {"id":"3","cmd":"install_ffmpeg"}
    {"id":"4","cmd":"probe","url":"…","cookiefile":null}
    {"id":"5","cmd":"start","job":{…}}
    {"id":"6","cmd":"cancel","jobId":"…"}
    {"id":"7","cmd":"download_image","url":"…","outputDir":"…"}
    {"id":"8","cmd":"set_concurrency","value":3}
    {"id":"9","cmd":"shutdown"}

Responses / events
    {"type":"result","id":"4","ok":true,"data":{…}}
    {"type":"result","id":"4","ok":false,"error":"…"}
    {"type":"event","event":"progress","jobId":"…", …}
    {"type":"event","event":"status","jobId":"…","status":"downloading"}
    {"type":"event","event":"done","jobId":"…","filepath":"…"}
    {"type":"event","event":"failed","jobId":"…","error":"…"}
    {"type":"event","event":"ffmpeg_install","stage":"download","percent":42.0}
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import traceback
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from engine import DownloadCancelled, Engine
from ffmpeg_setup import FfmpegManager

# Video titles routinely contain non-ASCII characters. Without this, writing a
# protocol line on a cp1252 console raises UnicodeEncodeError and kills the job.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


class Daemon:
    def __init__(self, ffmpeg_dir: str, concurrency: int = 3) -> None:
        self.ffmpeg = FfmpegManager(ffmpeg_dir)
        self.engine = Engine(self.ffmpeg)

        self._write_lock = threading.Lock()
        self._state_lock = threading.Lock()
        self._cancelled: set[str] = set()
        self._active: set[str] = set()

        self._pool = ThreadPoolExecutor(max_workers=max(1, concurrency))
        self._stopping = threading.Event()

    # -- output ------------------------------------------------------------

    def _write(self, payload: dict) -> None:
        line = json.dumps(payload, ensure_ascii=False)
        # Downloads run on pool threads; without the lock their lines interleave
        # and the renderer gets unparseable JSON.
        with self._write_lock:
            sys.stdout.write(line + "\n")
            sys.stdout.flush()

    def _result(self, req_id: Optional[str], data) -> None:
        self._write({"type": "result", "id": req_id, "ok": True, "data": data})

    def _error(self, req_id: Optional[str], error: str) -> None:
        self._write({"type": "result", "id": req_id, "ok": False, "error": error})

    def _event(self, event: str, **fields) -> None:
        self._write({"type": "event", "event": event, **fields})

    @staticmethod
    def _log(message: str) -> None:
        sys.stderr.write(message.rstrip() + "\n")
        sys.stderr.flush()

    # -- commands ----------------------------------------------------------

    def handle(self, req: dict) -> None:
        cmd = req.get("cmd")
        req_id = req.get("id")

        if cmd == "ping":
            self._result(req_id, {"pong": True, "pid": os.getpid()})

        elif cmd == "ffmpeg_status":
            self._result(req_id, self.ffmpeg.status())

        elif cmd == "install_ffmpeg":
            # Long-running; never block the request loop with it.
            threading.Thread(
                target=self._install_ffmpeg, args=(req_id,), daemon=True
            ).start()

        elif cmd == "probe":
            threading.Thread(
                target=self._probe,
                args=(req_id, req.get("url", ""), req.get("cookiefile")),
                daemon=True,
            ).start()

        elif cmd == "start":
            job = req.get("job") or {}
            job_id = job.get("jobId")
            if not job_id:
                self._error(req_id, "start requires job.jobId")
                return
            with self._state_lock:
                self._cancelled.discard(job_id)
                self._active.add(job_id)
            self._result(req_id, {"jobId": job_id, "accepted": True})
            self._event("status", jobId=job_id, status="queued")
            self._pool.submit(self._run_job, job)

        elif cmd == "cancel":
            job_id = req.get("jobId")
            with self._state_lock:
                self._cancelled.add(job_id)
            self._result(req_id, {"jobId": job_id, "cancelled": True})

        elif cmd == "download_image":
            threading.Thread(
                target=self._download_image,
                args=(req_id, req.get("url", ""), req.get("outputDir", "")),
                daemon=True,
            ).start()

        elif cmd == "set_concurrency":
            value = max(1, int(req.get("value") or 3))
            old = self._pool
            self._pool = ThreadPoolExecutor(max_workers=value)
            # Let queued work on the old pool finish; don't wait for it here.
            threading.Thread(target=old.shutdown, kwargs={"wait": True}, daemon=True).start()
            self._result(req_id, {"concurrency": value})

        elif cmd == "shutdown":
            self._result(req_id, {"bye": True})
            self._stopping.set()

        else:
            self._error(req_id, f"Unknown command: {cmd!r}")

    # -- workers -----------------------------------------------------------

    def _install_ffmpeg(self, req_id: Optional[str]) -> None:
        def progress(stage: str, message: str, percent: Optional[float]) -> None:
            self._event("ffmpeg_install", stage=stage, message=message, percent=percent)

        try:
            status = self.ffmpeg.install(progress)
            self._result(req_id, status)
        except Exception as exc:
            self._log(traceback.format_exc())
            self._event("ffmpeg_install", stage="failed", message=str(exc), percent=None)
            self._error(req_id, str(exc))

    def _probe(self, req_id: Optional[str], url: str, cookiefile: Optional[str]) -> None:
        try:
            self._result(req_id, self.engine.probe(url, cookiefile))
        except Exception as exc:
            self._error(req_id, _clean_error(exc))

    def _download_image(self, req_id: Optional[str], url: str, output_dir: str) -> None:
        try:
            self._result(req_id, self.engine.download_image(url, output_dir))
        except Exception as exc:
            self._log(traceback.format_exc())
            self._error(req_id, _clean_error(exc))

    def _run_job(self, job: dict) -> None:
        job_id = job["jobId"]

        def is_cancelled() -> bool:
            with self._state_lock:
                return job_id in self._cancelled

        def on_progress(p: dict) -> None:
            self._event("progress", jobId=job_id, **p)

        def on_status(status: str, detail: Optional[str]) -> None:
            self._event("status", jobId=job_id, status=status, detail=detail)

        try:
            if is_cancelled():
                raise DownloadCancelled()
            result = self.engine.download(job, on_progress, on_status, is_cancelled)
            self._event(
                "done",
                jobId=job_id,
                filepath=result["filepath"],
                filesize=result["filesize"],
                title=result["title"],
                audioSummary=result.get("audioSummary"),
            )
        except DownloadCancelled:
            self._event("status", jobId=job_id, status="cancelled", detail=None)
        except Exception as exc:
            self._log(f"[job {job_id}] {traceback.format_exc()}")
            self._event("failed", jobId=job_id, error=_clean_error(exc))
        finally:
            with self._state_lock:
                self._active.discard(job_id)
                self._cancelled.discard(job_id)

    # -- loop --------------------------------------------------------------

    def serve(self) -> int:
        self._log(f"universal-downloader daemon ready (pid {os.getpid()})")
        for raw in sys.stdin:
            if self._stopping.is_set():
                break
            line = raw.strip()
            if not line:
                continue
            try:
                req = json.loads(line)
            except json.JSONDecodeError as exc:
                self._error(None, f"Malformed request: {exc}")
                continue
            try:
                self.handle(req)
            except Exception as exc:
                self._log(traceback.format_exc())
                self._error(req.get("id"), _clean_error(exc))

        self._pool.shutdown(wait=False, cancel_futures=True)
        return 0


def _clean_error(exc: Exception) -> str:
    """yt-dlp prefixes its messages with ANSI codes and 'ERROR: '."""
    import re

    msg = str(exc).strip()
    msg = re.sub(r"\x1b\[[0-9;]*m", "", msg)
    msg = re.sub(r"^ERROR:\s*", "", msg)
    return msg or exc.__class__.__name__


def main() -> int:
    parser = argparse.ArgumentParser(description="Universal Downloader backend daemon")
    parser.add_argument(
        "--ffmpeg-dir",
        required=True,
        help="Directory holding the app-managed ffmpeg.exe (usually <userData>/tools/ffmpeg/bin)",
    )
    parser.add_argument("--concurrency", type=int, default=3)
    args = parser.parse_args()

    return Daemon(args.ffmpeg_dir, args.concurrency).serve()


if __name__ == "__main__":
    raise SystemExit(main())
