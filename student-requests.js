/* Andalus Academy — student/parent complaints and requests workflow. */
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
  const typeLabels = { complaint:'شكوى', request:'طلب', academic:'أكاديمي', financial:'مالي', technical:'تقني', other:'أخرى' };
  const statusLabels = { new:'جديد', in_progress:'قيد المراجعة', waiting_student:'بانتظار الطالب', resolved:'تم الحل', closed:'مغلق' };
  const priorityLabels = { normal:'عادي', high:'مرتفع', urgent:'عاجل' };
  let adminRequests = [];
  let requestContext = null;
  let activeAdminRequestId = null;

  function toast(message, kind='info') {
    if (typeof showToast === 'function') showToast(message, kind);
    else if (kind === 'error') alert(message);
  }
  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ar-EG');
  }
  function getClient() {
    try { if (typeof sb !== 'undefined' && sb) return sb; } catch (_) {}
    return window.sb || null;
  }
  function ensureSubmitModal() {
    let modal = $('student-request-submit-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'student-request-submit-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:1001000;background:rgba(7,18,38,.78);display:none;align-items:center;justify-content:center;padding:12px;direction:rtl;';
    modal.innerHTML = `
      <div style="background:#fff;color:#172033;border-radius:16px;width:min(650px,100%);max-height:92vh;overflow:auto;padding:18px;font-family:Cairo,Arial,sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <h3 id="student-request-modal-title" style="margin:0;color:#17365f;">🎫 تقديم شكوى أو طلب</h3>
          <button type="button" class="btn btn-outline" onclick="closeStudentRequestForm()">إغلاق ✕</button>
        </div>
        <p id="student-request-modal-subtitle" style="font-size:12px;color:#64748b;line-height:1.8;">سيتم ربط الطلب برقم القيد والتحقق من رقم الهاتف المسجل لدى المركز.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">
          <div><label>نوع الطلب</label><select id="student-request-type" class="search-input" style="width:100%;max-width:none;"><option value="complaint">شكوى</option><option value="request">طلب</option><option value="academic">استفسار أكاديمي</option><option value="financial">استفسار مالي</option><option value="technical">مشكلة تقنية</option><option value="other">أخرى</option></select></div>
          <div><label>الأولوية</label><select id="student-request-priority" class="search-input" style="width:100%;max-width:none;"><option value="normal">عادي</option><option value="high">مرتفع</option><option value="urgent">عاجل</option></select></div>
          <div style="grid-column:1/-1;"><label>عنوان مختصر</label><input id="student-request-title" class="search-input" maxlength="150" style="width:100%;max-width:none;" placeholder="اكتب عنوان الشكوى أو الطلب"></div>
          <div style="grid-column:1/-1;"><label>التفاصيل</label><textarea id="student-request-description" class="search-input" maxlength="3000" rows="5" style="width:100%;max-width:none;resize:vertical;" placeholder="اشرح طلبك أو المشكلة بالتفصيل"></textarea></div>
        </div>
        <div id="student-request-submit-error" style="display:none;color:#b91c1c;font-size:12px;margin-top:8px;"></div>
        <button id="student-request-submit-button" type="button" class="btn btn-gold" style="width:100%;padding:12px;margin-top:14px;" onclick="submitStudentRequest()">إرسال الطلب</button>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', event => { if (event.target === modal) closeStudentRequestForm(); });
    return modal;
  }
  function ensureAdminModal() {
    let modal = $('student-request-admin-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'student-request-admin-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:1001001;background:rgba(7,18,38,.78);display:none;align-items:center;justify-content:center;padding:12px;direction:rtl;';
    modal.innerHTML = `
      <div style="background:#fff;color:#172033;border-radius:16px;width:min(760px,100%);max-height:92vh;overflow:auto;padding:18px;font-family:Cairo,Arial,sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <h3 style="margin:0;color:#17365f;">📋 تفاصيل الشكوى / الطلب</h3>
          <button type="button" class="btn btn-outline" onclick="closeStudentRequestAdmin()">إغلاق ✕</button>
        </div>
        <div id="student-request-admin-details" style="margin:12px 0;padding:12px;background:#f8fafc;border-radius:10px;line-height:1.9;font-size:13px;"></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">
          <div><label>الحالة</label><select id="student-request-admin-status" class="search-input" style="width:100%;max-width:none;"><option value="new">جديد</option><option value="in_progress">قيد المراجعة</option><option value="waiting_student">بانتظار الطالب</option><option value="resolved">تم الحل</option><option value="closed">مغلق</option></select></div>
          <div style="grid-column:1/-1;"><label>رد الإدارة</label><textarea id="student-request-admin-response" class="search-input" maxlength="3000" rows="4" style="width:100%;max-width:none;resize:vertical;" placeholder="اكتب رد الإدارة أو الإجراء الذي تم اتخاذه"></textarea></div>
        </div>
        <button id="student-request-admin-save" type="button" class="btn btn-gold" style="width:100%;padding:12px;margin-top:14px;" onclick="saveStudentRequestAdmin()">💾 حفظ التحديث</button>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', event => { if (event.target === modal) closeStudentRequestAdmin(); });
    return modal;
  }

  window.openStudentRequestForm = function() {
    if (typeof unifiedPortalStudent === 'undefined' || !unifiedPortalStudent || !unifiedPortalPhone) {
      toast('سجّل الدخول إلى بوابة الطالب أولًا.', 'error'); return;
    }
    requestContext = { studentId: String(unifiedPortalStudent.id), phone: unifiedPortalPhone, requesterType: 'student' };
    $('student-request-modal-title').textContent = '🎫 شكوى أو طلب — بوابة الطالب';
    $('student-request-modal-subtitle').textContent = 'سيتم التحقق من رقم الهاتف المسجل وربط الطلب برقم قيدك. يمكنك إرسال 5 طلبات كحد أقصى خلال 24 ساعة.';
    $('student-request-type').value = 'complaint';
    $('student-request-priority').value = 'normal';
    $('student-request-title').value = '';
    $('student-request-description').value = '';
    $('student-request-submit-error').style.display = 'none';
    $('student-request-submit-button').disabled = false;
    ensureSubmitModal().style.display = 'flex';
  };
  window.openParentRequestForm = function() {
    if (typeof ppStudent === 'undefined' || !ppStudent || typeof ppPortalPhone === 'undefined' || !ppPortalPhone) {
      toast('سجّل الدخول إلى بوابة ولي الأمر أولًا.', 'error'); return;
    }
    requestContext = { studentId: String(ppStudent.id), phone: ppPortalPhone, requesterType: 'parent' };
    $('student-request-modal-title').textContent = '🎫 شكوى أو طلب — بوابة ولي الأمر';
    $('student-request-modal-subtitle').textContent = 'سيتم التحقق من رقم هاتف ولي الأمر المسجل وربط الطلب بملف المتدرب.';
    $('student-request-type').value = 'complaint';
    $('student-request-priority').value = 'normal';
    $('student-request-title').value = '';
    $('student-request-description').value = '';
    $('student-request-submit-error').style.display = 'none';
    $('student-request-submit-button').disabled = false;
    ensureSubmitModal().style.display = 'flex';
  };
  window.closeStudentRequestForm = function() {
    const modal = $('student-request-submit-modal');
    if (modal) modal.style.display = 'none';
  };
  window.submitStudentRequest = async function() {
    const errorEl = $('student-request-submit-error');
    const button = $('student-request-submit-button');
    const title = $('student-request-title')?.value.trim() || '';
    const description = $('student-request-description')?.value.trim() || '';
    if (!requestContext) { toast('تعذر تحديد بيانات مقدم الطلب. سجّل الدخول مرة أخرى.', 'error'); return; }
    if (title.length < 3 || description.length < 5) {
      errorEl.textContent = 'اكتب عنوانًا واضحًا وتفاصيل لا تقل عن 5 أحرف.';
      errorEl.style.display = 'block'; return;
    }
    const client = getClient();
    if (!client) { errorEl.textContent = 'تعذر الاتصال بالنظام. أعد تحميل الصفحة.'; errorEl.style.display='block'; return; }
    button.disabled = true; button.textContent = '⏳ جاري إرسال الطلب...'; errorEl.style.display='none';
    try {
      const { data, error } = await client.rpc('submit_student_request', {
        p_student_id: requestContext.studentId,
        p_phone: requestContext.phone,
        p_requester_type: requestContext.requesterType,
        p_request_type: $('student-request-type').value,
        p_title: title,
        p_description: description,
        p_priority: $('student-request-priority').value
      });
      if (error) throw error;
      if (!data?.success) {
        const messages = {
          identity_not_verified:'رقم الهاتف غير مطابق للبيانات المسجلة لدى المركز.',
          identity_required:'بيانات التحقق ناقصة. سجّل الدخول مرة أخرى.',
          daily_limit:'وصلت للحد الأقصى وهو 5 طلبات خلال 24 ساعة.',
          invalid_content:'راجع عنوان الطلب وتفاصيله.',
          invalid_request_type:'نوع الطلب غير صحيح.',
          invalid_requester_type:'نوع مقدم الطلب غير صحيح.'
        };
        throw new Error(messages[data?.error] || 'تعذر إرسال الطلب.');
      }
      closeStudentRequestForm();
      toast('تم إرسال الطلب بنجاح. رقم المتابعة: ' + data.id, 'success');
      if (requestContext.requesterType === 'student') await window.loadStudentPortalRequests();
      else await window.loadParentPortalRequests();
    } catch (error) {
      errorEl.textContent = error?.message || 'حدث خطأ أثناء إرسال الطلب.';
      errorEl.style.display = 'block';
    } finally {
      button.disabled = false; button.textContent = 'إرسال الطلب';
    }
  };

  async function loadRequestsFor(studentId, phone, box) {
    if (!box || !studentId || !phone) return;
    box.innerHTML = '<div style="padding:12px;color:#64748b;text-align:center;">جاري تحميل الشكاوى والطلبات...</div>';
    try {
      const client = getClient();
      if (!client) throw new Error('تعذر الاتصال بالنظام.');
      const { data, error } = await client.rpc('get_student_requests', {
        p_student_id: String(studentId), p_phone: phone
      });
      if (error) throw error;
      if (!data?.verified) {
        box.innerHTML = '<div style="padding:12px;border:1px solid #fecaca;border-radius:10px;color:#b91c1c;">تعذر التحقق من رقم الهاتف المسجل.</div>';
        return;
      }
      const rows = Array.isArray(data.requests) ? data.requests : [];
      box.innerHTML = '<div style="border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:12px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:9px;"><strong style="color:#17365f;">🎫 الشكاوى والطلبات السابقة</strong><span style="font-size:11px;color:#64748b;">'+rows.length+' طلب</span></div>' +
        (rows.length ? '<div style="display:grid;gap:8px;">'+rows.map(r =>
          '<div style="border:1px solid #e2e8f0;border-radius:9px;padding:10px;">'+
          '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;"><strong>'+esc(r.title)+'</strong><span style="font-size:11px;padding:3px 8px;border-radius:16px;background:'+(r.status==='resolved'?'#dcfce7':r.status==='closed'?'#f1f5f9':'#fef3c7')+';">'+esc(statusLabels[r.status]||r.status)+'</span></div>'+
          '<div style="font-size:11px;color:#64748b;margin-top:4px;">'+esc(typeLabels[r.request_type]||r.request_type)+' · '+esc(formatDate(r.created_at))+' · أولوية '+esc(priorityLabels[r.priority]||r.priority)+'</div>'+
          '<div style="font-size:12px;line-height:1.8;margin-top:7px;white-space:pre-wrap;">'+esc(r.description)+'</div>'+
          (r.admin_response ? '<div style="margin-top:8px;padding:8px;background:#eff6ff;border-radius:8px;font-size:12px;"><strong>رد الإدارة:</strong> '+esc(r.admin_response)+'</div>' : '')+
          '</div>'
        ).join('')+'</div>' : '<div style="text-align:center;color:#64748b;padding:10px;">لا توجد شكاوى أو طلبات مسجلة حتى الآن.</div>')+
        '</div>';
    } catch (error) {
      box.innerHTML = '<div style="padding:12px;border:1px solid #fecaca;border-radius:10px;color:#b91c1c;">تعذر تحميل الطلبات: '+esc(error?.message||'خطأ غير معروف')+'</div>';
    }
  }
  window.loadStudentPortalRequests = async function() {
    const box = $('student-portal-requests');
    if (typeof unifiedPortalStudent === 'undefined' || !unifiedPortalStudent || !unifiedPortalPhone) return;
    await loadRequestsFor(unifiedPortalStudent.id, unifiedPortalPhone, box);
  };
  window.loadParentPortalRequests = async function() {
    const box = $('pp-request-widget');
    if (typeof ppStudent === 'undefined' || !ppStudent || typeof ppPortalPhone === 'undefined' || !ppPortalPhone) return;
    await loadRequestsFor(ppStudent.id, ppPortalPhone, box);
  };

  window.loadStudentRequestsAdmin = async function() {
    const body = $('student-requests-admin-table');
    if (!body) return;
    if (typeof currentUser === 'undefined' || !currentUser || currentUser.role !== 'admin') {
      body.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:18px;color:#b91c1c;">عرض الطلبات متاح للمدير فقط.</td></tr>';
      return;
    }
    body.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:18px;">جاري تحميل الطلبات...</td></tr>';
    try {
      const client = getClient();
      if (!client) throw new Error('تعذر الاتصال بالنظام.');
      let query = client.from('student_requests').select('*').order('created_at',{ascending:false}).limit(300);
      const status = $('student-requests-status-filter')?.value || 'all';
      const type = $('student-requests-type-filter')?.value || 'all';
      if (status !== 'all') query = query.eq('status',status);
      if (type !== 'all') query = query.eq('request_type',type);
      const { data, error } = await query;
      if (error) throw error;
      adminRequests = data || [];
      body.innerHTML = adminRequests.length ? adminRequests.map(r =>
        '<tr><td>'+esc(formatDate(r.created_at))+'</td><td>'+esc(r.requester_name||'—')+'<div style="font-size:10px;color:#64748b;">'+esc(r.requester_phone||'')+'</div></td>'+
        '<td><strong>'+esc(r.student_id)+'</strong></td><td>'+esc(typeLabels[r.request_type]||r.request_type)+'</td>'+
        '<td>'+esc(r.title)+'</td><td>'+esc(priorityLabels[r.priority]||r.priority)+'</td>'+
        '<td>'+esc(statusLabels[r.status]||r.status)+'</td><td>'+esc(r.branch||'—')+'</td>'+
        '<td><button class="btn btn-outline btn-sm" onclick="openStudentRequestAdmin(\''+esc(r.id)+'\')">فتح</button></td></tr>'
      ).join('') : '<tr><td colspan="9" style="text-align:center;padding:18px;color:#64748b;">لا توجد طلبات مطابقة.</td></tr>';
    } catch (error) {
      body.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:18px;color:#b91c1c;">تعذر تحميل الطلبات: '+esc(error?.message||'خطأ غير معروف')+'</td></tr>';
    }
  };
  window.openStudentRequestAdmin = function(id) {
    if (typeof currentUser === 'undefined' || !currentUser || currentUser.role !== 'admin') {
      toast('هذه العملية للمدير فقط.','error'); return;
    }
    const r = adminRequests.find(item => String(item.id) === String(id));
    if (!r) { toast('تعذر العثور على الطلب. حدّث القائمة وحاول مرة أخرى.','error'); return; }
    activeAdminRequestId = String(r.id);
    $('student-request-admin-details').innerHTML =
      '<div><strong>مقدم الطلب:</strong> '+esc(r.requester_name||'—')+' ('+esc(r.requester_type==='parent'?'ولي أمر':'طالب')+')</div>'+
      '<div><strong>رقم القيد:</strong> '+esc(r.student_id)+' · <strong>الهاتف:</strong> '+esc(r.requester_phone||'—')+'</div>'+
      '<div><strong>النوع:</strong> '+esc(typeLabels[r.request_type]||r.request_type)+' · <strong>الأولوية:</strong> '+esc(priorityLabels[r.priority]||r.priority)+'</div>'+
      '<div><strong>الفرع:</strong> '+esc(r.branch||'—')+' · <strong>البرنامج:</strong> '+esc(r.program||'—')+'</div>'+
      '<div><strong>تاريخ الإرسال:</strong> '+esc(formatDate(r.created_at))+'</div>'+
      '<div style="margin-top:8px;"><strong>العنوان:</strong> '+esc(r.title)+'</div>'+
      '<div style="margin-top:5px;white-space:pre-wrap;"><strong>التفاصيل:</strong><br>'+esc(r.description)+'</div>';
    $('student-request-admin-status').value = r.status;
    $('student-request-admin-response').value = r.admin_response || '';
    ensureAdminModal().style.display = 'flex';
  };
  window.closeStudentRequestAdmin = function() {
    const modal = $('student-request-admin-modal');
    if (modal) modal.style.display = 'none';
  };
  window.saveStudentRequestAdmin = async function() {
    if (!activeAdminRequestId || typeof currentUser === 'undefined' || !currentUser || currentUser.role !== 'admin') {
      toast('هذه العملية للمدير فقط.','error'); return;
    }
    const button = $('student-request-admin-save');
    button.disabled = true; button.textContent = '⏳ جاري الحفظ...';
    try {
      const client = getClient();
      const status = $('student-request-admin-status').value;
      const updates = {
        status,
        admin_response: $('student-request-admin-response').value.trim() || null,
        updated_at: new Date().toISOString(),
        resolved_at: ['resolved','closed'].includes(status) ? new Date().toISOString() : null
      };
      const { error } = await client.from('student_requests').update(updates).eq('id',activeAdminRequestId);
      if (error) throw error;
      closeStudentRequestAdmin();
      toast('تم تحديث حالة الطلب ورد الإدارة.','success');
      await window.loadStudentRequestsAdmin();
    } catch (error) {
      toast('تعذر حفظ التحديث: '+(error?.message||'خطأ غير معروف'),'error');
    } finally {
      button.disabled = false; button.textContent = '💾 حفظ التحديث';
    }
  };
})();