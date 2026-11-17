(function () {
'use strict';
if (window.__andalusRafiqInstalled) return;
window.__andalusRafiqInstalled = true;
const ID = 'andalus-rafiq-root';
let busy = false, hideTimer = null, utterance = null;
const css = "#"+ID+"{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 60%,rgba(220,245,255,.98),rgba(244,250,255,.97) 65%,rgba(255,255,255,.98));transition:opacity .6s;overflow:hidden}"+
"#"+ID+".mini{inset:auto 14px 14px auto;width:110px;height:135px;border-radius:24px;background:transparent}"+
"#"+ID+" .stage{position:relative;width:min(82vw,380px);height:min(76vh,450px);display:flex;align-items:center;justify-content:center;cursor:pointer}"+
"#"+ID+".mini .stage{width:110px;height:135px}"+
"#"+ID+" svg{width:100%;height:100%;overflow:visible;filter:drop-shadow(0 14px 12px #17486b30);animation:rafiqHop 1.25s ease-in-out infinite}"+
"#"+ID+".mini svg{animation:rafiqHop 2s ease-in-out infinite}"+
"#"+ID+" .head{transform-box:fill-box;transform-origin:center bottom;animation:rafiqNod 2s ease-in-out infinite}"+
"#"+ID+" .armL{transform-box:fill-box;transform-origin:top center;animation:rafiqArmL 1.2s infinite}"+
"#"+ID+" .armR{transform-box:fill-box;transform-origin:top center;animation:rafiqArmR 1.2s infinite}"+
"#"+ID+" .legL,#"+ID+" .legR{transform-box:fill-box;transform-origin:top center;animation:rafiqLeg 1.2s infinite}"+
"#"+ID+" .mouth{transform-box:fill-box;transform-origin:center;animation:rafiqMouth .22s infinite alternate}"+
"#"+ID+".talk .mouth{animation:rafiqMouth .18s infinite alternate}"+
"#"+ID+".kick svg{animation:rafiqKick 1s ease-in-out}"+
"#"+ID+".kick .armL{animation:rafiqBlock 1s ease-in-out}"+
"#"+ID+".kick .armR{animation:rafiqPunch 1s ease-in-out}"+
"#"+ID+".kick .legR{animation:rafiqKickLeg 1s ease-in-out}"+
"#"+ID+".spin svg{animation:rafiqSpin 1s ease-in-out}"+
"#"+ID+".pose svg{animation:rafiqPose .8s ease-in-out}"+
"#"+ID+" .spark{position:absolute;width:12px;height:12px;border-radius:50%;background:#f3c85d;box-shadow:0 0 0 6px #f3c85d30;animation:rafiqSpark 1.8s infinite}"+
"#"+ID+" .s1{left:10%;top:22%}#"+ID+" .s2{right:9%;top:36%;background:#5bbfe5;animation-delay:.4s}#"+ID+" .s3{left:16%;bottom:20%;animation-delay:.8s}"+
"#"+ID+".mini .spark{display:none}#"+ID+" .tap{position:absolute;inset:0;border:0;background:transparent;cursor:pointer}"+
"@keyframes rafiqHop{0%,100%{transform:translateY(0)}40%{transform:translateY(-20px) rotate(-3deg)}70%{transform:translateY(0) rotate(3deg)}}"+
"@keyframes rafiqNod{50%{transform:rotate(5deg)}}@keyframes rafiqArmL{50%{transform:rotate(-35deg)}}@keyframes rafiqArmR{50%{transform:rotate(35deg)}}@keyframes rafiqLeg{50%{transform:rotate(13deg)}}"+
"@keyframes rafiqMouth{to{transform:scaleY(1.7)}}@keyframes rafiqKick{0%,100%{transform:translateY(0) rotate(0)}45%{transform:translateY(-22px) rotate(14deg)}}"+
"@keyframes rafiqBlock{45%{transform:rotate(-85deg)}}@keyframes rafiqPunch{45%{transform:rotate(95deg)}}@keyframes rafiqKickLeg{45%{transform:rotate(72deg) translateX(12px)}}"+
"@keyframes rafiqSpin{0%{transform:rotate(0)}50%{transform:rotate(180deg) scale(.94)}100%{transform:rotate(360deg)}}@keyframes rafiqPose{50%{transform:translateY(-10px) scale(1.04)}}"+
"@keyframes rafiqSpark{50%{transform:translateY(-18px) scale(1.3)}}@media(prefers-reduced-motion:reduce){#"+ID+" *{animation:none!important}}";
function style(){if(document.getElementById('andalus-rafiq-style'))return;var s=document.createElement('style');s.id='andalus-rafiq-style';s.textContent=css;document.head.appendChild(s)}
function svg(){return '<svg viewBox="0 0 320 390" role="img" aria-label="رفيق الأندلس">'+
'<defs><linearGradient id="rb" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#56c7ee"/><stop offset="1" stop-color="#175b8d"/></linearGradient><linearGradient id="rw" x1="0" y1="0" x2="0.8" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#d9f0fa"/></linearGradient></defs>'+
'<g class="legL"><path d="M127 280l-15 75q15 16 39 2l17-63z" fill="url(#rb)" stroke="#174e78" stroke-width="8"/><path d="M113 351q-25 5-24 22t18 13h42q10-8 1-19l-12-14z" fill="#fff" stroke="#174e78" stroke-width="6"/></g>'+
'<g class="legR"><path d="M184 280l15 75q-15 16-39 2l-17-63z" fill="url(#rb)" stroke="#174e78" stroke-width="8"/><path d="M207 351q25 5 24 22t-18 13h-42q-10-8-1-19l12-14z" fill="#fff" stroke="#174e78" stroke-width="6"/></g>'+
'<path d="M112 190q48-28 96 0l18 91q-66 27-132 0z" fill="url(#rb)" stroke="#174e78" stroke-width="8"/><path d="M111 258q49 16 98 0l3 17q-52 17-104 0z" fill="#173f67"/><path d="M155 260l20 5-10 25-18-6z" fill="#f3c85d" stroke="#9d6a1a" stroke-width="3"/>'+
'<g class="armL"><path d="M113 204q-20 8-34 38l-18 29q-5 15 10 21t22-8l28-39 14-24z" fill="url(#rw)" stroke="#174e78" stroke-width="7"/><circle cx="63" cy="284" r="15" fill="#f1c5a2" stroke="#174e78" stroke-width="5"/></g>'+
'<g class="armR"><path d="M207 204q20 8 34 38l18 29q5 15-10 21t-22-8l-28-39-14-24z" fill="url(#rw)" stroke="#174e78" stroke-width="7"/><circle cx="257" cy="284" r="15" fill="#f1c5a2" stroke="#174e78" stroke-width="5"/></g>'+
'<g class="head"><path d="M160 28q-65 0-73 62l5 62q7 53 68 56 61-3 68-56l5-62q-8-62-73-62z" fill="url(#rw)" stroke="#1b5b89" stroke-width="9"/><path d="M93 91q4-58 67-58 63 0 67 58l-19-18q-47 16-96 0z" fill="url(#rb)" stroke="#1b5b89" stroke-width="7"/><path d="M160 31V12" stroke="#1b5b89" stroke-width="7" stroke-linecap="round"/><circle cx="160" cy="9" r="10" fill="#f3c85d" stroke="#1b5b89" stroke-width="4"/><ellipse cx="136" cy="118" rx="8" ry="13" fill="#173c62"/><ellipse cx="184" cy="118" rx="8" ry="13" fill="#173c62"/><circle cx="139" cy="113" r="3" fill="#fff"/><circle cx="187" cy="113" r="3" fill="#fff"/><ellipse cx="115" cy="146" rx="11" ry="6" fill="#f2a6a4"/><ellipse cx="205" cy="146" rx="11" ry="6" fill="#f2a6a4"/><path class="mouth" d="M145 153q15 17 30 0" fill="none" stroke="#1b5b89" stroke-width="6" stroke-linecap="round"/><path d="M128 177q32 13 64 0" fill="none" stroke="#6ab9dc" stroke-width="5" stroke-linecap="round"/></g></svg>'}
function remove(){var old=document.getElementById(ID);if(old)old.remove();clearTimeout(hideTimer)}
function root(mini){style();remove();var r=document.createElement('div');r.id=ID;if(mini)r.className='mini';r.innerHTML='<div class="stage"><i class="spark s1"></i><i class="spark s2"></i><i class="spark s3"></i>'+svg()+'<button class="tap" aria-label="إعادة الترحيب"></button></div>';document.body.appendChild(r);r.querySelector('.tap').onclick=function(){void play(true)};return r}
function move(kind,ms){var r=document.getElementById(ID);if(!r)return;r.classList.remove('kick','spin','pose');if(kind)r.classList.add(kind);if(ms)setTimeout(function(){var x=document.getElementById(ID);if(x)x.classList.remove(kind)},ms)}
function currentStudent(){try{return typeof unifiedPortalStudent!=='undefined'?unifiedPortalStudent:null}catch(e){return null}}
function client(){try{return typeof sb!=='undefined'?sb:null}catch(e){return null}}
function safeText(x){return String(x||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,360)}
function money(x){return Math.round(Number(x)||0).toLocaleString('ar-EG')+' جنيه'}
async function facts(){
 var student=currentStudent(),phone='';try{phone=typeof unifiedPortalPhone!=='undefined'?unifiedPortalPhone:''}catch(e){}
 var db=client();if(!student||!student.id||!phone||!db)throw new Error('student session unavailable');
 var res=await Promise.all([
 db.rpc('get_portal_notifications',{p_student_id:String(student.id),p_phone:String(phone),p_portal_type:'student'}),
 db.from('attendance').select('status').eq('student_id',student.id),
 db.from('payments').select('*').eq('student_id',student.id)
 ]);
 var out=[],n=res[0],a=res[1],p=res[2];
 if(!n.error&&n.data&&n.data.verified){var unread=(n.data.notifications||[]).filter(function(x){return x.show_on_login===true&&x.is_read!==true});if(unread.length){out.push('عندك '+unread.length+' إشعار جديد من الأكاديمية.');unread.slice(0,3).forEach(function(x){var line=safeText(x.title);var body=safeText(x.body);if(line)out.push('تنبيه: '+line+(body?'. '+body:''))})}else out.push('مفيش إشعارات جديدة عندك دلوقتي.')}
 if(!a.error&&Array.isArray(a.data)){var absent=a.data.filter(function(x){var s=String(x.status||'').replace(/[أإآ]/g,'ا').trim();return s==='غائب'||s==='غائبة'}).length;out.push(absent?'عدد مرات الغياب المسجلة عليك '+absent+'.':'مفيش غياب مسجل عليك حتى الآن.')}
 if(!p.error&&Array.isArray(p.data)){var map={};p.data.forEach(function(x){map[x.payment_type]=x});var remaining=null,late=0;try{if(typeof getPaymentSchedule==='function'&&typeof getStudentPaymentSummary==='function'){var summary=getStudentPaymentSummary(student,getPaymentSchedule(student),map);remaining=Number(summary.remaining)||0;late=Number(summary.lateFeesDue)||0}}catch(e){}
 var extras=0;['شنطة_ادوات','فتح_ملف','كورس_انجليزى'].forEach(function(k){var r=map[k];if(r&&r.applicable!==false&&r.paid!==true)extras+=Math.max(0,Number(r.amount)||0)});
 if(remaining!==null)out.push(remaining?'المتبقي من رسوم البرنامج '+money(remaining)+'.':'رسوم البرنامج مسددة بالكامل حسب السجلات الحالية.');
 if(late)out.push('غرامات التأخير المسجلة '+money(late)+'.');
 if(extras)out.push('المصروفات المستقلة غير المسددة '+money(extras)+'.');
 if(remaining===null&&!extras)out.push('تعذر حساب رصيد الرسوم بدقة من سجلات النظام الحالية.')
 }
 return out
}
function speak(parts){
 if(!('speechSynthesis'in window)||!window.SpeechSynthesisUtterance)return false;
 var synth=window.speechSynthesis,voices=synth.getVoices()||[],ar=voices.filter(function(v){return /^ar/i.test(v.lang||'')});
 var voice=ar.find(function(v){return /male|masculine|ذكر|مذكر|طارق|حامد/i.test(v.name||'')})||ar.find(function(v){return /EG/i.test(v.lang||'')})||ar[0]||null;
 var chunks=parts.filter(Boolean),i=0;
 function next(){if(i>=chunks.length){var r=document.getElementById(ID);if(r)r.classList.remove('talk');return}var u=new SpeechSynthesisUtterance(chunks[i++]);u.lang=voice?voice.lang:'ar-EG';u.rate=.91;u.pitch=.9;if(voice)u.voice=voice;u.onstart=function(){var r=document.getElementById(ID);if(r)r.classList.add('talk')};u.onend=next;u.onerror=next;utterance=u;synth.speak(u)}
 try{synth.cancel();next();return true}catch(e){return false}
}
function mini(){var r=document.getElementById(ID);if(!r)return;r.className='mini';r.innerHTML='<div class="stage">'+svg()+'<button class="tap" aria-label="إعادة الترحيب"></button></div>';r.querySelector('.tap').onclick=function(){void play(true)}}
async function play(replay){
 if(busy||!currentStudent()||!currentStudent().id)return;busy=true;
 try{
  var r=root(false);move('pose',850);setTimeout(function(){move('kick',1000)},850);setTimeout(function(){move('spin',1000)},1900);setTimeout(function(){move('pose',800)},2900);
  var details=[];try{details=await facts()}catch(e){console.warn('Rafiq data:',e);details=['تابع إشعاراتك وبياناتك من بوابة الطالب.']}
  if(!document.getElementById(ID))return;
  var student=currentStudent(),name=String(student.name||'يا بطل').trim().split(/\s+/).slice(0,2).join(' ');
  var lines=['أهلاً يا '+name+'.','أنا رفيق الأندلس، صاحبك في الأكاديمية! يلا نبدأ يومنا بنشاط.','افتكر تراجع دروسك وتتابع بوابتك باستمرار.'].concat(details).concat(['شد حيلك يا بطل، وإحنا دايماً معاك. بالتوفيق!']);
  var started=speak(lines);var duration=Math.min(36000,Math.max(12000,lines.join(' ').length*100));
  hideTimer=setTimeout(mini,started?duration:9000);
  r.onclick=function(){if('speechSynthesis'in window&&window.speechSynthesis.paused)window.speechSynthesis.resume()};
 }finally{busy=false}
}
function install(){
 var original=window.renderStudentPortalMenu;if(typeof original!=='function'||original.__rafiqWrapped)return false;
 var wrapped=function(){var result=original.apply(this,arguments);var s=currentStudent();if(s&&s.id)setTimeout(function(){void play(false)},300);return result};
 wrapped.__rafiqWrapped=true;window.renderStudentPortalMenu=wrapped;return true
}
if(!install()){var tries=0,t=setInterval(function(){tries++;if(install()||tries>80)clearInterval(t)},250)}
document.addEventListener('visibilitychange',function(){if(document.hidden&&'speechSynthesis'in window)try{window.speechSynthesis.cancel()}catch(e){}});
window.addEventListener('pagehide',function(){if('speechSynthesis'in window)try{window.speechSynthesis.cancel()}catch(e){}});
})();