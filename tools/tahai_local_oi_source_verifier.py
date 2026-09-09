#!/usr/bin/env python3
"""Static safety gate for TAHAI Local OI source; does not build or run Chrome."""

from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
OI = ROOT / "chrome" / "browser" / "ui" / "webui" / "tahai"
SOURCES = [
    p
    for p in OI.glob("tahai_local_oi_*.cc")
    if not p.name.endswith(("_unittest.cc", "_browsertest.cc"))
]
SOURCES += [p for p in OI.glob("tahai_local_oi_*.h") if "unittest" not in p.name]
SOURCES += [OI / "tahai_oi_promotion_contract.cc", OI / "tahai_oi_link_contract.cc"]
SOURCES += [OI / "tahai_network_inspector.cc", OI / "tahai_network_inspector.h"]
SOURCES += [
    OI / "tahai_change_lens_contract.cc",
    OI / "tahai_change_lens_contract.h",
    OI / "tahai_environment_guard.cc",
    OI / "tahai_environment_guard.h",
    OI / "tahai_sentinel_contract.cc",
    OI / "tahai_sentinel_contract.h",
]

# Each rule targets an implementation pattern, not explanatory comments.
RULES = {
    "placeholder_projection": re.compile(r"snapshot\.(capabilities\s*=|scale_signals\.push_back)"),
    "raw_page_capture": re.compile(r"\b(raw_page_body|page_body|document\.body|innerHTML)\b"),
    "cookie_capture": re.compile(r"\b(GetCookies|cookie_value|document\.cookie)\b"),
    "auth_capture": re.compile(r"\b(authorization_header|access_token|refresh_token|oauth_token)\b"),
    "generic_privileged_handler": re.compile(r"\b(execute_shell|read_any_file|write_any_file)\b"),
    "direct_connector_client": re.compile(r"\b(PSAClient|RMMClient|ITDocsClient)\b"),
    "response_body_capture": re.compile(r"\b(DownloadToString|raw_response_body)\b"),
    "response_header_capture": re.compile(r"\b(GetNormalizedHeader|raw_response_headers)\b"),
}


def main() -> int:
    failures: list[str] = []
    for path in SOURCES:
        if not path.exists():
            failures.append(f"missing expected source: {path.relative_to(ROOT)}")
            continue
        text = path.read_text(encoding="utf-8")
        for name, pattern in RULES.items():
            if path.name == "tahai_local_oi_redactor.cc" and name in {
                "cookie_capture", "auth_capture"
            }:
                continue
            if pattern.search(text):
                failures.append(f"{name}: {path.relative_to(ROOT)}")

    promotion = (OI / "tahai_oi_promotion_contract.cc").read_text(encoding="utf-8")
    if "https://ops.tahaiportal.com?utm_source=tahai_browser" not in promotion:
        failures.append("promotion_allowlist: expected public OI referral base is absent")
    if re.search(r"ops\.tahaiportal\.com/(?!\?)", promotion):
        failures.append("promotion_allowlist: promotion path must not encode local data")
    for forbidden in ("mission_name", "tenant_id", "ticket_id", "profile_id", "finding_text"):
        if forbidden in promotion:
            failures.append(f"promotion_privacy: forbidden referral field {forbidden}")

    report = (OI / "tahai_local_oi_model.cc").read_text(encoding="utf-8")
    if ("local-only" not in report or "no hosted audit" not in report or
            "RedactLocalOiExportText" not in report):
        failures.append("report_boundary: local-only/hosted-audit limitation is missing")
    for required in (
        "Report focus: aggregate local operational posture only.",
        "Report focus: handoff posture",
        "Report focus: explicit change posture",
        "Report focus: local knowledge-gap posture",
        "Report focus: local evidence inventory",
        "Report focus: local artifact-integrity posture",
        "Report focus: local diagnostic posture",
    ):
        if required not in report:
            failures.append(
                f"report_boundary: workflow-safe report focus is absent: {required}"
            )
    for required in (
        "LocalOiSafeReportFormatFromString",
        "tahai_local_oi_safe_report_v1",
        'report.Set("status", "local-only")',
        'report.Set("generated_at", safe_generated_at)',
        "base::JSONWriter::Write",
    ):
        if required not in report:
            failures.append(
                f"report_boundary: safe JSON report contract is absent: {required}"
            )
    if "BuildLocalOiDataInventory" not in report:
        failures.append("inventory_boundary: local data inventory model is absent")
    for required in (
        "selected_record_ids",
        "snapshot.findings.begin()",
        "BuildLocalOiDeterministicBrief",
        "Excluded: record labels, identifiers, details",
    ):
        if required not in report:
            failures.append(
                f"local_assist_boundary: bounded entity/finding brief support is absent: {required}"
            )

    assist = (OI / "tahai_local_oi_assist.h").read_text(encoding="utf-8")
    for required in (
        "kExplainSelectedFindings",
        "kSummarizeSelectedRecords",
        "kDraftChecklist",
        "kDraftSanitizedHandoff",
        "LocalOiDeterministicBrief",
        "LocalOiAssistAdapter",
    ):
        if required not in assist:
            failures.append(
                f"local_assist_boundary: required on-device assist contract is absent: {required}"
            )
    for forbidden in (
        "GenerateRemote",
        "RemoteProvider",
        "NetworkRequest",
        "NavigateTo",
        "ExecuteTool",
        "RunShell",
    ):
        if forbidden in assist:
            failures.append(
                f"local_assist_privacy: forbidden assist contract capability {forbidden}"
            )

    if "MissionIdForAffectedEntity" not in report or "direct Mission edges" not in report:
        failures.append(
            "finding_context: direct typed Mission context resolver is absent"
        )

    network = (OI / "tahai_network_inspector.cc").read_text(encoding="utf-8")
    for required in (
        'request->method = "HEAD"',
        "CredentialsMode::kOmit",
        "RedirectMode::kError",
        "DownloadHeadersOnly",
        "SetTimeoutDuration(base::Seconds(12))",
        "kMaximumDnsLabelLength = 63u",
        "IsPublicInspectionHost",
        "HasOnlyPubliclyRoutableAddresses",
        "ERR_ADDRESS_UNREACHABLE",
        "target_rejected",
        "public_address_guard_blocked",
        "BuildTahaiNetworkInspectionSafeSummary",
        "BuildTahaiNetworkInspectionGuidance",
        "PopulateSecurityHeaderObservation",
        "HasHeader(\"Strict-Transport-Security\")",
        "kObservedSecurityHeaderVocabularySize = 6",
        "observed_security_header_count",
        "CERT_STATUS_COMMON_NAME_INVALID",
        "CERT_STATUS_AUTHORITY_INVALID",
        "CERT_STATUS_REVOKED",
        "No immediate deterministic escalation was derived.",
        "credential-free probe was not authenticated",
        "authenticated service health",
        "Excluded: addresses, aliases, certificate names",
    ):
        if required not in network:
            failures.append(
                f"network_inspection_boundary: required bounded-probe control is absent: {required}"
            )

    service = (OI / "tahai_local_oi_service.cc").read_text(encoding="utf-8")
    if "kFindingReopened" not in service or \
            "Local OI finding reopened after recalculation." not in service:
        failures.append("finding_lifecycle: active resolved findings do not reopen visibly")
    for required in (
        "RecordSafeReportCopied",
        "kSafeExportCompleted",
        "explicitly copied to the",
        "clipboard.",
    ):
        if required not in service:
            failures.append(
                f"safe_export_boundary: explicit local clipboard export trace is absent: {required}"
            )
    for required in (
        "RecordDocumentReference",
        'SetField(&reference, "reference_opened", "false")',
        'SetField(&reference, "content_retained", "false")',
        'SetField(&watch, "execution_mode", "manual_only")',
        'SetField(&watch, "network_scheduler", "false")',
        'SetField(&endpoint, "browser_wide_enforcement", "false")',
        "kEnvironmentMissionUseBasis",
        "kDocumentationMissionUseBasis",
        "RemoveMissionAssociationByTargetAndBasis",
        "NetworkInspectionHistory",
        "kMaximumInspectionHistoryRows = 8u",
        "BoundedDnsTopologyCount",
        '"dns_ipv4_count"',
        '"dns_ipv6_count"',
        '"dns_alias_count"',
        '"security_header_observation_available"',
        '"observed_security_header_count"',
        '"tls_certificate_name_mismatch"',
        '"tls_certificate_authority_invalid"',
        '"tls_certificate_revoked"',
        '"public_address_guard_blocked"',
        "ChangeCaptureHistory",
        "kMaximumChangeCaptureHistoryRows = 8u",
        "ArtifactHistory",
        "kMaximumArtifactHistoryRows = 8u",
        "EnvironmentClassifications",
        "kMaximumEnvironmentClassifications = 16u",
        "DocumentReferencesForEndpoint",
        "kMaximumDocumentReferencesPerEndpoint = 16u",
        "ManualWatches",
        "kMaximumManualWatchRows = 16u",
        "watch_id",
        "manual-only local ",
        "watch configuration.",
    ):
        if required not in service:
            failures.append(
                f"local_record_boundary: required local-only contract is absent: {required}"
            )
    for forbidden in (
        "JoinInspectionValues",
        "InspectionValuesFingerprint",
        '"dns_addresses"',
        '"dns_aliases"',
        '"dns_addresses_fingerprint"',
        '"dns_aliases_fingerprint"',
    ):
        if forbidden in service:
            failures.append(
                f"local_record_privacy: raw DNS inspection retention remains: {forbidden}"
            )
    for required in (
        "HasMissionChangeCaptureWithState",
        '"before_snapshot", has_before_snapshot ? "true" : "false"',
        '"after_snapshot", has_after_snapshot ? "true" : "false"',
    ):
        if required not in service:
            failures.append(
                f"change_mission_boundary: explicit snapshot projection is absent: {required}"
            )
    for forbidden in (
        '"before_snapshot", "false"',
        '"after_snapshot", "false"',
    ):
        if forbidden in service:
            failures.append(
                f"change_mission_boundary: hard-coded snapshot state remains: {forbidden}"
            )

    rule_engine = (OI / "tahai_local_oi_rule_engine.cc").read_text(encoding="utf-8")
    for required in (
        "local_oi.artifact.same_source_different_hash.v1",
        "Artifact source has conflicting hashes",
        "displayed in this finding.",
    ):
        if required not in rule_engine:
            failures.append(
                f"artifact_integrity_boundary: safe conflicting-hash rule is absent: {required}"
            )

    for required in (
        "local_oi.endpoint.public_address_guard_blocked.v1",
        "Public address guard blocked inspection",
        "the explicit HTTPS probe was not sent.",
    ):
        if required not in rule_engine:
            failures.append(
                f"network_guard_boundary: explainable public-address-guard rule is absent: {required}"
            )
    for required in (
        "local_oi.endpoint.http_security_headers_not_observed.v1",
        "No selected HTTP security headers were observed",
        "No header values or authenticated response data were retained.",
    ):
        if required not in rule_engine:
            failures.append(
                f"network_header_boundary: bounded HTTP header observation rule is absent: {required}"
            )

    for required in (
        "local_oi.endpoint.tls_certificate_imminent.v1",
        "Endpoint certificate expires imminently",
        "days_remaining >= 0 && days_remaining <= 3",
        "days_remaining >= 0 && days_remaining <= 14",
    ):
        if required not in rule_engine:
            failures.append(
                f"certificate_expiry_boundary: prioritized imminent-expiry rule is absent: {required}"
            )

    for required in (
        "local_oi.endpoint.legacy_tls_version.v1",
        "Endpoint uses a legacy TLS version",
        'HasFieldValue(entity, "tls_version", "TLS 1.0")',
        'HasFieldValue(entity, "tls_version", "TLS 1.1")',
        "not an authenticated service",
    ):
        if required not in rule_engine:
            failures.append(
                f"legacy_tls_boundary: explainable legacy TLS rule is absent: {required}"
            )

    for required in (
        "local_oi.endpoint.tls_certificate_revoked.v1",
        "Endpoint certificate is revoked",
        "local_oi.endpoint.tls_certificate_authority_invalid.v1",
        "Endpoint certificate authority is not trusted",
        "local_oi.endpoint.tls_certificate_name_mismatch.v1",
        "Endpoint certificate does not match the target",
        "This finding retains only the fixed failure",
    ):
        if required not in rule_engine:
            failures.append(
                f"certificate_failure_boundary: typed certificate failure rule is absent: {required}"
            )

    for required in (
        "IsEnvironmentGuardReference",
        'FindField(entity, "environment")',
        'HasFieldValue(entity, "browser_wide_enforcement", "false")',
    ):
        if required not in rule_engine:
            failures.append(
                f"environment_guard_boundary: non-support environment reference exclusion is absent: {required}"
            )

    ui = (OI / "tahai_ui.cc").read_text(encoding="utf-8")
    for forbidden in (
        "innerHTML",
        "outerHTML",
        "insertAdjacentHTML",
        "document.write",
        "eval(",
        "new Function(",
        "fetch(",
        "XMLHttpRequest",
        "WebSocket",
        "navigator.sendBeacon",
        "window.open",
    ):
        if forbidden in ui:
            failures.append(
                f"webui_safety: forbidden dynamic UI or browser-network API: {forbidden}"
            )
    if ("network_inspection_in_flight_" not in ui or
            "tahaiNetworkInspectionRejected" not in ui):
        failures.append(
            "network_inspection_boundary: concurrent support probes are not visibly bounded"
        )
    for required in (
        "kSupportManualWatchRunJs",
        "Run DNS + TLS inspection",
        "manual-watch-explicit-runner",
        "kSupportInspectionOutcomeJs",
        "Inspection outcome",
        "Deterministic next steps",
        "BuildTahaiNetworkInspectionGuidance(result)",
        "Certificate status class",
        "certificate values and chains are not shown here.",
        "copyTahaiNetworkInspectionSummary",
        "Copy sanitized inspection handoff",
        "tahaiNetworkInspectionSummaryCopied",
        "last_network_inspection_.reset()",
    ):
        if required not in ui:
            failures.append(
                f"manual_recheck_boundary: explicit DNS/TLS runner is absent: {required}"
            )
    search_model = (OI / "tahai_local_oi_model.cc").read_text(encoding="utf-8")
    for required in (
        "LocalOiSearchOptions",
        "IsValidSearchOptions",
        "MatchesSearchFilters",
        "IsAllowedSearchAgeDays",
        "kMaximumSearchResults",
    ):
        if required not in search_model:
            failures.append(
                f"local_search_boundary: required bounded search control is absent: {required}"
            )

    local_search_match = re.search(
        r'constexpr char kLocalOiJs\[\] = R"TAHAI\(\n(.*?)\n\)TAHAI";',
        ui,
        re.DOTALL,
    )
    if not local_search_match:
        failures.append("local_search_boundary: Local OI WebUI search surface is absent")
    else:
        local_search = local_search_match.group(1)
        for required in (
            "searchTahaiLocalOi",
            "mission_id",
            "finding_state",
            "age_days",
            "ArrowDown",
            "filters()",
            "requestSequence",
        ):
            if required not in local_search:
                failures.append(
                    f"local_search_boundary: required search control is absent: {required}"
                )
        for forbidden in ("innerHTML", "document.cookie", "fetch("):
            if forbidden in local_search:
                failures.append(
                    f"local_search_privacy: forbidden search control {forbidden}"
                )

    for required in (
        "LocalOiRelationshipExplorerOptions",
        "ExploreLocalOiRelationships",
        "IsValidRelationshipExplorerOptions",
        "kMaximumRelationshipExplorerResults",
        "GetLocalOiEntityDetail",
    ):
        if required not in search_model:
            failures.append(
                f"local_graph_boundary: required bounded traversal control is absent: {required}"
            )

    graph_match = re.search(
        r'constexpr char kLocalOiGraphExplorerJs\[\] = R"TAHAI\(\n(.*?)\n\)TAHAI";',
        ui,
        re.DOTALL,
    )
    if not graph_match:
        failures.append("local_graph_boundary: Local OI graph explorer surface is absent")
    else:
        graph = graph_match.group(1)
        for required in (
            "exploreTahaiLocalOiRelationships",
            "getTahaiLocalOiEntityDetail",
            "tahaiLocalOiRelationshipResults",
            "tahaiLocalOiEntityDetail",
            "maximumDepth",
            "Why this relationship exists:",
            "requestSequence",
        ):
            if required not in graph:
                failures.append(
                    f"local_graph_boundary: required graph control is absent: {required}"
                )
        for forbidden in ("innerHTML", "document.cookie", "fetch(", "window.open("):
            if forbidden in graph:
                failures.append(
                    f"local_graph_privacy: forbidden graph control {forbidden}"
                )

    policy = (OI / "tahai_local_oi_policy.cc").read_text(encoding="utf-8")
    if "SetEnabled" not in policy or "IsManaged(control)" not in policy:
        failures.append(
            "local_controls_boundary: unmanaged-only Local OI setting control is absent"
        )

    controls_match = re.search(
        r'constexpr char kLocalOiControlsJs\[\] = R"TAHAI\(\n(.*?)\n\)TAHAI";',
        ui,
        re.DOTALL,
    )
    if not controls_match:
        failures.append("local_controls_boundary: Local OI controls surface is absent")
    else:
        controls = controls_match.group(1)
        for required in (
            "setTahaiLocalOiControl",
            "rebuildTahaiLocalOiIndex",
            "tahaiLocalOiControlUpdated",
            "tahaiLocalOiProjectionRefreshed",
        ):
            if required not in controls:
                failures.append(
                    f"local_controls_boundary: required control is absent: {required}"
                )
        for forbidden in ("innerHTML", "document.cookie", "fetch(", "window.open("):
            if forbidden in controls:
                failures.append(
                    f"local_controls_privacy: forbidden control {forbidden}"
                )

    runtime_match = re.search(
        r'constexpr char kLocalOiRuntimeJs\[\] = R"TAHAI\(\n(.*?)\n\)TAHAI";',
        ui,
        re.DOTALL,
    )
    if not runtime_match:
        failures.append("local_runtime_boundary: Local OI runtime error surface is absent")
    else:
        runtime = runtime_match.group(1)
        if "tahaiLocalOiReportCopyFailed" not in runtime:
            failures.append("local_runtime_boundary: safe report failure state is absent")
        for forbidden in ("innerHTML", "document.cookie", "fetch(", "window.open("):
            if forbidden in runtime:
                failures.append(
                    f"local_runtime_privacy: forbidden runtime control {forbidden}"
                )

    assist_preview_match = re.search(
        r'constexpr char kLocalOiDeterministicBriefJs\[\] = R"TAHAI\(\n(.*?)\n\)TAHAI";',
        ui,
        re.DOTALL,
    )
    if not assist_preview_match:
        failures.append("local_assist_boundary: deterministic local brief surface is absent")
    else:
        assist_preview = assist_preview_match.group(1)
        for required in (
            "buildTahaiLocalDeterministicBrief",
            "Create deterministic brief",
            "No model is being invoked.",
            "selected.length > 8",
            "add-to-local-brief",
            "Current finding added to the deterministic local brief selection.",
        ):
            if required not in assist_preview:
                failures.append(
                    f"local_assist_boundary: required deterministic-brief control is absent: {required}"
                )
        for forbidden in (
            "innerHTML",
            "document.cookie",
            "fetch(",
            "window.open(",
            "navigator.sendBeacon",
        ):
            if forbidden in assist_preview:
                failures.append(
                    f"local_assist_privacy: forbidden deterministic-brief control {forbidden}"
                )

    for required in (
        "BuildTahaiLocalDeterministicBrief",
        "tahaiLocalOiDeterministicBriefPrepared",
        "BuildDeterministicLocalBrief",
        "No model was invoked.",
    ):
        if required not in ui:
            failures.append(
                f"local_assist_boundary: native prompt-preview bridge is absent: {required}"
            )

    json_report_match = re.search(
        r'constexpr char kLocalOiJsonReportJs\[\] = R"TAHAI\(\n(.*?)\n\)TAHAI";',
        ui,
        re.DOTALL,
    )
    if not json_report_match:
        failures.append("local_json_report_boundary: Local OI JSON copy control is absent")
    else:
        json_report = json_report_match.group(1)
        for required in (
            "copyTahaiLocalOiReport",
            "'json'",
            "local-oi-json-report-kind",
        ):
            if required not in json_report:
                failures.append(
                    f"local_json_report_boundary: required JSON report control is absent: {required}"
                )
        for forbidden in ("innerHTML", "document.cookie", "fetch(", "window.open("):
            if forbidden in json_report:
                failures.append(
                    f"local_json_report_privacy: forbidden JSON report control {forbidden}"
                )

    for required in (
        "Profile-local data inventory",
        "Explicit exclusions",
        "no raw record export",
        "BuildLocalOiDataInventory",
    ):
        if required not in ui:
            failures.append(
                f"inventory_boundary: required data inventory surface is absent: {required}"
            )

    for required in (
        "local_oi_sync_succeeded",
        "Refresh needs attention",
        "Insufficient data",
        "no active Mission is",
    ):
        if required not in ui:
            failures.append(
                f"local_runtime_boundary: truthful Local OI runtime state is absent: {required}"
            )

    browser_test = OI / "tahai_local_oi_browsertest.cc"
    if not browser_test.exists():
        failures.append("browser_test_boundary: Local OI browser-test source is absent")
    else:
        browser_test_text = browser_test.read_text(encoding="utf-8")
        for required in (
            "TrustedLocalOiWebUiRendersRealLocalSurfaces",
            "OffTheRecordProfileDoesNotCreateLocalOiService",
            "OrdinaryHttpsUrlCannotClaimTahaiWebUiController",
            "PRE_LocalOiStorePersistsOnlyProfileLocalTypedRecord",
            "LocalOiStorePersistsOnlyProfileLocalTypedRecord",
            "NavigateToURL",
            "kTahaiLocalOiURL",
        ):
            if required not in browser_test_text:
                failures.append(
                    f"browser_test_boundary: required Local OI browser coverage is absent: {required}"
                )
    webui_build = (ROOT / "chrome" / "browser" / "ui" / "webui" /
                   "BUILD.gn").read_text(encoding="utf-8")
    for required in ("tahai_browser_tests", "tahai/tahai_local_oi_browsertest.cc"):
        if required not in webui_build:
            failures.append(
                f"browser_test_boundary: Local OI browser-test target is absent: {required}"
            )
    chrome_test_build = (ROOT / "chrome" / "test" / "BUILD.gn").read_text(
        encoding="utf-8"
    )
    if "//chrome/browser/ui/webui:tahai_browser_tests" not in chrome_test_build:
        failures.append(
            "browser_test_boundary: Local OI browser-test target is not wired into browser_tests"
        )

    for required in (
        '{"support.open", "Endpoint proof", "DNS + TLS inspection"}',
        '{"support.open", "DNS + TLS inspector", "Support tools"}',
    ):
        if required not in ui:
            failures.append(
                f"mode_support_surface: relevant mode entry is absent: {required}"
            )

    history_match = re.search(
        r'constexpr char kSupportNetworkHistoryJs\[\] = R"TAHAI\(\n(.*?)\n\)TAHAI";',
        ui,
        re.DOTALL,
    )
    if not history_match:
        failures.append("network_history_boundary: support history surface is absent")
    else:
        history = history_match.group(1)
        for required in (
            "listTahaiNetworkInspectionHistory",
            "Newest eight rows for this exact host",
            "history.hidden = true",
            "Public address guard",
        ):
            if required not in history:
                failures.append(
                    f"network_history_boundary: required history control is absent: {required}"
                )
        for forbidden in (
            "inspectTahaiNetwork",
            "resolved_addresses",
            "dns_aliases",
            "certificate_subject",
            "certificate_issuer",
            "certificate_expiry",
            "subject_alt_names",
            "tls_version",
            "cipher_suite",
            "innerHTML",
        ):
            if forbidden in history:
                failures.append(
                    f"network_history_privacy: forbidden history field/control {forbidden}"
                )

    change_history_match = re.search(
        r'constexpr char kSupportChangeHistoryJs\[\] = R"TAHAI\(\n(.*?)\n\)TAHAI";',
        ui,
        re.DOTALL,
    )
    if not change_history_match:
        failures.append("change_history_boundary: support history surface is absent")
    else:
        change_history = change_history_match.group(1)
        for required in (
            "listTahaiChangeCaptureHistory",
            "Digest values are never displayed here",
            "history.hidden=true",
        ):
            if required not in change_history:
                failures.append(
                    f"change_history_boundary: required history control is absent: {required}"
                )
        for forbidden in (
            "sha256_digest",
            "digest.value",
            "recordTahaiChangeCapture",
            "inspectTahaiNetwork",
            "innerHTML",
        ):
            if forbidden in change_history:
                failures.append(
                    f"change_history_privacy: forbidden history field/control {forbidden}"
                )

    artifact_history_match = re.search(
        r'constexpr char kSupportArtifactHistoryJs\[\] = R"TAHAI\(\n(.*?)\n\)TAHAI";',
        ui,
        re.DOTALL,
    )
    if not artifact_history_match:
        failures.append("artifact_history_boundary: support history surface is absent")
    else:
        artifact_history = artifact_history_match.group(1)
        for required in (
            "listTahaiArtifactHistory",
            "Paths, file names, and digest values are never displayed here",
            "history.hidden=true",
        ):
            if required not in artifact_history:
                failures.append(
                    f"artifact_history_boundary: required history control is absent: {required}"
                )
        for forbidden in (
            "sha256_digest",
            "digest.value",
            "source_origin",
            "recordTahaiArtifactMetadata",
            "innerHTML",
        ):
            if forbidden in artifact_history:
                failures.append(
                    f"artifact_history_privacy: forbidden history field/control {forbidden}"
                )

    environment_registry_match = re.search(
        r'constexpr char kSupportEnvironmentRegistryJs\[\] = R"TAHAI\(\n(.*?)\n\)TAHAI";',
        ui,
        re.DOTALL,
    )
    if not environment_registry_match:
        failures.append("environment_registry_boundary: support registry surface is absent")
    else:
        environment_registry = environment_registry_match.group(1)
        for required in (
            "listTahaiEnvironmentClassifications",
            "does not inspect pages, change navigation, or enforce browser policy",
            "Current exact-origin registry",
        ):
            if required not in environment_registry:
                failures.append(
                    f"environment_registry_boundary: required registry control is absent: {required}"
                )
        for forbidden in (
            "configureTahaiEnvironmentClassification",
            "inspectTahaiNetwork",
            "innerHTML",
            "document.cookie",
        ):
            if forbidden in environment_registry:
                failures.append(
                    f"environment_registry_privacy: forbidden registry field/control {forbidden}"
                )

    documentation_registry_match = re.search(
        r'constexpr char kSupportDocumentationRegistryJs\[\] = R"TAHAI\(\n(.*?)\n\)TAHAI";',
        ui,
        re.DOTALL,
    )
    if not documentation_registry_match:
        failures.append("documentation_registry_boundary: support registry surface is absent")
    else:
        documentation_registry = documentation_registry_match.group(1)
        for required in (
            "listTahaiDocumentationReferences",
            "TAHAI does not open, fetch, index, or retain the referenced material",
            "Current endpoint documentation pointers",
        ):
            if required not in documentation_registry:
                failures.append(
                    f"documentation_registry_boundary: required registry control is absent: {required}"
                )
        for forbidden in (
            "recordTahaiDocumentationReference",
            "inspectTahaiNetwork",
            "innerHTML",
            "document.cookie",
        ):
            if forbidden in documentation_registry:
                failures.append(
                    f"documentation_registry_privacy: forbidden registry field/control {forbidden}"
                )

    manual_watch_registry_match = re.search(
        r'constexpr char kSupportManualWatchRegistryJs\[\] = R"TAHAI\(\n(.*?)\n\)TAHAI";',
        ui,
        re.DOTALL,
    )
    if not manual_watch_registry_match:
        failures.append("manual_watch_registry_boundary: support registry surface is absent")
    else:
        manual_watch_registry = manual_watch_registry_match.group(1)
        for required in (
            "listTahaiManualWatches",
            "does not schedule a task, run a probe, or create a watcher",
            "Current manual recheck configurations",
        ):
            if required not in manual_watch_registry:
                failures.append(
                    f"manual_watch_registry_boundary: required registry control is absent: {required}"
                )
        for forbidden in (
            "configureTahaiManualWatch",
            "inspectTahaiNetwork",
            "innerHTML",
            "document.cookie",
        ):
            if forbidden in manual_watch_registry:
                failures.append(
                    f"manual_watch_registry_privacy: forbidden registry field/control {forbidden}"
                )

    sentinel = (OI / "tahai_sentinel_contract.cc").read_text(encoding="utf-8")
    for required in ("label.empty()", "label.front() == '-'", "label.back() == '-'"):
        if required not in sentinel:
            failures.append(
                f"public_target_validation: strict host-label validation is absent: {required}"
            )

    if failures:
        print("TAHAI Local OI source verifier: FAILED")
        print("\n".join(failures))
        return 1
    print("TAHAI Local OI source verifier: passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
