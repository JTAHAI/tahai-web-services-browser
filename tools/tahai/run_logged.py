#!/usr/bin/env python3
# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
"""Preserve native output and exit codes across PowerShell versions."""

import argparse
from pathlib import Path
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--log", required=True, type=Path)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command
    if command and command[0] == "--":
        command = command[1:]
    if not command:
        parser.error("a native command is required")
    # unittest, compiler warnings, and other successful tools write to stderr.
    # Windows PowerShell 5 otherwise turns redirected stderr into terminating
    # NativeCommandError records when ErrorActionPreference is Stop.
    with args.log.open("wb") as output:
        try:
            return subprocess.run(command, stdin=subprocess.DEVNULL,
                                  stdout=output, stderr=subprocess.STDOUT,
                                  check=False).returncode
        except OSError as error:
            output.write((f"Could not start command: {error}\n").encode())
            return 127


if __name__ == "__main__":
    raise SystemExit(main())
