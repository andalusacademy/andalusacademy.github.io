/* Andalus Academy — achievements and trainee ranking. Loaded after index.html main script. */
let adminAchievementRows = [];
const ACH_TYPE_LABELS = { academic: 'تفوق دراسي', attendance: 'حضور والتزام', course: 'إتمام دورة', activity: 'نشاط ومشاركة', general: 'إنجاز عام' };

function formatAchievementDate(value) {
  if (!value) return '—';
  try { return new Date(value + 'T00:00:00').toLocaleDateString('ar-EG'); } catch (_) { return value; }
}

async function loadStudentPortalAchievements(phone) {
  const box = document.getElementById('student-portal-achievements');
  if (!box || !unifiedPortalStudent) return;
  if (!phone) {
    box.innerHTML = '<div style="border:1px solid var(--border);border-radius:12px;padding:14px;background:#fff;">' +
      '<div style="font-weight:900;color:var(--navy);margin-bottom:8px;">🏅 إنجازاتي</div>' +
      '<div style="font-size:12px;color:var(--muted);margin-bottom:10px;">لخصوصية بياناتك، أدخل رقم هاتفك المسجل لدى المركز لعرض الإنجازات.</div>' +
      '<input id="student-achievements-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="رقم الهاتف المسجل" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;box-sizing:border-box;">' +
      '<button class="btn btn-gold" style="width:100%;margin-top:9px;padding:10px;" onclick="loadStudentPortalAchievements(document.getElementById(\'student-achievements-phone\')?.value?.trim())">عرض إنجازاتي</button>' +
      '<div id="student-achievements-error" style="display:none;color:#b91c1c;font-size:12px;margin-top:8px;"></div></div>';
    return;
  }
  try {
    box.innerHTML = '<div style="text-align:center;padding:12px;color:var(--muted);">جاري تحميل إنجازاتك...</div>';
    const { data, error } = await sb.rpc('student_portal_get_achievements', {
      p_student_id: unifiedPortalStudent.id, p_phone: phone
    });
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    const { data: ranking, error: rankingError } = await sb.rpc('student_portal_get_ranking', {
      p_student_id: unifiedPortalStudent.id, p_phone: phone
    });
    if (rankingError) throw rankingError;
    if (!ranking || !ranking.verified) {
      box.innerHTML = '<div style="padding:12px;border:1px solid #fecaca;border-radius:10px;color:#b91c1c;font-size:12px;">رقم الهاتف غير مطابق للبيانات المسجلة.</div>';
      return;
    }
    const rankingCard = '<div style="border:1px solid #fde68a;background:linear-gradient(135deg,#fffbeb,#fff);border-radius:12px;padding:14px;margin-bottom:10px;">' +
      '<div style="font-weight:900;color:#92400e;margin-bottom:8px;">🏆 ترتيبي بين المتدربين</div>' +
      '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">' +
      '<div style="font-size:26px;font-weight:900;color:#92400e;">' + escapeHtml(String(ranking.rank ?? '—')) + '<span style="font-size:12px;font-weight:600;"> / ' + escapeHtml(String(ranking.ranked_count ?? '—')) + '</span></div>' +
      '<div style="font-size:12px;color:#78350f;">النتيجة الإجمالية: <strong>' + escapeHtml(String(ranking.total ?? '—')) + (ranking.total == null ? '' : '%') + '</strong><br>الدرجات: ' + (ranking.exam == null ? '—' : escapeHtml(String(ranking.exam)) + '%') + ' · الحضور: ' + (ranking.attendance == null ? '—' : escapeHtml(String(ranking.attendance)) + '%') + '</div>' +
      '</div></div>';
    box.innerHTML = rankingCard + '<div style="border:1px solid var(--border);border-radius:12px;padding:14px;background:#fff;"><div style="font-weight:900;color:var(--navy);margin-bottom:10px;">🏅 إنجازاتي</div>' +
      (rows.length ? '<div style="display:grid;gap:9px;">' + rows.map(a => '<div style="border:1px solid #fde68a;background:#fffbeb;border-radius:10px;padding:11px;"><div style="font-weight:800;">🏅 ' + escapeHtml(a.title || 'إنجاز') + '</div><div style="font-size:12px;color:var(--muted);margin-top:4px;">' + escapeHtml(a.description || '') + '</div><div style="font-size:11px;color:#92400e;margin-top:5px;">' + escapeHtml(ACH_TYPE_LABELS[a.achievement_type] || 'إنجاز عام') + ' · ' + formatAchievementDate(a.achievement_date) + '</div></div>').join('') + '</div>' : '<div style="text-align:center;color:var(--muted);padding:10px;">لا توجد إنجازات مسجلة حتى الآن.</div>') + '</div>';
  } catch (e) {
    box.innerHTML = '<div style="padding:12px;border:1px solid var(--border);border-radius:10px;color:var(--muted);font-size:12px;">تعذر تحميل الإنجازات حاليًا. تأكد من صحة رقم الهاتف وتحديث قاعدة البيانات.</div>';
    console.warn('Student achievements load failed', e);
  }
}

async function loadAchievementsAdmin() {
  if (!currentUser || currentUser.role !== 'admin') { showToast('عرض الإنجازات والترتيب متاح للمدير فقط', 'error'); return; }
  const studentSelect = document.getElementById('ach-student');
  if (studentSelect) {
    const prior = studentSelect.value;
    studentSelect.innerHTML = '<option value="">— اختر المتدرب —</option>' + allStudents.slice().sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar')).map(s => '<option value="' + escapeHtml(s.id) + '">' + escapeHtml(s.name) + ' — ' + escapeHtml(s.id) + '</option>').join('');
    if (prior) studentSelect.value = prior;
  }
  const recordsBody = document.getElementById('ach-records-table');
  const rankBody = document.getElementById('ach-ranking-table');
  if (recordsBody) recordsBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:15px;">جاري تحميل الإنجازات...</td></tr>';
  try {
    const { data, error } = await sb.from('student_achievements').select('*').order('achievement_date', { ascending: false });
    if (error) throw error;
    adminAchievementRows = data || [];
    renderAdminAchievementRows();
  } catch (e) {
    if (recordsBody) recordsBody.innerHTML = '<tr><td colspan="8" style="color:#b91c1c;padding:15px;">تعذر تحميل الإنجازات: ' + escapeHtml(e.message || 'خطأ غير معروف') + ' — تحقق من تطبيق ملفات Migration على Supabase.</td></tr>';
    console.error('Admin achievements load failed', e);
  }
  try {
    await loadRiskData();
    if (!allSubjects.length) await loadSubjects();
    const sums = new Map();
    adminAchievementRows.forEach(a => {
      const s = sums.get(a.student_id) || { points: 0, activity: 0 };
      s.points += Number(a.points || 0);
      s.activity += Number(a.activity_points || 0);
      sums.set(a.student_id, s);
    });
    const ranked = allStudents.map(student => {
      const exam = getStudentGradePct(student.id);
      const attRows = allAttendanceGlobal.filter(a => a.student_id === student.id && (a.status === 'حاضر' || a.status === 'غائب'));
      const attendance = attRows.length ? Math.round(attRows.filter(a => a.status === 'حاضر').length / attRows.length * 100) : null;
      const scoreData = sums.get(student.id) || { points: 0, activity: 0 };
      const achievement = Math.min(100, scoreData.points);
      const activity = Math.min(100, scoreData.activity);
      const components = [{ value: exam, weight: 50 }, { value: attendance, weight: 25 }, { value: achievement, weight: 15 }, { value: activity, weight: 10 }];
      const availableWeight = components.reduce((sum,c) => sum + (c.value === null ? 0 : c.weight), 0);
      const total = availableWeight ? Math.round(components.reduce((sum,c) => sum + (c.value === null ? 0 : c.value * c.weight), 0) / availableWeight) : null;
      return { student, exam, attendance, achievement, activity, total, availableWeight };
    }).filter(x => x.total !== null).sort((a,b) => b.total-a.total || String(a.student.name).localeCompare(String(b.student.name), 'ar'));
    if (rankBody) rankBody.innerHTML = ranked.length ? ranked.map((r,i) => '<tr><td><strong>' + (['🥇','🥈','🥉'][i] || (i+1)) + '</strong></td><td>' + escapeHtml(r.student.name) + '</td><td>' + escapeHtml(r.student.branch || '—') + '</td><td>' + (r.exam === null ? '—' : r.exam + '%') + '</td><td>' + (r.attendance === null ? '—' : r.attendance + '%') + '</td><td>' + r.achievement + '%</td><td>' + r.activity + '%</td><td><strong>' + r.total + '%</strong><div style="font-size:10px;color:var(--muted)">الأوزان المتاحة: ' + r.availableWeight + '%</div></td></tr>').join('') : '<tr><td colspan="8" style="text-align:center;padding:18px;color:var(--muted);">لا توجد بيانات كافية للترتيب بعد.</td></tr>';
  } catch (e) {
    if (rankBody) rankBody.innerHTML = '<tr><td colspan="8" style="color:#b91c1c;padding:15px;">تعذر حساب الترتيب: ' + escapeHtml(e.message || '') + '</td></tr>';
  }
}

function renderAdminAchievementRows() {
  const body = document.getElementById('ach-records-table');
  const count = document.getElementById('ach-count');
  if (count) count.textContent = adminAchievementRows.length + ' إنجاز';
  if (!body) return;
  body.innerHTML = adminAchievementRows.length ? adminAchievementRows.map(a => {
    const student = allStudents.find(s => s.id === a.student_id);
    const safeId = String(a.id || '').replace(/[^a-zA-Z0-9-]/g, '');
    return '<tr><td>' + escapeHtml(student?.name || a.student_id) + '</td><td>' + escapeHtml(ACH_TYPE_LABELS[a.achievement_type] || 'إنجاز عام') + '</td><td><strong>' + escapeHtml(a.title || '') + '</strong></td><td>' + formatAchievementDate(a.achievement_date) + '</td><td>' + Number(a.points || 0) + '</td><td>' + Number(a.activity_points || 0) + '</td><td>' + escapeHtml(a.description || '—') + '</td><td><button class="btn btn-danger btn-sm" onclick="deleteStudentAchievement(\'' + safeId + '\')">حذف</button></td></tr>';
  }).join('') : '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:18px;">لا توجد إنجازات مسجلة.</td></tr>';
}

async function saveStudentAchievement() {
  if (!currentUser || currentUser.role !== 'admin') { showToast('الحفظ متاح للمدير فقط', 'error'); return; }
  const studentId = document.getElementById('ach-student')?.value;
  const title = document.getElementById('ach-title')?.value.trim();
  const description = document.getElementById('ach-description')?.value.trim();
  const type = document.getElementById('ach-type')?.value || 'general';
  const date = document.getElementById('ach-date')?.value || new Date().toISOString().slice(0,10);
  const points = Number(document.getElementById('ach-points')?.value || 0);
  const activityPoints = Number(document.getElementById('ach-activity-points')?.value || 0);
  if (!studentId || !title) { showToast('اختر المتدرب واكتب عنوان الإنجاز', 'error'); return; }
  if (![points,activityPoints].every(n => Number.isInteger(n) && n >= 0 && n <= 100)) { showToast('النقاط يجب أن تكون عددًا صحيحًا بين 0 و100', 'error'); return; }
  const { error } = await sb.from('student_achievements').insert({
    student_id: studentId, achievement_type: type, title, description: description || null,
    achievement_date: date, points, activity_points: activityPoints,
    created_by: currentUser.username || currentUser.id || null
  });
  if (error) { showToast('فشل حفظ الإنجاز: ' + error.message, 'error'); return; }
  document.getElementById('ach-title').value = '';
  document.getElementById('ach-description').value = '';
  document.getElementById('ach-points').value = '0';
  document.getElementById('ach-activity-points').value = '0';
  showToast('تم حفظ الإنجاز في قاعدة البيانات');
  await loadAchievementsAdmin();
}

async function deleteStudentAchievement(id) {
  if (!currentUser || currentUser.role !== 'admin') { showToast('الحذف متاح للمدير فقط', 'error'); return; }
  if (!confirm('هل تريد حذف هذا الإنجاز؟')) return;
  const { error } = await sb.from('student_achievements').delete().eq('id', id);
  if (error) { showToast('فشل حذف الإنجاز: ' + error.message, 'error'); return; }
  showToast('تم حذف الإنجاز');
  await loadAchievementsAdmin();
}
