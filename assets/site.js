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

  var ring = document.querySelector('.progress-ring');
  var ringFill = ring && ring.querySelector('.progress-ring-fill');
  var upBtn = document.querySelector('.scroll-top-btn');
  var startEl = document.querySelector('.page-title');
  var reachedEnd = false;

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (ring && ringFill) {
    var LENGTH = 2 * Math.PI * ringFill.r.baseVal.value;

    var update = function () {
      var doc = document.documentElement;
      var scrollTop = doc.scrollTop || document.body.scrollTop;
      var scrollable = doc.scrollHeight - doc.clientHeight;
      var start = startEl ? startEl.getBoundingClientRect().bottom + scrollTop : 0;
      var span = scrollable - start;
      var pct = span > 0 ? Math.min(100, Math.max(0, (scrollTop - start) / span * 100)) : 0;
      if (scrollable > 0 && scrollTop >= scrollable - 2) pct = 100;

      if (pct >= 100) {
        ringFill.style.strokeDasharray = 'none';
      } else {
        ringFill.style.strokeDasharray = LENGTH + ' ' + LENGTH;
        ringFill.style.strokeDashoffset = LENGTH * (1 - pct / 100);
      }
      document.body.classList.toggle('past-start', scrollTop > start);

      if (upBtn) upBtn.classList.toggle('visible', scrollTop > start + window.innerHeight * 0.5);

      if (pct >= 100 && !reachedEnd) {
        reachedEnd = true;
        playCompletionSound();
      } else if (pct < 100) {
        reachedEnd = false;
      }
    };

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  if (upBtn) upBtn.addEventListener('click', scrollToTop);

  /* ---------- keys ---------- */

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || typing()) return;
    if (e.key === 't' || e.key === 'T') {
      if (themeBtn) {
        var r = themeBtn.getBoundingClientRect();
        spawnRipple(r.left + r.width / 2, r.top + r.height / 2, getComputedStyle(themeBtn).color);
      }
      toggleTheme();
    } else if (e.key === 'Backspace' && upBtn) {
      e.preventDefault();
      playPianoClick();
      scrollToTop();
    }
  });
})();
