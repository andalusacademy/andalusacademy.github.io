(()=>{'use strict';
const URL='./staff-attendance.html';
async function mount(){
  const sb=window.sb;
  if(!sb?.auth||document.getElementById('staffAttendanceShortcut'))return;
  try{
    const {data:{user}}=await sb.auth.getUser();
    if(!user)return;
    const {data:p,error}=await sb.from('user_profiles').select('role,is_active').eq('id',user.id).maybeSingle();
    if(error||!p?.is_active||!['admin','employee'].includes(p.role))return;
    const a=document.createElement('a');a.id='staffAttendanceShortcut';a.href=URL;
    a.textContent='🕘 بصمة الموظفين';
    Object.assign(a.style,{position:'fixed',left:'18px',bottom:'18px',zIndex:'999990',display:'inline-flex',alignItems:'center',gap:'8px',padding:'13px 18px',borderRadius:'15px',background:'linear-gradient(135deg,#08264b,#1670b5)',color:'#fff',fontWeight:'900',fontSize:'14px',textDecoration:'none',boxShadow:'0 8px 25px rgba(5,35,70,.28)',border:'1px solid rgba(255,255,255,.25)'});
    document.body.appendChild(a);
  }catch(_){}
}
function start(){mount();setTimeout(mount,1400);setTimeout(mount,3500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
try{window.sb?.auth?.onAuthStateChange(()=>setTimeout(mount,300))}catch(_){}
})();
