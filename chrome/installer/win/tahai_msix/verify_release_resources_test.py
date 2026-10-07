# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
"""Unit checks for exact-byte packaged resources, not a real MSIX validation."""
import hashlib
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET
from verify_release_resources import resource_id, verify_resource


class ResourceChecks(unittest.TestCase):
    def test_branded_translation_inputs_match_owned_source_catalogs(self):
        source = Path(__file__).resolve().parents[4]
        build = (source / 'components/strings/BUILD.gn').read_text(encoding='utf-8')
        branded = build.split('grit_strings("components_branded_strings") {', 1)[1].split(
            'grit_strings("components_locale_settings") {', 1)[0]
        self.assertIn('source = "../components_${branding_path_product}_strings.grd"', branded)
        # Chromium 152 derives translation dependencies from each GRD.
        # Its grit_strings target has no separate 154 explicit inputs list.
        self.assertNotIn('inputs = process_file_template(', branded)
        for product, translations in (('tahai', 'chromium'), ('chromium', 'chromium'),
                                      ('google_chrome', 'google_chrome')):
            with self.subTest(product=product):
                catalog_path = source / f'components/components_{product}_strings.grd'
                catalog = ET.parse(catalog_path).getroot()
                imports = catalog.findall('./translations/file')
                self.assertGreater(len(imports), 0)
                for translation in imports:
                    path = catalog_path.parent / translation.attrib['path']
                    self.assertTrue(path.is_file(), str(path))
                    self.assertTrue(path.name.startswith(f'components_{translations}_strings_'),
                                    str(path))

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
