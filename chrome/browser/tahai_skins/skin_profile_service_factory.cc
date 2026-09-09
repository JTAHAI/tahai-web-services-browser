// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/tahai_skins/skin_profile_service_factory.h"

#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/tahai_skins/skin_profile_service.h"
#include "chrome/browser/themes/theme_service_factory.h"

namespace tahai::skins {

SkinProfileService* SkinProfileServiceFactory::GetForProfile(Profile* profile) {
  if (!profile || !profile->IsRegularProfile() || profile->IsOffTheRecord() ||
      profile->IsGuestSession() || profile->IsSystemProfile()) {
    return nullptr;
  }
  return static_cast<SkinProfileService*>(
      GetInstance()->GetServiceForBrowserContext(profile, true));
}

SkinProfileServiceFactory* SkinProfileServiceFactory::GetInstance() {
  static base::NoDestructor<SkinProfileServiceFactory> instance;
  return instance.get();
}

SkinProfileServiceFactory::SkinProfileServiceFactory()
    : ProfileKeyedServiceFactory("TahaiSkinProfileService",
                                 ProfileSelections::BuildForRegularProfile()) {
  DependsOn(ThemeServiceFactory::GetInstance());
}

SkinProfileServiceFactory::~SkinProfileServiceFactory() = default;

bool SkinProfileServiceFactory::ServiceIsCreatedWithBrowserContext() const {
  return true;
}

bool SkinProfileServiceFactory::ServiceIsNULLWhileTesting() const {
  return true;
}

std::unique_ptr<KeyedService>
SkinProfileServiceFactory::BuildServiceInstanceForBrowserContext(
    content::BrowserContext* context) const {
  return std::make_unique<SkinProfileService>(
      Profile::FromBrowserContext(context));
}

}  // namespace tahai::skins
