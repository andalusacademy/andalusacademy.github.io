/* Student portal tiles: private video library + restored notifications. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));
const sb=()=>window.sb||null;
function portalMenu(){if(typeof window.renderStudentPortalMenu==='function')window.renderStudentPortalMenu();}
async function openNotifications(){
 const box=$('student-portal-content'), st=window.unifiedPortalStudent, phone=window.unifiedPortalPhone;
 if(!box||!st?.id||!phone){if(window.showToast)window.showToast('سجّل الدخول إلى بوابة الطالب أولًا','error');return;}
 box.innerHTML='<div style="padding:20px;text-align:center">جاري تحميل التنبيهات والإشعارات...</div>';
 try{const {data,error}=await sb().rpc('get_portal_notifications',{p_student_id:String(st.id),p_phone:String(phone),p_portal_type:'student'});
 if(error)throw error;if(!data?.verified)throw new Error('تعذر التحقق من جلسة الطالب. سجّل الدخول مرة أخرى.');
 const items=Array.isArray(data.notifications)?data.notifications:[];
 const rows=items.map(n=>'<article class="card" style="padding:15px;margin:0 0 12px;border-right:5px solid '+(n.priority==='urgent'?'#dc2626':n.priority==='high'?'#f59e0b':'#2563eb')+'"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>'+esc(n.title||'تنبيه من الأكاديمية')+'</b><b style="font-size:11px">'+(n.priority==='urgent'?'عاجل':n.priority==='high'?'مهم':'إشعار')+'</b></div><div style="white-space:pre-wrap;line-height:1.9;margin-top:9px">'+esc(n.body||'')+'</div><small style="color:var(--muted)">'+esc(n.published_at||n.created_at||'')+'</small>'+(n.is_read?'':'<div><button class="btn btn-outline" data-read="'+esc(n.id)+'" style="margin-top:10px">تم الاطلاع</button></div>')+'</article>').join('');
 box.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:14px"><h2>🔔 التنبيهات والإشعارات</h2><button class="btn btn-outline" id="student-notifications-back">رجوع للبوابة</button></div>'+(rows||'<div class="card" style="padding:20px;text-align:center">لا توجد تنبيهات أو إشعارات متاحة حاليًا.</div>');
 $('student-notifications-back')?.addEventListener('click',portalMenu);
 box.querySelectorAll('[data-read]').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;try{const {data,error}=await sb().rpc('mark_portal_notification_read',{p_student_id:String(st.id),p_phone:String(phone),p_portal_type:'student',p_notification_id:btn.dataset.read});if(error)throw error;if(!data?.ok)throw new Error('تعذر تسجيل الاطلاع');await openNotifications();}catch(e){btn.disabled=false;if(window.showToast)window.showToast(e.message||'تعذر تحديث الإشعار','error');}}));
 }catch(e){box.innerHTML='<div class="card" style="padding:18px;color:#b91c1c">'+esc(e.message||'تعذر تحميل الإشعارات')+'</div><button class="btn btn-outline" id="student-notifications-back">رجوع للبوابة</button>';$('student-notifications-back')?.addEventListener('click',portalMenu);}
}
function addTiles(){const grid=document.querySelector('#student-portal-content .student-portal-grid');if(!grid)return;
 if(!grid.querySelector('[data-academy-video-tile]')){const b=document.createElement('button');b.type='button';b.className='btn student-portal-tile';b.dataset.academyVideoTile='1';b.innerHTML='<span class="tile-icon">🎬</span><span class="tile-label">مكتبة الفيديوهات التعليمية</span><span class="tile-hint">شاهد المحاضرات والدروس</span>';b.addEventListener('click',()=>window.academyVideoLibrary?.openStudentLibrary());grid.appendChild(b);}
 if(!grid.querySelector('[data-academy-notifications-tile]')){const b=document.createElement('button');b.type='button';b.className='btn student-portal-tile';b.dataset.academyNotificationsTile='1';b.innerHTML='<span class="tile-icon">🔔</span><span class="tile-label">التنبيهات والإشعارات</span><span class="tile-hint">تابع رسائل وإعلانات الأكاديمية</span>';b.addEventListener('click',openNotifications);grid.appendChild(b);}
}
function hook(){if(typeof window.renderStudentPortalMenu==='function'&&!window.renderStudentPortalMenu.__studentServicesHook){const old=window.renderStudentPortalMenu;const fn=function(){const r=old.apply(this,arguments);setTimeout(addTiles,0);return r;};fn.__studentServicesHook=true;window.renderStudentPortalMenu=fn;}addTiles();}
function start(){hook();if(!window.__studentServicesObserver){window.__studentServicesObserver=new MutationObserver(hook);window.__studentServicesObserver.observe(document.body,{childList:true,subtree:true});}setInterval(hook,1200);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();