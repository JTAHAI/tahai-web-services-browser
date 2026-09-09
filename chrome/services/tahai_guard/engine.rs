// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

use adblock::filters::cosmetic::{CosmeticFilter, CosmeticFilterMask};
use adblock::lists::{FilterSet, ParseOptions, RuleTypes};
use adblock::request::Request;
use adblock::url_parser::{set_domain_resolver, ResolvesDomain};
use adblock::Engine;
use std::collections::BTreeSet;
use std::sync::Once;

#[cxx::bridge(namespace = "tahai::guard::ffi")]
mod ffi {
    enum CompileStatus {
        Ready,
        NoRules,
        InputTooLarge,
        InvalidInput,
    }

    enum MatchResult {
        Allow,
        Block,
        InvalidRequest,
        NotConfigured,
    }

    unsafe extern "C++" {
        include!("chrome/services/tahai_guard/domain_resolver.h");
        #[namespace = "tahai::guard"]
        fn RegistrableDomainStart(host: &str) -> usize;
    }

    extern "Rust" {
        type FilterEngine;
        fn compile_engine(rules: &str) -> Box<FilterEngine>;
        fn status(self: &FilterEngine) -> CompileStatus;
        fn accepted_rules(self: &FilterEngine) -> u32;
        fn ignored_rules(self: &FilterEngine) -> u32;
        fn check(self: &FilterEngine, url: &str, origin: &str, kind: &str) -> MatchResult;
        fn cosmetic_selectors(self: &FilterEngine, url: &str) -> Vec<String>;
    }
}

const MAX_BYTES: usize = 4 * 1024 * 1024;
const MAX_LINES: usize = 150_000;
const MAX_LINE_BYTES: usize = 8192;
const MAX_URL_BYTES: usize = 8192;

struct ChromiumDomains;

impl ResolvesDomain for ChromiumDomains {
    fn get_host_domain(&self, host: &str) -> (usize, usize) {
        let start = ffi::RegistrableDomainStart(host);
        if start > host.len() || !host.is_char_boundary(start) {
            return (0, host.len());
        }
        (start, host.len())
    }
}

pub struct FilterEngine {
    engine: Option<Engine>,
    status: ffi::CompileStatus,
    accepted: u32,
    ignored: u32,
    classes: Vec<String>,
    ids: Vec<String>,
}

// Network decisions and declarative hiding selectors only. No replacements,
// scriptlets, style actions, CSP changes, URL rewrites, deserialization or
// debug strings cross this boundary. The host owns a remote, never a Rust
// pointer.
fn compile_engine(rules: &str) -> Box<FilterEngine> {
    let mut result = Box::new(FilterEngine {
        engine: None,
        status: ffi::CompileStatus::NoRules,
        accepted: 0,
        ignored: 0,
        classes: Vec::new(),
        ids: Vec::new(),
    });
    if rules.len() > MAX_BYTES {
        result.status = ffi::CompileStatus::InputTooLarge;
        return result;
    }
    // Validate the complete input before constructing a partially usable set.
    let mut lines = 0;
    for line in rules.lines() {
        lines += 1;
        if lines > MAX_LINES || line.len() > MAX_LINE_BYTES {
            result.status = ffi::CompileStatus::InputTooLarge;
            return result;
        }
        if line.bytes().any(|b| b == 0 || (b < 0x20 && b != b'\t')) {
            result.status = ffi::CompileStatus::InvalidInput;
            return result;
        }
    }

    static RESOLVER: Once = Once::new();
    RESOLVER.call_once(|| {
        // This is the only resolver installed in a Guard utility process.
        // The engine is never linked into the browser process.
        let _ = set_domain_resolver(Box::new(ChromiumDomains));
    });
    let mut filters = FilterSet::new(false);
    let mut classes = BTreeSet::new();
    let mut ids = BTreeSet::new();
    for line in rules.lines().map(str::trim) {
        if line.is_empty() || line.starts_with('!') || line.starts_with("[Adblock") {
            continue;
        }
        // These options have side effects beyond a block/allow decision. Do not
        // silently reinterpret them as ordinary blocking rules.
        let has_unsupported_options = line.rsplit_once('$').is_some_and(|(_, options)| {
            options.split(',').any(|option| {
                let key = option.trim().split('=').next().unwrap_or("").trim_start_matches('~');
                matches!(
                    key,
                    "redirect"
                        | "redirect-rule"
                        | "rewrite"
                        | "removeparam"
                        | "csp"
                        | "replace"
                        | "urltransform"
                        | "header"
                        | "permissions"
                        | "cookie"
                )
            })
        });
        // Admit only declarative element-hiding selectors. No actions,
        // scriptlets, injected resources or procedural operators are exposed.
        let cosmetic = line.contains("##") || line.contains("#@#");
        if ["#?#", "#@?#", "#$#", "#$?#", "#@$#", "#%#", "#@%#"].iter().any(|m| line.contains(m)) {
            result.ignored += 1;
            continue;
        }
        if cosmetic {
            let Ok(parsed) = CosmeticFilter::parse(line, false, Default::default()) else {
                result.ignored += 1;
                continue;
            };
            let Some(selector) = parsed.plain_css_selector() else {
                result.ignored += 1;
                continue;
            };
            if parsed.action.is_some()
                || parsed.mask.contains(CosmeticFilterMask::SCRIPT_INJECT)
                || !safe_selector(selector)
            {
                result.ignored += 1;
                continue;
            }
            // Query the engine's generic index once per document. CSS applies
            // to later DOM mutations too, without a page-observing script.
            if let Some(first) = selector.as_bytes().first() {
                if *first == b'.' || *first == b'#' {
                    let key: String = selector[1..]
                        .chars()
                        .take_while(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
                        .collect();
                    if !key.is_empty() {
                        if *first == b'.' {
                            classes.insert(key);
                        } else {
                            ids.insert(key);
                        }
                    }
                }
            }
        }
        if (!cosmetic && has_unsupported_options)
            || filters
                .add_filter(line, ParseOptions { rule_types: RuleTypes::All, ..Default::default() })
                .is_err()
        {
            result.ignored += 1;
        } else {
            result.accepted += 1;
        }
    }
    if result.accepted > 0 {
        result.classes = classes.into_iter().collect();
        result.ids = ids.into_iter().collect();
        result.engine = Some(Engine::from_filter_set(filters, true));
        result.status = ffi::CompileStatus::Ready;
    }
    result
}

fn safe_selector(selector: &str) -> bool {
    !selector.is_empty()
        && selector.len() <= 2048
        && !selector.contains("/*")
        && !selector.contains("*/")
        && !selector
            .bytes()
            .any(|c| c < 32 || c == 127 || matches!(c, b'{' | b'}' | b';' | b'@' | b'\\'))
}

impl FilterEngine {
    fn cosmetic_selectors(&self, url: &str) -> Vec<String> {
        let Some(engine) = &self.engine else {
            return Vec::new();
        };
        if url.len() > MAX_URL_BYTES || !(url.starts_with("https://") || url.starts_with("http://"))
        {
            return Vec::new();
        }
        let resources = engine.url_cosmetic_resources(url);
        let mut selectors: BTreeSet<String> = resources.hide_selectors.into_iter().collect();
        if !resources.generichide {
            selectors.extend(engine.hidden_class_id_selectors(
                &self.classes,
                &self.ids,
                &resources.exceptions,
            ));
        }
        // These bounds are enforced again by the browser and renderer. An
        // oversized result fails as a whole, rather than dropping exceptions.
        selectors.retain(|s| safe_selector(s));
        if selectors.len() > 16384 || selectors.iter().map(|s| s.len()).sum::<usize>() > 512 * 1024
        {
            return Vec::new();
        }
        selectors.into_iter().collect()
    }
    fn status(&self) -> ffi::CompileStatus {
        self.status
    }
    fn accepted_rules(&self) -> u32 {
        self.accepted
    }
    fn ignored_rules(&self) -> u32 {
        self.ignored
    }

    fn check(&self, url: &str, origin: &str, kind: &str) -> ffi::MatchResult {
        let Some(engine) = &self.engine else {
            return ffi::MatchResult::NotConfigured;
        };
        if url.len() > MAX_URL_BYTES
            || origin.len() > MAX_URL_BYTES
            || !(url.starts_with("https://") || url.starts_with("http://"))
            || !(origin.is_empty()
                || origin.starts_with("https://")
                || origin.starts_with("http://"))
        {
            return ffi::MatchResult::InvalidRequest;
        }
        let Ok(request) = Request::new(url, origin, kind) else {
            return ffi::MatchResult::InvalidRequest;
        };
        if engine.check_network_request(&request).matched {
            ffi::MatchResult::Block
        } else {
            ffi::MatchResult::Allow
        }
    }
}
