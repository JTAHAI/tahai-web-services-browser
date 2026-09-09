// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_SERVICES_TAHAI_SKINS_SKIN_DECODER_IMPL_H_
#define CHROME_SERVICES_TAHAI_SKINS_SKIN_DECODER_IMPL_H_

#include "chrome/services/tahai_skins/public/mojom/skin_decoder.mojom.h"
#include "mojo/public/cpp/bindings/pending_receiver.h"
#include "mojo/public/cpp/bindings/receiver.h"

namespace tahai::skins {

class SkinDecoderImpl final : public mojom::SkinDecoder {
 public:
  explicit SkinDecoderImpl(mojo::PendingReceiver<mojom::SkinDecoder> receiver);
  ~SkinDecoderImpl() override;

  void Decode(mojo_base::BigBuffer archive, DecodeCallback callback) override;

 private:
  bool used_ = false;
  mojo::Receiver<mojom::SkinDecoder> receiver_;
};

}  // namespace tahai::skins

#endif  // CHROME_SERVICES_TAHAI_SKINS_SKIN_DECODER_IMPL_H_
