#!/usr/bin/env python3
"""Fail-closed source gate for the narrowly scoped aho-corasick policy exception."""
from __future__ import annotations

import hashlib
import json
import pathlib
import re
import subprocess
import sys
import tomllib

ROOT = pathlib.Path(__file__).resolve().parents[2]
VENDOR = pathlib.Path("third_party/rust/chromium_crates_io/vendor/aho-corasick-v1")
REVISION = "5178060ce73d91938f8582d0360e3be031380440"
VENDOR_TREE = "27c3664295339f29f80833fa5a13649690dc54bd"
BASE_CONFIG_BLOB = "30bc1e20a6ad9cce64d05738218e76b89d09ed11"
BASE_BUILD_BLOB = "d8f7028e7b166b2218dc2677a26516e4f3ef469c"
BASE_LOCK_BLOB = "432eaacb13fdb4021297fb6fa493536949c3d52e"
checks = 0


def check(condition: bool, message: str) -> None:
    global checks
    checks += 1
    if not condition:
        raise AssertionError(message)


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def git_blob_sha1(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def git_tree(path: str) -> str:
    return subprocess.check_output(
        ["git", "rev-parse", f"HEAD:{path}"], cwd=ROOT, text=True
    ).strip()


def target_block(text: str, target: str) -> str:
    match = re.search(
        rf"(?ms)^cargo_crate\(\"{re.escape(target)}\"\)\s*\{{([\s\S]*?)^\}}",
        text,
    )
    if not match:
        raise AssertionError(f"missing generated cargo_crate({target}) target")
    return match.group(1)


def gn_list(block: str, field: str) -> list[str]:
    match = re.search(rf"(?ms)^\s*{field}\s*=\s*\[([^]]*)\]", block)
    if not match:
        raise AssertionError(f"missing generated {field} list")
    return re.findall(r'"([^"\r\n]+)"', match.group(1))


def expect_no_single_process(relative_paths: list[str]) -> None:
    # Deliberately support both the command-line switch and the GN/runtime
    # equivalents that cause utility services to run in the browser process.
    forbidden = re.compile(r"(?i)--single-process|single_process|run_renderer_in_process")
    for relative in relative_paths:
        text = read(relative)
        check(forbidden.search(text) is None, f"single-process setting in {relative}")


def release_argument_paths() -> list[str]:
    extensions = {".ps1", ".psm1", ".py", ".xml", ".json", ".cmd", ".bat", ".url", ".lnk"}
    roots = [ROOT / "tools/tahai", ROOT / "chrome/installer/win"]
    paths = []
    for directory in roots:
        for path in directory.rglob("*"):
            if path.is_file() and path.suffix.lower() in extensions and path.name != pathlib.Path(__file__).name:
                paths.append(path.relative_to(ROOT).as_posix())
    return sorted(set(paths))


def main() -> int:
    config_path = ROOT / "third_party/rust/chromium_crates_io/gnrt_config.toml"
    config_bytes = config_path.read_bytes()
    config_text = config_bytes.decode("utf-8")
    parsed = tomllib.loads(config_text)
    aho = parsed["crate"]["aho-corasick"]
    check(aho.get("group") == "safe", "aho-corasick group changed from safe")
    check(aho.get("allow_first_party_usage") is False, "first-party usage must remain false")
    check(aho.get("extra_kv") == {"allow_unsafe": True}, "aho exception must be exactly extra_kv.allow_unsafe=true")
    adblock_config = parsed["crate"]["adblock"]
    regex_config = parsed["crate"]["regex"]
    check(adblock_config.get("group") == "sandbox" and
          adblock_config.get("extra_kv", {}).get("visibility") == ["//chrome/services/tahai_guard:*"] ,
          "Adblock must remain confined to the Guard service targets")
    check(regex_config.get("group") == "sandbox" and regex_config.get("allow_first_party_usage") is False,
          "regex must remain a sandbox-only third-party dependency")

    # Reverting only this field must reproduce the reviewed input blob byte for
    # byte, proving no neighboring Rust policy or crate setting changed.
    match = re.search(
        rb"(?ms)(^\[crate\.aho-corasick\]\s*$)(.*?)(?=^\[|\Z)", config_bytes
    )
    check(match is not None, "cannot isolate aho-corasick config stanza")
    body = match.group(2)
    replaced, count = re.subn(
        rb"(?m)^extra_kv = \{ allow_unsafe = true \}$",
        b"extra_kv = { allow_unsafe = false }",
        body,
    )
    check(count == 1, "expected exactly one aho allow_unsafe setting")
    canonical_config = config_bytes[: match.start(2)] + replaced + config_bytes[match.end(2) :]
    check(git_blob_sha1(canonical_config) == BASE_CONFIG_BLOB, "unrelated gnrt Rust policy/config changed")
    rust_changes = subprocess.check_output(
        ["git", "diff", "--name-only", "HEAD", "--", "third_party/rust"],
        cwd=ROOT, text=True,
    ).splitlines()
    check(sorted(rust_changes) == [
        "third_party/rust/aho_corasick/v1/BUILD.gn",
        "third_party/rust/chromium_crates_io/gnrt_config.toml",
    ], f"unexpected tracked third_party/rust changes: {rust_changes}")

    lock = tomllib.loads(read("third_party/rust/chromium_crates_io/Cargo.lock"))
    aho_lock = [p for p in lock["package"] if p["name"] == "aho-corasick" and p["version"] == "1.1.5"]
    check(len(aho_lock) == 1, "Cargo.lock must resolve exactly aho-corasick 1.1.5")
    check("memchr" in aho_lock[0].get("dependencies", []), "aho Cargo dependency changed")
    check(git_blob_sha1((ROOT / "third_party/rust/chromium_crates_io/Cargo.lock").read_bytes()) == BASE_LOCK_BLOB,
          "Cargo.lock changed during the policy repair")
    version = dict(line.split("=", 1) for line in read("chrome/VERSION").splitlines() if "=" in line)
    check([version.get(key) for key in ("MAJOR", "MINOR", "BUILD", "PATCH")] == ["154", "0", "8037", "93"],
          "source is not Chromium 154.0.8037.93")
    cargo = tomllib.loads(read(VENDOR.as_posix() + "/Cargo.toml"))
    check(cargo["package"]["version"] == "1.1.5", "vendored crate version changed")
    vcs = json.loads(read(VENDOR.as_posix() + "/.cargo_vcs_info.json"))
    check(vcs["git"]["sha1"] == REVISION, "vendored upstream source revision changed")
    tree_path = VENDOR.as_posix()
    check(subprocess.run(["git", "diff", "--quiet", "HEAD", "--", tree_path], cwd=ROOT).returncode == 0,
          "working-tree vendor source differs from the reviewed Chromium tree")
    untracked_vendor = subprocess.check_output(
        ["git", "ls-files", "--others", "--exclude-standard", "--", tree_path],
        cwd=ROOT, text=True,
    ).splitlines()
    check(not untracked_vendor, f"untracked vendor source files found: {untracked_vendor}")
    check(git_tree(tree_path) == VENDOR_TREE, "vendored aho-corasick source tree changed")
    readme = read("third_party/rust/aho_corasick/v1/README.chromium")
    check(f"Version: 1.1.5" in readme and f"Revision: {REVISION}" in readme, "Chromium vendor record differs")

    build_text = read("third_party/rust/aho_corasick/v1/BUILD.gn")
    block = target_block(build_text, "lib")
    check('crate_name = "aho_corasick"' in block, "generated crate name changed")
    check('cargo_pkg_version = "1.1.5"' in block, "generated crate version changed")
    check(re.search(r"(?m)^\s*allow_unsafe = true\s*$", block) is not None, "generated unsafe opt-in missing")
    check(gn_list(block, "features") == ["perf-literal", "std"], "generated aho features changed")
    check(gn_list(block, "deps") == ["//third_party/rust/memchr/v2:lib"], "generated aho dependencies changed")
    check(gn_list(block, "visibility") == ["//third_party/rust/*"], "generated aho visibility changed")
    reverted, count = re.subn(
        rb"(?m)^  allow_unsafe = true$", b"  allow_unsafe = false", build_text.encode()
    )
    check(count == 1 and git_blob_sha1(reverted) == BASE_BUILD_BLOB, "generated BUILD.gn has changes beyond the one unsafe bit")

    regex = target_block(read("third_party/rust/regex/v1/BUILD.gn"), "lib")
    regex_automata = target_block(read("third_party/rust/regex_automata/v0_4/BUILD.gn"), "lib")
    adblock = target_block(read("third_party/rust/adblock/v0_12/BUILD.gn"), "lib")
    check("//third_party/rust/aho_corasick/v1:lib" in gn_list(regex, "deps"), "regex -> aho dependency missing")
    check("//third_party/rust/aho_corasick/v1:lib" in gn_list(regex_automata, "deps"), "regex-automata -> aho dependency missing")
    check("//third_party/rust/regex/v1:lib" in gn_list(adblock, "deps"), "adblock -> regex dependency missing")
    check('visibility += [ "//chrome/services/tahai_guard:*" ]' in adblock,
          "generated adblock visibility escaped Guard")
    packages = {p["name"]: p for p in lock["package"] if p["name"] in {"adblock", "regex", "regex-automata"}}
    check("aho-corasick" in packages["regex"].get("dependencies", []), "Cargo.lock regex -> aho edge missing")
    check("aho-corasick" in packages["regex-automata"].get("dependencies", []), "Cargo.lock regex-automata -> aho edge missing")
    check("regex" in packages["adblock"].get("dependencies", []), "Cargo.lock adblock -> regex edge missing")
    direct_gn = subprocess.check_output(
        ["git", "grep", "-l", "-F", '"//third_party/rust/aho_corasick/v1:lib"', "--", "*.gn", "*.gni"],
        cwd=ROOT, text=True, stderr=subprocess.DEVNULL
    ).splitlines()
    check(sorted(direct_gn) == ["third_party/rust/regex/v1/BUILD.gn", "third_party/rust/regex_automata/v0_4/BUILD.gn"],
          f"unexpected direct GN consumers of aho-corasick: {direct_gn}")
    guard = read("chrome/services/tahai_guard/BUILD.gn")
    service = re.search(r"(?ms)^source_set\(\"lib\"\)\s*\{(.*?)^\}", guard).group(1)
    engine = re.search(r"(?ms)^rust_static_library\(\"engine_rs\"\)\s*\{(.*?)^\}", guard).group(1)
    check("//third_party/rust/adblock/v0_12:lib" in gn_list(engine, "deps"), "Guard engine -> adblock dependency missing")
    check(":engine_rs" in gn_list(service, "deps"), "Guard service lib -> engine_rs dependency missing")
    check(gn_list(service, "visibility") == ["//chrome/utility:*"] , "Guard service visibility changed")
    browser_guard = read("chrome/browser/tahai_guard/BUILD.gn")
    check("third_party/rust/aho_corasick" not in browser_guard and "third_party/rust/adblock" not in browser_guard,
          "browser Guard target acquired a direct third-party Rust dependency")

    mojom = read("chrome/services/tahai_guard/public/mojom/guard_engine.mojom")
    mojom_methods = re.findall(r"(?m)^  ([A-Z][A-Za-z0-9_]*)\(", mojom)
    check(mojom_methods == ["Configure", "Match", "Cosmetics"], "Guard Mojom authority surface expanded")
    session = read("chrome/browser/tahai_guard/guard_engine_session.cc")
    host = read("content/public/browser/service_process_host.h")
    host_impl = read("content/browser/service_host/service_process_host_impl.cc")
    utility = read("content/browser/service_host/utility_process_host.cc")
    win_delegate = read("content/browser/service_host/utility_sandbox_delegate_win.cc")
    win_policy = read("sandbox/policy/win/sandbox_win.cc")
    check("[ServiceSandbox=sandbox.mojom.Sandbox.kService]" in mojom, "Guard Mojom sandbox trait changed")
    check("ServiceProcessHost::Launch<mojom::GuardEngine>" in session, "Guard no longer launches via ServiceProcessHost")
    check("return Interface::kServiceSandbox;" in host, "ServiceProcessHost trait mapping changed")
    check(".WithSandboxType(sandbox)" in host_impl and "return true;" in host_impl,
          "ServiceProcessHost no longer enables the declared sandbox by default")
    check("if (RenderProcessHost::run_renderer_in_process())" in utility,
          "utility in-process development exception changed; review required")
    check("AddDefaultConfigForSandboxedProcess(config)" in win_policy and "USER_LOCKDOWN" in win_policy and
          "SetIntegrityLevel(INTEGRITY_LEVEL_LOW)" in win_policy, "Windows restricted-token/low-integrity policy changed")
    check("SetJobLevel(sandbox_type, JobLevel::kLockdown" in win_policy, "Windows service lockdown job policy changed")
    check("sandbox::mojom::Sandbox::kService" in win_delegate and "AddWin32kLockdownPolicy(config)" in win_delegate and
          "SetFilterEnvironment(true)" in win_delegate and "MITIGATION_DYNAMIC_CODE_DISABLE" in win_delegate,
          "Windows kService mitigation policy changed")
    appcontainer_fn = re.search(
        r"(?ms)bool SandboxWin::IsAppContainerEnabledForSandbox\([\s\S]*?\n\}", win_policy
    )
    check(appcontainer_fn is not None and "sandbox_type == Sandbox::kNetwork" in appcontainer_fn.group(0) and
          "sandbox_type == Sandbox::kService" not in appcontainer_fn.group(0),
          "AppContainer whitelist changed; re-evaluate Guard runtime expectations")

    runner = read("tools/tahai/verify_upgrade.ps1")
    check("$nativeArgsText -match $singleProcessSetting" in runner and "args.gn" in runner,
          "release runner must enforce its actual generated args.gn")
    check("TahaiServiceSandboxRuntimeBoundary" in read("chrome/browser/tahai_guard/guard_engine_browsertest.cc"),
          "native browser runtime sentinel is missing")
    check("--gtest_filter=*Tahai*" in runner, "release acceptance no longer selects Guard runtime sentinel")
    forbidden_paths = release_argument_paths()
    expect_no_single_process(forbidden_paths)
    args = ROOT / "out/tahai_rc_154_x64/args.gn"
    if args.is_file():
        expect_no_single_process([args.relative_to(ROOT).as_posix()])
    manifest = read("chrome/installer/win/tahai_msix/AppxManifest.xml")
    check("Arguments=" not in manifest and "Arguments =" not in manifest,
          "MSIX manifest must not inject a startup command-line")

    # The permanent Rust default must still be a deny policy; the exception is
    # scoped in gnrt data and the generated target rather than a global flag.
    cargo_gni = read("build/rust/cargo_crate.gni")
    rust_build = read("build/rust/BUILD.gn")
    check("allow_unsafe = true" in cargo_gni and "allow_unsafe = invoker.allow_unsafe" in cargo_gni and
          "-Funsafe_code" in rust_build, "global Rust unsafe-code enforcement changed")

    print(f"PASS {checks} source-only aho-corasick policy and Guard-boundary checks")
    print("SOURCE_ONLY: process launch, PID separation, token, sandbox, AppContainer, and filesystem/network authority are not verified here")
    print("SOURCE_ONLY: runtime Guard sentinels exist and the release runner selects the Tahai browser-test filter")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"FAIL_CLOSED: {exc}", file=sys.stderr)
        raise SystemExit(1)
