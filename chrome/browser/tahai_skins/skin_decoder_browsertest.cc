// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include <algorithm>
#include <cstdint>
#include <cstring>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "base/check.h"
#include "base/check_op.h"
#include "base/compiler_specific.h"
#include "base/containers/span.h"
#include "base/files/file_util.h"
#include "base/files/scoped_temp_dir.h"
#include "base/functional/callback_helpers.h"
#include "base/json/json_writer.h"
#include "base/json/json_reader.h"
#include "base/location.h"
#include "base/run_loop.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/task/thread_pool/thread_pool_instance.h"
#include "base/task/execution_fence.h"
#include "base/test/bind.h"
#include "base/test/run_until.h"
#include "base/test/scoped_run_loop_timeout.h"
#include "base/test/test_future.h"
#include "base/threading/thread_restrictions.h"
#include "chrome/app/chrome_command_ids.h"
#include "chrome/browser/browser_process.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/tahai_skins/skin_decode_session.h"
#include "chrome/browser/tahai_skins/skin_profile_service.h"
#include "chrome/browser/tahai_skins/skin_profile_service_factory.h"
#include "chrome/browser/tahai_skins/tahai_skin_signature.h"
#include "chrome/browser/themes/theme_service.h"
#include "chrome/browser/themes/theme_service_factory.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_commands.h"
#include "chrome/browser/ui/browser_window.h"
#include "chrome/browser/ui/color/chrome_color_id.h"
#include "chrome/browser/ui/tahai/tahai_mode_service.h"
#include "chrome/browser/ui/tahai/tahai_finder.h"
#include "chrome/browser/ui/tahai/tahai_mode_command_model.h"
#include "chrome/browser/ui/tahai/tahai_named_workspace_controller.h"
#include "chrome/browser/ui/tahai/tahai_skin_manager.h"
#include "chrome/browser/ui/tahai/tahai_window_mode_controller.h"
#include "chrome/browser/ui/tahai/tahai_operational_workflow_queue.h"
#include "chrome/browser/ui/webui/tahai/tahai_mission_service.h"
#include "chrome/browser/ui/toolbar/app_menu_model.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/views/frame/browser_view.h"
#include "chrome/common/pref_names.h"
#include "chrome/common/tahai_url_constants.h"
#include "chrome/common/tahai_skins/skin_limits.h"
#include "chrome/common/tahai_skins/tahai_skin_catalog.h"
#include "chrome/grit/browser_resources.h"
#include "chrome/grit/generated_resources.h"
#include "chrome/test/base/in_process_browser_test.h"
#include "chrome/test/base/testing_profile.h"
#include "chrome/test/base/ui_test_utils.h"
#include "components/prefs/pref_service.h"
#include "components/policy/core/browser/browser_policy_connector.h"
#include "components/policy/core/common/mock_configuration_policy_provider.h"
#include "components/policy/policy_constants.h"
#include "components/sync_preferences/testing_pref_service_syncable.h"
#include "components/tabs/public/tab_interface.h"
#include "content/public/test/browser_test.h"
#include "content/public/test/browser_test_utils.h"
#include "content/public/test/test_navigation_observer.h"
#include "crypto/sha2.h"
#include "crypto/keypair.h"
#include "crypto/sign.h"
#include "mojo/public/cpp/base/big_buffer.h"
#include "mojo/public/cpp/bindings/receiver.h"
#include "mojo/public/cpp/system/buffer.h"
#include "testing/gtest/include/gtest/gtest.h"
#include "third_party/skia/include/core/SkColor.h"
#include "third_party/zlib/zlib.h"
#include "ui/base/l10n/l10n_util.h"
#include "ui/base/resource/resource_bundle.h"
#include "ui/color/color_provider.h"
#include "ui/gfx/codec/png_codec.h"
#include "ui/gfx/codec/webp_codec.h"
#include "ui/shell_dialogs/fake_select_file_dialog.h"
#include "ui/views/controls/button/label_button.h"
#include "ui/views/controls/button/checkbox.h"
#include "ui/views/controls/textarea/textarea.h"
#include "ui/views/controls/label.h"
#include "ui/views/interaction/element_tracker_views.h"
#include "ui/views/test/button_test_api.h"
#include "ui/views/widget/widget.h"
#include "ui/views/window/dialog_delegate.h"

namespace tahai::skins {

class SkinProfileServiceTestPeer {
 public:
  static bool HasStartupWork(const SkinProfileService& service) {
    return service.startup_weak_factory_.HasWeakPtrs();
  }
};

namespace {

TEST(TahaiSkinRevisionDiffTest, ExactValuesOrderingTypesAndAbsentAreVisible) {
  const auto old_manifest = base::JSONReader::ReadDict(
      R"({"a/b~c":1,"list":["one","two"],"empty":{},"kept":true})",
      base::JSON_PARSE_RFC);
  const auto new_manifest = base::JSONReader::ReadDict(
      R"({"a/b~c":"1","list":["two","one"],"added":[],"kept":true})",
      base::JSON_PARSE_RFC);
  auto changes = BuildSkinRevisionDiff(*old_manifest, *new_manifest);
  ASSERT_TRUE(changes);
  ASSERT_EQ(5u, changes->size());
  EXPECT_EQ("/a~1b~0c", (*changes)[0].path);
  EXPECT_EQ("1", (*changes)[0].before);
  EXPECT_EQ("\"1\"", (*changes)[0].after);
  EXPECT_EQ("<absent>", (*changes)[1].before);
  EXPECT_EQ("[]", (*changes)[1].after);
  EXPECT_EQ("{}", (*changes)[2].before);
  EXPECT_EQ("<absent>", (*changes)[2].after);
  EXPECT_EQ("/list/0", (*changes)[3].path);
  EXPECT_EQ("\"one\"", (*changes)[3].before);
  EXPECT_EQ("\"two\"", (*changes)[3].after);
  EXPECT_EQ("/list/1", (*changes)[4].path);
  EXPECT_TRUE(BuildSkinRevisionDiff(*old_manifest, *old_manifest)->empty());
}

TEST(TahaiSkinRevisionDiffTest, AddedAndRemovedTreesDoNotHideProtectedFlags) {
  const base::DictValue before;
  const auto after = base::JSONReader::ReadDict(
      R"({"operational":{"workflows":[{"inputs":[{"protected":true,"id":"secret"}]}]}})",
      base::JSON_PARSE_RFC);
  auto added = BuildSkinRevisionDiff(before, *after);
  auto removed = BuildSkinRevisionDiff(*after, before);
  ASSERT_TRUE(added);
  ASSERT_TRUE(removed);
  ASSERT_EQ(2u, added->size());
  ASSERT_EQ(added->size(), removed->size());
  EXPECT_EQ("/operational/workflows/0/inputs/0/protected", (*added)[1].path);
  EXPECT_EQ("true", (*added)[1].after);
  for (size_t i = 0; i < added->size(); ++i) {
    EXPECT_EQ((*added)[i].path, (*removed)[i].path);
    EXPECT_EQ((*added)[i].after, (*removed)[i].before);
    EXPECT_EQ((*added)[i].before, (*removed)[i].after);
  }
}

TEST(TahaiSkinRevisionDiffTest, LimitsFailWithoutPartialReview) {
  base::ListValue entries;
  for (int i = 0; i < 8192; ++i) entries.Append(i);
  base::DictValue after;
  after.Set("entries", std::move(entries));
  ASSERT_TRUE(BuildSkinRevisionDiff(base::DictValue(), after));
  after.FindList("entries")->Append(8192);
  EXPECT_FALSE(BuildSkinRevisionDiff(base::DictValue(), after));
  EXPECT_FALSE(BuildSkinRevisionDiff(base::DictValue(),
      base::DictValue().Set("large", std::string(2 * 1024 * 1024, 'x'))));
  base::DictValue nested;
  nested.Set("leaf", true);
  for (int i = 0; i < 33; ++i)
    nested = base::DictValue().Set("nested", std::move(nested));
  EXPECT_FALSE(BuildSkinRevisionDiff(base::DictValue(), nested));
}

TEST(TahaiSkinSignatureTest, AuthenticatesExactManifestBytes) {
  DecodedSkin skin;
  skin.manifest_json = "{\"schema_version\":2}";
  skin.signing_key_id = "enterprise-2026";
  DecodedSkinAsset asset;
  asset.path = "assets/shell.png";
  ASSERT_TRUE(asset.bitmap.tryAllocN32Pixels(1, 1));
  *asset.bitmap.getAddr32(0, 0) = SK_ColorBLUE;
  asset.bitmap.setImmutable();
  skin.assets.push_back(std::move(asset));

  std::string payload;
  ASSERT_TRUE(BuildTahaiSkinSignaturePayload(skin, &payload));
  const crypto::keypair::PrivateKey private_key =
      crypto::keypair::PrivateKey::GenerateEd25519();
  const crypto::keypair::PublicKey public_key =
      crypto::keypair::PublicKey::FromPrivateKey(private_key);
  skin.signature = crypto::sign::Sign(crypto::sign::SignatureKind::ED25519,
                                      private_key, base::as_byte_span(payload));
  const TahaiSkinTrustKey trusted_key = {
      .id = "enterprise-2026",
      .public_key = public_key.ToEd25519PublicKey(),
  };
  EXPECT_EQ(TahaiSkinSignatureResult::kValid,
            VerifyTahaiSkinSignature(skin, {trusted_key}));

  base::DictValue policy;
  base::ListValue keys;
  base::DictValue key;
  key.Set("id", trusted_key.id);
  key.Set("public_key", base::ToLowerASCII(base::HexEncode(
                            trusted_key.public_key)));
  keys.Append(std::move(key));
  policy.Set("keys", std::move(keys));
  std::vector<TahaiSkinTrustKey> parsed_keys;
  ASSERT_TRUE(ParseTahaiSkinTrustKeys(policy, &parsed_keys));
  ASSERT_EQ(1u, parsed_keys.size());
  EXPECT_EQ(trusted_key.id, parsed_keys.front().id);
  EXPECT_EQ(trusted_key.public_key, parsed_keys.front().public_key);
  EXPECT_EQ(base::ToLowerASCII(base::HexEncode(crypto::SHA256Hash(trusted_key.public_key))),
            TahaiSkinPublicKeyFingerprint(trusted_key));
  auto too_many = std::vector<TahaiSkinTrustKey>(33, trusted_key);
  for (size_t index = 0; index < too_many.size(); ++index)
    too_many[index].id = index == 0 ? trusted_key.id : "key-" + base::NumberToString(index);
  EXPECT_EQ(TahaiSkinSignatureResult::kInvalidInput, VerifyTahaiSkinSignature(skin, too_many));
  too_many.resize(32);
  EXPECT_EQ(TahaiSkinSignatureResult::kValid, VerifyTahaiSkinSignature(skin, too_many));

  base::DictValue malformed_policy = policy.Clone();
  malformed_policy.Set("unexpected", true);
  EXPECT_FALSE(ParseTahaiSkinTrustKeys(malformed_policy, &parsed_keys));
  EXPECT_TRUE(parsed_keys.empty());

  skin.manifest_json = "{\"schema_version\":3}";
  EXPECT_EQ(TahaiSkinSignatureResult::kInvalidSignature,
            VerifyTahaiSkinSignature(skin, {trusted_key}));
}

TEST(TahaiSkinSignatureTest, TrustPolicyRequiresCanonicalBoundedCompleteKeyList) {
  const auto key = [] {
    return base::DictValue().Set("id", "reviewed-key").Set("public_key", std::string(64, 'a'));
  };
  for (const char* invalid : {"uppercase", "zero", "odd", "wrong-type", "extra", "duplicate", "too-many"}) {
    SCOPED_TRACE(invalid);
    base::ListValue entries;
    auto entry = key();
    const std::string kind(invalid);
    if (kind == "uppercase") entry.Set("public_key", std::string(64, 'A'));
    if (kind == "zero") entry.Set("public_key", std::string(64, '0'));
    if (kind == "odd") entry.Set("public_key", std::string(63, 'a'));
    if (kind == "wrong-type") entry.Set("public_key", true);
    if (kind == "extra") entry.Set("trusted", true);
    entries.Append(std::move(entry));
    if (kind == "duplicate") entries.Append(key());
    if (kind == "too-many") for (size_t index = 1; index < 33; ++index) {
      auto another = key(); another.Set("id", "key-" + base::NumberToString(index));
      entries.Append(std::move(another));
    }
    auto policy = base::DictValue().Set("keys", std::move(entries));
    std::vector<TahaiSkinTrustKey> parsed(1);
    EXPECT_FALSE(ParseTahaiSkinTrustKeys(policy, &parsed));
    EXPECT_TRUE(parsed.empty());
  }
}

std::string Hash(std::string_view bytes) {
  return base::ToLowerASCII(
      base::HexEncode(crypto::SHA256Hash(base::as_byte_span(bytes))));
}

SkBitmap MakeBitmap(int width = 2,
                    int height = 2,
                    SkColor color = SK_ColorBLUE) {
  SkBitmap bitmap;
  CHECK(bitmap.tryAllocN32Pixels(width, height));
  bitmap.eraseColor(color);
  return bitmap;
}

std::string Png(int width = 2, int height = 2) {
  const auto encoded = gfx::PNGCodec::EncodeBGRASkBitmap(
      MakeBitmap(width, height), /*discard_transparency=*/false);
  CHECK(encoded);
  return std::string(encoded->begin(), encoded->end());
}

// Deliberately assemble test ZIP bytes, including hostile central-directory
// metadata. No parser or archive writer from the production decoder is reused.
struct Member {
  std::string path;
  std::string bytes;
  uint32_t attributes = 0100644u << 16;
  uint16_t flags = 0;
  uint16_t method = 0;
  std::string extra;
  std::optional<uint32_t> declared_size;
  std::optional<uint32_t> compressed_size;
  std::optional<uint32_t> checksum;
};

void U16(std::string& out, uint16_t value) {
  out.push_back(static_cast<char>(value & 0xff));
  out.push_back(static_cast<char>((value >> 8) & 0xff));
}

void U32(std::string& out, uint32_t value) {
  U16(out, value & 0xffff);
  U16(out, (value >> 16) & 0xffff);
}

uint32_t Crc(std::string_view bytes) {
  return crc32_z(0, base::as_byte_span(bytes).data(), bytes.size());
}

std::string Zip(const std::vector<Member>& members) {
  std::string out;
  std::string directory;
  for (const auto& member : members) {
    const uint32_t offset = out.size();
    const uint32_t size = member.declared_size.value_or(member.bytes.size());
    const uint32_t compressed =
        member.compressed_size.value_or(member.bytes.size());
    const uint32_t crc = member.checksum.value_or(Crc(member.bytes));
    U32(out, 0x04034b50);
    U16(out, 20);
    U16(out, member.flags);
    U16(out, member.method);
    U32(out, 0);  // DOS time/date.
    U32(out, crc);
    U32(out, compressed);
    U32(out, size);
    U16(out, member.path.size());
    U16(out, member.extra.size());
    out += member.path;
    out += member.extra;
    out += member.bytes;

    U32(directory, 0x02014b50);
    U16(directory, 0x0314);  // Unix creator: attributes must work on Windows.
    U16(directory, 20);
    U16(directory, member.flags);
    U16(directory, member.method);
    U32(directory, 0);
    U32(directory, crc);
    U32(directory, compressed);
    U32(directory, size);
    U16(directory, member.path.size());
    U16(directory, member.extra.size());
    U16(directory, 0);  // Comment length.
    U16(directory, 0);  // Start disk.
    U16(directory, 0);  // Internal attributes.
    U32(directory, member.attributes);
    U32(directory, offset);
    directory += member.path;
    directory += member.extra;
  }
  const uint32_t directory_offset = out.size();
  out += directory;
  U32(out, 0x06054b50);
  U16(out, 0);
  U16(out, 0);
  U16(out, members.size());
  U16(out, members.size());
  U32(out, directory.size());
  U32(out, directory_offset);
  U16(out, 0);
  return out;
}

Member DeflatedMember(std::string path, const std::string& bytes) {
  z_stream stream = {};
  CHECK_EQ(Z_OK, deflateInit2(&stream, Z_DEFAULT_COMPRESSION, Z_DEFLATED,
                              -MAX_WBITS, 8, Z_DEFAULT_STRATEGY));
  std::vector<uint8_t> compressed(deflateBound(&stream, bytes.size()));
  stream.next_in = const_cast<uint8_t*>(base::as_byte_span(bytes).data());
  stream.avail_in = bytes.size();
  stream.next_out = compressed.data();
  stream.avail_out = compressed.size();
  CHECK_EQ(Z_STREAM_END, deflate(&stream, Z_FINISH));
  compressed.resize(stream.total_out);
  CHECK_EQ(Z_OK, deflateEnd(&stream));
  Member member{std::move(path),
                std::string(compressed.begin(), compressed.end())};
  member.method = 8;
  member.declared_size = bytes.size();
  member.checksum = Crc(bytes);
  return member;
}

base::DictValue Tokens(std::string_view background,
                       std::string_view foreground) {
  base::DictValue result;
  for (const char* field :
       {"shell_background", "toolbar_background", "tab_background",
        "rail_background", "panel_background"}) {
    result.Set(field, std::string(background));
  }
  for (const char* field : {"toolbar_foreground", "tab_foreground",
                            "rail_foreground", "panel_foreground"}) {
    result.Set(field, std::string(foreground));
  }
  result.Set("accent", "#38bdf8");
  return result;
}

base::DictValue Manifest(const std::vector<Member>& assets) {
  base::DictValue value;
  value.Set("schema_version", 1);
  value.Set("id", "decoder-fixture");
  value.Set("name", "Decoder fixture");
  value.Set("creator", "TAHAI test fixture");
  value.Set("license", "Apache-2.0");
  base::DictValue compatibility;
  compatibility.Set("min_chromium_major", 1);
  compatibility.Set("max_chromium_major", 999);
  value.Set("compatibility", std::move(compatibility));
  base::DictValue appearance;
  appearance.Set("density", "comfortable");
  appearance.Set("reduced_motion", true);
  appearance.Set("light_tokens", Tokens("#ffffff", "#111827"));
  appearance.Set("dark_tokens", Tokens("#111827", "#f8fafc"));
  appearance.Set("high_contrast_tokens", Tokens("#000000", "#ffffff"));
  value.Set("appearance", std::move(appearance));
  base::ListValue entries;
  for (size_t i = 0; i < assets.size(); ++i) {
    base::DictValue entry;
    entry.Set("path", assets[i].path);
    entry.Set("sha256", Hash(assets[i].bytes));
    entry.Set("purpose", i == 0 ? "preview" : "shell-decoration");
    entries.Append(std::move(entry));
  }
  value.Set("assets", std::move(entries));
  return value;
}

std::string Json(const base::DictValue& value) {
  const auto json = base::WriteJson(value);
  CHECK(json);
  return *json;
}

std::vector<Member> Package(std::vector<Member> assets) {
  const std::string manifest = Json(Manifest(assets));
  assets.insert(assets.begin(), Member{"manifest.json", manifest});
  return assets;
}

std::string SignedOperationalArchive(const crypto::keypair::PrivateKey& key,
                                     bool native_workflow = false,
                                     base::RepeatingCallback<void(base::DictValue&)> edit = {},
                                     std::string_view key_id = "fixture-publisher") {
  std::vector<Member> members{{"assets/preview.png", Png()}};
  auto manifest = Manifest(members);
  manifest.Set("schema_version", 2);
  auto operational = base::JSONReader::ReadDict(R"json({
    "capabilities":["workspace-layout","mission-checklist","guard-control"],
    "surfaces":[{"id":"review-surface","layout":"quad",
      "rail_state":"expanded","start_surface":"mission",
      "rail_modules":["mission","guard"]}],
    "workflows":[{"id":"review-workflow","name":"Review workflow",
      "steps":[{"id":"review-step","name":"Review sources","kind":"instruction"}]}],
    "modes":[{"id":"review-mode","name":"Verified review",
      "surface":"review-surface","workflow":"review-workflow",
      "actions":["layout.quad","mission.open"]}]
  })json", base::JSON_PARSE_RFC);
  CHECK(operational);
  if (native_workflow) {
    auto& step = operational->FindList("workflows")->front().GetDict()
        .FindList("steps")->front().GetDict();
    step.Set("kind", "run-command");
    step.Set("action", "layout.dual");
    auto other_mode = operational->FindList("modes")->front().Clone();
    other_mode.GetDict().Set("id", "second-review-mode");
    operational->FindList("modes")->Append(std::move(other_mode));
  }
  manifest.Set("operational", std::move(*operational));
  if (edit) edit.Run(manifest);
  DecodedSkin signing_input;
  signing_input.manifest_json = Json(manifest);
  std::string payload;
  CHECK(BuildTahaiSkinSignaturePayload(signing_input, &payload));
  const auto signature = crypto::sign::Sign(crypto::sign::SignatureKind::ED25519,
                                            key, base::as_byte_span(payload));
  members.insert(members.begin(), {"manifest.json", signing_input.manifest_json});
  members.push_back({"META-INF/tahai-key-id", std::string(key_id)});
  members.push_back({"META-INF/tahai-signature.ed25519",
                     std::string(signature.begin(), signature.end())});
  return Zip(members);
}

base::DictValue OperationalTrustPolicy(const crypto::keypair::PrivateKey& key,
                                      std::string_view key_id = "fixture-publisher") {
  const auto public_key = crypto::keypair::PublicKey::FromPrivateKey(key);
  base::ListValue keys;
  keys.Append(base::DictValue()
                  .Set("id", std::string(key_id))
                  .Set("public_key", base::ToLowerASCII(
                                         base::HexEncode(public_key.ToEd25519PublicKey()))));
  return base::DictValue().Set("keys", std::move(keys));
}

SkinDecodeResult Decode(const std::string& archive) {
  SkinDecodeSession session;
  base::test::TestFuture<SkinDecodeResult> future;
  session.Decode(archive, future.GetCallback());
  return future.Take();
}

void ExpectRejected(const std::vector<Member>& members,
                    mojom::DecodeStatus status) {
  auto result = Decode(Zip(members));
  EXPECT_EQ(DecodeOutcome::kRejected, result.outcome);
  EXPECT_EQ(status, result.decoder_status);
  EXPECT_FALSE(result.skin);
}

// Controlled IPC peer is used ONLY for browser-owner failure/revalidation
// cases. Archive/codec tests above and below use the actual sandboxed utility.
class FakeDecoder final : public mojom::SkinDecoder {
 public:
  mojo::PendingRemote<mojom::SkinDecoder> Bind() {
    mojo::PendingRemote<mojom::SkinDecoder> remote;
    receiver_.Bind(remote.InitWithNewPipeAndPassReceiver());
    return remote;
  }
  void Decode(mojo_base::BigBuffer archive, DecodeCallback callback) override {
    ++requests;
    callback_ = std::move(callback);
  }
  void Reply(mojom::DecodeStatus status, mojom::DecodedPackagePtr package) {
    CHECK(callback_);
    std::move(callback_).Run(status, std::move(package));
  }
  void Drop() { receiver_.reset(); }
  int requests = 0;

 private:
  DecodeCallback callback_;
  mojo::Receiver<mojom::SkinDecoder> receiver_{this};
};

mojom::DecodedPackagePtr FakePackage() {
  auto package = mojom::DecodedPackage::New();
  package->manifest_json = Json(Manifest({{"assets/preview.png", "bytes"}}));
  auto asset = mojom::DecodedAsset::New();
  asset->path = "assets/preview.png";
  asset->width = 2;
  asset->height = 2;
  asset->pixels = mojo_base::BigBuffer(16);
  std::ranges::fill(base::span(asset->pixels), 0xff);
  package->assets.push_back(std::move(asset));
  return package;
}

class TahaiSkinDecoderBrowserTest : public InProcessBrowserTest {};

// Package ownership cases use the real archive/image utility, profile service
// and background SQLite store. Only the incoming ZIP fixture is synthetic.
class TahaiSkinProfileBrowserTest : public InProcessBrowserTest {
 protected:
  void SetUpOnMainThread() override {
    InProcessBrowserTest::SetUpOnMainThread();
    base::ScopedAllowBlockingForTesting allow_blocking;
    ASSERT_TRUE(files_.CreateUniqueTempDir());
    // Keep TestingProfile storage beneath the browser test's user-data root;
    // Storage Service rejects browser-context paths outside that sandbox.
    auto path = browser()->GetProfile()->GetPath().DirName().AppendASCII(
        "tahai-skin-test-profile");
    ASSERT_TRUE(base::CreateDirectory(path));
    profile_ = TestingProfile::Builder().SetPath(path).Build();
    service_ = std::make_unique<SkinProfileService>(profile_.get());
  }
  void TearDownOnMainThread() override {
    service_.reset();
    // Drain the store close and cancelled file reads before temp-dir cleanup.
    base::ThreadPoolInstance::Get()->FlushForTesting();
    base::RunLoop().RunUntilIdle();
    profile_.reset();
    InProcessBrowserTest::TearDownOnMainThread();
  }
  base::FilePath WriteArchive(const std::string& bytes) {
    base::ScopedAllowBlockingForTesting allow_blocking;
    const auto path = files_.GetPath().AppendASCII("chosen.tahaiskin");
    CHECK(base::WriteFile(path, bytes));
    return path;
  }
  SkinOperationResult Preview(const std::string& bytes) {
    base::test::TestFuture<SkinOperationResult> result;
    service_->PreviewFile(WriteArchive(bytes), result.GetCallback());
    return result.Take();
  }
  SkinOperationResult Install(std::string token) {
    base::test::TestFuture<SkinOperationResult> result;
    if (const auto* review = service_->GetPreviewRevisionReview(token)) {
      EXPECT_TRUE(service_->AcknowledgeRevisionReview(
          token, review->current_sha256, review->candidate_sha256));
    }
    service_->InstallPreview(std::move(token), result.GetCallback());
    return result.Take();
  }
  SkinOperationResult Catalog() {
    base::test::TestFuture<SkinOperationResult> result;
    service_->List(result.GetCallback());
    return result.Take();
  }
  void RestartOwner() {
    service_.reset();
    base::ThreadPoolInstance::Get()->FlushForTesting();
    base::RunLoop().RunUntilIdle();
    service_ = std::make_unique<SkinProfileService>(profile_.get());
  }
  base::ScopedTempDir files_;
  std::unique_ptr<TestingProfile> profile_;
  std::unique_ptr<SkinProfileService> service_;
};

IN_PROC_BROWSER_TEST_F(TahaiSkinProfileBrowserTest,
                       TahaiSkinInstallUpdateRollbackAndRestart) {
  const auto first = Zip(Package({{"assets/preview.png", Png()}}));
  const auto second = Zip(Package({{"assets/preview.png", Png(3, 3)}}));
  auto preview = Preview(first);
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  ASSERT_TRUE(service_->GetPreview(preview.preview_token));
  // Merely reviewing never installs or changes appearance preferences.
  EXPECT_TRUE(Catalog().catalog.empty());
  EXPECT_TRUE(
      profile_->GetPrefs()->GetDict(prefs::kTahaiSkinSelection).empty());
  ASSERT_EQ(SkinOperationStatus::kOk, Install(preview.preview_token).status);
  EXPECT_FALSE(service_->GetPreview(preview.preview_token));
  auto update = Preview(second);
  ASSERT_EQ(SkinOperationStatus::kOk, update.status);
  ASSERT_EQ(SkinOperationStatus::kOk, Install(update.preview_token).status);
  RestartOwner();
  auto catalog = Catalog();
  ASSERT_EQ(SkinOperationStatus::kOk, catalog.status);
  ASSERT_EQ(1u, catalog.catalog.size());
  EXPECT_EQ(Hash(second), catalog.catalog[0].archive_sha256);
  EXPECT_EQ(Hash(first), catalog.catalog[0].previous_sha256);
  base::test::TestFuture<SkinOperationResult> result;
  service_->PreviewInstalled("decoder-fixture", Hash(second), true,
                             result.GetCallback());
  auto rollback = result.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, rollback.status);
  const auto* decoded = service_->GetPreview(rollback.preview_token);
  ASSERT_TRUE(decoded);
  EXPECT_EQ(Hash(first), decoded->archive_sha256);
  EXPECT_EQ(2, decoded->assets[0].bitmap.width());
  ASSERT_EQ(SkinOperationStatus::kOk, Install(rollback.preview_token).status);
  catalog = Catalog();
  ASSERT_EQ(1u, catalog.catalog.size());
  EXPECT_EQ(Hash(first), catalog.catalog[0].archive_sha256);
  EXPECT_EQ(Hash(second), catalog.catalog[0].previous_sha256);
  service_->Remove("decoder-fixture", Hash(second), result.GetCallback());
  EXPECT_EQ(SkinStoreError::kConflict, result.Take().store_error);
  service_->Remove("decoder-fixture", Hash(first), result.GetCallback());
  EXPECT_EQ(SkinOperationStatus::kOk, result.Take().status);
  EXPECT_TRUE(Catalog().catalog.empty());
  EXPECT_TRUE(
      profile_->GetPrefs()->GetDict(prefs::kTahaiSkinSelection).empty());
}

IN_PROC_BROWSER_TEST_F(TahaiSkinProfileBrowserTest,
                       TahaiRevisionReviewRequiresExactAcknowledgementAndRollback) {
  const auto first = Zip(Package({{"assets/preview.png", Png()}}));
  const auto second = Zip(Package({{"assets/preview.png", Png(3, 3)}}));
  auto preview = Preview(first);
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  EXPECT_FALSE(service_->GetPreviewRevisionReview(preview.preview_token));
  ASSERT_EQ(SkinOperationStatus::kOk, Install(preview.preview_token).status);
  auto update = Preview(second);
  ASSERT_EQ(SkinOperationStatus::kOk, update.status);
  const auto* review = service_->GetPreviewRevisionReview(update.preview_token);
  ASSERT_TRUE(review);
  EXPECT_EQ(Hash(first), review->current_sha256);
  EXPECT_EQ(Hash(second), review->candidate_sha256);
  EXPECT_FALSE(review->current_operational);
  EXPECT_FALSE(review->current_publisher);
  ASSERT_EQ(1u, review->changes.size());
  EXPECT_EQ("/assets/0/sha256", review->changes[0].path);
  base::test::TestFuture<SkinOperationResult> reply;
  service_->InstallPreview(update.preview_token, reply.GetCallback());
  EXPECT_EQ(SkinOperationStatus::kStalePreview, reply.Take().status);
  EXPECT_FALSE(service_->AcknowledgeRevisionReview(preview.preview_token, Hash(first), Hash(second)));
  EXPECT_FALSE(service_->AcknowledgeRevisionReview(update.preview_token, Hash(second), Hash(first)));
  EXPECT_FALSE(service_->AcknowledgeRevisionReview(update.preview_token, Hash(first), Hash(first)));
  EXPECT_EQ(Hash(first), Catalog().catalog[0].archive_sha256);
  ASSERT_TRUE(service_->AcknowledgeRevisionReview(update.preview_token, Hash(first), Hash(second)));
  // Cancellation destroys acknowledgement as well as the comparison.
  service_->Cancel();
  EXPECT_FALSE(service_->GetPreviewRevisionReview(update.preview_token));
  update = Preview(second);
  ASSERT_EQ(SkinOperationStatus::kOk, update.status);
  service_->InstallPreview(update.preview_token, reply.GetCallback());
  EXPECT_EQ(SkinOperationStatus::kStalePreview, reply.Take().status);
  ASSERT_EQ(SkinOperationStatus::kOk, Install(update.preview_token).status);
  service_->PreviewInstalled("decoder-fixture", Hash(second), true, reply.GetCallback());
  const auto rollback = reply.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, rollback.status);
  review = service_->GetPreviewRevisionReview(rollback.preview_token);
  ASSERT_TRUE(review);
  EXPECT_EQ(Hash(second), review->current_sha256);
  EXPECT_EQ(Hash(first), review->candidate_sha256);
  service_->InstallPreview(rollback.preview_token, reply.GetCallback());
  EXPECT_EQ(SkinOperationStatus::kStalePreview, reply.Take().status);
  ASSERT_EQ(SkinOperationStatus::kOk, Install(rollback.preview_token).status);
  const auto same = Preview(first);
  EXPECT_EQ(SkinOperationStatus::kOk, same.status);
  EXPECT_FALSE(service_->GetPreviewRevisionReview(same.preview_token));
  EXPECT_EQ(SkinOperationStatus::kOk, Install(same.preview_token).status);
}

IN_PROC_BROWSER_TEST_F(TahaiSkinProfileBrowserTest,
                       TahaiRevisionReviewRejectsSupersededCandidateAndForgedCachedManifest) {
  const auto first = Zip(Package({{"assets/preview.png", Png()}}));
  const auto second = Zip(Package({{"assets/preview.png", Png(3, 3)}}));
  const auto third = Zip(Package({{"assets/preview.png", Png(4, 4)}}));
  auto preview = Preview(first);
  ASSERT_EQ(SkinOperationStatus::kOk, Install(preview.preview_token).status);
  auto update = Preview(second);
  ASSERT_EQ(SkinOperationStatus::kOk, update.status);
  ASSERT_TRUE(service_->AcknowledgeRevisionReview(update.preview_token, Hash(first), Hash(second)));
  auto replacement = Preview(third);
  ASSERT_EQ(SkinOperationStatus::kOk, replacement.status);
  base::test::TestFuture<SkinOperationResult> reply;
  service_->InstallPreview(update.preview_token, reply.GetCallback());
  EXPECT_EQ(SkinOperationStatus::kStalePreview, reply.Take().status);
  ASSERT_EQ(SkinOperationStatus::kOk, Install(replacement.preview_token).status);
  EXPECT_EQ(Hash(third), Catalog().catalog[0].archive_sha256);
  // The store uses an exclusive lock. Close its owner before constructing the
  // corrupt-cache fixture; a second live database owner is not a valid setup.
  service_.reset();
  base::ThreadPoolInstance::Get()->FlushForTesting();
  base::RunLoop().RunUntilIdle();
  {
    base::ScopedAllowBlockingForTesting allow_blocking;
    SkinPackageStore writer(profile_->GetPath());
    // A valid catalog manifest cannot stand in for the archive's definition.
    // The store deliberately has no decoder; the browser owner must catch it.
    ASSERT_TRUE(writer.Install({"decoder-fixture", Json(Manifest({{"assets/preview.png", Png(4, 4)}})), Hash(first), first}, Hash(third)).has_value());
  }
  RestartOwner();
  update = Preview(second);
  EXPECT_EQ(SkinOperationStatus::kStalePreview, update.status);
  EXPECT_TRUE(update.preview_token.empty());
  EXPECT_FALSE(service_->PreviewCanBeInstalled(update.preview_token));
}

IN_PROC_BROWSER_TEST_F(TahaiSkinProfileBrowserTest,
                       TahaiSkinProfileIsolationAndPrivateDenial) {
  const auto archive = Zip(Package({{"assets/preview.png", Png()}}));
  auto preview = Preview(archive);
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  ASSERT_EQ(SkinOperationStatus::kOk, Install(preview.preview_token).status);
  auto* regular =
      SkinProfileServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(regular);
  base::test::TestFuture<SkinOperationResult> other;
  regular->List(other.GetCallback());
  const auto other_catalog = other.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, other_catalog.status);
  EXPECT_TRUE(other_catalog.catalog.empty());
  Browser* private_browser = CreateIncognitoBrowser(browser()->GetProfile());
  EXPECT_FALSE(
      SkinProfileServiceFactory::GetForProfile(private_browser->GetProfile()));
  SkinProfileService private_owner(private_browser->GetProfile());
  private_owner.PreviewFile(WriteArchive(archive), other.GetCallback());
  EXPECT_EQ(SkinOperationStatus::kDisabled, other.Take().status);
  private_owner.List(other.GetCallback());
  EXPECT_EQ(SkinOperationStatus::kDisabled, other.Take().status);
  EXPECT_FALSE(private_owner.GetPreview(preview.preview_token));
  EXPECT_EQ(1u, Catalog().catalog.size());
}

IN_PROC_BROWSER_TEST_F(TahaiSkinProfileBrowserTest,
                       TahaiSkinManagedPolicyRevokesReviewAndRetainsPackages) {
  const auto archive = Zip(Package({{"assets/preview.png", Png()}}));
  auto first = Preview(archive);
  ASSERT_EQ(SkinOperationStatus::kOk, first.status);
  ASSERT_EQ(SkinOperationStatus::kOk, Install(first.preview_token).status);
  auto pending = Preview(archive);
  ASSERT_EQ(SkinOperationStatus::kOk, pending.status);
  auto* testing_prefs = profile_->GetTestingPrefService();
  testing_prefs->SetManagedPref(prefs::kTahaiSkinInstallationsAllowed,
                                base::Value(false));
  testing_prefs->SetBoolean(prefs::kTahaiSkinInstallationsAllowed, true);
  EXPECT_FALSE(service_->installation_allowed());
  EXPECT_FALSE(service_->GetPreview(pending.preview_token));
  EXPECT_EQ(SkinOperationStatus::kInstallDisallowed,
            Install(pending.preview_token).status);
  EXPECT_EQ(SkinOperationStatus::kInstallDisallowed, Preview(archive).status);
  EXPECT_EQ(1u, Catalog().catalog.size());
  base::test::TestFuture<SkinOperationResult> result;
  service_->PreviewInstalled("decoder-fixture", Hash(archive), false,
                             result.GetCallback());
  auto current = result.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, current.status);
  EXPECT_TRUE(service_->GetPreview(current.preview_token));
  EXPECT_FALSE(service_->PreviewCanBeInstalled(current.preview_token));
  testing_prefs->SetManagedPref(prefs::kTahaiSkinsEnabled, base::Value(false));
  EXPECT_FALSE(service_->GetPreview(current.preview_token));
  EXPECT_EQ(SkinOperationStatus::kDisabled, Catalog().status);
  service_->Remove("decoder-fixture", Hash(archive), result.GetCallback());
  EXPECT_EQ(SkinOperationStatus::kDisabled, result.Take().status);
  testing_prefs->RemoveManagedPref(prefs::kTahaiSkinsEnabled);
  EXPECT_EQ(1u, Catalog().catalog.size());
  // Installation lock does not prevent an explicit removal.
  service_->Remove("decoder-fixture", Hash(archive), result.GetCallback());
  EXPECT_EQ(SkinOperationStatus::kOk, result.Take().status);
}

IN_PROC_BROWSER_TEST_F(TahaiSkinProfileBrowserTest,
                       TahaiSkinCancelledAndSupersededReviewsCannotCommit) {
  const auto archive = Zip(Package({{"assets/preview.png", Png()}}));
  auto first = Preview(archive);
  ASSERT_EQ(SkinOperationStatus::kOk, first.status);
  auto second = Preview(archive);
  ASSERT_EQ(SkinOperationStatus::kOk, second.status);
  EXPECT_NE(first.preview_token, second.preview_token);
  service_->ReleasePreview(first.preview_token);
  EXPECT_TRUE(service_->GetPreview(second.preview_token));
  EXPECT_EQ(SkinOperationStatus::kStalePreview,
            Install(first.preview_token).status);
  EXPECT_TRUE(service_->GetPreview(second.preview_token));
  service_->ReleasePreview(second.preview_token);
  EXPECT_EQ(SkinOperationStatus::kStalePreview,
            Install(second.preview_token).status);
  base::test::TestFuture<SkinOperationResult> pending;
  int callbacks = 0;
  service_->PreviewFile(
      WriteArchive(archive),
      base::BindLambdaForTesting([&](SkinOperationResult result) {
        ++callbacks;
        EXPECT_EQ(SkinOperationStatus::kCancelled, result.status);
        EXPECT_TRUE(result.preview_token.empty());
      }));
  service_->List(pending.GetCallback());
  EXPECT_EQ(SkinOperationStatus::kBusy, pending.Take().status);
  service_->Cancel();
  base::ThreadPoolInstance::Get()->FlushForTesting();
  base::RunLoop().RunUntilIdle();
  EXPECT_EQ(1, callbacks);
  EXPECT_TRUE(Catalog().catalog.empty());
  auto weak = service_->GetWeakPtr();
  service_->Shutdown();
  EXPECT_FALSE(weak);
  EXPECT_EQ(SkinOperationStatus::kDisabled, Catalog().status);
}

IN_PROC_BROWSER_TEST_F(TahaiSkinProfileBrowserTest,
                       TahaiSkinInvalidImportsCannotReplaceInstalledRevision) {
  const auto archive = Zip(Package({{"assets/preview.png", Png()}}));
  auto first = Preview(archive);
  ASSERT_EQ(SkinOperationStatus::kOk, first.status);
  ASSERT_EQ(SkinOperationStatus::kOk, Install(first.preview_token).status);
  for (const auto& builtin : GetTahaiBuiltInSkinCatalog()) {
    SCOPED_TRACE(builtin.id);
    auto members = Package({{"assets/preview.png", Png()}});
    auto manifest = Manifest({members[1]});
    manifest.Set("id", std::string(builtin.id));
    members[0].bytes = Json(manifest);
    EXPECT_EQ(SkinOperationStatus::kInvalidInput, Preview(Zip(members)).status);
  }
  EXPECT_EQ(SkinOperationStatus::kDecodeFailed, Preview("not a zip").status);
  base::test::TestFuture<SkinOperationResult> result;
  service_->PreviewFile(base::FilePath(FILE_PATH_LITERAL("relative.tahaiskin")),
                        result.GetCallback());
  EXPECT_EQ(SkinOperationStatus::kReadFailed, result.Take().status);
  auto catalog = Catalog();
  ASSERT_EQ(SkinOperationStatus::kOk, catalog.status);
  ASSERT_EQ(1u, catalog.catalog.size());
  EXPECT_EQ(Hash(archive), catalog.catalog[0].archive_sha256);
  EXPECT_FALSE(catalog.catalog[0].previous_sha256);
}

IN_PROC_BROWSER_TEST_F(TahaiSkinProfileBrowserTest,
                       TahaiLocalPublisherEnrollmentIsExplicitPersistentAndRevocable) {
  const auto key = crypto::keypair::PrivateKey::GenerateEd25519();
  const auto raw = crypto::keypair::PublicKey::FromPrivateKey(key).ToEd25519PublicKey();
  const auto encoded = base::ToLowerASCII(base::HexEncode(raw));
  const auto archive = SignedOperationalArchive(key);
  EXPECT_EQ(SkinOperationStatus::kUntrusted, Preview(archive).status);
  const auto review = service_->ReviewLocalPublisher("fixture-publisher", encoded);
  ASSERT_TRUE(review);
  EXPECT_EQ(base::ToLowerASCII(base::HexEncode(crypto::SHA256Hash(raw))), review->public_key_sha256);
  EXPECT_TRUE(service_->GetLocalPublishers()->empty());
  EXPECT_EQ(SkinOperationStatus::kUntrusted, Preview(archive).status);
  auto forged = *review;
  forged.public_key_sha256 = std::string(64, '0');
  EXPECT_FALSE(service_->EnrollLocalPublisher(forged));
  ASSERT_TRUE(service_->EnrollLocalPublisher(*review));
  EXPECT_FALSE(service_->EnrollLocalPublisher(*review));  // Generation consumed.
  EXPECT_FALSE(service_->ReviewLocalPublisher("fixture-publisher", encoded));
  auto preview = Preview(archive);
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  const auto identity = service_->GetPreviewPublisherReview(preview.preview_token);
  ASSERT_TRUE(identity);
  EXPECT_TRUE(identity->locally_enrolled);
  ASSERT_EQ(SkinOperationStatus::kOk, Install(preview.preview_token).status);
  RestartOwner();
  ASSERT_EQ(1u, service_->GetLocalPublishers()->size());
  base::test::TestFuture<std::optional<base::UnguessableToken>> restored;
  service_->RestoreWindowSkin("decoder-fixture", Hash(archive), restored.GetCallback());
  const auto binding = restored.Take();
  ASSERT_TRUE(binding);
  ASSERT_TRUE(service_->GetWindowBinding(*binding));
  preview = Preview(archive);
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  const auto generation = service_->local_publisher_generation();
  EXPECT_FALSE(service_->RemoveLocalPublisher("fixture-publisher", std::string(64, '0'), generation));
  ASSERT_TRUE(service_->RemoveLocalPublisher("fixture-publisher", review->public_key_sha256, generation));
  EXPECT_FALSE(service_->GetWindowBinding(*binding));
  EXPECT_FALSE(service_->GetPreview(preview.preview_token));
  EXPECT_EQ(SkinOperationStatus::kUntrusted, Preview(archive).status);
  EXPECT_EQ(Hash(archive), Catalog().catalog[0].archive_sha256);
  // Enrollment cannot leak to the unrelated real browser profile or private UI.
  EXPECT_TRUE(SkinProfileServiceFactory::GetForProfile(browser()->GetProfile())->GetLocalPublishers()->empty());
  SkinProfileService private_owner(browser()->GetProfile()->GetPrimaryOTRProfile(true));
  EXPECT_FALSE(private_owner.CanEnrollLocalPublisher());
  EXPECT_FALSE(private_owner.ReviewLocalPublisher("fixture-publisher", encoded));
  EXPECT_FALSE(private_owner.EnrollLocalPublisher(*review));
}

IN_PROC_BROWSER_TEST_F(TahaiSkinProfileBrowserTest,
                       TahaiLocalPublisherPolicyOverridesAndStaleReviewNeverFallsBack) {
  const auto key = crypto::keypair::PrivateKey::GenerateEd25519();
  const auto encoded = base::ToLowerASCII(base::HexEncode(crypto::keypair::PublicKey::FromPrivateKey(key).ToEd25519PublicKey()));
  const auto archive = SignedOperationalArchive(key);
  auto review = service_->ReviewLocalPublisher("fixture-publisher", encoded);
  ASSERT_TRUE(review);
  // Explicit clear must invalidate pending reviews even with an empty store.
  ASSERT_TRUE(service_->ClearLocalPublishers(service_->local_publisher_generation()));
  EXPECT_FALSE(service_->EnrollLocalPublisher(*review));
  review = service_->ReviewLocalPublisher("fixture-publisher", encoded);
  ASSERT_TRUE(review);
  ASSERT_TRUE(service_->EnrollLocalPublisher(*review));
  auto pending = service_->ReviewLocalPublisher("another-publisher", encoded);
  ASSERT_TRUE(pending);
  auto* preferences = profile_->GetTestingPrefService();
  preferences->SetManagedPref(prefs::kTahaiOperationalSkinTrustedKeys, base::Value(base::DictValue()));
  EXPECT_FALSE(service_->CanEnrollLocalPublisher());
  EXPECT_FALSE(service_->EnrollLocalPublisher(*pending));
  EXPECT_EQ(SkinOperationStatus::kUntrusted, Preview(archive).status);
  // Malformed mandatory policy cannot recover authority from local keys.
  preferences->SetManagedPref(prefs::kTahaiOperationalSkinTrustedKeys,
      base::Value(base::DictValue().Set("unexpected", true)));
  EXPECT_EQ(SkinOperationStatus::kUntrusted, Preview(archive).status);
  preferences->SetManagedPref(prefs::kTahaiOperationalSkinTrustedKeys,
      base::Value(OperationalTrustPolicy(key)));
  auto preview = Preview(archive);
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  ASSERT_TRUE(service_->GetPreviewPublisherReview(preview.preview_token));
  EXPECT_FALSE(service_->GetPreviewPublisherReview(preview.preview_token)->locally_enrolled);
  // Removing suspended local trust does not alter managed authority.
  ASSERT_TRUE(service_->RemoveLocalPublisher("fixture-publisher", review->public_key_sha256,
      service_->local_publisher_generation()));
  EXPECT_EQ(SkinOperationStatus::kOk, Preview(archive).status);
  preferences->RemoveManagedPref(prefs::kTahaiOperationalSkinTrustedKeys);
  EXPECT_FALSE(service_->EnrollLocalPublisher(*pending));
  EXPECT_EQ(SkinOperationStatus::kUntrusted, Preview(archive).status);
  preferences->SetManagedPref(prefs::kTahaiSkinInstallationsAllowed, base::Value(false));
  EXPECT_FALSE(service_->CanEnrollLocalPublisher());
}

IN_PROC_BROWSER_TEST_F(TahaiSkinProfileBrowserTest,
                       TahaiLocalPublisherStartupCannotSurviveRevokedGeneration) {
  const auto key = crypto::keypair::PrivateKey::GenerateEd25519();
  const auto encoded = base::ToLowerASCII(base::HexEncode(crypto::keypair::PublicKey::FromPrivateKey(key).ToEd25519PublicKey()));
  auto enrollment = service_->ReviewLocalPublisher("fixture-publisher", encoded);
  ASSERT_TRUE(enrollment);
  ASSERT_TRUE(service_->EnrollLocalPublisher(*enrollment));
  const auto archive = SignedOperationalArchive(key);
  const auto preview = Preview(archive);
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  ASSERT_EQ(SkinOperationStatus::kOk, Install(preview.preview_token).status);
  base::test::TestFuture<SkinOperationResult> reply;
  service_->PreviewInstalled("decoder-fixture", Hash(archive), false, reply.GetCallback());
  const auto installed = reply.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, installed.status);
  ASSERT_TRUE(service_->ApplyPreview(installed.preview_token));
  ASSERT_TRUE(service_->GetOperationalManifest());
  service_.reset();
  base::ThreadPoolInstance::Get()->FlushForTesting();
  base::RunLoop().RunUntilIdle();
  {
    base::ScopedThreadPoolExecutionFence fence;
    service_ = std::make_unique<SkinProfileService>(profile_.get());
    ASSERT_TRUE(SkinProfileServiceTestPeer::HasStartupWork(*service_));
    EXPECT_FALSE(service_->GetOperationalManifest());
    ASSERT_TRUE(service_->RemoveLocalPublisher("fixture-publisher", enrollment->public_key_sha256,
        service_->local_publisher_generation()));
    EXPECT_FALSE(SkinProfileServiceTestPeer::HasStartupWork(*service_));
    enrollment = service_->ReviewLocalPublisher("fixture-publisher", encoded);
    ASSERT_TRUE(enrollment);
    ASSERT_TRUE(service_->EnrollLocalPublisher(*enrollment));
    EXPECT_FALSE(SkinProfileServiceTestPeer::HasStartupWork(*service_));
  }
  // This catalog reply follows the abandoned startup store request. Its weak
  // callback must already be invalid, not merely waiting for a trust recheck.
  EXPECT_EQ(SkinOperationStatus::kOk, Catalog().status);
  EXPECT_FALSE(SkinProfileServiceTestPeer::HasStartupWork(*service_));
  EXPECT_FALSE(service_->GetOperationalManifest());
  service_->PreviewInstalled("decoder-fixture", Hash(archive), false, reply.GetCallback());
  const auto fresh = reply.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, fresh.status);
  EXPECT_TRUE(service_->ApplyPreview(fresh.preview_token));
  EXPECT_TRUE(service_->GetOperationalManifest());
}

IN_PROC_BROWSER_TEST_F(TahaiSkinProfileBrowserTest,
                       TahaiLocalPublisherBoundsAndCorruptionFailClosed) {
  const auto key = crypto::keypair::PrivateKey::GenerateEd25519();
  const auto encoded = base::ToLowerASCII(base::HexEncode(crypto::keypair::PublicKey::FromPrivateKey(key).ToEd25519PublicKey()));
  EXPECT_FALSE(service_->ReviewLocalPublisher("invalid id", encoded));
  EXPECT_FALSE(service_->ReviewLocalPublisher("valid-id", std::string(64, '0')));
  EXPECT_FALSE(service_->ReviewLocalPublisher("valid-id", std::string(64, 'A')));
  EXPECT_FALSE(service_->ReviewLocalPublisher("valid-id", "private key pem"));
  for (size_t i = 0; i < 32; ++i) {
    auto review = service_->ReviewLocalPublisher("key-" + base::NumberToString(i), encoded);
    ASSERT_TRUE(review);
    ASSERT_TRUE(service_->EnrollLocalPublisher(*review));
  }
  EXPECT_FALSE(service_->ReviewLocalPublisher("over-limit", encoded));
  EXPECT_EQ(32u, service_->GetLocalPublishers()->size());
  profile_->GetTestingPrefService()->SetDict(prefs::kTahaiLocalSkinTrustedKeys,
      base::DictValue().Set("keys", base::ListValue().Append("broken")));
  EXPECT_FALSE(service_->GetLocalPublishers());
  EXPECT_FALSE(service_->ReviewLocalPublisher("new-key", encoded));
  EXPECT_EQ(SkinOperationStatus::kUntrusted, Preview(SignedOperationalArchive(key)).status);
  ASSERT_TRUE(service_->ClearLocalPublishers(service_->local_publisher_generation()));
  EXPECT_TRUE(service_->GetLocalPublishers()->empty());
  EXPECT_TRUE(service_->ReviewLocalPublisher("new-key", encoded));
}

IN_PROC_BROWSER_TEST_F(TahaiSkinProfileBrowserTest,
                       TahaiWindowRestoreReverifiesCurrentRevisionAndPolicy) {
  const auto key = crypto::keypair::PrivateKey::GenerateEd25519();
  const auto archive = SignedOperationalArchive(key);
  EXPECT_EQ(SkinOperationStatus::kUntrusted, Preview(archive).status);
  auto* testing_prefs = profile_->GetTestingPrefService();
  testing_prefs->SetManagedPref(prefs::kTahaiOperationalSkinTrustedKeys,
                                base::Value(OperationalTrustPolicy(key)));
  auto preview = Preview(archive);
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  ASSERT_EQ(SkinOperationStatus::kOk, Install(preview.preview_token).status);
  RestartOwner();
  EXPECT_FALSE(service_->GetOperationalManifest());
  base::test::TestFuture<std::optional<base::UnguessableToken>> restored;
  service_->RestoreWindowSkin("decoder-fixture", Hash(archive), restored.GetCallback());
  auto token = restored.Take();
  ASSERT_TRUE(token);
  const auto* binding = service_->GetWindowBinding(*token);
  ASSERT_TRUE(binding);
  ASSERT_TRUE(binding->operational_manifest);
  EXPECT_EQ(Hash(archive), binding->archive_sha256);
  EXPECT_EQ("review-mode", binding->operational_manifest->modes.front().id);
  EXPECT_FALSE(service_->GetOperationalManifest());
  EXPECT_TRUE(testing_prefs->GetDict(prefs::kTahaiAppliedSkin).empty());

  testing_prefs->RemoveManagedPref(prefs::kTahaiOperationalSkinTrustedKeys);
  EXPECT_FALSE(service_->GetWindowBinding(*token));
  // Identical user-written keys cannot impersonate managed publisher trust.
  testing_prefs->SetDict(prefs::kTahaiOperationalSkinTrustedKeys,
                         OperationalTrustPolicy(key));
  service_->RestoreWindowSkin("decoder-fixture", Hash(archive), restored.GetCallback());
  EXPECT_FALSE(restored.Take());
  testing_prefs->SetManagedPref(prefs::kTahaiOperationalSkinTrustedKeys,
                                base::Value(OperationalTrustPolicy(key)));
  service_->RestoreWindowSkin("decoder-fixture", Hash(archive), restored.GetCallback());
  token = restored.Take();
  ASSERT_TRUE(token);
  service_->ReleaseWindowBinding(*token);
}

IN_PROC_BROWSER_TEST_F(TahaiSkinProfileBrowserTest,
                       TahaiWindowRestoreRejectsRollbackAndCancelsPendingWork) {
  const auto first = Zip(Package({{"assets/preview.png", Png()}}));
  const auto second = Zip(Package({{"assets/preview.png", Png(3, 3)}}));
  auto preview = Preview(first);
  ASSERT_EQ(SkinOperationStatus::kOk, Install(preview.preview_token).status);
  preview = Preview(second);
  ASSERT_EQ(SkinOperationStatus::kOk, Install(preview.preview_token).status);
  base::test::TestFuture<std::optional<base::UnguessableToken>> result;
  service_->RestoreWindowSkin("decoder-fixture", Hash(first), result.GetCallback());
  EXPECT_FALSE(result.Take());  // Retained rollback requires separate review.
  service_->RestoreWindowSkin("decoder-fixture", Hash(second), result.GetCallback());
  auto token = result.Take();
  ASSERT_TRUE(token);
  service_->ReleaseWindowBinding(*token);

  base::test::TestFuture<std::optional<base::UnguessableToken>> queued;
  service_->RestoreWindowSkin("decoder-fixture", Hash(second), result.GetCallback());
  service_->RestoreWindowSkin("decoder-fixture", Hash(second), queued.GetCallback());
  profile_->GetPrefs()->SetBoolean(prefs::kTahaiSkinsEnabled, false);
  EXPECT_FALSE(result.Take());
  EXPECT_FALSE(queued.Take());
  profile_->GetPrefs()->SetBoolean(prefs::kTahaiSkinsEnabled, true);

  service_->RestoreWindowSkin("decoder-fixture", Hash(second), result.GetCallback());
  base::test::TestFuture<SkinOperationResult> removed;
  service_->Remove("decoder-fixture", Hash(second), removed.GetCallback());
  EXPECT_FALSE(result.Take());
  ASSERT_EQ(SkinOperationStatus::kOk, removed.Take().status);
  service_->RestoreWindowSkin("decoder-fixture", Hash(second), result.GetCallback());
  EXPECT_FALSE(result.Take());
  service_->RestoreWindowSkin("not-installed", "", result.GetCallback());
  EXPECT_FALSE(result.Take());
  service_->RestoreWindowSkin("terminal-green", Hash(second), result.GetCallback());
  EXPECT_FALSE(result.Take());
}

class TahaiSkinManagerBrowserTest : public TahaiSkinProfileBrowserTest {
 protected:
  void SetUpOnMainThread() override {
    TahaiSkinProfileBrowserTest::SetUpOnMainThread();
    factory_ = ui::FakeSelectFileDialog::RegisterFactory();
    factory_->SetOpenCallback(base::DoNothing());
  }
  void TearDownOnMainThread() override {
    if (auto* manager = Manager(browser())) {
      manager->CloseNow();
    }
    factory_ = nullptr;
    ui::SelectFileDialog::SetFactory(nullptr);
    TahaiSkinProfileBrowserTest::TearDownOnMainThread();
  }
  views::Widget* Manager(Browser* parent) {
    for (const auto& widget_ptr : views::Widget::GetAllOwnedWidgets(
             parent->GetWindow()->GetNativeWindow())) {
      views::Widget* widget = widget_ptr.get();
      if (views::ElementTrackerViews::GetInstance()->GetFirstMatchingView(
              kSkinManagerImportElementId,
              views::ElementTrackerViews::GetContextForWidget(widget), false)) {
        return widget;
      }
    }
    return nullptr;
  }
  views::LabelButton* Button(views::Widget* manager, ui::ElementIdentifier id) {
    return views::ElementTrackerViews::GetInstance()
        ->GetFirstMatchingViewAs<views::LabelButton>(
            id, views::ElementTrackerViews::GetContextForWidget(manager),
            false);
  }
  void OpenChooser() {
    auto* manager = Manager(browser());
    ASSERT_TRUE(manager);
    auto* import = Button(manager, kSkinManagerImportElementId);
    ASSERT_TRUE(import);
    ASSERT_TRUE(base::test::RunUntil([&] { return import->GetEnabled(); }));
    views::test::ButtonTestApi(import).NotifyDefaultMouseClick();
    ASSERT_TRUE(factory_->GetLastDialog());
    EXPECT_EQ("tahaiskin", factory_->GetLastDialog()->default_extension());
    EXPECT_FALSE(factory_->GetLastDialog()->file_types().include_all_files);
    EXPECT_FALSE(factory_->GetLastDialog()->caller());
  }
  SkinProfileService* BrowserService() {
    return SkinProfileServiceFactory::GetForProfile(browser()->GetProfile());
  }
  views::Widget* Confirmation(std::u16string_view title) {
    for (const auto& widget : views::Widget::GetAllOwnedWidgets(browser()->GetWindow()->GetNativeWindow()))
      if (widget->widget_delegate()->GetWindowTitle() == title) return widget.get();
    return nullptr;
  }
  raw_ptr<ui::FakeSelectFileDialog::Factory> factory_ = nullptr;
};

class TahaiOperationalModeBrowserTest : public TahaiSkinManagerBrowserTest {
 protected:
  void SetUpInProcessBrowserTestFixture() override {
    TahaiSkinManagerBrowserTest::SetUpInProcessBrowserTestFixture();
    provider_.SetDefaultReturns(true, true);
    policy::BrowserPolicyConnector::SetPolicyProviderForTesting(&provider_);
  }

  void SetPublisherPolicy(const base::DictValue& value,
                          policy::PolicyLevel level = policy::POLICY_LEVEL_MANDATORY) {
    policy::PolicyMap policies;
    policies.Set(policy::key::kTahaiOperationalSkinTrustedKeys, level,
                  policy::POLICY_SCOPE_USER, policy::POLICY_SOURCE_CLOUD,
                  base::Value(value.Clone()), nullptr);
    provider_.UpdateChromePolicy(policies);
    base::RunLoop().RunUntilIdle();
  }

  testing::NiceMock<policy::MockConfigurationPolicyProvider> provider_;
};

IN_PROC_BROWSER_TEST_F(TahaiOperationalModeBrowserTest,
                       TahaiRevisionReviewReportsCapabilitiesDefinitionsAndPolicyRevocation) {
  const auto key = crypto::keypair::PrivateKey::GenerateEd25519();
  SetPublisherPolicy(OperationalTrustPolicy(key));
  const auto first = SignedOperationalArchive(key);
  const auto second = SignedOperationalArchive(key, false, base::BindLambdaForTesting([](base::DictValue& manifest) {
    auto* operational = manifest.FindDict("operational");
    operational->FindList("capabilities")->Append("browser-navigation");
    operational->FindList("modes")->front().GetDict().FindList("actions")->Append("address.focus");
    operational->FindList("workflows")->front().GetDict().Set("inputs",
        base::ListValue().Append(base::DictValue().Set("id", "private-note").Set("name", "Private note").Set("type", "text").Set("required", false).Set("protected", true)));
  }));
  auto* skins = BrowserService();
  base::test::TestFuture<SkinOperationResult> reply;
  skins->PreviewFile(WriteArchive(first), reply.GetCallback());
  auto preview = reply.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  skins->InstallPreview(preview.preview_token, reply.GetCallback());
  ASSERT_EQ(SkinOperationStatus::kOk, reply.Take().status);
  skins->PreviewFile(WriteArchive(second), reply.GetCallback());
  preview = reply.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  const auto* review = skins->GetPreviewRevisionReview(preview.preview_token);
  ASSERT_TRUE(review);
  ASSERT_TRUE(review->current_publisher);
  ASSERT_TRUE(review->candidate_publisher);
  EXPECT_EQ(review->current_publisher->public_key_sha256, review->candidate_publisher->public_key_sha256);
  ASSERT_EQ(1u, review->added_capabilities.size());
  EXPECT_EQ(TahaiOperationalCapability::kBrowserNavigation, review->added_capabilities[0]);
  EXPECT_TRUE(review->removed_capabilities.empty());
  EXPECT_TRUE(std::ranges::any_of(review->changes, [](const auto& change) {
    return change.path == "/operational/workflows/0/inputs/0/protected" && change.after == "true";
  }));
  ASSERT_TRUE(skins->AcknowledgeRevisionReview(preview.preview_token, Hash(first), Hash(second)));
  SetPublisherPolicy(base::DictValue());
  EXPECT_FALSE(skins->GetPreviewRevisionReview(preview.preview_token));
  skins->InstallPreview(preview.preview_token, reply.GetCallback());
  EXPECT_EQ(SkinOperationStatus::kStalePreview, reply.Take().status);
  SetPublisherPolicy(OperationalTrustPolicy(key));
  EXPECT_FALSE(skins->AcknowledgeRevisionReview(preview.preview_token, Hash(first), Hash(second)));
}

IN_PROC_BROWSER_TEST_F(TahaiOperationalModeBrowserTest,
                       TahaiRevisionReviewExposesKeyRotationAndHistoricalRevocation) {
  const auto old_key = crypto::keypair::PrivateKey::GenerateEd25519();
  const auto new_key = crypto::keypair::PrivateKey::GenerateEd25519();
  auto both = OperationalTrustPolicy(old_key);
  auto new_policy = OperationalTrustPolicy(new_key, "new-publisher");
  both.FindList("keys")->Append(new_policy.FindList("keys")->front().Clone());
  SetPublisherPolicy(both);
  const auto first = SignedOperationalArchive(old_key);
  const auto second = SignedOperationalArchive(new_key, false, {}, "new-publisher");
  auto* skins = BrowserService();
  base::test::TestFuture<SkinOperationResult> reply;
  skins->PreviewFile(WriteArchive(first), reply.GetCallback());
  const auto initial = reply.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, initial.status);
  skins->InstallPreview(initial.preview_token, reply.GetCallback());
  ASSERT_EQ(SkinOperationStatus::kOk, reply.Take().status);
  skins->PreviewFile(WriteArchive(second), reply.GetCallback());
  auto preview = reply.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  const auto* review = skins->GetPreviewRevisionReview(preview.preview_token);
  ASSERT_TRUE(review);
  EXPECT_TRUE(review->changes.empty());  // Same design is not same publisher.
  ASSERT_TRUE(review->current_publisher);
  ASSERT_TRUE(review->candidate_publisher);
  EXPECT_NE(review->current_publisher->public_key_sha256, review->candidate_publisher->public_key_sha256);
  SetPublisherPolicy(new_policy);
  skins->PreviewFile(WriteArchive(second), reply.GetCallback());
  preview = reply.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  review = skins->GetPreviewRevisionReview(preview.preview_token);
  ASSERT_TRUE(review);
  EXPECT_TRUE(review->current_operational);
  EXPECT_FALSE(review->current_publisher);
  ASSERT_TRUE(review->candidate_publisher);
  EXPECT_EQ("new-publisher", review->candidate_publisher->key_id);
  ASSERT_TRUE(skins->AcknowledgeRevisionReview(preview.preview_token, Hash(first), Hash(second)));
  skins->InstallPreview(preview.preview_token, reply.GetCallback());
  EXPECT_EQ(SkinOperationStatus::kOk, reply.Take().status);
  // Rollback to a revoked signing key is never authorized by prior review.
  skins->PreviewInstalled("decoder-fixture", Hash(second), true, reply.GetCallback());
  EXPECT_EQ(SkinOperationStatus::kUntrusted, reply.Take().status);
}

IN_PROC_BROWSER_TEST_F(TahaiOperationalModeBrowserTest,
                       TahaiPublisherReviewBindsKeyFingerprintAndRevokesWithPolicy) {
  const auto key = crypto::keypair::PrivateKey::GenerateEd25519();
  const auto trust = OperationalTrustPolicy(key);
  const auto archive = SignedOperationalArchive(key);
  SetPublisherPolicy(trust);
  auto* skins = BrowserService();
  base::test::TestFuture<SkinOperationResult> result;
  skins->PreviewFile(WriteArchive(archive), result.GetCallback());
  const auto preview = result.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  const auto identity = skins->GetPreviewPublisherReview(preview.preview_token);
  ASSERT_TRUE(identity);
  EXPECT_EQ("fixture-publisher", identity->key_id);
  const auto public_key = crypto::keypair::PublicKey::FromPrivateKey(key).ToEd25519PublicKey();
  EXPECT_EQ(base::ToLowerASCII(base::HexEncode(crypto::SHA256Hash(public_key))), identity->public_key_sha256);
  EXPECT_FALSE(skins->GetPreviewPublisherReview("forged-preview"));
  SetPublisherPolicy(base::DictValue());
  EXPECT_FALSE(skins->GetPreviewPublisherReview(preview.preview_token));
  EXPECT_FALSE(skins->PreviewCanBeInstalled(preview.preview_token));
  SetPublisherPolicy(trust);
  EXPECT_FALSE(skins->GetPreviewPublisherReview(preview.preview_token));
}

IN_PROC_BROWSER_TEST_F(TahaiOperationalModeBrowserTest,
                       TahaiNativeTrustReviewShowsCapabilitiesAndClearsOnRevocation) {
  const auto key = crypto::keypair::PrivateKey::GenerateEd25519();
  SetPublisherPolicy(OperationalTrustPolicy(key));
  const auto path = WriteArchive(SignedOperationalArchive(key));
  ShowSkinManager(browser());
  ASSERT_NO_FATAL_FAILURE(OpenChooser());
  ASSERT_TRUE(factory_->GetLastDialog()->CallFileSelected(path, "tahaiskin"));
  auto* manager = Manager(browser());
  ASSERT_TRUE(manager);
  auto* install = Button(manager, kSkinManagerInstallElementId);
  ASSERT_TRUE(install);
  ASSERT_TRUE(base::test::RunUntil([&] { return install->GetEnabled(); }));
  auto* review = views::ElementTrackerViews::GetInstance()->GetFirstMatchingViewAs<views::Label>(
      kSkinManagerTrustReviewElementId, views::ElementTrackerViews::GetContextForWidget(manager), false);
  ASSERT_TRUE(review);
  EXPECT_TRUE(review->IsDrawn());
  const std::u16string details(review->GetText());
  EXPECT_TRUE(details.contains(u"fixture-publisher"));
  EXPECT_TRUE(details.contains(u"Public-key SHA-256:"));
  EXPECT_TRUE(details.contains(u"Workspace layout"));
  EXPECT_TRUE(details.contains(u"Mission checklist"));
  EXPECT_TRUE(details.contains(u"Guard controls"));
  EXPECT_FALSE(details.contains(u"Browser navigation"));
  EXPECT_TRUE(details.contains(u"creator name is self-described"));
  EXPECT_TRUE(details.contains(u"does not grant website data"));
  base::test::TestFuture<SkinOperationResult> catalog;
  BrowserService()->List(catalog.GetCallback());
  EXPECT_TRUE(catalog.Take().catalog.empty());
  SetPublisherPolicy(base::DictValue());
  EXPECT_TRUE(review->GetText().empty());
  EXPECT_FALSE(review->IsDrawn());
  EXPECT_FALSE(install->GetEnabled());
}

IN_PROC_BROWSER_TEST_F(TahaiOperationalModeBrowserTest,
                       TahaiProfileOperationalRevisionCannotBeReboundByPreferences) {
  const auto key = crypto::keypair::PrivateKey::GenerateEd25519();
  SetPublisherPolicy(OperationalTrustPolicy(key));
  const auto archive = SignedOperationalArchive(key);
  auto* skins = BrowserService();
  base::test::TestFuture<SkinOperationResult> result;
  skins->PreviewFile(WriteArchive(archive), result.GetCallback());
  auto preview = result.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  skins->InstallPreview(preview.preview_token, result.GetCallback());
  ASSERT_EQ(SkinOperationStatus::kOk, result.Take().status);
  skins->PreviewInstalled("decoder-fixture", Hash(archive), false, result.GetCallback());
  preview = result.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  ASSERT_TRUE(skins->ApplyPreview(preview.preview_token));
  ASSERT_TRUE(skins->GetOperationalManifest());
  EXPECT_EQ(Hash(archive), skins->GetOperationalManifestArchiveSha256());
  const auto pinned = skins->BindActiveSkinToWindow();
  ASSERT_TRUE(pinned);
  auto* preferences = browser()->GetProfile()->GetPrefs();
  const auto saved = preferences->GetDict(prefs::kTahaiAppliedSkin).Clone();
  for (const char* field : {"archive_sha256", "id"}) {
    auto forged = saved.Clone();
    forged.Set(field, std::string_view(field) == "id" ? "different-skin" : std::string(64, 'f'));
    preferences->SetDict(prefs::kTahaiAppliedSkin, std::move(forged));
    EXPECT_FALSE(skins->GetOperationalManifest());
    EXPECT_FALSE(skins->GetOperationalManifestArchiveSha256());
    EXPECT_FALSE(skins->BindActiveSkinToWindow());
    // An independently pinned window still owns the original decoded revision.
    const auto* binding = skins->GetWindowBinding(*pinned);
    ASSERT_TRUE(binding);
    EXPECT_EQ("decoder-fixture", binding->skin_id);
    EXPECT_EQ(Hash(archive), binding->archive_sha256);
    preferences->SetDict(prefs::kTahaiAppliedSkin, saved.Clone());
    ASSERT_TRUE(skins->GetOperationalManifest());
    EXPECT_EQ(Hash(archive), skins->GetOperationalManifestArchiveSha256());
  }
  SetPublisherPolicy(base::DictValue());
  EXPECT_FALSE(skins->GetOperationalManifest());
  EXPECT_FALSE(skins->GetWindowBinding(*pinned));
}

IN_PROC_BROWSER_TEST_F(TahaiOperationalModeBrowserTest,
                       TahaiWorkflowNativeDeadlineStopsDelayedJournalDispatch) {
  const auto key = crypto::keypair::PrivateKey::GenerateEd25519();
  SetPublisherPolicy(OperationalTrustPolicy(key));
  const auto archive = SignedOperationalArchive(key, true);
  auto* skins = BrowserService();
  base::test::TestFuture<SkinOperationResult> result;
  skins->PreviewFile(WriteArchive(archive), result.GetCallback());
  auto preview = result.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  skins->InstallPreview(preview.preview_token, result.GetCallback());
  ASSERT_EQ(SkinOperationStatus::kOk, result.Take().status);
  skins->PreviewInstalled("decoder-fixture", Hash(archive), false, result.GetCallback());
  preview = result.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  auto* controller = WindowModeController::GetForBrowser(browser());
  ASSERT_TRUE(controller->ApplyReviewedWindowSkin(preview.preview_token));
  ASSERT_TRUE(controller->SelectOperationalMode("review-mode"));
  const auto workflow = controller->operational_manifest()->workflows.front();
  ASSERT_TRUE(QueueOperationalWorkflowLaunch(browser()->GetProfile(), workflow,
                                            "decoder-fixture", Hash(archive)));
  ASSERT_TRUE(chrome::ExecuteCommand(browser(), IDC_TAHAI_MISSION_CONTROL));
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(content::WaitForLoadStop(contents));
  auto* missions = MissionServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_FALSE(missions->missions().empty());
  const auto id = missions->missions().back().id;
  const auto send = content::JsReplace("chrome.send('runTahaiNativeWorkflowStep', [$1, 0, $2]);", id, missions->missions().back().mutation_token);
  const int count = browser()->tab_strip_model()->count();
  ASSERT_FALSE(browser()->tab_strip_model()->GetActiveTab()->GetSplit());
  {
    // The real UI-thread watchdog must fire even though journal work cannot
    // run or deliver a callback. No renderer request causes this expiry.
    base::ScopedThreadPoolExecutionFence fence;
    ASSERT_TRUE(content::ExecJs(contents, send));
    ASSERT_TRUE(base::test::RunUntil([&] {
      return missions->missions().back().steps[0].action_state == "pending";
    }));
    ASSERT_TRUE(base::test::RunUntil([&] {
      return missions->missions().back().steps[0].action_state == "unknown";
    }));
    EXPECT_EQ("deadline-exceeded", missions->missions().back().steps[0].native_action_error);
    EXPECT_EQ("failed", missions->missions().back().operational_workflow->run_state);
  }
  // Observe the actual delayed result reply, not merely the already-expired
  // in-memory state. It must not present the late rejection as a new outcome.
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, R"(
      document.querySelector('[data-tahai-native-status]').textContent === 'Native action: unknown'
    )").ExtractBool();
  }));
  EXPECT_EQ(count, browser()->tab_strip_model()->count());
  EXPECT_FALSE(browser()->tab_strip_model()->GetActiveTab()->GetSplit());
  EXPECT_EQ("deadline-exceeded", missions->missions().back().steps[0].native_action_error);
  {
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, "document.querySelector('[data-tahai-native-refresh]').click()"));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  EXPECT_TRUE(content::EvalJs(contents, R"(
    (() => {
      const error = document.querySelector('[data-tahai-native-error=unknown]');
      return error && !error.hidden && error.textContent.includes('deadline expired') &&
          error.textContent.includes('may have happened') && document.querySelector('[data-tahai-native-run]').disabled;
    })()
  )").ExtractBool());
  ASSERT_TRUE(content::ExecJs(contents, send));
  base::RunLoop().RunUntilIdle();
  EXPECT_EQ("unknown", missions->missions().back().steps[0].action_state);
  EXPECT_FALSE(browser()->tab_strip_model()->GetActiveTab()->GetSplit());
  EXPECT_EQ(count, browser()->tab_strip_model()->count());
}

IN_PROC_BROWSER_TEST_F(TahaiOperationalModeBrowserTest,
                       TahaiWorkflowNativeActionDispatchesOnceAndRevokesAtUse) {
  const auto key = crypto::keypair::PrivateKey::GenerateEd25519();
  SetPublisherPolicy(OperationalTrustPolicy(key));
  const auto archive = SignedOperationalArchive(key, true);
  auto* skins = BrowserService();
  base::test::TestFuture<SkinOperationResult> result;
  skins->PreviewFile(WriteArchive(archive), result.GetCallback());
  auto preview = result.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  skins->InstallPreview(preview.preview_token, result.GetCallback());
  ASSERT_EQ(SkinOperationStatus::kOk, result.Take().status);
  skins->PreviewInstalled("decoder-fixture", Hash(archive), false, result.GetCallback());
  preview = result.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  auto* controller = WindowModeController::GetForBrowser(browser());
  ASSERT_TRUE(controller->ApplyReviewedWindowSkin(preview.preview_token));
  ASSERT_TRUE(controller->SelectOperationalMode("review-mode"));
  const auto workflow = controller->operational_manifest()->workflows.front();
  ASSERT_TRUE(QueueOperationalWorkflowLaunch(browser()->GetProfile(), workflow,
                                            "decoder-fixture", Hash(archive)));
  ASSERT_TRUE(chrome::ExecuteCommand(browser(), IDC_TAHAI_MISSION_CONTROL));
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(content::WaitForLoadStop(contents));
  auto* missions = MissionServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_FALSE(missions->missions().empty());
  const auto id = missions->missions().back().id;
  ASSERT_EQ("ready", missions->missions().back().steps[0].action_state);
  ASSERT_FALSE(browser()->tab_strip_model()->GetActiveTab()->GetSplit());
  const auto send = content::JsReplace("chrome.send('runTahaiNativeWorkflowStep', [$1, 0, $2]);", id, missions->missions().back().mutation_token);
  // A renderer message without a fresh gesture is not an invocation.
  ASSERT_TRUE(content::ExecJs(contents, send, content::EXECUTE_SCRIPT_NO_USER_GESTURE));
  base::RunLoop().RunUntilIdle();
  EXPECT_EQ("ready", missions->missions().back().steps[0].action_state);
  // An old rendered run cannot dispatch after another view changes its scope.
  ASSERT_TRUE(missions->AddLocalNote(id, "Scope changed before dispatch"));
  ASSERT_TRUE(content::ExecJs(contents, send));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents,
      "document.querySelector('#mission-status').textContent.includes('Action unavailable')").ExtractBool(); }));
  EXPECT_EQ("ready", missions->missions().back().steps[0].action_state);
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(kTahaiMissionURL)));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    const button = [...document.querySelectorAll('[data-tahai-native-run]')].at(-1);
    button.id = 'native-workflow-fixture'; button.scrollIntoView();
  )JS"));
  content::TestNavigationObserver command_refresh(contents, 1);
  content::SimulateMouseClickOrTapElementWithId(contents, "native-workflow-fixture");
  command_refresh.Wait();
  ASSERT_TRUE(content::WaitForLoadStop(contents));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return missions->missions().back().steps[0].action_state == "dispatched";
  }));
  EXPECT_TRUE(browser()->tab_strip_model()->GetActiveTab()->GetSplit());
  EXPECT_FALSE(missions->missions().back().steps[0].complete);
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents,
      "!document.querySelector('[data-tahai-mission-action=toggle-step]').disabled").ExtractBool(); }));
  EXPECT_EQ(missions->missions().back().mutation_token, content::EvalJs(contents,
      "document.querySelector('[data-tahai-mission-action=toggle-step]').dataset.tahaiRunToken"));
  const auto split = browser()->tab_strip_model()->GetActiveTab()->GetSplit();
  const int count = browser()->tab_strip_model()->count();
  ASSERT_TRUE(content::ExecJs(contents, send));
  base::RunLoop().RunUntilIdle();
  EXPECT_EQ(split, browser()->tab_strip_model()->GetActiveTab()->GetSplit());
  EXPECT_EQ(count, browser()->tab_strip_model()->count());
  EXPECT_EQ("dispatched", missions->missions().back().steps[0].action_state);

  // Hold journal I/O until a different mode sharing this exact workflow has
  // been selected. Re-resolving the same command is not enough: the initiating
  // mode must still match at use, without dispatching from the queued callback.
  const auto changed = missions->CreateOperationalWorkflowMission(
      workflow, "decoder-fixture", Hash(archive), true);
  ASSERT_TRUE(changed);
  ASSERT_TRUE(missions->SetOperationalWorkflowRunState(changed->id, "running"));
  {
    base::ScopedThreadPoolExecutionFence fence;
    ASSERT_TRUE(content::ExecJs(contents,
        content::JsReplace("chrome.send('runTahaiNativeWorkflowStep', [$1, 0, $2]);", changed->id, missions->missions().back().mutation_token)));
    ASSERT_TRUE(base::test::RunUntil([&] {
      return missions->missions().back().steps[0].action_state == "pending";
    }));
    ASSERT_TRUE(controller->SelectOperationalMode("second-review-mode"));
  }
  ASSERT_TRUE(base::test::RunUntil([&] {
    return missions->missions().back().steps[0].action_state == "rejected";
  }));
  EXPECT_EQ("failed", missions->missions().back().operational_workflow->run_state);
  EXPECT_FALSE(missions->SetOperationalWorkflowRunState(changed->id, "running"));
  EXPECT_FALSE(missions->BeginNativeWorkflowStep(changed->id, 0));
  EXPECT_EQ(split, browser()->tab_strip_model()->GetActiveTab()->GetSplit());
  EXPECT_EQ(count, browser()->tab_strip_model()->count());

  // Even a run-local edit while journal I/O is pending invalidates this
  // invocation through its random freshness token, not a wall-clock stamp.
  const auto edited = missions->CreateOperationalWorkflowMission(
      workflow, "decoder-fixture", Hash(archive), true);
  ASSERT_TRUE(edited);
  ASSERT_TRUE(missions->SetOperationalWorkflowRunState(edited->id, "running"));
  {
    base::ScopedThreadPoolExecutionFence fence;
    ASSERT_TRUE(content::ExecJs(contents,
        content::JsReplace("chrome.send('runTahaiNativeWorkflowStep', [$1, 0, $2]);", edited->id, missions->missions().back().mutation_token)));
    ASSERT_TRUE(base::test::RunUntil([&] {
      return missions->missions().back().steps[0].action_state == "pending";
    }));
    const auto token = missions->missions().back().mutation_token;
    ASSERT_TRUE(missions->AddLocalNote(edited->id, "Recheck the local scope"));
    EXPECT_NE(token, missions->missions().back().mutation_token);
  }
  ASSERT_TRUE(base::test::RunUntil([&] {
    return missions->missions().back().steps[0].action_state == "rejected";
  }));
  EXPECT_EQ("failed", missions->missions().back().operational_workflow->run_state);
  EXPECT_EQ(split, browser()->tab_strip_model()->GetActiveTab()->GetSplit());
  EXPECT_EQ(count, browser()->tab_strip_model()->count());

  const auto fresh = missions->CreateOperationalWorkflowMission(
      workflow, "decoder-fixture", Hash(archive), true);
  ASSERT_TRUE(fresh);
  ASSERT_TRUE(missions->SetOperationalWorkflowRunState(fresh->id, "running"));
  SetPublisherPolicy(base::DictValue());
  ASSERT_FALSE(controller->operational_manifest());
  ASSERT_TRUE(content::ExecJs(contents,
      content::JsReplace("chrome.send('runTahaiNativeWorkflowStep', [$1, 0, $2]);", fresh->id, missions->missions().back().mutation_token)));
  base::RunLoop().RunUntilIdle();
  EXPECT_EQ("ready", missions->missions().back().steps[0].action_state);
  EXPECT_EQ(count, browser()->tab_strip_model()->count());
}

IN_PROC_BROWSER_TEST_F(TahaiOperationalModeBrowserTest,
                       TahaiActionStatusBindingFollowsRealDispatchAndExplicitCheckpoint) {
  const auto key=crypto::keypair::PrivateKey::GenerateEd25519();SetPublisherPolicy(OperationalTrustPolicy(key));
  const auto archive=SignedOperationalArchive(key,true,base::BindRepeating([](base::DictValue& manifest){
    auto& workflow=manifest.FindDict("operational")->FindList("workflows")->front().GetDict();
    workflow.Set("variables",base::ListValue().Append(base::DictValue().Set("id","outcome").Set("name","Outcome").Set("type","text")));
    workflow.FindList("steps")->Append(base::DictValue().Set("id","capture").Set("name","Record dispatch status").Set("kind","assign-variable")
      .Set("assign",base::DictValue().Set("variable","outcome").Set("from",base::DictValue().Set("action_status","review-step"))));
    workflow.Set("outputs",base::ListValue().Append(base::DictValue().Set("id","result").Set("name","Dispatch status").Set("from",base::DictValue().Set("variable","outcome"))));
  }));
  auto* skins=BrowserService();base::test::TestFuture<SkinOperationResult> result;
  skins->PreviewFile(WriteArchive(archive),result.GetCallback());auto preview=result.Take();ASSERT_EQ(SkinOperationStatus::kOk,preview.status);
  skins->InstallPreview(preview.preview_token,result.GetCallback());ASSERT_EQ(SkinOperationStatus::kOk,result.Take().status);
  skins->PreviewInstalled("decoder-fixture",Hash(archive),false,result.GetCallback());preview=result.Take();ASSERT_EQ(SkinOperationStatus::kOk,preview.status);
  auto* controller=WindowModeController::GetForBrowser(browser());ASSERT_TRUE(controller->ApplyReviewedWindowSkin(preview.preview_token));
  ASSERT_TRUE(controller->SelectOperationalMode("review-mode"));
  ASSERT_TRUE(QueueOperationalWorkflowLaunch(browser()->GetProfile(),controller->operational_manifest()->workflows.front(),"decoder-fixture",Hash(archive)));
  ASSERT_TRUE(chrome::ExecuteCommand(browser(),IDC_TAHAI_MISSION_CONTROL));auto* contents=browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(content::WaitForLoadStop(contents));auto* service=MissionServiceFactory::GetForProfile(browser()->GetProfile());ASSERT_TRUE(service);
  ASSERT_TRUE(content::EvalJs(contents,"document.querySelector('[data-tahai-variable-assign]').disabled").ExtractBool());
  EXPECT_TRUE(content::EvalJs(contents,"document.querySelector('[data-tahai-action-status-binding]').textContent.includes('does not prove')").ExtractBool());
  {
    content::TestNavigationObserver reload(contents,1);
    ASSERT_TRUE(content::ExecJs(contents,"const button=document.querySelector('[data-tahai-native-run]');button.id='status-binding-dispatch';button.scrollIntoView()"));
    content::SimulateMouseClickOrTapElementWithId(contents,"status-binding-dispatch");reload.Wait();ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  EXPECT_EQ("dispatched",service->missions().back().steps[0].action_state);
  EXPECT_TRUE(content::EvalJs(contents,"document.querySelector('[data-tahai-variable-assign]').disabled").ExtractBool());
  for(const char* selector:{"[data-tahai-mission-action=toggle-step][data-tahai-step-index='0']","[data-tahai-variable-assign]","[data-tahai-workflow-state=succeeded]"}) {
    content::TestNavigationObserver reload(contents,1);
    ASSERT_TRUE(content::ExecJs(contents,content::JsReplace("const control=document.querySelector($1);if(control.disabled)throw new Error('Control unexpectedly disabled');control.click()",selector)));
    reload.Wait();ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  EXPECT_EQ("dispatched",content::EvalJs(contents,"document.querySelector('[data-tahai-workflow-output=result]').textContent"));
  EXPECT_EQ("dispatched",service->missions().back().workflow_variables[0].value);
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(),GURL(kTahaiMissionURL)));
  EXPECT_TRUE(content::EvalJs(contents,"document.querySelector('[data-tahai-native-run]').disabled && document.querySelector('[data-tahai-variable-assign]').disabled").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiOperationalModeBrowserTest,
                       TahaiModeActionsAreWindowPinnedAndRevalidatedAtUse) {
  const auto key = crypto::keypair::PrivateKey::GenerateEd25519();
  SetPublisherPolicy(OperationalTrustPolicy(key));
  ASSERT_TRUE(browser()->GetProfile()->GetPrefs()->IsManagedPreference(
      prefs::kTahaiOperationalSkinTrustedKeys));
  const auto archive = SignedOperationalArchive(key);
  auto* service = BrowserService();
  base::test::TestFuture<SkinOperationResult> result;
  service->PreviewFile(WriteArchive(archive), result.GetCallback());
  auto preview = result.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  service->InstallPreview(preview.preview_token, result.GetCallback());
  ASSERT_EQ(SkinOperationStatus::kOk, result.Take().status);
  service->PreviewInstalled("decoder-fixture", Hash(archive), false, result.GetCallback());
  preview = result.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  auto* controller = WindowModeController::GetForBrowser(browser());
  ASSERT_TRUE(controller);
  ASSERT_TRUE(controller->ApplyReviewedWindowSkin(preview.preview_token));
  ASSERT_TRUE(controller->SelectOperationalMode("review-mode"));
  auto actions = ResolveOperationalWindowActions(browser());
  ASSERT_TRUE(actions);
  ASSERT_EQ(2u, actions->actions.size());
  EXPECT_EQ(Hash(archive), actions->context.archive_sha256);
  EXPECT_TRUE(CanExecuteWindowModeAction(browser(), actions->context,
                                        IDC_TAHAI_MISSION_CONTROL));
  EXPECT_FALSE(CanExecuteWindowModeAction(browser(), actions->context, IDC_CLOSE_WINDOW));
  const auto found = FindBrowserItems(browser(), u"mode action");
  const auto mission = std::ranges::find_if(found, [](const auto& item) {
    return item.kind == FinderResult::Kind::kModeAction &&
           item.command_id == IDC_TAHAI_MISSION_CONTROL;
  });
  ASSERT_NE(found.end(), mission);
  FinderResult retained = *mission;
  Browser* sibling = CreateBrowser(browser()->GetProfile());
  EXPECT_FALSE(ActivateFinderResult(sibling, retained));
  EXPECT_FALSE(ResolveOperationalWindowActions(sibling));
  auto forged = retained;
  forged.command_id = IDC_CLOSE_WINDOW;
  EXPECT_FALSE(ActivateFinderResult(browser(), forged));
  ASSERT_TRUE(ActivateFinderResult(browser(), retained));
  auto* mission_contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(content::WaitForLoadStop(mission_contents));
  EXPECT_EQ(GURL(kTahaiTrustedMissionURL), mission_contents->GetLastCommittedURL());
  const auto saved = controller->CapturePresentation();
  ASSERT_TRUE(controller->SetActiveMode("support"));
  EXPECT_FALSE(ActivateFinderResult(browser(), retained));

  // Restoring the presentation verifies the same revision, without executing
  // either declared action or enqueuing the mode's workflow again.
  const int before_restore = browser()->tab_strip_model()->count();
  ASSERT_TRUE(controller->RestorePresentation(saved));
  ASSERT_TRUE(base::test::RunUntil([&] { return !controller->window_skin_restore_pending(); }));
  ASSERT_TRUE(controller->operational_manifest());
  EXPECT_EQ(before_restore, browser()->tab_strip_model()->count());
  EXPECT_TRUE(CanExecuteWindowModeAction(browser(), actions->context,
                                        IDC_TAHAI_MISSION_CONTROL));
  AppMenuModel menu(nullptr, browser());
  menu.Init();
  ASSERT_TRUE(menu.GetIndexOfCommandId(IDC_TAHAI_MISSION_CONTROL));
  EXPECT_FALSE(menu.GetIndexOfCommandId(IDC_TAHAI_COMMAND_CENTER));
  EXPECT_TRUE(menu.IsCommandIdEnabled(IDC_TAHAI_MISSION_CONTROL));

  // One malformed policy entry revokes the entire publisher list. An already
  // visible native menu or retained Finder row cannot outlive that decision.
  auto invalid = OperationalTrustPolicy(key);
  invalid.FindList("keys")->Append(base::DictValue().Set("id", "incomplete"));
  auto* active = browser()->tab_strip_model()->GetActiveWebContents();
  SetPublisherPolicy(invalid);
  EXPECT_FALSE(controller->operational_manifest());
  EXPECT_FALSE(ActivateFinderResult(browser(), retained));
  EXPECT_FALSE(menu.IsCommandIdEnabled(IDC_TAHAI_MISSION_CONTROL));
  menu.ExecuteCommand(IDC_TAHAI_MISSION_CONTROL, 0);
  EXPECT_EQ(active, browser()->tab_strip_model()->GetActiveWebContents());
  EXPECT_EQ(before_restore, browser()->tab_strip_model()->count());
  const auto revoked = ResolveOperationalWindowActions(browser());
  ASSERT_TRUE(revoked);
  EXPECT_TRUE(revoked->actions.empty());
  EXPECT_TRUE(std::ranges::none_of(FindBrowserItems(browser(), u"mode action"),
                                  [](const auto& item) {
    return item.kind == FinderResult::Kind::kModeAction;
  }));
}

IN_PROC_BROWSER_TEST_F(TahaiOperationalModeBrowserTest,
                       TahaiRecommendedPublisherPolicyCannotAuthorizeImport) {
  const auto key = crypto::keypair::PrivateKey::GenerateEd25519();
  SetPublisherPolicy(OperationalTrustPolicy(key), policy::POLICY_LEVEL_RECOMMENDED);
  EXPECT_FALSE(browser()->GetProfile()->GetPrefs()->IsManagedPreference(
      prefs::kTahaiOperationalSkinTrustedKeys));
  base::test::TestFuture<SkinOperationResult> result;
  BrowserService()->PreviewFile(WriteArchive(SignedOperationalArchive(key)),
                                result.GetCallback());
  EXPECT_EQ(SkinOperationStatus::kUntrusted, result.Take().status);
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       TahaiStockRoyalPaletteRespectsExplicitLightAndUserTheme) {
  auto* theme = ThemeServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(theme);
  ASSERT_TRUE(theme->UsingDefaultTheme());
  auto* browser_view = BrowserView::GetBrowserViewForBrowser(browser());
  ASSERT_TRUE(browser_view);

  theme->SetBrowserColorScheme(ThemeService::BrowserColorScheme::kDark);
  EXPECT_EQ(SkColorSetRGB(0x09, 0x06, 0x12),
            browser_view->GetColorProvider()->GetColor(kColorToolbar));
  EXPECT_EQ(SkColorSetRGB(0xf6, 0xf8, 0xff),
            browser_view->GetColorProvider()->GetColor(kColorToolbarText));
  EXPECT_EQ(SkColorSetRGB(0x17, 0x10, 0x26),
            browser_view->GetColorProvider()->GetColor(
                kColorTabBackgroundActiveFrameActive));
  EXPECT_EQ(SkColorSetRGB(0x07, 0x05, 0x0e),
            browser_view->GetColorProvider()->GetColor(
                kColorTabBackgroundInactiveFrameActive));

  theme->SetBrowserColorScheme(ThemeService::BrowserColorScheme::kLight);
  EXPECT_EQ(SK_ColorWHITE,
            browser_view->GetColorProvider()->GetColor(kColorToolbar));

  theme->SetUserColorAndBrowserColorVariant(
      SK_ColorMAGENTA, ui::mojom::BrowserColorVariant::kExpressive);
  // A user-color theme can retain the default ThemeSupplier. Test the actual
  // preference and resulting colors, not the supplier's classification.
  EXPECT_EQ(SK_ColorMAGENTA, theme->GetUserColor());
  theme->SetBrowserColorScheme(ThemeService::BrowserColorScheme::kDark);
  EXPECT_NE(SkColorSetRGB(0x09, 0x06, 0x12),
            browser_view->GetColorProvider()->GetColor(kColorToolbar));
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       TahaiSkinManagerAllModesAndOneWindowPerProfile) {
  auto* mode = WindowModeController::GetForBrowser(browser());
  ASSERT_TRUE(mode);
  for (const auto& definition : ModeService::definitions()) {
    ASSERT_TRUE(mode->SetActiveMode(definition.id));
    for (const char* rail : {"icons", "expanded", "hidden"}) {
      ASSERT_TRUE(mode->SetActiveConfigurationValue("rail_state", rail));
      AppMenuModel menu(nullptr, browser());
      menu.Init();
      const auto index = menu.GetIndexOfCommandId(IDC_TAHAI_SKIN_MANAGER);
      ASSERT_TRUE(index.has_value());
      EXPECT_TRUE(menu.IsEnabledAt(*index));
    }
  }
  ASSERT_TRUE(chrome::ExecuteCommand(browser(), IDC_TAHAI_SKIN_MANAGER));
  auto* manager = Manager(browser());
  ASSERT_TRUE(manager);
  ShowSkinManager(browser());
  EXPECT_EQ(manager, Manager(browser()));
  Browser* second = CreateBrowser(browser()->GetProfile());
  ShowSkinManager(second);
  EXPECT_EQ(manager, Manager(browser()));
  EXPECT_FALSE(Manager(second));
  Browser* private_browser = CreateIncognitoBrowser(browser()->GetProfile());
  EXPECT_FALSE(CanShowSkinManager(private_browser));
  ShowSkinManager(private_browser);
  EXPECT_FALSE(Manager(private_browser));
  manager->CloseNow();
  ShowSkinManager(second);
  ASSERT_TRUE(Manager(second));
  Manager(second)->CloseNow();
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       PRE_TahaiLocalPublisherRevocationSurvivesProcessRestart) {
  const auto key = crypto::keypair::PrivateKey::GenerateEd25519();
  const auto encoded = base::ToLowerASCII(base::HexEncode(crypto::keypair::PublicKey::FromPrivateKey(key).ToEd25519PublicKey()));
  auto* service = BrowserService();
  const auto enrollment = service->ReviewLocalPublisher("fixture-publisher", encoded);
  ASSERT_TRUE(enrollment);
  ASSERT_TRUE(service->EnrollLocalPublisher(*enrollment));
  base::test::TestFuture<void> saved;
  browser()->GetProfile()->GetPrefs()->CommitPendingWrite(saved.GetCallback());
  ASSERT_TRUE(saved.Wait());
  {
    base::ScopedAllowBlockingForTesting allow_blocking;
    ASSERT_TRUE(base::WriteFile(browser()->GetProfile()->GetPath().AppendASCII("revoked-publisher-restart.tahaiskin"), SignedOperationalArchive(key)));
  }
  ASSERT_TRUE(service->RemoveLocalPublisher("fixture-publisher", enrollment->public_key_sha256,
      service->local_publisher_generation()));
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       TahaiLocalPublisherRevocationSurvivesProcessRestart) {
  auto* service = BrowserService();
  const auto keys = service->GetLocalPublishers();
  ASSERT_TRUE(keys);
  EXPECT_TRUE(keys->empty());
  base::test::TestFuture<SkinOperationResult> reply;
  service->PreviewFile(browser()->GetProfile()->GetPath().AppendASCII("revoked-publisher-restart.tahaiskin"), reply.GetCallback());
  EXPECT_EQ(SkinOperationStatus::kUntrusted, reply.Take().status);
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       PRE_TahaiLocalPublisherTrustSurvivesProcessRestart) {
  const auto key = crypto::keypair::PrivateKey::GenerateEd25519();
  const auto encoded = base::ToLowerASCII(base::HexEncode(crypto::keypair::PublicKey::FromPrivateKey(key).ToEd25519PublicKey()));
  auto* service = BrowserService();
  const auto review = service->ReviewLocalPublisher("fixture-publisher", encoded);
  ASSERT_TRUE(review);
  ASSERT_TRUE(service->EnrollLocalPublisher(*review));
  // Only a signed public test archive persists. Never save the private key.
  base::ScopedAllowBlockingForTesting allow_blocking;
  ASSERT_TRUE(base::WriteFile(browser()->GetProfile()->GetPath().AppendASCII("local-publisher-restart.tahaiskin"), SignedOperationalArchive(key)));
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       TahaiLocalPublisherTrustSurvivesProcessRestart) {
  auto* service = BrowserService();
  const auto keys = service->GetLocalPublishers();
  ASSERT_TRUE(keys);
  ASSERT_EQ(1u, keys->size());
  EXPECT_EQ("fixture-publisher", keys->front().key_id);
  EXPECT_TRUE(keys->front().locally_enrolled);
  base::test::TestFuture<SkinOperationResult> reply;
  service->PreviewFile(browser()->GetProfile()->GetPath().AppendASCII("local-publisher-restart.tahaiskin"), reply.GetCallback());
  const auto preview = reply.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  const auto publisher = service->GetPreviewPublisherReview(preview.preview_token);
  ASSERT_TRUE(publisher);
  EXPECT_EQ(keys->front().public_key_sha256, publisher->public_key_sha256);
  EXPECT_TRUE(publisher->locally_enrolled);
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       TahaiNativeLocalPublisherRequiresConfirmationAndSupportsRevocation) {
  const auto key = crypto::keypair::PrivateKey::GenerateEd25519();
  const auto encoded = base::ToLowerASCII(base::HexEncode(crypto::keypair::PublicKey::FromPrivateKey(key).ToEd25519PublicKey()));
  const auto archive = SignedOperationalArchive(key);
  const auto path = WriteArchive(archive);
  ShowSkinManager(browser());
  auto* manager = Manager(browser());
  ASSERT_TRUE(manager);
  auto* publishers = Button(manager, kSkinManagerPublishersElementId);
  ASSERT_TRUE(publishers);
  ASSERT_TRUE(base::test::RunUntil([&] { return publishers->GetEnabled(); }));
  views::test::ButtonTestApi(publishers).NotifyDefaultMouseClick();
  auto* tracker = views::ElementTrackerViews::GetInstance();
  const auto context = views::ElementTrackerViews::GetContextForWidget(manager);
  auto* id = tracker->GetFirstMatchingViewAs<views::Textfield>(kSkinManagerPublisherKeyIdElementId, context, false);
  auto* public_key = tracker->GetFirstMatchingViewAs<views::Textfield>(kSkinManagerPublisherKeyElementId, context, false);
  auto* review = Button(manager, kSkinManagerPublisherReviewKeyElementId);
  ASSERT_TRUE(id);
  ASSERT_TRUE(public_key);
  ASSERT_TRUE(review);
  for (bool confirm : {false, true}) {
    id->SetText(u"fixture-publisher");
    public_key->SetText(base::UTF8ToUTF16(encoded));
    views::test::ButtonTestApi(review).NotifyDefaultMouseClick();
    ASSERT_TRUE(base::test::RunUntil([&] { return Confirmation(u"Trust this local publisher?") != nullptr; }));
    EXPECT_TRUE(BrowserService()->GetLocalPublishers()->empty());
    EXPECT_TRUE(id->GetText().empty());
    EXPECT_TRUE(public_key->GetText().empty());
    auto* dialog = Confirmation(u"Trust this local publisher?")->widget_delegate()->AsDialogDelegate();
    ASSERT_TRUE(dialog);
    if (confirm) dialog->AcceptDialog();
    else dialog->CancelDialog();
    ASSERT_TRUE(base::test::RunUntil([&] { return publishers->GetEnabled(); }));
  }
  ASSERT_EQ(1u, BrowserService()->GetLocalPublishers()->size());
  ASSERT_NO_FATAL_FAILURE(OpenChooser());
  ASSERT_TRUE(factory_->GetLastDialog()->CallFileSelected(path, "tahaiskin"));
  auto* install = Button(manager, kSkinManagerInstallElementId);
  ASSERT_TRUE(base::test::RunUntil([&] { return install->GetEnabled(); }));
  auto* trust = tracker->GetFirstMatchingViewAs<views::Label>(kSkinManagerTrustReviewElementId, context, false);
  ASSERT_TRUE(trust);
  EXPECT_TRUE(trust->GetText().contains(u"explicitly enrolled in this profile"));
  auto* revoke = Button(manager, kSkinManagerPublisherRevokeElementId);
  ASSERT_TRUE(revoke);
  views::test::ButtonTestApi(revoke).NotifyDefaultMouseClick();
  ASSERT_TRUE(base::test::RunUntil([&] { return Confirmation(u"Revoke local publisher trust?") != nullptr; }));
  Confirmation(u"Revoke local publisher trust?")->widget_delegate()->AsDialogDelegate()->AcceptDialog();
  ASSERT_TRUE(base::test::RunUntil([&] { return publishers->GetEnabled(); }));
  EXPECT_TRUE(BrowserService()->GetLocalPublishers()->empty());
  EXPECT_TRUE(trust->GetText().empty());
  EXPECT_FALSE(install->GetEnabled());
  base::test::TestFuture<SkinOperationResult> reply;
  BrowserService()->PreviewFile(path, reply.GetCallback());
  EXPECT_EQ(SkinOperationStatus::kUntrusted, reply.Take().status);
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       TahaiNativeRevisionReviewRequiresCheckboxAndConfirmation) {
  const auto first = Zip(Package({{"assets/preview.png", Png()}}));
  const auto second = Zip(Package({{"assets/preview.png", Png(3, 3)}}));
  base::test::TestFuture<SkinOperationResult> reply;
  BrowserService()->PreviewFile(WriteArchive(first), reply.GetCallback());
  const auto initial = reply.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, initial.status);
  BrowserService()->InstallPreview(initial.preview_token, reply.GetCallback());
  ASSERT_EQ(SkinOperationStatus::kOk, reply.Take().status);
  const auto path = WriteArchive(second);
  ShowSkinManager(browser());
  ASSERT_NO_FATAL_FAILURE(OpenChooser());
  ASSERT_TRUE(factory_->GetLastDialog()->CallFileSelected(path, "tahaiskin"));
  auto* manager = Manager(browser());
  ASSERT_TRUE(manager);
  auto* tracker = views::ElementTrackerViews::GetInstance();
  const auto context = views::ElementTrackerViews::GetContextForWidget(manager);
  auto* summary = tracker->GetFirstMatchingViewAs<views::Label>(kSkinManagerRevisionReviewElementId, context, false);
  auto* diff = tracker->GetFirstMatchingViewAs<views::Textarea>(kSkinManagerRevisionDiffElementId, context, false);
  auto* ack = tracker->GetFirstMatchingViewAs<views::Checkbox>(kSkinManagerRevisionAckElementId, context, false);
  auto* install = Button(manager, kSkinManagerInstallElementId);
  ASSERT_TRUE(summary);
  ASSERT_TRUE(diff);
  ASSERT_TRUE(ack);
  ASSERT_TRUE(install);
  ASSERT_TRUE(base::test::RunUntil([&] { return ack->IsDrawn() && ack->GetEnabled(); }));
  EXPECT_TRUE(summary->GetText().contains(base::UTF8ToUTF16(Hash(first))));
  EXPECT_TRUE(summary->GetText().contains(base::UTF8ToUTF16(Hash(second))));
  EXPECT_TRUE(diff->GetText().contains(u"/assets/0/sha256"));
  EXPECT_TRUE(diff->GetReadOnly());
  EXPECT_FALSE(ack->GetChecked());
  EXPECT_FALSE(install->GetEnabled());
  views::test::ButtonTestApi(ack).NotifyDefaultMouseClick();
  EXPECT_TRUE(ack->GetChecked());
  EXPECT_TRUE(install->GetEnabled());
  views::test::ButtonTestApi(ack).NotifyDefaultMouseClick();
  EXPECT_FALSE(install->GetEnabled());
  views::test::ButtonTestApi(ack).NotifyDefaultMouseClick();
  BrowserService()->List(reply.GetCallback());
  EXPECT_EQ(Hash(first), reply.Take().catalog[0].archive_sha256);
  views::test::ButtonTestApi(install).NotifyDefaultMouseClick();
  views::Widget* confirmation = nullptr;
  ASSERT_TRUE(base::test::RunUntil([&] {
    for (const auto& widget_ptr : views::Widget::GetAllOwnedWidgets(browser()->GetWindow()->GetNativeWindow())) {
      auto* widget = widget_ptr.get();
      if (widget != manager && widget->widget_delegate()->GetWindowTitle() ==
              l10n_util::GetStringUTF16(IDS_TAHAI_SKINS_CONFIRM_STORE)) {
        confirmation = widget;
        return true;
      }
    }
    return false;
  }));
  ASSERT_TRUE(confirmation->widget_delegate()->AsDialogDelegate());
  confirmation->widget_delegate()->AsDialogDelegate()->AcceptDialog();
  auto* import = Button(manager, kSkinManagerImportElementId);
  ASSERT_TRUE(base::test::RunUntil([&] { return import->GetEnabled(); }));
  BrowserService()->List(reply.GetCallback());
  const auto catalog = reply.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, catalog.status);
  ASSERT_EQ(1u, catalog.catalog.size());
  EXPECT_EQ(Hash(second), catalog.catalog[0].archive_sha256);
  EXPECT_TRUE(browser()->GetProfile()->GetPrefs()->GetDict(prefs::kTahaiAppliedSkin).empty());
  EXPECT_TRUE(diff->GetText().empty());
  EXPECT_FALSE(ack->GetChecked());
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       TahaiSkinNativeChooserReviewAndConfirmedInstall) {
  const auto archive = Zip(Package({{"assets/preview.png", Png()}}));
  const auto path = WriteArchive(archive);
  ShowSkinManager(browser());
  ASSERT_NO_FATAL_FAILURE(OpenChooser());
  scoped_refptr<ui::FakeSelectFileDialog> chooser = factory_->GetLastDialog();
  ASSERT_TRUE(chooser->CallFileSelected(path, "tahaiskin"));
  auto* manager = Manager(browser());
  ASSERT_TRUE(manager);
  auto* install = Button(manager, kSkinManagerInstallElementId);
  ASSERT_TRUE(install);
  ASSERT_TRUE(base::test::RunUntil([&] { return install->GetEnabled(); }));
  base::test::TestFuture<SkinOperationResult> result;
  BrowserService()->List(result.GetCallback());
  EXPECT_TRUE(result.Take().catalog.empty());
  // The real native confirm action is required; review alone did not store it.
  views::test::ButtonTestApi(install).NotifyDefaultMouseClick();
  views::Widget* confirmation = nullptr;
  ASSERT_TRUE(base::test::RunUntil([&] {
    for (const auto& widget_ptr : views::Widget::GetAllOwnedWidgets(
             browser()->GetWindow()->GetNativeWindow())) {
      views::Widget* widget = widget_ptr.get();
      if (widget != manager &&
          widget->widget_delegate()->GetWindowTitle() ==
              l10n_util::GetStringUTF16(IDS_TAHAI_SKINS_CONFIRM_STORE)) {
        confirmation = widget;
        return true;
      }
    }
    return false;
  }));
  ASSERT_TRUE(confirmation->widget_delegate()->AsDialogDelegate());
  confirmation->widget_delegate()->AsDialogDelegate()->AcceptDialog();
  auto* import = Button(manager, kSkinManagerImportElementId);
  ASSERT_TRUE(import);
  ASSERT_TRUE(base::test::RunUntil([&] { return import->GetEnabled(); }));
  BrowserService()->List(result.GetCallback());
  auto catalog = result.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, catalog.status);
  ASSERT_EQ(1u, catalog.catalog.size());
  EXPECT_EQ(Hash(archive), catalog.catalog[0].archive_sha256);
  EXPECT_TRUE(browser()
                  ->GetProfile()
                  ->GetPrefs()
                  ->GetDict(prefs::kTahaiSkinSelection)
                  .empty());
  manager->CloseNow();
  // Original input survives both storing and closing the manager.
  base::ScopedAllowBlockingForTesting allow_blocking;
  EXPECT_TRUE(base::PathExists(path));
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       TahaiSkinAppliesAndResetsBrowserColors) {
  const auto archive = Zip(Package({{"assets/preview.png", Png()}}));
  base::test::TestFuture<SkinOperationResult> result;
  BrowserService()->PreviewFile(WriteArchive(archive), result.GetCallback());
  auto preview = result.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  BrowserService()->InstallPreview(preview.preview_token, result.GetCallback());
  ASSERT_EQ(SkinOperationStatus::kOk, result.Take().status);

  ShowSkinManager(browser());
  auto* manager = Manager(browser());
  ASSERT_TRUE(manager);
  auto* review = Button(manager, kSkinManagerReviewElementId);
  ASSERT_TRUE(base::test::RunUntil([&] {
    review = Button(manager, kSkinManagerReviewElementId);
    return review && review->GetEnabled();
  }));
  views::test::ButtonTestApi(review).NotifyDefaultMouseClick();
  auto* apply = Button(manager, kSkinManagerApplyElementId);
  ASSERT_TRUE(base::test::RunUntil([&] {
    apply = Button(manager, kSkinManagerApplyElementId);
    return apply && apply->GetVisible() && apply->GetEnabled();
  }));
  views::test::ButtonTestApi(apply).NotifyDefaultMouseClick();

  ThemeService* theme =
      ThemeServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(theme);
  EXPECT_TRUE(theme->GetUserColor().has_value());
  auto* browser_view = BrowserView::GetBrowserViewForBrowser(browser());
  theme->SetBrowserColorScheme(ThemeService::BrowserColorScheme::kLight);
  EXPECT_EQ(SK_ColorWHITE,
            browser_view->GetColorProvider()->GetColor(kColorToolbar));
  EXPECT_EQ(SkColorSetRGB(0x11, 0x18, 0x27),
            browser_view->GetColorProvider()->GetColor(kColorToolbarText));
  theme->SetBrowserColorScheme(ThemeService::BrowserColorScheme::kDark);
  EXPECT_EQ(SkColorSetRGB(0x11, 0x18, 0x27),
            browser_view->GetColorProvider()->GetColor(kColorToolbar));
  EXPECT_FALSE(browser()
                   ->GetProfile()
                   ->GetPrefs()
                   ->GetDict(prefs::kTahaiAppliedSkin)
                   .empty());

  auto* reset = Button(manager, kSkinManagerResetElementId);
  ASSERT_TRUE(reset);
  views::test::ButtonTestApi(reset).NotifyDefaultMouseClick();
  EXPECT_EQ(std::nullopt, theme->GetUserColor());
  EXPECT_TRUE(browser()
                  ->GetProfile()
                  ->GetPrefs()
                  ->GetDict(prefs::kTahaiAppliedSkin)
                  .empty());
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       TahaiSkinLivePreviewAndExportPreserveCommittedState) {
  auto* service = BrowserService();
  auto* theme = ThemeServiceFactory::GetForProfile(browser()->GetProfile());
  theme->SetUserColorAndBrowserColorVariant(
      SK_ColorMAGENTA, ui::mojom::BrowserColorVariant::kExpressive);
  const auto archive = Zip(Package({{"assets/preview.png", Png()}}));
  base::test::TestFuture<SkinOperationResult> result;
  service->PreviewFile(WriteArchive(archive), result.GetCallback());
  auto preview = result.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  EXPECT_EQ(archive, service->ExportPreview(preview.preview_token));
  EXPECT_TRUE(service->ExportPreview("stale").empty());
  ASSERT_TRUE(service->BeginLivePreview(preview.preview_token));
  EXPECT_TRUE(service->live_preview_active());
  EXPECT_TRUE(service->GetColorSupplier());
  EXPECT_EQ(SK_ColorMAGENTA, theme->GetUserColor());
  EXPECT_TRUE(browser()
                  ->GetProfile()
                  ->GetPrefs()
                  ->GetDict(prefs::kTahaiAppliedSkin)
                  .empty());
  service->EndLivePreview();
  EXPECT_FALSE(service->GetColorSupplier());
  EXPECT_EQ(SK_ColorMAGENTA, theme->GetUserColor());
  ASSERT_TRUE(service->BeginLivePreview(preview.preview_token));
  theme->SetUserColorAndBrowserColorVariant(
      SK_ColorCYAN, ui::mojom::BrowserColorVariant::kExpressive);
  EXPECT_FALSE(service->live_preview_active());
  EXPECT_FALSE(service->GetColorSupplier());
  EXPECT_EQ(SK_ColorCYAN, theme->GetUserColor());
  ASSERT_TRUE(service->BeginLivePreview(preview.preview_token));
  service->ReleasePreview(preview.preview_token);
  EXPECT_FALSE(service->live_preview_active());
  EXPECT_FALSE(service->GetColorSupplier());
  EXPECT_TRUE(service->ExportPreview(preview.preview_token).empty());
  EXPECT_EQ(SK_ColorCYAN, theme->GetUserColor());
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       TahaiWindowSkinApplyKeepsSiblingAndProfileIndependent) {
  auto* service = BrowserService();
  auto* preferences = browser()->GetProfile()->GetPrefs();
  ASSERT_TRUE(service->ApplyBuiltIn("terminal-green"));
  const auto original_profile = preferences->GetDict(prefs::kTahaiAppliedSkin).Clone();
  auto* first = WindowModeController::GetForBrowser(browser());
  ASSERT_TRUE(first);
  Browser* sibling = CreateBrowser(browser()->GetProfile());
  auto* second = WindowModeController::GetForBrowser(sibling);
  ASSERT_TRUE(second);

  const auto archive = Zip(Package({{"assets/preview.png", Png()}}));
  base::test::TestFuture<SkinOperationResult> reply;
  service->PreviewFile(WriteArchive(archive), reply.GetCallback());
  auto preview = reply.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  EXPECT_FALSE(first->ApplyReviewedWindowSkin(preview.preview_token));
  service->InstallPreview(preview.preview_token, reply.GetCallback());
  ASSERT_EQ(SkinOperationStatus::kOk, reply.Take().status);
  ShowSkinManager(browser());
  auto* manager = Manager(browser());
  ASSERT_TRUE(manager);
  views::LabelButton* review = nullptr;
  ASSERT_TRUE(base::test::RunUntil([&] {
    review = Button(manager, kSkinManagerReviewElementId);
    return review && review->GetEnabled();
  }));
  views::test::ButtonTestApi(review).NotifyDefaultMouseClick();
  views::LabelButton* apply = nullptr;
  ASSERT_TRUE(base::test::RunUntil([&] {
    apply = Button(manager, kSkinManagerApplyWindowElementId);
    return apply && apply->GetVisible() && apply->GetEnabled();
  }));
  views::test::ButtonTestApi(apply).NotifyDefaultMouseClick();
  ASSERT_TRUE(first->window_skin_palette());
  EXPECT_FALSE(second->window_skin_palette());
  EXPECT_EQ(original_profile, preferences->GetDict(prefs::kTahaiAppliedSkin));
  auto* theme = ThemeServiceFactory::GetForProfile(browser()->GetProfile());
  theme->SetBrowserColorScheme(ThemeService::BrowserColorScheme::kLight);
  auto* first_view = BrowserView::GetBrowserViewForBrowser(browser());
  EXPECT_EQ(SK_ColorWHITE, first_view->GetColorProvider()->GetColor(kColorToolbar));
  ASSERT_TRUE(base::test::RunUntil([&] { return !service->busy(); }));
  ASSERT_TRUE(service->ApplyBuiltIn("tahai-neon"));
  EXPECT_EQ(SK_ColorWHITE, first_view->GetColorProvider()->GetColor(kColorToolbar));
  EXPECT_TRUE(first->window_skin_palette());
  EXPECT_FALSE(second->window_skin_palette());

  // A second window owns a separate lease. Resetting it does not release the
  // first window's retained immutable appearance.
  ASSERT_TRUE(second->CopyWindowSkinFrom(*first));
  second->ClearWindowSkin();
  EXPECT_TRUE(first->window_skin_palette());
  EXPECT_FALSE(second->window_skin_palette());
  ASSERT_TRUE(base::test::RunUntil([&] { return !service->busy(); }));
  service->Remove("decoder-fixture", Hash(archive), reply.GetCallback());
  ASSERT_EQ(SkinOperationStatus::kOk, reply.Take().status);
  EXPECT_FALSE(first->window_skin_palette());
  EXPECT_EQ("Unavailable skin", first->active_mode_title());
  EXPECT_FALSE(first->operational_manifest());
  first->ClearWindowSkin();
  EXPECT_NE("Unavailable skin", first->active_mode_title());
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       TahaiSkinChangesRetainKeptGeometryAndDetachPresetSettings) {
  auto* service = BrowserService();
  auto* modes = ModeServiceFactory::GetForProfile(browser()->GetProfile());
  auto* first = WindowModeController::GetForBrowser(browser());
  const SurfaceDesign kept{.nodes = {{.pane = 0, .role = "working"}},
                            .rail_dock = "trailing", .keyboard_order = {0}};
  ASSERT_TRUE(modes->CreateNativeCustomMode("Independent appearance",
      {.fixed_mode = "research", .rail_state = "expanded", .rail_width = 340,
       .surface_design = kept}, {"mission.open"}, ""));
  const std::string id = modes->custom_modes().front().id;
  ASSERT_TRUE(modes->SetNativeCustomModeConfiguration(id, "accent", "amber"));
  ASSERT_EQ(browser(), ActivateNativeCustomMode(browser(), id));
  const auto original_definition =
      SerializeTahaiCustomModeDefinition(modes->custom_modes().front());
  const auto saved_preset = first->CapturePresentation();
  Browser* sibling = CreateBrowser(browser()->GetProfile());
  auto* second = WindowModeController::GetForBrowser(sibling);
  ASSERT_EQ(sibling, ActivateNativeCustomMode(sibling, id));

  const auto archive = Zip(Package({{"assets/preview.png", Png()}}));
  base::test::TestFuture<SkinOperationResult> result;
  service->PreviewFile(WriteArchive(archive), result.GetCallback());
  auto preview = result.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  service->InstallPreview(preview.preview_token, result.GetCallback());
  ASSERT_EQ(SkinOperationStatus::kOk, result.Take().status);
  service->PreviewInstalled("decoder-fixture", Hash(archive), false, result.GetCallback());
  preview = result.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  auto transient = kept;
  transient.rail_dock = "leading";
  const auto trial = first->BeginSurfacePreview(transient);
  ASSERT_TRUE(trial);
  ASSERT_TRUE(first->ApplyReviewedWindowSkin(preview.preview_token));
  EXPECT_EQ(kept, first->surface_design());
  EXPECT_FALSE(first->CancelSurfacePreview(*trial));
  EXPECT_TRUE(first->active_custom_mode_id().empty());
  EXPECT_TRUE(first->CapturePresentation().configuration.empty());
  EXPECT_TRUE(first->operational_rail_modules().empty());
  EXPECT_EQ(340, first->active_configuration().rail_width);
  EXPECT_EQ("expanded", first->active_configuration().rail_state);
  ASSERT_TRUE(first->SetActiveConfigurationValue("accent", "azure"));
  EXPECT_EQ("azure", first->active_configuration().accent_id);
  EXPECT_EQ("amber", second->active_configuration().accent_id);
  EXPECT_EQ(id, second->active_custom_mode_id());
  EXPECT_EQ(original_definition,
            SerializeTahaiCustomModeDefinition(modes->custom_modes().front()));

  // Copying appearance preserves the target layout, not the source's trial,
  // and exits the target preset without modifying the saved definition.
  ASSERT_TRUE(second->CopyWindowSkinFrom(*first));
  EXPECT_EQ(kept, second->surface_design());
  EXPECT_TRUE(second->active_custom_mode_id().empty());
  EXPECT_TRUE(second->CapturePresentation().configuration.empty());
  ASSERT_TRUE(second->SetActiveConfigurationValue("density", "compact"));
  EXPECT_TRUE(first->window_skin_palette());
  second->ClearWindowSkin();
  EXPECT_FALSE(second->window_skin_palette());
  EXPECT_EQ(kept, second->surface_design());
  EXPECT_TRUE(first->window_skin_palette());

  ASSERT_TRUE(first->RestorePresentation(saved_preset));
  EXPECT_EQ(id, first->active_custom_mode_id());
  first->ClearWindowSkin();
  EXPECT_EQ(kept, first->surface_design());
  EXPECT_TRUE(first->active_custom_mode_id().empty());
  ASSERT_TRUE(first->SetActiveConfigurationValue("header", "minimal"));
  EXPECT_EQ(original_definition,
            SerializeTahaiCustomModeDefinition(modes->custom_modes().front()));
  EXPECT_EQ(1, browser()->tab_strip_model()->count());
  EXPECT_EQ(1, sibling->tab_strip_model()->count());
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       TahaiWindowSkinTokensAreScopedBoundedAndRevoked) {
  auto* service = BrowserService();
  ASSERT_TRUE(service->ApplyBuiltIn("terminal-green"));
  std::vector<base::UnguessableToken> tokens;
  for (size_t index = 0; index < 32u; ++index) {
    auto token = service->BindActiveSkinToWindow();
    ASSERT_TRUE(token);
    tokens.push_back(*token);
  }
  EXPECT_FALSE(service->BindActiveSkinToWindow());
  EXPECT_FALSE(service_->GetWindowBinding(tokens.front()));  // Another profile.
  EXPECT_FALSE(service->GetWindowBinding(base::UnguessableToken::Create()));
  service->ReleaseWindowBinding(tokens.back());
  ASSERT_TRUE(service->CopyWindowBinding(tokens.front()));
  browser()->GetProfile()->GetPrefs()->SetBoolean(prefs::kTahaiSkinsEnabled, false);
  for (const auto& token : tokens) {
    EXPECT_FALSE(service->GetWindowBinding(token));
  }
  browser()->GetProfile()->GetPrefs()->SetBoolean(prefs::kTahaiSkinsEnabled, true);
  EXPECT_FALSE(service->GetWindowBinding(tokens.front()));
  EXPECT_FALSE(service->CopyWindowBinding(tokens.front()));
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       TahaiSavedWindowRestoreCannotOverrideNewChoiceOrReplay) {
  auto* service = BrowserService();
  auto* first = WindowModeController::GetForBrowser(browser());
  ASSERT_TRUE(first);
  const auto archive = Zip(Package({{"assets/preview.png", Png()}}));
  base::test::TestFuture<SkinOperationResult> result;
  service->PreviewFile(WriteArchive(archive), result.GetCallback());
  auto preview = result.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, preview.status);
  service->InstallPreview(preview.preview_token, result.GetCallback());
  ASSERT_EQ(SkinOperationStatus::kOk, result.Take().status);
  WindowPresentation saved{
      .fixed_mode = "research", .rail_state = "expanded", .rail_width = 340,
      .rail_modules = {"mission", "guard"},
      .skin = WindowSkinReference{"decoder-fixture", Hash(archive)}};
  const auto profile_appearance =
      browser()->GetProfile()->GetPrefs()->GetDict(prefs::kTahaiAppliedSkin).Clone();
  const int original_tab_count = browser()->tab_strip_model()->count();
  ASSERT_TRUE(first->RestorePresentation(saved));
  EXPECT_TRUE(first->window_skin_restore_pending());
  ASSERT_TRUE(base::test::RunUntil([&] { return !first->window_skin_restore_pending(); }));
  EXPECT_TRUE(first->window_skin_palette());
  EXPECT_EQ(saved, first->CapturePresentation());
  EXPECT_EQ(original_tab_count, browser()->tab_strip_model()->count());
  EXPECT_EQ(profile_appearance,
            browser()->GetProfile()->GetPrefs()->GetDict(prefs::kTahaiAppliedSkin));

  // A new fixed-mode selection wins over the still-pending old revision.
  ASSERT_TRUE(first->RestorePresentation(saved));
  ASSERT_TRUE(first->SetActiveMode("support"));
  base::test::TestFuture<std::optional<base::UnguessableToken>> drained;
  service->RestoreWindowSkin("decoder-fixture", Hash(archive), drained.GetCallback());
  const auto drain_token = drained.Take();
  ASSERT_TRUE(drain_token);
  service->ReleaseWindowBinding(*drain_token);
  EXPECT_EQ("support", first->active_mode_id());
  EXPECT_FALSE(first->window_skin_palette());
  EXPECT_FALSE(first->CapturePresentation().skin);

  saved.skin->archive_sha256 = std::string(64, 'a');
  ASSERT_TRUE(first->RestorePresentation(saved));
  ASSERT_TRUE(base::test::RunUntil([&] { return !first->window_skin_restore_pending(); }));
  EXPECT_EQ("Unavailable skin", first->active_mode_title());
  EXPECT_EQ(saved, first->CapturePresentation());
  EXPECT_FALSE(first->operational_manifest());
  Browser* sibling = CreateBrowser(browser()->GetProfile());
  auto* second = WindowModeController::GetForBrowser(sibling);
  ASSERT_TRUE(second);
  ASSERT_TRUE(service->ApplyBuiltIn("terminal-green"));
  EXPECT_FALSE(second->CopyWindowSkinFrom(*first));
  first->ClearWindowSkin();
  EXPECT_NE("Unavailable skin", first->active_mode_title());
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       TahaiBuiltInPalettesApplyAndRespectPolicy) {
  auto* service = BrowserService();
  for (const auto& descriptor : GetTahaiBuiltInSkinCatalog()) {
    SCOPED_TRACE(descriptor.id);
    ASSERT_TRUE(service->ApplyBuiltIn(descriptor.id));
    EXPECT_EQ(!descriptor.is_stock, service->GetColorSupplier() != nullptr);
    if (!descriptor.is_stock) {
      EXPECT_EQ(descriptor.id, *browser()
                                    ->GetProfile()
                                    ->GetPrefs()
                                    ->GetDict(prefs::kTahaiAppliedSkin)
                                    .FindString("id"));
    }
  }
  EXPECT_FALSE(service->ApplyBuiltIn("unknown-palette"));
  browser()->GetProfile()->GetPrefs()->SetBoolean(prefs::kTahaiSkinsEnabled,
                                               false);
  EXPECT_FALSE(service->GetColorSupplier());
  EXPECT_FALSE(service->ApplyBuiltIn("tahai-neon"));
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       PRE_TahaiBuiltInPaletteSurvivesRestart) {
  ASSERT_TRUE(BrowserService()->ApplyBuiltIn("terminal-green"));
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       TahaiBuiltInPaletteSurvivesRestart) {
  ASSERT_TRUE(BrowserService()->GetColorSupplier());
  EXPECT_EQ("terminal-green", *browser()
                                   ->GetProfile()
                                   ->GetPrefs()
                                   ->GetDict(prefs::kTahaiAppliedSkin)
                                   .FindString("id"));
  EXPECT_TRUE(BrowserService()->ResetAppearance());
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       TahaiSkinRemovalAfterCancelStillRetiresAppliedRevision) {
  auto* service = BrowserService();
  const auto archive = Zip(Package({{"assets/preview.png", Png()}}));
  base::test::TestFuture<SkinOperationResult> reply;
  service->PreviewFile(WriteArchive(archive), reply.GetCallback());
  auto review = reply.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, review.status);
  EXPECT_FALSE(service->ApplyPreview(review.preview_token));
  service->InstallPreview(review.preview_token, reply.GetCallback());
  ASSERT_EQ(SkinOperationStatus::kOk, reply.Take().status);
  service->PreviewInstalled("decoder-fixture", Hash(archive), false,
                            reply.GetCallback());
  review = reply.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, review.status);
  ASSERT_TRUE(service->ApplyPreview(review.preview_token));
  service->Remove("decoder-fixture", Hash(archive), reply.GetCallback());
  service->Cancel();  // Models closing/discarding the manager during storage.
  EXPECT_EQ(SkinOperationStatus::kCancelled, reply.Take().status);
  service->List(reply.GetCallback());
  const auto catalog = reply.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, catalog.status);
  EXPECT_TRUE(catalog.catalog.empty());
  EXPECT_FALSE(service->GetColorSupplier());
  EXPECT_FALSE(
      ThemeServiceFactory::GetForProfile(browser()->GetProfile())->GetUserColor());
  EXPECT_TRUE(browser()
                  ->GetProfile()
                  ->GetPrefs()
                  ->GetDict(prefs::kTahaiAppliedSkin)
                  .empty());
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       TahaiSkinPolicyAndExternalColorChangesRetireIdentity) {
  auto* service = BrowserService();
  auto* theme = ThemeServiceFactory::GetForProfile(browser()->GetProfile());
  const auto archive = Zip(Package({{"assets/preview.png", Png()}}));
  base::test::TestFuture<SkinOperationResult> reply;
  service->PreviewFile(WriteArchive(archive), reply.GetCallback());
  auto review = reply.Take();
  ASSERT_EQ(SkinOperationStatus::kOk, review.status);
  service->InstallPreview(review.preview_token, reply.GetCallback());
  ASSERT_EQ(SkinOperationStatus::kOk, reply.Take().status);
  service->PreviewInstalled("decoder-fixture", Hash(archive), false,
                            reply.GetCallback());
  review = reply.Take();
  ASSERT_TRUE(service->ApplyPreview(review.preview_token));
  auto* preferences = browser()->GetProfile()->GetPrefs();
  preferences->SetBoolean(prefs::kTahaiSkinsEnabled, false);
  EXPECT_FALSE(theme->GetUserColor());
  EXPECT_FALSE(service->GetColorSupplier());
  EXPECT_FALSE(service->ApplyPreview(review.preview_token));
  preferences->SetBoolean(prefs::kTahaiSkinsEnabled, true);
  EXPECT_FALSE(theme->GetUserColor());
  service->PreviewInstalled("decoder-fixture", Hash(archive), false,
                            reply.GetCallback());
  review = reply.Take();
  ASSERT_TRUE(service->ApplyPreview(review.preview_token));
  theme->SetUserColorAndBrowserColorVariant(
      SK_ColorMAGENTA, ui::mojom::BrowserColorVariant::kExpressive);
  EXPECT_TRUE(preferences->GetDict(prefs::kTahaiAppliedSkin).empty());
  EXPECT_FALSE(service->GetColorSupplier());
  service->Remove("decoder-fixture", Hash(archive), reply.GetCallback());
  ASSERT_EQ(SkinOperationStatus::kOk, reply.Take().status);
  EXPECT_EQ(SK_ColorMAGENTA, theme->GetUserColor());
}

IN_PROC_BROWSER_TEST_F(TahaiSkinManagerBrowserTest,
                       TahaiSkinChooserRevocationAndCloseDoNotInstall) {
  const auto path = WriteArchive(Zip(Package({{"assets/preview.png", Png()}})));
  ShowSkinManager(browser());
  ASSERT_NO_FATAL_FAILURE(OpenChooser());
  // Changing the master policy destroys authorization for an old chooser.
  browser()->GetProfile()->GetPrefs()->SetBoolean(prefs::kTahaiSkinsEnabled,
                                               false);
  EXPECT_FALSE(factory_->GetLastDialog());
  browser()->GetProfile()->GetPrefs()->SetBoolean(prefs::kTahaiSkinsEnabled, true);
  base::RunLoop().RunUntilIdle();
  ASSERT_NO_FATAL_FAILURE(OpenChooser());
  scoped_refptr<ui::FakeSelectFileDialog> chooser = factory_->GetLastDialog();
  // Global AllowFileSelectionDialogs is rechecked even after a picker opens.
  g_browser_process->local_state()->SetBoolean(
      prefs::kAllowFileSelectionDialogs, false);
  EXPECT_TRUE(chooser->CallFileSelected(path, "tahaiskin"));
  g_browser_process->local_state()->ClearPref(
      prefs::kAllowFileSelectionDialogs);
  base::test::TestFuture<SkinOperationResult> result;
  BrowserService()->List(result.GetCallback());
  EXPECT_TRUE(result.Take().catalog.empty());
  chooser.reset();
  ASSERT_NO_FATAL_FAILURE(OpenChooser());
  Manager(browser())->CloseNow();
  EXPECT_FALSE(factory_->GetLastDialog());
  ShowSkinManager(browser());
  auto* import = Button(Manager(browser()), kSkinManagerImportElementId);
  ASSERT_TRUE(base::test::RunUntil([&] { return import->GetEnabled(); }));
  BrowserService()->List(result.GetCallback());
  EXPECT_TRUE(result.Take().catalog.empty());
}

IN_PROC_BROWSER_TEST_F(TahaiSkinDecoderBrowserTest,
                       TahaiShippedStarterIsActuallyDecodable) {
  const auto archive =
      ui::ResourceBundle::GetSharedInstance().LoadDataResourceString(
          IDR_TAHAI_SKIN_STARTER);
  ASSERT_FALSE(archive.empty());
  const auto decoded = Decode(archive);
  ASSERT_EQ(DecodeOutcome::kDecoded, decoded.outcome);
  ASSERT_TRUE(decoded.skin);
  EXPECT_EQ("starter-skin", decoded.skin->manifest.id);
  ASSERT_EQ(1u, decoded.skin->assets.size());
  EXPECT_EQ(128, decoded.skin->assets.front().bitmap.width());
}

IN_PROC_BROWSER_TEST_F(TahaiSkinDecoderBrowserTest,
                       TahaiSkinSandboxDecodesPngAndWebpWithoutExtraction) {
  const auto webp = gfx::WebpCodec::Encode(MakeBitmap(), 90);
  ASSERT_TRUE(webp);
  const auto archive = Zip(Package(
      {{"assets/preview.png", Png()},
       {"assets/shell.webp", std::string(webp->begin(), webp->end())}}));
  auto result = Decode(archive);
  ASSERT_EQ(DecodeOutcome::kDecoded, result.outcome);
  ASSERT_TRUE(result.skin);
  ASSERT_EQ(2u, result.skin->assets.size());
  EXPECT_EQ(Hash(archive), result.skin->archive_sha256);
  EXPECT_EQ("decoder-fixture", result.skin->manifest.id);
  for (const auto& asset : result.skin->assets) {
    EXPECT_EQ(2, asset.bitmap.width());
    EXPECT_EQ(2, asset.bitmap.height());
    EXPECT_TRUE(asset.bitmap.isImmutable());
  }
  EXPECT_EQ(SK_ColorBLUE, result.skin->assets.front().bitmap.getColor(0, 0));
}

IN_PROC_BROWSER_TEST_F(TahaiSkinDecoderBrowserTest,
                       TahaiSkinSandboxRejectsLiteralPathAliases) {
  const auto valid = Package({{"assets/preview.png", Png()}});
  for (const std::string& path : std::vector<std::string>{
           "assets/../preview.png", "/assets/preview.png",
           "C:/assets/preview.png", "assets/preview.png:payload",
           "assets/con.png", "assets/sub./preview.png", "assets/PREVIEW.png",
           "assets\\preview.png",
           "assets/preview.png" + std::string(1, '\0')}) {
    SCOPED_TRACE(path);
    auto members = valid;
    members[1].path = path;
    ExpectRejected(members, mojom::DecodeStatus::kUnsafeEntry);
  }
}

IN_PROC_BROWSER_TEST_F(
    TahaiSkinDecoderBrowserTest,
    TahaiSkinSandboxRejectsLinksEncryptionAndUnicodeAliases) {
  const auto valid = Package({{"assets/preview.png", Png()}});
  for (uint32_t attributes :
       {0120777u << 16, 0040755u << 16, 0020600u << 16, 0x400u, 0x10u}) {
    auto members = valid;
    members[1].attributes = attributes;
    ExpectRejected(members, mojom::DecodeStatus::kUnsafeEntry);
  }
  auto members = valid;
  members[1].flags = 1;
  ExpectRejected(members, mojom::DecodeStatus::kUnsafeEntry);
  members = valid;
  members[1].method = 12;  // Not store or deflate.
  ExpectRejected(members, mojom::DecodeStatus::kUnsafeEntry);
  members = valid;
  std::string unicode;
  unicode.push_back(1);
  U32(unicode, Crc(members[1].path));
  unicode += members[1].path;
  U16(members[1].extra, 0x7075);
  U16(members[1].extra, unicode.size());
  members[1].extra += unicode;
  ExpectRejected(members, mojom::DecodeStatus::kUnsafeEntry);
}

IN_PROC_BROWSER_TEST_F(TahaiSkinDecoderBrowserTest,
                       TahaiSkinSandboxRejectsDuplicateAndUnexpectedMembers) {
  auto members = Package({{"assets/preview.png", Png()}});
  members.push_back(members[1]);
  ExpectRejected(members, mojom::DecodeStatus::kUnsafeEntry);
  members.back().path = "assets/extra.png";
  ExpectRejected(members, mojom::DecodeStatus::kInvalidInventory);
  members.back().path = "install.js";
  ExpectRejected(members, mojom::DecodeStatus::kUnsafeEntry);
  members = Package({{"assets/preview.png", Png()}});
  members[0].path = "assets/manifest.png";
  ExpectRejected(members, mojom::DecodeStatus::kInvalidManifest);
}

IN_PROC_BROWSER_TEST_F(TahaiSkinDecoderBrowserTest,
                       TahaiSkinSandboxChecksExactRatioSizeCrcAndHash) {
  const auto valid = Package({{"assets/preview.png", Png()}});
  auto members = valid;
  members[1].compressed_size = 1;
  members[1].declared_size = 101;  // Previous floor division accepted this.
  ExpectRejected(members, mojom::DecodeStatus::kExceededLimits);
  members = valid;
  members[1].declared_size = kMaxEncodedAssetBytes + 1;
  ExpectRejected(members, mojom::DecodeStatus::kExceededLimits);
  members = valid;
  members[1].declared_size = members[1].bytes.size() + 1;
  ExpectRejected(members, mojom::DecodeStatus::kInvalidArchive);
  members = valid;
  members[1].checksum = Crc(members[1].bytes) ^ 1;
  ExpectRejected(members, mojom::DecodeStatus::kInvalidArchive);
  members = valid;
  members[1].bytes.back() ^= 1;  // Valid ZIP CRC; manifest digest stays old.
  ExpectRejected(members, mojom::DecodeStatus::kHashMismatch);
}

IN_PROC_BROWSER_TEST_F(TahaiSkinDecoderBrowserTest,
                       TahaiSkinSandboxBoundsActualDeflateExtraction) {
  const auto image = Png();
  auto members = Package({{"assets/preview.png", image}});
  members[1] = DeflatedMember("assets/preview.png", image);
  auto accepted = Decode(Zip(members));
  ASSERT_EQ(DecodeOutcome::kDecoded, accepted.outcome);
  ASSERT_TRUE(accepted.skin);
  EXPECT_EQ(SK_ColorBLUE, accepted.skin->assets[0].bitmap.getColor(0, 0));

  members[1] = DeflatedMember("assets/preview.png",
                              std::string(kMaxEncodedAssetBytes + 1, 'x'));
  ExpectRejected(members, mojom::DecodeStatus::kExceededLimits);
  // A false small central-directory size does not turn a corrupt oversized
  // deflate stream into a successfully admitted image or partial candidate.
  members[1].declared_size = 100;
  auto corrupt = Decode(Zip(members));
  EXPECT_EQ(DecodeOutcome::kRejected, corrupt.outcome);
  EXPECT_FALSE(corrupt.skin);
}

IN_PROC_BROWSER_TEST_F(TahaiSkinDecoderBrowserTest,
                       TahaiSkinSandboxRejectsUntrustedManifestAuthority) {
  auto members = Package({{"assets/preview.png", Png()}});
  auto manifest = Manifest({members[1]});
  manifest.Set("script", "payload.js");
  members[0].bytes = Json(manifest);
  ExpectRejected(members, mojom::DecodeStatus::kInvalidManifest);
  manifest = Manifest({members[1]});
  manifest.FindDict("appearance")
      ->FindDict("light_tokens")
      ->Set("toolbar_foreground", "#ffffff");
  members[0].bytes = Json(manifest);
  ExpectRejected(members, mojom::DecodeStatus::kInvalidManifest);
  members[0].bytes = std::string(kMaxManifestBytes + 1, ' ');
  ExpectRejected(members, mojom::DecodeStatus::kExceededLimits);
}

IN_PROC_BROWSER_TEST_F(
    TahaiSkinDecoderBrowserTest,
    TahaiSkinSandboxRejectsInvalidAnimatedAndOversizedImages) {
  ExpectRejected(Package({{"assets/preview.png", "<svg/>"}}),
                 mojom::DecodeStatus::kInvalidImage);
  ExpectRejected(Package({{"assets/preview.webp", Png()}}),
                 mojom::DecodeStatus::kInvalidImage);
  ExpectRejected(Package({{"assets/preview.png", Png(2049, 1)}}),
                 mojom::DecodeStatus::kInvalidImage);
  const std::vector<gfx::WebpCodec::Frame> frames = {
      {MakeBitmap(2, 2, SK_ColorBLUE), 100},
      {MakeBitmap(2, 2, SK_ColorRED), 100}};
  const auto animated = gfx::WebpCodec::EncodeAnimated(frames, {});
  ASSERT_TRUE(animated);
  ExpectRejected(Package({{"assets/preview.webp",
                           std::string(animated->begin(), animated->end())}}),
                 mojom::DecodeStatus::kInvalidImage);
}

IN_PROC_BROWSER_TEST_F(TahaiSkinDecoderBrowserTest,
                       TahaiSkinSandboxBoundsAggregateDecodedPixels) {
  const auto image = Png(2048, 2048);
  ExpectRejected(Package({{"assets/preview.png", image},
                          {"assets/second.png", image},
                          {"assets/third.png", image}}),
                 mojom::DecodeStatus::kInvalidImage);
}

IN_PROC_BROWSER_TEST_F(TahaiSkinDecoderBrowserTest,
                       TahaiSkinOwnerRejectsIncompatiblePackages) {
  auto members = Package({{"assets/preview.png", Png()}});
  auto manifest = Manifest({members[1]});
  manifest.FindDict("compatibility")->Set("min_chromium_major", 999);
  members[0].bytes = Json(manifest);
  auto result = Decode(Zip(members));
  EXPECT_EQ(DecodeOutcome::kIncompatible, result.outcome);
  EXPECT_FALSE(result.skin);
}

IN_PROC_BROWSER_TEST_F(TahaiSkinDecoderBrowserTest,
                       TahaiSkinOwnerRejectsMalformedUtilityResponses) {
  for (int attack = 0; attack < 8; ++attack) {
    SCOPED_TRACE(attack);
    FakeDecoder fake;
    SkinDecodeSession session(fake.Bind());
    base::test::TestFuture<SkinDecodeResult> future;
    session.Decode("opaque fixture", future.GetCallback());
    ASSERT_TRUE(base::test::RunUntil([&] { return fake.requests == 1; }));
    auto package = FakePackage();
    auto status = mojom::DecodeStatus::kDecoded;
    switch (attack) {
      case 0:
        package.reset();
        break;
      case 1:
        package->assets[0]->width = 0xffffffff;
        break;
      case 2:
        package->assets[0]->pixels = mojo_base::BigBuffer(1);
        break;
      case 3:
        package->assets[0]->path = "assets/con.png";
        break;
      case 4:
        package->manifest_json = "{}";
        break;
      case 5:
        package->assets.push_back(package->assets[0].Clone());
        break;
      case 6:
        package->assets[0]->path = "assets/undeclared.png";
        break;
      case 7:
        status = mojom::DecodeStatus::kInvalidArchive;
        break;
    }
    fake.Reply(status, std::move(package));
    auto result = future.Take();
    EXPECT_EQ(DecodeOutcome::kInvalidResponse, result.outcome);
    EXPECT_FALSE(result.skin);
  }
}

IN_PROC_BROWSER_TEST_F(TahaiSkinDecoderBrowserTest,
                       TahaiSkinOwnerCopiesPixelsAndIsSingleUse) {
  FakeDecoder fake;
  SkinDecodeSession session(fake.Bind());
  base::test::TestFuture<SkinDecodeResult> future;
  session.Decode("opaque fixture", future.GetCallback());
  ASSERT_TRUE(base::test::RunUntil([&] { return fake.requests == 1; }));
  auto package = FakePackage();
  // Retain a writable mapping of the IPC buffer. Changing it after completion
  // must not alter the browser's accepted immutable bitmap.
  constexpr size_t kPixels = 200 * 200 * 4;
  auto handle = mojo::SharedBufferHandle::Create(kPixels);
  ASSERT_TRUE(handle.is_valid());
  auto mapping = handle->Map(kPixels);
  ASSERT_TRUE(mapping);
  auto shared =
      mojo_base::BigBuffer(mojo_base::internal::BigBufferSharedMemoryRegion(
          std::move(handle), kPixels));
  std::ranges::fill(base::span(shared), 0xff);
  package->assets[0]->width = 200;
  package->assets[0]->height = 200;
  package->assets[0]->pixels = std::move(shared);
  fake.Reply(mojom::DecodeStatus::kDecoded, std::move(package));
  auto result = future.Take();
  ASSERT_EQ(DecodeOutcome::kDecoded, result.outcome);
  ASSERT_TRUE(result.skin);
  EXPECT_TRUE(result.skin->assets[0].bitmap.isImmutable());
  EXPECT_EQ(SK_ColorWHITE, result.skin->assets[0].bitmap.getColor(0, 0));
  // Mapping points to exactly kPixels bytes from Map(kPixels) above.
  UNSAFE_BUFFERS(std::memset(mapping.get(), 0, kPixels));
  EXPECT_EQ(SK_ColorWHITE, result.skin->assets[0].bitmap.getColor(0, 0));
  base::test::TestFuture<SkinDecodeResult> again;
  session.Decode("another archive", again.GetCallback());
  EXPECT_EQ(DecodeOutcome::kAlreadyUsed, again.Take().outcome);
  EXPECT_EQ(1, fake.requests);
}

IN_PROC_BROWSER_TEST_F(TahaiSkinDecoderBrowserTest,
                       TahaiSkinOwnerCancellationAndDisconnectCannotPublish) {
  for (bool cancel : {false, true}) {
    FakeDecoder fake;
    auto session = std::make_unique<SkinDecodeSession>(fake.Bind());
    int callbacks = 0;
    session->Decode("opaque fixture",
                    base::BindLambdaForTesting([&](SkinDecodeResult result) {
                      ++callbacks;
                      EXPECT_EQ(cancel ? DecodeOutcome::kCancelled
                                       : DecodeOutcome::kDisconnected,
                                result.outcome);
                      EXPECT_FALSE(result.skin);
                      session.reset();  // Callback may destroy its owner.
                    }));
    ASSERT_TRUE(base::test::RunUntil([&] { return fake.requests == 1; }));
    if (cancel) {
      session->Cancel();
      fake.Reply(mojom::DecodeStatus::kDecoded, FakePackage());
    } else {
      fake.Drop();
    }
    ASSERT_TRUE(base::test::RunUntil([&] { return callbacks == 1; }));
    base::RunLoop().RunUntilIdle();
    EXPECT_EQ(1, callbacks);
  }
}

IN_PROC_BROWSER_TEST_F(TahaiSkinDecoderBrowserTest,
                       TahaiSkinOwnerTimeoutAndInputBoundsFailClosed) {
  const base::test::ScopedRunLoopTimeout timeout(FROM_HERE, base::Seconds(45));
  FakeDecoder fake;
  SkinDecodeSession session(fake.Bind());
  base::test::TestFuture<SkinDecodeResult> future;
  session.Decode("opaque fixture", future.GetCallback());
  ASSERT_TRUE(base::test::RunUntil([&] { return fake.requests == 1; }));
  // Actual browser-owner deadline. No synthetic success or fake clock.
  auto result = future.Take();
  EXPECT_EQ(DecodeOutcome::kTimeout, result.outcome);
  EXPECT_FALSE(result.skin);
  FakeDecoder oversized;
  SkinDecodeSession bounded(oversized.Bind());
  bounded.Decode(std::string(kMaxArchiveBytes + 1, 'x'), future.GetCallback());
  EXPECT_EQ(DecodeOutcome::kInputTooLarge, future.Take().outcome);
  EXPECT_EQ(0, oversized.requests);
}

}  // namespace
}  // namespace tahai::skins
