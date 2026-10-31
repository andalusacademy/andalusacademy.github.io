/* Andalus Golden League runtime overrides.
   Loaded after the legacy portal scripts. Server RPCs are authoritative for time, score and qualification. */
(function () {
  'use strict';

  function cairoDateString(value) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(value || new Date());
    const p = {};
    parts.forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day;
  }

  window.getWeekStartDate = function (value) {
    const text = value instanceof Date ? cairoDateString(value) : String(value).slice(0, 10);
    const p = text.split('-').map(Number);
    const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7));
    return d.toISOString().slice(0, 10);
  };

  window.ensureTodayQuizActivated = async function () {
    // The database checks Africa/Cairo time and Saturday–Thursday. Never trust the device clock.
    const result = await sb.rpc('ensure_weekly_quiz_session');
    if (result.error) console.warn('Golden League activation:', result.error.message);
    return result.data || null;
  };

  window.loadWeeklyQuizSection = async function () {
    const box = document.getElementById('weekly-quiz-content');
    if (!box) return;
    box.innerHTML = '<p style="text-align:center;padding:20px;">جاري تحميل دوري الأندلس الذهبي...</p>';
    try {
      await window.ensureTodayQuizActivated();
      const today = cairoDateString();
      const weekStart = window.getWeekStartDate(today);
      const dashboard = await sb.rpc('golden_league_get_student_dashboard', {
        p_student_id: weeklyQuizStudent.id,
        p_face_token: weeklyQuizFaceToken
      });
      if (dashboard.error || !dashboard.data || !dashboard.data.ok) {
        throw new Error(dashboard.error && dashboard.error.message || 'انتهت جلسة التحقق. أعد الدخول للمسابقة.');
      }
      const league = dashboard.data;
      const [sessionResult, answeredResult, questionResult] = await Promise.all([
        sb.from('quiz_daily_sessions').select('quiz_date,question_ids').eq('quiz_date', today).maybeSingle(),
        sb.rpc('weekly_quiz_get_answered_questions', {
          p_student_id: weeklyQuizStudent.id, p_face_token: weeklyQuizFaceToken, p_week_start: weekStart
        }),
        sb.rpc('weekly_quiz_get_public_questions')
      ]);
      if (sessionResult.error) throw sessionResult.error;
      if (answeredResult.error || !answeredResult.data || !answeredResult.data.ok) {
        throw new Error('تعذر تحميل سجل إجاباتك. أعد التحقق من الهوية.');
      }
      if (questionResult.error) throw questionResult.error;
      window.aglAnsweredRows = answeredResult.data.answers || [];
      const answered = new Set((answeredResult.data.answers || []).map(function (a) {
        return a.quiz_date + '|' + a.question_id;
      }));
      const qMap = {};
      (questionResult.data || []).forEach(function (q) { qMap[q.id] = q; });
      league.daily_session_ready = !!sessionResult.data;
      weeklyQuizPendingList = [];
      if (league.window_status === 'open' && sessionResult.data && Array.isArray(sessionResult.data.question_ids)) {
        sessionResult.data.question_ids.forEach(function (id) {
          if (!answered.has(today + '|' + id) && qMap[id]) {
            weeklyQuizPendingList.push({ quiz_date: today, question: qMap[id] });
          }
        });
      }
      const myScore = {
        total_points: Number(league.week_points || 0),
        month_points: Number(league.month_points || 0),
        correct_count: Number(league.correct_count || 0),
        weekly_threshold: Number(league.weekly_threshold || 0),
        week_number: Number(league.week_number || 0),
        week_breakdown: league.week_breakdown || [],
        eligible: league.eligible === true
      };
      window.renderWeeklyQuizHome(myScore, league.leaderboard || [], league);
    } catch (e) {
      console.error('Andalus Golden League:', e);
      box.innerHTML = '<div role="alert" style="text-align:center;padding:20px;color:#991b1b;">' +
        escapeHtml(e && e.message || 'تعذر تحميل الدوري') +
        '</div><button class="btn btn-gold" style="width:100%;" onclick="goToPortalWeeklyQuiz()">إعادة التحقق والدخول</button>';
    }
  };

  window.renderWeeklyQuizHome = function (myScore, leaderboard, league) {
    const box = document.getElementById('weekly-quiz-content');
    const rows = Array.isArray(leaderboard) ? leaderboard : [];
    const podium = [rows[1], rows[0], rows[2]].filter(Boolean);
    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    const colors = { 1: '#f4c84a', 2: '#cbd5e1', 3: '#d99a62' };
    const podiumHtml = podium.map(function (r) {
      const rank = Number(r.rank || 0);
      return '<div class="agl-podium-card ' + (r.is_me ? 'is-me' : '') + '" style="--podium-height:' +
        (rank === 1 ? '174px' : rank === 2 ? '145px' : '128px') + ';--podium-color:' + (colors[rank] || '#d99a62') + ';">' +
        '<div class="agl-medal">' + (medals[rank] || '🏅') + '</div>' +
        '<div class="agl-podium-name">' + escapeHtml(r.student_name || 'متسابق') + '</div>' +
        '<div class="agl-podium-score">' + Number(r.total_points || 0) + '<small>نقطة</small></div>' +
        '<div class="agl-podium-base">المركز ' + rank + '</div>' +
        (r.is_me ? '<span class="agl-you-tag">أنت</span>' : '') + '</div>';
    }).join('');
    const rest = rows.filter(function (r) { return Number(r.rank || 0) > 3; }).map(function (r) {
      return '<div class="agl-rank-row ' + (r.is_me ? 'is-me' : '') + '">' +
        '<span class="agl-rank-number">' + Number(r.rank || 0) + '</span>' +
        '<span class="agl-rank-name">' + escapeHtml(r.student_name || 'متسابق') + (r.is_me ? '<small>أنت</small>' : '') + '</span>' +
        '<strong class="agl-rank-points">' + Number(r.total_points || 0) + ' نقطة</strong></div>';
    }).join('');
    const weekCards = (myScore.week_breakdown || []).map(function (w) {
      return '<div class="agl-weekchip">الأسبوع ' + Number(w.week) + '<strong>' +
        Number(w.points || 0) + ' / ' + Number(w.threshold || 0) + '</strong></div>';
    }).join('');
    const threshold = Number(myScore.weekly_threshold || 0);
    const pct = threshold ? Math.max(0, Math.min(100, Number(myScore.total_points || 0) / threshold * 100)) : 0;
    const status = league && league.window_status || 'not_started';
    let statusText = 'المسابقة تفتح الساعة 7:00 مساءً';
    if (status === 'open') statusText = 'المسابقة مفتوحة الآن — آخر موعد للدخول والإجابة 8:00 مساءً';
    if (status === 'ended') statusText = '🏆 انتهت مسابقة النهارده! 😂 تعال بكرة، مستنيينك! ومتتأخرش علينا ❤️ تعالا اشرب شاي ☕🤣';
    if (status === 'closed_day') statusText = 'الجمعة يوم إعلان النتائج — لا توجد مسابقة اليوم';
    if (status === 'off_cycle') statusText = 'موعد انطلاق الدورة الشهرية القادمة قريبًا';
    const weeklyRows = (league && league.weekly_leaderboard || []).map(function(r) {
      return '<div class="agl-rank-row ' + (r.is_me ? 'is-me' : '') + '">' +
        '<span class="agl-rank-number">' + Number(r.rank || 0) + '</span>' +
        '<span class="agl-rank-name">' + escapeHtml(r.student_name || 'متسابق') + (r.is_me ? '<small>أنت</small>' : '') + '</span>' +
        '<strong class="agl-rank-points">' + Number(r.total_points || 0) + ' نقطة</strong></div>';
    }).join('');
    const weeklyResultsHtml = status === 'closed_day'
      ? '<div class="agl-section-label">📊 نتائج الأسبوع — إعلان الجمعة</div>' +
        (weeklyRows ? '<div class="agl-ranking-list">' + weeklyRows + '</div>' : '<div style="text-align:center;padding:12px;color:#d7e0ee;">لا توجد مشاركات مسجلة هذا الأسبوع بعد.</div>')
      : '';
    const action = status === 'open' && weeklyQuizPendingList.length
      ? '<button class="btn btn-gold" style="width:100%;padding:14px;" onclick="startNextWeeklyQuizQuestion()">🎯 ابدأ المسابقة — ' + weeklyQuizPendingList.length + ' أسئلة متاحة</button>'
      : '<div style="text-align:center;color:#d7e0ee;font-size:12px;line-height:1.9;padding:12px 4px;">' +
        (status === 'open' ? (league && league.daily_session_ready ? 'أكملت أسئلة اليوم الخمسة — أحسنت!' : 'أسئلة اليوم لم تُجهز بعد. يرجى إبلاغ الإدارة بمراجعة بنك الأسئلة النشطة.') : statusText) + '</div>';
    box.innerHTML =
      '<style>' +
      '.agl-shell{direction:rtl;background:radial-gradient(circle at 50% 0%,#29436d 0,#14243d 48%,#0b1527 100%);color:#fff;border-radius:22px;padding:18px 14px 16px;overflow:hidden;position:relative;box-shadow:0 14px 34px rgba(8,20,40,.24)}' +
      '.agl-head{text-align:center;margin-bottom:14px}.agl-kicker{font-size:10px;letter-spacing:2px;color:#e8c87a;font-weight:900}.agl-title{font-size:21px;font-weight:900;color:#f4d27c;margin:3px 0}.agl-subtitle{font-size:11px;color:#d7e0ee}' +
      '.agl-my-score{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}.agl-stat{background:rgba(255,255,255,.075);border:1px solid rgba(232,200,122,.2);border-radius:13px;padding:10px;text-align:center}.agl-stat strong{display:block;color:#f4d27c;font-size:22px}.agl-stat span{font-size:10px;color:#d5deeb}' +
      '.agl-progress{background:rgba(255,255,255,.07);border:1px solid rgba(232,200,122,.18);border-radius:13px;padding:12px;margin:8px 0 14px}.agl-progress-line{height:8px;border-radius:20px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:7px}.agl-progress-line span{display:block;height:100%;background:linear-gradient(90deg,#b8892f,#f4d27c);border-radius:20px}.agl-weekchips{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:10px}.agl-weekchip{background:rgba(255,255,255,.07);border-radius:8px;padding:7px 3px;text-align:center;font-size:9px;color:#d7e0ee}.agl-weekchip strong{display:block;color:#f4d27c;font-size:11px;margin-top:3px}' +
      '.agl-podium{display:flex;align-items:flex-end;justify-content:center;gap:7px;min-height:200px;padding-top:8px}.agl-podium-card{height:var(--podium-height);flex:1;max-width:31%;min-width:0;position:relative;display:flex;flex-direction:column;align-items:center;padding:10px 5px 0;border:1px solid var(--podium-color);border-bottom:0;border-radius:13px 13px 0 0;background:linear-gradient(180deg,rgba(244,210,124,.15),rgba(255,255,255,.035));text-align:center}.agl-podium-card.is-me{outline:2px solid #fff;outline-offset:2px}.agl-medal{font-size:26px}.agl-podium-name{font-size:11px;font-weight:900;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:5px}.agl-podium-score{font-size:16px;color:#f4d27c;font-weight:900;margin-top:5px}.agl-podium-score small{font-size:9px;margin-right:3px;color:#d7e0ee}.agl-podium-base{margin-top:auto;width:100%;padding:5px 2px;background:var(--podium-color);color:#17243a;font-size:10px;font-weight:900;border-radius:7px 7px 0 0}.agl-you-tag{position:absolute;top:5px;left:5px;background:#fff;color:#14243d;border-radius:20px;padding:1px 6px;font-size:8px;font-weight:900}' +
      '.agl-ranking-list{margin-top:12px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.09);border-radius:13px;padding:4px 10px}.agl-rank-row{display:flex;align-items:center;gap:9px;padding:10px 2px;border-bottom:1px solid rgba(255,255,255,.09)}.agl-rank-row:last-child{border-bottom:0}.agl-rank-row.is-me{background:rgba(244,210,124,.1);border-radius:9px;padding:10px 8px}.agl-rank-number{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.1);color:#f4d27c;font-size:11px;font-weight:900;flex-shrink:0}.agl-rank-name{flex:1;min-width:0;font-size:12px;font-weight:700}.agl-rank-name small{margin-right:6px;color:#f4d27c;font-size:9px}.agl-rank-points{font-size:11px;color:#f4d27c;white-space:nowrap}.agl-section-label{margin:14px 0 6px;color:#f4d27c;font-size:12px;font-weight:900}.agl-footer{text-align:center;color:#9eacc1;font-size:9px;margin-top:12px}' +
      '@media(max-width:380px){.agl-title{font-size:18px}.agl-podium{gap:4px}.agl-podium-name{font-size:10px}.agl-podium-score{font-size:14px}}' +
      '</style>' +
      '<button class="btn btn-outline btn-sm" style="margin-bottom:12px;" onclick="backToPortalFromWeeklyQuiz()">◀ رجوع</button>' +
      '<section class="agl-shell">' +
      '<header class="agl-head"><div class="agl-kicker">ANDALUS GOLDEN LEAGUE</div><div class="agl-title">🏆 دوري الأندلس الذهبي</div><div class="agl-subtitle">المعرفة منافسة، والتميز بطولة</div></header>' +
      '<div class="agl-my-score">' +
      '<div class="agl-stat"><strong>' + Number(myScore.total_points || 0) + '</strong><span>نقاط الأسبوع</span></div>' +
      '<div class="agl-stat"><strong>' + Number(myScore.month_points || 0) + '</strong><span>نقاط الشهر</span></div>' +
      '<div class="agl-stat"><strong>' + Number(myScore.correct_count || 0) + '</strong><span>إجابات صحيحة</span></div>' +
      '<div class="agl-stat"><strong>' + Number(myScore.week_number || 0) + ' / 4</strong><span>الأسبوع الحالي</span></div></div>' +
      '<div class="agl-progress"><div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;font-weight:900;"><span>🎯 هدف التأهل لهذا الأسبوع</span><span>' + Number(myScore.total_points || 0) + ' / ' + threshold + '</span></div>' +
      '<div class="agl-progress-line"><span style="width:' + pct + '%"></span></div><div class="agl-weekchips">' + weekCards + '</div></div>' +
      '<div class="agl-section-label">👑 منصة الأبطال — الترتيب الشهري</div>' +
      (podium.length ? '<div class="agl-podium">' + podiumHtml + '</div>' : '<div style="text-align:center;padding:25px;color:#d7e0ee;">🏆 ستظهر منصة الأبطال بعد أول مشاركة</div>') +
      (rest ? '<div class="agl-section-label">بقية المتنافسين</div><div class="agl-ranking-list">' + rest + '</div>' : '') +
      weeklyResultsHtml +
      '<div class="agl-footer">حدود التأهل الأسبوعية: 200 • 230 • 260 • 280 نقطة</div></section>' +
      '<div style="margin-top:14px;">' + action + '</div>';
  };

  window.startNextWeeklyQuizQuestion = async function () {
    if (!weeklyQuizPendingList.length) { await window.loadWeeklyQuizSection(); return; }
    const item = weeklyQuizPendingList[0];
    weeklyQuizCurrentDate = item.quiz_date;
    weeklyQuizAnswered = false;
    const q = item.question;
    const box = document.getElementById('weekly-quiz-content');
    box.innerHTML = '<p style="text-align:center;padding:24px;">جاري بدء السؤال وتأمين الوقت...</p>';
    try {
      const result = await sb.rpc('weekly_quiz_start_question', {
        p_student_id: weeklyQuizStudent.id, p_quiz_date: weeklyQuizCurrentDate,
        p_question_id: q.id, p_face_token: weeklyQuizFaceToken
      });
      if (result.error) throw result.error;
      const data = result.data || {};
      if (!data.ok) {
        const messages = {
          not_started:'المسابقة تفتح الساعة 7:00 مساءً.', ended:'انتهت المسابقة الساعة 8:00 مساءً.',
          closed_day:'المسابقة من السبت إلى الخميس فقط.', already_answered:'تمت الإجابة عن السؤال بالفعل.',
          session_expired:'انتهت جلسة التحقق. أعد الدخول للمسابقة.', off_cycle:'لا توجد دورة نشطة الآن.'
        };
        throw new Error(messages[data.reason] || 'تعذر بدء السؤال.');
      }
      let remaining = Number(data.remaining_seconds || data.seconds || 0);
      if (remaining <= 0) { await window.answerWeeklyQuizQuestion(null); return; }
      const options = [{key:'a',text:q.option_a},{key:'b',text:q.option_b},{key:'c',text:q.option_c},{key:'d',text:q.option_d}];
      box.innerHTML = '<p style="text-align:center;font-size:12px;color:var(--muted);">10 نقاط — السؤال ' + (6-weeklyQuizPendingList.length) + ' من 5</p>' +
        '<div id="weekly-quiz-timer" style="text-align:center;font-size:34px;font-weight:900;color:var(--navy);margin:12px 0;">⏱ ' + remaining + '</div>' +
        '<h3 style="text-align:center;color:var(--navy);line-height:1.7;">' + escapeHtml(q.question) + '</h3>' +
        '<div id="weekly-quiz-options" style="display:flex;flex-direction:column;gap:8px;margin-top:14px;">' +
        options.map(function(o){return '<button class="btn btn-outline" style="width:100%;text-align:right;padding:12px;" onclick="answerWeeklyQuizQuestion(\''+o.key+'\')">'+escapeHtml(o.text)+'</button>';}).join('') +
        '</div>';
      const timer = document.getElementById('weekly-quiz-timer');
      clearInterval(weeklyQuizTimerInterval);
      weeklyQuizTimerInterval = setInterval(function () {
        remaining--;
        if (timer) { timer.textContent='⏱ '+Math.max(0,remaining); timer.style.color=remaining<=5?'#dc2626':'var(--navy)'; }
        if (remaining<=0) { clearInterval(weeklyQuizTimerInterval); if(!weeklyQuizAnswered) window.answerWeeklyQuizQuestion(null); }
      },1000);
    } catch(e) {
      box.innerHTML = '<div style="text-align:center;padding:20px;color:#991b1b;">'+escapeHtml(e.message||'تعذر بدء السؤال')+'</div>' +
        '<button class="btn btn-outline" style="width:100%;" onclick="loadWeeklyQuizSection()">العودة للوحة الدوري</button>';
    }
  };

  window.answerWeeklyQuizQuestion = async function (selectedKey) {
    if (weeklyQuizAnswered) return;
    weeklyQuizAnswered = true;
    clearInterval(weeklyQuizTimerInterval);
    document.querySelectorAll('#weekly-quiz-options button').forEach(function (b) { b.disabled = true; });
    const item = weeklyQuizPendingList.find(function (p) { return p.quiz_date === weeklyQuizCurrentDate; });
    if (!item) { weeklyQuizAnswered=false; await window.loadWeeklyQuizSection(); return; }
    const q = item.question;
    try {
      let result = await sb.rpc('weekly_quiz_submit_answer', {
        p_quiz_date:weeklyQuizCurrentDate,p_student_id:weeklyQuizStudent.id,
        p_question_id:q.id,p_selected_option:selectedKey,p_face_token:weeklyQuizFaceToken
      });
      if (result.error) throw result.error;
      if (result.data && result.data.reason==='time_expired' && selectedKey!==null) {
        selectedKey=null;
        result=await sb.rpc('weekly_quiz_submit_answer', {
          p_quiz_date:weeklyQuizCurrentDate,p_student_id:weeklyQuizStudent.id,
          p_question_id:q.id,p_selected_option:null,p_face_token:weeklyQuizFaceToken
        });
      }
      if (result.error) throw result.error;
      const data=result.data||{};
      if (!data.ok) {
        const messages={outside_time_window:'انتهت المسابقة اليومية الساعة 8:00 مساءً.',already_answered:'تم تسجيل إجابتك بالفعل.',session_expired:'انتهت جلسة التحقق.',question_not_started:'لم يبدأ عداد السؤال.'};
        throw new Error(messages[data.reason]||'تعذر حفظ الإجابة.');
      }
      const correct=data.is_correct===true;
      const options={a:q.option_a,b:q.option_b,c:q.option_c,d:q.option_d};
      document.getElementById('weekly-quiz-content').innerHTML =
        '<div style="text-align:center;padding:14px;"><div style="font-size:42px;">'+(selectedKey===null?'⏰':correct?'🏆':'❌')+'</div>' +
        '<h3 style="color:'+(selectedKey===null?'#b45309':correct?'#16a34a':'#dc2626')+';">'+(selectedKey===null?'انتهى الوقت':correct?'+10 نقاط — إجابة صحيحة':'إجابة غير صحيحة')+'</h3>' +
        '<div style="background:#f0fdf4;border:1px solid #16a34a55;border-radius:9px;padding:11px;margin-top:10px;color:#166534;">الإجابة الصحيحة: '+escapeHtml(options[data.correct_option]||'—')+'</div>' +
        '<button class="btn btn-gold" style="width:100%;padding:13px;margin-top:16px;" onclick="continueGoldenLeagueAfterAnswer()">متابعة ➜</button></div>';
    } catch(e) {
      console.error('Golden League answer:',e);
      weeklyQuizAnswered=false;
      document.querySelectorAll('#weekly-quiz-options button').forEach(function (b) { b.disabled=false; });
      const box=document.getElementById('weekly-quiz-content');
      if(box) box.insertAdjacentHTML('afterbegin','<div role="alert" style="padding:10px;color:#991b1b;">'+escapeHtml(e.message||'تعذر حفظ الإجابة')+'</div>');
    }
  };


  // Full student-facing Golden League portal navigation (no database migration required).
  window.showGoldenLeagueTab = function(tab) {
    const root=document.querySelector('#weekly-quiz-content .agl-shell');
    if(!root)return;
    root.querySelectorAll('.agl-page').forEach(function(p){p.style.display=p.dataset.tab===tab?'block':'none';});
    root.querySelectorAll('.agl-nav-btn').forEach(function(b){
      const active=b.dataset.tab===tab;
      b.style.background=active?'linear-gradient(135deg,#f4d27c,#c99a3b)':'rgba(255,255,255,.08)';
      b.style.color=active?'#17243a':'#e8edf5';
      b.style.borderColor=active?'#f4d27c':'rgba(255,255,255,.16)';
      b.setAttribute('aria-current',active?'page':'false');
    });
    if(tab==='history') renderGoldenLeagueHistory();
  };

  window.continueGoldenLeagueAfterAnswer=async function(){
    await window.loadWeeklyQuizSection();
    if(Array.isArray(window.weeklyQuizPendingList)&&window.weeklyQuizPendingList.length){
      await window.startNextWeeklyQuizQuestion();
    }
  };

  function renderGoldenLeagueHistory(){
    const box=document.getElementById('agl-history-content');
    if(!box)return;
    const rows=Array.isArray(window.aglAnsweredRows)?window.aglAnsweredRows:[];
    if(!rows.length){box.innerHTML='<div class="agl-empty">لم تسجل إجابات سابقة في الأسبوع الحالي حتى الآن.</div>';return;}
    const sorted=rows.slice().sort(function(a,b){return String(b.quiz_date||'').localeCompare(String(a.quiz_date||''));});
    box.innerHTML=sorted.map(function(r){
      const date=String(r.quiz_date||'');
      const correct=r.is_correct===true;
      return '<div class="agl-history-row"><span>'+escapeHtml(date)+'</span><strong>'+(correct?'✅ إجابة صحيحة':'❌ إجابة غير صحيحة')+'</strong><b>'+(correct?' +10':'0')+' نقاط</b></div>';
    }).join('');
  }

  const aglLegacyRender=window.renderWeeklyQuizHome;
  window.renderWeeklyQuizHome=function(myScore,leaderboard,league){
    aglLegacyRender.apply(this,arguments);
    const root=document.querySelector('#weekly-quiz-content .agl-shell');
    if(!root||root.querySelector('.agl-portal-nav'))return;
    const style=document.createElement('style');
    style.textContent='.agl-portal-nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:12px 0 14px}.agl-nav-btn{border:1px solid rgba(255,255,255,.16);border-radius:11px;padding:10px 5px;font:800 11px inherit;background:rgba(255,255,255,.08);color:#e8edf5;cursor:pointer}.agl-page{margin-top:8px}.agl-page .agl-section-label:first-child{margin-top:4px}.agl-empty{padding:18px;text-align:center;color:#d7e0ee;background:rgba(255,255,255,.06);border-radius:12px;font-size:12px;line-height:1.9}.agl-history-row{display:flex;align-items:center;gap:8px;justify-content:space-between;padding:11px 8px;border-bottom:1px solid rgba(255,255,255,.1);font-size:11px}.agl-history-row:last-child{border:0}.agl-history-row b{color:#f4d27c;white-space:nowrap}.agl-rule{padding:11px;border:1px solid rgba(232,200,122,.2);background:rgba(255,255,255,.055);border-radius:10px;margin:8px 0;font-size:12px;line-height:1.9;color:#e8edf5}.agl-achievement{display:flex;gap:10px;align-items:center;padding:12px;border:1px solid rgba(232,200,122,.25);background:rgba(255,255,255,.06);border-radius:11px;margin:8px 0}.agl-achievement strong{color:#f4d27c;display:block}.agl-action-wrap{margin-top:12px}';
    root.appendChild(style);
    const header=root.querySelector('.agl-head');
    const nav=document.createElement('div');nav.className='agl-portal-nav';
    const tabs=[['home','🏠 الرئيسية'],['quiz','🎯 المسابقة'],['board','👑 لوحة الصدارة'],['history','📊 مشاركاتي'],['achievements','🏅 إنجازاتي'],['rules','📜 النظام']];
    nav.innerHTML=tabs.map(function(t){return '<button type="button" class="agl-nav-btn" data-tab="'+t[0]+'" onclick="showGoldenLeagueTab(\''+t[0]+'\')">'+t[1]+'</button>';}).join('');
    if(header)header.insertAdjacentElement('afterend',nav);else root.insertBefore(nav,root.firstChild);

    const stats=root.querySelector('.agl-my-score');
    const progress=root.querySelector('.agl-progress');
    const labels=Array.from(root.querySelectorAll('.agl-section-label'));
    const podium=root.querySelector('.agl-podium');
    const podiumEmpty=root.querySelector('div[style*="text-align:center;padding:25px"]');
    const rankings=Array.from(root.querySelectorAll('.agl-ranking-list'));
    const footer=root.querySelector('.agl-footer');
    const action=root.parentElement.querySelector(':scope > div:last-child');
    const pages={};
    ['home','quiz','board','history','achievements','rules'].forEach(function(t){
      const p=document.createElement('div');p.className='agl-page';p.dataset.tab=t;pages[t]=p;root.appendChild(p);
    });
    if(stats)pages.home.appendChild(stats);
    if(progress)pages.home.appendChild(progress);
    const actionButton=action;
    if(actionButton){actionButton.classList.add('agl-action-wrap');pages.quiz.appendChild(actionButton);}
    const boardLabels=labels.filter(function(el){return /منصة الأبطال|بقية المتنافسين|نتائج الأسبوع/.test(el.textContent);});
    if(boardLabels.length){
      boardLabels.forEach(function(el){pages.board.appendChild(el);});
      if(podium)pages.board.appendChild(podium);
      if(podiumEmpty)pages.board.appendChild(podiumEmpty);
      rankings.forEach(function(el){pages.board.appendChild(el);});
    }
    if(footer)pages.board.appendChild(footer);
    pages.history.innerHTML='<div class="agl-section-label">📊 سجل مشاركاتي — الأسبوع الحالي</div><div id="agl-history-content"></div>';
    pages.achievements.innerHTML='<div class="agl-section-label">🏅 إنجازاتي في الدوري</div>';
    const points=Number(myScore.total_points||0);
    const badges=[];
    if(points>=50)badges.push(['🌟','بداية قوية','جمعت 50 نقطة أو أكثر']);
    if(points>=100)badges.push(['🔥','متسابق نشيط','جمعت 100 نقطة أو أكثر']);
    if(points>=200)badges.push(['👑','نجم التأهل','وصلت إلى 200 نقطة أو أكثر']);
    pages.achievements.innerHTML+=badges.length?badges.map(function(b){return '<div class="agl-achievement"><span style="font-size:25px">'+b[0]+'</span><div><strong>'+b[1]+'</strong><span style="font-size:11px;color:#d7e0ee">'+b[2]+'</span></div></div>';}).join(''):'<div class="agl-empty">إنجازاتك في الدوري هتظهر هنا كلما جمعت نقاطًا وحققت أهدافًا جديدة.</div>';
    pages.rules.innerHTML='<div class="agl-section-label">📜 نظام دوري الأندلس الذهبي</div>'+
      '<div class="agl-rule">🗓️ المسابقة من السبت إلى الخميس، والجمعة مخصصة لإعلان النتائج.</div>'+
      '<div class="agl-rule">⏰ تفتح المسابقة يوميًا من 7:00 إلى 8:00 مساءً بتوقيت القاهرة.</div>'+
      '<div class="agl-rule">🎯 خمس أسئلة يوميًا، وقيمة الإجابة الصحيحة 10 نقاط.</div>'+
      '<div class="agl-rule">🏆 يتم تجميع النقاط أسبوعيًا وشهريًا، وتظهر حدود التأهل الأسبوعية داخل لوحة الدوري.</div>'+
      '<div class="agl-rule">🔐 وقت المسابقة وتسجيل الإجابات والتحقق من المشاركة يتم اعتمادها من الخادم.</div>';
    window.showGoldenLeagueTab('home');
  };

  async function loadGoldenLeagueMonthlyAdmin() {
    const body=document.getElementById('wq-monthly-leaderboard');
    if(!body)return;
    body.innerHTML='<tr><td colspan="8" style="text-align:center;padding:12px;">جاري حساب النتائج...</td></tr>';
    try {
      const result=await sb.rpc('golden_league_admin_report');
      if(result.error||!result.data||!result.data.ok)throw new Error(result.error&&result.error.message||'تعذر تحميل الترتيب الشهري');
      const rows=result.data.leaderboard||[];
      body.innerHTML=rows.length?rows.map(function(r,i){
        return '<tr><td>'+(i+1)+'</td><td><strong>'+escapeHtml(r.student_name||'—')+'</strong><div style="font-size:10px;color:var(--muted)">'+escapeHtml(r.student_id||'')+'</div></td>'+
          '<td>'+Number(r.week1||0)+'</td><td>'+Number(r.week2||0)+'</td><td>'+Number(r.week3||0)+'</td><td>'+Number(r.week4||0)+'</td>'+
          '<td><strong>'+Number(r.total_points||0)+'</strong></td><td>'+(r.qualified?'<span class="badge badge-success">مؤهل</span>':'<span class="badge badge-gray">غير مؤهل</span>')+'</td></tr>';
      }).join(''):'<tr><td colspan="8" style="text-align:center;padding:12px;">لا توجد مشاركات في الدورة الحالية.</td></tr>';
    } catch(e) { body.innerHTML='<tr><td colspan="8" style="color:#b91c1c;padding:12px;">'+escapeHtml(e.message||'تعذر تحميل النتائج')+'</td></tr>'; }
  }
  window.loadGoldenLeagueMonthlyAdmin=loadGoldenLeagueMonthlyAdmin;

  function injectGoldenLeagueAdminPanel() {
    const page=document.getElementById('page-weekly-quiz-admin');
    if(!page||document.getElementById('golden-league-admin-settings'))return;
    const legacy=page.querySelector('.card');
    if(legacy)legacy.style.display='none';
    const panel=document.createElement('div');
    panel.className='card';
    panel.id='golden-league-admin-settings';
    panel.style.marginBottom='16px';
    panel.innerHTML='<div class="card-header"><h3>🏆 إعدادات دوري الأندلس الذهبي</h3></div>'+
      '<div style="padding:14px;display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">'+
      '<label>بداية المسابقة<input id="agl-start" type="time" value="19:00"></label>'+
      '<label>نهاية المسابقة<input id="agl-end" type="time" value="20:00"></label>'+
      '<label>الأسئلة يوميًا<input type="number" value="5" readonly style="width:75px;"></label>'+
      '<label>نقاط السؤال<input type="number" value="10" readonly style="width:75px;"></label>'+
      '</div><div style="padding:0 14px 14px;"><strong>حدود التأهل الأسبوعية</strong>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:8px 0;">'+
      '<label>الأسبوع 1<input id="agl-target-1" type="number" min="0" max="300" value="200"></label>'+
      '<label>الأسبوع 2<input id="agl-target-2" type="number" min="0" max="300" value="230"></label>'+
      '<label>الأسبوع 3<input id="agl-target-3" type="number" min="0" max="300" value="260"></label>'+
      '<label>الأسبوع 4<input id="agl-target-4" type="number" min="0" max="300" value="280"></label></div>'+
      '<strong>زمن السؤال بالثواني</strong><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:8px 0;">'+
      '<label>الأسبوع 1<input id="agl-seconds-1" type="number" min="1" max="60" value="20"></label>'+
      '<label>الأسبوع 2<input id="agl-seconds-2" type="number" min="1" max="60" value="15"></label>'+
      '<label>الأسبوع 3<input id="agl-seconds-3" type="number" min="1" max="60" value="10"></label>'+
      '<label>الأسبوع 4<input id="agl-seconds-4" type="number" min="1" max="60" value="5"></label></div>'+
      '<button class="btn btn-gold" onclick="saveGoldenLeagueSettings()">💾 حفظ إعدادات الدوري</button>'+
      '<button class="btn btn-outline" onclick="loadGoldenLeagueMonthlyAdmin()">🔄 تحديث ترتيب الشهر</button>'+
      '<p style="font-size:11px;color:var(--muted);line-height:1.8;margin-top:10px;">المسابقة من السبت إلى الخميس، 7–8 مساءً بتوقيت القاهرة. الجمعة للنتائج. لا يسمح الخادم بالدخول قبل الموعد أو بعده.</p></div>';
    page.insertBefore(panel,page.firstChild);
    const weeklyBody=document.getElementById('wq-leaderboard-table');
    const weeklyCard=weeklyBody&&weeklyBody.closest('.card');
    if(weeklyCard&&!document.getElementById('golden-league-monthly-card')){
      const monthly=document.createElement('div');
      monthly.className='card';
      monthly.id='golden-league-monthly-card';
      monthly.style.marginBottom='16px';
      monthly.innerHTML='<div class="card-header" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;"><h3>👑 الترتيب الشهري والتأهل النهائي</h3><button class="btn btn-outline btn-sm" onclick="loadGoldenLeagueMonthlyAdmin()">تحديث</button></div>'+
        '<div style="padding:8px 14px;color:var(--muted);font-size:12px;">يعرض نقاط الأسابيع الأربعة، ويحدد الطلاب الذين حققوا حدود التأهل 200 / 230 / 260 / 280.</div>'+
        '<div style="overflow-x:auto;"><table><thead><tr><th>#</th><th>الطالب</th><th>الأسبوع 1</th><th>الأسبوع 2</th><th>الأسبوع 3</th><th>الأسبوع 4</th><th>الإجمالي</th><th>التأهل</th></tr></thead><tbody id="wq-monthly-leaderboard"><tr><td colspan="8">جاري التحميل...</td></tr></tbody></table></div>';
      weeklyCard.insertAdjacentElement('afterend',monthly);
    }
    sb.rpc('golden_league_get_settings_admin').then(function(r){
      if(r.error||!r.data||!r.data.ok)return;
      const settings=r.data.settings||{};
      document.getElementById('agl-start').value=String(settings.daily_start||'19:00').slice(0,5);
      document.getElementById('agl-end').value=String(settings.daily_end||'20:00').slice(0,5);
      (settings.weekly_thresholds||[200,230,260,280]).forEach(function(v,i){document.getElementById('agl-target-'+(i+1)).value=v;});
      (settings.weekly_seconds||[20,15,10,5]).forEach(function(v,i){document.getElementById('agl-seconds-'+(i+1)).value=v;});
    });
  }

  window.saveGoldenLeagueSettings=async function(){
    const start=document.getElementById('agl-start').value||'19:00';
    const end=document.getElementById('agl-end').value||'20:00';
    const targets=[1,2,3,4].map(function(i){return Number(document.getElementById('agl-target-'+i).value);});
    const seconds=[1,2,3,4].map(function(i){return Number(document.getElementById('agl-seconds-'+i).value);});
    if(start>=end||targets.some(function(v){return !Number.isInteger(v)||v<0||v>300;})||seconds.some(function(v){return !Number.isInteger(v)||v<1||v>60;})){
      showToast('راجع وقت البداية والنهاية وحدود التأهل وزمن السؤال.','error');return;
    }
    const result=await sb.rpc('golden_league_update_settings',{
      p_daily_start:start,p_daily_end:end,p_questions_per_day:5,p_points_per_question:10,
      p_weekly_thresholds:targets,p_weekly_seconds:seconds
    });
    if(result.error||!result.data||!result.data.ok){showToast(result.error&&result.error.message||'تعذر حفظ الإعدادات.','error');return;}
    if(typeof logActivity==='function')await logActivity('edit','تعديل إعدادات دوري الأندلس الذهبي');
    showToast('تم حفظ إعدادات دوري الأندلس الذهبي.');
    await injectGoldenLeagueAdminPanel();
    await loadGoldenLeagueMonthlyAdmin();
  };

  const legacyAdminLoader=window.loadWeeklyQuizAdmin;
  if(typeof legacyAdminLoader==='function'){
    window.loadWeeklyQuizAdmin=async function(){
      await legacyAdminLoader.apply(this,arguments);
      injectGoldenLeagueAdminPanel();
      await loadGoldenLeagueMonthlyAdmin();
    };
  }

  function relabelGoldenLeagueEntryPoints(){
    const title=document.querySelector('#weekly-quiz-card p');
    if(title)title.textContent='🏆 دوري الأندلس الذهبي';
    document.querySelectorAll('.nav-card[onclick*="weekly-quiz-admin"]').forEach(function(card){
      const label=card.querySelector('span:last-child');if(label)label.textContent='دوري الأندلس الذهبي';
    });
    document.querySelectorAll('[onclick*="goToPortalWeeklyQuiz"]').forEach(function(button){
      if(button.tagName==='BUTTON')button.textContent='🏆 دوري الأندلس الذهبي';
    });
  }
  relabelGoldenLeagueEntryPoints();
  const legacyPortalMenu=window.renderStudentPortalMenu;
  if(typeof legacyPortalMenu==='function'){
    window.renderStudentPortalMenu=function(){
      const result=legacyPortalMenu.apply(this,arguments);
      relabelGoldenLeagueEntryPoints();
      return result;
    };
  }

  const legacyNoticeRenderer=window.renderStudentLoginNotificationDialog;
  if(typeof legacyNoticeRenderer==='function'){
    window.renderStudentLoginNotificationDialog=function(){
      legacyNoticeRenderer.apply(this,arguments);
      const n=studentLoginNotificationQueue && studentLoginNotificationQueue[0];
      if(n&&n.metadata&&n.metadata.mandatory_read===true){
        const later=document.getElementById('student-login-notice-later');
        if(later)later.remove();
        const read=document.getElementById('student-login-notice-read');
        if(read)read.textContent='✅ نعم، قرأت الإشعار';
        const overlay=document.getElementById('student-login-notification-overlay');
        const p=overlay&&overlay.querySelector('p');
        if(p)p.textContent='يجب تأكيد قراءة هذا الإعلان للمتابعة.';
      }
    };
  }
})();