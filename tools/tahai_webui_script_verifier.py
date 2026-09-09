#!/usr/bin/env python3
"""Parse every embedded TAHAI WebUI script without running browser code."""

from pathlib import Path
import re
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
UI_SOURCE = ROOT / "chrome" / "browser" / "ui" / "webui" / "tahai" / "tahai_ui.cc"
SCRIPT_PATTERN = re.compile(
    r'constexpr char (k[A-Za-z0-9]+Js)\[\] = R"TAHAI\(\r?\n(.*?)\r?\n\)TAHAI";',
    re.DOTALL,
)
NODE_PARSE = "new Function(require('fs').readFileSync(0, 'utf8'));"


def main() -> int:
    node = shutil.which("node")
    if not node:
        print("TAHAI WebUI script verifier: Node.js is unavailable", file=sys.stderr)
        return 1
    source = UI_SOURCE.read_text(encoding="utf-8")
    scripts = list(SCRIPT_PATTERN.finditer(source))
    if not scripts:
        print("TAHAI WebUI script verifier: no embedded scripts found", file=sys.stderr)
        return 1
    failures: list[str] = []
    for script in scripts:
        result = subprocess.run(
            [node, "-e", NODE_PARSE],
            input=script.group(2),
            text=True,
            capture_output=True,
            check=False,
        )
        if result.returncode:
            detail = (result.stderr or result.stdout).strip().splitlines()
            failures.append(f"{script.group(1)}: {detail[-1] if detail else 'syntax error'}")
    if failures:
        print("TAHAI WebUI script verifier: FAILED", file=sys.stderr)
        print("\n".join(failures), file=sys.stderr)
        return 1
    print(f"TAHAI WebUI script verifier: passed ({len(scripts)} scripts)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
