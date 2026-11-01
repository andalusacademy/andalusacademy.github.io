/* Andalus Golden League — full-page student view */
(function(){
  'use strict';
  let originalShow=null;
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
    o.innerHTML='<div class="agl-fp-head"><div><b>🏆 دوري الأندلس الذهبي</b><small>مساحتك الخاصة للمنافسة والإنجاز</small></div><button id="agl-fp-close" aria-label="رجوع">×</button></div><div id="agl-fp-body"></div>';
    document.body.appendChild(o);
    const css=document.createElement('style');css.id='agl-fp-css';css.textContent=`#agl-fullpage{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;background:radial-gradient(circle at 50% 0,#29436d 0,#10213a 46%,#07111f 100%);overflow:auto;padding:0 0 calc(18px + env(safe-area-inset-bottom));direction:rtl}.agl-fp-head{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 16px;color:#fff;background:rgba(10,25,44,.92);backdrop-filter:blur(12px);border-bottom:1px solid rgba(244,210,124,.2)}.agl-fp-head b{display:block;color:#f4d27c;font-size:16px}.agl-fp-head small{display:block;color:#d8e2ef;font-size:10px;margin-top:3px}.agl-fp-head button{border:0;width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,.1);color:#fff;font-size:24px;cursor:pointer}.agl-fp-head+ #agl-fp-body{width:min(980px,100%);margin:0 auto;padding:12px}@media(max-width:600px){.agl-fp-head{padding:10px 12px}.agl-fp-head b{font-size:14px}#agl-fp-body{padding:8px!important}}`;
    document.head.appendChild(css);
    const body=o.querySelector('#agl-fp-body');body.appendChild(moved);
    document.getElementById('agl-fp-close').onclick=closePage;
    o.addEventListener('click',e=>{if(e.target===o)closePage()});
    if(originalShow) originalShow(tab||'home');
  }
  function closePage(){
    const o=document.getElementById('agl-fullpage');
    if(!o||!moved||!placeholder)return;
    placeholder.parentNode.insertBefore(moved,placeholder);
    placeholder.remove();placeholder=null;
    o.remove();
  }
  function install(){
    if(typeof window.showGoldenLeagueTab!=='function')return false;
    if(window.__aglFullPageInstalled)return true;
    originalShow=window.showGoldenLeagueTab;
    window.showGoldenLeagueTab=function(tab){
      if(document.getElementById('agl-fullpage'))return originalShow.apply(this,arguments);
      openPage(tab||'home');
    };
    window.openGoldenLeagueFullPage=openPage;
    window.closeGoldenLeagueFullPage=closePage;
    window.__aglFullPageInstalled=true;
    return true;
  }
  let n=0;const t=setInterval(()=>{if(install())clearInterval(t);if(++n>80)clearInterval(t)},500);
})();