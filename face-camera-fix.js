/* Andalus Face Camera Fix — robust mobile video startup + tolerant face capture */
(()=>{
'use strict';
function status(msg,error){try{if(typeof setStudentFaceStatus==='function')setStudentFaceStatus(msg,!!error);}catch(_){} }
function stop(){try{if(typeof stopStudentFaceCamera==='function')stopStudentFaceCamera();}catch(_){try{const v=document.getElementById('student-face-video');if(v){v.pause();v.srcObject=null;}}catch(__){}}}
async function waitVideo(video,timeout=7000){
 const start=Date.now();
 while(Date.now()-start<timeout){
  if(video.readyState>=2 && video.videoWidth>0 && video.videoHeight>0)return;
  await new Promise(r=>setTimeout(r,120));
 }
 throw new Error('تعذر تشغيل صورة الكاميرا. اسمح للمتصفح باستخدام الكاميرا ثم حاول مرة أخرى.');
}
window.startStudentFaceCamera=async function(){
 try{
  if(document.getElementById('student-face-consent') && !document.getElementById('student-face-consent').checked)throw new Error('يجب الموافقة على معالجة بصمة الوجه أولًا.');
  const old=window.studentFaceStream;
  if(old){try{old.getTracks().forEach(t=>t.stop());}catch(_){} window.studentFaceStream=null;}
  status('جاري تجهيز الكاميرا...');
  if(typeof ensureStudentFaceModels==='function')await ensureStudentFaceModels();
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('الكاميرا غير متاحة. افتح الرابط عبر HTTPS واستخدم متصفحًا حديثًا.');
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'user'},width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}},audio:false});
  window.studentFaceStream=stream;
  const video=document.getElementById('student-face-video');
  if(!video)throw new Error('لم يتم العثور على نافذة الكاميرا.');
  video.autoplay=true;video.muted=true;video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('muted','');video.srcObject=null;
  await new Promise(r=>requestAnimationFrame(r));
  video.srcObject=stream;video.style.display='block';
  await waitVideo(video);
  try{await video.play();}
  catch(e){
   if(e?.name==='AbortError'){
    await new Promise(r=>setTimeout(r,300));
    try{await video.play();}catch(__){/* autoplay race; camera is still attached */}
   } else throw e;
  }
  const startBtn=document.getElementById('student-face-start');
  const captureBtn=document.getElementById('student-face-capture');
  if(startBtn)startBtn.style.display='none';
  if(captureBtn)captureBtn.style.display='block';
  status('الكاميرا تعمل. ثبّت وجهك أمام الكاميرا وانتظر ثانية ثم اضغط «تحقق من الوجه والدخول».');
 }catch(e){status(e?.message||'تعذر تشغيل الكاميرا.',true);}
};
window.captureStudentFaceDescriptor=async function(){
 const video=document.getElementById('student-face-video');
 if(!video || !window.studentFaceStream || video.readyState<2)throw new Error('شغّل الكاميرا وانتظر ظهور الصورة أولًا.');
 if(!window.faceapi)throw new Error('مكتبة التحقق من الوجه لم تكتمل. أعد تحميل الصفحة وحاول مرة أخرى.');
 status('جاري التعرف على الوجه...');
 const configs=[
  {inputSize:160,scoreThreshold:0.35},
  {inputSize:224,scoreThreshold:0.40},
  {inputSize:320,scoreThreshold:0.45}
 ];
 let best=null;
 for(let round=0;round<5 && !best;round++){
  for(const cfg of configs){
   try{
    const d=await faceapi.detectSingleFace(video,new faceapi.TinyFaceDetectorOptions(cfg)).withFaceLandmarks().withFaceDescriptor();
    if(d && (!best || d.detection.score>best.detection.score))best=d;
   }catch(_){}
  }
  if(!best)await new Promise(r=>setTimeout(r,280));
 }
 if(!best)throw new Error('لم نتعرف على وجه واضح. اقترب قليلًا من الكاميرا، حسّن الإضاءة، وانظر مباشرة للكاميرا دون تغطية الوجه.');
 if(best.detection.box.width<70 || best.detection.box.height<70)throw new Error('الوجه بعيد جدًا. اقترب قليلًا من الكاميرا مع إبقاء الوجه كاملًا ظاهرًا.');
 return Array.from(best.descriptor);
};
})();
