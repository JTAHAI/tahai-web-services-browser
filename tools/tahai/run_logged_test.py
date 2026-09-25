#!/usr/bin/env python3
# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
"""Checks the release runner without starting Chromium or a build."""

import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


class RunLoggedTest(unittest.TestCase):
    def invoke(self, log, *command):
        return subprocess.run(
            [sys.executable, str(Path(__file__).with_name("run_logged.py")),
             "--log", str(log), "--", *command],
            capture_output=True, check=False,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)

    def test_preserves_output_and_nonzero_exit(self):
        with tempfile.TemporaryDirectory(prefix="tahai-runner-test-") as directory:
            log = Path(directory) / "failure.log"
            result = self.invoke(log, sys.executable, "-c",
                "import sys; print('out', flush=True); "
                "print('diagnostic', file=sys.stderr, flush=True); sys.exit(7)")
            self.assertEqual(7, result.returncode)
            self.assertEqual(["out", "diagnostic"], log.read_text().splitlines())

    def test_failed_launch_is_not_success(self):
        with tempfile.TemporaryDirectory(prefix="tahai-runner-test-") as directory:
            log = Path(directory) / "missing.log"
            result = self.invoke(log, str(Path(directory) / "missing-executable.exe"))
            self.assertEqual(127, result.returncode)
            self.assertIn("Could not start command:", log.read_text())

    @unittest.skipUnless(os.name == "nt", "Windows console behavior")
    def test_child_has_no_console_window(self):
        with tempfile.TemporaryDirectory(prefix="tahai-runner-test-") as directory:
            log = Path(directory) / "console.log"
            result = self.invoke(log, sys.executable, "-c",
                "import ctypes, sys; "
                "window = ctypes.windll.kernel32.GetConsoleWindow(); "
                "print('console_window=' + str(window)); sys.exit(bool(window))")
            self.assertEqual(0, result.returncode)
            self.assertEqual("console_window=0", log.read_text().strip())


if __name__ == "__main__":
    unittest.main()
