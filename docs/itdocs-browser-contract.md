# TAHAI IT Docs browser contract

Pass 41 locks the browser-side IT Docs boundary.

## Browser responsibilities

- Open the configured TAHAI IT Docs origin.
- Query `GET /api/browser/mission-capabilities` only for display-safe capability state.
- Keep Mission Control local-only when capabilities are unavailable, expired, denied, or not signed in.
- Store only opaque IT Docs references in Mission JSON: org/project/runbook/evidence identifiers, safe display names, and allowlisted HTTPS deep links.
- Build handoff Markdown that documents the IT Docs capability state without collecting cookies, tokens, browser storage, request bodies, response bodies, credentials, clipboard contents, or form values.

## Server responsibilities

- Authenticate the user.
- Authorize every org/project/runbook/evidence object.
- Authorize all future mission writes.
- Own all PSA connector credentials and writeback logic.

## Forbidden in this browser repo

- IT Docs access tokens in Mission JSON.
- IT Docs refresh tokens in Mission JSON.
- Cognito/OAuth secrets.
- Cookie or Authorization header capture.
- Direct PSA API calls.
- Browser-side PSA credentials or provider secrets.

## Capability response shape

```json
{
  "signedIn": true,
  "activeOrgs": [
    {
      "orgId": "opaque-org-id",
      "orgName": "Example Org",
      "deepLink": "https://docs.tahaiportal.com/orgs/opaque-org-id"
    }
  ],
  "canCreateMissionReference": true,
  "canAppendEvidence": true,
  "canAppendRunbookNote": true,
  "psaProvidersAvailable": [
    {
      "provider": "generic",
      "label": "Generic PSA",
      "canLinkTicket": true,
      "canAppendTicketNote": false,
      "deepLink": "https://docs.tahaiportal.com/integrations/psa"
    }
  ],
  "message": "IT Docs capabilities loaded. Server still authorizes every mission write."
}
```

The browser treats this as display state only. Server authorization still controls every write.
