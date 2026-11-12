/* Andalus unified Student Portal admin gateway */
(() => {
  'use strict';
  const GATEWAY_ID = 'andalus-student-portal-gateway-nav';
  const MODAL_ID = 'andalus-student-portal-gateway-modal';
  const AI_MODAL_ID = 'andalus-student-ai-admin-dashboard';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sbc = () => window.sb || null;
  const fmtDate = (v) => v ? new Date(v).toLocaleString('ar-EG') : '—';
  const fmtDuration = (sec) => {
    sec = Math.max(0, Number(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h) return `${h} س ${m} د`;
    if (m) return `${m} د ${s} ث`;
    return `${s} ث`;
  };
  const activeAccess = (a) => a && a.status === 'active' && (!a.expires_at || new Date(a.expires_at) > new Date());

  function findSummaryNav() {
    return [...document.querySelectorAll('.sidebar-nav .nav-item')].find(el => /ملخصات الامتحانات|ملخصات/.test(el.textContent || '')) || null;
  }
  function findAiNav() {
    return document.getElementById('student-ai-admin-nav') || [...document.querySelectorAll('.sidebar-nav .nav-item')].find(el => /اشتراكات المساعد الذكي/.test(el.textContent || '')) || null;
  }
  let summaryOriginalHome = null;
  let notificationsOriginalHome = null;
  function returnFromSummary() {
    const page=document.getElementById('page-study-summaries');
    if(page && summaryOriginalHome?.parent){
      const home=summaryOriginalHome;
      if(home.next && home.next.parentNode===home.parent) home.parent.insertBefore(page,home.next);
      else home.parent.appendChild(page);
      page.className=home.className;
      if(home.style===null) page.removeAttribute('style'); else page.setAttribute('style',home.style);
    }
    summaryOriginalHome=null;
    showGatewayHome();
  }
  function openExistingSummary() {
    const page=document.getElementById('page-study-summaries');
    const host=internalHost();
    if(!page || !host){
      alert('تعذر العثور على صفحة ملخصات الامتحانات الحالية.');
      return;
    }
    if(!summaryOriginalHome) summaryOriginalHome={parent:page.parentNode,next:page.nextSibling,style:page.getAttribute('style'),className:page.className};
    enterStandalonePage(host);
    host.innerHTML='';
    page.classList.add('andalus-summary-standalone');
    page.style.cssText='display:block!important;position:relative!important;inset:auto!important;width:100%!important;max-width:none!important;min-height:100dvh;margin:0!important;padding:18px!important;box-sizing:border-box;overflow:visible!important;background:#f1f5f9;';
    host.appendChild(page);
    if(typeof window.showPage==='function') window.showPage('study-summaries');
    document.querySelectorAll('[id^="page-"]').forEach(p=>{if(p!==page)p.classList.remove('active');});
    page.classList.add('active');
    page.style.display='block';
    const back=document.createElement('button');
    back.type='button';
    back.id='andalus-summary-back-to-dashboard';
    back.className='btn btn-outline';
    back.textContent='↩ رجوع لبوابة الطلاب';
    back.style.cssText='display:block;position:sticky;top:8px;z-index:1000;margin:0 0 14px auto;padding:10px 18px;background:#fff;border:1px solid #cbd5e1;border-radius:10px;font-weight:700;';
    back.addEventListener('click',returnFromSummary);
    page.insertBefore(back,page.firstChild);
    window.scrollTo({top:0,behavior:'instant'});
  }

  function returnFromNotifications() {
    document.getElementById('andalus-notifications-back-to-gateway')?.remove();
    const page=document.getElementById('page-notifications');
    if(page && notificationsOriginalHome?.parent){
      const home=notificationsOriginalHome;
      if(home.next && home.next.parentNode===home.parent) home.parent.insertBefore(page,home.next);
      else home.parent.appendChild(page);
      page.className=home.className;
      if(home.style===null) page.removeAttribute('style'); else page.setAttribute('style',home.style);
    }
    notificationsOriginalHome=null;
    showGatewayHome();
  }
  function openExistingNotifications() {
    const page=document.getElementById('page-notifications');
    const host=internalHost();
    if(!page || !host){ alert('تعذر العثور على صفحة الإشعارات الحالية.'); return; }
    if(!notificationsOriginalHome) notificationsOriginalHome={parent:page.parentNode,next:page.nextSibling,style:page.getAttribute('style'),className:page.className};
    enterStandalonePage(host);
    host.innerHTML='';
    page.style.cssText='display:block!important;position:relative!important;inset:auto!important;width:100%!important;max-width:none!important;min-height:100dvh;margin:0!important;padding:18px!important;box-sizing:border-box;overflow:visible!important;background:#f1f5f9;';
    host.appendChild(page);
    if(typeof window.showPage==='function') window.showPage('notifications');
    document.querySelectorAll('[id^="page-"]').forEach(p=>{if(p!==page)p.classList.remove('active');});
    page.classList.add('active');
    page.style.display='block';
    const back=document.createElement('button');
    back.type='button';
    back.id='andalus-notifications-back-to-gateway';
    back.className='btn btn-outline';
    back.textContent='↩ رجوع لبوابة الطالب';
    back.style.cssText='display:block;position:sticky;top:8px;z-index:1000;margin:0 0 14px auto;padding:10px 18px;background:#fff;border:1px solid #cbd5e1;border-radius:10px;font-weight:700;';
    back.addEventListener('click',returnFromNotifications);
    page.insertBefore(back,page.firstChild);
    if(typeof window.loadNotificationsAdmin==='function') window.loadNotificationsAdmin();
    window.scrollTo({top:0,behavior:'instant'});
  }

  function gatewayMarkup() {
    return `
      <div class="card-header" style="position:sticky;top:0;background:#fff;z-index:2">
        <div><h2 style="margin:0">🎓 بوابة الطلاب</h2><div style="font-size:13px;color:var(--muted);margin-top:4px">إدارة الخدمات الرقمية الخاصة بالطلاب من مكان واحد</div></div>
        <button type="button" class="btn btn-outline" id="andulus-student-gateway-close">↩ رجوع للوحة التحكم</button>
      </div>
      <div style="padding:22px">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;max-width:980px;margin:auto">
          <button type="button" id="gateway-summaries" style="border:1px solid var(--border);border-radius:20px;padding:30px 24px;background:linear-gradient(145deg,#eff6ff,#fff);cursor:pointer;text-align:right;box-shadow:0 10px 30px #0f172a12">
            <div style="font-size:52px;margin-bottom:12px">📚</div><h2 style="margin:0 0 8px">ملخصات الامتحانات</h2><p style="margin:0;color:var(--muted);line-height:1.8">مكتبة الملخصات، الباقات، الأسئلة، الاشتراكات، طلبات الدفع، ومنح الوصول.</p><div style="margin-top:16px;font-weight:700">دخول إلى مكتبة الملخصات ←</div>
          </button>
          <button type="button" id="gateway-notifications" style="border:1px solid var(--border);border-radius:20px;padding:30px 24px;background:linear-gradient(145deg,#fff7ed,#fff);cursor:pointer;text-align:right;box-shadow:0 10px 30px #0f172a12">
            <div style="font-size:52px;margin-bottom:12px">🔔</div><h2 style="margin:0 0 8px">الإشعارات والتنبيهات</h2><p style="margin:0;color:var(--muted);line-height:1.8">اكتب إشعار الطلاب، وحدد موعد ظهوره وأيامه، وتابع المنشور والمجدول من مكان واحد.</p><div style="margin-top:16px;font-weight:700">إدارة إشعارات الطلاب ←</div>
          </button>
          <button type="button" id="gateway-ai" style="border:1px solid var(--border);border-radius:20px;padding:30px 24px;background:linear-gradient(145deg,#f5f3ff,#fff);cursor:pointer;text-align:right;box-shadow:0 10px 30px #0f172a12">
            <div style="font-size:52px;margin-bottom:12px">👨‍🏫</div><h2 style="margin:0 0 8px">المدرس الخصوصي AI</h2><p style="margin:0;color:var(--muted);line-height:1.8">التجارب، الاشتراكات، الاستخدام الفعلي، الدقائق المستهلكة، الطلبات، والإتاحة لكل طالب.</p><div style="margin-top:16px;font-weight:700">إدارة المدرس الخصوصي ←</div>
          </button>
        </div>
      </div>`;
  }

  const INTERNAL_ID = 'andalus-student-gateway-page';
  function internalHost() {
    let host = document.getElementById(INTERNAL_ID);
    if (host) return host;
    host = document.createElement('main');
    host.id = INTERNAL_ID;
    host.style.cssText = 'display:none;position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;margin:0;padding:0;direction:rtl;box-sizing:border-box;overflow:auto;z-index:2147483000;background:#f1f5f9;';
    document.body.appendChild(host);
    return host;
  }
  function enterStandalonePage(host) {
    if (!document.getElementById('andalus-gateway-standalone-style')) {
      const style=document.createElement('style');
      style.id='andalus-gateway-standalone-style';
      style.textContent='body.and-alus-gateway-standalone{overflow:hidden!important} body.and-alus-gateway-standalone > :not(#'+INTERNAL_ID+'){display:none!important} #'+INTERNAL_ID+'{display:block!important} #'+INTERNAL_ID+' > .card{min-height:100dvh;border:0;border-radius:0!important}';
      document.head.appendChild(style);
    }
    document.body.classList.add('and-alus-gateway-standalone');
    host.style.display='block';
  }
  function closeGateway() {
    const host = internalHost();
    document.body.classList.remove('and-alus-gateway-standalone');
    if (host) { host.style.display='none'; host.innerHTML=''; }
  }
  function showGatewayHome() {
    const host=internalHost(), grid=document.getElementById('nav-cards-grid');
    if(!host) { alert('تعذر فتح بوابة الطلاب داخل مساحة النظام.'); return; }
    enterStandalonePage(host);
    host.innerHTML='<div id="'+MODAL_ID+'" class="card" style="width:100%;max-width:100%;margin:0;position:relative;inset:auto;overflow:visible;border-radius:16px;box-shadow:none">'+gatewayMarkup()+'</div>';
    host.querySelector('#andulus-student-gateway-close').onclick=closeGateway;
    host.querySelector('#gateway-summaries').onclick=openExistingSummary;
    const notificationsButton=host.querySelector('#gateway-notifications');
    if(notificationsButton) notificationsButton.onclick=openExistingNotifications;
    host.querySelector('#gateway-ai').onclick=openAiDashboard;
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function openGateway() { showGatewayHome(); }

  function installNav() {
    const card = document.getElementById('andalus-student-gateway-card') ||
      [...document.querySelectorAll('#nav-cards-grid .nav-card')].find(el => /مكتبة\\s*ملخصات\\s*الامتحانات/.test(el.textContent || ''));
    if (!card) return false;
    if (card.dataset.portalGatewayReady === '1' && /بوابة الطلاب/.test(card.textContent || '')) return true;
    card.id = 'andalus-student-gateway-card';
    card.dataset.portalGatewayReady = '1';
    card.classList.add('admin-only');
    card.innerHTML = '<span class="nav-card-icon">🎓</span><span>بوابة الطلاب</span>';
    card.onclick = openGateway;
    card.setAttribute('role','button');
    card.setAttribute('tabindex','0');
    card.setAttribute('aria-label','بوابة الطلاب: ملخصات الامتحانات والمدرس الخصوصي AI');
    const oldNotifications=[...document.querySelectorAll('#nav-cards-grid .nav-card')].find(el=>/مركز التنبيهات/.test(el.textContent||''));
    if(oldNotifications) oldNotifications.style.display='none';
    card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGateway(); } };
    return true;
  }

  async function loadAiData() {
    const client = sbc();
    if (!client) throw new Error('لم يتم تحميل اتصال قاعدة البيانات بعد.');
    const [studentsR, accessR, sessionsR, usageR, ordersR, planR] = await Promise.all([
      client.from('students').select('id,name,enrollment_number,branch,program,student_status').is('deleted_at', null).order('name').limit(500),
      client.from('student_ai_access').select('id,student_id,access_type,starts_at,expires_at,status,order_id,created_at').order('created_at', {ascending:false}).limit(1000),
      client.from('student_ai_sessions').select('id,student_id,access_id,started_at,last_heartbeat_at,active,created_at').order('last_heartbeat_at', {ascending:false}).limit(2000),
      client.from('student_ai_usage_daily').select('student_id,usage_date,used_seconds,updated_at').order('usage_date', {ascending:false}).limit(5000),
      client.from('student_ai_orders').select('id,student_id,plan_code,amount,status,payment_method,payment_reference,payment_proof_path,order_code,created_at,updated_at,reviewed_at,reviewed_reason,hidden_from_student').order('created_at', {ascending:false}).limit(500),
      client.from('student_ai_plans').select('code,title,price,monthly_minutes,trial_hours,is_active').eq('code','student_ai_monthly').maybeSingle()
    ]);
    for (const r of [studentsR,accessR,sessionsR,usageR,ordersR,planR]) if (r.error) throw r.error;
    return {students:studentsR.data||[],access:accessR.data||[],sessions:sessionsR.data||[],usage:usageR.data||[],orders:ordersR.data||[],plan:planR.data||null};
  }

  function renderAiDashboard(data) {
    const studentMap = new Map(data.students.map(s => [String(s.id), s]));
    const accessMap = new Map();
    for (const a of data.access) { const k=String(a.student_id); if (!accessMap.has(k) || new Date(a.created_at||0)>new Date(accessMap.get(k).created_at||0)) accessMap.set(k,a); }
    const usageMap = new Map();
    for (const u of data.usage) usageMap.set(String(u.student_id),(usageMap.get(String(u.student_id))||0)+Number(u.used_seconds||0));
    const sessionMap = new Map();
    for (const s of data.sessions) { const k=String(s.student_id); if (!sessionMap.has(k)) sessionMap.set(k,s); }
    const tried = new Set(data.sessions.map(s=>String(s.student_id)));
    data.access.filter(a=>a.access_type==='trial').forEach(a=>tried.add(String(a.student_id)));
    const active = data.access.filter(activeAccess);
    const subscribed = new Set(active.filter(a=>a.access_type==='subscription').map(a=>String(a.student_id)));
    const totalSeconds = [...usageMap.values()].reduce((a,b)=>a+b,0);
    const pending = data.orders.filter(o=>['pending_payment','payment_submitted'].includes(o.status) && !o.hidden_from_student).length;
    const nowActiveSessions = data.sessions.filter(s=>s.active && new Date(s.last_heartbeat_at||0) >= new Date(Date.now()-5*60*1000)).length;
    const trialCount = data.access.filter(a=>a.access_type==='trial').length;
    const rows = data.students.filter(s=>s.student_status!=='dismissed').map(s=>{
      const id=String(s.id), a=accessMap.get(id), sess=sessionMap.get(id), used=usageMap.get(id)||0;
      return {s,a,sess,used,tried:tried.has(id),subscribed:subscribed.has(id)};
    }).filter(x=>x.tried||x.subscribed||x.used>0||x.sess);
    const box=document.getElementById(AI_MODAL_ID); if(!box)return;
    box.innerHTML=`
      <div class="card-header" style="position:sticky;top:0;background:#fff;z-index:3"><div><h2 style="margin:0">👨‍🏫 إدارة المدرس الخصوصي AI</h2><div style="font-size:12px;color:var(--muted);margin-top:4px">الاستهلاك المحسوب من استخدام الطلاب الفعلي فقط</div></div><div style="display:flex;gap:8px"><button class="btn btn-outline" id="ai-admin-refresh">🔄 تحديث</button><button class="btn btn-outline" id="ai-admin-close">إغلاق</button></div></div>
      <div style="padding:18px">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:18px">
          <div class="card" style="padding:14px"><b>إجمالي الطلاب</b><div style="font-size:26px;margin-top:5px">${data.students.filter(s=>s.student_status!=='dismissed').length}</div></div>
          <div class="card" style="padding:14px"><b>جرّبوا الخدمة</b><div style="font-size:26px;margin-top:5px">${tried.size}</div></div>
          <div class="card" style="padding:14px"><b>اشتراكات فعالة</b><div style="font-size:26px;margin-top:5px">${subscribed.size}</div></div>
          <div class="card" style="padding:14px"><b>جلسات نشطة</b><div style="font-size:26px;margin-top:5px">${nowActiveSessions}</div></div>
          <div class="card" style="padding:14px"><b>الاستخدام الفعلي</b><div style="font-size:26px;margin-top:5px">${fmtDuration(totalSeconds)}</div></div>
          <div class="card" style="padding:14px"><b>طلبات بانتظار المراجعة</b><div style="font-size:26px;margin-top:5px">${pending}</div></div>
        </div>
        <div class="card" style="padding:14px;margin-bottom:16px;background:#f8fafc">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><div><b>خطة المدرس الخصوصي الحالية</b><div style="font-size:12px;color:var(--muted);margin-top:5px">${esc(data.plan?.title||'المساعد الذكي')} · ${Number(data.plan?.price||100).toLocaleString('ar-EG')} ج.م · ${Number(data.plan?.monthly_minutes||120)} دقيقة/يوم · تجربة ${Number(data.plan?.trial_hours||24)} ساعة</div></div><span class="badge ${data.plan?.is_active===false?'badge-danger':'badge-success'}">${data.plan?.is_active===false?'غير مفعلة':'مفعلة'}</span></div>
        </div>
        <div class="card" style="padding:14px;margin-bottom:16px"><div class="card-header"><h3 style="margin:0">📨 طلبات الاشتراك</h3><span style="font-size:12px;color:var(--muted)">${data.orders.length} طلب</span></div><div style="margin-top:10px">${data.orders.length?data.orders.map(o=>{const s=studentMap.get(String(o.student_id))||{};return `<div style="border:1px solid var(--border);border-radius:10px;padding:10px;margin:7px 0"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${esc(s.name||'طالب')} (${esc(s.enrollment_number||'—')})</b><span class="badge ${o.status==='approved'?'badge-success':o.status==='rejected'?'badge-danger':'badge-warning'}">${esc(o.status)}</span></div><div style="font-size:12px;color:var(--muted);margin-top:4px">${Number(o.amount||0).toLocaleString('ar-EG')} ج.م · ${esc(o.order_code||'')} · ${fmtDate(o.created_at)}${o.payment_reference?' · مرجع: '+esc(o.payment_reference):''}</div>${['pending_payment','payment_submitted'].includes(o.status)?`<div style="display:flex;gap:7px;margin-top:8px"><button class="btn btn-gold btn-sm" data-ai-approve="${o.id}">✅ اعتماد 30 يوم</button><button class="btn btn-danger btn-sm" data-ai-reject="${o.id}">❌ رفض</button></div>`:''}</div>`}).join(''):'لا توجد طلبات.'}</div></div>
        <div class="card" style="padding:14px"><div class="card-header"><h3 style="margin:0">👥 متابعة الطلاب الذين استخدموا المدرس الخصوصي</h3><span style="font-size:12px;color:var(--muted)">${rows.length} طالب</span></div>
          <div style="overflow:auto;margin-top:10px"><table style="width:100%;border-collapse:collapse;min-width:1050px"><thead><tr><th>الطالب</th><th>الحالة</th><th>التجربة</th><th>الاستخدام الفعلي</th><th>آخر جلسة</th><th>انتهاء الإتاحة</th><th>إجراء</th></tr></thead><tbody>${rows.map(x=>`<tr><td><b>${esc(x.s.name||'—')}</b><br><small>${esc(x.s.enrollment_number||'—')}</small></td><td>${x.subscribed?'<span class="badge badge-success">مشترك</span>':x.tried?'<span class="badge badge-warning">جرّب</span>':'<span class="badge">لم يستخدم</span>'}</td><td>${x.a?.access_type==='trial'?'تجربة<br><small>'+fmtDate(x.a.starts_at)+'</small>':'—'}</td><td>${fmtDuration(x.used)}</td><td>${x.sess?(x.sess.active&&new Date(x.sess.last_heartbeat_at||0)>=new Date(Date.now()-5*60*1000)?'<span class="badge badge-success">نشط الآن</span>':fmtDate(x.sess.last_heartbeat_at)):'—'}</td><td>${x.a?.expires_at?fmtDate(x.a.expires_at):'—'}</td><td><div style="display:flex;gap:5px"><button class="btn btn-gold btn-sm" data-ai-grant="${esc(x.s.id)}">إتاحة 30 يوم</button>${x.subscribed?`<button class="btn btn-danger btn-sm" data-ai-revoke="${esc(x.s.id)}">منع الإتاحة</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>
        </div>
      </div>`;
    bindAiActions(data);
  }

  async function bindAiActions(data) {
    document.getElementById('ai-admin-close').onclick=showGatewayHome;
    document.getElementById('ai-admin-refresh').onclick=()=>loadAndRenderAi();
    document.querySelectorAll('[data-ai-approve]').forEach(b=>b.onclick=async()=>{
      b.disabled=true; const r=await sbc().rpc('student_ai_approve_order',{p_order_id:b.dataset.aiApprove});
      if(r.error||!r.data?.ok){alert(r.error?.message||r.data?.reason||'تعذر الاعتماد');b.disabled=false;return;} await loadAndRenderAi();
    });
    document.querySelectorAll('[data-ai-reject]').forEach(b=>b.onclick=async()=>{
      const reason=prompt('سبب الرفض (اختياري):','بيانات الدفع غير مطابقة.'); if(reason===null)return; b.disabled=true;
      const r=await sbc().rpc('student_ai_reject_order',{p_order_id:b.dataset.aiReject,p_reason:reason.trim()});
      if(r.error||!r.data?.ok){alert(r.error?.message||r.data?.reason||'تعذر الرفض');b.disabled=false;return;} await loadAndRenderAi();
    });
    document.querySelectorAll('[data-ai-grant]').forEach(b=>b.onclick=async()=>{
      if(!confirm('منح هذا الطالب إتاحة المدرس الخصوصي لمدة 30 يوم؟'))return; b.disabled=true;
      const r=await sbc().rpc('student_ai_admin_grant_access',{p_student_id:b.dataset.aiGrant,p_days:30});
      if(r.error||!r.data?.ok){alert(r.error?.message||r.data?.reason||'تعذر منح الإتاحة');b.disabled=false;return;} await loadAndRenderAi();
    });
    document.querySelectorAll('[data-ai-revoke]').forEach(b=>b.onclick=async()=>{
      if(!confirm('منع الإتاحة الحالية لهذا الطالب؟'))return; b.disabled=true;
      const r=await sbc().rpc('student_ai_admin_revoke_access',{p_student_id:b.dataset.aiRevoke});
      if(r.error||!r.data?.ok){alert(r.error?.message||r.data?.reason||'تعذر منع الإتاحة');b.disabled=false;return;} await loadAndRenderAi();
    });
  }
  async function loadAndRenderAi(){
    const box=document.getElementById(AI_MODAL_ID); if(!box)return;
    box.innerHTML='<div style="padding:50px;text-align:center">جاري تحميل بيانات المدرس الخصوصي...</div>';
    try{renderAiDashboard(await loadAiData());}catch(e){box.innerHTML=`<div class="card-header"><h2>👨‍🏫 إدارة المدرس الخصوصي AI</h2><button class="btn btn-outline" id="ai-admin-close">← الرجوع للبوابة</button></div><div style="padding:30px;color:#991b1b">تعذر تحميل البيانات: ${esc(e?.message||e)}</div>`;document.getElementById('ai-admin-close').onclick=showGatewayHome;}
  }
  function openAiDashboard(){
    const host=internalHost(), grid=document.getElementById('nav-cards-grid');
    if(!host) { alert('تعذر فتح المدرس الخصوصي داخل مساحة النظام.'); return; }
    enterStandalonePage(host);
    host.innerHTML='<div id="'+AI_MODAL_ID+'" class="card" style="width:100%;max-width:100%;margin:0;position:relative;inset:auto;overflow:visible;border-radius:16px;box-shadow:none"><div style="padding:18px;text-align:center">جاري فتح المدرس الخصوصي...</div></div>';
    window.scrollTo({top:0,behavior:'smooth'});
    loadAndRenderAi();
  }
  function start(){
    installNav();
    const observer=new MutationObserver(()=>installNav());
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(installNav,500);setTimeout(installNav,1500);setTimeout(installNav,3000);
  }
  window.openAndalusStudentGateway = openGateway;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
