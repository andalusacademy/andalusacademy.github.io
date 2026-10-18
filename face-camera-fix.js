/* Andalus Face Camera Fix v2 — mobile camera + explicit face-api model loading + tolerant detection */
(()=>{
'use strict';
const MODEL_URL='https://justadudewhohacks.github.io/face-api.js/models';
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
async function ensureFaceModels(){
 if(!window.faceapi)throw new Error('مكتبة التحقق من الوجه لم تكتمل. أعد تحميل الصفحة وحاول مرة أخرى.');
 status('جاري تحميل نماذج التحقق من الوجه...');
 try{
  if(!faceapi.nets.tinyFaceDetector.isLoaded)await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  if(!faceapi.nets.faceLandmark68Net.isLoaded)await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  if(!faceapi.nets.faceRecognitionNet.isLoaded)await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
 }catch(e){
  throw new Error('تعذر تحميل نماذج التحقق من الوجه. تأكد من اتصال الإنترنت ثم أعد المحاولة.');
 }
}
window.startStudentFaceCamera=async function(){
 try{
  const consent=document.getElementById('student-face-consent');
  if(consent && !consent.checked)throw new Error('يجب الموافقة على معالجة بصمة الوجه أولًا.');
  const old=window.studentFaceStream;
  if(old){try{old.getTracks().forEach(t=>t.stop());}catch(_){} window.studentFaceStream=null;}
  const video=document.getElementById('student-face-video');
  if(!video)throw new Error('لم يتم العثور على نافذة الكاميرا.');
  try{video.pause();}catch(_){}
  video.srcObject=null;
  status('جاري تجهيز الكاميرا...');
  await ensureFaceModels();
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('الكاميرا غير متاحة. افتح الرابط عبر HTTPS واستخدم متصفحًا حديثًا.');
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'user'},width:{ideal:640},height:{ideal:480},frameRate:{ideal:24,max:30}},audio:false});
  window.studentFaceStream=stream;
  video.autoplay=true;video.muted=true;video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('muted','');
  await new Promise(r=>requestAnimationFrame(r));
  video.srcObject=stream;
  video.style.display='block';
  await waitVideo(video);
  try{await video.play();}
  catch(e){
   if(e?.name==='AbortError'){
    await new Promise(r=>setTimeout(r,350));
    try{await video.play();}catch(__){}
   }else throw e;
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
 if(!video || !window.studentFaceStream || video.readyState<2 || !video.videoWidth)throw new Error('شغّل الكاميرا وانتظر ظهور الصورة أولًا.');
 await ensureFaceModels();
 status('جاري التعرف على الوجه...');
 const configs=[
  {inputSize:160,scoreThreshold:0.25},
  {inputSize:224,scoreThreshold:0.30},
  {inputSize:320,scoreThreshold:0.35}
 ];
 let lastError='';
 for(let round=0;round<5;round++){
  for(const cfg of configs){
   try{
    const detections=await faceapi.detectAllFaces(video,new faceapi.TinyFaceDetectorOptions(cfg)).withFaceLandmarks().withFaceDescriptors();
    if(detections&&detections.length){
     const best=detections.slice().sort((a,b)=>b.detection.score-a.detection.score)[0];
     const w=best.detection.box.width,h=best.detection.box.height;
     if(w<55||h<55){lastError='الوجه بعيد جدًا';continue;}
     return Array.from(best.descriptor);
    }
   }catch(e){lastError=e?.message||String(e);}
  }
  await new Promise(r=>setTimeout(r,220));
 }
 if(lastError && /model|net|load|landmark|recognition/i.test(lastError))throw new Error('نماذج التحقق من الوجه لم تعمل بشكل صحيح. أعد تحميل الصفحة وحاول مرة أخرى.');
 throw new Error('لم نتعرف على وجه واضح. اقترب قليلًا من الكاميرا، حسّن الإضاءة، وانظر مباشرة للكاميرا دون تغطية الوجه.');
};
})();
