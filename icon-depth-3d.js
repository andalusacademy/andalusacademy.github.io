/* Andalus Academy — deliberate 3D icon tiles for semantic UI icons. */
(function () {
  'use strict';
  if (window.__andalus3DIconsInstalled) return;
  window.__andalus3DIconsInstalled = true;

  const STYLE_ID = 'andalus-3d-icons-style';
  const ICON_SELECTOR = '.nav-icon,.nav-card-icon,.gs-result-icon';
  const EMOJI_RE = /\\p{Extended_Pictographic}(?:\\uFE0F|\\uFE0E)?(?:\\u200D\\p{Extended_Pictographic}(?:\\uFE0F|\\uFE0E)?)*|[0-9#*]\\uFE0F?\\u20E3/gu;

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      ICON_SELECTOR + '{--and-icon-size:42px;display:inline-flex!important;align-items:center;justify-content:center;position:relative;isolation:isolate;flex:0 0 auto;width:var(--and-icon-size);height:var(--and-icon-size);min-width:var(--and-icon-size);box-sizing:border-box;border-radius:14px;padding:0!important;line-height:1!important;background:linear-gradient(145deg,#ffffff 0%,#dff4ff 28%,#83c9f1 62%,#287eb9 100%);border:1px solid rgba(255,255,255,.9);box-shadow:inset 1px 1px 2px rgba(255,255,255,.95),inset -3px -4px 7px rgba(13,75,126,.25),0 2px 0 #17618f,0 5px 9px rgba(9,47,83,.22);text-shadow:0 1px 0 rgba(255,255,255,.85),0 2px 2px rgba(9,47,83,.24);transform:translateY(0);transition:transform .2s ease,box-shadow .2s ease,filter .2s ease}',
      '.nav-card .nav-card-icon{--and-icon-size:54px;font-size:29px!important;margin:0 auto 10px;border-radius:17px;background:linear-gradient(145deg,#fafdff,#b8e6ff 38%,#4ca5dc 72%,#15558c)!important}',
      '.nav-icon{--and-icon-size:34px;font-size:17px!important;border-radius:11px;margin-inline-end:2px}',
      '.gs-result-icon{--and-icon-size:34px;font-size:17px!important;border-radius:11px}',
      ICON_SELECTOR + '::before{content:"";position:absolute;inset:1px 2px auto;height:38%;border-radius:inherit;background:linear-gradient(180deg,rgba(255,255,255,.78),rgba(255,255,255,0));pointer-events:none;z-index:-1}',
      '.nav-card:hover .nav-card-icon,button:hover .nav-icon,a:hover .nav-icon,.gs-result-item:hover .gs-result-icon{transform:translateY(-3px) rotateX(8deg) scale(1.045);filter:saturate(1.12);box-shadow:inset 1px 1px 2px rgba(255,255,255,.98),inset -3px -4px 7px rgba(13,75,126,.2),0 3px 0 #17618f,0 9px 14px rgba(9,47,83,.28)}',
      '.nav-card:active .nav-card-icon,button:active .nav-icon{transform:translateY(1px) scale(.97);box-shadow:inset 2px 3px 7px rgba(13,75,126,.25),0 1px 0 #17618f,0 2px 4px rgba(9,47,83,.2)}',
      '.and-3d-glyph{display:inline-block;position:relative;z-index:1;filter:drop-shadow(0 1px 0 rgba(255,255,255,.65)) drop-shadow(0 2px 2px rgba(8,43,76,.25))}',
      '@media(max-width:600px){.nav-card .nav-card-icon{--and-icon-size:48px}.nav-icon{--and-icon-size:30px}}',
      '@media(prefers-reduced-motion:reduce){' + ICON_SELECTOR + '{transition:none!important}.nav-card:hover .nav-card-icon,button:hover .nav-icon,a:hover .nav-icon{transform:none}}'
    ].join('');
    document.head.appendChild(style);
  }

  function enhance(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE || !element.matches(ICON_SELECTOR)) return;
    element.classList.add('and-3d-tile');
    if (element.querySelector('.and-3d-glyph')) return;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const value = node.nodeValue || '';
      EMOJI_RE.lastIndex = 0;
      if (!EMOJI_RE.test(value)) continue;
      EMOJI_RE.lastIndex = 0;
      const fragment = document.createDocumentFragment();
      let last = 0, match;
      while ((match = EMOJI_RE.exec(value)) !== null) {
        if (match.index > last) fragment.appendChild(document.createTextNode(value.slice(last, match.index)));
        const glyph = document.createElement('span');
        glyph.className = 'and-3d-glyph';
        glyph.setAttribute('aria-hidden', 'true');
        glyph.textContent = match[0];
        fragment.appendChild(glyph);
        last = match.index + match[0].length;
      }
      if (last < value.length) fragment.appendChild(document.createTextNode(value.slice(last)));
      node.parentNode.replaceChild(fragment, node);
    }
  }

  function scan(root) {
    if (!root) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (root.matches(ICON_SELECTOR)) enhance(root);
      root.querySelectorAll?.(ICON_SELECTOR).forEach(enhance);
    } else if (root.nodeType === Node.DOCUMENT_NODE) {
      root.querySelectorAll(ICON_SELECTOR).forEach(enhance);
    }
  }

  function start() {
    installStyles();
    scan(document);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        record.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) scan(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();