#!/usr/bin/env python3
# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0

"""Synthetic tests for source import integrity; not Chromium runtime tests."""

import io
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

import audit_guard_dependencies as audit


class GuardDependencyAuditTest(unittest.TestCase):
    def setUp(self):
        # Cleanup is confined to this newly created, resolved fixture directory.
        output = (audit.ROOT / "out").resolve(strict=True)
        self.temporary = tempfile.TemporaryDirectory(prefix="tahai-guard-audit-", dir=output)
        self.root = Path(self.temporary.name).resolve(strict=True)
        self.assertTrue(self.root.is_relative_to(output))
        self.addCleanup(self.temporary.cleanup)
        self.vendor = self.root / "vendor"
        self.vendor.mkdir()
        self.cache = self.root / "cache"
        (self.cache / "registry").mkdir(parents=True)
        self.archive = self.cache / "registry" / "fixture-1.0.0.crate"
        self.source = self.vendor / "fixture-v1" / "src" / "lib.rs"
        self.source.parent.mkdir(parents=True)
        self.content = b"// synthetic source, not an engine\n"
        self.source.write_bytes(self.content)
        self.vendor_patch = patch.object(audit, "VENDOR", self.vendor)
        self.vendor_patch.start()
        self.addCleanup(self.vendor_patch.stop)

    def make_archive(self, name="fixture-1.0.0/src/lib.rs"):
        with tarfile.open(self.archive, "w:gz") as archive:
            entry = tarfile.TarInfo(name)
            entry.size = len(self.content)
            archive.addfile(entry, io.BytesIO(self.content))
        return {"name": "fixture", "version": "1.0.0",
                "checksum": audit.digest(self.archive.read_bytes())}

    def test_valid_source_archive(self):
        package = self.make_archive()
        self.assertEqual(1, audit.verify_import_archive(package, self.cache))

    def test_corrupt_archive_is_rejected_before_parsing(self):
        package = self.make_archive()
        self.archive.write_bytes(b"corrupted fixture")
        with self.assertRaisesRegex(ValueError, "checksum mismatch"):
            audit.verify_import_archive(package, self.cache)

    def test_changed_vendored_source_is_rejected(self):
        package = self.make_archive()
        self.source.write_bytes(b"changed fixture")
        with self.assertRaisesRegex(ValueError, "differs from pinned archive"):
            audit.verify_import_archive(package, self.cache)

    def test_traversal_is_rejected_without_extraction(self):
        package = self.make_archive("fixture-1.0.0/../escaped.rs")
        with self.assertRaisesRegex(ValueError, "Unsafe archive path"):
            audit.verify_import_archive(package, self.cache)
        self.assertFalse((self.root / "escaped.rs").exists())

    def test_bounded_reader(self):
        with self.assertRaisesRegex(ValueError, "exceeds audit limit"):
            audit.read_bounded(self.source, maximum=1)

    def test_epoch_mapping(self):
        self.assertEqual("v0_0_7", audit.epoch("0.0.7"))
        self.assertEqual("v0_12", audit.epoch("0.12.6"))
        self.assertEqual("v1", audit.epoch("1.0.3+wasi"))


if __name__ == "__main__":
    unittest.main()
