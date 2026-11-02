/* Andalus student portal: real screen-to-screen navigation.
   Keep feature screens separate from the student menu and never sign out on back. */
(function () {
  'use strict';

  const PORTAL = '#student-portal-screen';
  const LEAGUE = '#weekly-quiz-screen';
  const EXAM = '#exam-portal-screen';
  let view = '';

  function visible(el) {
    if (!el) return false;
    const s = window.getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  }

  function setDisplay(el, value) {
    if (el && el.style.display !== value) el.style.display = value;
  }

  function returnToPortal() {
    // Close feature screens first; the authenticated student session is untouched.
    [LEAGUE, EXAM, '#exam-question-screen', '#public-competition-screen', '#competition-screen']
      .forEach(function (selector) { setDisplay(document.querySelector(selector), 'none'); });
    const portal = document.querySelector(PORTAL);
    if (portal) setDisplay(portal, 'block');
    try {
      if (typeof window.renderStudentPortalMenu === 'function') window.renderStudentPortalMenu();
      else if (typeof window.showStudentPortalLoginStep === 'function') window.showStudentPortalLoginStep();
    } catch (e) { console.warn('Student portal return:', e); }
    if (portal) setDisplay(portal, 'block');
    view = 'portal';
    return false;
  }

  function enterFeature(name) {
    const portal = document.querySelector(PORTAL);
    if (portal) setDisplay(portal, 'none');
    view = name;
    if (name === 'league') {
      const screen = document.querySelector(LEAGUE);
      if (screen) setDisplay(screen, 'block');
      openBoardWhenReady();
    }
    if (name === 'exam') {
      const screen = document.querySelector(EXAM);
      if (screen) setDisplay(screen, 'block');
      setExamBackLabel();
    }
  }

  function openBoardWhenReady() {
    let attempts = 0;
    const timer = window.setInterval(function () {
      const screen = document.querySelector(LEAGUE);
      const board = document.querySelector('#weekly-quiz-content .agl-page[data-tab="board"]');
      if (screen && visible(screen) && board && typeof window.showGoldenLeagueTab === 'function') {
        window.showGoldenLeagueTab('board');
        window.clearInterval(timer);
      } else if (++attempts >= 180) {
        window.clearInterval(timer);
      }
    }, 100);
  }

  function setExamBackLabel() {
    const back = document.getElementById('andalus-global-back');
    if (back) {
      back.innerHTML = '↩ <span>عودة إلى البوابة</span>';
      back.setAttribute('aria-label', 'عودة إلى بوابة الطالب');
    }
  }

  function installLeagueEntry() {
    if (window.__andalusDirectLeagueScreenInstalled || typeof window.goToPortalWeeklyQuiz !== 'function') return;
    const original = window.goToPortalWeeklyQuiz;
    window.goToPortalWeeklyQuiz = async function () {
      const result = await original.apply(this, arguments);
      enterFeature('league');
      return result;
    };
    window.__andalusDirectLeagueScreenInstalled = true;
  }

  function installExamLogoutGuard() {
    if (window.__andalusExamLogoutGuardInstalled) return;
    if (typeof window.examStudentLogout === 'function') {
      const original = window.examStudentLogout;
      window.examStudentLogout = function () {
        if (visible(document.querySelector(EXAM))) returnToPortal();
        else return original.apply(this, arguments);
      };
    }
    window.__andalusExamLogoutGuardInstalled = true;
  }

  function replaceExamLogoutButtons() {
    if (!visible(document.querySelector(EXAM))) return;
    document.querySelectorAll('button,a,[role="button"]').forEach(function (el) {
      const label = (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
      if (!/تسجيل\\s+الخروج/.test(label) || el.dataset.andalusReturnButton === '1') return;
      el.textContent = '↩ عودة إلى البوابة';
      el.dataset.andalusReturnButton = '1';
      el.setAttribute('aria-label', 'عودة إلى بوابة الطالب');
      el.onclick = null;
      el.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        returnToPortal();
      }, true);
    });
  }

  // Capture the old logout control even when it is rendered outside the exam card.
  document.addEventListener('click', function (event) {
    const control = event.target && event.target.closest
      ? event.target.closest('button,a,[role="button"]') : null;
    if (!control || !visible(document.querySelector(EXAM))) return;
    const label = (control.innerText || control.textContent || '').replace(/\\s+/g, ' ').trim();
    if (/تسجيل\\s+الخروج/.test(label)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      returnToPortal();
    }
  }, true);

  // Watch the actual active feature screen, not merely the existence of its DOM node.
  function syncScreens() {
    const exam = document.querySelector(EXAM);
    const league = document.querySelector(LEAGUE);
    if (visible(exam)) {
      enterFeature('exam');
      replaceExamLogoutButtons();
    } else if (visible(league)) {
      if (view !== 'league') enterFeature('league');
    } else {
      const portal = document.querySelector(PORTAL);
      if (visible(portal)) {
        view = 'portal';
        const back = document.getElementById('andalus-global-back');
        if (back) back.innerHTML = '← <span>رجوع</span>';
      }
    }
  }

  function install() {
    installLeagueEntry();
    installExamLogoutGuard();
    syncScreens();
  }

  install();
  let tries = 0;
  const retry = window.setInterval(function () {
    install();
    if (++tries >= 180) window.clearInterval(retry);
  }, 200);

  if (document.body) {
    new MutationObserver(function () { install(); }).observe(document.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class']
    });
  }

  // The global back control must return to the portal from the exam list.
  const oldBack = window.andalusGoBack;
  if (typeof oldBack === 'function' && !window.__andalusExamBackScreenInstalled) {
    window.andalusGoBack = function () {
      if (visible(document.querySelector(EXAM))) return returnToPortal();
      return oldBack.apply(this, arguments);
    };
    window.__andalusExamBackScreenInstalled = true;
  }
})();
