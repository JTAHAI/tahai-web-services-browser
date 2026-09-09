// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_local_oi_service_factory.h"

#include <memory>

#include "base/no_destructor.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/profiles/profile_selections.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_service.h"
#include "content/public/browser/browser_context.h"

namespace tahai {

// static
TahaiLocalOiService* TahaiLocalOiServiceFactory::GetForProfile(
    Profile* profile) {
  return static_cast<TahaiLocalOiService*>(
      GetInstance()->GetServiceForBrowserContext(profile, /*create=*/true));
}

// static
TahaiLocalOiServiceFactory* TahaiLocalOiServiceFactory::GetInstance() {
  static base::NoDestructor<TahaiLocalOiServiceFactory> instance;
  return instance.get();
}

TahaiLocalOiServiceFactory::TahaiLocalOiServiceFactory()
    : ProfileKeyedServiceFactory("TahaiLocalOiService",
                                 ProfileSelections::BuildForRegularProfile()) {}

TahaiLocalOiServiceFactory::~TahaiLocalOiServiceFactory() = default;

std::unique_ptr<KeyedService>
TahaiLocalOiServiceFactory::BuildServiceInstanceForBrowserContext(
    content::BrowserContext* context) const {
  return std::make_unique<TahaiLocalOiService>(
      Profile::FromBrowserContext(context));
}

}  // namespace tahai
