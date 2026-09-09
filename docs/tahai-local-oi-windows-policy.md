# TAHAI Local OI Windows policy

Status: source wiring and source checks only. Validate this document against the
fresh native build before deployment. No existing Store package gains these
policy definitions merely because the source was edited.

## Windows provider and profile boundary

The current unbranded Chromium policy generator uses
`SOFTWARE\Policies\Chromium` under the supported Windows machine/user policy
hives. TAHAI branding does not currently replace that root. Do not deploy under
an invented TAHAI registry path: it will not be consumed by this source.
Use the generated policy templates and a dedicated test account or machine;
do not modify the developer's live browser policy as part of source validation.

The handler maps each setting into the effective profile preference. Mandatory
policy takes precedence over a user's setting and locks the corresponding
Local OI control. The Windows machine/user provider is not a separate policy
assignment system for individual Chromium profiles. There is no hosted TAHAI
enterprise enrollment, tenant policy service, or remote administrator console.

Local OI is unavailable in guest/incognito contexts. The policy does not grant
access to another profile, permit a renderer to write preferences, or authorize
network activity. Existing Chromium policy still controls its own browsing,
extension, download, credential and permission features.

## Supported source definitions

| Policy | Default | Effect |
| --- | --- | --- |
| LocalOIEnabled | true | Master gate for ingestion, queries, findings and reports; direct service mutations also check it |
| LocalOIMissionIngestionEnabled | true | Typed Mission/runbook/evidence-marker projection |
| LocalOIArtifactIngestionEnabled | true | Explicit artifact metadata/digest records; not file reading |
| LocalOIDocumentationReferenceIngestionEnabled | true | Explicit public documentation references; not scraping/indexing their content |
| LocalOIOpsToolIngestionEnabled | true | Recording explicit diagnostic results; not permission to run a probe or scheduler |
| LocalOIHistoryMetadataEnabled | false | Permission seam only; no history-ingestion provider is active |
| LocalOIReportsEnabled | true | Deterministic local reports and new report-ledger records |
| LocalOIExportEnabled | true | Explicit sanitized report clipboard export; not raw data export or upload |
| LocalOIMspPromotionEnabled | false | Explicit fixed public referral action; not hosted promotion or account integration |
| LocalOILocalAIEnabled | false | Bounded local-assist prompt preparation; no model is provisioned or executed |
| LocalOIRetentionDays | 90 | Integer 1–3650; out-of-range values rejected |

Boolean definitions support dynamic policy refresh. Retention is marked
restart-required; pruning occurs at startup and applicable writes. Disabling
Local OI does not immediately erase its existing data, and retention still
applies. The explicit delete-local-data operation remains available. Mission
Control owns its separate records; deleting/pruning Local OI does not silently
delete Mission Control data.

## Required runtime validation

1. In a dedicated Windows test environment, validate each policy as mandatory
   true/false, unset, malformed, and (where supported) recommended. Verify the
   native policy page recognizes it and reports effective source/level/value.
2. Verify mandatory values cannot be overridden by the WebUI or direct service
   actions. Refresh policy while a Local OI page is open; stale UI must not make
   a blocked action succeed. Verify two profiles do not exchange stored data.
3. Exercise valid/invalid retention boundaries, restart behavior, and explicit
   deletion while the master policy is disabled. Do not use production records
   for destructive retention tests.
4. Run the new policy-pref mapping cases with Chromium's policy mapping browser
   fixture, plus Local OI service tests and the private-profile/persistence UI
   tests. Static YAML checks are not substitutes.
5. Confirm enabling history, local AI, or MSP referral does not start a missing
   provider, upload data, or turn a local contract into hosted functionality.

Downstream numeric IDs 1459–1469 and atomic group 65 were allocated in this
checkout. Preserve/reconcile these when rebasing onto upstream Chromium; do not
silently reuse an ID for a different policy. Upstream ownership and certification
are not implied by the downstream definitions.
