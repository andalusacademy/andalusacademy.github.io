/* Andalus Academy — private paid video library.
   Uses the existing student portal face-verification session and the private R2 gateway. */
(() => {
  'use strict';
  const PAGE = 'academy-videos';
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = (v) => Number(v || 0).toLocaleString('en-US', {maximumFractionDigits:2}) + ' ج.م';
  let gatewayUrl = '';
  let studentVideos = [];
  let studentOrders = [];

  function toast(message, type) {
    if (typeof window.showToast === 'function') window.showToast(message, type || 'info');
    else alert(message);
  }
  function isAdmin() { try { return typeof currentUser !== 'undefined' && currentUser?.role === 'admin'; } catch (_) { return false; } }
  function videoSessionToken() { try { return typeof studentPortalFaceToken !== 'undefined' ? studentPortalFaceToken : null; } catch (_) { return null; } }
  function studentDisplayName() { try { return typeof unifiedPortalStudent !== 'undefined' ? unifiedPortalStudent?.name || '' : ''; } catch (_) { return ''; } }
  function studentEnrollment() { try { return typeof unifiedPortalStudent !== 'undefined' ? unifiedPortalStudent?.enrollment_number || '' : ''; } catch (_) { return ''; } }
  function studentIdDisplay() { try { return typeof unifiedPortalStudent !== 'undefined' ? unifiedPortalStudent?.id || '' : ''; } catch (_) { return ''; } }
  function supa() {
    if (typeof sb !== 'undefined' && sb) return sb;
    if (window.sb) return window.sb;
    throw new Error('اتصال قاعدة البيانات غير جاهز');
  }
  function getContent() {
    return $('student-portal-content');
  }

  function ensureAdminNav() {
    if (!isAdmin() || document.querySelector('[data-academy-video-nav]')) return;
    const nav = document.querySelector(
      '.sidebar-nav, #sidebar-nav, .sidebar-menu, .sidebar .nav, #sidebar .nav, .sidebar'
    ) || (() => {
      const existing = document.querySelector('.sidebar .nav-item, #sidebar .nav-item, .sidebar-menu .nav-item, .sidebar-nav .nav-item');
      return existing?.parentElement || null;
    })();
    if (!nav) return;
    const item = document.createElement('div');
    item.className = 'nav-item';
    item.dataset.academyVideoNav = '1';
    item.innerHTML = '<span class="nav-icon">🎬</span><span>مكتبة الفيديوهات</span>';
    item.addEventListener('click', () => window.showPage && window.showPage(PAGE));
    nav.appendChild(item);
  }

  function ensureAdminPage() {
    if (!$('page-' + PAGE)) {
      const host = document.querySelector('#app-screen .content') ||
        document.querySelector('#app-screen .main .content') ||
        document.querySelector('#app-screen .main') ||
        document.querySelector('#app-screen') ||
        document.querySelector('.app-screen .content');
      if (host) {
        const page = document.createElement('div');
        page.id = 'page-' + PAGE;
        page.className = 'page';
        page.innerHTML = `
        <div class="card" style="padding:18px;margin-bottom:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div><h3 style="margin:0;color:var(--navy)">🎬 مكتبة الفيديوهات التعليمية</h3>
            <div style="color:var(--muted);font-size:12px;margin-top:5px">رفع خاص على Cloudflare R2 — لا يتم تخزين ملفات الفيديو داخل Supabase</div></div>
            <button class="btn btn-outline" onclick="window.academyVideoLibrary.loadAdmin()">تحديث البيانات</button>
          </div>
        </div>
        <div class="card" style="padding:18px;margin-bottom:16px">
          <h3 style="margin:0 0 14px">إضافة فيديو جديد</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px">
            <div><label>عنوان الفيديو</label><input id="av-title" class="search-input" maxlength="180" style="width:100%;max-width:none" placeholder="مثال: المصطلحات الطبية"></div>
            <div><label>التصنيف</label><input id="av-category" class="search-input" maxlength="100" style="width:100%;max-width:none" placeholder="مثال: تمريض عملي"></div>
            <div><label>السعر بالجنيه</label><input id="av-price" type="number" min="0" step="0.01" value="0" class="search-input" style="width:100%;max-width:none"></div>
            <div><label>مدة المشاهدة بالأيام</label><input id="av-days" type="number" min="1" max="36500" value="30" class="search-input" style="width:100%;max-width:none"><small style="color:var(--muted)">36500 = بدون انتهاء</small></div>
            <div><label>وسيلة التحويل</label><input id="av-provider" class="search-input" maxlength="80" style="width:100%;max-width:none" placeholder="إنستاباي / محفظة"></div>
            <div><label>رقم المحفظة أو التحويل</label><input id="av-wallet" class="search-input" maxlength="80" style="width:100%;max-width:none"></div>
            <div style="grid-column:1/-1"><label>وصف الفيديو</label><textarea id="av-description" class="search-input" rows="2" maxlength="1000" style="width:100%;max-width:none"></textarea></div>
            <div style="grid-column:1/-1"><label>ملف الفيديو (MP4 / WebM / MOV)</label><input id="av-file" type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" class="search-input" style="width:100%;max-width:none"><small id="av-upload-status" style="display:block;color:var(--muted);margin-top:6px">يتم الرفع على R2 الخاص على أجزاء؛ لا يُرفع الملف إلى Supabase.</small></div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px">
            <button class="btn btn-primary" id="av-upload-btn" onclick="window.academyVideoLibrary.uploadVideo()">رفع وحفظ الفيديو</button>
            <span style="font-size:12px;color:var(--muted)">سيتم حفظ الفيديو كمسودة، ويمكن نشره بعد ذلك.</span>
          </div>
        </div>
        <div class="card" style="padding:18px;margin-bottom:16px">
          <h3 style="margin:0 0 10px">إعداد بوابة R2</h3>
          <label>رابط Worker (Workers URL)</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
            <input id="av-gateway-url" class="search-input" style="flex:1;min-width:240px;max-width:none" placeholder="https://andalus-video-gateway....workers.dev">
            <button class="btn btn-outline" onclick="window.academyVideoLibrary.saveGateway()">حفظ الرابط</button>
          </div>
          <small style="color:var(--muted)">الرابط عام للخدمة فقط؛ مفاتيح R2 وSupabase لا توضع هنا ولا في كود المتصفح.</small>
        </div>
        <div class="card" style="padding:18px;margin-bottom:16px">
          <h3 style="margin:0 0 12px">الفيديوهات المضافة</h3><div id="av-admin-videos">جاري التحميل...</div>
        </div>
        <div class="card" style="padding:18px">
          <h3 style="margin:0 0 12px">طلبات الشراء ومراجعة التحويلات</h3><div id="av-admin-orders">جاري التحميل...</div>
        </div>`;
        host.appendChild(page);
      }
    }
    ensureAdminNav();
  }

  async function getGateway() {
    const {data, error} = await supa().from('academy_video_settings').select('gateway_url').eq('singleton', true).maybeSingle();
    if (error) throw error;
    gatewayUrl = String(data?.gateway_url || '').replace(/\/$/, '');
    return gatewayUrl;
  }

  async function saveGateway() {
    if (!(typeof currentUser !== 'undefined' && currentUser?.role === 'admin')) return toast('الإدارة فقط', 'error');
    const value = String($('av-gateway-url')?.value || '').trim().replace(/\/$/, '');
    if (value && !/^https:\/\//i.test(value)) return toast('أدخل رابط HTTPS صحيحًا', 'error');
    const {error} = await supa().from('academy_video_settings').upsert({
      singleton: true, gateway_url: value || null, updated_at: new Date().toISOString()
    }, {onConflict:'singleton'});
    if (error) return toast('تعذر حفظ الرابط: ' + error.message, 'error');
    gatewayUrl = value;
    toast('تم حفظ رابط بوابة الفيديو');
  }

  async function uploadVideo() {
    if (!(typeof currentUser !== 'undefined' && currentUser?.role === 'admin')) return toast('الإدارة فقط', 'error');
    const title = String($('av-title')?.value || '').trim();
    const file = $('av-file')?.files?.[0];
    const price = Number($('av-price')?.value);
    const days = Number($('av-days')?.value);
    if (title.length < 2 || !file) return toast('اكتب عنوان الفيديو واختر الملف', 'error');
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(days) || days < 1 || days > 36500) return toast('راجع السعر ومدة المشاهدة', 'error');
    if (!/^video\/(mp4|webm|quicktime)$/.test(file.type) && !/\.(mp4|webm|mov)$/i.test(file.name)) return toast('نوع الفيديو غير مدعوم', 'error');
    const base = await getGateway();
    if (!base) return toast('احفظ رابط Worker أولًا', 'error');
    const {data:sessionData} = await supa().auth.getSession();
    const jwt = sessionData?.session?.access_token;
    if (!jwt) return toast('جلسة الإدارة غير موجودة؛ سجّل الدخول مرة أخرى', 'error');

    const btn = $('av-upload-btn'), status = $('av-upload-status');
    btn.disabled = true;
    let upload = null;
    try {
      const init = await fetch(base + '/admin/upload/init', {
        method:'POST', headers:{'Authorization':'Bearer '+jwt,'Content-Type':'application/json'},
        body:JSON.stringify({file_name:file.name,content_type:file.type || 'video/mp4'})
      });
      upload = await init.json();
      if (!init.ok || !upload.ok) throw new Error(upload.reason || 'تعذر بدء الرفع');
      const chunkSize = Number(upload.chunk_size || 8*1024*1024);
      const parts = [];
      const total = Math.ceil(file.size/chunkSize);
      for (let n=0;n<total;n++) {
        const chunk = file.slice(n*chunkSize, Math.min(file.size,(n+1)*chunkSize));
        const response = await fetch(base + '/admin/upload/part?object_key='+encodeURIComponent(upload.object_key)+'&upload_id='+encodeURIComponent(upload.upload_id)+'&part_number='+(n+1), {
          method:'POST', headers:{'Authorization':'Bearer '+jwt,'Content-Type':'application/octet-stream'}, body:chunk
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.reason || 'فشل رفع جزء من الفيديو');
        parts.push({part_number:n+1,etag:result.etag});
        status.textContent = 'تم رفع ' + Math.min(file.size,(n+1)*chunkSize).toLocaleString('en-US') + ' من ' + file.size.toLocaleString('en-US') + ' بايت';
      }
      const completeResponse = await fetch(base + '/admin/upload/complete', {
        method:'POST', headers:{'Authorization':'Bearer '+jwt,'Content-Type':'application/json'},
        body:JSON.stringify({object_key:upload.object_key,upload_id:upload.upload_id,parts})
      });
      const completed = await completeResponse.json();
      if (!completeResponse.ok || !completed.ok) throw new Error(completed.reason || 'تعذر إكمال رفع الفيديو');

      const {error} = await supa().from('academy_videos').insert({
        title, description:$('av-description')?.value || null,
        category:$('av-category')?.value || null, price, validity_days:days,
        payment_provider:$('av-provider')?.value || null,
        payment_wallet_number:$('av-wallet')?.value || null,
        r2_object_key:completed.object_key, content_type:file.type || 'video/mp4',
        size_bytes:completed.size_bytes || file.size, is_published:false
      });
      if (error) throw error;
      ['av-title','av-category','av-description','av-provider','av-wallet'].forEach(id=>{if($(id))$(id).value='';});
      $('av-file').value=''; status.textContent='تم الرفع والحفظ بنجاح. الفيديو محفوظ كمسودة.';
      toast('تم رفع الفيديو وحفظه كمسودة');
      await loadAdmin();
    } catch (e) {
      if (upload?.object_key && upload?.upload_id) {
        try { await fetch(base+'/admin/upload/abort',{method:'POST',headers:{'Authorization':'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify({object_key:upload.object_key,upload_id:upload.upload_id})}); } catch (_) {}
      }
      status.textContent = 'تعذر إكمال الرفع: ' + (e?.message || 'خطأ غير معروف');
      toast(status.textContent,'error');
    } finally { btn.disabled = false; }
  }

  async function togglePublish(id, published) {
    const {error} = await supa().from('academy_videos').update({is_published:!!published,updated_at:new Date().toISOString()}).eq('id',id);
    if (error) toast(error.message,'error'); else await loadAdmin();
  }
  async function archiveVideo(id) {
    if (!confirm('إخفاء الفيديو من المكتبة؟ لن يتم حذف الملف من R2.')) return;
    const {error} = await supa().from('academy_videos').update({is_published:false,deleted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id);
    if (error) toast(error.message,'error'); else await loadAdmin();
  }
  async function reviewOrder(id, status) {
    const {error} = await supa().rpc('admin_review_academy_video_order',{p_order_id:id,p_status:status,p_reason:null});
    if (error) toast('تعذرت مراجعة الطلب: '+error.message,'error');
    else { toast(status==='paid'?'تم اعتماد الدفع ومنح صلاحية المشاهدة':'تم تحديث حالة الطلب'); await loadAdmin(); }
  }

  async function loadAdmin() {
    ensureAdminPage();
    if (!isAdmin()) return;
    try {
      const base = await getGateway();
      if ($('av-gateway-url')) $('av-gateway-url').value = base;
      const [videos, orders] = await Promise.all([
        supa().from('academy_videos').select('*').is('deleted_at',null).order('sort_order').order('created_at',{ascending:false}),
        supa().from('academy_video_orders').select('id,student_id,video_id,amount,status,payment_reference,order_code,created_at,video:academy_videos(title),student:students(name,enrollment_number)').order('created_at',{ascending:false}).limit(100)
      ]);
      if (videos.error) throw videos.error;
      if (orders.error) throw orders.error;
      $('av-admin-videos').innerHTML = videos.data?.length ? videos.data.map(v=>`
        <div style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;border-bottom:1px solid var(--border);padding:12px 0">
          <div><b>${esc(v.title)}</b><div style="font-size:12px;color:var(--muted)">${esc(v.category||'بدون تصنيف')} · ${money(v.price)} · ${v.validity_days>=36500?'بدون انتهاء':esc(v.validity_days)+' يوم'}</div>
          <div style="font-size:11px;color:var(--muted)">${v.is_published?'منشور':'مسودة'} · ${Number(v.size_bytes||0).toLocaleString('en-US')} بايت</div></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-sm ${v.is_published?'btn-outline':'btn-primary'}" onclick="academyVideoLibrary.togglePublish('${v.id}',${!v.is_published})">${v.is_published?'إلغاء النشر':'نشر'}</button>
            <button class="btn btn-sm btn-outline" onclick="academyVideoLibrary.archiveVideo('${v.id}')">إخفاء</button>
          </div>
        </div>`).join('') : '<p style="color:var(--muted)">لا توجد فيديوهات مضافة حتى الآن.</p>';
      $('av-admin-orders').innerHTML = orders.data?.length ? orders.data.map(o=>`
        <div style="border-bottom:1px solid var(--border);padding:12px 0">
          <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${esc(o.video?.title||'فيديو')}</b><b>${money(o.amount)}</b></div>
          <div style="font-size:12px;color:var(--muted)">${esc(o.student?.name||o.student_id)} · قيد ${esc(o.student?.enrollment_number||o.student_id)} · كود ${esc(o.order_code)}</div>
          <div style="font-size:12px;margin:5px 0">رقم التحويل: <b>${esc(o.payment_reference||'لم يرسل بعد')}</b> · الحالة: <b>${esc(o.status)}</b></div>
          ${o.status==='pending_payment'?'<div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn btn-sm btn-primary" onclick="academyVideoLibrary.reviewOrder(\''+o.id+'\',\'paid\')">اعتماد ومنح المشاهدة</button><button class="btn btn-sm btn-outline" onclick="academyVideoLibrary.reviewOrder(\''+o.id+'\',\'rejected\')">رفض</button></div>':''}
        </div>`).join('') : '<p style="color:var(--muted)">لا توجد طلبات شراء.</p>';
    } catch (e) {
      if ($('av-admin-videos')) $('av-admin-videos').textContent = 'تعذر تحميل البيانات: ' + (e?.message || '');
      if ($('av-admin-orders')) $('av-admin-orders').textContent = 'تعذر تحميل الطلبات.';
    }
  }

  async function openStudentLibrary() {
    if (!(typeof studentPortalFaceToken !== 'undefined' ? studentPortalFaceToken : null)) return toast('انتهت جلسة التحقق؛ سجّل الدخول مرة أخرى.','error');
    const box = getContent();
    if (!box) return;
    box.innerHTML = '<div style="padding:20px;text-align:center">جاري تحميل مكتبة الفيديوهات...</div>';
    try {
      const {data,error} = await supa().rpc('student_list_academy_videos',{p_session_token:videoSessionToken()});
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.reason==='session_expired'?'انتهت جلسة الطالب. سجّل الدخول مرة أخرى.':'تعذر تحميل المكتبة.');
      gatewayUrl = String(data.gateway_url||'').replace(/\/$/,'');
      studentVideos = data.videos || [];
      studentOrders = data.orders || [];
      renderStudentLibrary();
    } catch(e) {
      box.innerHTML = '<div style="padding:18px;color:#b91c1c">'+esc(e?.message||'تعذر تحميل المكتبة')+'</div><button class="btn btn-outline" onclick="renderStudentPortalMenu()">رجوع</button>';
    }
  }

  function renderStudentLibrary() {
    const box = getContent();
    const cards = studentVideos.map(v=>`
      <article class="card" style="padding:15px;margin-bottom:12px">
        <div style="display:flex;gap:12px;align-items:flex-start">
          <div style="font-size:30px">🎬</div>
          <div style="flex:1;min-width:0"><h3 style="margin:0 0 5px">${esc(v.title)}</h3>
            <div style="font-size:12px;color:var(--muted)">${esc(v.category||'فيديو تعليمي')} · ${v.validity_days>=36500?'صلاحية مفتوحة':esc(v.validity_days)+' يوم'}</div>
            ${v.description?'<p style="margin:8px 0">'+esc(v.description)+'</p>':''}
            <div style="font-weight:800;margin-top:7px">${v.has_access?'<span style="color:#15803d">لديك صلاحية مشاهدة</span>':money(v.price)}</div>
          </div>
        </div>
        <div style="margin-top:12px">${v.has_access
          ? '<button class="btn btn-primary" onclick="academyVideoLibrary.watch(\''+v.id+'\')">▶ مشاهدة الفيديو</button>'
          : '<button class="btn btn-outline" onclick="academyVideoLibrary.buy(\''+v.id+'\')">شراء الفيديو</button>'}</div>
      </article>`).join('');
    const orders = studentOrders.filter(o=>o.status==='pending_payment').map(o=>`
      <div class="card" style="padding:14px;margin:10px 0">
        <b>${esc(o.video_title)}</b> — ${money(o.amount)}
        <div style="font-size:12px;color:var(--muted)">كود الطلب: ${esc(o.order_code)} · الحالة: في انتظار مراجعة الإدارة</div>
        <div style="margin:8px 0">حوّل إلى: <b>${esc(o.payment_provider||'وسيلة التحويل')}</b> — <b>${esc(o.payment_wallet_number||'يرجى مراجعة الإدارة')}</b></div>
        <label>رقم العملية / مرجع التحويل</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:5px">
          <input id="av-ref-${o.id}" class="search-input" placeholder="اكتب رقم العملية" style="flex:1;min-width:180px;max-width:none" value="${esc(o.payment_reference||'')}">
          <button class="btn btn-primary" onclick="academyVideoLibrary.submitReference('${o.id}')">إرسال للإدارة</button>
        </div>
      </div>`).join('');
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <h2 style="margin:0">🎬 مكتبة الفيديوهات التعليمية</h2>
        <button class="btn btn-outline" onclick="renderStudentPortalMenu()">رجوع للبوابة</button>
      </div>
      ${!gatewayUrl?'<div style="padding:12px;background:#fff7ed;color:#9a3412;border-radius:10px;margin-bottom:12px">المكتبة لم تكتمل تهيئتها بعد.</div>':''}
      ${cards || '<p style="color:var(--muted)">لا توجد فيديوهات منشورة حاليًا.</p>'}
      ${orders?'<h3 style="margin-top:18px">طلبات الشراء</h3>'+orders:''}`;
  }

  async function buy(id) {
    const {data,error} = await supa().rpc('student_create_academy_video_order',{p_session_token:videoSessionToken(),p_video_id:id});
    if (error) return toast(error.message,'error');
    if (!data?.ok) return toast(data?.reason==='already_has_access'?'لديك صلاحية مشاهدة بالفعل':'تعذر إنشاء الطلب: '+(data?.reason||''),'error');
    toast('تم إنشاء طلب الشراء. أكمل التحويل ثم أرسل رقم العملية.');
    await openStudentLibrary();
  }
  async function submitReference(id) {
    const reference = String($('av-ref-'+id)?.value||'').trim();
    if (reference.length<3) return toast('اكتب رقم عملية التحويل الصحيح','error');
    const {data,error} = await supa().rpc('student_submit_academy_video_payment_reference',{
      p_session_token:videoSessionToken(),p_order_id:id,p_payment_reference:reference
    });
    if (error) return toast(error.message,'error');
    if (!data?.ok) return toast('تعذر إرسال رقم التحويل: '+(data?.reason||''),'error');
    toast('تم إرسال رقم التحويل للإدارة للمراجعة');
    await openStudentLibrary();
  }

  function watch(id) {
    if (!gatewayUrl || !videoSessionToken()) return toast('المشاهدة غير مهيأة أو انتهت جلسة الطالب','error');
    const video = studentVideos.find(v=>v.id===id);
    if (!video?.has_access) return toast('لا توجد صلاحية مشاهدة فعالة','error');
    const box = getContent();
    const watermark = esc(((typeof unifiedPortalStudent !== 'undefined' ? unifiedPortalStudent?.name : '')||'طالب')+' · قيد '+((typeof unifiedPortalStudent !== 'undefined' ? unifiedPortalStudent?.enrollment_number : '')||(typeof unifiedPortalStudent !== 'undefined' ? unifiedPortalStudent?.id : '')||''));
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
        <h3 style="margin:0">${esc(video.title)}</h3><button class="btn btn-outline" onclick="academyVideoLibrary.openStudentLibrary()">رجوع للمكتبة</button>
      </div>
      <div style="position:relative;background:#0f172a;border-radius:12px;overflow:hidden">
        <video id="academy-video-player" controls playsinline preload="metadata" controlsList="nodownload noplaybackrate" disablePictureInPicture referrerpolicy="no-referrer" style="width:100%;max-height:72vh;display:block;background:#000" oncontextmenu="return false">
          <source src="${gatewayUrl}/watch/${encodeURIComponent(id)}?session_token=${encodeURIComponent(videoSessionToken())}" type="${esc(video.content_type||'video/mp4')}">
          المتصفح لا يدعم تشغيل الفيديو.
        </video>
        <div style="pointer-events:none;position:absolute;right:12px;bottom:42px;color:#fff;background:#0007;padding:5px 9px;border-radius:5px;font-size:11px;opacity:.7">${watermark} · مركز الأندلس</div>
      </div>
      <p style="font-size:12px;color:var(--muted)">المشاهدة متاحة للحساب صاحب الصلاحية فقط. قد لا تمنع هذه الحماية تصوير الشاشة بوسائل خارجية.</p>`;
  }

  function installStudentLibraryTile() {
    const host = getContent();
    if (!host || !videoSessionToken()) return;
    if (host.querySelector('[data-academy-video-student-tile]')) return;

    const existingTile = [...host.querySelectorAll('button,a,[role="button"],.student-portal-tile')]
      .find(el => !el.closest('[data-academy-video-student-tile]') && (el.textContent || '').trim().length > 2);
    const grid = host.querySelector('.student-portal-grid') || existingTile?.parentElement || host;
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'btn student-portal-tile';
    tile.dataset.academyVideoStudentTile = '1';
    tile.setAttribute('aria-label', 'مكتبة الفيديوهات التعليمية');
    tile.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;width:100%;min-height:132px;padding:18px;border:1px solid #bae6fd;border-radius:16px;background:linear-gradient(145deg,#ecfeff,#fff);color:inherit;cursor:pointer;text-align:center;box-shadow:0 8px 22px #0f172a10;';
    tile.innerHTML = '<span style="font-size:38px;line-height:1">🎬</span><strong>مكتبة الفيديوهات التعليمية</strong><span style="font-size:12px;color:var(--muted)">شاهد المحاضرات والدروس</span>';
    tile.addEventListener('click', openStudentLibrary);
    grid.appendChild(tile);
  }

  function hookStudentLibraryTile() {
    if (typeof window.renderStudentPortalMenu === 'function' && !window.renderStudentPortalMenu.__academyVideoTileHook) {
      const original = window.renderStudentPortalMenu;
      const wrapped = function() {
        const result = original.apply(this, arguments);
        Promise.resolve().then(installStudentLibraryTile);
        return result;
      };
      wrapped.__academyVideoTileHook = true;
      window.renderStudentPortalMenu = wrapped;
    }
    installStudentLibraryTile();
  }

  function install() {
    if (window.__academyVideoLibraryInstalled) return;
    window.__academyVideoLibraryInstalled = true;
    if (typeof ADMIN_ONLY_PAGES !== 'undefined' && ADMIN_ONLY_PAGES?.add) ADMIN_ONLY_PAGES.add(PAGE);
    ensureAdminPage();
    ensureAdminNav();

    // The administration shell/sidebar may be rendered only after login.
    // Watch for that late render and attach the page/link as soon as it exists.
    if (!window.__academyVideoLibraryObserver && document.body) {
      window.__academyVideoLibraryObserver = new MutationObserver(() => {
        ensureAdminPage();
        hookStudentLibraryTile();
      });
      window.__academyVideoLibraryObserver.observe(document.body, { childList: true, subtree: true });
    }
    hookStudentLibraryTile();

    if (typeof window.showPage === 'function') {
      const original = window.showPage;
      window.showPage = function(page) {
        ensureAdminPage();
        if (page === PAGE && !isAdmin()) {
          toast('مكتبة الفيديوهات متاحة للإدارة فقط','error');
          return original('dashboard');
        }
        const result = original.apply(this, arguments);
        if (page === PAGE) {
          const title = $('page-title'); if (title) title.textContent = 'مكتبة الفيديوهات التعليمية';
          document.querySelectorAll('.nav-item').forEach(n=>{ if (n.dataset.academyVideoNav) n.classList.add('active'); });
          void loadAdmin();
        }
        return result;
      };
    }

  }

  window.academyVideoLibrary = {
    loadAdmin, saveGateway, uploadVideo, togglePublish, archiveVideo, reviewOrder,
    openStudentLibrary, buy, submitReference, watch
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();