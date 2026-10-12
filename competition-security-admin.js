/* Admin-only competition security audit panel */
(()=> {
const $=id=>document.getElementById(id);
let installed=false;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setup(){
 if(installed)return;
 let admin=false;try{admin=typeof currentUser!=='undefined'&&currentUser&&currentUser.role==='admin'}catch(_){}
 if(!admin)return;
 installed=true;
 const style=document.createElement('style');style.textContent='#and-sec-btn{position:fixed;left:16px;bottom:78px;z-index:99990;background:#173d72;color:#fff;border:0;border-radius:12px;padding:12px 16px;font-weight:800;box-shadow:0 6px 24px #0003;cursor:pointer}#and-sec-panel{position:fixed;inset:0;z-index:999999;background:#07172dcc;display:none;align-items:center;justify-content:center;padding:12px;direction:rtl}#and-sec-panel .inner{background:#fff;color:#172033;border-radius:16px;width:min(1100px,100%);max-height:92vh;overflow:auto;padding:18px;font-family:Arial,sans-serif}#and-sec-panel table{border-collapse:collapse;width:100%;font-size:12px}#and-sec-panel th,#and-sec-panel td{padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;vertical-align:top}#and-sec-panel th{background:#f1f5f9;position:sticky;top:0}#and-sec-panel .tools{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}#and-sec-panel button{padding:9px 12px;border:0;border-radius:8px;cursor:pointer;font-weight:bold}';document.head.appendChild(style);
 const b=document.createElement('button');b.id='and-sec-btn';b.textContent='🛡 سجل أمان المسابقات';b.onclick=show;document.body.appendChild(b);
 const p=document.createElement('div');p.id='and-sec-panel';p.innerHTML='<div class="inner"><button id="and-sec-close" style="float:left">إغلاق ✕</button><h2>🛡 سجل أمان المسابقات</h2><p>آخر 200 محاولة مسجلة في المسابقة الأسبوعية والمسابقات العامة.</p><div id="and-sec-summary"></div><div class="tools"><button id="and-sec-refresh">تحديث السجل</button><select id="and-sec-filter"><option value="all">كل النتائج</option><option value="failure">فشل</option><option value="blocked">محظور</option><option value="success">نجاح</option><option value="pending">قيد التحقق</option></select></div><div id="and-sec-content">اضغط تحديث السجل.</div></div>';document.body.appendChild(p);
 $('and-sec-close').onclick=()=>p.style.display='none';$('and-sec-refresh').onclick=load;$('and-sec-filter').onchange=load;p.addEventListener('click',e=>{if(e.target===p)p.style.display='none'});
}
async function show(){setup();if(!$('and-sec-panel'))return;$('and-sec-panel').style.display='flex';await load()}
async function load(){
 const content=$('and-sec-content');content.textContent='جاري تحميل السجل الأمني...';
 try{
  const c=typeof sb!=='undefined'?sb:window.sb;if(!c)throw Error('تعذر الاتصال بالنظام');
  const {data:logs,error}=await c.rpc('competition_security_admin_logs',{p_limit:200});
  if(error)throw error;
  const rowsAll=logs||[],filter=$('and-sec-filter').value;
  const counts={success:0,failure:0,blocked:0,pending:0};rowsAll.forEach(x=>{if(counts[x.outcome]!==undefined)counts[x.outcome]++});
  $('and-sec-summary').innerHTML='<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">'+[['الإجمالي',rowsAll.length],['نجاح',counts.success],['فشل',counts.failure],['محظور',counts.blocked],['قيد التحقق',counts.pending]].map(x=>'<div style="padding:10px 14px;background:#f1f5f9;border-radius:9px"><b>'+x[0]+'</b><div style="font-size:20px;font-weight:900">'+x[1]+'</div></div>').join('')+'</div>';
  const rows=rowsAll.filter(x=>filter==='all'||x.outcome===filter);
  content.innerHTML=rows.length?'<div style="overflow:auto"><table><thead><tr><th>الوقت</th><th>رقم القيد</th><th>نوع المسابقة</th><th>الحدث</th><th>النتيجة</th><th>السبب</th><th>IP</th><th>الجهاز</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.created_at?new Date(x.created_at).toLocaleString('ar-EG'):'')+'</td><td>'+esc(x.enrollment_number||'—')+'</td><td>'+esc(x.competition_type==='weekly_quiz'?'الأسبوعية':'عامة')+'</td><td>'+esc(x.event_type)+'</td><td>'+esc(x.outcome)+'</td><td>'+esc(x.reason||'—')+'</td><td>'+esc(x.ip_address||'—')+'</td><td>'+esc(x.device_label||x.user_agent||'—')+'</td></tr>').join('')+'</tbody></table></div>':'لا توجد محاولات مطابقة للفلتر.';
 }catch(e){content.textContent='تعذر تحميل السجل: '+(e.message||'خطأ غير معروف')}
}
setInterval(setup,1200);
})();
