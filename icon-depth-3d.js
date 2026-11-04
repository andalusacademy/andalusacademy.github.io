/* Andalus Academy — unified 3D emoji/icon treatment. */
(function () {
  'use strict';
  if (window.__andalus3DIconsInstalled) return;
  window.__andalus3DIconsInstalled = true;

  const STYLE_ID = 'andalus-3d-icons-style';
  const EMOJI_RE = /\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*|[0-9#*]\uFE0F?\u20E3/gu;
  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION',
    'CODE', 'PRE', 'NOSCRIPT', 'SVG'
  ]);

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.and-3d-icon{display:inline-block;position:relative;vertical-align:-.09em;line-height:1.18;transform:perspective(180px) rotateX(7deg) translateZ(0);transform-origin:50% 70%;filter:drop-shadow(0 1px 0 rgba(255,255,255,.48)) drop-shadow(0 2px 1px rgba(21,34,56,.24)) drop-shadow(0 5px 4px rgba(21,34,56,.18));text-shadow:0 1px 0 rgba(255,255,255,.32),0 2px 0 rgba(21,34,56,.10);transition:transform .18s ease,filter .18s ease;isolation:isolate}',
      'button:hover .and-3d-icon,a:hover .and-3d-icon,[role=button]:hover .and-3d-icon{transform:perspective(180px) rotateX(0) translateY(-2px) scale(1.1);filter:drop-shadow(0 2px 0 rgba(255,255,255,.55)) drop-shadow(0 5px 3px rgba(21,34,56,.25)) drop-shadow(0 8px 6px rgba(21,34,56,.16))}',
      '.nav-icon .and-3d-icon,.nav-card-icon .and-3d-icon,.gs-result-icon .and-3d-icon{filter:drop-shadow(0 2px 1px rgba(0,0,0,.22)) drop-shadow(0 5px 4px rgba(0,0,0,.18))}',
      '@media(prefers-reduced-motion:reduce){.and-3d-icon{transition:none!important}button:hover .and-3d-icon,a:hover .and-3d-icon,[role=button]:hover .and-3d-icon{transform:perspective(180px) rotateX(7deg) translateZ(0)}}'
    ].join('');
    document.head.appendChild(style);
  }

  function wrapEmojiTextNode(node) {
    if (!node || !node.nodeValue || !node.parentElement) return;
    const parent = node.parentElement;
    if (parent.closest('.and-3d-icon') || parent.isContentEditable) return;
    if (SKIP_TAGS.has(parent.tagName) || parent.closest('[contenteditable="true"]')) return;
    const value = node.nodeValue;
    EMOJI_RE.lastIndex = 0;
    if (!EMOJI_RE.test(value)) return;
    EMOJI_RE.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let last = 0;
    let match;
    while ((match = EMOJI_RE.exec(value)) !== null) {
      if (match.index > last) fragment.appendChild(document.createTextNode(value.slice(last, match.index)));
      const icon = document.createElement('span');
      icon.className = 'and-3d-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = match[0];
      fragment.appendChild(icon);
      last = match.index + match[0].length;
    }
    if (last < value.length) fragment.appendChild(document.createTextNode(value.slice(last)));
    node.parentNode.replaceChild(fragment, node);
  }

  function scan(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      wrapEmojiTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (SKIP_TAGS.has(root.tagName) || root.closest?.('.and-3d-icon') || root.isContentEditable) return;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p || p.closest('.and-3d-icon') || p.isContentEditable || p.closest('[contenteditable="true"]')) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(p.tagName) || p.closest('script,style,textarea,input,select,option,code,pre,noscript,svg')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(wrapEmojiTextNode);
  }

  function start() {
    installStyles();
    scan(document.body);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'childList') record.addedNodes.forEach(scan);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
