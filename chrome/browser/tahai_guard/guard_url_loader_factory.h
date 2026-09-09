// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_TAHAI_GUARD_GUARD_URL_LOADER_FACTORY_H_
#define CHROME_BROWSER_TAHAI_GUARD_GUARD_URL_LOADER_FACTORY_H_

#include <memory>
#include <optional>
#include <set>

#include "base/containers/unique_ptr_adapters.h"
#include "base/memory/weak_ptr.h"
#include "chrome/browser/tahai_guard/guard_profile_service.h"
#include "content/public/browser/content_browser_client.h"
#include "mojo/public/cpp/bindings/receiver_set.h"
#include "mojo/public/cpp/bindings/remote.h"
#include "net/base/isolation_info.h"
#include "services/metrics/public/cpp/ukm_source_id.h"
#include "services/network/public/cpp/url_loader_factory_builder.h"
#include "services/network/public/mojom/url_loader_factory.mojom.h"

namespace tahai::guard {

// Lives in exactly one Profile and one factory chain. The terminal remains the
// original StoragePartition/network factory; Guard never picks a different
// partition, disables CORS/TLS/redirect checks, or looks up the focused pane.
class GuardURLLoaderFactory final : public network::mojom::URLLoaderFactory {
 public:
  using FactoryType = content::ContentBrowserClient::URLLoaderFactoryType;

  static void MaybeProxy(content::BrowserContext* context,
                         FactoryType type,
                         const url::Origin& initiator,
                         const net::IsolationInfo& isolation_info,
                         network::URLLoaderFactoryBuilder& builder,
                         content::RenderFrameHost* frame,
                         ukm::SourceIdObj browser_page_id);

  GuardURLLoaderFactory(base::WeakPtr<GuardProfileService> service,
                        FactoryType type,
                        const url::Origin& initiator,
                        const net::IsolationInfo& isolation_info,
                        network::URLLoaderFactoryBuilder& builder,
                        std::optional<int64_t> browser_page_id = std::nullopt);
  ~GuardURLLoaderFactory() override;

  void CreateLoaderAndStart(
      mojo::PendingReceiver<network::mojom::URLLoader> loader,
      int32_t request_id,
      uint32_t options,
      const network::ResourceRequest& request,
      mojo::PendingRemote<network::mojom::URLLoaderClient> client,
      const net::MutableNetworkTrafficAnnotationTag& annotation) override;
  void Clone(mojo::PendingReceiver<network::mojom::URLLoaderFactory> receiver)
      override;

 private:
  class Request;
  void RemoveRequest(Request* request);
  void OnFactoryDisconnected();
  void OnClientDisconnected();
  void MaybeDestroy();

  const base::WeakPtr<GuardProfileService> service_;
  const FactoryType type_;
  const url::Origin initiator_;
  const net::IsolationInfo isolation_info_;
  const std::optional<int64_t> browser_page_id_;
  mojo::ReceiverSet<network::mojom::URLLoaderFactory> receivers_;
  mojo::Remote<network::mojom::URLLoaderFactory> target_;
  std::set<std::unique_ptr<Request>, base::UniquePtrComparator> requests_;
};

}  // namespace tahai::guard

#endif  // CHROME_BROWSER_TAHAI_GUARD_GUARD_URL_LOADER_FACTORY_H_
