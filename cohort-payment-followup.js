/* Unified cohort collection rule — read-only; never writes student/payment records. */
(function(){
 'use strict';
 const BASE_MONTH='2026-11', BASE_TARGET={8:4250,10:2750}, STEP=750;
 const money=n=>Number(n||0).toLocaleString('ar-EG')+' ج.م';
 const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 function classify(student){
   let c={}; try{c=typeof getStudentCohort==='function'?getStudentCohort(student)||{}:{}}catch(_){}
   const meta=[student?.system_name,student?.program,(allPrograms||[]).find(p=>p.id===student?.program_id)?.name].filter(Boolean).join(' ').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).toLowerCase();
   const match=meta.match(/دفعة\s*(8|10)/);
   const batch=[8,10].includes(Number(c.batch))?Number(c.batch):(match?Number(match[1]):null);
   const system=typeof getStudentPaymentSystem==='function'?getStudentPaymentSystem(student):null;
   const type=/احتراف|professional/.test(meta)||system==='النظام الاحترافي'?'احترافي':(/اساس|basic/.test(meta)||system==='النظام الأساسي'?'أساسي':'غير محدد');
   return {batch,type,branch:c.branch||student?.branch||'—'};
 }
 function targetFor(batch){
   const [y,m]=BASE_MONTH.split('-').map(Number),now=new Date();
   const months=Math.max(0,(now.getFullYear()-y)*12+now.getMonth()-(m-1));
   return BASE_TARGET[batch]+months*STEP;
 }
 function allRows(source){
   const students=source||((typeof getCountedStudents==='function')?getCountedStudents():[]);
   return students.map(student=>{
     const c=classify(student); if(![8,10].includes(c.batch))return null;
     const summary=typeof getStudentPaymentSummary==='function'?getStudentPaymentSummary(student):{};
     const paid=Math.max(0,Number(summary?.totalPaid)||0),target=targetFor(c.batch);
     const courseTotal=typeof getStudentCourseTotal==='function'?Number(getStudentCourseTotal(student))||0:0;
     return {student,...c,target,paid,shortfall:Math.max(0,target-paid),courseRemaining:Math.max(0,courseTotal-paid),summary};
   }).filter(Boolean);
 }
 function dueRows(source){return allRows(source).filter(x=>x.paid<x.target-0.009).sort((a,b)=>b.shortfall-a.shortfall);}
 window.getAndalusUnifiedCollectionRows=allRows;
 window.getAndalusUnifiedOverdueRows=dueRows;
 window.getAndalusCohortTarget=targetFor;
 // Every legacy consumer of payment status now uses the same monthly cohort target.
 const legacyStatus=window.getStudentPayStatus;
 if(typeof legacyStatus==='function'&&!legacyStatus.__andalusUnified){
   const wrapped=function(student){
     const base=legacyStatus.apply(this,arguments),c=classify(student);
     if(![8,10].includes(c.batch))return base;
     const row=allRows([student])[0];
     return {...base,status:row.paid<row.target-0.009?'red':(base.remaining<=0.009?'green':'gray'),
       cohortBatch:row.batch,cohortTarget:row.target,cohortShortfall:row.shortfall};
   };
   wrapped.__andalusUnified=true; window.getStudentPayStatus=wrapped;
 }
 function scope(){return typeof dashboardScopedStudents==='function'?dashboardScopedStudents():((typeof getCountedStudents==='function')?getCountedStudents():[]);}
 function refreshFinanceRisk(){
   const students=scope(),rows=allRows(students),late=rows.filter(x=>x.shortfall>0.009);
   const count=document.getElementById('risk-finance-count'),total=document.getElementById('risk-finance-total'),list=document.getElementById('risk-finance-list');
   if(count)count.textContent=late.length;
   if(total)total.textContent='المتأخرون حسب مستهدف الدفعة: '+late.length+' · إجمالي النقص المستحق: '+money(late.reduce((s,x)=>s+x.shortfall,0))+' · إجمالي المتبقي على رسوم الكورس: '+money(rows.reduce((s,x)=>s+x.courseRemaining,0));
   if(list)list.innerHTML=late.length?late.map(x=>dashboardStudentLine(x.student,'دفعة '+x.batch+' · '+x.type+' · نقص '+money(x.shortfall),'#dc2626')).join(''):'<div style="padding:12px;color:#15803a;font-size:12px;">لا يوجد متأخرون؛ كل الطلاب المصنفين بلغوا المستهدف الحالي أو تجاوزوه.</div>';
 }
 const openBatches=new Set();
 function toggleCohortOverdue(batch){
   const panel=document.getElementById('cohort-overdue-names-'+batch);
   const card=document.getElementById('cohort-overdue-card-'+batch);
   if(!panel||!card)return;
   const opening=panel.style.display==='none';
   panel.style.display=opening?'block':'none';
   card.setAttribute('aria-expanded',opening?'true':'false');
   const hint=card.querySelector('.cohort-card-hint');
   if(hint)hint.textContent=opening?'اضغط لإخفاء الأسماء':'اضغط لعرض أسماء الطلاب';
   if(opening)openBatches.add(batch);else openBatches.delete(batch);
 }
 window.toggleCohortOverdue=toggleCohortOverdue;
 function cohortNamesPanel(batch,list){
   return '<div id="cohort-overdue-names-'+batch+'" style="display:'+(openBatches.has(batch)?'block':'none')+';padding:10px 12px 14px;border-top:1px solid var(--border);background:var(--surface, #fff);">'+
   (list.length?list.map(x=>'<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 2px;border-bottom:1px solid var(--border);flex-wrap:wrap"><div style="min-width:0"><strong style="font-size:13px">'+esc(x.student.name)+'</strong><div style="font-size:11px;color:var(--muted)">قيد '+esc(x.student.id)+' · '+esc(x.type)+' · '+esc(x.branch)+'</div></div><div style="text-align:left;font-size:11px"><div>دفع: '+money(x.paid)+'</div><strong style="color:#dc2626">ناقص: '+money(x.shortfall)+'</strong></div></div>').join(''):'<div style="padding:12px;color:#15803a">لا يوجد طلاب متأخرون في هذه الدفعة.</div>')+
   '</div>';
 }
 function renderUnifiedCards(){
   const rows=dueRows(),groups=[8,10].map(batch=>{
     const list=rows.filter(x=>x.batch===batch),target=targetFor(batch);
     return '<div id="cohort-overdue-card-'+batch+'" role="button" tabindex="0" aria-expanded="'+(openBatches.has(batch)?'true':'false')+'" onclick="toggleCohortOverdue('+batch+')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();toggleCohortOverdue('+batch+')}" class="stat-card" style="border-top:4px solid '+(batch===8?'#2563eb':'#d97706')+';cursor:pointer;transition:transform .15s,box-shadow .15s" title="اضغط لعرض أسماء الطلاب المتأخرين"><div class="stat-label">دفعة '+batch+' — المستهدف '+money(target)+'</div><div class="stat-value" style="color:#dc2626">'+list.length+'</div><div class="stat-sub">إجمالي النقص '+money(list.reduce((s,x)=>s+x.shortfall,0))+'</div><div class="cohort-card-hint" style="font-size:11px;color:var(--primary,#2563eb);font-weight:700;margin-top:7px">اضغط لعرض أسماء الطلاب</div>'+cohortNamesPanel(batch,list)+'</div>';
   });
   const html='<div class="card" id="cohort-overdue-dashboard" style="margin-bottom:18px"><div class="card-header"><h3>📌 متابعة التحصيل الموحدة حسب الدفعة</h3><span style="font-size:11px;color:var(--muted)">يزيد المستهدف 750 جنيه مع بداية كل شهر</span></div><div class="stats-grid" style="padding:14px;margin:0">'+groups.join('')+'</div><div style="padding:0 14px 12px;font-size:11px;color:var(--muted)">اضغط على كارت الدفعة لعرض أسماء المتأخرين. المتأخر فقط من دفع أقل من المستهدف.</div></div>';
   const dash=document.getElementById('page-dashboard');
   if(dash){const anchor=document.getElementById('dashboard-finance-summary');let card=document.getElementById('cohort-overdue-dashboard');if(!card){const w=document.createElement('div');w.innerHTML=html;card=w.firstElementChild;if(anchor)anchor.parentElement.insertBefore(card,anchor);else dash.prepend(card);}else card.outerHTML=html;}
   const pay=document.getElementById('page-payments');
   if(pay){let card=document.getElementById('cohort-overdue-details');const detail='<div class="card" id="cohort-overdue-details" style="margin-bottom:18px"><div class="card-header"><h3>🚨 كشف المتأخرين الموحد — حسب الدفعة</h3><span style="font-size:11px;color:var(--muted)">اضغط على الدفعة لعرض الأسماء</span></div>'+[8,10].map(batch=>{
     const list=rows.filter(x=>x.batch===batch);
     return '<section style="padding:12px 14px;border-bottom:1px solid var(--border)"><button type="button" onclick="toggleCohortOverdue('+batch+')" style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px;border:1px solid var(--border);border-radius:10px;background:var(--card-bg,transparent);color:inherit;font:inherit;cursor:pointer"><strong>دفعة '+batch+' — '+list.length+' متأخر</strong><span style="color:#b91c1c;font-weight:800">المستهدف '+money(targetFor(batch))+' · نقص '+money(list.reduce((a,x)=>a+x.shortfall,0))+'</span></button>'+cohortNamesPanel(batch,list)+'</section>';
   }).join('')+'</div>';
   if(!card){const w=document.createElement('div');w.innerHTML=detail;const anchor=pay.querySelector('.stats-grid');if(anchor)pay.insertBefore(w.firstElementChild,anchor);else pay.prepend(w.firstElementChild);}else card.outerHTML=detail;
   }
 }
 const oldRisk=window.renderDashboardRiskPanels;
 if(typeof oldRisk==='function'&&!oldRisk.__andalusUnified){const f=function(){oldRisk.apply(this,arguments);refreshFinanceRisk();};f.__andalusUnified=true;window.renderDashboardRiskPanels=f;}
 const oldUpdate=window.updateDashboard;
 if(typeof oldUpdate==='function'&&!oldUpdate.__andalusUnified){const f=function(){const r=oldUpdate.apply(this,arguments);const rows=dueRows(scope());const el=document.getElementById('stat-late-pay');if(el)el.textContent=rows.length;return r;};f.__andalusUnified=true;window.updateDashboard=f;}
 const oldDaily=window.renderDailySummary;
 if(typeof oldDaily==='function'&&!oldDaily.__andalusUnified){const f=function(){const r=oldDaily.apply(this,arguments);const el=document.getElementById('daily-summary-content');if(el){const count=dueRows().length;el.innerHTML=el.innerHTML.replace(/<strong>\d+ طالب<\/strong> متأخرين فى دفع المصروفات[^<]*/g,'<strong>'+count+' طالب</strong> متأخرين حسب مستهدف الدفعة');if(!count)el.innerHTML=el.innerHTML.replace(/<div[^>]*>💸[\s\S]*?<\/div>/g,'');}return r;};f.__andalusUnified=true;window.renderDailySummary=f;}
 function refresh(){try{renderUnifiedCards();refreshFinanceRisk();const stat=document.getElementById('stat-late-pay');if(stat)stat.textContent=dueRows(scope()).length;}catch(e){console.warn('Unified collection view:',e);}}
 document.addEventListener('DOMContentLoaded',refresh);setTimeout(refresh,0);
 const oldPayments=window.renderPayments;
 if(typeof oldPayments==='function'&&!oldPayments.__andalusUnified){const f=function(){const r=oldPayments.apply(this,arguments);refresh();return r;};f.__andalusUnified=true;window.renderPayments=f;}
 window.refreshCohortOverdueFollowup=refresh;
})();