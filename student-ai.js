/* Compatibility loader: the current student AI lives in student-ai-assistant.js. */
(function(){
  'use strict';
  if (window.__andalusStudentAiAssistantLoader) return;
  window.__andalusStudentAiAssistantLoader = true;
  function load(){
    if (window.__andalusStudentAiAssistantLoaded || document.querySelector('script[data-andalus-student-ai-assistant]')) return;
    const s=document.createElement('script');
    s.src='./student-ai-assistant.js?v=20261106';
    s.dataset.andalusStudentAiAssistant='1';
    s.defer=true;
    document.head.appendChild(s);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load,{once:true});
  else load();
})();
