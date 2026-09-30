# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
"""Unit checks for exact-byte packaged resources, not a real MSIX validation."""
import hashlib
from pathlib import Path
import tempfile
import unittest
from verify_release_resources import resource_id, verify_resource


class ResourceChecks(unittest.TestCase):
    def test_exact_compiled_bytes_are_required(self):
        master = b'approved-Royal-master'
        self.assertEqual(hashlib.sha256(master).hexdigest(),
                         verify_resource({42: master}, 42, master, 'Royal'))
        for resources in ({}, {42: b'old-blue-mark'}, {43: master}, {42: master + b'\0'}):
            with self.subTest(resources=resources):
                with self.assertRaisesRegex(ValueError, 'Royal'):
                    verify_resource(resources, 42, master, 'Royal')

    def test_ambiguous_or_missing_generated_id_cannot_pass(self):
        with tempfile.TemporaryDirectory(prefix='brand-id-', dir=Path(__file__).resolve().parents[4] / 'out') as directory:
            header = Path(directory) / 'resources.h'
            header.write_text('#define ROYAL 42\n', encoding='utf-8')
            self.assertEqual(42, resource_id(header, 'ROYAL'))
            for text in ('#define OTHER 42\n', '#define ROYAL 42\n#define ROYAL 43\n'):
                header.write_text(text, encoding='utf-8')
                with self.assertRaises(ValueError):
                    resource_id(header, 'ROYAL')


if __name__ == '__main__':
    unittest.main(verbosity=2)
