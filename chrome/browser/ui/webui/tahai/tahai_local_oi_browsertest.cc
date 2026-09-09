// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include <algorithm>
#include <memory>
#include <optional>
#include <string>
#include <utility>

#include "base/test/test_future.h"
#include "base/threading/thread_restrictions.h"
#include "base/time/time.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_service.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_service_factory.h"
#include "chrome/browser/ui/webui/tahai/tahai_network_inspector.h"
#include "chrome/browser/ui/webui/tahai/tahai_ui.h"
#include "chrome/common/chrome_switches.h"
#include "chrome/common/tahai_url_constants.h"
#include "chrome/test/base/in_process_browser_test.h"
#include "chrome/test/base/ui_test_utils.h"
#include "content/public/browser/storage_partition.h"
#include "content/public/browser/web_contents.h"
#include "content/public/test/browser_test.h"
#include "content/public/test/browser_test_utils.h"
#include "net/base/net_errors.h"
#include "net/base/network_interfaces.h"
#include "net/http/http_response_headers.h"
#include "net/test/embedded_test_server/embedded_test_server.h"
#include "net/traffic_annotation/network_traffic_annotation_test_helper.h"
#include "services/network/public/cpp/resource_request.h"
#include "services/network/public/cpp/ip_address_space_util.h"
#include "services/network/public/cpp/shared_url_loader_factory.h"
#include "services/network/public/cpp/simple_url_loader.h"
#include "testing/gtest/include/gtest/gtest.h"
#include "url/gurl.h"

namespace tahai {
namespace {

class TahaiLocalOiBrowserTest : public InProcessBrowserTest {
 protected:
  void SetUpCommandLine(base::CommandLine* command_line) override {
    InProcessBrowserTest::SetUpCommandLine(command_line);
    command_line->AppendSwitch(switches::kNoProxyServer);
  }

  content::WebContents* NavigateToLocalOi() {
    EXPECT_TRUE(
        ui_test_utils::NavigateToURL(browser(), GURL(kTahaiLocalOiURL)));
    return browser()->tab_strip_model()->GetActiveWebContents();
  }
};

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       TrustedLocalOiWebUiRendersRealLocalSurfaces) {
  content::WebContents* contents = NavigateToLocalOi();
  ASSERT_TRUE(contents);
  EXPECT_EQ(GURL(kTahaiLocalOiURL), contents->GetLastCommittedURL());
  EXPECT_TRUE(
      content::EvalJs(
          contents, "Boolean(document.querySelector('#local-oi-search-form'))")
          .ExtractBool());
  EXPECT_TRUE(
      content::EvalJs(contents,
                      "Boolean(document.querySelector('#local-oi-graph-form'))")
          .ExtractBool());
  EXPECT_TRUE(
      content::EvalJs(
          contents,
          "Boolean(document.querySelector('#local-oi-deterministic-brief'))")
          .ExtractBool());
  EXPECT_TRUE(content::EvalJs(contents,
                              "document.body.innerText.includes('Create a "
                              "deterministic local operations brief')")
                  .ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       InspectionLoaderBlocksLocalConnectionEndpoint) {
  // Exercise the actual Network Service with the production inspection loader
  // options. A DNS preflight alone cannot enforce this connection boundary.
  net::NetworkInterfaceList interfaces;
  {
    base::ScopedAllowBlockingForTesting allow_blocking;
    ASSERT_TRUE(net::GetNetworkList(
        &interfaces, net::EXCLUDE_HOST_SCOPE_VIRTUAL_INTERFACES));
  }
  std::optional<net::IPAddress> local_address;
  for (const net::NetworkInterface& interface : interfaces) {
    if (interface.address.IsIPv4() &&
        network::IPAddressToIPAddressSpace(interface.address) ==
            network::mojom::IPAddressSpace::kLocal) {
      local_address = interface.address;
      break;
    }
  }
  ASSERT_TRUE(local_address.has_value());
  ASSERT_TRUE(embedded_test_server()->Start(0, local_address->ToString()));

  auto request = std::make_unique<network::ResourceRequest>();
  // Browser tests classify loopback as public. Binding the live test endpoint
  // to a real private interface exercises the connection-time local-network
  // boundary without depending on an unreachable address or a system proxy.
  request->url = embedded_test_server()->GetURL("/");
  request->method = "HEAD";
  request->credentials_mode = network::mojom::CredentialsMode::kOmit;
  request->redirect_mode = network::mojom::RedirectMode::kError;
  auto loader = network::SimpleURLLoader::Create(std::move(request),
                                                 TRAFFIC_ANNOTATION_FOR_TESTS);
  loader->SetURLLoaderFactoryOptions(GetTahaiNetworkInspectionURLLoadOptions());
  loader->SetTimeoutDuration(base::Seconds(10));
  base::test::TestFuture<scoped_refptr<net::HttpResponseHeaders>> completed;
  loader->DownloadHeadersOnly(browser()
                                  ->GetProfile()
                                  ->GetDefaultStoragePartition()
                                  ->GetURLLoaderFactoryForBrowserProcess()
                                  .get(),
                              completed.GetCallback());
  EXPECT_FALSE(completed.Get());
  EXPECT_EQ(net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS,
            loader->NetError());
}

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       OffTheRecordProfileDoesNotCreateLocalOiService) {
  Profile* regular_profile = browser()->GetProfile();
  ASSERT_TRUE(TahaiLocalOiServiceFactory::GetForProfile(regular_profile));
  Profile* off_the_record = regular_profile->GetPrimaryOTRProfile(true);
  ASSERT_TRUE(off_the_record);
  EXPECT_EQ(nullptr, TahaiLocalOiServiceFactory::GetForProfile(off_the_record));
}

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       OffTheRecordSurfaceDoesNotReadRegularLocalOiData) {
  Profile* regular_profile = browser()->GetProfile();
  TahaiLocalOiService* regular_service =
      TahaiLocalOiServiceFactory::GetForProfile(regular_profile);
  ASSERT_TRUE(regular_service);
  const std::string now = LocalOiNowTimestamp();
  LocalOiEntityRecord domain;
  domain.id = NewLocalOiId();
  domain.type = LocalOiEntityType::kDomain;
  domain.title = "Regular-profile-only Local OI sentinel";
  domain.summary = "Must never render in an off-the-record surface.";
  domain.source = LocalOiRecordSource::kExplicitUserEntry;
  domain.created_at = now;
  domain.updated_at = now;
  ASSERT_TRUE(regular_service->UpsertEntity(std::move(domain)));

  content::WebContents* regular_contents = NavigateToLocalOi();
  ASSERT_TRUE(regular_contents);
  EXPECT_TRUE(content::EvalJs(
                  regular_contents,
                  "document.body.innerText.includes('Regular-profile-only "
                  "Local OI sentinel')")
                  .ExtractBool());

  Profile* off_the_record = regular_profile->GetPrimaryOTRProfile(true);
  ASSERT_TRUE(off_the_record);
  TahaiUIConfig config;
  EXPECT_TRUE(config.IsWebUIEnabled(regular_profile));
  EXPECT_TRUE(config.IsWebUIEnabled(off_the_record));

  Browser* incognito = CreateIncognitoBrowser(regular_profile);
  ASSERT_TRUE(incognito);
  ASSERT_TRUE(ui_test_utils::NavigateToURL(incognito, GURL(kTahaiLocalOiURL)));
  content::WebContents* contents =
      incognito->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(contents);
  EXPECT_EQ(GURL(kTahaiLocalOiURL), contents->GetLastCommittedURL());
  EXPECT_FALSE(content::EvalJs(
                   contents,
                   "document.body.innerText.includes('Regular-profile-only "
                   "Local OI sentinel')")
                   .ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       OrdinaryHttpsUrlCannotClaimTahaiWebUiController) {
  TahaiUIConfig config;
  EXPECT_FALSE(config.ShouldHandleURL(GURL("https://example.com/local-oi")));
  EXPECT_FALSE(config.ShouldHandleURL(GURL("chrome://tahai/not-a-surface")));
}

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       PRE_LocalOiStorePersistsOnlyProfileLocalTypedRecord) {
  TahaiLocalOiService* service =
      TahaiLocalOiServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(service);
  const std::string now = LocalOiNowTimestamp();
  LocalOiEntityRecord note;
  note.id = NewLocalOiId();
  note.type = LocalOiEntityType::kNote;
  note.title = "Browser test persistence marker";
  note.summary = "Synthetic profile-local test record.";
  note.source = LocalOiRecordSource::kExplicitUserEntry;
  note.created_at = now;
  note.updated_at = now;
  ASSERT_TRUE(service->UpsertEntity(std::move(note)));
}

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       LocalOiStorePersistsOnlyProfileLocalTypedRecord) {
  TahaiLocalOiService* service =
      TahaiLocalOiServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(service);
  EXPECT_TRUE(std::any_of(
      service->data().entities.begin(), service->data().entities.end(),
      [](const LocalOiEntityRecord& record) {
        return record.type == LocalOiEntityType::kNote &&
               record.title == "Browser test persistence marker" &&
               record.summary == "Synthetic profile-local test record.";
      }));
}

}  // namespace
}  // namespace tahai
