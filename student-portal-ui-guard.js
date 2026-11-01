/* Andalus Academy — student portal UI guard / login interaction repair */
(function(){
  'use strict';
  const AI_OLD='المساعد الذكي', AI_NEW='مدرسك الخصوصي';
  function direct(){try{return new URLSearchParams(location.search).get('student-portal')==='1'||location.hash==='#student-portal';}catch(_){return false;}}
  function loggedIn(){try{const s=window.unifiedPortalStudent;const token=window.__andalusStudentPortalSessionToken||window.studentPortalFaceToken||'';return !!((s&&typeof s==='object'&&(s.id||s.student_id||s.registration_no||s.registration_number||s.name||s.full_name))&&token);}catch(_){return false;}}
  function css(){
    if(document.getElementById('andulus-portal-ui-guard-css'))return;
    const s=document.createElement('style');s.id='andulus-portal-ui-guard-css';
    s.textContent=`
      #student-portal-screen,#student-portal-card,#student-portal-content{pointer-events:auto!important;position:relative!important;}
      #student-portal-screen input:not([type="hidden"]),#student-portal-screen textarea,#student-portal-screen select,#student-portal-screen button,
      #student-portal-card input:not([type="hidden"]),#student-portal-card textarea,#student-portal-card select,#student-portal-card button,
      #student-portal-content input:not([type="hidden"]),#student-portal-content textarea,#student-portal-content select,#student-portal-content button{pointer-events:auto!important;user-select:text!important;touch-action:manipulation!important;position:relative!important;z-index:100002!important;}
      #student-portal-screen .portal-login-overlay,#student-portal-screen .login-overlay,#student-portal-card .portal-login-overlay,#student-portal-card .login-overlay{pointer-events:none!important;}
      #student-portal-screen #sai-card.portal-ai-hidden{display:none!important;}
    `;document.head.appendChild(s);
  }
  function repair(){
    if(!direct())return;
    const root=document.getElementById('student-portal-screen')||document.getElementById('student-portal-card')||document.getElementById('student-portal-content');if(!root)return;
    root.style.pointerEvents='auto';
    const fields=[...root.querySelectorAll('input:not([type="hidden"]),textarea,select,button')];
    fields.forEach(el=>{try{el.disabled=false;el.readOnly=false;el.removeAttribute('disabled');el.removeAttribute('readonly');el.removeAttribute('aria-disabled');el.style.pointerEvents='auto';el.style.userSelect='text';el.style.touchAction='manipulation';el.style.position='relative';el.style.zIndex='100002';}catch(_){}});
    fields.filter(el=>el.matches('input:not([type="hidden"]),textarea,select')).forEach(el=>{
      try{
        const r=el.getBoundingClientRect();if(r.width<5||r.height<5)return;
        const x=Math.max(1,Math.min(innerWidth-1,r.left+r.width/2)),y=Math.max(1,Math.min(innerHeight-1,r.top+r.height/2));
        let hit=document.elementFromPoint(x,y);
        if(hit&&hit!==el&&!el.contains(hit)){
          let p=hit;
          while(p&&p!==document.body&&p!==el){
            const cs=getComputedStyle(p),pos=cs.position,zi=parseInt(cs.zIndex,10);
            if((pos==='fixed'||pos==='absolute'||pos==='sticky')&&(Number.isFinite(zi)?zi:0)>=500){p.style.pointerEvents='none';break;}
            p=p.parentElement;
          }
        }
      }catch(_){ }
    });
  }
  function rename(root){if(!root)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(n=>{if(n.nodeValue&&n.nodeValue.includes(AI_OLD))n.nodeValue=n.nodeValue.replaceAll(AI_OLD,AI_NEW);});root.querySelectorAll?.('[title*="المساعد الذكي"],[aria-label*="المساعد الذكي"]').forEach(e=>{if(e.title)e.title=e.title.replaceAll(AI_OLD,AI_NEW);if(e.getAttribute('aria-label'))e.setAttribute('aria-label',e.getAttribute('aria-label').replaceAll(AI_OLD,AI_NEW));});}
  function tick(){css();repair();const portal=document.getElementById('student-portal-screen');if(!portal)return;const ai=document.getElementById('sai-card');if(ai){if(loggedIn()){ai.classList.remove('portal-ai-hidden');ai.style.display='';}else{ai.classList.add('portal-ai-hidden');}}if(loggedIn())rename(portal);else rename(document.getElementById('apa-student')||portal);}
  function init(){tick();new MutationObserver(tick).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','readonly']});setInterval(tick,700);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
