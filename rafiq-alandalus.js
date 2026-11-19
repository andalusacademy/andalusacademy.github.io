(function () {
'use strict';
if (window.__andalusRafiqInstalled) return;
window.__andalusRafiqInstalled = true;
var ID='andalus-rafiq-root',busy=false;
var css=[
'#'+ID+'{position:fixed;z-index:2147483000;left:0;right:0;bottom:0;height:118px;pointer-events:none;overflow:visible;direction:ltr}',
'#'+ID+' .runner{position:absolute;left:0;bottom:3px;width:96px;height:112px;pointer-events:auto;animation:rafiqPatrol 13s ease-in-out infinite alternate}',
'#'+ID+' .stage{width:96px;height:112px;position:relative;cursor:pointer;filter:drop-shadow(0 7px 5px #183d5830)}',
'#'+ID+' svg{width:100%;height:100%;overflow:visible;animation:rafiqHop .78s ease-in-out infinite}',
'#'+ID+' .head{transform-box:fill-box;transform-origin:center bottom;animation:rafiqNod 2s ease-in-out infinite}',
'#'+ID+' .armL,#'+ID+' .armR{transform-box:fill-box;transform-origin:top center;animation:rafiqSwing .65s ease-in-out infinite alternate}',
'#'+ID+' .armR{animation-delay:-.32s}',
'#'+ID+' .legL,#'+ID+' .legR{transform-box:fill-box;transform-origin:top center;animation:rafiqRun .42s ease-in-out infinite alternate}',
'#'+ID+' .legR{animation-delay:-.21s}',
'#'+ID+' .tail{transform-box:fill-box;transform-origin:left center;animation:rafiqTail .5s ease-in-out infinite alternate}@keyframes rafiqTail{to{transform:rotate(14deg)}}',
'#'+ID+' .mouth{transform-box:fill-box;transform-origin:center;animation:rafiqMouth .2s ease-in-out infinite alternate}',
'#'+ID+'.talk .mouth{animation-duration:.13s}',
'#'+ID+' .runner.talking{animation-play-state:paused}',
'#'+ID+' .bubble{position:absolute;bottom:126px;direction:rtl;text-align:right;pointer-events:auto;cursor:pointer;box-sizing:border-box;padding:12px 16px;border-radius:24px;background:linear-gradient(135deg,#fff 0%,#e9f8ff 100%);border:3px solid #16435f;box-shadow:0 12px 26px #16435f38;font:700 15px/1.8 Tahoma,Arial,sans-serif;color:#16435f;transform-origin:var(--tail,50%) 100%;animation:rafiqBubblePop .45s cubic-bezier(.2,1.6,.4,1) both;max-height:44vh;overflow:auto;min-height:26px}',
'#'+ID+' .bubble:after{content:"";position:absolute;bottom:-12px;left:var(--tail,40px);width:16px;height:16px;background:#e9f8ff;border-right:3px solid #16435f;border-bottom:3px solid #16435f;transform:rotate(45deg);border-radius:0 0 5px 0}',
'#'+ID+' .bubble.out{animation:rafiqBubbleOut .3s ease forwards}',
'#'+ID+' .bubble .dots{display:inline-flex;gap:6px;align-items:center;height:26px}',
'#'+ID+' .bubble .dots i{width:9px;height:9px;border-radius:50%;background:#2aa7d6;animation:rafiqDot .7s ease-in-out infinite alternate}',
'#'+ID+' .bubble .dots i:nth-child(2){animation-delay:.18s}#'+ID+' .bubble .dots i:nth-child(3){animation-delay:.36s}',
'@keyframes rafiqDot{from{transform:translateY(3px);opacity:.45}to{transform:translateY(-4px);opacity:1}}',
'@keyframes rafiqBubblePop{0%{opacity:0;transform:scale(.25) translateY(22px)}100%{opacity:1;transform:none}}',
'@keyframes rafiqBubbleOut{to{opacity:0;transform:scale(.6) translateY(14px)}}',
'#'+ID+' .tap{position:absolute;inset:0;border:0;background:transparent;cursor:pointer}',
'#'+ID+' .heart-pop{position:absolute;z-index:5;pointer-events:none;color:#f21f45;font-family:Arial,sans-serif;font-size:17px;line-height:1;text-shadow:0 2px 5px #b0003033;animation:rafiqHeartFloat 1.15s ease-out forwards}',
'@keyframes rafiqHeartFloat{0%{opacity:0;transform:translate(0,8px) scale(.35) rotate(-12deg)}15%{opacity:1;transform:translate(0,0) scale(1.1) rotate(8deg)}100%{opacity:0;transform:translate(var(--dx),-76px) scale(.65) rotate(var(--rot))}}',
'#'+ID+' .runner.turn svg{animation:rafiqSpin .65s ease-in-out}',
'#'+ID+' .runner.karate .armL{animation:rafiqBlock .7s ease-in-out}',
'#'+ID+' .runner.karate .armL,#'+ID+' .runner.kungfu .armL{animation:rafiqBlock .48s ease-in-out 2 alternate}',
'#'+ID+' .runner.karate .armR{animation:rafiqPunch .7s ease-in-out}',
'#'+ID+' .runner.karate .legR{animation:rafiqKick .7s ease-in-out}',
'#'+ID+' .runner.kungfu .armL{animation:rafiqBlock .48s ease-in-out 2 alternate}',
'#'+ID+' .runner.kungfu .stage,#'+ID+' .runner.karate .stage{animation:rafiqFightBounce .42s ease-in-out 4 alternate}',
'#'+ID+' .runner.karate .armR{animation:rafiqPunch .36s ease-in-out 3 alternate}',
'#'+ID+' .runner.karate .legR{animation:rafiqKick .48s ease-in-out 2 alternate}',
'#'+ID+' .runner.kungfu .armR{animation:rafiqPunch .36s ease-in-out 3 alternate}',
'#'+ID+' .runner.kungfu .legR{animation:rafiqKick .48s ease-in-out 2 alternate}',
'@keyframes rafiqFightBounce{0%{transform:translateY(0) rotate(-7deg)}50%{transform:translateY(-17px) rotate(8deg)}100%{transform:translateY(-3px) rotate(-5deg)}}',
'#'+ID+' .runner.kungfu .armR{animation:rafiqPunch .48s ease-in-out 2 alternate}',
'#'+ID+' .runner.kungfu .legR{animation:rafiqKick .62s ease-in-out 2 alternate}',
'#'+ID+' .runner.kungfu .armL{animation:rafiqBlock .48s ease-in-out 2 alternate}',
'#'+ID+' .runner.karate .armL{animation:rafiqBlock .7s ease-in-out}',
'#'+ID+' .runner.kungfu .armR{animation:rafiqPunch .36s ease-in-out 3 alternate}',
'#'+ID+' .runner.karate .armR{animation:rafiqPunch .36s ease-in-out 3 alternate}',
'#'+ID+' .runner.kungfu .legR{animation:rafiqKick .48s ease-in-out 2 alternate}',
'#'+ID+' .runner.karate .legR{animation:rafiqKick .48s ease-in-out 2 alternate}',
'#'+ID+' .runner.kungfu svg{animation:rafiqHop .36s ease-in-out infinite}',
'@keyframes rafiqPatrol{0%{left:4px;transform:scaleX(1)}48%{left:calc(100% - 100px);transform:scaleX(1)}52%{left:calc(100% - 100px);transform:scaleX(-1)}100%{left:4px;transform:scaleX(-1)}}',
'@keyframes rafiqHop{0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-13px) rotate(-4deg)}50%{transform:translateY(0) rotate(0)}75%{transform:translateY(-8px) rotate(4deg)}}',
'@keyframes rafiqNod{50%{transform:rotate(5deg)}}@keyframes rafiqSwing{to{transform:rotate(24deg)}}',
'@keyframes rafiqRun{to{transform:rotate(28deg)}}@keyframes rafiqMouth{to{transform:scaleY(1.7)}}',
'@keyframes rafiqSpin{to{transform:rotate(360deg)}}@keyframes rafiqBlock{50%{transform:rotate(-85deg)}}',
'@keyframes rafiqPunch{50%{transform:rotate(95deg)}}@keyframes rafiqKick{50%{transform:rotate(72deg) translateX(10px)}}',
'@media(prefers-reduced-motion:reduce){#'+ID+' .runner{animation:none;left:10px}#'+ID+' .runner:not(.kungfu):not(.karate):not(.turn) svg,#'+ID+' .runner:not(.kungfu):not(.karate):not(.turn) *{animation:none!important}}'
].join('');
function addStyle(){if(document.getElementById('andalus-rafiq-style'))return;var s=document.createElement('style');s.id='andalus-rafiq-style';s.textContent=css;document.head.appendChild(s)}
function robotSvg(){return '<svg viewBox="0 0 180 210" role="img" aria-label="رفيق الأندلس بطل الكاراتيه">'+
'<defs><linearGradient id="rGi" x1="0" y1="0" x2="0.8" y2="1"><stop stop-color="#fff"/><stop offset=".7" stop-color="#f1f6fb"/><stop offset="1" stop-color="#cfdbe8"/></linearGradient><linearGradient id="rHelm" x1="0" y1="0" x2="0.9" y2="1"><stop stop-color="#fff"/><stop offset=".6" stop-color="#e6f4ff"/><stop offset="1" stop-color="#a9d2ea"/></linearGradient><linearGradient id="rFist" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ffb347"/><stop offset="1" stop-color="#f07b16"/></linearGradient></defs>'+
'<ellipse cx="90" cy="201" rx="50" ry="7" fill="#163e5a" opacity=".16"/>'+
'<g class="legL"><path d="M65 156l-5 26q-1 8 8 9h13q8-1 7-9l-3-26z" fill="url(#rGi)" stroke="#6d86a3" stroke-width="4" stroke-linejoin="round"/><path d="M57 190q-2 12 11 13h17q10-2 6-12l-6-3H62z" fill="#243b55" stroke="#14243a" stroke-width="3"/><path d="M64 197q8 3 15 0" fill="none" stroke="#6f9bc4" stroke-width="3" stroke-linecap="round"/></g>'+
'<g class="legR"><path d="M97 156l-3 26q-1 8 7 9h13q9-1 8-9l-5-26z" fill="url(#rGi)" stroke="#6d86a3" stroke-width="4" stroke-linejoin="round"/><path d="M92 190q-2 12 11 13h17q10-2 6-12l-6-3H97z" fill="#243b55" stroke="#14243a" stroke-width="3"/><path d="M99 197q8 3 15 0" fill="none" stroke="#6f9bc4" stroke-width="3" stroke-linecap="round"/></g>'+
'<rect x="40" y="88" width="100" height="80" rx="30" fill="url(#rGi)" stroke="#6d86a3" stroke-width="5"/>'+
'<path d="M68 91L92 134" fill="none" stroke="#9db2c7" stroke-width="5" stroke-linecap="round"/><path d="M112 91L84 136" fill="none" stroke="#9db2c7" stroke-width="5" stroke-linecap="round"/>'+
'<circle cx="118" cy="114" r="9" fill="#ffd35c" stroke="#a67c00" stroke-width="2.5"/><path d="M118 108l2.6 4.8 5.4.9-3.9 3.8.9 5.4-5-2.5-5 2.5.9-5.4-3.9-3.8 5.4-.9z" fill="#c98f00"/>'+
'<rect x="40" y="139" width="100" height="15" rx="6" fill="#1b1b24" stroke="#000" stroke-width="2"/><circle cx="90" cy="146" r="8" fill="#26263a" stroke="#000" stroke-width="2"/><path d="M86 152l-9 14M94 152l9 14" stroke="#1b1b24" stroke-width="6" stroke-linecap="round"/><path d="M52 144h22" stroke="#4a4a63" stroke-width="2" stroke-linecap="round"/>'+
'<g class="armL"><path d="M46 110Q29 120 24 141" fill="none" stroke="#6d86a3" stroke-width="20" stroke-linecap="round"/><path d="M46 110Q29 120 24 141" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round"/><circle cx="22" cy="152" r="12" fill="url(#rFist)" stroke="#8a4308" stroke-width="3"/><path d="M16 150h12M16 155h12" stroke="#ffd9a0" stroke-width="2" stroke-linecap="round"/></g>'+
'<g class="armR"><path d="M134 110Q151 120 156 141" fill="none" stroke="#6d86a3" stroke-width="20" stroke-linecap="round"/><path d="M134 110Q151 120 156 141" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round"/><circle cx="158" cy="152" r="12" fill="url(#rFist)" stroke="#8a4308" stroke-width="3"/><path d="M152 150h12M152 155h12" stroke="#ffd9a0" stroke-width="2" stroke-linecap="round"/></g>'+
'<g class="head"><path d="M90 14V7" stroke="#6d86a3" stroke-width="5" stroke-linecap="round"/><circle cx="90" cy="6" r="6" fill="#ffd35c" stroke="#a67c00" stroke-width="2.5"/>'+
'<rect x="28" y="12" width="124" height="92" rx="38" fill="url(#rHelm)" stroke="#6d86a3" stroke-width="5"/><rect x="38" y="30" width="104" height="60" rx="26" fill="#16435f"/>'+
'<path d="M30 33Q90 9 150 33" fill="none" stroke="#d62839" stroke-width="7"/><path d="M30 39.5Q90 15.5 150 39.5" fill="none" stroke="#fff" stroke-width="7"/><path d="M30 46Q90 22 150 46" fill="none" stroke="#14141c" stroke-width="7"/><circle cx="90" cy="28" r="6" fill="#ffd35c" stroke="#a67c00" stroke-width="2"/>'+
'<g class="tail"><path d="M148 40q18-2 28 9" fill="none" stroke="#d62839" stroke-width="7" stroke-linecap="round"/><path d="M148 45q18 6 26 19" fill="none" stroke="#14141c" stroke-width="7" stroke-linecap="round"/></g>'+
'<ellipse cx="67" cy="62" rx="12" ry="15" fill="#7fe9ff"/><ellipse cx="113" cy="62" rx="12" ry="15" fill="#7fe9ff"/><circle cx="71" cy="56" r="5" fill="#fff"/><circle cx="117" cy="56" r="5" fill="#fff"/><circle cx="63" cy="68" r="2.5" fill="#fff" opacity=".8"/><circle cx="109" cy="68" r="2.5" fill="#fff" opacity=".8"/>'+
'<path d="M52 46l22 5" stroke="#bff4ff" stroke-width="4" stroke-linecap="round"/><path d="M128 46l-22 5" stroke="#bff4ff" stroke-width="4" stroke-linecap="round"/>'+
'<ellipse cx="50" cy="78" rx="8" ry="4.5" fill="#ff9fb1" opacity=".85"/><ellipse cx="130" cy="78" rx="8" ry="4.5" fill="#ff9fb1" opacity=".85"/>'+
'<g class="mouth"><path d="M74 76q16 20 32 0z" fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M82 82q8 6 16 0q-8-3-16 0z" fill="#ff6b81"/></g>'+
'<circle cx="24" cy="62" r="9" fill="#55c9ed" stroke="#6d86a3" stroke-width="3"/><circle cx="156" cy="62" r="9" fill="#55c9ed" stroke="#6d86a3" stroke-width="3"/></g></svg>'}

function getStudent(){try{return typeof unifiedPortalStudent!=='undefined'?unifiedPortalStudent:null}catch(e){return null}}
function getDb(){try{return typeof sb!=='undefined'?sb:null}catch(e){return null}}
function mount(){addStyle();var old=document.getElementById(ID);if(old)return old;var r=document.createElement('div');r.id=ID;r.innerHTML='<div class="runner"><div class="stage">'+robotSvg()+'<button class="tap" type="button" aria-label="اضغط لسماع رفيق الأندلس"></button></div></div>';document.body.appendChild(r);r.querySelector('.tap').addEventListener('click',function(){spawnHearts(r);void play(true)});return r}
function spawnHearts(root){var stage=root.querySelector('.stage');if(!stage)return;for(var i=0;i<7;i++){(function(index){var h=document.createElement('span');h.className='heart-pop';h.textContent='♥';h.style.left=(12+Math.random()*62)+'px';h.style.top=(20+Math.random()*38)+'px';h.style.setProperty('--dx',((Math.random()-.5)*55)+'px');h.style.setProperty('--rot',((Math.random()-.5)*55)+'deg');h.style.animationDelay=(index*45)+'ms';stage.appendChild(h);setTimeout(function(){h.remove()},1450)})(i)}}
function safeText(x){return String(x||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,260)}
function fmt(v){return Math.round(Number(v)||0).toLocaleString('en-US')}
function numberWords(v){return fmt(v)}
function num1(v){return String(Math.round((Number(v)||0)*10)/10)}
function money(x){return fmt(x)+' جنيه'}
async function loadFacts(){
 var student=getStudent(),phone='';try{phone=typeof unifiedPortalPhone!=='undefined'?unifiedPortalPhone:''}catch(e){}
 var db=getDb();if(!student||!student.id||!phone||!db)throw new Error('student session unavailable');
 var result=await db.rpc('get_rafiq_student_facts',{p_student_id:String(student.id),p_phone:String(phone)});
 if(result.error)throw result.error;
 var facts=result.data||{};
 if(facts.verified!==true)throw new Error('student identity not verified');
 var out=[],attendance=Array.isArray(facts.attendance)?facts.attendance:[],payments=Array.isArray(facts.payments)?facts.payments:[];
 var absent=attendance.filter(function(x){var st=String(x.status||'').replace(/[أإآ]/g,'ا').trim();return st==='غائب'||st==='غائبة'}).length;
 out.push(absent?'بص يا بطل، متسجل عليك غياب '+(absent===1?'مرة واحدة':absent===2?'مرتين':absent<=10?fmt(absent)+' مرات':fmt(absent)+' مرة')+'.':'تمام يا بطل، مفيش غياب متسجل عليك لحد دلوقتي.');
 if(payments.length){
  var map={};payments.forEach(function(x){if(x&&x.payment_type)map[x.payment_type]=x});
  var remaining=null,late=0;
  try{if(typeof getPaymentSchedule==='function'&&typeof getStudentPaymentSummary==='function'){var summary=getStudentPaymentSummary(student,getPaymentSchedule(student),map);remaining=Number(summary.remaining)||0;late=Number(summary.lateFeesDue)||0}}catch(e){console.warn('Rafiq payment calculation unavailable:',e)}
  var extras=0;['شنطة_ادوات','فتح_ملف','كورس_انجليزى'].forEach(function(k){var x=map[k];if(x&&x.applicable!==false&&x.paid!==true)extras+=Math.max(0,Number(x.amount)||0)});
  if(remaining!==null)out.push(remaining?'خلي بالك، باقي عليك '+money(remaining)+' من رسوم البرنامج.':'عاش، رسوم البرنامج مسددة بالكامل حسب السجلات.');
  if(late)out.push('وفيه غرامات تأخير مسجلة '+money(late)+'.');
  if(extras)out.push('وفيه مصروفات مستقلة لسه مستحقة '+money(extras)+'.');
  if(remaining===null&&!extras)out.push('محتاجين نراجع حساب الرسوم من لوحة الإدارة عشان أقولك الرقم بدقة.');
 }else out.push('مش ظاهر عندي سجل مصروفات ليك دلوقتي.');
 try{
  var grades=Array.isArray(facts.exam_grades)?facts.exam_grades:[];
  if(grades.length){
   var gl=grades.slice(0,3).map(function(g){return 'في '+(g.subject||'الامتحان')+' جبت '+num1(g.score)+(g.max_score?' من '+num1(g.max_score):'')}).join('، ');
   out.push('وفيه درجات امتحانات اتضافت جديد: '+gl+'.');
  }
 }catch(e){}
 try{
  var nres=await db.rpc('get_portal_notifications',{p_student_id:String(student.id),p_phone:String(phone),p_portal_type:'student'});
  var nlist=nres&&nres.data&&nres.data.verified===true&&Array.isArray(nres.data.notifications)?nres.data.notifications:[];
  var unread=nlist.filter(function(n){return !n.is_read});
  if(unread.length){
   var titles=unread.slice(0,2).map(function(n){return String(n.title||'').trim()}).filter(Boolean).join('، وكمان ');
   out.push('عندك '+(unread.length===1?'إشعار جديد':unread.length===2?'إشعارين جداد':fmt(unread.length)+' إشعارات جداد')+(titles?'، أولهم: '+titles:'')+'.');
  }else out.push('مفيش إشعارات جديدة دلوقتي.');
 }catch(e){}
 return out
}
function soundFx(kind){
 try{
  var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  var ctx=window.__andalusRafiqAudio;if(!ctx){ctx=new AC();window.__andalusRafiqAudio=ctx}
  if(ctx.state==='suspended')ctx.resume();
  var now=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type=kind==='hit'?'triangle':'sawtooth';
  var start=kind==='hit'?145:(kind==='kick'?390:620),end=kind==='hit'?48:85;
  osc.frequency.setValueAtTime(start,now);osc.frequency.exponentialRampToValueAtTime(end,now+.19);
  gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(kind==='hit'?.18:.09,now+.018);gain.gain.exponentialRampToValueAtTime(.0001,now+.22);
  osc.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+.23);
 }catch(e){}
}
function kungfuCombo(root){
 var runner=root.querySelector('.runner'),stage=root.querySelector('.stage');
 if(!runner||!stage)return;
 runner.classList.remove('karate','turn','kungfu');void runner.offsetWidth;runner.classList.add('kungfu');
 // Use the Web Animations API on the actual SVG limbs so the moves remain visible
 // even when a device applies reduced-motion CSS or other stylesheet overrides.
 function move(el,frames,duration,delay){
  if(!el||typeof el.animate!=='function')return;
  try{el.style.transformBox='fill-box';el.style.transformOrigin='center top';
   var a=el.animate(frames,{duration:duration,delay:delay||0,easing:'ease-in-out',fill:'both'});
   setTimeout(function(){try{a.cancel()}catch(e){}},duration+(delay||0)+180);
  }catch(e){console.warn('Rafiq motion unavailable:',e)}
 }
 var left=root.querySelector('.armL'),right=root.querySelector('.armR'),leg=root.querySelector('.legR');
 move(stage,[{transform:'translateY(0) rotate(0) scale(1)'},{transform:'translateY(-25px) rotate(-13deg) scale(1.13)'},{transform:'translateY(-4px) rotate(12deg) scale(1.08)'},{transform:'translateY(-20px) rotate(-9deg) scale(1.12)'},{transform:'translateY(0) rotate(0) scale(1)'}],2300,0);
 move(left,[{transform:'rotate(0)'},{transform:'rotate(-115deg)'},{transform:'rotate(12deg)'},{transform:'rotate(-105deg)'},{transform:'rotate(0)'}],1900,0);
 move(right,[{transform:'rotate(0)'},{transform:'rotate(105deg)'},{transform:'rotate(0)'},{transform:'rotate(120deg)'},{transform:'rotate(0)'}],1800,180);
 move(leg,[{transform:'rotate(0)'},{transform:'rotate(95deg) translateX(13px)'},{transform:'rotate(-12deg)'},{transform:'rotate(85deg) translateX(12px)'},{transform:'rotate(0)'}],1800,350);
 soundFx('whoosh');
 setTimeout(function(){soundFx('hit')},300);
 setTimeout(function(){soundFx('kick')},650);
 setTimeout(function(){soundFx('whoosh')},1050);
 setTimeout(function(){runner.classList.remove('kungfu');runner.classList.add('karate');soundFx('hit')},1150);
 setTimeout(function(){runner.classList.remove('kungfu','karate');runner.classList.add('turn')},1850);
 setTimeout(function(){runner.classList.remove('turn')},2550);
}
var bubbleEl=null,skipNow=null;
function sleep(ms){return new Promise(function(res){var t=setTimeout(done,ms);function done(){clearTimeout(t);skipNow=null;res()}skipNow=done})}
function placeBubble(root){
 if(!bubbleEl)return;var run=root.querySelector('.runner');if(!run)return;
 var r=run.getBoundingClientRect(),vw=document.documentElement.clientWidth||window.innerWidth,W=Math.min(300,vw-24),cx=r.left+r.width/2,left=Math.max(12,Math.min(vw-W-12,cx-W/2));
 bubbleEl.style.width=W+'px';bubbleEl.style.left=left+'px';bubbleEl.style.setProperty('--tail',Math.max(22,Math.min(W-44,cx-left-9))+'px');
}
function emojiFor(t){t=String(t);if(/إشعار/.test(t))return ' 🔔';if(/غياب/.test(t))return t.indexOf('مفيش')>-1?' ✅':' 📅';if(/غرامات|مصروفات|رسوم|جنيه/.test(t))return /مسددة/.test(t)?' 🎉':' 💰';if(/درجات|امتحان/.test(t))return ' 📝';if(/إشعار/.test(t))return ' 🔔';return ''}
async function say(root,msgs){
 var run=root.querySelector('.runner');if(run)run.classList.add('talking');root.classList.add('talk');
 bubbleEl=document.createElement('div');bubbleEl.className='bubble';bubbleEl.setAttribute('role','status');bubbleEl.setAttribute('aria-live','polite');
 bubbleEl.addEventListener('click',function(){if(skipNow)skipNow()});root.appendChild(bubbleEl);placeBubble(root);
 try{
  for(var i=0;i<msgs.length;i++){
   bubbleEl.innerHTML='<span class="dots"><i></i><i></i><i></i></span>';placeBubble(root);await sleep(420);
   var text=String(msgs[i]),words=text.split(' ');bubbleEl.textContent='';
   for(var w=0;w<words.length;w++){bubbleEl.textContent=words.slice(0,w+1).join(' ');await sleep(95)}
   await sleep(Math.max(1500,text.length*55));
  }
 }finally{
  var b=bubbleEl;bubbleEl=null;skipNow=null;if(b){b.classList.add('out');setTimeout(function(){b.remove()},320)}
  root.classList.remove('talk');if(run)run.classList.remove('talking');
 }
}
async function play(replay){
 var student=getStudent();if(busy||!student||!student.id)return;busy=true;
 try{
  var root=mount();kungfuCombo(root);
  var name=String(student.name||'يا بطل').trim().split(/\s+/).slice(0,2).join(' ');
  var greeting=['إزيك يا '+name+'! 👋','عامل إيه النهارده؟ مستر إسلام بيمسّي عليك 😄','اضغط على قلبي وشوف! ❤️'];
  var details=[];
  var factsPromise=Promise.race([loadFacts(),new Promise(function(_,reject){setTimeout(function(){reject(new Error('student facts timeout'))},8000)})]).then(function(d){details=d},function(e){console.warn('Rafiq facts unavailable:',e);details=['مش قادر أوصل لبياناتك دلوقتي، تابع إشعاراتك وبياناتك من بوابة الطالب.']});
  await say(root,greeting);
  await factsPromise;
  var rest=['وبالمناسبة، أنا كمان بحب أتحرك! استعدوا للكونغ فو والكاراتيه! هوب! هاا! 🥋','عاش يا بطل! تابع إشعارات الأكاديمية، ومواعيد امتحاناتك، ودرجاتك، والملخصات والفيديوهات المتاحة ليك 📚']
   .concat(details.map(function(x){x=String(x).replace(/بص يا بطل/g,'بص يا نجم').replace(/خلي بالك/g,'خد بالك').replace(/لحد دلوقتي/g,'لغاية دلوقتي');return x+emojiFor(x)}))
   .concat(['شد حيلك يا بطل، إنت قدها وقدود! 💪 يلا سلام يا نجم 👋']);
  await say(root,rest);
 }finally{busy=false}
}
function install(){var original=window.renderStudentPortalMenu;if(typeof original!=='function'||original.__rafiqWrapped)return false;var wrapped=function(){var result=original.apply(this,arguments);if(getStudent()&&getStudent().id)mount();return result};wrapped.__rafiqWrapped=true;window.renderStudentPortalMenu=wrapped;return true}
if(!install()){var attempts=0,t=setInterval(function(){attempts++;if(install()||attempts>80)clearInterval(t)},250)}
window.addEventListener('resize',function(){var r=document.getElementById(ID);if(r&&bubbleEl)placeBubble(r)});
})();