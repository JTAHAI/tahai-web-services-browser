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
#include "base/location.h"
#include "base/run_loop.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/task/thread_pool/thread_pool_instance.h"
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
#include "chrome/browser/themes/theme_service.h"
#include "chrome/browser/themes/theme_service_factory.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_commands.h"
#include "chrome/browser/ui/browser_window.h"
#include "chrome/browser/ui/color/chrome_color_id.h"
#include "chrome/browser/ui/tahai/tahai_mode_service.h"
#include "chrome/browser/ui/tahai/tahai_skin_manager.h"
#include "chrome/browser/ui/tahai/tahai_window_mode_controller.h"
#include "chrome/browser/ui/toolbar/app_menu_model.h"
#include "chrome/browser/ui/views/frame/browser_view.h"
#include "chrome/common/pref_names.h"
#include "chrome/common/tahai_skins/skin_limits.h"
#include "chrome/common/tahai_skins/tahai_skin_catalog.h"
#include "chrome/grit/browser_resources.h"
#include "chrome/grit/generated_resources.h"
#include "chrome/test/base/in_process_browser_test.h"
#include "chrome/test/base/testing_profile.h"
#include "components/prefs/pref_service.h"
#include "components/sync_preferences/testing_pref_service_syncable.h"
#include "content/public/test/browser_test.h"
#include "crypto/sha2.h"
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
#include "ui/views/interaction/element_tracker_views.h"
#include "ui/views/test/button_test_api.h"
#include "ui/views/widget/widget.h"
#include "ui/views/window/dialog_delegate.h"

namespace tahai::skins {
namespace {

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
  raw_ptr<ui::FakeSelectFileDialog::Factory> factory_ = nullptr;
};

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
