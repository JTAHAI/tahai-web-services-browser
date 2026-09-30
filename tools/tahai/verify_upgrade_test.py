#!/usr/bin/env python3
# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
"""Exercise runner rejection paths only. No compiler, GN or browser is started."""

import argparse
import json
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
POWERSHELL = "C:/Program Files/PowerShell/7/pwsh.exe"


class RunnerRejectionTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="tahai-runner-test-",
                                                      dir=ROOT / "out")
        self.build = Path(self.temporary.name).resolve()
        self.assertTrue(self.build.is_relative_to((ROOT / "out").resolve()))
        self.addCleanup(self.temporary.cleanup)

    def run_rejected(self, build=None, *arguments):
        result = subprocess.run(
            [POWERSHELL, "-NoProfile", "-File",
             str(ROOT / "tools/tahai/verify_upgrade.ps1"),
             "-BuildDirectory", str((build or self.build).relative_to(ROOT)),
             *arguments], cwd=ROOT, capture_output=True, text=True, timeout=30)
        self.assertNotEqual(0, result.returncode)
        self.assertFalse((self.build / "build.ninja").exists())
        self.assertFalse(list(self.build.rglob("gn.log")))
        self.assertFalse(list(self.build.rglob("build-attempt-*.log")))
        return result.stdout + result.stderr

    def test_unconfigured_output_rejected_before_lock(self):
        output = self.run_rejected()
        self.assertIn("Prepare and review args.gn", output)
        self.assertFalse((self.build / ".tahai-release-build.lock").exists())

    def test_source_directory_rejected_without_mutation(self):
        before = sorted(p.name for p in self.build.iterdir())
        output = self.run_rejected(ROOT / "tools")
        self.assertIn("BuildDirectory must name a dedicated output", output)
        self.assertEqual(before, sorted(p.name for p in self.build.iterdir()))

    def test_existing_lock_preserves_owner_and_original_error(self):
        (self.build / "args.gn").write_text("# rejection fixture only\n")
        lock = self.build / ".tahai-release-build.lock"
        lock.mkdir()
        owner = lock / "owner.json"
        owner.write_text("not valid JSON: retain for operator inspection\n")
        before = owner.read_bytes()
        output = self.run_rejected()
        self.assertIn("Refusing to reuse existing build lock", output)
        self.assertNotIn("Cannot bind argument to parameter 'Path'", output)
        self.assertEqual(before, owner.read_bytes())
        self.assertFalse(list(self.build.glob("upgrade-checks-*")))

    def test_missing_isolation_records_failure_and_releases_own_lock(self):
        (self.build / "args.gn").write_text("# rejection fixture only\n")
        output = self.run_rejected()
        self.assertIn("designated isolated Windows session", output)
        self.assertFalse((self.build / ".tahai-release-build.lock").exists())
        runs = list(self.build.glob("upgrade-checks-*"))
        self.assertEqual(1, len(runs))
        status = json.loads((runs[0] / "status.json").read_text(encoding="utf-8-sig"))
        self.assertEqual("failed", status["state"])
        self.assertEqual(1, status["exit_code"])
        self.assertIn("designated isolated Windows session",
                      (runs[0] / "runner-error.log").read_text(encoding="utf-8-sig"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--powershell", default=POWERSHELL)
    args, remainder = parser.parse_known_args()
    POWERSHELL = args.powershell
    unittest.main(argv=[__file__, *remainder])
