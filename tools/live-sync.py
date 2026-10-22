#!/usr/bin/env python3
"""Rebuild the site article (index.html) from the Live doc artifact.

Usage: python3 tools/live-sync.py live.html   (the Live artifact's saved page)
       python3 tools/live-sync.py live.json   (its block list alone)

The block list is the JSON in the page's <script id="draft">:
[{"t": kind, "h": inner html, "s": 1 if shaded}, ...].

Only the article itself is replaced: the title, subtitle and author in the
article header, and every section of the article body. Everything else in
index.html (styles, scripts, contents, endnotes, footer) is left as it is.

The doc and the site differ in places, and this is where they are bridged:
- the doc's Heading (h1) starts a top-level section; a Section heading (h2)
  does too until the first Heading, and after it is a subsection (h3)
- sections keep the ids they already have on the site, matched by heading
  text, so links into the article keep working; new ones get a slug
- headings drop the bold and italics the doc gives them, and an ampersand
  in a heading gets the site's lighter ampersand
- the title is set on two lines, broken after its first "of"
- the author keeps the site's link to the author's page
- keywords (kw) become the overview's keywords line
- list items (li, li2) become dash lists, sub-items nested
- outside links open in a new tab, as they do elsewhere on the site
- shading has no counterpart on the site and is ignored (the Overview has
  its own panel there regardless)
"""
import html
import json
import re
import sys

ARTICLE = 'index.html'

ARROW = ('<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round">\n'
         '                <polygon points="14,19.469 21.031,8.531 14,11.813 6.969,8.531"/>\n'
         '              </svg>')


def text_of(h):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', h))).strip()


def key(h):
    return text_of(h).lower()


def slug(h):
    return re.sub(r'[^a-z0-9]+', '-', key(h).replace('&', ' ')).strip('-') or 'section'


def heading_html(h):
    t = html.escape(text_of(h), quote=False)
    return t.replace(' &amp; ', ' <span class="amp">&amp;</span> ')


def inline(h):
    # outside links open in a new tab
    return re.sub(r'<a href="(https?:[^"]*)">', r'<a href="\1" target="_blank" rel="noopener">', h.strip())


def main(path):
    raw = open(path, encoding='utf-8').read()
    if raw.lstrip().startswith('<'):
        m = re.search(r'<script type="application/json" id="draft">(.*?)</script>', raw, re.S)
        if not m:
            sys.exit('No <script id="draft"> block list in ' + path)
        raw = m.group(1)
    blocks = json.loads(raw)
    if not any(b.get('t') == 'title' for b in blocks):
        sys.exit('The block list has no title; refusing to rebuild the article from it')
    site = open(ARTICLE, encoding='utf-8').read()

    # the ids headings already have on the site, by heading text
    known = {}
    for m in re.finditer(r'<h[23][^>]*>\s*<a class="heading-link" href="#([^"]+)">(.*?)</a>', site, re.S):
        known.setdefault(key(m.group(2)), m.group(1))
    known.setdefault('overview', 'overview')

    head = {b['t']: b['h'] for b in blocks if b['t'] in ('title', 'subtitle', 'author') and b['h']}
    body = [b for b in blocks if b['t'] not in ('title', 'subtitle', 'author')]

    # sections: [{id, title, items: [(kind, html)]}]
    sections, seen_h1, used = [], False, set()

    def new_section(title):
        sid = known.get(key(title)) or slug(title)
        base, n = sid, 2
        while sid in used:
            sid, n = '%s-%d' % (base, n), n + 1
        used.add(sid)
        sections.append({'id': sid, 'title': title, 'items': []})

    for b in body:
        t, h = b['t'], b.get('h', '')
        if t != 'hr' and not text_of(h):
            continue
        if t == 'h1' or (t == 'h2' and not seen_h1):
            seen_h1 = seen_h1 or t == 'h1'
            new_section(h)
            continue
        if not sections:
            new_section('Introduction')
        if t in ('h2', 'h3', 'h4'):
            level = {'h2': 3, 'h3': 4, 'h4': 5}[t] if seen_h1 else {'h2': 3, 'h3': 3, 'h4': 4}[t]
            sid = known.get(key(h)) or slug(h)
            base, n = sid, 2
            while sid in used:
                sid, n = '%s-%d' % (base, n), n + 1
            used.add(sid)
            sections[-1]['items'].append(('h', (level, sid, h)))
        else:
            sections[-1]['items'].append((t, h))

    I = ' ' * 14
    out = []
    for i, s in enumerate(sections):
        nxt = sections[i + 1]['id'] if i + 1 < len(sections) else None
        out.append('            <section id="%s">' % s['id'])
        if s['id'] == 'overview' and nxt:
            out.append(I + '<button class="next-screen next-screen-overview" type="button" data-target="%s" aria-label="Continue to the next section">' % nxt)
            out.append('                ' + ARROW)
            out.append(I + '</button>')
            out.append('')
        out.append(I + '<h2><a class="heading-link" href="#%s">%s</a></h2>' % (s['id'], heading_html(s['title'])))
        items, j = s['items'], 0
        while j < len(items):
            t, v = items[j]
            out.append('')
            if t == 'h':
                level, sid, h = v
                out.append(I + '<h%d id="%s"><a class="heading-link" href="#%s">%s</a></h%d>' % (level, sid, sid, heading_html(h), level))
            elif t == 'kw':
                out.append(I + '<p class="overview-keywords">%s</p>' % inline(v))
            elif t == 'hr':
                out.append(I + '<hr class="article-rule">')
            elif t in ('li', 'li2'):
                # a run of list items, sub-items nested in the item before them
                lines, open_item, open_sub = [I + '<ul class="dash-list live-list">'], False, False
                while j < len(items) and items[j][0] in ('li', 'li2'):
                    lt, lh = items[j]
                    if lt == 'li':
                        if open_sub:
                            lines.append(I + '    </ul>'); lines.append(I + '  </li>'); open_sub = False
                        elif open_item:
                            lines[-1] += '</li>'
                        lines.append(I + '  <li>' + inline(lh)); open_item = True
                    else:
                        if not open_item:
                            lines.append(I + '  <li>'); open_item = True
                        if not open_sub:
                            lines.append(I + '    <ul class="dash-list live-sub">'); open_sub = True
                        lines.append(I + '      <li>%s</li>' % inline(lh))
                    j += 1
                if open_sub:
                    lines.append(I + '    </ul>'); lines.append(I + '  </li>')
                else:
                    lines[-1] += '</li>'
                lines.append(I + '</ul>')
                out.extend(lines)
                continue
            else:
                out.append(I + '<p>%s</p>' % inline(v))
            j += 1
        out.append('            </section>')
        out.append('')
    new_body = '\n'.join(out).rstrip() + '\n'

    start = site.index('<div class="article-body">')
    end = site.index('</article>')
    end = site.rindex('</div>', start, end)
    site = site[:start] + '<div class="article-body">\n' + new_body + '          ' + site[end:]

    if 'title' in head:
        t = text_of(head['title'])
        m = re.match(r'(.*?\bof)\s+(.+)$', t)
        parts = [m.group(1), m.group(2)] if m else [t]
        lines = ' '.join('<span class="title-line">%s</span>' % html.escape(p, quote=False) for p in parts)
        site = re.sub(r'(<h1 class="article-title"><a class="heading-link title-top" href="#">).*?(</a></h1>)',
                      lambda m: m.group(1) + lines + m.group(2), site, count=1, flags=re.S)
    if 'subtitle' in head:
        site = re.sub(r'(<p class="article-subtitle">).*?(</p>)',
                      lambda m: m.group(1) + inline(head['subtitle']) + m.group(2), site, count=1, flags=re.S)
    if 'author' in head:
        site = re.sub(r'(<p class="article-author"><a class="author-link"[^>]*>).*?(</a></p>)',
                      lambda m: m.group(1) + html.escape(text_of(head['author']), quote=False) + m.group(2), site, count=1, flags=re.S)
    # the header's arrow continues to the first section
    if sections:
        site = re.sub(r'(<button class="next-screen" type="button" data-target=")[^"]*(")',
                      lambda m: m.group(1) + sections[0]['id'] + m.group(2), site, count=1)

    open(ARTICLE, 'w', encoding='utf-8').write(site)
    print('%d sections: %s' % (len(sections), ', '.join(s['id'] for s in sections)))


if __name__ == '__main__':
    main(sys.argv[1])
