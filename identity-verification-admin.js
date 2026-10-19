/* Andalus Identity Verification — Admin Reports and Reset */
(()=> {
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const client=()=>typeof sb!=='undefined'?sb:window.sb;
const admin=()=>{try{return !!(typeof currentUser!=='undefined'&&currentUser&&currentUser.role==='admin')}catch(_){return false}};
// تم إلغاء واجهة الهوية العائمة؛ الإدارة من الأيقونة الرئيسية داخل لوحة التحكم.
async function resetOne(id,name){
 if(!admin()){alert('هذه العملية للمدير فقط.');return}
 const ref=String(id??'').trim();if(!ref){alert('لا يوجد رقم طالب صالح لإعادة الضبط.');return}
 if(!confirm('إعادة ضبط تسجيل الوجه للطالب '+(name||ref)+' — رقم القيد '+ref+'؟\n\nسيحتاج الطالب إلى تسجيل وجهه من جديد، وسيتم إلغاء جلسات التحقق النشطة. لن تُحذف سجلات المحاولات السابقة أو الصور المحفوظة.'))return;
 await runReset(ref);
}
async function resetAll(){
 if(!admin()){alert('هذه العملية للمدير فقط.');return}
 const phrase=prompt('سيتم إلغاء تسجيل الوجه النشط وجلسات التحقق لجميع الطلاب. السجل التاريخي والصور لا تُحذف.\n\nاكتب RESET ALL لتأكيد العملية:');
 if(phrase!=='RESET ALL'){if(phrase!==null)alert('لم تتم إعادة الضبط؛ عبارة التأكيد غير مطابقة.');return}
 await runReset(null);
}
async function runReset(ref){
 const status=document.getElementById('idv-status');if(status)status.textContent='جاري تنفيذ إعادة الضبط...';
 try{
  const c=client();if(!c)throw Error('تعذر الاتصال بقاعدة البيانات');
  const {data,error}=await c.rpc('admin_reset_identity_registration',{p_student_ref:ref});
  if(error)throw error;
  if(!data||data.ok!==true)throw Error(data?.reason==='student_not_found'?'لم يتم العثور على الطالب برقم القيد المدخل.':'لم تنجح إعادة الضبط.');
  const msg=(data.scope==='all'?'تمت إعادة ضبط جميع الطلاب.':'تمت إعادة ضبط الطالب '+(data.enrollment_number||data.student_id)+'.')+' عدد التسجيلات المعطلة: '+(data.deactivated_enrollments||0)+'، الجلسات الملغاة: '+(data.revoked_sessions||0)+'.';
  if(status)status.textContent='✅ '+msg;
  alert(msg);await load(false);
 }catch(e){const msg=e?.message||'خطأ غير معروف';if(status)status.textContent='تعذر تنفيذ إعادة الضبط: '+msg;alert('تعذر تنفيذ إعادة الضبط: '+msg)}
}
async function load(today){
 const c=client(),out=document.getElementById('idv-content');if(!c||!out)return;out.textContent='جاري تحميل السجل...';
 try{
  const filter=document.getElementById('idv-filter')?.value||null;
  const [sumRes,rowsRes]=await Promise.all([c.rpc('admin_identity_verification_summary'),c.rpc('admin_identity_verification_report',{p_limit:1000,p_outcome:filter})]);
  if(sumRes.error)throw sumRes.error;if(rowsRes.error)throw rowsRes.error;
  const s=sumRes.data||{};const all=rowsRes.data||[];
  const rows=today?all.filter(x=>x.entered_at&&new Date(x.entered_at)>=new Date(new Date().setHours(0,0,0,0))):all;
  document.getElementById('idv-summary').innerHTML=[['إجمالي المحاولات',s.total||0],['ناجحة',s.success||0],['فاشلة',s.failure||0],['محاولات اليوم',s.today||0]].map(x=>'<div class="idv-card"><b>'+x[0]+'</b><strong>'+x[1]+'</strong></div>').join('');
  out.innerHTML=rows.length?'<div style="overflow:auto"><table class="idv-table"><thead><tr><th>الوقت</th><th>الطالب</th><th>رقم القيد</th><th>النتيجة</th><th>سبب الفشل</th><th>المسافة</th><th>الحد</th><th>الصورة الملتقطة</th><th>الصورة المرجعية</th><th>الجهاز</th><th>إجراء</th></tr></thead><tbody>'+rows.map(x=>{
   const id=String(x.student_id||'');const name=String(x.student_name||'');
   return '<tr><td>'+esc(x.entered_at?new Date(x.entered_at).toLocaleString('ar-EG'):'')+'</td><td>'+esc(name||'—')+'</td><td>'+esc(id||'—')+'</td><td class="'+(x.outcome==='success'?'idv-ok':'idv-bad')+'">'+esc(x.outcome||'قيد التحقق')+'</td><td>'+esc(x.failure_reason||x.failure_code||'—')+'</td><td>'+(x.face_distance==null?'—':Number(x.face_distance).toFixed(4))+'</td><td>'+(x.face_threshold==null?'—':esc(x.face_threshold))+'</td><td>'+(x.photo_path?'<span title="'+esc(x.photo_path)+'">📷 محفوظة</span>':'—')+'</td><td>'+(x.reference_photo_url?'<a href="'+esc(x.reference_photo_url)+'" target="_blank" rel="noopener">عرض الصورة</a>':'—')+'</td><td>'+esc(x.device_label||x.browser_name||x.user_agent||'—')+'</td><td><button class="idv-reset" data-id="'+esc(id)+'" data-name="'+esc(name)+'">إعادة ضبط</button></td></tr>'
  }).join('')+'</tbody></table></div>':'لا توجد سجلات مطابقة.';
  out.querySelectorAll('button[data-id]').forEach(btn=>btn.addEventListener('click',()=>resetOne(btn.dataset.id,btn.dataset.name)));
 }catch(e){out.textContent='تعذر تحميل سجل التحقق: '+(e?.message||'خطأ غير معروف')}
}
// لا تنشئ أزرارًا أو لوحات جانبية للهوية.

/* Face capture enhancement: the main portal function uses a strict 0.50 threshold.
   Override it after the main script has loaded, with several tolerant passes. */
function installFaceCaptureEnhancement(){
  if(typeof window.faceapi==='undefined' || typeof window.faceapi.detectSingleFace!=='function') return false;
  const enhancedCapture=async function(){
    const video=document.getElementById('student-face-video');
    if(!video || !window.studentFaceStream || video.readyState<2) throw new Error('شغّل الكاميرا وانتظر ظهور الصورة أولًا.');
    if(video.videoWidth<160 || video.videoHeight<120) throw new Error('الكاميرا لم تُجهّز الصورة بعد؛ ثبّت وجهك أمام الكاميرا لثانية.');
    const passes=[
      [160,0.25],[224,0.30],[320,0.35]
    ];
    for(let attempt=0;attempt<3;attempt++){
      for(const [inputSize,scoreThreshold] of passes){
        const detection=await window.faceapi.detectSingleFace(video,new window.faceapi.TinyFaceDetectorOptions({inputSize,scoreThreshold}))
          .withFaceLandmarks().withFaceDescriptor();
        if(detection){
          if(detection.detection.box.width<55 || detection.detection.box.height<55) continue;
          return Array.from(detection.descriptor);
        }
      }
      if(attempt<2) await new Promise(r=>setTimeout(r,220));
    }
    throw new Error('لم يظهر وجه واضح بعد. قرّب الوجه قليلًا، واجعل الإضاءة أمامك، وانظر مباشرة للكاميرا.');
  };
  window.captureStudentFaceDescriptor=enhancedCapture;
  return true;
}
if(!installFaceCaptureEnhancement()){
  let tries=0;const timer=setInterval(()=>{if(installFaceCaptureEnhancement()||++tries>=40)clearInterval(timer)},250);
}
})();