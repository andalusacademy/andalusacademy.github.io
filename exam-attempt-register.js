/* Andalus Academy — centralized electronic exam attempt register */
(function(){
 'use strict';
 if(window.__andalusExamAttemptRegisterV1)return;window.__andalusExamAttemptRegisterV1=true;
 const $=(s,r=document)=>r.querySelector(s);
 const esc=v=>typeof window.escapeHtml==='function'?window.escapeHtml(String(v??'')):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const fmt=v=>v?new Date(v).toLocaleString('ar-EG',{dateStyle:'short',timeStyle:'short'}):'—';
 let rows=[],filter='all',search='';
 function mount(){
  const page=$('#page-exams');if(!page||$('#exam-attempt-register'))return;
  const cards=[...page.querySelectorAll('.card')];const anchor=cards.find(c=>c.querySelector('#exams-table'))||cards[cards.length-1];
  const section=document.createElement('section');section.id='exam-attempt-register';section.className='card';section.style.cssText='margin-top:18px;padding:16px';
  section.innerHTML='<div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><h3 style="margin:0">📋 سجل دخول وتسليم الامتحانات</h3><div style="font-size:12px;color:var(--muted);margin-top:5px">متابعة كل محاولات الطلاب ونتائجهم وملاحظات المخالفات وإجراءات الدعم</div></div><button class="btn btn-info btn-sm" id="ear-refresh">↻ تحديث السجل</button></div><div id="ear-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:8px;margin:14px 0"></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><input id="ear-search" placeholder="بحث برقم القيد أو اسم الطالب أو رقم الهاتف أو الامتحان" style="flex:1;min-width:240px;padding:10px;border:1px solid var(--border);border-radius:9px"><select id="ear-filter" style="padding:10px;border:1px solid var(--border);border-radius:9px"><option value="all">كل المحاولات</option><option value="submitted">تم التسليم</option><option value="abandoned">لم يسلم</option><option value="in_progress">جارية</option><option value="cheating">ملاحظات ومخالفات</option></select></div><div style="overflow:auto"><table style="min-width:1180px;width:100%"><thead><tr><th>رقم القيد</th><th>اسم الطالب</th><th>الهاتف</th><th>الامتحان</th><th>وقت الدخول</th><th>وقت التسليم</th><th>الحالة</th><th>النتيجة</th><th>ملاحظات / غش</th><th>إجراءات الإدارة</th></tr></thead><tbody id="ear-body"><tr><td colspan="10" style="text-align:center;padding:18px">اضغط تحديث السجل لعرض المحاولات</td></tr></tbody></table></div><div style="font-size:11px;color:var(--muted);margin-top:8px">السجل يعرض المحاولات المسجلة فعليًا في قاعدة البيانات؛ الطالب الذي لم يبدأ لا يظهر كسجل محاولة.</div>';
  if(anchor)anchor.insertAdjacentElement('afterend',section);else page.appendChild(section);
  $('#ear-refresh').onclick=load;
  $('#ear-stats').addEventListener('click',e=>{const b=e.target.closest('[data-ear-filter]');if(!b)return;filter=b.dataset.earFilter;$('#ear-filter').value=filter;render();});
  $('#ear-search').oninput=e=>{search=e.target.value.trim().toLowerCase();render();};
  $('#ear-filter').onchange=e=>{filter=e.target.value;render();};
 }
 function student(id){const list=typeof allStudents!=='undefined'?allStudents:(window.allStudents||[]);return list.find(s=>String(s.id)===String(id))||{};}
 function exam(id){const list=typeof allExams!=='undefined'?allExams:(window.allExams||[]);return list.find(e=>String(e.id)===String(id))||{};}
 function status(a){if(a.status==='submitted')return 'تم التسليم';if(a.status==='in_progress')return 'جارية — لم يتم التسليم بعد';if(a.status==='abandoned')return 'لم يسلم — محاولة متروكة';return a.status||'غير معروف';}
 async function load(){
  mount();const body=$('#ear-body');if(!body)return;body.innerHTML='<tr><td colspan="10" style="text-align:center;padding:18px">جاري تحميل سجل المحاولات...</td></tr>';
  const db=typeof sb!=='undefined'?sb:window.sb;if(!db){body.innerHTML='<tr><td colspan="10">قاعدة البيانات غير متاحة</td></tr>';return;}
  const {data,error}=await db.from('exam_attempts').select('*').order('started_at',{ascending:false}).limit(2000);
  if(error){body.innerHTML='<tr><td colspan="10" style="color:#b91c1c">تعذر تحميل السجل: '+esc(error.message)+'</td></tr>';return;}
  rows=data||[];render();
 }
 function render(){
  const body=$('#ear-body');if(!body)return;
  const filtered=rows.filter(a=>{const s=student(a.student_id),e=exam(a.exam_id),hay=[s.enrollment_number,s.id,s.name,s.phone,e.title].join(' ').toLowerCase();if(search&&!hay.includes(search))return false;if(filter==='submitted'&&a.status!=='submitted')return false;if(filter==='in_progress'&&a.status!=='in_progress')return false;if(filter==='abandoned'&&a.status!=='abandoned')return false;if(filter==='cheating'&&!((a.flagged_cheating)||(Number(a.violation_count)>0)||(Array.isArray(a.violation_log)&&a.violation_log.length)))return false;return true;});
  const stat=(n,l,f)=>'<button type="button" data-ear-filter="'+f+'" style="cursor:pointer;border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:10px;padding:10px;text-align:center"><b style="font-size:22px;display:block">'+n+'</b><span style="font-size:11px;color:var(--muted)">'+l+'</span></button>';
  const stats=$('#ear-stats');if(stats)stats.innerHTML=stat(rows.length,'إجمالي المحاولات','all')+stat(rows.filter(a=>a.status==='submitted').length,'تم التسليم','submitted')+stat(rows.filter(a=>a.status==='abandoned').length,'لم يسلم','abandoned')+stat(rows.filter(a=>a.status==='in_progress').length,'جارية','in_progress')+stat(rows.filter(a=>a.flagged_cheating||Number(a.violation_count)>0||(Array.isArray(a.violation_log)&&a.violation_log.length)).length,'ملاحظات ومخالفات','cheating');
  if(!filtered.length){body.innerHTML='<tr><td colspan="10" style="text-align:center;padding:18px">لا توجد محاولات مطابقة.</td></tr>';return;}
  body.innerHTML=filtered.map(a=>{
   const s=student(a.student_id),e=exam(a.exam_id),pct=Number(a.max_score)>0?Math.round(Number(a.score||0)/Number(a.max_score)*100):0;
   const note=a.flagged_cheating?'اشتباه غش':(Number(a.violation_count)>0?'عدد المخالفات: '+a.violation_count:'لا توجد مخالفات مسجلة');
   const details=Array.isArray(a.violation_log)&&a.violation_log.length?a.violation_log.map(v=>typeof v==='string'?v:(v.message||v.type||JSON.stringify(v))).join(' • '):'';
   const result=a.status==='submitted'?(Number(a.score||0)+' / '+Number(a.max_score||e.total_score||100)+' ('+pct+'%)'):'لم تُرصد نتيجة بعد';
   const answerStats='<div style="font-size:11px;white-space:nowrap">✓ '+(a.correct_count??'—')+' | ✗ '+(a.incorrect_count??'—')+' | لم يجب '+(a.unanswered_count??'—')+'</div>';
   const pass=a.status==='submitted'?(a.flagged_cheating?'راسب — اشتباه غش':(pct>=50?'ناجح':'راسب')):'—';
   let action='—';
   if(a.status==='in_progress')action='<button class="btn btn-success btn-sm" onclick="window.andalusExamAddTime(\''+a.id+'\')">＋ إضافة وقت</button> <button class="btn btn-outline btn-sm" onclick="window.andalusExamResetTime(\''+a.id+'\')">↻ إعادة الوقت</button>';
   else if(a.status==='submitted')action='<button class="btn btn-success btn-sm" onclick="window.andalusExamReopen(\''+a.id+'\')">إعادة فتح + وقت</button> <button class="btn btn-outline btn-sm" onclick="window.andalusExamRestart(\''+a.id+'\')">محاولة جديدة من البداية</button>';
   return '<tr><td><b>'+esc(s.enrollment_number||s.id||a.student_id)+'</b></td><td>'+esc(s.name||'طالب غير موجود في القائمة الحالية')+'</td><td>'+esc(s.phone||'—')+'</td><td>'+esc(e.title||'امتحان محذوف أو غير متاح')+'</td><td>'+fmt(a.started_at)+'</td><td>'+fmt(a.submitted_at)+'</td><td><b>'+esc(status(a))+'</b><div style="font-size:11px;color:var(--muted)">'+esc(pass)+'</div></td><td>'+esc(result)+'</td><td style="max-width:230px;white-space:normal">'+esc(note)+(details?'<details><summary>تفاصيل الملاحظات</summary>'+esc(details)+'</details>':'')+(a.unanswered_count!=null?'<div style="font-size:11px">غير مجاب: '+Number(a.unanswered_count)+'</div>':'')+'</td><td style="white-space:nowrap">'+action+' <button class="btn btn-outline btn-sm" onclick="viewExamAttemptAudit(\''+a.id+'\')">سجل التفاصيل</button></td></tr>';
  }).join('');
 }
 function find(id){return rows.find(a=>a.id===id);}
 async function rpc(name,args){const {data,error}=await window.sb.rpc(name,args);if(error||!data?.ok){(window.showToast||alert)(error?.message||data?.message||'تعذر تنفيذ الإجراء','error');return false;}(window.showToast||alert)(data.message||'تم تنفيذ الإجراء بنجاح');await load();return true;}
 window.andalusExamAddTime=async id=>{const a=find(id);if(!a)return;const raw=prompt('حدد عدد الدقائق الإضافية (1 إلى 180):','5');if(raw===null)return;const n=Number(raw);if(!Number.isInteger(n)||n<1||n>180)return (window.showToast||alert)('أدخل عدد دقائق صحيحًا من 1 إلى 180','error');await rpc('admin_adjust_exam_attempt_time',{p_attempt_id:id,p_minutes:n,p_reset_full:false});};
 window.andalusExamResetTime=async id=>{if(!confirm('إعادة ضبط وقت المحاولة بالكامل مع الاحتفاظ بالإجابات المحفوظة؟'))return;await rpc('admin_adjust_exam_attempt_time',{p_attempt_id:id,p_minutes:0,p_reset_full:true});};
 window.andalusExamReopen=async id=>{const raw=prompt('كم دقيقة إضافية تريد منحها عند إعادة فتح المحاولة؟','5');if(raw===null)return;const n=Number(raw);if(!Number.isInteger(n)||n<1||n>180)return (window.showToast||alert)('أدخل عدد دقائق صحيحًا من 1 إلى 180','error');await rpc('admin_reopen_exam_attempt',{p_attempt_id:id,p_extra_minutes:n,p_restart:false});};
 window.andalusExamRestart=async id=>{if(!confirm('بدء محاولة جديدة من الصفر؟ سيتم مسح إجابات ونتيجة المحاولة السابقة.'))return;await rpc('admin_reopen_exam_attempt',{p_attempt_id:id,p_extra_minutes:0,p_restart:true});};
 const originalShow=window.showPage;if(typeof originalShow==='function'&&!originalShow.__examRegisterWrapped){const wrapped=function(p){const r=originalShow.apply(this,arguments);if(p==='exams')setTimeout(()=>{mount();load();},0);return r;};wrapped.__examRegisterWrapped=true;window.showPage=wrapped;}
 document.addEventListener('DOMContentLoaded',()=>{mount();});
 setTimeout(()=>{mount();if($('#page-exams')?.classList.contains('active'))load();},1200);
 window.refreshAndalusExamAttemptRegister=load;
})();