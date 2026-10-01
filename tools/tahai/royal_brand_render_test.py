# Copyright 2026 TAHAI Web Services
# SPDX-License-Identifier: Apache-2.0
"""Render actual source CSS in isolated stock Edge, not a TAHAI release gate."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import tempfile
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
UI = (ROOT / 'chrome/browser/ui/webui/tahai/tahai_ui.cc').read_text(encoding='utf-8')


def literal(text, symbol):
    match = re.search(r'\b' + re.escape(symbol) + r'\[\] = R"TAHAI\(([\s\S]*?)\)TAHAI"', text)
    if not match:
        raise ValueError('Missing actual stylesheet: ' + symbol)
    return match[1]


CSS = ''.join(literal(UI, name) for name in (
    'kSharedCss', 'kModeCss', 'kModeActionCss', 'kModeSignatureCss', 'kLocalOiCss',
    'kLocalOiSearchCss', 'kLocalOiGraphExplorerCss', 'kLocalOiControlCss',
    'kLocalOiCapabilityCss', 'kRoyalDefaultCss'))
CSS += literal((ROOT / 'chrome/browser/ui/webui/tahai/tahai_royal_brand.h').read_text(encoding='utf-8'), 'kRoyalBrandCss')
CSP_SOURCE = UI.split('TahaiPlaceholderSource::GetContentSecurityPolicy(', 1)[1].split('TahaiUI::TahaiUI', 1)[0]
CSP = ' '.join(re.findall(r'return "([^"\n]+;)";', CSP_SOURCE))
SCRIPT = r"""
const checks=[];
const color=(selector,property)=>getComputedStyle(document.querySelector(selector))[property];
const verify=(name,value)=>{checks.push({name,pass:!!value});};
const body=document.body;
if(!new URLSearchParams(location.search).has('forced'))for(const mode of ['daily','creator','builder','operator','research','support']){
 body.className='theme-dark mode-'+mode+' accent-mode surface-mode';
 verify(mode+' Royal canvas',color('body','backgroundColor')==='rgb(7, 5, 14)');
 verify(mode+' Royal primary text',color('.button.primary','color')==='rgb(27, 9, 46)');
 verify(mode+' Royal OI panel',color('.oi-state-card','backgroundColor')==='rgba(20, 13, 32, 0.91)');
 verify(mode+' exact unmasked mark',color('.brand .mark','borderRadius')==='0px');
 verify(mode+' danger distinguishable',color('.button.danger','backgroundColor')==='rgb(49, 19, 33)');
 body.className='theme-light mode-'+mode+' accent-mode surface-mode';
 verify(mode+' explicit light retained',color('body','backgroundColor')!=='rgb(7, 5, 14)'&&color('.button.primary','color')!=='rgb(27, 9, 46)');
 body.className='theme-dark mode-'+mode+' accent-azure surface-mode';
 verify(mode+' explicit accent retained',getComputedStyle(body).getPropertyValue('--mode-accent').trim()==='#3d7ea6');
 body.className='theme-dark mode-'+mode+' accent-mode surface-quiet';
 verify(mode+' explicit surface retained',color('body','backgroundImage').includes('rgb(14, 21, 28)'));
}
if(new URLSearchParams(location.search).has('forced')){
 verify('forced colors actually enabled',matchMedia('(forced-colors: active)').matches);
 body.className='theme-dark mode-daily accent-mode surface-mode';
 const probe=document.createElement('div');probe.style.color='CanvasText';body.append(probe);
 verify('forced colors text retained',color('body','color')===getComputedStyle(probe).color);
 verify('forced decoration removed',getComputedStyle(document.querySelector('.hero'),'::before').display==='none');
}
document.body.textContent='';const out=document.createElement('pre');out.id='result';out.textContent=JSON.stringify(checks);document.body.append(out);
"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        csp = None
        if self.path == '/csp.css':
            data = CSS.encode()
            content_type = 'text/css'
        elif self.path == '/csp.js':
            data = ('window.sent=[];window.chrome={send:(name,args)=>sent.push({name,args})};' +
                    literal(UI, 'kActionsJs')).encode()
            content_type = 'text/javascript'
        elif self.path == '/csp':
            data = ('<!doctype html><html><meta charset="utf-8"><link rel="stylesheet" href="/csp.css">'
                    '<body class="theme-dark mode-daily accent-mode surface-mode">'
                    '<button id="opener">Open commands</button>' + literal(UI, 'kCommandPaletteHtml') +
                    '<script src="/csp.js"></script></body></html>').encode()
            content_type = 'text/html; charset=utf-8'
            csp = CSP
        elif self.path.startswith('/brand.png'):
            data = (ROOT / 'chrome/app/theme/tahai/brand/royal_mark_512.png').read_bytes()
            content_type = 'image/png'
        elif self.path.startswith('/commands'):
            data = ('<!doctype html><html><meta charset="utf-8"><style>' + CSS +
                    '</style><body class="theme-dark mode-daily accent-mode surface-mode">'
                    '<button id="opener">Return focus here</button>' + literal(UI, 'kCommandPaletteHtml') +
                    '<script>window.sent=[];window.chrome={send:(name,args)=>sent.push({name,args})};</script>'
                    '<script>' + literal(UI, 'kActionsJs') + '</script></body></html>').encode()
            content_type = 'text/html; charset=utf-8'
        else:
            data = ('<!doctype html><html><meta charset="utf-8"><style>' + CSS +
                    '</style><body><header><div class="brand"><img class="mark" src="/brand.png"></div></header>'
                    '<section class="hero"><h2>THE Operational Browser. <span class="brand-tagline">For Everyone.</span></h2></section>'
                    '<button class="button primary">Search</button><button class="button danger">Remove</button>'
                    '<article class="oi-state-card">Local OI</article><script>' + SCRIPT + '</script></body></html>').encode()
            content_type = 'text/html; charset=utf-8'
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        if csp:
            self.send_header('Content-Security-Policy', csp)
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *_):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--edge', type=Path, default=Path('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'))
    args = parser.parse_args()
    if not args.edge.is_file():
        raise SystemExit('Explicit stock Edge executable required for source CSS rendering')
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    checks = []
    try:
        with sync_playwright() as playwright:
            # Unique profile prevents all reuse of Justin's Edge/TAHAI profile.
            with tempfile.TemporaryDirectory(prefix='royal-css-', dir=ROOT / 'out', ignore_cleanup_errors=True) as profile:
                context = playwright.chromium.launch_persistent_context(
                    profile, executable_path=str(args.edge), headless=True, timeout=30000,
                    args=['--disable-background-networking', '--disable-extensions'])
                try:
                    page = context.new_page()
                    for forced in (False, True):
                        page.emulate_media(forced_colors='active' if forced else 'none')
                        page.goto(f'http://127.0.0.1:{server.server_port}/' + ('?forced=1' if forced else ''), timeout=20000)
                        selected = json.loads(page.locator('#result').inner_text(timeout=10000))
                        if not selected:
                            raise SystemExit('Zero renderer checks selected')
                        checks.extend(selected)
                    page.emulate_media(forced_colors='none')
                    page.goto(f'http://127.0.0.1:{server.server_port}/commands', timeout=20000)
                    opener = page.locator('#opener')
                    opener.focus()
                    page.keyboard.press('Control+Shift+Space')
                    checks.append({'name': 'palette opens and focuses search', 'pass': page.locator('#tahai-palette-input').evaluate('(node)=>node===document.activeElement')})
                    page.locator('#tahai-palette-input').fill('quad')
                    page.keyboard.press('ArrowDown')
                    checks.append({'name': 'Down chooses first filtered command', 'pass': page.evaluate("document.activeElement.dataset.tahaiPaletteCommand==='quad.open'")})
                    page.keyboard.press('ArrowUp')
                    checks.append({'name': 'Up wraps across visible commands', 'pass': page.evaluate("document.activeElement.dataset.tahaiPaletteCommand==='quad.exit'")})
                    page.keyboard.press('Home')
                    checks.append({'name': 'Home chooses first command', 'pass': page.evaluate("document.activeElement.dataset.tahaiPaletteCommand==='quad.open'")})
                    page.keyboard.press('End')
                    checks.append({'name': 'End chooses last command', 'pass': page.evaluate("document.activeElement.dataset.tahaiPaletteCommand==='quad.exit'")})
                    page.keyboard.press('Escape')
                    page.wait_for_function("() => document.activeElement.id==='opener'")
                    checks.append({'name': 'Escape restores opener focus without dispatch', 'pass': page.evaluate('sent.length===0')})
                    page.keyboard.press('Control+Shift+Space')
                    page.locator('#tahai-palette-input').fill('not-a-command')
                    page.keyboard.press('Enter')
                    checks.append({'name': 'empty palette cannot dispatch', 'pass': page.evaluate("sent.length===0 && document.querySelector('#tahai-command-palette').open")})
                    checks.append({'name': 'no-match status is visible', 'pass': 'No matching commands' in page.locator('#tahai-palette-status').inner_text()})
                    page.locator('#tahai-palette-input').fill('quad')
                    page.keyboard.press('Enter')
                    checks.append({'name': 'Enter explicitly dispatches one filtered native command', 'pass': page.evaluate("sent.length===1 && sent[0].name==='executeTahaiCommand' && sent[0].args[0]==='quad.open' && !document.querySelector('#tahai-command-palette').open")})
                    page.goto(f'http://127.0.0.1:{server.server_port}/csp', timeout=20000)
                    page.locator('#opener').focus()
                    page.keyboard.press('Control+Shift+Space')
                    checks.append({'name': 'packaged command script loads under actual source CSP', 'pass': page.locator('#tahai-command-palette').evaluate('(node)=>node.open')})
                    checks.append({'name': 'Royal stylesheet loads under actual source CSP', 'pass': page.evaluate("getComputedStyle(document.body).backgroundColor==='rgb(7, 5, 14)'")})
                    page.evaluate("window.violations=[];document.addEventListener('securitypolicyviolation',event=>violations.push(event.effectiveDirective));")
                    rejected = page.evaluate("async()=>{try{await fetch('data:text/plain,forbidden');return false}catch{return true}}")
                    # Poll a function, not an expression that Playwright's
                    # page-world predicate evaluates with eval(). The actual
                    # production CSP must remain intact during this check.
                    page.wait_for_function("() => violations.includes('connect-src')", timeout=5000)
                    checks.append({'name': 'renderer fetch rejected by connect-src', 'pass': rejected})
                    base_uri = page.evaluate('document.baseURI')
                    page.evaluate("const base=document.createElement('base');base.href='https://replacement.invalid/';document.head.append(base);")
                    page.wait_for_function("() => violations.includes('base-uri')", timeout=5000)
                    checks.append({'name': 'resource base cannot be replaced', 'pass': page.evaluate('document.baseURI') == base_uri})
                finally:
                    context.close()
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=5)
    failures = [check['name'] for check in checks if not check['pass']]
    print(json.dumps({'checks': len(checks), 'failed': failures, 'engine': str(args.edge),
                      'scope': 'source CSS/command/CSP render only; not TAHAI runtime acceptance'}, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
