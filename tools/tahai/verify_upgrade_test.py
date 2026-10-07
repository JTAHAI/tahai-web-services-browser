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

    def run_sequence_fixture(self, failed_target):
        # Execute the runner's build block with a process fixture. No GN,
        # compiler or Ninja executable is launched by these tests.
        source = (ROOT / "tools/tahai/verify_upgrade.ps1").read_text()
        block = source.split(
            "  $buildStarted = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()", 1)[1]
        block = "$buildStarted = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()" + block
        block = block.split(
            "  if ($buildExit -ne 0) { Write-UpgradeStatus 'failed'", 1)[0]
        fixture = self.build / "sequence-fixture.ps1"
        fixture.write_text("""
param([string]$RunDirectory, [string]$FailedTarget)
$ErrorActionPreference = 'Stop'
$nativeSource = $RunDirectory
$BuildDirectory = $RunDirectory
$Jobs = 2
$python = 'Invoke-FixtureProcess'
$logged = 'fixture-only'
$calls = [Collections.Generic.List[string]]::new()
function Write-UpgradeStatus { }
function Invoke-FixtureProcess {
  $target = $args[-1]
  $calls.Add($target)
  if ($target -ceq $FailedTarget) {
    'FAILED: fixture process' | Set-Content -LiteralPath $args[2]
    $global:LASTEXITCODE = 7
  } else {
    ('Built fixture ' + $target) | Set-Content -LiteralPath $args[2]
    $global:LASTEXITCODE = 0
  }
}
""" + block + """
$calls.ToArray() | ConvertTo-Json | Set-Content (Join-Path $RunDirectory 'calls.json')
""", encoding="utf-8")
        result = subprocess.run(
            [POWERSHELL, "-NoProfile", "-File", str(fixture),
             "-RunDirectory", str(self.build), "-FailedTarget", failed_target],
            capture_output=True, text=True, timeout=30)
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        calls = json.loads((self.build / "calls.json").read_text(encoding="utf-8-sig"))
        record = json.loads((self.build / "build-result.json").read_text(encoding="utf-8-sig"))
        return calls, record, (self.build / "build.log").read_text(encoding="utf-8-sig")

    def test_release_targets_are_sequential_and_all_exits_recorded(self):
        calls, record, log = self.run_sequence_fixture("")
        self.assertEqual(['chrome', 'tahai_mission_service_tests',
                          'elevation_service', 'elevated_tracing_service',
                          'elevation_service_unittests',
                          'elevated_tracing_service_unittests', 'browser_tests'], calls)
        self.assertEqual(calls, [entry['target'] for entry in record['targets']])
        self.assertEqual(0, record['buildExitCode'])
        self.assertTrue(all(entry['exitCode'] == 0 for entry in record['targets']))
        self.assertEqual(7, log.count('Built fixture '))

    def test_failed_target_stops_before_later_targets_without_retry(self):
        calls, record, log = self.run_sequence_fixture('elevation_service')
        self.assertEqual(['chrome', 'tahai_mission_service_tests', 'elevation_service'], calls)
        self.assertEqual(7, record['buildExitCode'])
        self.assertEqual([0, 0, 7], [entry['exitCode'] for entry in record['targets']])
        self.assertIn('FAILED: fixture process', log)
        self.assertNotIn('browser_tests', log)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--powershell", default=POWERSHELL)
    args, remainder = parser.parse_known_args()
    POWERSHELL = args.powershell
    unittest.main(argv=[__file__, *remainder])
