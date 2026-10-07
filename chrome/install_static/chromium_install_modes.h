// Copyright 2016 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Brand-specific types and constants for Chromium.

#ifndef CHROME_INSTALL_STATIC_CHROMIUM_INSTALL_MODES_H_
#define CHROME_INSTALL_STATIC_CHROMIUM_INSTALL_MODES_H_

#include <array>

#include "build/branding_buildflags.h"
#include "chrome/app/chrome_dll_resource.h"
#include "chrome/common/chrome_icon_resources_win.h"
#include "chrome/install_static/install_constants.h"

namespace install_static {

// The brand-specific company name to be included as a component of the install
// and user data directory paths. May be empty if no such dir is to be used.
#if BUILDFLAG(TAHAI_BRANDING)
inline constexpr wchar_t kCompanyPathName[] = L"TAHAI Web Services";
#else
inline constexpr wchar_t kCompanyPathName[] = L"";
#endif

// The brand-specific product name to be included as a component of the install
// and user data directory paths.
#if BUILDFLAG(TAHAI_BRANDING)
inline constexpr wchar_t kProductPathName[] = L"TAHAI Browser";
#else
inline constexpr wchar_t kProductPathName[] = L"Chromium";
#endif

// The brand-specific safe browsing client name.
#if BUILDFLAG(TAHAI_BRANDING)
inline constexpr char kSafeBrowsingName[] = "tahai-browser";
#else
inline constexpr char kSafeBrowsingName[] = "chromium";
#endif

// Note: This list of indices must be kept in sync with the brand-specific
// resource strings in chrome/installer/util/prebuild/create_string_rc.
enum InstallConstantIndex {
  CHROMIUM_INDEX,
  NUM_INSTALL_MODES,
};

inline constexpr auto kOldTracingServiceIids = std::to_array<IID>({
#if BUILDFLAG(TAHAI_BRANDING)
    // Previous TAHAI string-channel tracing ABI. Retain for two years.
    {0x5df5fc8a,
     0x5921,
     0x5a3d,
     {0x84, 0x47, 0x36, 0x7a, 0xea, 0xf4, 0xb8, 0x15}},
#else
    // Replaced in 2026-09. Delete after 2028-09.
    // {A3FD580A-FFD4-4075-9174-75D0B199D3CB}
    {0xa3fd580a,
     0xffd4,
     0x4075,
     {0x91, 0x74, 0x75, 0xd0, 0xb1, 0x99, 0xd3, 0xcb}},
#endif
});

inline constexpr auto kInstallModes = std::to_array<InstallConstants>({
    // The primary (and only) install mode for Chromium.
    {
        .size = sizeof(InstallConstants),
        .index = CHROMIUM_INDEX,  // The one and only mode for Chromium.
        .install_switch =
            "",  // No install switch for the primary install mode.
        .install_suffix =
            L"",  // Empty install_suffix for the primary install mode.
        .logo_suffix = L"",  // No logo suffix for the primary install mode.
        .app_guid =
            L"",  // Empty app_guid since no integration with Google Update.
#if BUILDFLAG(TAHAI_BRANDING)
        .base_app_name = L"TAHAI Browser",
        .base_app_id = L"TAHAI.Browser",
        .browser_prog_id_prefix = L"TAHAIHTM",
        .browser_prog_id_description = L"TAHAI Browser HTML Document",
        .direct_launch_url_scheme = "tahai-browser",
        .pdf_prog_id_prefix = L"TAHAIPDF",
        .pdf_prog_id_description = L"TAHAI Browser PDF Document",
        .active_setup_guid = L"{DF75B433-1691-5230-B9E4-11C8EE8A842D}",
        .toast_activator_clsid = {0xC5B6E74A,
                                  0xACE3,
                                  0x5F9E,
                                  {0xA0, 0x62, 0x5B, 0xA0, 0xF3, 0x1A, 0xED,
                                   0xAF}},
        .elevator_clsid = {0xB79472FC,
                           0x4AB5,
                           0x5094,
                           {0x88, 0x22, 0xF4, 0xD5, 0x92, 0x88, 0x30, 0xB0}},
        .elevator_iid = {0x8D296EFE,
                         0x0DBF,
                         0x5BC7,
                         {0x9A, 0x25, 0x55, 0x82, 0x3F, 0x18, 0x6D, 0x24}},
        .tracing_service_clsid = {0xEDC64288,
                                  0x10BC,
                                  0x5A45,
                                  {0x9F, 0x64, 0x77, 0x18, 0xE9, 0x83, 0x38,
                                   0xAD}},
        // Chromium 152.0.7977.158 uses a handle-based invitation ABI.
        // Match the reviewed TAHAI IID for this exact interface; CLSID is
        // stable.
        .tracing_service_iid = {0xE91BA5EB,
                                0x59CF,
                                0x50E3,
                                {0x8B, 0xC8, 0x17, 0x5F, 0xE3, 0x6F, 0x3E,
                                 0x79}},
        .old_tracing_service_iids = kOldTracingServiceIids,
#else
        .base_app_name = L"Chromium",              // A distinct base_app_name.
        .base_app_id = L"Chromium",                // A distinct base_app_id.
        .browser_prog_id_prefix = L"ChromiumHTM",  // Browser ProgID prefix.
        .browser_prog_id_description =
            L"Chromium HTML Document",  // Browser ProgID description.
        .direct_launch_url_scheme = "chromium",
        .pdf_prog_id_prefix = L"ChromiumPDF",  // PDF ProgID prefix.
        .pdf_prog_id_description =
            L"Chromium PDF Document",  // PDF ProgID description.
        .active_setup_guid =
            L"{7D2B3E1D-D096-4594-9D8F-A6667F12E0AC}",  // Active Setup
                                                        // GUID.
        .toast_activator_clsid = {0x635EFA6F,
                                  0x08D6,
                                  0x4EC9,
                                  {0xBD, 0x14, 0x8A, 0x0F, 0xDE, 0x97, 0x51,
                                   0x59}},  // Toast Activator CLSID.
        .elevator_clsid = {0xD133B120,
                           0x6DB4,
                           0x4D6B,
                           {0x8B, 0xFE, 0x83, 0xBF, 0x8C, 0xA1, 0xB1,
                            0xB0}},  // Elevator CLSID.
        .elevator_iid = {0xbb19a0e5,
                         0xc6,
                         0x4966,
                         {0x94, 0xb2, 0x5a, 0xfe, 0xc6, 0xfe, 0xd9,
                          0x3a}},  // IElevator IID and TypeLib
        // {BB19A0E5-00C6-4966-94B2-5AFEC6FED93A}.
        .old_elevator_iids = {},
        .tracing_service_clsid = {0x83f69367,
                                  0x442d,
                                  0x447f,
                                  {0x8b, 0xcc, 0x0e, 0x3f, 0x97, 0xbe, 0x9c,
                                   0xf2}},  // SystemTraceSession CLSID.
        .tracing_service_iid = {0xe0b03e2d,
                                0x7682,
                                0x4d83,
                                {0xb9, 0xff, 0x45, 0x74, 0xaf, 0x72, 0x05,
                                 0x00}},  // ISystemTraceSessionChromium IID and
                                          // TypeLib
        .old_tracing_service_iids = kOldTracingServiceIids,
#endif
        .default_channel_name =
            L"",  // Empty default channel name since no update integration.
        .channel_strategy = ChannelStrategy::UNSUPPORTED,
        .supports_system_level = true,  // Supports system-level installs.
        .supports_set_as_default_browser =
            true,  // Supports in-product set as default browser UX.
        .app_icon_resource_index =
            icon_resources::kApplicationIndex,  // App icon resource index.
        .app_icon_resource_id = IDR_MAINFRAME,  // App icon resource id.
        .html_doc_icon_resource_index =
            icon_resources::kHtmlDocIndex,  // HTML doc icon resource index.
        .pdf_doc_icon_resource_index =
            icon_resources::kPDFDocIndex,  // PDF doc icon resource index.
        .sandbox_sid_prefix =
            L"S-1-15-2-3251537155-1984446955-2931258699-841473695-"
            L"1938553385-"
            L"924012148-",  // App container sid prefix for sandbox.
    },
});

}  // namespace install_static

#endif  // CHROME_INSTALL_STATIC_CHROMIUM_INSTALL_MODES_H_
