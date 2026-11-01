/* Andalus Academy — direct student portal pointer/stacking repair */
(function(){
  'use strict';
  const AI_OLD='المساعد الذكي', AI_NEW='مدرسك الخصوصي';
  const MAX='2147483000';
  function direct(){try{return new URLSearchParams(location.search).get('student-portal')==='1'||location.hash==='#student-portal';}catch(_){return false;}}
  function loggedIn(){try{const s=window.unifiedPortalStudent;const token=window.__andalusStudentPortalSessionToken||window.studentPortalFaceToken||'';return !!((s&&typeof s==='object'&&(s.id||s.student_id||s.registration_no||s.registration_number||s.name||s.full_name))&&token);}catch(_){return false;}}
  function rootNode(){return document.getElementById('student-portal-screen')||document.getElementById('student-portal-card')||document.getElementById('student-portal-content');}
  function css(){
    if(document.getElementById('andulus-portal-ui-guard-css'))return;
    const s=document.createElement('style');s.id='andulus-portal-ui-guard-css';
    s.textContent=`
      html[data-student-portal-direct="1"],html[data-student-portal-direct="1"] body{pointer-events:auto!important}
      html[data-student-portal-direct="1"] #login-screen{display:none!important;pointer-events:none!important}
      html[data-student-portal-direct="1"] #student-portal-screen{display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important}
      #student-portal-screen,#student-portal-card,#student-portal-content{pointer-events:auto!important;isolation:isolate!important;}
      #student-portal-screen input:not([type="hidden"]),#student-portal-screen textarea,#student-portal-screen select,#student-portal-screen button,
      #student-portal-card input:not([type="hidden"]),#student-portal-card textarea,#student-portal-card select,#student-portal-card button,
      #student-portal-content input:not([type="hidden"]),#student-portal-content textarea,#student-portal-content select,#student-portal-content button{pointer-events:auto!important;user-select:text!important;-webkit-user-select:text!important;touch-action:auto!important;cursor:auto!important}
      #student-portal-screen .portal-login-overlay,#student-portal-screen .login-overlay,#student-portal-card .portal-login-overlay,#student-portal-card .login-overlay{pointer-events:none!important}
      #student-portal-screen #sai-card.portal-ai-hidden{display:none!important}
    `;
    document.head.appendChild(s);
  }
  function liftStack(root){
    // Lift the portal's complete stacking context, not just the input itself.
    let p=root;
    while(p&&p!==document.body&&p!==document.documentElement){
      try{const cs=getComputedStyle(p);if(cs.position==='static')p.style.position='relative';p.style.zIndex=MAX;p.style.pointerEvents='auto';}catch(_){}
      p=p.parentElement;
    }
    root.style.position='relative';root.style.zIndex=MAX;root.style.pointerEvents='auto';
  }
  function repair(){
    if(!direct())return;
    const root=rootNode();if(!root)return;
    const login=document.getElementById('login-screen');if(login){login.style.display='none';login.style.pointerEvents='none';}
    root.style.pointerEvents='auto';liftStack(root);
    const fields=[...root.querySelectorAll('input:not([type="hidden"]),textarea,select,button,[role="button"]')];
    fields.forEach(el=>{try{el.disabled=false;el.readOnly=false;el.removeAttribute('disabled');el.removeAttribute('readonly');el.removeAttribute('aria-disabled');el.style.pointerEvents='auto';el.style.userSelect='text';el.style.webkitUserSelect='text';el.style.touchAction='auto';el.style.cursor=el.matches('button,[role="button"]')?'pointer':'text';el.style.zIndex=MAX;}catch(_){}});
    // If another fixed/absolute layer is physically covering a portal field, take only that layer out of hit-testing.
    fields.filter(el=>el.matches('input:not([type="hidden"]),textarea,select,button')).forEach(el=>{
      try{
        const r=el.getBoundingClientRect();if(r.width<5||r.height<5||r.bottom<0||r.top>innerHeight)return;
        const x=Math.max(1,Math.min(innerWidth-1,r.left+r.width/2)),y=Math.max(1,Math.min(innerHeight-1,r.top+r.height/2));
        let hit=document.elementFromPoint(x,y),guard=0;
        while(hit&&!root.contains(hit)&&hit!==document.body&&hit!==document.documentElement&&guard++<5){
          const parent=hit.parentElement;
          hit.style.pointerEvents='none';
          hit=parent&&parent!==document.body?document.elementFromPoint(x,y):null;
        }
      }catch(_){}
    });
  }
  function rename(root){if(!root)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(n=>{if(n.nodeValue&&n.nodeValue.includes(AI_OLD))n.nodeValue=n.nodeValue.replaceAll(AI_OLD,AI_NEW);});root.querySelectorAll?.('[title*="المساعد الذكي"],[aria-label*="المساعد الذكي"]').forEach(e=>{if(e.title)e.title=e.title.replaceAll(AI_OLD,AI_NEW);if(e.getAttribute('aria-label'))e.setAttribute('aria-label',e.getAttribute('aria-label').replaceAll(AI_OLD,AI_NEW));});}
  function tick(){css();repair();const portal=document.getElementById('student-portal-screen');if(!portal)return;const ai=document.getElementById('sai-card');if(ai){if(loggedIn()){ai.classList.remove('portal-ai-hidden');ai.style.display='';}else{ai.classList.add('portal-ai-hidden');}}if(loggedIn())rename(portal);else rename(document.getElementById('apa-student')||portal);}
  function init(){tick();new MutationObserver(tick).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','readonly','aria-disabled']});setInterval(tick,500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();