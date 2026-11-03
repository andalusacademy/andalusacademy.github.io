/* Andalus AI Tutor — unified subscription management */
(() => {
  'use strict';
  const MODAL_ID='andalus-ai-subscription-management';
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const sbc=()=>window.sb||null;
  const fmtDate=v=>v?new Date(v).toLocaleString('ar-EG'):'—';
  const daysLeft=v=>Math.max(0,Math.ceil((new Date(v)-Date.now())/86400000));
  const active=s=>s&&s.status==='active'&&new Date(s.expires_at)>new Date();
  const money=v=>Number(v||0).toLocaleString('ar-EG');

  function ensureButton(){
    const box=document.getElementById('student-ai-admin-dashboard');
    if(!box)return;
    const header=box.querySelector('.card-header');
    if(!header||document.getElementById('ai-subscription-management-btn'))return;
    const group=header.querySelector('div[style*="display:flex"]')||header.lastElementChild;
    const b=document.createElement('button');
    b.id='ai-subscription-management-btn';
    b.className='btn btn-gold';
    b.type='button';
    b.textContent='💳 إدارة الاشتراكات';
    b.style.marginInlineEnd='6px';
    b.onclick=openManagement;
    if(group)group.insertBefore(b,group.firstChild); else header.appendChild(b);
  }

  async function loadReport(){
    const c=sbc();
    if(!c)throw Error('اتصال قاعدة البيانات غير متاح.');
    const r=await c.rpc('student_ai_admin_subscription_report');
    if(r.error)throw r.error;
    if(!r.data?.ok)throw Error(r.data?.reason||'غير مصرح.');
    const usage=await c.from('student_ai_usage_daily').select('student_id,used_seconds').eq('usage_date',new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'})).limit(1000);
    if(usage.error)throw usage.error;
    return {...r.data,usage:usage.data||[]};
  }

  function usageFor(data,id){return Number((data.usage||[]).find(x=>String(x.student_id)===String(id))?.used_seconds||0)}
  function dur(sec){sec=Math.max(0,Math.floor(Number(sec)||0));return `${Math.floor(sec/3600)} س ${Math.floor(sec%3600/60)} د`}

  function shell(){
    let m=document.getElementById(MODAL_ID);
    if(!m){
      m=document.createElement('div');m.id=MODAL_ID;
      m.style.cssText='position:fixed;inset:2.5%;z-index:14000;background:#fff;overflow:auto;border-radius:20px;border:1px solid #dbe5ee;box-shadow:0 30px 100px #0006;direction:rtl';
      document.body.appendChild(m);
    }
    return m;
  }

  function render(data){
    const m=shell();
    const subs=data.subscriptions||[],orders=data.orders||[],plan=data.plan||{};
    const activeSubs=subs.filter(active), pending=orders.filter(o=>['pending_payment','payment_submitted'].includes(o.status));
    const expired=subs.filter(s=>s.status==='expired'||(s.status==='active'&&!active(s))).length;
    const approvedOrders=orders.filter(o=>o.status==='approved');
    const revenue=approvedOrders.reduce((n,o)=>n+Number(o.amount||0),0);
    const today=new Date().toLocaleDateString('ar-EG',{timeZone:'Africa/Cairo'});
    const statusLabel={pending_payment:'في انتظار التحويل',payment_submitted:'مرجع التحويل وصل',approved:'معتمد',rejected:'مرفوض',cancelled:'ملغي'};
    m.innerHTML=`
      <div class="card-header" style="position:sticky;top:0;background:#fff;z-index:3;border-bottom:1px solid #e8eef4">
        <div><h2 style="margin:0">💳 إدارة اشتراكات المدرس الخصوصي AI</h2><div style="font-size:12px;color:var(--muted);margin-top:4px">باقة واحدة: 30 يوم + ساعتان استخدام فعلي يوميًا</div></div>
        <div style="display:flex;gap:7px"><button class="btn btn-outline" id="ai-sub-refresh">🔄 تحديث</button><button class="btn btn-outline" id="ai-sub-close">إغلاق</button></div>
      </div>
      <div style="padding:18px">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:10px;margin-bottom:16px">
          <div class="card" style="padding:14px"><b>سعر الاشتراك</b><div style="font-size:25px;margin-top:5px">${money(plan.price)} ج.م</div></div>
          <div class="card" style="padding:14px"><b>الاشتراكات النشطة</b><div style="font-size:25px;margin-top:5px">${activeSubs.length}</div></div>
          <div class="card" style="padding:14px"><b>طلبات المراجعة</b><div style="font-size:25px;margin-top:5px">${pending.length}</div></div>
          <div class="card" style="padding:14px"><b>اشتراكات منتهية</b><div style="font-size:25px;margin-top:5px">${expired}</div></div>
          <div class="card" style="padding:14px"><b>إيراد الطلبات المعتمدة</b><div style="font-size:25px;margin-top:5px">${money(revenue)} ج.م</div></div>
        </div>

        <section class="card" style="padding:15px;margin-bottom:15px;background:#f8fbff">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div><b>🎓 الباقة الحالية</b><div style="font-size:13px;margin-top:6px">${esc(plan.title||'المدرس الخصوصي AI')} — 30 يوم — ساعتان يوميًا</div><div style="font-size:12px;color:var(--muted);margin-top:4px">العداد يحسب الاستخدام الفعلي داخل صفحة المدرس فقط، ولا يرحّل الوقت غير المستخدم لليوم التالي.</div></div><span class="badge ${plan.is_active===false?'badge-danger':'badge-success'}">${plan.is_active===false?'غير مفعلة':'مفعلة'}</span></div>
        </section>

        <section class="card" style="padding:15px;margin-bottom:15px">
          <div class="card-header"><h3 style="margin:0">🧾 طلبات الاشتراك والدفع</h3><span style="font-size:12px;color:var(--muted)">${orders.length} طلب</span></div>
          <div style="overflow:auto;margin-top:10px"><table style="width:100%;border-collapse:collapse;min-width:1000px"><thead><tr><th>الطالب</th><th>المبلغ</th><th>الحالة</th><th>المرجع</th><th>كود الطلب</th><th>تاريخ الطلب</th><th>الإجراء</th></tr></thead><tbody>
          ${orders.length?orders.map(o=>`<tr><td><b>${esc(o.student_name||'—')}</b><br><small>${esc(o.enrollment_number||'—')}</small></td><td>${money(o.amount)} ج.م</td><td><span class="badge ${o.status==='approved'?'badge-success':o.status==='rejected'?'badge-danger':'badge-warning'}">${esc(statusLabel[o.status]||o.status)}</span></td><td>${esc(o.payment_reference||'—')}</td><td>${esc(o.order_code||'—')}</td><td>${fmtDate(o.created_at)}</td><td>${o.status==='payment_submitted'?`<button class="btn btn-gold btn-sm" data-sub-approve="${o.id}">✅ اعتماد 30 يوم</button> <button class="btn btn-danger btn-sm" data-sub-reject="${o.id}">❌ رفض</button>`:'—'}</td></tr>`).join(''):'<tr><td colspan="7" style="padding:20px;text-align:center;color:var(--muted)">لا توجد طلبات.</td></tr>'}
          </tbody></table></div>
        </section>

        <section class="card" style="padding:15px;margin-bottom:15px">
          <div class="card-header"><h3 style="margin:0">🟢 الاشتراكات النشطة</h3><span style="font-size:12px;color:var(--muted)">${activeSubs.length} اشتراك</span></div>
          <div style="overflow:auto;margin-top:10px"><table style="width:100%;border-collapse:collapse;min-width:1050px"><thead><tr><th>الطالب</th><th>البداية</th><th>الانتهاء</th><th>المتبقي</th><th>استخدام اليوم</th><th>رقم الطلب</th><th>الإجراء</th></tr></thead><tbody>
          ${activeSubs.length?activeSubs.map(s=>`<tr><td><b>${esc(s.student_name||'—')}</b><br><small>${esc(s.enrollment_number||'—')}</small></td><td>${fmtDate(s.starts_at)}</td><td>${fmtDate(s.expires_at)}</td><td><span class="badge ${daysLeft(s.expires_at)<=3?'badge-warning':'badge-success'}">${daysLeft(s.expires_at)} يوم</span></td><td>${dur(usageFor(data,s.student_id))} / 2 س</td><td>${esc(s.order_code||'منح يدوي')}</td><td><button class="btn btn-danger btn-sm" data-sub-revoke="${s.student_id}">منع الإتاحة</button></td></tr>`).join(''):'<tr><td colspan="7" style="padding:20px;text-align:center;color:var(--muted)">لا توجد اشتراكات نشطة.</td></tr>'}
          </tbody></table></div>
        </section>

        <section class="card" style="padding:15px;margin-bottom:15px">
          <div class="card-header"><h3 style="margin:0">🎁 منح اشتراك يدوي</h3></div>
          <div style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:10px"><input id="ai-sub-student-search" class="form-control" placeholder="ابحث بالاسم أو رقم القيد"><button class="btn btn-gold" id="ai-sub-search">بحث</button></div>
          <div id="ai-sub-search-results" style="margin-top:10px;color:var(--muted)">استخدم هذا فقط للمنح الإدارية، وليس لتسجيل دفعة.</div>
        </section>

        <section class="card" style="padding:15px">
          <div class="card-header"><h3 style="margin:0">📚 سجل الاشتراكات</h3><span style="font-size:12px;color:var(--muted)">${subs.length} سجل</span></div>
          <div style="overflow:auto;margin-top:10px"><table style="width:100%;border-collapse:collapse;min-width:1000px"><thead><tr><th>الطالب</th><th>النوع</th><th>الحالة</th><th>البداية</th><th>النهاية</th><th>الدفع</th><th>المرجع</th></tr></thead><tbody>
          ${subs.length?subs.map(s=>`<tr><td>${esc(s.student_name||'—')}<br><small>${esc(s.enrollment_number||'—')}</small></td><td>${s.access_type==='trial'?'تجربة مجانية':'اشتراك مدفوع'}</td><td><span class="badge ${active(s)?'badge-success':s.status==='revoked'?'badge-danger':'badge-warning'}">${active(s)?'نشط':s.status==='revoked'?'مسحوب':'منتهي'}</span></td><td>${fmtDate(s.starts_at)}</td><td>${fmtDate(s.expires_at)}</td><td>${s.amount!=null?money(s.amount)+' ج.م':s.access_type==='trial'?'مجاني':'منح يدوي'}</td><td>${esc(s.payment_reference||s.order_code||'—')}</td></tr>`).join(''):'<tr><td colspan="7" style="padding:20px;text-align:center;color:var(--muted)">لا يوجد سجل بعد.</td></tr>'}
          </tbody></table></div>
        </section>
        <div style="font-size:11px;color:var(--muted);margin-top:12px">آخر تحديث: ${esc(today)}</div>
      </div>`;
    bind(data);
  }

  async function bind(data){
    document.getElementById('ai-sub-close').onclick=()=>document.getElementById(MODAL_ID)?.remove();
    document.getElementById('ai-sub-refresh').onclick=refresh;
    document.querySelectorAll('[data-sub-approve]').forEach(b=>b.onclick=async()=>{if(!confirm('اعتماد الدفع ومنح الطالب اشتراك 30 يوم؟'))return;b.disabled=true;const r=await sbc().rpc('student_ai_approve_order',{p_order_id:b.dataset.subApprove});if(r.error||!r.data?.ok){alert(r.error?.message||r.data?.reason||'تعذر الاعتماد');b.disabled=false;return}await refresh()});
    document.querySelectorAll('[data-sub-reject]').forEach(b=>b.onclick=async()=>{const reason=prompt('سبب الرفض (اختياري):','بيانات التحويل غير مطابقة.');if(reason===null)return;b.disabled=true;const r=await sbc().rpc('student_ai_reject_order',{p_order_id:b.dataset.subReject,p_reason:reason.trim()});if(r.error||!r.data?.ok){alert(r.error?.message||r.data?.reason||'تعذر الرفض');b.disabled=false;return}await refresh()});
    document.querySelectorAll('[data-sub-revoke]').forEach(b=>b.onclick=async()=>{if(!confirm('منع الاشتراك الحالي فورًا؟'))return;b.disabled=true;const r=await sbc().rpc('student_ai_admin_revoke_access',{p_student_id:b.dataset.subRevoke});if(r.error||!r.data?.ok){alert(r.error?.message||r.data?.reason||'تعذر منع الاشتراك');b.disabled=false;return}await refresh()});
    document.getElementById('ai-sub-search').onclick=searchStudents;
    document.getElementById('ai-sub-student-search').onkeydown=e=>{if(e.key==='Enter')searchStudents()};
  }

  async function searchStudents(){
    const q=document.getElementById('ai-sub-student-search')?.value.trim();
    const out=document.getElementById('ai-sub-search-results');
    if(!q){out.innerHTML='<span style="color:#b42318">اكتب اسم الطالب أو رقم القيد.</span>';return}
    out.innerHTML='جاري البحث...';
    const r=await sbc().from('students').select('id,name,enrollment_number,branch,program,student_status').is('deleted_at',null).neq('student_status','dismissed').or(`name.ilike.%${q}%,enrollment_number.ilike.%${q}%`).limit(20);
    if(r.error){out.innerHTML='<span style="color:#b42318">تعذر البحث: '+esc(r.error.message)+'</span>';return}
    if(!r.data?.length){out.innerHTML='لا يوجد طالب مطابق.';return}
    out.innerHTML=r.data.map(s=>`<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;border:1px solid var(--border);border-radius:10px;padding:10px;margin-top:7px"><div><b>${esc(s.name)}</b><br><small>${esc(s.enrollment_number||'—')} · ${esc(s.branch||'—')}</small></div><button class="btn btn-gold btn-sm" data-manual-grant="${esc(s.id)}">🎁 منح 30 يوم</button></div>`).join('');
    out.querySelectorAll('[data-manual-grant]').forEach(b=>b.onclick=async()=>{if(!confirm('منح هذا الطالب اشتراكًا إداريًا لمدة 30 يوم؟'))return;b.disabled=true;const x=await sbc().rpc('student_ai_admin_grant_access',{p_student_id:b.dataset.manualGrant,p_days:30});if(x.error||!x.data?.ok){alert(x.error?.message||x.data?.reason||'تعذر المنح');b.disabled=false;return}alert('تم منح الاشتراك لمدة 30 يوم.');await refresh()});
  }

  async function refresh(){const m=shell();m.innerHTML='<div style="padding:60px;text-align:center">جاري تحميل إدارة الاشتراكات...</div>';try{render(await loadReport())}catch(e){m.innerHTML='<div class="card-header"><h2>💳 إدارة الاشتراكات</h2><button class="btn btn-outline" id="ai-sub-close">إغلاق</button></div><div style="padding:30px;color:#991b1b">تعذر تحميل البيانات: '+esc(e.message||e)+'</div>';document.getElementById('ai-sub-close').onclick=()=>m.remove()}}
  function openManagement(){refresh()}
  const mo=new MutationObserver(ensureButton);
  function start(){ensureButton();mo.observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.openAndalusAiSubscriptionManagement=openManagement;
})();
