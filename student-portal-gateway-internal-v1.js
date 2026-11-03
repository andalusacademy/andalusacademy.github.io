/* Andalus Student Portal Gateway — internal system window */
(() => {
  'use strict';
  const HOST_ID = 'andalus-student-gateway-internal-host';
  const GATEWAY_ID = 'andalus-student-portal-gateway-modal';
  const AI_ID = 'andalus-student-ai-admin-dashboard';

  function hostParent() {
    const grid = document.getElementById('nav-cards-grid');
    if (!grid) return null;
    return grid.parentElement || grid;
  }

  function ensureHost() {
    let host = document.getElementById(HOST_ID);
    if (!host) {
      const parent = hostParent();
      if (!parent) return null;
      host = document.createElement('div');
      host.id = HOST_ID;
      host.style.cssText = 'display:none;width:100%;max-width:1180px;margin:18px auto 0;position:relative;z-index:10;';
      parent.appendChild(host);
    }
    return host;
  }

  function normalizeBox(box) {
    if (!box) return;
    box.style.position = 'relative';
    box.style.inset = 'auto';
    box.style.top = 'auto';
    box.style.right = 'auto';
    box.style.bottom = 'auto';
    box.style.left = 'auto';
    box.style.width = '100%';
    box.style.maxWidth = '1180px';
    box.style.height = 'auto';
    box.style.maxHeight = 'none';
    box.style.minHeight = '0';
    box.style.margin = '0 auto';
    box.style.borderRadius = '16px';
    box.style.boxShadow = '0 12px 35px rgba(15,23,42,.12)';
    box.style.border = '1px solid var(--border,#e5e7eb)';
    box.style.overflow = 'hidden';
    box.style.background = '#fff';
  }

  function moveToHost(id) {
    const host = ensureHost();
    const box = document.getElementById(id);
    if (!host || !box) return false;
    host.style.display = 'block';
    host.innerHTML = '';
    host.appendChild(box);
    normalizeBox(box);
    const grid = document.getElementById('nav-cards-grid');
    if (grid) grid.style.display = 'none';
    window.scrollTo({top: Math.max(0, host.getBoundingClientRect().top + window.scrollY - 20), behavior:'smooth'});
    return true;
  }

  function closeInternal() {
    const host = document.getElementById(HOST_ID);
    const box = document.getElementById(GATEWAY_ID) || document.getElementById(AI_ID);
    if (box) box.remove();
    if (host) { host.innerHTML=''; host.style.display='none'; }
    const grid = document.getElementById('nav-cards-grid');
    if (grid) grid.style.display = '';
  }

  function openGatewayInternal() {
    const old = document.getElementById(GATEWAY_ID) || document.getElementById(AI_ID);
    if (old) old.remove();
    const grid = document.getElementById('nav-cards-grid');
    if (grid) grid.style.display = '';
    const host = ensureHost();
    if (host) { host.innerHTML=''; host.style.display='none'; }
    if (typeof window.openAndalusStudentGateway === 'function') {
      window.openAndalusStudentGateway();
      setTimeout(() => moveToHost(GATEWAY_ID), 0);
      setTimeout(() => moveToHost(GATEWAY_ID), 80);
    }
  }

  function bindCard() {
    const card = document.getElementById('andalus-student-gateway-card');
    if (!card) return false;
    card.onclick = openGatewayInternal;
    card.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGatewayInternal(); }
    };
    return true;
  }

  function bindInternalTransitions() {
    document.addEventListener('click', e => {
      const ai = e.target.closest && e.target.closest('#gateway-ai');
      if (ai) {
        setTimeout(() => moveToHost(AI_ID), 0);
        setTimeout(() => moveToHost(AI_ID), 100);
        return;
      }
      const summary = e.target.closest && e.target.closest('#gateway-summaries');
      if (summary) {
        setTimeout(() => {
          const host = document.getElementById(HOST_ID);
          const grid = document.getElementById('nav-cards-grid');
          if (host) { host.innerHTML=''; host.style.display='none'; }
          if (grid) grid.style.display='';
        }, 0);
      }
      const close = e.target.closest && e.target.closest('#andulus-student-gateway-close, #ai-admin-close');
      if (close) setTimeout(closeInternal, 0);
    });
  }

  function start() {
    ensureHost();
    bindCard();
    bindInternalTransitions();
    const obs = new MutationObserver(() => bindCard());
    obs.observe(document.body, {childList:true, subtree:true});
    setTimeout(bindCard, 300);
    setTimeout(bindCard, 1000);
    setTimeout(bindCard, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
