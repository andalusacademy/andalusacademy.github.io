/* Andalus Global Back Navigation
 * Consistent internal back behavior for admin, student and parent flows.
 * Includes a resilient same-document history guard for Android Chrome.
 */
(function () {
  'use strict';
  if (window.__andalusBackNavigationInstalled) return;
  window.__andalusBackNavigationInstalled = true;

  function visible(el) {
    if (!el) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  }

  function closeModalFirst() {
    const modal = document.querySelector('.modal.open, .modal-overlay.open');
    if (!modal) return false;
    const id = modal.id;
    if (id && typeof window.closeModal === 'function') {
      try { window.closeModal(id.replace(/^modal-/, '')); return true; } catch (_) {}
    }
    modal.classList.remove('open');
    modal.style.display = 'none';
    return true;
  }

  function goBack() {
    if (closeModalFirst()) return;

    if (visible(document.getElementById('exam-portal-screen'))) {
      if (visible(document.getElementById('exam-question-screen')) && typeof window.showExamScreen === 'function') {
        window.showExamScreen('exam-select-screen'); return;
      }
      if (visible(document.getElementById('exam-select-screen')) && typeof window.examStudentLogout === 'function') {
        window.examStudentLogout(); return;
      }
    }

    if (visible(document.getElementById('weekly-quiz-screen')) || visible(document.getElementById('public-competition-screen')) || visible(document.getElementById('competition-screen'))) {
      if (typeof window.renderStudentPortalMenu === 'function') { window.renderStudentPortalMenu(); return; }
      if (typeof window.showStudentPortalLoginStep === 'function') { window.showStudentPortalLoginStep(); return; }
    }

    const student = document.getElementById('student-portal-screen');
    if (visible(student)) {
      const content = document.getElementById('student-portal-content');
      const text = content?.innerText || '';
      if (text.includes('ملخصات الامتحانات الشهرية') && typeof window.goToPortalStudySummaries === 'function') {
        window.goToPortalStudySummaries(); return;
      }
      if (typeof window.renderStudentPortalMenu === 'function') { window.renderStudentPortalMenu(); return; }
      if (typeof window.showStudentPortalLoginStep === 'function') { window.showStudentPortalLoginStep(); return; }
    }

    const parentIds = ['parent-portal-screen', 'parent-portal-content', 'parent-screen'];
    if (parentIds.some(id => visible(document.getElementById(id)))) {
      const candidates = ['renderParentPortalMenu','renderParentPortalHome','showParentPortalHome','showParentPortalLoginStep'];
      for (const name of candidates) {
        if (typeof window[name] === 'function') { try { window[name](); return; } catch (_) {} }
      }
    }

    const activePage = document.querySelector('.page.active');
    if (activePage) {
      const homeBtn = document.querySelector('.back-home-btn');
      if (homeBtn && visible(homeBtn)) { homeBtn.click(); return; }
      const id = activePage.id || '';
      if (id !== 'page-dashboard' && typeof window.showPage === 'function') {
        try { window.showPage('dashboard'); return; } catch (_) {}
      }
    }
  }

  function install() {
    const style = document.createElement('style');
    style.textContent = `
      #andalus-global-back{position:fixed;right:14px;bottom:14px;z-index:2147483000;display:none;align-items:center;gap:7px;border:0;border-radius:12px;padding:10px 15px;background:#152238;color:#fff;font-family:Cairo,Arial,sans-serif;font-size:13px;font-weight:900;box-shadow:0 8px 25px rgba(15,23,42,.25);cursor:pointer;direction:rtl}
      #andalus-global-back:hover{background:#1f3562;transform:translateY(-1px)}
      #andalus-global-back:active{transform:translateY(0)}
      @media(max-width:600px){#andalus-global-back{right:10px;bottom:10px;padding:9px 13px;font-size:12px}}
    `;
    document.head.appendChild(style);

    const btn = document.createElement('button');
    btn.id = 'andalus-global-back';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'رجوع');
    btn.innerHTML = '← <span>رجوع</span>';
    btn.addEventListener('click', goBack);
    document.body.appendChild(btn);

    let portalVisible = false;
    let guardTimer = null;
    let guardBusy = false;
    const backSentinel = '__andalus_portal_back_v2__';

    const refresh = () => {
      const login = document.getElementById('login-screen');
      const app = document.getElementById('app-screen');
      const exam = document.getElementById('exam-portal-screen');
      const student = document.getElementById('student-portal-screen');
      const parent = document.getElementById('parent-portal-screen');
      portalVisible = visible(app) || visible(exam) || visible(student) || visible(parent);
      btn.style.display = portalVisible && !(visible(login) && !portalVisible) ? 'flex' : 'none';
      if (portalVisible) ensureHistoryGuard();
    };

    function ensureHistoryGuard() {
      if (guardBusy || !portalVisible) return;
      guardBusy = true;
      try {
        const state = history.state;
        if (!state || state.__andalusPortalBack !== backSentinel) {
          history.pushState({ ...(state || {}), __andalusPortalBack: backSentinel, __andalusGuard: true }, '', location.href);
        }
      } catch (error) {
        console.warn('تعذر تفعيل الرجوع الداخلي للبوابة:', error);
      } finally {
        guardBusy = false;
      }
    }

    const observer = new MutationObserver(refresh);
    observer.observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:['style','class']});
    refresh();
    window.andalusGoBack = goBack;

    // Android Chrome's edge-swipe/system Back reaches the page as popstate
    // when a same-document history entry exists. Re-arm immediately after
    // every popstate and periodically while the portal is visible, so SPA
    // navigation or a component that calls pushState cannot remove the guard.
    window.addEventListener('popstate', function () {
      if (!portalVisible) return;
      goBack();
      setTimeout(ensureHistoryGuard, 0);
    });

    window.addEventListener('pageshow', function () {
      setTimeout(refresh, 0);
      setTimeout(ensureHistoryGuard, 50);
    });

    window.addEventListener('hashchange', function () {
      setTimeout(ensureHistoryGuard, 0);
    });

    guardTimer = window.setInterval(function () {
      if (portalVisible) ensureHistoryGuard();
    }, 700);

    // If a portal is entered after the script has already loaded, install the
    // guard again without requiring a page reload.
    window.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        refresh();
        setTimeout(ensureHistoryGuard, 50);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
