tips = '''
Another tip is only use either "" or '' dont switch between them

Also use f"" to print strings with variables in them simply put every variable in a bracket
EXAMPLE: print(f"Hello i am {name}")

When naming variables use names that descripe the value of the variable not random letters
EXAMPLE: windows_path = 'C:/Windows'
'''
import ctypes
import os, sys
import time
import requests
from pytube import YouTube
import yt_dlp
import argparse
import shutil
import subprocess
import zipfile

APP_NAME = "MultiDownloader by WeepingAngel"
APP_VERSION = "1.6.0"


class dialogs:
  MB_OK = 0x00000000
  MB_YESNO = 0x00000004
  MB_ICONINFORMATION = 0x00000040
  MB_ICONWARNING = 0x00000030
  MB_ICONERROR = 0x00000010

  IDYES = 6

  TDCBF_OK_BUTTON = 0x0001
  TDCBF_YES_BUTTON = 0x0002
  TDCBF_NO_BUTTON = 0x0004

  @staticmethod
  def _split_main_content(text):
    text = "" if text is None else str(text)
    if "\n" in text:
      main, content = text.split("\n", 1)
      return main.strip(), content.strip()
    return text.strip(), ""

  @staticmethod
  def _task_dialog(title, main, content, common_buttons):
    try:
      comctl32 = ctypes.windll.comctl32
      TaskDialog = comctl32.TaskDialog
    except Exception:
      return None

    TaskDialog.argtypes = [
      ctypes.c_void_p,               # hwndParent
      ctypes.c_void_p,               # hInstance
      ctypes.c_wchar_p,              # pszWindowTitle
      ctypes.c_wchar_p,              # pszMainInstruction
      ctypes.c_wchar_p,              # pszContent
      ctypes.c_uint,                 # dwCommonButtons
      ctypes.c_wchar_p,              # pszIcon (None -> no icon)
      ctypes.POINTER(ctypes.c_int),  # pnButton
    ]
    TaskDialog.restype = ctypes.c_long

    pressed = ctypes.c_int(0)
    try:
      hr = TaskDialog(None, None, title, main, content, common_buttons, None, ctypes.byref(pressed))
      if hr == 0:
        return pressed.value
    except Exception:
      return None

    return None

  @staticmethod
  def _message_box(title, text, flags):
    return ctypes.windll.user32.MessageBoxW(0, text, title, flags)

  @staticmethod
  def info(title, text):
    main, content = dialogs._split_main_content(text)
    if dialogs._task_dialog(title, main, content, dialogs.TDCBF_OK_BUTTON) is None:
      dialogs._message_box(title, text, dialogs.MB_OK | dialogs.MB_ICONINFORMATION)

  @staticmethod
  def warning(title, text):
    main, content = dialogs._split_main_content(text)
    if dialogs._task_dialog(title, main, content, dialogs.TDCBF_OK_BUTTON) is None:
      dialogs._message_box(title, text, dialogs.MB_OK | dialogs.MB_ICONWARNING)

  @staticmethod
  def error(title, text):
    main, content = dialogs._split_main_content(text)
    if dialogs._task_dialog(title, main, content, dialogs.TDCBF_OK_BUTTON) is None:
      dialogs._message_box(title, text, dialogs.MB_OK | dialogs.MB_ICONERROR)

  @staticmethod
  def confirm(title, text):
    main, content = dialogs._split_main_content(text)
    res = dialogs._task_dialog(title, main, content, dialogs.TDCBF_YES_BUTTON | dialogs.TDCBF_NO_BUTTON)
    if res is None:
      res = dialogs._message_box(title, text, dialogs.MB_YESNO | dialogs.MB_ICONINFORMATION)
    return res == dialogs.IDYES



# f-string so APP_VERSION above stays the single place the version is written.
# The release pipeline rewrites that one line and the banner follows.
banner = f'''

███╗   ███╗██╗   ██╗██╗  ████████╗██╗██████╗  ██████╗ ██╗    ██╗███╗   ██╗██╗      ██████╗  █████╗ ██████╗ 
████╗ ████║██║   ██║██║  ╚══██╔══╝██║██╔══██╗██╔═══██╗██║    ██║████╗  ██║██║     ██╔═══██╗██╔══██╗██╔══██╗
██╔████╔██║██║   ██║██║     ██║   ██║██║  ██║██║   ██║██║ █╗ ██║██╔██╗ ██║██║     ██║   ██║███████║██║  ██║
██║╚██╔╝██║██║   ██║██║     ██║   ██║██║  ██║██║   ██║██║███╗██║██║╚██╗██║██║     ██║   ██║██╔══██║██║  ██║
██║ ╚═╝ ██║╚██████╔╝███████╗██║   ██║██████╔╝╚██████╔╝╚███╔███╔╝██║ ╚████║███████╗╚██████╔╝██║  ██║██████╔╝
╚═╝     ╚═╝ ╚═════╝ ╚══════╝╚═╝   ╚═╝╚═════╝  ╚═════╝  ╚══╝╚══╝ ╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝ 

                        * Open Sorce Multi Downloader by CraftModzZ aka. WeepingAngel *
                Discord: _WeepingAngel_ VI#6666 | GitHub: https://www.github.com/Crafttino21
               * Thanks to Cozi to make Afterpatches and help me to clean my code *
                            # GitHub: https://github.com/itzCozi #
                                      Version: {APP_VERSION}

'''
# P.S Cozi feel free to intigrate your own extensions if you want :)

class colors:
  '''
  This is a class containing variables of similar values
  To use this class call the class name then the variable 
  '''
  @staticmethod
  def set(code):
    os.system(f"color {code}")

class syscalls:
  @staticmethod
  def _ffmpeg_tool_root():
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "tools", "ffmpeg")

  @staticmethod
  def _ffmpeg_tool_bin_dir():
    return os.path.join(syscalls._ffmpeg_tool_root(), "bin")

  @staticmethod
  def _prepend_to_path(dir_path):
    current = os.environ.get("PATH", "")
    parts = [p.strip() for p in current.split(os.pathsep) if p.strip()]
    if dir_path not in parts:
      os.environ["PATH"] = dir_path + os.pathsep + current

  @staticmethod
  def check_ffmpeg_installed():
    """Prüft, ob ffmpeg verfügbar ist (System-PATH oder lokale tools-Installation)."""
    if shutil.which("ffmpeg") is not None:
      return True

    local_ffmpeg = os.path.join(syscalls._ffmpeg_tool_bin_dir(), "ffmpeg.exe")
    if os.path.isfile(local_ffmpeg):
      syscalls._prepend_to_path(syscalls._ffmpeg_tool_bin_dir())
      return True

    return False


  @staticmethod
  def _install_ffmpeg_via_winget():
    if shutil.which("winget") is None:
      return False

    # winget can be present but blocked/misconfigured; keep it best-effort.
    subprocess.run(
      [
        "winget",
        "install",
        "ffmpeg",
        "--accept-package-agreements",
        "--accept-source-agreements",
      ],
      check=True,
    )
    return syscalls.check_ffmpeg_installed()

  @staticmethod
  def _install_ffmpeg_without_winget():
    tool_root = syscalls._ffmpeg_tool_root()
    bin_dir = syscalls._ffmpeg_tool_bin_dir()
    os.makedirs(tool_root, exist_ok=True)
    os.makedirs(bin_dir, exist_ok=True)

    # Stable direct download of the "essentials" build (contains ffmpeg/ffprobe).
    url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
    zip_path = os.path.join(tool_root, "ffmpeg-release-essentials.zip")
    extract_root = os.path.join(tool_root, "_extract")

    if os.path.isdir(extract_root):
      shutil.rmtree(extract_root, ignore_errors=True)
    os.makedirs(extract_root, exist_ok=True)

    with requests.get(url, stream=True, timeout=60) as r:
      r.raise_for_status()
      with open(zip_path, "wb") as f:
        for chunk in r.iter_content(chunk_size=1024 * 1024):
          if chunk:
            f.write(chunk)

    with zipfile.ZipFile(zip_path, "r") as zf:
      zf.extractall(extract_root)

    ffmpeg_exe = None
    ffprobe_exe = None
    ffplay_exe = None
    for root, _, files in os.walk(extract_root):
      lower = {f.lower(): f for f in files}
      if "ffmpeg.exe" in lower:
        ffmpeg_exe = os.path.join(root, lower["ffmpeg.exe"])
      if "ffprobe.exe" in lower:
        ffprobe_exe = os.path.join(root, lower["ffprobe.exe"])
      if "ffplay.exe" in lower:
        ffplay_exe = os.path.join(root, lower["ffplay.exe"])

    if not ffmpeg_exe:
      raise RuntimeError("Download/Extract erfolgreich, aber ffmpeg.exe wurde nicht gefunden.")

    shutil.copy2(ffmpeg_exe, os.path.join(bin_dir, "ffmpeg.exe"))
    if ffprobe_exe:
      shutil.copy2(ffprobe_exe, os.path.join(bin_dir, "ffprobe.exe"))
    if ffplay_exe:
      shutil.copy2(ffplay_exe, os.path.join(bin_dir, "ffplay.exe"))

    try:
      os.remove(zip_path)
    except OSError:
      pass
    shutil.rmtree(extract_root, ignore_errors=True)

    syscalls._prepend_to_path(bin_dir)
    return syscalls.check_ffmpeg_installed()

  @staticmethod
  def install_ffmpeg():
    """Installiert ffmpeg (winget wenn verfügbar, sonst Download in ./tools/ffmpeg/bin)."""
    if syscalls.check_ffmpeg_installed():
      print("ffmpeg is already installed.")
      return

    try:
      print("Trying to install ffmpeg via winget...")
      if syscalls._install_ffmpeg_via_winget():
        print("ffmpeg erfolgreich installiert (winget).")
        return
      print("winget didn't install ffmpeg successfully; falling back...")
    except Exception as e:
      print(f"winget failed ({e}); falling back to manual download...")

    try:
      print("Installing ffmpeg without winget (download + extract)...")
      if syscalls._install_ffmpeg_without_winget():
        print(f"ffmpeg erfolgreich installiert: {syscalls._ffmpeg_tool_bin_dir()}")
      else:
        raise RuntimeError("Installation abgeschlossen, aber ffmpeg ist weiterhin nicht auffindbar.")
    except Exception as e:
      print(f"Fehler beim Installieren von ffmpeg: {e}")
      raise

  def args():
    parser = argparse.ArgumentParser(description="Install ffmpeg (winget if available, otherwise portable download).")
    parser.add_argument("--install-ffmpeg", action="store_true",
                        help="Install's ffmpeg (winget if available, otherwise downloads a portable build).")
    parser.add_argument("--no-update-check", action="store_true",
                        help="Skip the version check against GitHub on startup.")

    args = parser.parse_args()

    if args.no_update_check:
      # Reuses the same switch check_for_update() already honours, so there is
      # one place that decides whether the check runs.
      os.environ["UD_NO_UPDATE_CHECK"] = "1"

    if args.install_ffmpeg:
      if syscalls.check_ffmpeg_installed():
        print("ffmpeg is already installed.")
        dialogs.info(APP_NAME, "ffmpeg is already installed.")
      else:
        print("ffmpeg is not installed. Starting installation...")
        syscalls.install_ffmpeg()
      return True

    return False


RELEASES_API = "https://api.github.com/repos/Crafttino21/Universal-Downloader/releases"
RELEASES_PAGE = "https://github.com/Crafttino21/Universal-Downloader/releases"
# CLI releases are tagged cli-vX.Y.Z; the desktop app has its own line under
# desktop-v*. That is why the release list is scanned instead of /releases/latest,
# which points at whichever of the two was published last.
CLI_TAG_PREFIX = "cli-v"


def _version_tuple(text):
  parts = []
  for chunk in str(text).strip().split("."):
    digits = "".join(c for c in chunk if c.isdigit())
    parts.append(int(digits) if digits else 0)
  return tuple(parts)


def check_for_update(timeout=2.5):
  '''
  Returns the newest CLI version string if it is newer than this build, else None.
  Every failure is swallowed on purpose: no network, a proxy, a rate limit or a
  changed API shape must never stop the tool from starting.
  '''
  if os.environ.get("UD_NO_UPDATE_CHECK"):
    return None
  try:
    response = requests.get(
      RELEASES_API,
      params={"per_page": 20},
      timeout=timeout,
      headers={"Accept": "application/vnd.github+json"},
    )
    response.raise_for_status()

    newest = None
    for release in response.json():
      if release.get("draft"):
        continue
      tag = str(release.get("tag_name") or "")
      if not tag.startswith(CLI_TAG_PREFIX):
        continue
      candidate = tag[len(CLI_TAG_PREFIX):]
      if newest is None or _version_tuple(candidate) > _version_tuple(newest):
        newest = candidate

    if newest and _version_tuple(newest) > _version_tuple(APP_VERSION):
      return newest
  except Exception:
    pass
  return None


class YoutubeBeta(): # a new method for testing to replace pyTube, Its just a small fix
  @staticmethod
  def _normalize_youtube_url(url):
    url = str(url).strip()
    if not url:
      return url

    lower = url.lower()

    # Handle raw IDs
    if "://" not in url and "/" not in url and "?" not in url and len(url) >= 8:
      return "https://www.youtube.com/watch?v=" + url

    # youtube shorts -> watch
    if "youtube.com/shorts/" in lower:
      # keep original for slicing
      idx = lower.find("youtube.com/shorts/")
      video_id = url[idx + len("youtube.com/shorts/"):]
      video_id = video_id.split("?", 1)[0].split("&", 1)[0].split("/", 1)[0].strip()
      if video_id:
        return "https://www.youtube.com/watch?v=" + video_id

    # youtu.be/<id> -> watch
    if "youtu.be/" in lower:
      idx = lower.find("youtu.be/")
      video_id = url[idx + len("youtu.be/"):]
      video_id = video_id.split("?", 1)[0].split("&", 1)[0].split("/", 1)[0].strip()
      if video_id:
        return "https://www.youtube.com/watch?v=" + video_id

    return url

  def download_video(url, output_path, cookiefile=None):
    url = YoutubeBeta._normalize_youtube_url(url)
    if not str(output_path).strip():
      output_path = os.getcwd()

    # Überprüfen und Ordner erstellen, falls nicht existent
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
      try:
        os.makedirs(output_dir)
      except OSError as exc:
        if exc.errno != os.errno.EEXIST:
          raise

    # Robust output template: let yt-dlp choose the correct extension during download/merge.
    if os.path.isdir(output_path) or output_path.endswith(os.path.sep) or output_path.endswith("/") or output_path.endswith("\\"):
      outtmpl = os.path.join(output_path, "%(title)s.%(ext)s")
    else:
      base, ext = os.path.splitext(output_path)
      outtmpl = (base if ext else output_path) + ".%(ext)s"

    has_ffmpeg = syscalls.check_ffmpeg_installed()

    # Best quality MP4:
    # - With ffmpeg: download best mp4 video + m4a audio and merge/remux to mp4 (fallbacks included).
    # - Without ffmpeg: prefer a single-file mp4 (no merge required), then fallback to "best".
    if has_ffmpeg:
      format_selector = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best"
    else:
      format_selector = "best[ext=mp4]/best"

    ydl_opts = {
      'format': format_selector,
      'outtmpl': outtmpl,
      'noplaylist': True,
      'continuedl': True,
      'nocheckcertificate': True,
    }

    if has_ffmpeg:
      ydl_opts['merge_output_format'] = 'mp4'

    if cookiefile:
      ydl_opts['cookiefile'] = cookiefile

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

  def download_audio(url, output_path, cookiefile=None):
    url = YoutubeBeta._normalize_youtube_url(url)
    if not str(output_path).strip():
      output_path = os.getcwd()

    # Überprüfen und Ordner erstellen, falls nicht existent
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
      try:
        os.makedirs(output_dir)
      except OSError as exc:
        if exc.errno != os.errno.EEXIST:
          raise

    if os.path.isdir(output_path) or output_path.endswith(os.path.sep) or output_path.endswith("/") or output_path.endswith("\\"):
      outtmpl = os.path.join(output_path, "%(title)s.%(ext)s")
    else:
      base, ext = os.path.splitext(output_path)
      outtmpl = (base if ext else output_path) + ".%(ext)s"

    if not syscalls.check_ffmpeg_installed():
      raise RuntimeError("ffmpeg not found. MP3 conversion requires ffmpeg. Run with --install-ffmpeg.")

    ydl_opts = {
      'format': 'bestaudio[ext=m4a]/bestaudio/best',
      'outtmpl': outtmpl,
      'noplaylist': True,
      'continuedl': True,
      'nocheckcertificate': True,
      'postprocessors': [{
        'key': 'FFmpegExtractAudio',
        'preferredcodec': 'mp3',
        'preferredquality': '192',
      }],
    }

    if cookiefile:
      ydl_opts['cookiefile'] = cookiefile

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
      ydl.download([url])


class functions:

  # Create a windows message box
  def Mbox(title, text, style):
    return ctypes.windll.user32.MessageBoxW(0, text, title, style)

  @staticmethod
  def _prompt_output_dir(kind, last_dir=None):
    default_dir = last_dir or os.getcwd()
    raw = input(f"Output folder for {kind} (Enter = {default_dir}) > ").strip()
    chosen = raw or default_dir

    # If user typed a file path, use its directory.
    _, ext = os.path.splitext(chosen)
    if ext.lower() in (".mp4", ".mp3", ".m4a", ".webm", ".mkv"):
      chosen = os.path.dirname(chosen) or default_dir

    chosen = os.path.abspath(os.path.expanduser(chosen))
    os.makedirs(chosen, exist_ok=True)
    return chosen

  @staticmethod
  def _collect_urls(platform_name):
    print(f"Paste {platform_name} URL(s) (one per line).")
    print("Empty line = start download, 'b' = back to menu.")
    urls = []
    while True:
      line = input("> ").strip()
      if not line:
        break
      if line.lower() in ("b", "back"):
        return None
      # allow pasting multiple URLs in one line
      for part in line.split():
        if part.strip():
          urls.append(part.strip())
    return urls

  @staticmethod
  def _prompt_cookiefile(last_cookiefile=None):
    default = last_cookiefile or ""
    hint = "Optional cookies.txt path (Enter = none)"
    if default:
      hint = f"Optional cookies.txt path (Enter = keep: {default})"
    raw = input(f"{hint} > ").strip().strip('"')
    if not raw and default:
      return default
    if not raw:
      return None
    path = os.path.abspath(os.path.expanduser(raw))
    if not os.path.isfile(path):
      dialogs.warning(APP_NAME, f"cookies file not found.\n{path}")
      return None
    return path

  @staticmethod
  def _run_video_batch(platform_name, last_dir=None, last_cookiefile=None, cookies_recommended=False):
    print(f"{platform_name} to MP4 (batch)")
    if not syscalls.check_ffmpeg_installed():
      dialogs.warning(
        APP_NAME,
        "ffmpeg not found.\nBest-quality video+audio merge may be unavailable.\n\nInstall it via menu [9] or run: --install-ffmpeg",
      )

    last_dir = functions._prompt_output_dir(f"{platform_name} MP4 videos", last_dir)

    cookiefile = last_cookiefile
    if cookies_recommended:
      cookiefile = functions._prompt_cookiefile(last_cookiefile)
      if cookiefile:
        print("Using cookies.txt for this batch.")
      else:
        print("Tip: This platform often needs cookies.txt (login) for best reliability.")

    while True:
      urls = functions._collect_urls(platform_name)
      if urls is None:
        break
      if not urls:
        print("No URLs entered.")
        continue

      failures = 0
      for idx, url in enumerate(urls, 1):
        try:
          print(f"[{idx}/{len(urls)}] Downloading...")
          YoutubeBeta.download_video(url, last_dir, cookiefile=cookiefile)
          print("Done.")
        except Exception as e:
          failures += 1
          dialogs.error(APP_NAME, f"Download failed.\n{e}")
          print(f"[ERROR] {e}")
          continue

      print(f"Batch finished. Success: {len(urls) - failures}, Failed: {failures}")
      more = input("Add more URLs? (Y/N) > ").strip().lower()
      if more not in ("y", "yes", ""):
        break

    return last_dir, cookiefile

  @staticmethod
  def _run_audio_batch(platform_name, last_dir=None, last_cookiefile=None, cookies_recommended=False):
    print(f"{platform_name} to MP3 (batch)")
    if not syscalls.check_ffmpeg_installed():
      dialogs.warning(
        APP_NAME,
        "ffmpeg not found.\nMP3 conversion needs ffmpeg.\n\nInstall it via menu [9] or run: --install-ffmpeg",
      )
      return last_dir, last_cookiefile

    last_dir = functions._prompt_output_dir(f"{platform_name} MP3 audio", last_dir)

    cookiefile = last_cookiefile
    if cookies_recommended:
      cookiefile = functions._prompt_cookiefile(last_cookiefile)
      if cookiefile:
        print("Using cookies.txt for this batch.")
      else:
        print("Tip: This platform often needs cookies.txt (login) for best reliability.")

    while True:
      urls = functions._collect_urls(platform_name)
      if urls is None:
        break
      if not urls:
        print("No URLs entered.")
        continue

      failures = 0
      for idx, url in enumerate(urls, 1):
        try:
          print(f"[{idx}/{len(urls)}] Downloading...")
          YoutubeBeta.download_audio(url, last_dir, cookiefile=cookiefile)
          print("Done.")
        except Exception as e:
          failures += 1
          dialogs.error(APP_NAME, f"Download failed.\n{e}")
          print(f"[ERROR] {e}")
          continue

      print(f"Batch finished. Success: {len(urls) - failures}, Failed: {failures}")
      more = input("Add more URLs? (Y/N) > ").strip().lower()
      if more not in ("y", "yes", ""):
        break

    return last_dir, cookiefile

  @staticmethod
  def _render_menu():
    functions.clearConsole()
    print(banner)
    colors.set("D")
    print("Platforms: YouTube/Shorts, TikTok, Instagram Reels (cookies may be required)")
    print("[1] YouTube to MP4 (batch)")
    print("[2] TikTok to MP4 (batch)")
    print("[3] Instagram Reels to MP4 (batch)")
    print("[4] YouTube to MP3 (batch)")
    print("[5] TikTok to MP3 (batch)")
    print("[6] Instagram Reels to MP3 (batch)")
    print("[7] Image Downloader")
    print("[9] Install FFmpeg")
    print("[0] Exit\n")

  # Clears the console
  def clearConsole():
    os.system('cls' if os.name in ('nt', 'dos') else 'clear')

  # Main menu loop function
  def menu():
    '''
		                            _____CHANGES_____
  	  * Used while True instead of while option != 0 to simplify the loop.
		  * Used input() instead of int(input()) to handle non-integer input gracefully.
		  * Used option.lower() to convert the input option to lowercase and simplify the if statements.
		  * Removed the exit() calls in the try-except blocks and used continue instead to keep the loop running.
	    * Added better exit() mechanic with sys.exit() which passing a 1 means an error occured.
		  * Added a prompt for the destination directory in option 3.
		  * Moved the menu() call outside the function to prevent an infinite recursion loop.
    '''

    option_text = "Choose your Converter > "

    functions._render_menu()

    last_youtube_video_dir = None
    last_tiktok_video_dir = None
    last_instagram_video_dir = None
    last_youtube_audio_dir = None
    last_tiktok_audio_dir = None
    last_instagram_audio_dir = None
    last_instagram_cookiefile = None


    while True:
      option = input(option_text).strip()

      if option == "1":
        last_youtube_video_dir, _ = functions._run_video_batch("YouTube", last_youtube_video_dir, None, cookies_recommended=False)
        functions._render_menu()
        continue

      elif option == "2":
        last_tiktok_video_dir, _ = functions._run_video_batch("TikTok", last_tiktok_video_dir, None, cookies_recommended=False)
        functions._render_menu()
        continue

      elif option == "3":
        last_instagram_video_dir, last_instagram_cookiefile = functions._run_video_batch(
          "Instagram Reels",
          last_instagram_video_dir,
          last_instagram_cookiefile,
          cookies_recommended=True,
        )
        functions._render_menu()
        continue

      elif option == "7":
        try:
          web = input("Paste your Image: ")
          r = requests.get(web)
          print(r.content)
          with open("output.png", "wb") as f:
            f.write(r.content)
          dialogs.info(APP_NAME, "Download complete! Saved as output.png")
          print("Download Complete!")
        except Exception as e:
          dialogs.error(APP_NAME, f"Download failed.\n{e}")
          print(f"[ERROR] {e}")
          continue

        input("Press Enter to return to menu...")
        functions._render_menu()

      elif option == "4":
        last_youtube_audio_dir, _ = functions._run_audio_batch("YouTube", last_youtube_audio_dir, None, cookies_recommended=False)
        functions._render_menu()
        continue

      elif option == "5":
        last_tiktok_audio_dir, _ = functions._run_audio_batch("TikTok", last_tiktok_audio_dir, None, cookies_recommended=False)
        functions._render_menu()
        continue

      elif option == "6":
        last_instagram_audio_dir, last_instagram_cookiefile = functions._run_audio_batch(
          "Instagram Reels",
          last_instagram_audio_dir,
          last_instagram_cookiefile,
          cookies_recommended=True,
        )
        functions._render_menu()
        continue

      elif option == "9":
        try:
          syscalls.install_ffmpeg()
          dialogs.info(APP_NAME, "FFmpeg install finished.")
        except Exception as e:
          dialogs.error(APP_NAME, f"FFmpeg install failed.\n{e}")
        functions._render_menu()

      elif option == "0":
        dialogs.info(APP_NAME, "Thanks for using this tool :)")
        sys.exit(0)

      else:
        print("Invalid option!")
        continue

def main():
  handled = syscalls.args()
  if handled:
    return 0

  time.sleep(1)
  try:
    print(f"{APP_NAME} | Version: {APP_VERSION}")

    newer = check_for_update()
    if newer:
      print(f"\n  ! Version {newer} is available (you have {APP_VERSION})")
      print(f"    {RELEASES_PAGE}\n")

    functions.menu()
  except Exception as e:
    print(f"An unkown runtime error occured \n{e}\n")
    return 1

  return 0


if __name__ == "__main__":
  raise SystemExit(main())
