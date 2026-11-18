/* Andalus cohort-based overdue follow-up — read-only finance view */
(function(){
 'use strict';
 const BASE_MONTH='2026-11';
 const BASE_TARGET={8:4250,10:2750};
 const STEP=750;
 const money=n=>Number(n||0).toLocaleString('ar-EG')+' ج.م';
 const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 function targetFor(batch){
   const now=new Date(), y=now.getFullYear(), m=now.getMonth();
   const [by,bm]=BASE_MONTH.split('-').map(Number);
   const months=Math.max(0,(y-by)*12+(m-(bm-1)));
   return BASE_TARGET[batch]+months*STEP;
 }
 function rows(){
   if(typeof getCountedStudents!=='function'||typeof getStudentCohort!=='function'||typeof getStudentPaymentSummary!=='function')return [];
   return getCountedStudents().map(student=>{
     const cohort=getStudentCohort(student),linked=(allPrograms||[]).find(p=>p.id===student?.program_id),meta=[student?.system_name,student?.program,linked?.name].filter(Boolean).join(' ').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))),match=meta.match(/دفعة\s*(8|10)/),batch=Number(cohort?.batch)||(match?Number(match[1]):null);
     if(![8,10].includes(batch))return null;
     const pay=getStudentPaymentSummary(student);
     const target=targetFor(batch),paid=Number(pay?.totalPaid)||0,remaining=Math.max(0,target-paid);
     if(!(paid<target))return null;
     return {student,batch,target,paid,remaining,system:typeof getStudentPaymentSystem==='function'?(getStudentPaymentSystem(student)==='النظام الاحترافي'?'احترافي':getStudentPaymentSystem(student)==='النظام الأساسي'?'أساسي':'غير محدد'):(cohort.type==='professional'?'احترافي':cohort.type==='basic'?'أساسي':'غير محدد')};
   }).filter(Boolean).sort((a,b)=>b.remaining-a.remaining||String(a.student.name||'').localeCompare(String(b.student.name||''),'ar'));
 }
 function summaryHtml(){
   const all=rows(),groups=[8,10].map(batch=>{
     const list=all.filter(x=>x.batch===batch),target=targetFor(batch);
     return '<div class="stat-card" style="border-top:4px solid '+(batch===8?'#2563eb':'#d97706')+'"><div class="stat-label">دفعة '+batch+' — أقل من '+money(target)+'</div><div class="stat-value" style="color:#dc2626">'+list.length+'</div><div class="stat-sub">طالب لم يستكمل المستهدف · إجمالي النقص '+money(list.reduce((s,x)=>s+x.remaining,0))+'</div></div>';
   });
   return '<div class="card" id="cohort-overdue-dashboard" style="margin-bottom:18px"><div class="card-header"><h3>📌 ملخص المتأخرات حسب الدفعة</h3><span style="font-size:11px;color:var(--muted)">المستهدف الحالي يزيد 750 جنيه شهريًا</span></div><div class="stats-grid" style="padding:14px;margin:0">'+groups.join('')+'</div><div style="padding:0 14px 12px;font-size:11px;color:var(--muted)">لا يظهر الطالب إذا ساوى المستهدف أو تجاوزه. الحساب للمتابعة فقط ولا يغيّر أي إيصال أو تسجيل.</div></div>';
 }
 function detailHtml(){
   const all=rows();
   return '<div class="card" id="cohort-overdue-details" style="margin-bottom:18px"><div class="card-header"><h3>🚨 المتأخرون مع المصروفات — حسب الدفعة</h3><span style="font-size:11px;color:var(--muted)">الطالب يظهر إذا كان مدفوعه أقل من المستهدف ولو بجنيه واحد</span></div>'+
   [8,10].map(batch=>{
     const list=all.filter(x=>x.batch===batch),target=targetFor(batch);
     return '<div style="padding:12px 14px;border-bottom:1px solid var(--border)"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px"><strong>دفعة '+batch+'</strong><span style="font-size:12px;color:#b91c1c;font-weight:800">المستهدف: '+money(target)+' · المتأخرون: '+list.length+'</span></div>'+
       (list.length?'<div style="overflow:auto"><table style="min-width:720px"><thead><tr><th>الطالب</th><th>رقم القيد</th><th>النظام</th><th>الفرع</th><th>المستهدف</th><th>إجمالي المدفوع</th><th>الناقص</th></tr></thead><tbody>'+
       list.map(x=>'<tr><td><strong>'+esc(x.student.name)+'</strong></td><td>'+esc(x.student.id)+'</td><td>'+esc(x.system)+'</td><td>'+esc(x.student.branch||'—')+'</td><td>'+money(x.target)+'</td><td style="color:#15803d;font-weight:800">'+money(x.paid)+'</td><td style="color:#dc2626;font-weight:900">'+money(x.remaining)+'</td></tr>').join('')+
       '</tbody></table></div>':'<div style="padding:12px;color:#15803d;font-size:12px">لا يوجد طلاب متأخرون في هذه الدفعة؛ كل الطلاب بلغوا المستهدف أو تجاوزوه.</div>')+'</div>';
   }).join('')+'</div>';
 }
 function mount(){
   const dashboard=document.getElementById('page-dashboard');
   if(dashboard&&!document.getElementById('cohort-overdue-dashboard')){
     const anchor=document.getElementById('dashboard-finance-summary');
     const host=anchor?.parentElement||dashboard;
     const wrap=document.createElement('div');wrap.innerHTML=summaryHtml();
     if(anchor)host.insertBefore(wrap.firstElementChild,anchor);else host.prepend(wrap.firstElementChild);
   }
   const payments=document.getElementById('page-payments');
   if(payments&&!document.getElementById('cohort-overdue-details')){
     const anchor=payments.querySelector('.stats-grid');
     const wrap=document.createElement('div');wrap.innerHTML=detailHtml();
     if(anchor)payments.insertBefore(wrap.firstElementChild,anchor);else payments.prepend(wrap.firstElementChild);
   }
   const dashCard=document.getElementById('cohort-overdue-dashboard');
   if(dashCard)dashCard.outerHTML=summaryHtml();
   const detailCard=document.getElementById('cohort-overdue-details');
   if(detailCard)detailCard.outerHTML=detailHtml();
 }
 function refresh(){try{mount();}catch(e){console.warn('Cohort overdue view:',e);}}
 const oldRenderPayments=window.renderPayments;
 if(typeof oldRenderPayments==='function')window.renderPayments=function(){const result=oldRenderPayments.apply(this,arguments);refresh();return result;};
 const oldRisk=window.renderDashboardRiskPanels;
 if(typeof oldRisk==='function')window.renderDashboardRiskPanels=function(){const result=oldRisk.apply(this,arguments);refresh();return result;};
 const oldDaily=window.renderDailySummary;
 if(typeof oldDaily==='function')window.renderDailySummary=function(){const result=oldDaily.apply(this,arguments);refresh();return result;};
 document.addEventListener('DOMContentLoaded',refresh);
 setTimeout(refresh,0);
 window.refreshCohortOverdueFollowup=refresh;
})();