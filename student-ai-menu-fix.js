/* Andalus student AI tile integration fix */
(function(){
  'use strict';
  const TILE_ID='student-ai-portal-tile';
  function addTile(){
    const content=document.querySelector('#student-portal-content');
    if(!content)return false;
    const grid=content.querySelector('.student-portal-grid');
    if(!grid)return false;
    if(document.getElementById(TILE_ID))return true;
    const base=grid.querySelector('.student-portal-tile');
    if(!base)return false;
    const tile=base.cloneNode(true);
    tile.id=TILE_ID;
    tile.removeAttribute('href');
    tile.setAttribute('type','button');
    tile.setAttribute('aria-label','المدرس الخصوصي');
    tile.setAttribute('onclick','openStudentAiAssistant()');
    const icon=tile.querySelector('.tile-icon');
    if(icon)icon.textContent='🤖';
    const label=tile.querySelector('.tile-label');
    if(label)label.textContent='المدرس الخصوصي';
    const hints=tile.querySelectorAll('.tile-hint');
    if(hints[0])hints[0].textContent='ذاكر معايا بصوتك وبالعامية المصرية';
    if(hints[1])hints[1].textContent='تجربة 24 ساعة';
    grid.appendChild(tile);
    return true;
  }
  function watch(){
    addTile();
    if(!window.__andalusAiTileObserver){
      const root=document.querySelector('#student-portal-content')||document.body;
      const observer=new MutationObserver(function(){addTile()});
      observer.observe(root,{childList:true,subtree:true});
      window.__andalusAiTileObserver=observer;
    }
    let tries=0;
    const timer=setInterval(function(){
      if(addTile()||++tries>30)clearInterval(timer);
    },300);
  }
  function start(){
    watch();
    const original=window.renderStudentPortalMenu;
    if(typeof original==='function'&&!original.__andalusAiMenuWrapped){
      const wrapped=function(){
        const result=original.apply(this,arguments);
        setTimeout(addTile,0);
        return result;
      };
      wrapped.__andalusAiMenuWrapped=true;
      window.renderStudentPortalMenu=wrapped;
    }
    setTimeout(watch,500);
    setTimeout(watch,1500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
