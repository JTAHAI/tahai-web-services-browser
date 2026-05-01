import fs from 'node:fs';

const failures = [];
const read = (file) => fs.readFileSync(file, 'utf8');
const assertIncludes = (text, needle, label) => {
  if (!text.includes(needle)) failures.push(`${label}: missing ${needle}`);
};
const assertNotIncludes = (text, needle, label) => {
  if (text.includes(needle)) failures.push(`${label}: forbidden ${needle}`);
};

const about = read('browser/about/index.html');
const aboutCss = read('browser/about/styles.css');
const browserCss = read('src/renderer/styles/browser.css');
const missionCss = read('src/renderer/styles/mission-control.css');

assertIncludes(about, '<link rel="stylesheet" href="./styles.css" />', 'about page external stylesheet');
assertNotIncludes(about, '<style>', 'about page CSP-safe styling');
assertIncludes(about, 'https://github.com/JTAHAI/tahai-web-services-browser', 'about GitHub link');
assertIncludes(about, 'https://tahai.net', 'about TAHAI link');
assertIncludes(about, 'https://browser.tahai.net', 'about browser site link');
assertIncludes(about, 'https://docs.tahaiportal.com', 'about IT Docs link');
assertIncludes(about, 'https://sentinel.tahai.net', 'about SENTINEL link');
assertIncludes(about, 'https://os.tahai.net', 'about OS link');
assertIncludes(about, '1.8.28 / PASS54 polish', 'about release lane');

assertIncludes(aboutCss, '.sentinel-logo-frame', 'about sentinel frame');
assertIncludes(aboutCss, 'overflow: hidden;', 'about sentinel containment');
assertIncludes(aboutCss, 'object-fit: contain;', 'about sentinel image containment');
assertIncludes(aboutCss, 'max-height: 225px;', 'about sentinel max height');
assertIncludes(aboutCss, 'overflow-x: hidden;', 'about no horizontal bleed');
assertIncludes(aboutCss, '.about-link-list', 'about useful link grid');

assertIncludes(browserCss, 'PASS 54: Ops Panel recipe chip containment', 'ops panel pass marker');
assertIncludes(browserCss, '#ops-hub-recipes .mission-recipe-card strong', 'ops panel title selector');
assertIncludes(browserCss, 'grid-template-columns: minmax(0, 1fr) !important;', 'ops panel single-column title/chip flow');
assertIncludes(browserCss, '#ops-hub-recipes .recipe-chip', 'ops panel chip selector');
assertIncludes(browserCss, 'justify-self: start !important;', 'ops panel chip left alignment');
assertIncludes(browserCss, 'max-width: 100% !important;', 'ops panel chip containment');
assertIncludes(browserCss, 'white-space: normal !important;', 'ops panel title wrapping');

assertIncludes(missionCss, 'PASS 54: Mission recipe cards', 'mission recipe pass marker');
assertIncludes(missionCss, '#mission-recipes .recipe-chip', 'mission recipe chip selector');
assertIncludes(missionCss, 'margin-left: 0 !important;', 'mission recipe chip no overlap margin');

if (failures.length) {
  console.error('PASS54_ABOUT_OPS_POLISH_OK=0');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('PASS54_ABOUT_OPS_POLISH_OK=1');
