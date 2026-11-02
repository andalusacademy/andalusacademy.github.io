/* Andalus student section navigation fix.
   دوري الأندلس -> Leaderboard directly.
   الامتحانات -> رجوع إلى بوابة الطالب (never logout from this screen).
*/
(function () {
  'use strict';

  function visible(el) {
    if (!el) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  }

  function returnToStudentPortal() {
    try {
      if (typeof window.renderStudentPortalMenu === 'function') return window.renderStudentPortalMenu();
      if (typeof window.showStudentPortalLoginStep === 'function') return window.showStudentPortalLoginStep();
    } catch (e) { console.warn('Portal return failed:', e); }
  }

  function forceBoard() {
    let tries = 0;
    const timer = setInterval(function () {
      try {
        if (typeof window.showGoldenLeagueTab === 'function') {
          window.showGoldenLeagueTab('board');
          clearInterval(timer);
          return;
        }
      } catch (e) { console.warn('Golden League board navigation failed:', e); }
      if (++tries >= 40) clearInterval(timer);
    }, 100);
    try { if (typeof window.showGoldenLeagueTab === 'function') window.showGoldenLeagueTab('board'); } catch (_) {}
  }

  function installLeagueEntry() {
    if (window.__andalusDirectGoldenLeagueEntryInstalled) return true;
    if (typeof window.goToPortalWeeklyQuiz !== 'function') return false;
    const original = window.goToPortalWeeklyQuiz;
    window.goToPortalWeeklyQuiz = function () {
      try { original.apply(this, arguments); }
      finally { forceBoard(); }
    };
    window.__andalusDirectGoldenLeagueEntryInstalled = true;
    return true;
  }

  function replaceExamLogout() {
    const exam = document.getElementById('exam-portal-screen');
    if (!visible(exam)) return;
    exam.querySelectorAll('button,a,[role="button"]').forEach(function (el) {
      const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!/تسجيل\s+الخروج/.test(text) || el.dataset.andalusPortalBack === '1') return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = el.className || 'btn';
      b.style.cssText = el.style.cssText || '';
      b.innerHTML = '← الرجوع إلى البوابة';
      b.setAttribute('aria-label', 'الرجوع إلى بوابة الطالب');
      b.dataset.andalusPortalBack = '1';
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        returnToStudentPortal();
      });
      el.replaceWith(b);
    });
  }

  function installExamBack() {
    if (window.__andalusExamBackOverrideInstalled) return true;
    if (typeof window.andalusGoBack !== 'function') return false;
    const original = window.andalusGoBack;
    window.andalusGoBack = function () {
      if (visible(document.getElementById('exam-portal-screen'))) return returnToStudentPortal();
      return original.apply(this, arguments);
    };
    window.__andalusExamBackOverrideInstalled = true;
    return true;
  }

  function boot() {
    installLeagueEntry();
    installExamBack();
    replaceExamLogout();
  }

  boot();
  let tries = 0;
  const timer = setInterval(function () {
    boot();
    if (++tries >= 100) clearInterval(timer);
  }, 200);

  if (document.body) {
    new MutationObserver(boot).observe(document.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class']
    });
  }
})();
