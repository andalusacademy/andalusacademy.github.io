/* Andalus exam targeting and full-screen setup */
(function(){
 'use strict';
 const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let mode='cohorts', selected=new Set(), installed=false;
 const norm=v=>String(v||'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[\sـ]+/g,' ').trim().toLowerCase();
 function students(){return Array.isArray(window.allStudents)?window.allStudents:(typeof allStudents!=='undefined'&&Array.isArray(allStudents)?allStudents:[]);}
 function active(s){const st=String(s.student_status||'active').toLowerCase();return !s.deleted_at&&!s.dismissed_at&&!['dismissed','final_dismissed','expelled','withdrawn','deleted','inactive','suspended'].includes(st);}
 function branches(){return [...new Set(students().map(s=>String(s.branch||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));}
 function styleModal(){
  if($('#andalus-exam-fullscreen-style'))return;
  const st=document.createElement('style');st.id='andalus-exam-fullscreen-style';
  st.textContent='#modal-exam{padding:0!important;align-items:stretch!important;justify-content:stretch!important}#modal-exam>.modal,#modal-exam .modal{width:100vw!important;max-width:none!important;height:100dvh!important;max-height:100dvh!important;margin:0!important;border-radius:0!important;display:flex!important;flex-direction:column!important}#modal-exam .modal-body{flex:1 1 auto!important;min-height:0!important;overflow:auto!important}#modal-exam .modal-header,#modal-exam .modal-footer{flex:0 0 auto!important}#andalus-exam-targeting{font-size:15px}#aet-students{max-height:min(48vh,520px)!important}#aet-branches label{display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border:1px solid var(--border);border-radius:10px;margin:4px;cursor:pointer}#aet-students label:hover{background:var(--hover-bg,rgba(100,116,139,.08))}';
  document.head.appendChild(st);
 }
 function installPanel(){
  const modal=$('#modal-exam');if(!modal)return;
  const body=$('.modal-body',modal);if(!body)return;
  styleModal();
  let panel=$('#andalus-exam-targeting',modal);
  if(!panel){
   panel=document.createElement('section');panel.id='andalus-exam-targeting';
   panel.style.cssText='border:1px solid var(--border);border-radius:14px;padding:18px;margin:14px 0;background:var(--card-bg,transparent)';
   panel.innerHTML='<div style="font-size:19px;font-weight:900;margin-bottom:12px">🎯 مين المستهدف بالامتحان؟</div><div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px"><label style="display:flex;align-items:center;gap:9px;padding:12px 16px;border:1px solid var(--border);border-radius:12px;cursor:pointer"><input type="radio" name="aet-mode" value="cohorts" checked> اختيار الدفعات والأنظمة</label><label style="display:flex;align-items:center;gap:9px;padding:12px 16px;border:1px solid var(--border);border-radius:12px;cursor:pointer"><input type="radio" name="aet-mode" value="students"> اختيار طلاب محددين</label></div><div id="aet-cohort-panel"><div style="font-weight:800;margin-bottom:8px">الفروع — يمكنك اختيار فرع أو الفرعين</div><div id="aet-branches" style="display:flex;flex-wrap:wrap;margin-bottom:14px"></div><div style="font-weight:800;margin:10px 0 8px">البرامج والأنظمة — الاختيار اختياري</div><div style="font-size:12px;color:var(--muted);margin-bottom:8px">لو لم تحدد نظامًا، سيشمل الامتحان كل الأنظمة داخل الفروع المختارة.</div></div><div id="aet-student-panel" style="display:none"><div style="font-weight:800;margin-bottom:8px">حدد الطلاب الذين سيؤدون الامتحان</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><input id="aet-search" placeholder="بحث باسم الطالب أو رقم القيد" style="flex:1;min-width:220px;padding:11px;border:1px solid var(--border);border-radius:9px"><button type="button" class="btn btn-outline btn-sm" id="aet-select-visible">تحديد كل الظاهرين</button><button type="button" class="btn btn-outline btn-sm" id="aet-clear">مسح التحديد</button></div></div><div id="aet-count" style="font-weight:700;color:var(--muted);margin:8px 0"></div><div id="aet-students" style="overflow:auto;border:1px solid var(--border);border-radius:10px;padding:8px"></div>';
   const footer=$('.modal-footer',modal);if(footer?.parentElement)footer.parentElement.insertBefore(panel,footer);else body.appendChild(panel);
   panel.addEventListener('change',e=>{
    if(e.target.name==='aet-mode'){mode=e.target.value;syncMode();}
    if(e.target.matches('[data-student-id]')){if(e.target.checked)selected.add(e.target.value);else selected.delete(e.target.value);updateCount();}
    if(e.target.matches('[data-branch]'))updateCount();
   });
   panel.addEventListener('input',e=>{if(e.target.id==='aet-search')renderStudents();});
   $('#aet-select-visible',panel).onclick=()=>{visibleStudents().forEach(s=>selected.add(String(s.id)));renderStudents();};
   $('#aet-clear',panel).onclick=()=>{selected.clear();renderStudents();};
  }
  renderBranches();syncMode();renderStudents();installed=true;
 }
 function syncMode(){
  const cohort=$('#aet-cohort-panel'),individual=$('#aet-student-panel');
  if(cohort)cohort.style.display=mode==='cohorts'?'block':'none';
  if(individual)individual.style.display=mode==='students'?'block':'none';
  const oldBranch=$('#exam-branch');if(oldBranch){oldBranch.style.display='none';const lab=oldBranch.closest('label');if(lab)lab.style.display='none';}
  $$('.exam-prog-cb').forEach(cb=>{const holder=cb.closest('label')||cb.parentElement;if(holder)holder.style.display=mode==='cohorts'?'':'none';});
  const list=$('#aet-students');if(list)list.style.display=mode==='students'?'block':'none';
  updateCount();
 }
 function renderBranches(){
  const box=$('#aet-branches');if(!box)return;
  const all=branches();
  box.innerHTML=all.map((b,i)=>'<label><input type="checkbox" data-branch value="'+esc(b)+'" checked> '+esc(b)+'</label>').join('')||'<span style="color:var(--muted)">تعذر تحميل أسماء الفروع من قائمة الطلاب.</span>';
 }
 function visibleStudents(){
  const q=norm($('#aet-search')?.value||'');
  return students().filter(s=>active(s)&&(!q||norm(s.name).includes(q)||norm(s.enrollment_number||s.registration_number||'').includes(q)));
 }
 function renderStudents(){
  const box=$('#aet-students');if(!box)return;
  const all=students(),rows=visibleStudents();
  if(!all.length){box.innerHTML='<div style="padding:14px;color:var(--muted)">قائمة الطلاب لم تُحمّل بعد. جارٍ محاولة تحميلها…</div>';updateCount();return;}
  box.innerHTML=rows.map(s=>{const id=String(s.id),num=s.enrollment_number||s.registration_number||'—';return '<label style="display:flex;gap:12px;align-items:center;padding:11px;border-bottom:1px solid var(--border);cursor:pointer"><input type="checkbox" data-student-id value="'+esc(id)+'" '+(selected.has(id)?'checked':'')+'><span style="flex:1;font-weight:700">'+esc(s.name)+'</span><small style="color:var(--muted)">قيد '+esc(num)+' · '+esc(s.branch||'')+' · '+esc(s.program||'')+' · '+esc(s.system_name||'')+'</small></label>';}).join('')||'<div style="padding:14px;color:var(--muted)">لا يوجد طلاب مطابقون للبحث.</div>';
  updateCount();
 }
 function updateCount(){
  const out=$('#aet-count');if(!out)return;
  if(mode==='students')out.textContent='عدد الطلاب المحددين: '+selected.size+' — عدد الطلاب الظاهرين: '+visibleStudents().length;
  else{const b=$$('[data-branch]:checked').map(x=>x.value);out.textContent='الفروع المختارة: '+(b.length?b.join(' + '):'كل الفروع')+' — اختيار البرامج والأنظمة اختياري';}
 }
 window.getAndalusExamTargetSelection=function(){
  const selectedBranches=$$('[data-branch]:checked').map(x=>x.value);
  return {mode,enabled:mode==='students',studentIds:[...selected],branches:selectedBranches};
 };
 const originalOpen=window.openCreateExam;
 if(typeof originalOpen==='function'&&!originalOpen.__targetingWrapped){
  const wrapped=function(){mode='cohorts';selected.clear();const result=originalOpen.apply(this,arguments);installPanel();if(!students().length&&typeof window.loadStudents==='function')Promise.resolve(window.loadStudents()).then(()=>{renderBranches();renderStudents();}).catch(()=>renderStudents());return result;};
  wrapped.__targetingWrapped=true;window.openCreateExam=wrapped;
 }
 document.addEventListener('change',e=>{if(e.target?.id==='exam-branch'&&installed)updateCount();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installPanel,{once:true});else installPanel();
})();