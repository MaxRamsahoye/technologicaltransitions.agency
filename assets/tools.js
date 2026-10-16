// Find bar (Ctrl/Cmd+F and s) and a custom right-click menu (copy, copy link
// to highlight). Shared by the article, Lexicon and Pages.
//
// The find bar is on where the script tag has data-search-scope:
//   data-search-scope    what to search (selector)
//   data-search-exclude  parts of it to leave out (selector, optional)
//   data-hide-until      at the very top the bar sits top centre; once the
//                        page is scrolled it is hidden until this element
//                        (the Overview, the Lexicon's top band) has scrolled
//                        away, then it sits top left
(function () {
  var script = document.currentScript;
  var root = document.documentElement;

  /* ---------- styles ---------- */

  var css = [
    '.find-bar { position: fixed; z-index: 60; top: 22px; left: 50%; transform: translate(-50%, -8px);',
    '  display: flex; align-items: center; gap: 10px; width: 340px; max-width: calc(100vw - 32px); box-sizing: border-box;',
    '  padding: 8px 10px 8px 14px; background: var(--canvas-bg); color: var(--canvas-ink);',
    '  border: 1px solid var(--canvas-ink); border-radius: 999px; font-family: Inter, sans-serif; font-size: 15px;',
    '  opacity: 0; visibility: hidden; transition: opacity 0.25s ease, transform 0.25s ease, left 0.45s ease, visibility 0s 0.25s; }',
    '.find-bar.open { opacity: 1; visibility: visible; transform: translate(-50%, 0); transition: opacity 0.25s ease, transform 0.45s ease, left 0.45s ease; }',
    '.find-bar.at-left { left: 40px; transform: translate(0, -8px); }',
    '.find-bar.open.at-left { transform: translate(0, 0); }',
    '.find-bar.suppressed { opacity: 0; visibility: hidden; pointer-events: none; }',
    '.find-bar svg { flex: none; width: 15px; height: 15px; }',
    '.find-bar input { flex: 1; min-width: 0; border: none; outline: none; background: none; color: inherit; font: inherit; padding: 0; }',
    '.find-bar input::placeholder { color: var(--muted, #8c8c8c); }',
    '.find-count { flex: none; color: var(--muted, #8c8c8c); font-size: 13px; font-variant-numeric: tabular-nums; }',
    '.find-bar button { flex: none; display: flex; padding: 2px; border: none; background: none; color: inherit; }',
    '.find-bar button:hover { color: var(--muted, #8c8c8c); }',
    '::highlight(find-match) { background-color: rgba(255, 214, 0, 0.35); }',
    '::highlight(find-current) { background-color: rgba(255, 150, 0, 0.75); color: #000; }',
    '@media (max-width: 960px) { .find-bar.at-left { left: 24px; } }',
    '@media (max-width: 600px) { .find-bar, .find-bar.at-left { left: 16px; width: calc(100vw - 32px); transform: translate(0, -8px); }',
    '  .find-bar.open, .find-bar.open.at-left { transform: translate(0, 0); } }',
    '.context-menu { position: fixed; z-index: 70; min-width: 190px; padding: 6px 0; margin: 0; list-style: none;',
    '  background: var(--canvas-bg); color: var(--canvas-ink); border: 1px solid var(--canvas-ink);',
    '  font-family: Inter, sans-serif; font-size: 14px; opacity: 0; transform: scale(0.97); transform-origin: top left;',
    '  transition: opacity 0.12s ease, transform 0.12s ease; }',
    '.context-menu.open { opacity: 1; transform: none; }',
    '.context-menu button { display: block; width: 100%; padding: 7px 16px; border: none; background: none;',
    '  color: inherit; font: inherit; text-align: left; white-space: nowrap; }',
    '.context-menu button:hover:not(:disabled) { background: var(--canvas-ink); color: var(--canvas-bg); }',
    '.context-menu button:disabled { color: var(--muted, #8c8c8c); }',
    '.copy-toast { position: fixed; z-index: 70; padding: 5px 12px; background: var(--canvas-ink); color: var(--canvas-bg);',
    '  font-family: Inter, sans-serif; font-size: 13px; border-radius: 999px; pointer-events: none;',
    '  transform: translate(-50%, -100%); opacity: 0; transition: opacity 0.2s ease; }',
    '.copy-toast.show { opacity: 1; }',
    // the top menu: the site's pages across the top centre
    '.top-nav { position: absolute; z-index: 30; top: 36px; left: 50%; transform: translateX(-50%);',
    '  display: flex; gap: 36px; margin: 0; padding: 0; list-style: none;',
    '  font-family: Inter, sans-serif; font-size: 15px; letter-spacing: -0.005em; white-space: nowrap; }',
    '.top-nav a { color: var(--muted, #8c8c8c); text-decoration: none; padding-bottom: 4px;',
    '  border-bottom: 1.5px solid transparent; transition: color 0.2s ease, border-color 0.2s ease; }',
    '.top-nav a:hover { color: var(--canvas-ink); }',
    '.top-nav a[aria-current="page"] { color: var(--canvas-ink); border-bottom-color: currentColor; }',
    '@media (max-width: 899px) { .top-nav { display: none; } }'
  ].join('\n');
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- top menu ---------- */

  (function () {
    var base = new URL('../', script.src);
    var pages = [['Article', ''], ['Lexicon', 'lexicon/'], ['Sources', 'sources/'], ['Timeline', 'timeline/'], ['Diagram', 'diagram/']];
    var nav = document.createElement('nav');
    nav.className = 'top-nav';
    nav.setAttribute('aria-label', 'Pages');
    pages.forEach(function (pg) {
      var a = document.createElement('a');
      var url = new URL(pg[1], base);
      a.href = url.pathname;
      a.textContent = pg[0];
      if (url.pathname === location.pathname) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
    document.body.insertBefore(nav, document.body.firstChild);
  })();

  function typing() {
    var el = document.activeElement;
    var tag = el && el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || (el && el.isContentEditable);
  }

  /* ---------- refresh: fade out, reload, fade in ---------- */

  // F5 and Ctrl/Cmd+R fade the page out before reloading (the browser's own
  // reload button can't be delayed, but still fades back in)
  document.addEventListener('keydown', function (e) {
    var reloadKey = e.key === 'F5' || ((e.key === 'r' || e.key === 'R') && (e.ctrlKey || e.metaKey) && !e.altKey);
    if (!reloadKey || document.body.classList.contains('page-leaving')) return;
    e.preventDefault();
    document.body.classList.add('page-leaving', 'reloading');
    setTimeout(function () { location.reload(); }, 210);
  });

  /* ---------- find bar ---------- */

  var scopeSel = script.getAttribute('data-search-scope');
  if (scopeSel) initFind();

  function initFind() {
    var excludeSel = script.getAttribute('data-search-exclude');
    var hideUntil = document.querySelector(script.getAttribute('data-hide-until') || 'none');
    var hasHighlights = window.CSS && CSS.highlights && window.Highlight;

    var bar = document.createElement('div');
    bar.className = 'find-bar';
    bar.setAttribute('role', 'search');
    bar.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><line x1="15.5" y1="15.5" x2="21" y2="21"/></svg>' +
      '<input type="text" placeholder="Search" aria-label="Search the page" spellcheck="false" autocomplete="off">' +
      '<span class="find-count" aria-live="polite"></span>' +
      '<button type="button" class="find-prev" aria-label="Previous match"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="6,15 12,9 18,15"/></svg></button>' +
      '<button type="button" class="find-next" aria-label="Next match"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="6,9 12,15 18,9"/></svg></button>' +
      '<button type="button" class="find-close" aria-label="Close search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>';
    document.body.appendChild(bar);

    var input = bar.querySelector('input');
    var count = bar.querySelector('.find-count');
    var matches = [];
    var current = -1;
    var timer = null;
    var refocus = false;  // hidden while typing: take the cursor back on return
    var revealedAt = 0;   // a jump to a match can pass through the skip zone

    // which screen we are on: 'first', 'skip' (no bar) or 'main'
    function zone() {
      if (window.scrollY <= 10) return 'first';
      if (hideUntil && hideUntil.getBoundingClientRect().bottom > 80) return 'skip';
      return 'main';
    }

    function place() {
      var z = zone();
      bar.classList.toggle('at-left', z !== 'first');
      // while a search has matches the bar stays, wherever they lead
      var hide = z === 'skip' && !matches.length && Date.now() - revealedAt > 1500;
      var was = bar.classList.contains('suppressed');
      if (hide && !was && bar.contains(document.activeElement)) { input.blur(); refocus = true; }
      bar.classList.toggle('suppressed', hide);
      if (!hide && was && refocus) { refocus = false; input.focus({ preventScroll: true }); }
    }

    function textNodes() {
      var nodes = [];
      document.querySelectorAll(scopeSel).forEach(function (scope) {
        var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
          acceptNode: function (n) {
            var p = n.parentElement;
            if (!p || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            if (p.closest('script, style, svg, button')) return NodeFilter.FILTER_REJECT;
            if (excludeSel && p.closest(excludeSel)) return NodeFilter.FILTER_REJECT;
            if (!p.getClientRects().length) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        });
        while (walker.nextNode()) nodes.push(walker.currentNode);
      });
      return nodes;
    }

    function search() {
      var q = input.value.trim().toLowerCase();
      matches = [];
      current = -1;
      if (q) {
        textNodes().forEach(function (n) {
          var text = n.nodeValue.toLowerCase();
          var i = text.indexOf(q);
          while (i !== -1) {
            var r = document.createRange();
            r.setStart(n, i);
            r.setEnd(n, i + q.length);
            matches.push(r);
            i = text.indexOf(q, i + q.length);
          }
        });
      }
      // start from the first match on or below the top of the window
      if (matches.length) {
        current = 0;
        for (var k = 0; k < matches.length; k++) {
          if (matches[k].getBoundingClientRect().top >= 0) { current = k; break; }
        }
      }
      paint();
      if (current !== -1) reveal();
    }

    function paint() {
      if (hasHighlights) {
        CSS.highlights.set('find-match', new Highlight());
        CSS.highlights.set('find-current', new Highlight());
        matches.forEach(function (r, k) {
          CSS.highlights.get(k === current ? 'find-current' : 'find-match').add(r);
        });
      }
      count.textContent = !input.value.trim() ? '' : matches.length ? (current + 1) + ' of ' + matches.length : 'None';
    }

    function reveal() {
      var rect = matches[current].getBoundingClientRect();
      if (rect.top < 90 || rect.bottom > window.innerHeight - 60) {
        revealedAt = Date.now();
        window.scrollTo({ top: rect.top + window.scrollY - window.innerHeight * 0.35, behavior: 'smooth' });
      }
    }

    function step(dir) {
      if (!matches.length) return;
      current = (current + dir + matches.length) % matches.length;
      paint();
      reveal();
    }

    function open() {
      var sel = String(window.getSelection() || '').trim();
      if (sel && sel.length < 80 && sel.indexOf('\n') === -1) input.value = sel;
      place();
      bar.classList.add('open');
      input.focus();
      input.select();
      if (input.value) search();
    }

    function close() {
      bar.classList.remove('open');
      refocus = false;
      input.blur();
      if (hasHighlights) {
        CSS.highlights.delete('find-match');
        CSS.highlights.delete('find-current');
      }
      matches = [];
    }

    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(search, 120);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (timer && matches.length === 0) { clearTimeout(timer); search(); }
        else step(e.shiftKey ? -1 : 1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
      e.stopPropagation();
    });

    bar.querySelector('.find-prev').addEventListener('click', function () { step(-1); });
    bar.querySelector('.find-next').addEventListener('click', function () { step(1); });
    bar.querySelector('.find-close').addEventListener('click', close);

    document.addEventListener('keydown', function (e) {
      var findKey = (e.key === 'f' || e.key === 'F') && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey;
      var sKey = (e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey && !e.altKey && !typing();
      if (!findKey && !sKey) {
        if (e.key === 'Escape' && bar.classList.contains('open')) close();
        return;
      }
      if (zone() === 'skip') return;   // the browser's own find still works here
      e.preventDefault();
      open();
    });

    window.addEventListener('scroll', function () {
      if (bar.classList.contains('open')) place();
    }, { passive: true });
    window.addEventListener('resize', function () {
      if (bar.classList.contains('open')) place();
    });
  }

  /* ---------- right-click menu ---------- */

  var menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML =
    '<button type="button" role="menuitem" data-act="copy">Copy</button>' +
    '<button type="button" role="menuitem" data-act="highlight">Copy link to highlight</button>' +
    '<button type="button" role="menuitem" data-act="address">Copy link address</button>';
  var copyBtn = menu.querySelector('[data-act="copy"]');
  var highlightBtn = menu.querySelector('[data-act="highlight"]');
  var addressBtn = menu.querySelector('[data-act="address"]');
  var menuState = null;
  var toast = null;

  // a link to this page that scrolls to and highlights the selected text
  function highlightLink(text) {
    var words = text.replace(/\s+/g, ' ').trim().split(' ');
    var enc = function (s) {
      return encodeURIComponent(s).replace(/-/g, '%2D').replace(/,/g, '%2C').replace(/&/g, '%26');
    };
    var frag = words.length > 10
      ? enc(words.slice(0, 5).join(' ')) + ',' + enc(words.slice(-5).join(' '))
      : enc(words.join(' '));
    return location.origin + location.pathname + location.search + '#:~:text=' + frag;
  }

  function writeClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(fallback);
    }
    fallback();
    return Promise.resolve();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
    }
  }

  function showToast(x, y, label) {
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'copy-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = label;
    toast.style.left = x + 'px';
    toast.style.top = (y - 8) + 'px';
    toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { toast.classList.remove('show'); }, 1100);
  }

  function closeMenu() {
    if (!menuState) return;
    menu.classList.remove('open');
    menu.remove();
    menuState = null;
  }

  document.addEventListener('contextmenu', function (e) {
    // inside text boxes, and with Shift held, the browser's own menu
    if (e.shiftKey || e.target.closest('input, textarea, [contenteditable]')) return;
    e.preventDefault();
    var sel = String(window.getSelection() || '');
    var link = e.target.closest('a[href]');
    menuState = { text: sel.trim() ? sel : '', link: link ? link.href : '', x: e.clientX, y: e.clientY };
    copyBtn.disabled = !menuState.text;
    highlightBtn.disabled = !menuState.text;
    addressBtn.style.display = link ? '' : 'none';
    document.body.appendChild(menu);
    var w = menu.offsetWidth;
    var h = menu.offsetHeight;
    menu.style.left = Math.min(e.clientX, window.innerWidth - w - 8) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - h - 8) + 'px';
    requestAnimationFrame(function () { menu.classList.add('open'); });
  });

  // keep the selection when the menu is pressed
  menu.addEventListener('mousedown', function (e) { e.preventDefault(); });

  menu.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn || btn.disabled || !menuState) return;
    var act = btn.getAttribute('data-act');
    var s = menuState;
    var text = act === 'copy' ? s.text : act === 'highlight' ? highlightLink(s.text) : s.link;
    writeClipboard(text).then(function () {
      showToast(s.x, s.y, act === 'copy' ? 'Copied' : 'Link copied');
    });
    closeMenu();
  });

  document.addEventListener('mousedown', function (e) {
    if (menuState && !menu.contains(e.target)) closeMenu();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });
  window.addEventListener('scroll', closeMenu, { passive: true });
  window.addEventListener('resize', closeMenu);
  window.addEventListener('blur', closeMenu);
})();
