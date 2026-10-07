#!/usr/bin/env python3
# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
"""Verify the 152 Guard Rust graph and existing sandbox-only unsafe policy."""

from pathlib import Path
import json
import re
import subprocess
import tomllib

ROOT = Path(__file__).resolve().parents[2]
VENDOR = 'third_party/rust/chromium_crates_io/vendor/aho-corasick-v1'
OFFICIAL_VENDOR_TREE = '7d8bb9ff1f94efa627c4e6439277584fca6c4919'
checks = 0


def check(value, message):
    global checks
    checks += 1
    if not value:
        raise AssertionError(message)


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def block(path):
    text = read(path)
    match = re.search(r'(?ms)^cargo_crate\("lib"\)\s*\{(.*?)^\}', text)
    check(match is not None, 'missing generated library: ' + path)
    return match.group(1)


def gn_list(text, name):
    match = re.search(r'(?ms)^\s*' + name + r'\s*=\s*\[([^]]*)\]', text)
    check(match is not None, 'missing generated list: ' + name)
    return re.findall(r'"([^"\r\n]+)"', match.group(1))


def main():
    version = dict(line.split('=', 1) for line in read('chrome/VERSION').splitlines())
    check([version[k] for k in ('MAJOR', 'MINOR', 'BUILD', 'PATCH')] ==
          ['152', '0', '7977', '158'], 'wrong fallback engine version')
    config = tomllib.loads(read('third_party/rust/chromium_crates_io/gnrt_config.toml'))['crate']
    aho = config['aho-corasick']
    check(aho.get('group') == 'sandbox', 'aho must remain sandbox-only')
    check(aho.get('allow_first_party_usage') is False, 'aho cannot be first-party exposed')
    check(aho.get('extra_kv') == {'allow_unsafe': True}, 'existing 152 unsafe policy changed')
    check(config['regex'].get('group') == 'sandbox', 'regex escaped sandbox group')
    check(config['regex'].get('allow_first_party_usage') is False, 'regex became first-party visible')
    check(config['adblock'].get('group') == 'sandbox', 'adblock escaped sandbox group')
    check(config['adblock'].get('extra_kv', {}).get('visibility') ==
          ['//chrome/services/tahai_guard:*'], 'adblock escaped Guard service targets')

    lock = tomllib.loads(read('third_party/rust/chromium_crates_io/Cargo.lock'))['package']
    packages = {p['name']: p for p in lock if p['name'] in
                {'aho-corasick', 'adblock', 'regex', 'regex-automata'}}
    check(packages['aho-corasick']['version'] == '1.1.4', 'aho version rolled')
    check(packages['adblock']['version'] == '0.12.6', 'reviewed adblock version rolled')
    cargo = tomllib.loads(read(VENDOR + '/Cargo.toml'))
    check(cargo['package']['version'] == '1.1.4', 'vendored aho version differs from lock')
    vcs = json.loads(read(VENDOR + '/.cargo_vcs_info.json'))
    check(vcs['git']['sha1'] == '17f8b32e3b7c845ef3c5429b823804f552f14ec9',
          'vendored aho revision changed')
    # Hosted source verification uses a shallow publication checkout. Compare
    # its committed vendor tree to the independently verified upstream hash;
    # do not require the Chromium tag to be present in that checkout.
    tree = subprocess.check_output(['git', 'rev-parse', 'HEAD:' + VENDOR],
                                   cwd=ROOT, text=True).strip()
    check(tree == OFFICIAL_VENDOR_TREE, 'aho tree differs from verified official source')
    result = subprocess.run(['git', 'diff', '--quiet', 'HEAD', '--', VENDOR], cwd=ROOT)
    check(result.returncode == 0, '152 aho source changed from official source')
    extra = subprocess.check_output(['git', 'ls-files', '--others', '--exclude-standard',
                                     '--', VENDOR], cwd=ROOT, text=True)
    check(not extra.strip(), 'untracked aho source found')

    generated = block('third_party/rust/aho_corasick/v1/BUILD.gn')
    check('cargo_pkg_version = "1.1.4"' in generated, 'generated aho version differs')
    check(re.search(r'(?m)^\s*allow_unsafe = true\s*$', generated), 'generated policy inconsistent')
    check(gn_list(generated, 'features') == ['perf-literal', 'std'], 'aho features changed')
    check(gn_list(generated, 'deps') == ['//third_party/rust/memchr/v2:lib'], 'aho dependencies changed')
    check(gn_list(generated, 'visibility') == ['//third_party/rust/*'], 'aho visibility broadened')
    for consumer, path in [('regex', 'regex/v1'), ('regex-automata', 'regex_automata/v0_4')]:
        check('aho-corasick' in packages[consumer]['dependencies'], 'missing Cargo edge: ' + consumer)
        check('//third_party/rust/aho_corasick/v1:lib' in
              gn_list(block('third_party/rust/' + path + '/BUILD.gn'), 'deps'),
              'missing generated GN edge: ' + consumer)
    adblock = block('third_party/rust/adblock/v0_12/BUILD.gn')
    check('regex' in packages['adblock']['dependencies'], 'missing adblock Cargo edge')
    check('//third_party/rust/regex/v1:lib' in gn_list(adblock, 'deps'), 'missing adblock GN edge')
    check('visibility += [ "//chrome/services/tahai_guard:*" ]' in adblock,
          'generated adblock visibility escaped Guard')
    direct = subprocess.check_output(['git', 'grep', '-l', '-F',
                                      '"//third_party/rust/aho_corasick/v1:lib"',
                                      '--', '*.gn', '*.gni'], cwd=ROOT, text=True).splitlines()
    check(sorted(direct) == ['third_party/rust/regex/v1/BUILD.gn',
                             'third_party/rust/regex_automata/v0_4/BUILD.gn'],
          'unexpected direct aho consumer')
    service = read('chrome/services/tahai_guard/BUILD.gn')
    check('visibility = [ "//chrome/utility:*" ]' in service, 'Guard native code escaped utility process')
    check('[ServiceSandbox=sandbox.mojom.Sandbox.kService]' in
          read('chrome/services/tahai_guard/public/mojom/guard_engine.mojom'), 'Guard sandbox weakened')
    check('ServiceProcessHost::Launch<mojom::GuardEngine>' in
          read('chrome/browser/tahai_guard/guard_engine_session.cc'), 'Guard utility launch missing')
    print(f'PASS {checks} Guard Rust policy checks')


if __name__ == '__main__':
    main()
