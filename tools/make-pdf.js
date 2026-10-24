#!/usr/bin/env node
// Render the article as article.pdf, the file the PDF icon on the Article
// page downloads.
//
// Usage (from the repository root): node tools/make-pdf.js
// Needs Playwright (NODE_PATH=$(npm root -g) where it is installed globally)
// and a Chromium (PLAYWRIGHT_BROWSERS_PATH, or CHROMIUM=/path/to/chromium).
//
// The article's header and sections are lifted out of index.html into a
// plain document set for print: one column, the site's typefaces, no bands,
// buttons or menus, the site's name and page numbers in the margins. Run it again whenever the
// article changes (after each sync from the Live doc).
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'article.pdf');

const CSS = `
  @font-face { font-family: 'ET Bembo'; src: url('fonts/ETBembo-RomanOSF.woff2') format('woff2'); font-weight: 400; font-style: normal; }
  @font-face { font-family: 'ET Bembo'; src: url('fonts/ETBembo-SemiBoldOSF.woff2') format('woff2'); font-weight: 600; font-style: normal; }
  @font-face { font-family: 'ET Bembo'; src: url('fonts/et-book-bold-line-figures.woff') format('woff'); font-weight: 700; font-style: normal; }
  @font-face { font-family: 'ET Bembo'; src: url('fonts/ETBembo-DisplayItalic.woff2') format('woff2'); font-weight: 400; font-style: italic; }
  /* the site's name and page numbers in the page margins, in IBM Plex as
     on the site; on the first page its name in the top right corner too */
  @page {
    size: A4;
    margin: 24mm 24mm 22mm;
    @bottom-left { content: 'technologicaltransitions.agency'; font-family: 'IBM Plex Sans', sans-serif; font-size: 8pt; color: #777; vertical-align: middle; }
    @bottom-right { content: counter(page); font-family: 'IBM Plex Sans', sans-serif; font-size: 8pt; color: #777; vertical-align: middle; }
  }
  @page :first {
    @top-right { content: 'Technological\\A Transitions'; white-space: pre; font-family: 'IBM Plex Sans', sans-serif; font-weight: 500; font-size: 10pt; line-height: 1.15; letter-spacing: 0.06em; text-transform: uppercase; text-align: right; vertical-align: bottom; padding-bottom: 2mm; color: #000; }
  }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: 'ET Bembo', Georgia, serif; font-size: 12pt; line-height: 1.42; color: #000; }
  a { color: #1a3a9c; text-decoration: none; }
  .amp { font-style: normal; }
  .author { margin: 0 0 14pt; font-size: 12pt; }
  .author a { color: #000; }
  h1 { margin: 0 0 12pt; font-size: 28pt; line-height: 1.08; font-weight: 600; }
  h1 .title-line { display: block; }
  .subtitle { margin: 0 0 28pt; font-size: 15pt; line-height: 1.3; }
  section { margin: 0 0 8pt; }
  h2 { margin: 26pt 0 8pt; font-size: 17pt; font-weight: 600; line-height: 1.2; break-after: avoid; }
  h3 { margin: 18pt 0 6pt; font-size: 13.5pt; font-weight: 600; font-style: italic; break-after: avoid; }
  h4, h5 { margin: 14pt 0 4pt; font-size: 12pt; font-weight: 600; break-after: avoid; }
  p { margin: 0 0 8pt; orphans: 3; widows: 3; }
  /* the Overview, Basis and Contents, as on the site set apart before the
     article proper: here between two rules */
  .lead-in { padding: 4pt 0 14pt; border-top: 0.75pt solid #000; border-bottom: 0.75pt solid #000; margin-bottom: 10pt; }
  .lead-in section:first-child h2 { margin-top: 14pt; }
  /* the article proper starts on a page of its own */
  .lead-in + section { break-before: page; }
  .lead-in + section > h2:first-child { margin-top: 0; }
  .overview-keywords { margin-top: 12pt; font-family: 'IBM Plex Sans', sans-serif; font-size: 9pt; letter-spacing: 0.02em; }
  ul { margin: 6pt 0 10pt; padding: 0; list-style: none; }
  li { margin: 0 0 4pt; padding-left: 1.3em; text-indent: -1.3em; }
  .live-list > li::before { content: '\\2014\\00a0\\00a0'; }
  .live-sub { margin: 4pt 0 0; }
  .live-sub li::before { content: '\\25CB\\00a0\\00a0'; font-size: 0.75em; vertical-align: 0.1em; }
  #contents .live-list:not(.live-sub) { font-family: 'IBM Plex Sans', sans-serif; font-size: 10.5pt; }
  #contents .live-sub { font-size: 9pt; }
  hr { border: 0; border-top: 0.75pt solid #999; margin: 16pt 0; }
`;

(async () => {
  const exe = process.env.CHROMIUM || (process.env.PLAYWRIGHT_BROWSERS_PATH ? path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium') : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage();
  // read the article out of the page as it is written, before any script runs
  await page.goto('file://' + path.join(ROOT, 'index.html'), { waitUntil: 'domcontentloaded' });
  const parts = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const body = q('.article-body').cloneNode(true);
    body.querySelectorAll('button, .sidenote, .sidenote-label').forEach((n) => n.remove());
    // headings lose their self-links, keeping their text
    body.querySelectorAll('.heading-link').forEach((a) => a.replaceWith(...a.childNodes));
    const sections = Array.from(body.children);
    // the sections in the Overview's band, kept together as the lead-in
    let n = 0;
    while (n < sections.length && (sections[n].id === 'overview' || sections[n].classList.contains('in-band'))) n++;
    const html = (els) => els.map((e) => e.outerHTML).join('\n');
    const title = q('.article-title').cloneNode(true);
    title.querySelectorAll('.heading-link').forEach((a) => a.replaceWith(...a.childNodes));
    return {
      author: q('.article-author').innerHTML,
      title: title.innerHTML,
      titleText: q('.article-title').textContent.replace(/\s+/g, ' ').trim(),
      subtitle: q('.article-subtitle').innerHTML,
      leadIn: html(sections.slice(0, n)),
      rest: html(sections.slice(n)),
    };
  });
  const doc = '<!doctype html><html><head><meta charset="utf-8"><base href="file://' + ROOT + '/">' +
    '<title>' + parts.titleText + '</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">' +
    '<style>' + CSS + '</style></head><body>' +
    '<p class="author">' + parts.author + '</p><h1>' + parts.title + '</h1><p class="subtitle">' + parts.subtitle + '</p>' +
    '<div class="lead-in">' + parts.leadIn + '</div>' + parts.rest + '</body></html>';
  await page.setContent(doc, { waitUntil: 'load', timeout: 20000 }).catch(() => page.setContent(doc, { waitUntil: 'domcontentloaded' }));
  // the margins' type is not in the page itself, so load it by name
  await page.evaluate(() => Promise.all(['400 8pt "IBM Plex Sans"', '500 10pt "IBM Plex Sans"'].map((f) => document.fonts.load(f))).then(() => document.fonts.ready));
  await page.pdf({
    path: OUT,
    format: 'A4',
    preferCSSPageSize: true,
    printBackground: true,
  });
  await browser.close();
  console.log('Wrote ' + path.relative(ROOT, OUT));
})().catch((e) => { console.error(e); process.exit(1); });
