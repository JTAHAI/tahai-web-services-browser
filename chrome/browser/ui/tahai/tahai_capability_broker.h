// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_CAPABILITY_BROKER_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_CAPABILITY_BROKER_H_

#include <string>
#include <string_view>
#include <vector>

#include "base/memory/raw_ptr.h"
#include "content/public/browser/weak_document_ptr.h"
#include "url/gurl.h"

class Profile;

namespace tahai {

// The finite operations below are deliberately capability *decisions*, not a
// generic message channel. Extending this enum requires a browser-owned
// invocation path and an explicit review UI; packages never name commands,
// scripts, selectors, files, or credentials.
enum class TahaiCapabilityOperation {
  kReadExplicitSelection,
  kNavigateApprovedOrigin,
};

// A grant is bound to an immutable provider revision and one canonical HTTPS
// origin. The browser captures the invoking document, rather than accepting a
// renderer-supplied URL. Reusing a request after that document is replaced or
// closed fails even when the new document has the same origin.
struct TahaiCapabilityRequest {
  std::string provider_id;
  std::string revision_sha256;
  GURL approved_origin;
  TahaiCapabilityOperation operation;
  content::WeakDocumentPtr document;
};

struct TahaiCapabilityGrant {
  std::string provider_id;
  std::string revision_sha256;
  GURL approved_origin;
  TahaiCapabilityOperation operation;
};

// Stores only review decisions. It never stores a page URL, selected content,
// cookie, token, password, credential, or external action result. Incognito
// and non-regular profiles cannot grant or consume a capability.
class TahaiCapabilityBroker {
 public:
  explicit TahaiCapabilityBroker(Profile* profile);
  TahaiCapabilityBroker(const TahaiCapabilityBroker&) = delete;
  TahaiCapabilityBroker& operator=(const TahaiCapabilityBroker&) = delete;
  ~TahaiCapabilityBroker();

  // Called only after browser-owned review has presented the exact provider,
  // revision, origin, and operation. A package install is never sufficient.
  bool GrantReviewed(const TahaiCapabilityRequest& request);

  // Revalidates the profile, immutable revision, exact origin and current
  // document context immediately before an operation. A caller must invoke it
  // again after navigation, reload, document replacement, or asynchronous
  // work; a positive result does not itself perform an operation.
  bool IsAllowed(const TahaiCapabilityRequest& request) const;

  bool Revoke(const TahaiCapabilityGrant& grant);
  bool RevokeAllForProvider(std::string_view provider_id);
  std::vector<TahaiCapabilityGrant> GetGrants() const;

 private:
  raw_ptr<Profile> profile_;
};

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_CAPABILITY_BROKER_H_
