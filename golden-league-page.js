/* Andalus Golden League — full-page student view */
(function(){
  'use strict';
  let originalShow=null;
  let originalBack=null;
  let moved=null;
  let placeholder=null;
  function openPage(tab){
    if(document.getElementById('agl-fullpage')){
      document.getElementById('agl-fullpage').style.display='flex';
      if(originalShow) originalShow(tab||'home');
      return;
    }
    const src=document.getElementById('weekly-quiz-content');
    if(!src) return;
    placeholder=document.createComment('agl-weekly-placeholder');
    src.parentNode.insertBefore(placeholder,src);
    moved=src;
    const o=document.createElement('div');o.id='agl-fullpage';
    o.innerHTML='<div class="agl-fp-head"><div><b>🏆 دوري الأندلس الذهبي</b><small>مساحتك الخاصة للمنافسة والإنجاز</small></div><div class="agl-fp-actions"><button id="agl-fp-home" type="button">القائمة الرئيسية</button><button id="agl-fp-close" type="button" aria-label="رجوع">×</button></div></div><div id="agl-fp-body"></div>';
    document.body.appendChild(o);
    const css=document.createElement('style');css.id='agl-fp-css';css.textContent=`#agl-fullpage{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;background:linear-gradient(145deg,#f7fbfe 0%,#edf5fa 55%,#e4f0f7 100%);overflow:auto;padding:0 0 calc(18px + env(safe-area-inset-bottom));direction:rtl;color:#183b59}.agl-fp-head{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;color:#173b59;background:rgba(255,255,255,.94);backdrop-filter:blur(12px);border-bottom:1px solid #d7e7f0;box-shadow:0 4px 16px rgba(25,70,100,.07)}.agl-fp-head b{display:block;color:#174d73;font-size:16px}.agl-fp-head small{display:block;color:#668096;font-size:10px;margin-top:3px}.agl-fp-actions{display:flex;align-items:center;gap:7px}.agl-fp-head button{border:1px solid #d4e4ed;width:38px;height:38px;border-radius:12px;background:#edf6fa;color:#174d73;font-size:20px;cursor:pointer}.agl-fp-head #agl-fp-home{width:auto;padding:0 12px;font-size:11px;font-weight:800;background:#174d73;color:#fff;border-color:#174d73}.agl-fp-head+ #agl-fp-body{width:min(980px,100%);margin:0 auto;padding:12px}#agl-fullpage .agl-shell{background:linear-gradient(145deg,#ffffff,#f0f7fb)!important;color:#173b59!important;border:1px solid #dceaf2!important;box-shadow:0 12px 30px rgba(25,70,100,.09)!important}#agl-fullpage .agl-kicker{color:#a47b2b!important}#agl-fullpage .agl-title{color:#174d73!important}#agl-fullpage .agl-subtitle{color:#698197!important}#agl-fullpage .agl-stat,#agl-fullpage .agl-progress,#agl-fullpage .agl-weekchip,#agl-fullpage .agl-empty,#agl-fullpage .agl-rule,#agl-fullpage .agl-achievement{background:#fff!important;color:#294b66!important;border:1px solid #dceaf2!important}#agl-fullpage .agl-stat strong,#agl-fullpage .agl-history-row b,#agl-fullpage .agl-achievement strong{color:#a47b2b!important}#agl-fullpage .agl-stat span,#agl-fullpage .agl-weekchip,#agl-fullpage .agl-empty,#agl-fullpage .agl-rule{color:#59758a!important}#agl-fullpage .agl-progress-line{background:#e3edf3!important}#agl-fullpage .agl-portal-nav .agl-nav-btn{background:#eaf3f8!important;color:#174d73!important;border:1px solid #d3e3ed!important}#agl-fullpage .agl-history-row{border-color:#dceaf2!important;color:#294b66!important}#agl-fullpage .agl-section-label{color:#174d73!important}@media(max-width:600px){.agl-fp-head{padding:10px 12px}.agl-fp-head b{font-size:14px}.agl-fp-head #agl-fp-home{padding:0 9px;font-size:10px}#agl-fp-body{padding:8px!important}}`;
    document.head.appendChild(css);
    const body=o.querySelector('#agl-fp-body');body.appendChild(moved);
    document.getElementById('agl-fp-close').onclick=returnToPortal;
    document.getElementById('agl-fp-home').onclick=returnToPortal;
    o.addEventListener('click',e=>{if(e.target===o)closePage()});
    if(originalShow) originalShow(tab||'home');
  }
  function closePage(){
    const o=document.getElementById('agl-fullpage');
    if(o&&moved&&placeholder&&placeholder.parentNode){
      placeholder.parentNode.insertBefore(moved,placeholder);
      placeholder.remove();placeholder=null;
    }
    if(o)o.remove();
  }
  function returnToPortal(){
    closePage();
    if(typeof originalBack==='function'){originalBack.apply(window,arguments);return;}
    const quiz=document.getElementById('weekly-quiz-screen'),portal=document.getElementById('student-portal-screen');
    if(quiz)quiz.style.display='none';
    if(portal)portal.style.display='block';
    if(typeof window.renderStudentPortalMenu==='function')window.renderStudentPortalMenu();
  }
  function install(){
    if(typeof window.showGoldenLeagueTab!=='function')return false;
    if(window.__aglFullPageInstalled)return true;
    originalShow=window.showGoldenLeagueTab;
    originalBack=window.backToPortalFromWeeklyQuiz;
    if(typeof originalBack==='function')window.backToPortalFromWeeklyQuiz=returnToPortal;
    window.showGoldenLeagueTab=function(tab){
      if(document.getElementById('agl-fullpage'))return originalShow.apply(this,arguments);
      openPage(tab||'home');
    };
    window.openGoldenLeagueFullPage=openPage;
    window.closeGoldenLeagueFullPage=returnToPortal;
    window.__aglFullPageInstalled=true;
    return true;
  }
  let n=0;const t=setInterval(()=>{if(install())clearInterval(t);if(++n>80)clearInterval(t)},500);
})();