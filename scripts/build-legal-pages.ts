// Writes the Terms of Service and the Privacy Policy as web pages (public/terms.html and public/privacy.html).
// The stores ask for a web address of the privacy policy; these pages ship with the web build and can be hosted anywhere.
import fs from 'node:fs';
import { LEGAL_UPDATED, PRIVACY, TERMS, type LegalSection } from '../src/config/legal';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function page(title: string, sections: LegalSection[], other: [string, string]): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} - Surf Tycoon</title>
<style>
  body { margin: 0; background: #0e3352; color: #eaf6fd; font: 16px/1.55 ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  main { max-width: 680px; margin: 0 auto; padding: 28px 18px 60px; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  .date { color: #9cc3da; margin: 0 0 24px; font-weight: 600; }
  section { background: #164a70; border-radius: 14px; padding: 12px 16px; margin-bottom: 10px; }
  h2 { font-size: 16px; margin: 0 0 4px; color: #ffc233; }
  p { margin: 0; }
  a { color: #ffc233; }
  footer { margin-top: 22px; color: #9cc3da; }
</style>
</head>
<body>
<main>
<h1>${title}</h1>
<p class="date">Surf Tycoon &middot; last updated ${LEGAL_UPDATED}</p>
${sections.map((s) => `<section><h2>${esc(s.title)}</h2><p>${esc(s.body)}</p></section>`).join('\n')}
<footer><a href="${other[1]}">${other[0]}</a></footer>
</main>
</body>
</html>
`;
}

fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/terms.html', page('Terms of Service', TERMS, ['Privacy Policy', 'privacy.html']));
fs.writeFileSync('public/privacy.html', page('Privacy Policy', PRIVACY, ['Terms of Service', 'terms.html']));
console.log('legal pages written to public/');
