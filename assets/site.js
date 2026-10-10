// Theme toggle for the secondary pages: cycles the same four themes as the
// article (light, dark, sepia, midnight) and shares its saved choice.
(function () {
  var THEMES = ['light', 'dark', 'sepia', 'midnight'];
  var DARK = ['dark', 'midnight'];
  var root = document.documentElement;
  var base = document.currentScript.getAttribute('data-base') || '../';

  function current() {
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

  function apply(theme) {
    if (theme === 'light') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    setFavicons(DARK.indexOf(theme) !== -1);
    try { localStorage.setItem('theme', theme); } catch (e) {}
  }

  function toggle() {
    apply(THEMES[(THEMES.indexOf(current()) + 1) % THEMES.length]);
  }

  setFavicons(DARK.indexOf(current()) !== -1);

  var btn = document.querySelector('.theme-toggle');
  if (btn) btn.addEventListener('click', toggle);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 't' && e.key !== 'T') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    toggle();
  });
})();
