// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_capability_broker.h"

#include <algorithm>
#include <optional>
#include <string_view>

#include "base/values.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/common/pref_names.h"
#include "components/prefs/pref_service.h"
#include "content/public/browser/render_frame_host.h"
#include "url/origin.h"

namespace tahai {
namespace {

constexpr size_t kMaximumCapabilityGrants = 64u;
constexpr int kCapabilityGrantSchemaVersion = 1;

bool IsSafeIdentifier(std::string_view value) {
  if (value.size() < 3u || value.size() > 64u || value.front() == '-' ||
      value.back() == '-') {
    return false;
  }
  return std::all_of(value.begin(), value.end(), [](char character) {
    return (character >= 'a' && character <= 'z') ||
           (character >= '0' && character <= '9') || character == '-';
  });
}

bool IsSha256(std::string_view value) {
  return value.size() == 64u &&
         std::all_of(value.begin(), value.end(), [](char character) {
           return (character >= '0' && character <= '9') ||
                  (character >= 'a' && character <= 'f');
         });
}

bool IsExactHttpsOrigin(const GURL& origin) {
  return origin.is_valid() && origin.SchemeIs("https") && origin.has_host() &&
         !origin.has_username() && !origin.has_password() &&
         !origin.has_query() && !origin.has_ref() && origin.path() == "/" &&
         origin.DeprecatedGetOriginAsURL() == origin;
}

bool IsAllowedOperation(TahaiCapabilityOperation operation) {
  switch (operation) {
    case TahaiCapabilityOperation::kReadExplicitSelection:
    case TahaiCapabilityOperation::kNavigateApprovedOrigin:
      return true;
  }
  return false;
}

const char* OperationName(TahaiCapabilityOperation operation) {
  switch (operation) {
    case TahaiCapabilityOperation::kReadExplicitSelection:
      return "read-explicit-selection";
    case TahaiCapabilityOperation::kNavigateApprovedOrigin:
      return "navigate-approved-origin";
  }
  return "";
}

bool ParseOperation(std::string_view value, TahaiCapabilityOperation* output) {
  if (!output) {
    return false;
  }
  if (value == "read-explicit-selection") {
    *output = TahaiCapabilityOperation::kReadExplicitSelection;
    return true;
  }
  if (value == "navigate-approved-origin") {
    *output = TahaiCapabilityOperation::kNavigateApprovedOrigin;
    return true;
  }
  return false;
}

bool IsEligibleProfile(Profile* profile) {
  return profile && profile->IsRegularProfile() && !profile->IsOffTheRecord() &&
         profile->GetPrefs()->GetBoolean(prefs::kTahaiSkinsEnabled) &&
         !profile->GetPrefs()->IsManagedPreference(prefs::kTahaiCapabilityGrants);
}

bool IsValidRequest(Profile* profile, const TahaiCapabilityRequest& request) {
  content::RenderFrameHost* frame = request.document.AsRenderFrameHostIfValid();
  // A URL argument cannot prove which profile/document invoked an operation.
  // Revalidate the browser-held document on every call, including after a
  // same-origin reload, frame replacement, tab closure or BFCache transition.
  return frame && frame->GetBrowserContext() == profile && frame->IsActive() &&
         frame->IsInPrimaryMainFrame() &&
         !frame->GetLastCommittedURL().has_username() &&
         !frame->GetLastCommittedURL().has_password() &&
         IsSafeIdentifier(request.provider_id) &&
         IsSha256(request.revision_sha256) &&
         IsExactHttpsOrigin(request.approved_origin) &&
         frame->GetLastCommittedOrigin() ==
             url::Origin::Create(request.approved_origin) &&
         IsAllowedOperation(request.operation);
}

bool IsSameGrant(const TahaiCapabilityGrant& first,
                 const TahaiCapabilityGrant& second) {
  return first.provider_id == second.provider_id &&
         first.revision_sha256 == second.revision_sha256 &&
         first.approved_origin == second.approved_origin &&
         first.operation == second.operation;
}

std::optional<std::vector<TahaiCapabilityGrant>> ReadGrants(Profile* profile) {
  std::vector<TahaiCapabilityGrant> grants;
  if (!IsEligibleProfile(profile)) {
    return std::nullopt;
  }
  const base::DictValue& stored =
      profile->GetPrefs()->GetDict(prefs::kTahaiCapabilityGrants);
  if (stored.empty()) {
    return grants;
  }
  const std::optional<int> schema = stored.FindInt("schema_version");
  const base::ListValue* stored_grants = stored.FindList("grants");
  if (stored.size() != 2u || !schema || *schema != kCapabilityGrantSchemaVersion ||
      !stored_grants || stored_grants->size() > kMaximumCapabilityGrants) {
    return std::nullopt;
  }
  for (const base::Value& value : *stored_grants) {
    const base::DictValue* entry = value.GetIfDict();
    const std::string* provider_id = entry ? entry->FindString("provider_id") : nullptr;
    const std::string* revision_sha256 =
        entry ? entry->FindString("revision_sha256") : nullptr;
    const std::string* origin = entry ? entry->FindString("origin") : nullptr;
    const std::string* operation = entry ? entry->FindString("operation") : nullptr;
    TahaiCapabilityOperation parsed_operation;
    GURL parsed_origin(origin ? *origin : std::string());
    if (!entry || entry->size() != 4u || !provider_id || !revision_sha256 ||
        !origin || !operation || !IsSafeIdentifier(*provider_id) ||
        !IsSha256(*revision_sha256) || !IsExactHttpsOrigin(parsed_origin) ||
        !ParseOperation(*operation, &parsed_operation)) {
      return {};
    }
    TahaiCapabilityGrant grant{*provider_id, *revision_sha256,
                                std::move(parsed_origin), parsed_operation};
    if (std::find_if(grants.begin(), grants.end(), [&grant](const auto& current) {
          return IsSameGrant(current, grant);
        }) != grants.end()) {
      return {};
    }
    grants.push_back(std::move(grant));
  }
  return grants;
}

void WriteGrants(Profile* profile, const std::vector<TahaiCapabilityGrant>& grants) {
  base::DictValue stored;
  stored.Set("schema_version", kCapabilityGrantSchemaVersion);
  base::ListValue entries;
  for (const TahaiCapabilityGrant& grant : grants) {
    base::DictValue entry;
    entry.Set("provider_id", grant.provider_id);
    entry.Set("revision_sha256", grant.revision_sha256);
    entry.Set("origin", grant.approved_origin.spec());
    entry.Set("operation", OperationName(grant.operation));
    entries.Append(std::move(entry));
  }
  stored.Set("grants", std::move(entries));
  profile->GetPrefs()->SetDict(prefs::kTahaiCapabilityGrants, std::move(stored));
}

}  // namespace

TahaiCapabilityBroker::TahaiCapabilityBroker(Profile* profile) : profile_(profile) {}
TahaiCapabilityBroker::~TahaiCapabilityBroker() = default;

bool TahaiCapabilityBroker::GrantReviewed(const TahaiCapabilityRequest& request) {
  if (!IsEligibleProfile(profile_) || !IsValidRequest(profile_, request)) {
    return false;
  }
  auto loaded = ReadGrants(profile_);
  if (!loaded) {
    return false;
  }
  auto& grants = *loaded;
  TahaiCapabilityGrant grant{request.provider_id, request.revision_sha256,
                             request.approved_origin, request.operation};
  if (std::find_if(grants.begin(), grants.end(), [&grant](const auto& current) {
        return IsSameGrant(current, grant);
      }) != grants.end()) {
    return true;
  }
  if (grants.size() >= kMaximumCapabilityGrants) {
    return false;
  }
  grants.push_back(std::move(grant));
  WriteGrants(profile_, grants);
  return true;
}

bool TahaiCapabilityBroker::IsAllowed(
    const TahaiCapabilityRequest& request) const {
  if (!IsEligibleProfile(profile_) || !IsValidRequest(profile_, request)) {
    return false;
  }
  const TahaiCapabilityGrant requested{request.provider_id,
                                       request.revision_sha256,
                                       request.approved_origin,
                                       request.operation};
  const auto grants = ReadGrants(profile_);
  return grants && std::find_if(grants->begin(), grants->end(),
                      [&requested](const auto& current) {
                        return IsSameGrant(current, requested);
                      }) != grants->end();
}

bool TahaiCapabilityBroker::Revoke(const TahaiCapabilityGrant& grant) {
  if (!IsEligibleProfile(profile_) || !IsSafeIdentifier(grant.provider_id) ||
      !IsSha256(grant.revision_sha256) || !IsExactHttpsOrigin(grant.approved_origin) ||
      !IsAllowedOperation(grant.operation)) {
    return false;
  }
  auto loaded = ReadGrants(profile_);
  if (!loaded) {
    return false;
  }
  auto& grants = *loaded;
  const auto found = std::find_if(grants.begin(), grants.end(),
                                  [&grant](const auto& current) {
                                    return IsSameGrant(current, grant);
                                  });
  if (found == grants.end()) {
    return false;
  }
  grants.erase(found);
  WriteGrants(profile_, grants);
  return true;
}

bool TahaiCapabilityBroker::RevokeAllForProvider(std::string_view provider_id) {
  if (!IsEligibleProfile(profile_) || !IsSafeIdentifier(provider_id)) {
    return false;
  }
  auto loaded = ReadGrants(profile_);
  if (!loaded) {
    return false;
  }
  auto& grants = *loaded;
  const size_t prior_count = grants.size();
  grants.erase(std::remove_if(grants.begin(), grants.end(),
                              [provider_id](const auto& grant) {
                                return grant.provider_id == provider_id;
                              }),
               grants.end());
  if (grants.size() == prior_count) {
    return false;
  }
  WriteGrants(profile_, grants);
  return true;
}

std::vector<TahaiCapabilityGrant> TahaiCapabilityBroker::GetGrants() const {
  return ReadGrants(profile_).value_or(std::vector<TahaiCapabilityGrant>());
}

}  // namespace tahai
