// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/tahai_guard/guard_url_loader_factory.h"

#include <utility>

#include "base/check.h"
#include "base/functional/bind.h"
#include "base/memory/raw_ptr.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/tahai_guard/guard_profile_service_factory.h"
#include "content/public/browser/browser_thread.h"
#include "content/public/browser/render_frame_host.h"
#include "mojo/public/cpp/bindings/receiver.h"
#include "net/base/net_errors.h"
#include "net/url_request/redirect_info.h"
#include "services/network/public/cpp/resource_request.h"
#include "services/network/public/cpp/url_loader_completion_status.h"
#include "services/network/public/mojom/early_hints.mojom.h"
#include "services/network/public/mojom/fetch_api.mojom.h"
#include "services/network/public/mojom/url_response_head.mojom.h"

namespace tahai::guard {
namespace {

using Result = GuardProfileService::Result;
using FactoryType = GuardURLLoaderFactory::FactoryType;

constexpr size_t kMaxLiveRequestsPerFactory = 512;
constexpr size_t kMaxClonesPerFactory = 256;

mojom::RequestKind Kind(const network::ResourceRequest& request) {
  using Destination = network::mojom::RequestDestination;
  switch (request.destination) {
    case Destination::kDocument:
      return mojom::RequestKind::kDocument;
    case Destination::kFrame:
    case Destination::kIframe:
    case Destination::kFencedframe:
      return mojom::RequestKind::kSubdocument;
    case Destination::kScript:
    case Destination::kWorker:
    case Destination::kServiceWorker:
    case Destination::kSharedWorker:
    case Destination::kAudioWorklet:
    case Destination::kPaintWorklet:
      return mojom::RequestKind::kScript;
    case Destination::kStyle:
    case Destination::kXslt:
      return mojom::RequestKind::kStylesheet;
    case Destination::kImage:
      return mojom::RequestKind::kImage;
    case Destination::kFont:
      return mojom::RequestKind::kFont;
    case Destination::kAudio:
    case Destination::kVideo:
    case Destination::kTrack:
      return mojom::RequestKind::kMedia;
    case Destination::kObject:
    case Destination::kEmbed:
      return mojom::RequestKind::kObject;
    case Destination::kReport:
      return mojom::RequestKind::kPing;
    default:
      return request.is_fetch_like_api ? mojom::RequestKind::kXmlHttpRequest
                                       : mojom::RequestKind::kOther;
  }
}

int FailureCode(Result result) {
  if (result == Result::kContextChanged) {
    return net::ERR_ABORTED;
  }
  if (result == Result::kBlock) {
    return net::ERR_BLOCKED_BY_CLIENT;
  }
  return result == Result::kRequiredUnavailable
             ? net::ERR_BLOCKED_BY_ADMINISTRATOR
             : net::OK;
}

bool IsWorker(FactoryType type) {
  return type == FactoryType::kWorkerMainResource ||
         type == FactoryType::kWorkerSubResource ||
         type == FactoryType::kServiceWorkerScript ||
         type == FactoryType::kServiceWorkerSubResource;
}

}  // namespace

class GuardURLLoaderFactory::Request final
    : public network::mojom::URLLoader,
      public network::mojom::URLLoaderClient {
 public:
  Request(GuardURLLoaderFactory* factory,
          mojo::PendingReceiver<network::mojom::URLLoader> loader,
          int32_t request_id,
          uint32_t options,
          const network::ResourceRequest& request,
          mojo::PendingRemote<network::mojom::URLLoaderClient> client,
          const net::MutableNetworkTrafficAnnotationTag& annotation)
      : factory_(factory),
        request_id_(request_id),
        options_(options),
        annotation_(annotation),
        request_(request),
        kind_(Kind(request)),
        main_navigation_(factory->type_ == FactoryType::kNavigation &&
                         request.is_outermost_main_frame),
        source_(factory->isolation_info_.frame_origin()),
        top_(factory->isolation_info_.top_frame_origin()),
        receiver_(this, std::move(loader)),
        client_(std::move(client)) {
    // Only the browser-owned navigation factory may supply per-request trusted
    // params. A renderer's forged trusted_params/top origin is NEVER consulted.
    if (factory->type_ == FactoryType::kNavigation) {
      if (request.trusted_params) {
        top_ = request.trusted_params->isolation_info.top_frame_origin();
      }
      source_ = request.request_initiator;
    } else if (IsWorker(factory->type_)) {
      // Worker factories without a frame have a browser-supplied worker origin,
      // not a currently focused client. With no top origin, recovery belongs to
      // that worker origin alone; no exception is borrowed from an arbitrary
      // tab.
      if (!source_) {
        source_ = factory->initiator_;
      }
      if (!top_) {
        top_ = factory->initiator_;
      }
    }
    receiver_.set_disconnect_handler(
        base::BindOnce(&Request::Cancel, weak_factory_.GetWeakPtr()));
    client_.set_disconnect_handler(
        base::BindOnce(&Request::Cancel, weak_factory_.GetWeakPtr()));
  }

  void Start() {
    Evaluate(request_->url, base::BindOnce(&Request::OnInitialDecision,
                                           weak_factory_.GetWeakPtr()));
  }

  void FollowRedirect(network::HttpRequestHeadersUpdateParams headers,
                      const std::optional<GURL>& new_url) override {
    if (!redirect_ || evaluating_ || !target_.is_bound()) {
      Finish(net::ERR_INVALID_ARGUMENT);
      return;
    }
    // Network Service remains responsible for same-origin override, CORS,
    // credentials and all redirect security checks. Check the actual override
    // too; checking only Location would let another interceptor evade Guard.
    const GURL destination = new_url.value_or(redirect_->new_url);
    Evaluate(destination, base::BindOnce(&Request::OnFollowDecision,
                                         weak_factory_.GetWeakPtr(),
                                         std::move(headers), new_url));
  }

  void SetPriority(net::RequestPriority priority, int32_t intra) override {
    priority_ = std::make_pair(priority, intra);
    if (target_.is_bound()) {
      target_->SetPriority(priority, intra);
    }
  }

  void OnReceiveEarlyHints(network::mojom::EarlyHintsPtr hints) override {
    client_->OnReceiveEarlyHints(std::move(hints));
  }

  void OnReceiveResponse(
      network::mojom::URLResponseHeadPtr head,
      mojo::ScopedDataPipeConsumerHandle body,
      std::optional<mojo_base::BigBuffer> metadata) override {
    client_->OnReceiveResponse(std::move(head), std::move(body),
                               std::move(metadata));
  }

  void OnReceiveRedirect(const net::RedirectInfo& redirect,
                         network::mojom::URLResponseHeadPtr head) override {
    if (evaluating_ || redirect_) {
      Finish(net::ERR_UNEXPECTED);
      return;
    }
    redirect_ = redirect;
    Evaluate(redirect.new_url,
             base::BindOnce(&Request::OnRedirectDecision,
                            weak_factory_.GetWeakPtr(), std::move(head)));
  }

  void OnUploadProgress(int64_t position,
                        int64_t size,
                        OnUploadProgressCallback callback) override {
    client_->OnUploadProgress(position, size, std::move(callback));
  }

  void OnTransferSizeUpdated(int32_t diff) override {
    client_->OnTransferSizeUpdated(diff);
  }

  void OnComplete(const network::URLLoaderCompletionStatus& status) override {
    client_->OnComplete(status);
    Cancel();
  }

 private:
  void Evaluate(const GURL& url, GuardProfileService::CheckCallback callback) {
    evaluating_ = true;
    if (!factory_->service_) {
      Finish(net::ERR_ABORTED);
      return;
    }
    auto source = source_;
    auto top = top_;
    if (main_navigation_) {
      // Main-document exceptions follow the actual destination at each
      // redirect, not the old committed page and not the original pre-redirect
      // URL.
      source = top = url::Origin::Create(url);
    }
    factory_->service_->Check(url, source, top, kind_, std::move(callback),
                              factory_->browser_page_id_);
  }

  bool Accept(Result result) {
    evaluating_ = false;
    const int failure = FailureCode(result);
    if (failure != net::OK) {
      Finish(failure);
      return false;
    }
    return true;
  }

  void OnInitialDecision(Result result) {
    if (!Accept(result)) {
      return;
    }
    if (!factory_->target_.is_bound()) {
      Finish(net::ERR_FAILED);
      return;
    }
    factory_->target_->CreateLoaderAndStart(
        target_.BindNewPipeAndPassReceiver(), request_id_, options_, *request_,
        response_receiver_.BindNewPipeAndPassRemote(), annotation_);
    // Do not retain headers/body/credentials after forwarding the original
    // request unchanged. Response payloads are streamed, never buffered here.
    request_.reset();
    if (priority_) {
      target_->SetPriority(priority_->first, priority_->second);
    }
    response_receiver_.set_disconnect_handler(base::BindOnce(
        &Request::OnNetworkDisconnected, weak_factory_.GetWeakPtr()));
  }

  void OnRedirectDecision(network::mojom::URLResponseHeadPtr head,
                          Result result) {
    if (Accept(result)) {
      client_->OnReceiveRedirect(*redirect_, std::move(head));
    }
  }

  void OnFollowDecision(network::HttpRequestHeadersUpdateParams headers,
                        std::optional<GURL> new_url,
                        Result result) {
    if (Accept(result)) {
      redirect_.reset();
      target_->FollowRedirect(std::move(headers), new_url);
    }
  }

  void OnNetworkDisconnected() { Finish(net::ERR_FAILED); }

  void Finish(int error) {
    client_->OnComplete(network::URLLoaderCompletionStatus(error));
    Cancel();
  }

  void Cancel() {
    // Removes this Request and may remove the now-unused factory. No member
    // access after this call. Weak replies cannot restart a cancelled request.
    factory_->RemoveRequest(this);
  }

  const raw_ptr<GuardURLLoaderFactory> factory_;
  const int32_t request_id_;
  const uint32_t options_;
  const net::MutableNetworkTrafficAnnotationTag annotation_;
  std::optional<network::ResourceRequest> request_;
  const mojom::RequestKind kind_;
  const bool main_navigation_;
  std::optional<url::Origin> source_;
  std::optional<url::Origin> top_;
  std::optional<net::RedirectInfo> redirect_;
  std::optional<std::pair<net::RequestPriority, int32_t>> priority_;
  bool evaluating_ = false;
  mojo::Receiver<network::mojom::URLLoader> receiver_;
  mojo::Remote<network::mojom::URLLoaderClient> client_;
  mojo::Remote<network::mojom::URLLoader> target_;
  mojo::Receiver<network::mojom::URLLoaderClient> response_receiver_{this};
  base::WeakPtrFactory<Request> weak_factory_{this};
};

void GuardURLLoaderFactory::MaybeProxy(
    content::BrowserContext* context,
    FactoryType type,
    const url::Origin& initiator,
    const net::IsolationInfo& isolation_info,
    network::URLLoaderFactoryBuilder& builder,
    content::RenderFrameHost* frame,
    ukm::SourceIdObj browser_page_id) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  auto* service = GuardProfileServiceFactory::GetForProfile(
      Profile::FromBrowserContext(context));
  if (!service) {
    return;
  }
  // The browser supplies the intended page identity even before commit. An
  // RFH's current document could instead describe the *previous* document.
  // Never accept this identity from ResourceRequest, or lend a document pause
  // to workers, fenced frames, or embedded guest pages. No metrics are emitted.
  std::optional<int64_t> page_scope;
  if (type == FactoryType::kDocumentSubResource && frame &&
      frame->GetBrowserContext() == context &&
      !frame->IsNestedWithinFencedFrame() &&
      !frame->GetMainFrame()->GetParentOrOuterDocumentOrEmbedder() &&
      browser_page_id.ToInt64() != ukm::kInvalidSourceId) {
    page_scope = browser_page_id.ToInt64();
  }
  service->OwnFactory(std::make_unique<GuardURLLoaderFactory>(
      service->GetWeakPtr(), type, initiator, isolation_info, builder,
      page_scope));
}

GuardURLLoaderFactory::GuardURLLoaderFactory(
    base::WeakPtr<GuardProfileService> service,
    FactoryType type,
    const url::Origin& initiator,
    const net::IsolationInfo& isolation_info,
    network::URLLoaderFactoryBuilder& builder,
    std::optional<int64_t> browser_page_id)
    : service_(std::move(service)),
      type_(type),
      initiator_(initiator),
      isolation_info_(isolation_info),
      browser_page_id_(browser_page_id) {
  auto [receiver, target] = builder.Append();
  target_.Bind(std::move(target));
  target_.set_disconnect_handler(base::BindOnce(
      &GuardURLLoaderFactory::OnFactoryDisconnected, base::Unretained(this)));
  receivers_.Add(this, std::move(receiver));
  receivers_.set_disconnect_handler(base::BindRepeating(
      &GuardURLLoaderFactory::OnClientDisconnected, base::Unretained(this)));
}

GuardURLLoaderFactory::~GuardURLLoaderFactory() = default;

void GuardURLLoaderFactory::CreateLoaderAndStart(
    mojo::PendingReceiver<network::mojom::URLLoader> loader,
    int32_t request_id,
    uint32_t options,
    const network::ResourceRequest& request,
    mojo::PendingRemote<network::mojom::URLLoaderClient> client,
    const net::MutableNetworkTrafficAnnotationTag& annotation) {
  if (!service_ || !target_.is_bound()) {
    mojo::Remote<network::mojom::URLLoaderClient>(std::move(client))
        ->OnComplete(network::URLLoaderCompletionStatus(net::ERR_ABORTED));
    return;
  }
  // Off is a cheap forwarding path. Changing Off to Custom applies to new
  // requests; a UI enable operation must offer reload for already-loaded pages.
  const auto snapshot = service_->GetSnapshot();
  const bool no_engine =
      !snapshot.managed &&
      (snapshot.status == GuardProfileService::Status::kNoRules ||
       snapshot.status == GuardProfileService::Status::kUnsupportedMode);
  if (snapshot.status == GuardProfileService::Status::kOff || no_engine ||
      !request.url.SchemeIsHTTPOrHTTPS()) {
    target_->CreateLoaderAndStart(std::move(loader), request_id, options,
                                  request, std::move(client), annotation);
    return;
  }
  if (requests_.size() >= kMaxLiveRequestsPerFactory) {
    // Resource exhaustion is an error, never an unevaluated success. No new
    // request object or engine work is allocated after the limit.
    mojo::Remote<network::mojom::URLLoaderClient>(std::move(client))
        ->OnComplete(network::URLLoaderCompletionStatus(
            net::ERR_INSUFFICIENT_RESOURCES));
    return;
  }
  auto pending =
      std::make_unique<Request>(this, std::move(loader), request_id, options,
                                request, std::move(client), annotation);
  Request* raw_request = pending.get();
  requests_.insert(std::move(pending));
  raw_request->Start();
}

void GuardURLLoaderFactory::Clone(
    mojo::PendingReceiver<network::mojom::URLLoaderFactory> receiver) {
  if (receivers_.size() < kMaxClonesPerFactory) {
    receivers_.Add(this, std::move(receiver));
  }
}

void GuardURLLoaderFactory::RemoveRequest(Request* request) {
  const auto found = requests_.find(request);
  CHECK(found != requests_.end());
  requests_.erase(found);
  if (requests_.empty() && receivers_.empty()) {
    target_.reset();
  }
  MaybeDestroy();
}

void GuardURLLoaderFactory::OnFactoryDisconnected() {
  target_.reset();
  receivers_.Clear();
  // Existing URLLoader pipes remain independent. Pending preflight requests
  // detect the lost target before forwarding; live requests finish normally.
  MaybeDestroy();
}

void GuardURLLoaderFactory::OnClientDisconnected() {
  // Unlike a synchronous proxy, a Guard preflight may not have created its
  // downstream loader yet. Retain that exact terminal while requests remain
  // (including browser-owned keepalive requests after their document closes).
  if (receivers_.empty() && requests_.empty()) {
    target_.reset();
  }
  MaybeDestroy();
}

void GuardURLLoaderFactory::MaybeDestroy() {
  if (!target_.is_bound() && requests_.empty() && service_) {
    service_->RemoveFactory(this);
  }
}

}  // namespace tahai::guard
