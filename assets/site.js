// Shared behaviour for the secondary pages (Pages menu, Lexicon): theme toggle,
// sounds, page-to-page fade, back arrow, and the reading-progress ring and up
// arrow where a page has them. Sounds and themes match the article.
(function () {
  var THEMES = ['light', 'dark', 'sepia', 'midnight'];
  var DARK = ['dark', 'midnight'];
  var NAV_DELAY = 800;
  var root = document.documentElement;
  var base = document.currentScript.getAttribute('data-base') || '../';

  /* ---------- sound ---------- */

  var audioCtx = null;
  // C major pentatonic, C4 to E5. Clicks walk through it a step or two at a time.
  var pianoNotes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
  var noteIndex = 2;

  function ctx() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  // A soft sine tone with a gentle swell and long fade, plus a faint octave.
  function playSoftTone(freq, when, peak, decay) {
    [[freq, peak, decay], [freq * 2, peak * 0.12, decay * 0.6]].forEach(function (partial) {
      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = partial[0];
      var gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(partial[1], when + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + partial[2]);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(when);
      osc.stop(when + partial[2]);
    });
  }

  // short: a clipped tail that has fully faded before a page change.
  function playPianoClick(short) {
    try {
      if (!ctx()) return;
      var steps = [-2, -1, 1, 2];
      var next = noteIndex + steps[Math.floor(Math.random() * steps.length)];
      if (next < 0 || next >= pianoNotes.length) next = noteIndex - (next - noteIndex);
      noteIndex = next;
      var now = audioCtx.currentTime;
      var decay = short ? 0.7 : 2.8;
      playSoftTone(pianoNotes[noteIndex], now, 0.045, decay);
      var answer = pianoNotes[Math.min(noteIndex + 2, pianoNotes.length - 1)];
      if (answer !== pianoNotes[noteIndex]) playSoftTone(answer, now + 0.16, 0.018, short ? 0.5 : 2.4);
    } catch (e) {}
  }

  function playThemeSound(toDark) {
    try {
      if (!ctx()) return;
      var notes = toDark ? [392.00, 329.63, 261.63] : [261.63, 329.63, 392.00];
      var start = audioCtx.currentTime;
      notes.forEach(function (freq, i) {
        playSoftTone(freq, start + i * 0.17, 0.05, 2.2);
      });
    } catch (e) {}
  }

  function playCompletionSound() {
    try {
      if (!ctx()) return;
      var start = audioCtx.currentTime;
      [261.63, 329.63, 392.00, 523.25].forEach(function (freq, i) {
        playSoftTone(freq, start + i * 0.22, 0.04, 2.6);
      });
    } catch (e) {}
  }

  /* ---------- theme ---------- */

  function currentTheme() {
    var t;
    try { t = localStorage.getItem('theme'); } catch (e) {}
    return THEMES.indexOf(t) !== -1 ? t : 'light';
  }

  function setFavicons(isDark) {
    var suffix = isDark ? 'dark' : 'light';
    var ids = { 'favicon-ico': 'favicon-' + suffix + '.ico', 'favicon-32': 'favicon-32-' + suffix + '.png',
      'favicon-192': 'favicon-192-' + suffix + '.png', 'favicon-apple': 'apple-touch-icon-' + suffix + '.png' };
    Object.keys(ids).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.href = base + 'favicon/' + ids[id];
    });
  }

  function applyTheme(theme) {
    if (theme === 'light') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    setFavicons(DARK.indexOf(theme) !== -1);
    try { localStorage.setItem('theme', theme); } catch (e) {}
  }

  function toggleTheme() {
    var next = THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length];
    applyTheme(next);
    playThemeSound(DARK.indexOf(next) !== -1);
  }

  setFavicons(DARK.indexOf(currentTheme()) !== -1);

  /* ---------- page-to-page fade ---------- */

  function internalLink(e) {
    if (e.defaultPrevented || e.button !== 0) return null;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
    var link = e.target.closest('a');
    if (!link || (link.target && link.target !== '_self')) return null;
    var url;
    try { url = new URL(link.href, location.href); } catch (err) { return null; }
    if (url.origin !== location.origin) return null;
    if (url.pathname === location.pathname && url.hash) return null;
    return link;
  }

  function leaveTo(href) {
    document.body.classList.add('page-leaving');
    setTimeout(function () { location.href = href; }, NAV_DELAY);
  }

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) document.body.classList.remove('page-leaving');
  });

  // If going back only moves within this page, it never leaves: show it again.
  window.addEventListener('popstate', function () {
    document.body.classList.remove('page-leaving');
  });

  /* ---------- ripples ---------- */

  function spawnRipple(x, y, color) {
    var ripple = document.createElement('div');
    ripple.className = 'click-ripple';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.style.borderColor = color;
    document.body.appendChild(ripple);
    ripple.addEventListener('animationend', function () { ripple.remove(); });
  }

  /* ---------- clicks ---------- */

  var themeBtn = document.querySelector('.theme-toggle');
  var backArrow = document.querySelector('.back-arrow');

  document.addEventListener('click', function (e) {
    var icon = e.target.closest('.theme-toggle, .back-arrow, .scroll-top-btn, .menu-btn');
    var rect = icon && icon.getBoundingClientRect();
    spawnRipple(icon ? rect.left + rect.width / 2 : e.clientX, icon ? rect.top + rect.height / 2 : e.clientY,
      getComputedStyle(icon || e.target).color);

    if (e.target.closest('.theme-toggle')) {
      toggleTheme();
      return;
    }

    if (backArrow && e.target.closest('.back-arrow')) {
      e.preventDefault();
      playPianoClick(true);
      document.body.classList.add('page-leaving');
      setTimeout(function () {
        var fromSite = document.referrer && new URL(document.referrer).origin === location.origin;
        if (fromSite && history.length > 1) history.back();
        else location.href = backArrow.getAttribute('href');
      }, NAV_DELAY);
      return;
    }

    // Links within the page (e.g. Lexicon concepts) replace the address rather
    // than adding to history, so the back arrow returns to the previous page.
    var hashLink = e.target.closest('a[href^="#"]');
    if (hashLink && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      playPianoClick();
      location.replace(hashLink.getAttribute('href'));
      return;
    }

    var link = internalLink(e);
    playPianoClick(!!link);
    if (link) {
      e.preventDefault();
      leaveTo(link.href);
    }
  });

  function typing() {
    var el = document.activeElement;
    var tag = el && el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || (el && el.isContentEditable);
  }

  /* ---------- reading progress and up arrow (pages that have them) ---------- */

  // Progress shows as a ring (.progress-ring) or a vertical pill
  // (.progress-pill). It counts from the bottom of the element named by the
  // indicator's data-start (default: the page title) plus data-start-offset,
  // to the top of the element named by data-end (default: the end of the
  // page). The indicator shows only between the two.
  var ring = document.querySelector('.progress-ring');
  var ringFill = ring && ring.querySelector('.progress-ring-fill');
  var pill = document.querySelector('.progress-pill');
  var pillFill = pill && pill.querySelector('.progress-pill-fill');
  var indicator = pill || ring;
  var upBtn = document.querySelector('.scroll-top-btn');
  var startSel = (indicator && indicator.getAttribute('data-start')) || '.page-title';
  var startEl = startSel === 'top' ? null : document.querySelector(startSel);   // 'top': from the very top
  var startOffset = parseFloat((indicator && indicator.getAttribute('data-start-offset')) || '0');
  var endEl = indicator && indicator.getAttribute('data-end') && document.querySelector(indicator.getAttribute('data-end'));
  var reachedEnd = false;

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (indicator) {
    var LENGTH = ringFill ? 2 * Math.PI * ringFill.r.baseVal.value : 0;

    var update = function () {
      var doc = document.documentElement;
      var scrollTop = doc.scrollTop || document.body.scrollTop;
      var scrollable = doc.scrollHeight - doc.clientHeight;
      var start = startEl ? startEl.getBoundingClientRect().bottom + scrollTop + startOffset : 0;
      var end = endEl ? Math.min(scrollable, endEl.getBoundingClientRect().top + scrollTop) : scrollable;
      // finish before the footer comes into view
      var foot = endEl && document.querySelector('.site-footer');
      if (foot) end = Math.min(end, foot.getBoundingClientRect().top + scrollTop - window.innerHeight);
      var span = end - start;
      var pct = span > 0 ? Math.min(100, Math.max(0, (scrollTop - start) / span * 100)) : 0;
      var atBottom = scrollable > 0 && scrollTop >= scrollable - 2;
      if (atBottom && !endEl) pct = 100;

      if (ringFill) {
        if (pct >= 100) {
          ringFill.style.strokeDasharray = 'none';
        } else {
          ringFill.style.strokeDasharray = LENGTH + ' ' + LENGTH;
          ringFill.style.strokeDashoffset = LENGTH * (1 - pct / 100);
        }
      }
      if (pillFill) pillFill.style.transform = 'scaleY(' + pct / 100 + ')';
      // edge bar: runs from the start point (once it is on screen) to the bottom
      if (pill && pill.classList.contains('progress-edge')) {
        var inset = Math.max(0, start - scrollTop);
        pill.style.top = inset + 'px';
        pill.style.height = Math.max(0, window.innerHeight - inset) + 'px';
      }
      document.body.classList.toggle('past-start', scrollTop > start && (!endEl || scrollTop < end));

      if (upBtn) {
        // data-show-after: show once that element has scrolled past the top
        var after = upBtn.getAttribute('data-show-after') && document.querySelector(upBtn.getAttribute('data-show-after'));
        var showFrom = after ? after.getBoundingClientRect().bottom + scrollTop : start + window.innerHeight * 0.5;
        upBtn.classList.toggle('visible', scrollTop > showFrom);
      }

      // the end chord plays on reaching the bottom of the page
      if (atBottom && !reachedEnd) {
        reachedEnd = true;
        playCompletionSound();
      } else if (!atBottom) {
        reachedEnd = false;
      }
    };

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  if (upBtn) upBtn.addEventListener('click', scrollToTop);

  var footer = document.querySelector('.site-footer');
  if (footer) {
    var checkFooter = function () {
      document.body.classList.toggle('footer-in-view', footer.getBoundingClientRect().top < window.innerHeight);
    };
    window.addEventListener('scroll', checkFooter, { passive: true });
    window.addEventListener('resize', checkFooter);
    checkFooter();
  }

  /* ---------- keys ---------- */

  // Shortcuts press their on-screen button, so they sound, ripple and
  // highlight exactly like a click.
  // Enter presses the link marked data-enter (e.g. the Lexicon's first concept)
  var enterTarget = document.querySelector('[data-enter]');

  function press(el) {
    if (!el) return;
    el.classList.add('key-hover');
    clearTimeout(el.keyHoverTimer);
    el.keyHoverTimer = setTimeout(function () { el.classList.remove('key-hover'); }, 600);
    el.click();
  }

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || typing()) return;
    if (e.key === 't' || e.key === 'T') {
      press(themeBtn);
    } else if (e.key === 'Enter' && enterTarget) {
      var tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'A' || tag === 'BUTTON') return;
      e.preventDefault();
      press(enterTarget);
    } else if (e.key === 'c' || e.key === 'C') {
      // c: toggle the blue link accent (shared with the article)
      var on = document.documentElement.classList.toggle('colour');
      try { localStorage.setItem('colour', on ? '1' : '0'); } catch (err) {}
      playPianoClick();
      spawnRipple(pointer.x, pointer.y, getComputedStyle(document.body).color);
    } else if (e.key === 'Backspace' && (upBtn || backArrow)) {
      e.preventDefault();
      // anywhere below the top: go to the top first; at the top (or already
      // on the way there): go back
      if (window.scrollY > 2 && !headingTop) {
        headingTop = true;
        if (upBtn) press(upBtn);
        else { playPianoClick(); scrollToTop(); }
      } else {
        press(backArrow);
      }
    }
  });

  // a scroll to the top counts as arrived until the reader scrolls down again
  var headingTop = false;
  var lastY = window.scrollY;
  window.addEventListener('scroll', function () {
    if (window.scrollY > lastY) headingTop = false;
    lastY = window.scrollY;
  }, { passive: true });

  // c has no button: its ripple shows where the pointer is
  var pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  document.addEventListener('mousemove', function (e) {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  }, { passive: true });
})();
