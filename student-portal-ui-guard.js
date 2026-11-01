/* Andalus Academy — student portal UI guard */
(function(){
  'use strict';
  const AI_OLD='المساعد الذكي';
  const AI_NEW='مدرسك الخصوصي';
  function loggedIn(){
    try{
      const s=window.unifiedPortalStudent;
      const token=window.__andalusStudentPortalSessionToken||window.studentPortalFaceToken||'';
      return !!((s&&typeof s==='object'&&(s.id||s.student_id||s.registration_no||s.registration_number||s.name||s.full_name))&&token);
    }catch(_){return false;}
  }
  function css(){
    if(document.getElementById('andulus-portal-ui-guard-css'))return;
    const s=document.createElement('style');
    s.id='andulus-portal-ui-guard-css';
    s.textContent=`
      #student-portal-screen{pointer-events:auto!important;}
      #student-portal-screen input,
      #student-portal-screen textarea,
      #student-portal-screen select,
      #student-portal-screen button{pointer-events:auto!important;}
      #student-portal-screen input:not([type="hidden"]),
      #student-portal-screen button{position:relative;z-index:100001;}
      #student-portal-screen .portal-login-overlay,
      #student-portal-screen .login-overlay{pointer-events:none;}
      #student-portal-screen #sai-card.portal-ai-hidden{display:none!important;}
    `;
    document.head.appendChild(s);
  }
  function rename(root){
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(n=>{if(n.nodeValue&&n.nodeValue.includes(AI_OLD))n.nodeValue=n.nodeValue.replaceAll(AI_OLD,AI_NEW);});
    root.querySelectorAll?.('[title*="المساعد الذكي"],[aria-label*="المساعد الذكي"]').forEach(e=>{
      if(e.title)e.title=e.title.replaceAll(AI_OLD,AI_NEW);
      if(e.getAttribute('aria-label'))e.setAttribute('aria-label',e.getAttribute('aria-label').replaceAll(AI_OLD,AI_NEW));
    });
  }
  function tick(){
    css();
    const portal=document.getElementById('student-portal-screen');
    if(!portal)return;
    const ai=document.getElementById('sai-card');
    if(ai){
      if(loggedIn()){
        ai.classList.remove('portal-ai-hidden');
        ai.style.display='';
      }else{
        ai.classList.add('portal-ai-hidden');
      }
    }
    if(loggedIn())rename(portal);
    else rename(document.getElementById('apa-student')||portal);
  }
  function init(){
    tick();
    new MutationObserver(tick).observe(document.body,{childList:true,subtree:true});
    setInterval(tick,1200);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
