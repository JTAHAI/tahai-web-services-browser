// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/tahai_guard/guard_profile_service_factory.h"

#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/tahai_guard/guard_profile_service.h"

namespace tahai::guard {

GuardProfileService* GuardProfileServiceFactory::GetForProfile(
    Profile* profile) {
  if (!profile || profile->IsGuestSession() || profile->IsSystemProfile()) {
    return nullptr;
  }
  return static_cast<GuardProfileService*>(
      GetInstance()->GetServiceForBrowserContext(profile, true));
}

GuardProfileServiceFactory* GuardProfileServiceFactory::GetInstance() {
  static base::NoDestructor<GuardProfileServiceFactory> instance;
  return instance.get();
}

GuardProfileServiceFactory::GuardProfileServiceFactory()
    : ProfileKeyedServiceFactory(
          "TahaiGuardProfileService",
          ProfileSelections::BuildForRegularAndIncognito()) {}

GuardProfileServiceFactory::~GuardProfileServiceFactory() = default;

std::unique_ptr<KeyedService>
GuardProfileServiceFactory::BuildServiceInstanceForBrowserContext(
    content::BrowserContext* context) const {
  return std::make_unique<GuardProfileService>(
      Profile::FromBrowserContext(context));
}

}  // namespace tahai::guard
