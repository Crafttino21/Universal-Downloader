"""Stamp a version into source/converter.py for a release build.

Deliberately a Python script rather than sed or PowerShell's -replace: the file
carries the box-drawing banner, and PowerShell 5.1's `Set-Content -Encoding utf8`
would prepend a BOM while a careless sed can mangle the non-ASCII lines.

Usage: python .github/scripts/set_cli_version.py 1.6.0
"""

import io
import os
import re
import sys

PATTERN = re.compile(r'^APP_VERSION = "[^"]*"', re.MULTILINE)


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: set_cli_version.py <version>", file=sys.stderr)
        return 2

    version = sys.argv[1].strip().lstrip("v")
    if not re.fullmatch(r"[0-9][0-9A-Za-z.\-+]*", version):
        print(f"refusing to write an implausible version: {version!r}", file=sys.stderr)
        return 2

    path = os.path.join(os.path.dirname(__file__), "..", "..", "source", "converter.py")
    path = os.path.normpath(path)

    # newline="" on both read and write turns off newline translation, so the
    # file keeps whatever endings the checkout gave it.
    with io.open(path, encoding="utf-8", newline="") as handle:
        source = handle.read()

    replaced, count = PATTERN.subn(f'APP_VERSION = "{version}"', source, count=1)
    if count != 1:
        print(f"APP_VERSION assignment not found in {path}", file=sys.stderr)
        return 1

    with io.open(path, "w", encoding="utf-8", newline="") as handle:
        handle.write(replaced)

    print(f"APP_VERSION = {version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
