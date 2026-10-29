(() => {
  'use strict';
  const client = () => window.sb || (typeof sb !== 'undefined' ? sb : null);
  const esc = v => typeof window.escapeHtml === 'function'
    ? window.escapeHtml(String(v ?? ''))
    : String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  let orders = [];
  let selectedOrderId = '';
  let signedUrl = '';
  let wired = false;

  const statusLabel = s => ({
    pending_payment: 'بانتظار مراجعة الدفع',
    paid: 'تم تأكيد الدفع',
    rejected: 'مرفوض',
    expired: 'منتهي',
    cancelled: 'ملغى'
  }[s] || String(s || 'غير محدد'));

  const statusClass = s => s === 'paid' ? 'badge-success' : s === 'rejected' ? 'badge-danger' : 'badge-warning';

  function card() {
    const page = document.getElementById('page-study-summaries');
    if (!page) return null;
    let el = document.getElementById('ss-payment-review-card');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'ss-payment-review-card';
    el.className = 'card';
    el.innerHTML = `
      <div class="card-header">
        <h3>💳 ٤) مراجعة طلبات الدفع والإيصالات</h3>
        <span id="ss-payment-review-count" style="font-size:12px;color:var(--muted)">جاري التحميل...</span>
      </div>
      <div style="padding:16px">
        <div style="display:grid;grid-template-columns:minmax(280px,1fr) minmax(320px,1.4fr);gap:14px;align-items:start">
          <div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
              <button type="button" class="btn btn-outline btn-sm" id="ss-payment-refresh">🔄 تحديث الطلبات</button>
              <select id="ss-payment-filter" class="search-input" style="min-width:180px">
                <option value="pending_payment">طلبات بانتظار المراجعة</option>
                <option value="all">كل الطلبات</option>
                <option value="paid">المؤكدة</option>
                <option value="rejected">المرفوضة</option>
              </select>
            </div>
            <div id="ss-payment-order-list" style="display:grid;gap:8px;max-height:620px;overflow:auto"></div>
          </div>
          <div id="ss-payment-detail" style="border:1px solid var(--border);border-radius:12px;padding:14px;min-height:260px;background:#fff">
            <div style="color:var(--muted);text-align:center;padding:40px 10px">اختر طلب دفع لعرض بياناته والإيصال.</div>
          </div>
        </div>
        <div id="ss-payment-status" style="margin-top:12px"></div>
      </div>`;
    const management = document.getElementById('ss-summary-management-card');
    if (management) management.insertAdjacentElement('afterend', el);
    else page.appendChild(el);
    document.getElementById('ss-payment-refresh').addEventListener('click', loadOrders);
    document.getElementById('ss-payment-filter').addEventListener('change', renderList);
    return el;
  }

  async function loadOrders() {
    const sbc = client();
    if (!sbc) return;
    card();
    const list = document.getElementById('ss-payment-order-list');
    const count = document.getElementById('ss-payment-review-count');
    if (list) list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted)">جاري تحميل طلبات الدفع...</div>';
    try {
      const { data, error } = await sbc.from('study_summary_orders')
        .select('id,student_id,summary_id,amount,status,payment_method,payment_reference,payment_number,payment_proof_path,created_at,updated_at,reviewed_at,reviewed_reason,expires_at,order_code,admin_deleted_at')
        .is('admin_deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      orders = data || [];
      const ids = [...new Set(orders.map(o => String(o.student_id)).filter(Boolean))];
      const summaryIds = [...new Set(orders.map(o => o.summary_id).filter(Boolean))];
      const [students, summaries] = await Promise.all([
        ids.length ? sbc.from('students').select('id,name,enrollment_number,branch,program').in('id', ids) : Promise.resolve({data:[],error:null}),
        summaryIds.length ? sbc.from('study_summaries').select('id,title,subject_name').in('id', summaryIds) : Promise.resolve({data:[],error:null})
      ]);
      if (students.error) throw students.error;
      if (summaries.error) throw summaries.error;
      const sm = new Map((students.data || []).map(x => [String(x.id), x]));
      const mm = new Map((summaries.data || []).map(x => [String(x.id), x]));
      orders = orders.map(o => ({...o, student: sm.get(String(o.student_id)) || null, summary: mm.get(String(o.summary_id)) || null}));
      if (count) {
        const pending = orders.filter(o => o.status === 'pending_payment').length;
        const withProof = orders.filter(o => o.payment_proof_path).length;
        count.textContent = pending + ' طلب بانتظار المراجعة · ' + withProof + ' بإيصال مرفوع';
      }
      renderList();
      if (selectedOrderId && orders.some(o => o.id === selectedOrderId)) renderDetail(selectedOrderId);
      else if (orders.length) {
        const first = orders.find(o => o.status === 'pending_payment') || orders[0];
        selectedOrderId = first.id;
        renderList();
        renderDetail(first.id);
      }
    } catch (e) {
      if (list) list.innerHTML = '<div style="padding:15px;color:#991b1b">تعذر تحميل الطلبات: ' + esc(e?.message || e) + '</div>';
    }
  }

  function renderList() {
    const list = document.getElementById('ss-payment-order-list');
    if (!list) return;
    const filter = document.getElementById('ss-payment-filter')?.value || 'pending_payment';
    const rows = filter === 'all' ? orders : orders.filter(o => o.status === filter);
    if (!rows.length) {
      list.innerHTML = '<div style="padding:20px;color:var(--muted);text-align:center">لا توجد طلبات ضمن هذا التصنيف.</div>';
      return;
    }
    list.innerHTML = rows.map(o => {
      const student = o.student?.name || ('طالب رقم ' + o.student_id);
      const title = o.summary?.title || 'ملخص دراسي';
      const hasProof = !!o.payment_proof_path;
      return `<button type="button" data-payment-order="${esc(o.id)}" style="text-align:right;border:1px solid ${o.id===selectedOrderId?'#c9a24c':'var(--border)'};border-radius:10px;padding:11px;background:${o.id===selectedOrderId?'#fffbeb':'#fff'};cursor:pointer">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
          <strong>${esc(student)}</strong>
          <span class="badge ${statusClass(o.status)}">${esc(statusLabel(o.status))}</span>
        </div>
        <div style="font-size:12px;color:var(--muted);margin-top:5px">${esc(title)} · ${Number(o.amount||0).toLocaleString('ar-EG')} ج.م</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px">${esc(o.order_code||o.id)} ${hasProof ? ' · 📷 يوجد إيصال' : ' · ⚠️ لا يوجد إيصال'}</div>
      </button>`;
    }).join('');
    list.querySelectorAll('[data-payment-order]').forEach(b => b.addEventListener('click', () => {
      selectedOrderId = b.dataset.paymentOrder;
      signedUrl = '';
      renderList();
      renderDetail(selectedOrderId);
    }));
  }

  async function renderDetail(id) {
    const detail = document.getElementById('ss-payment-detail');
    const o = orders.find(x => x.id === id);
    if (!detail || !o) return;
    const student = o.student || {};
    const summary = o.summary || {};
    const created = o.created_at ? new Date(o.created_at).toLocaleString('ar-EG') : '—';
    const proof = o.payment_proof_path;
    detail.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
        <div><h3 style="margin:0">${esc(student.name || 'طالب')}</h3><div style="font-size:12px;color:var(--muted);margin-top:4px">${esc(summary.title || 'ملخص')} · ${esc(o.order_code || '')}</div></div>
        <span class="badge ${statusClass(o.status)}">${esc(statusLabel(o.status))}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin:14px 0">
        <div style="background:#f8fafc;border-radius:8px;padding:9px"><strong>المبلغ</strong><div>${Number(o.amount||0).toLocaleString('ar-EG')} ج.م</div></div>
        <div style="background:#f8fafc;border-radius:8px;padding:9px"><strong>طريقة الدفع</strong><div>${esc(o.payment_method||'—')}</div></div>
        <div style="background:#f8fafc;border-radius:8px;padding:9px"><strong>مرجع التحويل</strong><div>${esc(o.payment_reference||'—')}</div></div>
        <div style="background:#f8fafc;border-radius:8px;padding:9px"><strong>رقم المحفظة</strong><div>${esc(o.payment_number||'—')}</div></div>
        <div style="background:#f8fafc;border-radius:8px;padding:9px"><strong>رقم القيد</strong><div>${esc(student.enrollment_number||'—')}</div></div>
        <div style="background:#f8fafc;border-radius:8px;padding:9px"><strong>تاريخ الطلب</strong><div>${esc(created)}</div></div>
      </div>
      <div style="border-top:1px solid var(--border);padding-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <strong>📷 صورة إيصال الدفع</strong>
          ${proof ? '<span style="font-size:12px;color:#166534">تم رفع الإيصال</span>' : '<span style="font-size:12px;color:#991b1b">لم يرفع الطالب إيصالًا بعد</span>'}
        </div>
        <div id="ss-payment-proof-view" style="margin-top:10px;min-height:150px;border:1px dashed var(--border);border-radius:10px;background:#f8fafc;display:flex;align-items:center;justify-content:center;overflow:hidden">
          ${proof ? '<div style="color:var(--muted)">جاري فتح صورة الإيصال...</div>' : '<div style="color:var(--muted);padding:25px">عند رفع الطالب للصورة ستظهر هنا مباشرة بعد تحديث الطلبات.</div>'}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        ${o.status==='pending_payment' ? '<button type="button" class="btn btn-gold" id="ss-payment-approve">✅ تأكيد الدفع ومنح الوصول</button><button type="button" class="btn btn-danger" id="ss-payment-reject">❌ رفض الطلب</button>' : ''}
      </div>`;

    if (proof) await loadProof(proof);
    document.getElementById('ss-payment-approve')?.addEventListener('click', () => reviewOrder(o.id, 'paid'));
    document.getElementById('ss-payment-reject')?.addEventListener('click', () => {
      const reason = prompt('اكتب سبب رفض الإيصال (اختياري):', 'الإيصال غير واضح أو بيانات التحويل غير مطابقة.');
      if (reason !== null) reviewOrder(o.id, 'rejected', reason.trim());
    });
  }

  async function loadProof(path) {
    const sbc = client();
    const box = document.getElementById('ss-payment-proof-view');
    if (!sbc || !box) return;
    try {
      const { data, error } = await sbc.storage.from('study-summary-pdfs').createSignedUrl(path, 3600);
      if (error) throw error;
      signedUrl = data?.signedUrl || '';
      if (!signedUrl) throw new Error('تعذر إنشاء رابط آمن للإيصال.');
      const lower = path.toLowerCase();
      if (/\.(jpg|jpeg|png|webp|gif|heic|heif)(\?|$)/i.test(lower)) {
        box.innerHTML = `<a href="${esc(signedUrl)}" target="_blank" rel="noopener" style="display:block;width:100%;text-align:center"><img src="${esc(signedUrl)}" alt="إيصال الدفع" style="display:block;max-width:100%;max-height:520px;margin:auto;object-fit:contain;border-radius:8px"></a>`;
      } else if (/\.pdf(\?|$)/i.test(lower)) {
        box.innerHTML = `<iframe src="${esc(signedUrl)}" title="إيصال الدفع" style="width:100%;height:520px;border:0"></iframe>`;
      } else {
        box.innerHTML = `<a class="btn btn-outline" href="${esc(signedUrl)}" target="_blank" rel="noopener">فتح ملف الإيصال</a>`;
      }
    } catch (e) {
      box.innerHTML = '<div style="color:#991b1b;padding:20px;text-align:center">تعذر عرض الإيصال: ' + esc(e?.message || e) + '</div>';
    }
  }

  async function reviewOrder(id, status, reason='') {
    const sbc = client();
    if (!sbc) return;
    const el = document.getElementById('ss-payment-status');
    try {
      const { data, error } = await sbc.rpc('admin_review_study_summary_order', {
        p_order_id: id,
        p_status: status,
        p_reason: reason || null
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.reason || 'تعذر تحديث الطلب.');
      if (el) el.innerHTML = `<div style="background:#ecfdf5;color:#166534;padding:10px;border-radius:8px">✅ تم تحديث الطلب إلى: ${esc(statusLabel(status))}</div>`;
      await loadOrders();
      selectedOrderId = id;
      renderList();
      renderDetail(id);
    } catch (e) {
      if (el) el.innerHTML = '<div style="background:#fef2f2;color:#991b1b;padding:10px;border-radius:8px">❌ ' + esc(e?.message || e) + '</div>';
    }
  }

  function wire() {
    const page = document.getElementById('page-study-summaries');
    if (!page) return;
    card();
    if (!wired) {
      wired = true;
      if (typeof window.showPage === 'function' && !window.showPage.__ssReceiptReview) {
        const old = window.showPage;
        const wrapped = function(p, ...args) {
          const r = old.call(this, p, ...args);
          if (p === 'study-summaries') setTimeout(loadOrders, 150);
          return r;
        };
        wrapped.__ssReceiptReview = true;
        window.showPage = wrapped;
      }
    }
    if (document.getElementById('page-study-summaries')?.style.display !== 'none') loadOrders();
  }

  setInterval(wire, 1000);
  setTimeout(wire, 200);
})();
