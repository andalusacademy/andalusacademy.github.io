(()=>{'use strict';
const URL='./staff-attendance.html';
let allowed=false,link=null,observer=null;
function studentPortalVisible(){
  try{
    const q=new URLSearchParams(location.search);
    if(q.get('student-portal')==='1'||location.hash==='#student-portal')return true;
    const screen=document.getElementById('student-portal-screen');
    if(screen){
      const style=getComputedStyle(screen);
      if(style.display!=='none'&&style.visibility!=='hidden'&&screen.getClientRects().length)return true;
    }
  }catch(_){}
  return false;
}
function sync(){
  const show=allowed&&!studentPortalVisible();
  if(!show){link?.remove();link=null;return;}
  if(link&&link.isConnected)return;
  link=document.createElement('a');link.id='staffAttendanceShortcut';link.href=URL;
  link.textContent='🕘 بصمة الموظفين';
  Object.assign(link.style,{position:'fixed',left:'18px',bottom:'18px',zIndex:'999990',display:'inline-flex',alignItems:'center',gap:'8px',padding:'13px 18px',borderRadius:'15px',background:'linear-gradient(135deg,#08264b,#1670b5)',color:'#fff',fontWeight:'900',fontSize:'14px',textDecoration:'none',boxShadow:'0 8px 25px rgba(5,35,70,.28)',border:'1px solid rgba(255,255,255,.25)'});
  document.body.appendChild(link);
}
async function init(){
  try{
    const sb=window.sb;if(!sb?.auth)return;
    const {data:{user}}=await sb.auth.getUser();if(!user)return;
    const {data:p,error}=await sb.from('user_profiles').select('role,is_active').eq('id',user.id).maybeSingle();
    allowed=!error&&!!p?.is_active&&['admin','employee'].includes(p.role);
  }catch(_){allowed=false}
  sync();
  if(!observer){
    observer=new MutationObserver(sync);
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});
  }
}
function start(){init();setTimeout(init,1400);setTimeout(init,3500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
try{window.sb?.auth?.onAuthStateChange(()=>setTimeout(init,300))}catch(_){}
})();