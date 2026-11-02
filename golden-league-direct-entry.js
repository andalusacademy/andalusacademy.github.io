/* Andalus student navigation: open the Golden League leaderboard directly
   and return from the exam list to the student portal without signing out. */
(function () {
  'use strict';

  function visible(el) {
    if (!el) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  }

  function returnToStudentPortal() {
    try {
      if (typeof window.renderStudentPortalMenu === 'function') {
        window.renderStudentPortalMenu();
        return true;
      }
    } catch (e) { console.warn('Student portal menu failed:', e); }
    try {
      if (typeof window.showStudentPortalLoginStep === 'function') {
        window.showStudentPortalLoginStep();
        return true;
      }
    } catch (e) { console.warn('Student portal fallback failed:', e); }
    return false;
  }

  // The tab function is defined before the league UI is rendered. Wait for
  // the actual .agl-shell; checking only for the function caused the old fix
  // to stop too early and leave the student on the landing/home tab.
  function forceBoard() {
    let tries = 0;
    const timer = setInterval(function () {
      const exam = document.getElementById('exam-portal-screen');
      const root = document.querySelector('#weekly-quiz-content .agl-shell');
      if (root && typeof window.showGoldenLeagueTab === 'function') {
        try {
          window.showGoldenLeagueTab('board');
          clearInterval(timer);
          return;
        } catch (e) { console.warn('Golden League board navigation failed:', e); }
      }
      if (exam && visible(exam)) clearInterval(timer);
      if (++tries >= 150) clearInterval(timer);
    }, 100);

    // Also catch the asynchronous render that creates the league shell.
    if (document.body && !window.__andalusLeagueBoardObserver) {
      window.__andalusLeagueBoardObserver = new MutationObserver(function () {
        const root = document.querySelector('#weekly-quiz-content .agl-shell');
        if (!root || typeof window.showGoldenLeagueTab !== 'function') return;
        try {
          window.showGoldenLeagueTab('board');
          window.__andalusLeagueBoardObserver.disconnect();
          window.__andalusLeagueBoardObserver = null;
        } catch (e) { console.warn('Golden League board observer:', e); }
      });
      window.__andalusLeagueBoardObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function installLeagueEntry() {
    if (window.__andalusDirectGoldenLeagueEntryInstalled) return true;
    if (typeof window.goToPortalWeeklyQuiz !== 'function') return false;
    const original = window.goToPortalWeeklyQuiz;
    window.goToPortalWeeklyQuiz = function () {
      const result = original.apply(this, arguments);
      forceBoard();
      return result;
    };
    window.__andalusDirectGoldenLeagueEntryInstalled = true;
    return true;
  }

  function installExamLogoutOverride() {
    if (window.__andalusExamLogoutOverrideInstalled) return true;
    if (typeof window.examStudentLogout !== 'function') return false;
    const original = window.examStudentLogout;
    window.examStudentLogout = function () {
      if (visible(document.getElementById('exam-portal-screen'))) {
        returnToStudentPortal();
        return;
      }
      return original.apply(this, arguments);
    };
    window.__andalusExamLogoutOverrideInstalled = true;
    return true;
  }

  function replaceExamLogout() {
    const exam = document.getElementById('exam-portal-screen');
    if (!visible(exam)) return;
    exam.querySelectorAll('button,a,[role="button"]').forEach(function (el) {
      const label = (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
      if (!/تسجيل\\s+الخروج/.test(label) || el.dataset.andalusPortalBack === '1') return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = el.className || 'btn';
      b.style.cssText = el.style.cssText || '';
      b.textContent = '← الرجوع إلى البوابة';
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

  function install() {
    installLeagueEntry();
    installExamLogoutOverride();
    replaceExamLogout();
  }

  install();
  let tries = 0;
  const timer = setInterval(function () {
    install();
    if (++tries >= 150) clearInterval(timer);
  }, 200);

  if (document.body) {
    new MutationObserver(install).observe(document.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class']
    });
  }
})();