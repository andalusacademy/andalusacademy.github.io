/* Andalus exam student targeting UI */
(function () {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let selected = new Set();
  let installed = false;
  const norm = v => String(v || '').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[\sـ]+/g,' ').trim().toLowerCase();
  function students(){ return Array.isArray(window.allStudents) ? window.allStudents : (typeof allStudents !== 'undefined' && Array.isArray(allStudents) ? allStudents : []); }
  function active(s){
    const status=String(s.student_status||'active').toLowerCase();
    return !s.deleted_at && !s.dismissed_at && !['dismissed','final_dismissed','expelled','withdrawn','deleted','inactive','suspended'].includes(status);
  }
  function cohort(s){
    const v=norm([s.program,s.system_name].filter(Boolean).join(' '));
    if(v.includes('دفعة 8') || v.includes('دفعه 8')) return '8';
    if(v.includes('دفعة 10') || v.includes('دفعه 10')) return '10';
    return '';
  }
  function system(s){
    const v=norm([s.program,s.system_name].filter(Boolean).join(' '));
    if(v.includes('احترافي')) return 'professional';
    if(v.includes('اساسي')) return 'basic';
    return '';
  }
  function installPanel(){
    const modal=$('#modal-exam');
    if(!modal) return;
    const body=$('.modal-body',modal);
    if(!body) return;
    let panel=$('#andalus-exam-targeting',modal);
    if(!panel){
      panel=document.createElement('section');
      panel.id='andalus-exam-targeting';
      panel.style.cssText='border:1px solid var(--border);border-radius:12px;padding:14px;margin:14px 0;background:var(--card-bg,transparent)';
      panel.innerHTML='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><label style="display:flex;align-items:center;gap:8px;font-weight:800"><input id="aet-enabled" type="checkbox"> قصر الامتحان على طلاب محددين فقط</label><span style="font-size:12px;color:var(--muted)">عند عدم التفعيل، يعمل الامتحان حسب الفرع والبرامج المحددة بالأعلى</span></div><div id="aet-controls" style="display:none;margin-top:12px"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><input id="aet-search" placeholder="بحث بالاسم أو رقم القيد" style="flex:1;min-width:180px;padding:9px;border:1px solid var(--border);border-radius:8px"><select id="aet-cohort" style="padding:8px;border:1px solid var(--border);border-radius:8px"><option value="">كل الدفعات</option><option value="8">دفعة 8</option><option value="10">دفعة 10</option></select><select id="aet-system" style="padding:8px;border:1px solid var(--border);border-radius:8px"><option value="">كل الأنظمة</option><option value="basic">نظام أساسي</option><option value="professional">نظام احترافي</option></select><button type="button" class="btn btn-outline btn-sm" id="aet-select-visible">تحديد الظاهر</button><button type="button" class="btn btn-outline btn-sm" id="aet-clear">إلغاء التحديد</button></div><div id="aet-count" style="font-size:12px;color:var(--muted);margin-bottom:8px"></div><div id="aet-students" style="max-height:260px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:8px"></div></div>';
      const footer=$('.modal-footer',modal);
      if(footer) footer.parentElement.insertBefore(panel,footer); else body.appendChild(panel);
      panel.addEventListener('change',e=>{
        if(e.target.id==='aet-enabled') $('#aet-controls',panel).style.display=e.target.checked?'block':'none';
        if(e.target.matches('[data-student-id]')){ if(e.target.checked) selected.add(e.target.value); else selected.delete(e.target.value); updateCount(); }
        if(['aet-cohort','aet-system'].includes(e.target.id)) render();
      });
      panel.addEventListener('input',e=>{if(e.target.id==='aet-search')render();});
      $('#aet-select-visible',panel).onclick=()=>{visibleStudents().forEach(s=>selected.add(String(s.id)));render();};
      $('#aet-clear',panel).onclick=()=>{selected.clear();render();};
    }
    render();
    installed=true;
  }
  function visibleStudents(){
    const branch=$('#exam-branch')?.value||'';
    const cohortValue=$('#aet-cohort')?.value||'';
    const systemValue=$('#aet-system')?.value||'';
    const search=norm($('#aet-search')?.value||'');
    return students().filter(s=>{
      if(!active(s)) return false;
      if(branch && s.branch!==branch) return false;
      if(cohortValue && cohort(s)!==cohortValue) return false;
      if(systemValue && system(s)!==systemValue) return false;
      if(search && !norm(s.name).includes(search) && !norm(s.enrollment_number||s.registration_number||'').includes(search)) return false;
      return true;
    });
  }
  function updateCount(){
    const count=$('#aet-count'); if(count) count.textContent='المحددون: '+selected.size+' طالب — الظاهرون: '+visibleStudents().length;
  }
  function render(){
    const box=$('#aet-students'); if(!box) return;
    const rows=visibleStudents();
    if(!students().length){box.innerHTML='<div style="padding:12px;color:var(--muted)">قائمة الطلاب لم تُحمّل بعد. افتح إدارة الطلاب ثم أعد فتح إنشاء الامتحان.</div>';updateCount();return;}
    box.innerHTML=rows.map(s=>{
      const id=String(s.id);
      const number=s.enrollment_number||s.registration_number||'—';
      return '<label style="display:flex;gap:9px;align-items:center;padding:7px;border-bottom:1px solid var(--border);cursor:pointer"><input type="checkbox" data-student-id value="'+esc(id)+'" '+(selected.has(id)?'checked':'')+'><span style="flex:1">'+esc(s.name)+'</span><small style="color:var(--muted)">قيد '+esc(number)+' · '+esc(s.branch||'')+' · '+esc(s.program||'')+'</small></label>';
    }).join('') || '<div style="padding:12px;color:var(--muted)">لا يوجد طلاب مطابقون للفلاتر الحالية.</div>';
    updateCount();
  }
  window.getAndalusExamTargetSelection=function(){
    const enabled=!!$('#aet-enabled')?.checked;
    return {enabled,studentIds:[...selected]};
  };
  const originalOpen=window.openCreateExam;
  if(typeof originalOpen==='function'&&!originalOpen.__targetingWrapped){
    const wrapped=function(){selected.clear();const result=originalOpen.apply(this,arguments);installPanel();return result;};
    wrapped.__targetingWrapped=true;window.openCreateExam=wrapped;
  }
  document.addEventListener('change',e=>{if(e.target?.id==='exam-branch'&&installed)render();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installPanel,{once:true});
  else installPanel();
})();