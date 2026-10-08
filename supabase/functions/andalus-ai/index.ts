import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Content-Type":"application/json; charset=utf-8"
};

const GEMINI="https://generativelanguage.googleapis.com/v1beta/interactions";
const MODEL=Deno.env.get("ANDALUS_AI_MODEL")||"gemini-3.5-flash-lite";

const clean=(v:any,n=6000)=>String(v??"").replace(/\s+/g," ").trim().slice(0,n);
const json=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:CORS});

async function auth(req:Request){
 const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!token)throw Error("غير مصرح: يلزم تسجيل الدخول.");

 const url=Deno.env.get("SUPABASE_URL")!;
 const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

 const ac=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}}});
 const {data:{user},error}=await ac.auth.getUser(token);
 if(error||!user)throw Error("جلسة الدخول غير صالحة.");

 const db=createClient(url,service);
 const {data:p,error:pe}=await db.from("user_profiles")
   .select("id,role,full_name,allowed_pages")
   .eq("id",user.id).maybeSingle();

 if(pe)throw Error("تعذر التحقق من الصلاحيات.");
 if(p?.role!=="admin" && Array.isArray(p?.allowed_pages) && !p.allowed_pages.includes("dashboard"))
   throw Error("ليس لديك صلاحية استخدام Andalus AI.");

 return {user,profile:p,db};
}

const tools=[
 {
  type:"function",
  name:"get_database_schema",
  description:"قراءة هيكل قاعدة بيانات مركز الأندلس لمعرفة الجداول والأعمدة قبل بناء أي استعلام.",
  parameters:{type:"object",properties:{},additionalProperties:false}
 },
 {
  type:"function",
  name:"query_database",
  description:"قراءة بيانات من جدول حقيقي بعد معرفة الـschema. استخدمها للقوائم والتفاصيل والبحث والترتيب.",
  parameters:{
   type:"object",
   properties:{
    table:{type:"string"},
    columns:{type:"array",items:{type:"string"}},
    filters:{type:"array",items:{
     type:"object",
     properties:{
      column:{type:"string"},
      operator:{type:"string",enum:["eq","neq","gt","gte","lt","lte","ilike","in","is_null","not_null"]},
      value:{}
     },
     required:["column","operator"],
     additionalProperties:false
    }},
    order_by:{type:["string","null"]},
    order_desc:{type:"boolean"},
    limit:{type:"integer"}
   },
   required:["table","columns","filters","order_by","order_desc","limit"],
   additionalProperties:false
  }
 },
 {
  type:"function",
  name:"aggregate_database",
  description:"حساب count/sum/avg/min/max مع grouping والفلاتر.",
  parameters:{
   type:"object",
   properties:{
    table:{type:"string"},
    group_by:{type:"array",items:{type:"string"}},
    measure_column:{type:["string","null"]},
    operation:{type:"string",enum:["count","sum","avg","min","max"]},
    filters:{type:"array",items:{
     type:"object",
     properties:{
      column:{type:"string"},
      operator:{type:"string",enum:["eq","neq","gt","gte","lt","lte","ilike","in","is_null","not_null"]},
      value:{}
     },
     required:["column","operator"],
     additionalProperties:false
    }},
    limit:{type:"integer"}
   },
   required:["table","group_by","measure_column","operation","filters","limit"],
   additionalProperties:false
  }
 }
];

async function tool(name:string,args:any,db:any){
 if(name==="get_database_schema"){
  const {data,error}=await db.rpc("ai_schema");
  if(error)throw Error(error.message);
  return data;
 }

 if(name==="query_database"){
  const {data,error}=await db.rpc("ai_read",{
   p_table:clean(args.table,100),
   p_columns:args.columns||[],
   p_filters:args.filters||[],
   p_order_by:args.order_by||null,
   p_order_desc:!!args.order_desc,
   p_limit:Math.min(Number(args.limit)||100,500)
  });
  if(error)throw Error(error.message);
  return data;
 }

 if(name==="aggregate_database"){
  const {data,error}=await db.rpc("ai_aggregate",{
   p_table:clean(args.table,100),
   p_group_by:args.group_by||[],
   p_measure_column:args.measure_column||null,
   p_operation:args.operation||"count",
   p_filters:args.filters||[],
   p_limit:Math.min(Number(args.limit)||100,500)
  });
  if(error)throw Error(error.message);
  return data;
 }

 throw Error("أداة غير معروفة.");
}

const INSTRUCTIONS=`
أنت Andalus AI، المساعد الإداري الذكي لمركز الأندلس للتدريب.

أنت مساعد عام للنظام ولست مجرد chatbot بسيط.

قواعد أساسية:
1. أجب بالعربية المصرية الواضحة والمباشرة.
2. تستطيع الإجابة عن الطلاب والبرامج والمواد والدرجات والحضور والمدفوعات والإيرادات والمصروفات والبيانات الإدارية وأي معلومة موجودة في قاعدة البيانات.
3. لا تخمن أي رقم.
4. قبل استخدام جدول أو عمود غير معروف استخدم get_database_schema.
5. استخدم query_database للبيانات والقوائم والتفاصيل.
6. استخدم aggregate_database للحسابات والتجميعات.
7. يمكنك تنفيذ الحسابات الرياضية بنفسك بعد الحصول على البيانات.
8. إذا قال المستخدم "هم" أو "ده" أو "دي" أو "اقسمهم" أو "احسبهم" فحاول ربطها بنتيجة السؤال السابق في نفس المحادثة ولا تسأل سؤالًا توضيحيًا إذا كان المقصود واضحًا.
9. إذا قال "كل" أو "جميع" فاجلب كل النتائج المتاحة ضمن الحد الآمن 500، واذكر العدد الإجمالي.
10. إذا طلب دخل شهري ففرّق بوضوح بين:
   - المحصل فعليًا.
   - المستحق.
   - المتأخر.
   - متوسط الدخل.
   ولا تعتبر عدد الطلاب دخلاً إلا إذا كانت قيمة الرسوم معروفة.
11. إذا كان السؤال يحتاج أكثر من جدول، استخدم أكثر من أداة ثم اربط النتائج منطقيًا.
12. لا تنفذ INSERT أو UPDATE أو DELETE أو أي تعديل.
13. لا تعرض مفاتيح API أو service role أو بيانات سرية.
14. لا تقل "لا أستطيع" لمجرد أن السؤال جديد؛ ابحث في الـschema والبيانات أولًا.
15. لو البيانات غير موجودة فعلًا، قل بالضبط ما الذي ينقص.
16. عند وجود نتيجة رقمية، اعرض الحساب بشكل مختصر ومفهوم.
17. استخدم الجنيه المصري عند التعامل مع مبالغ مالية.
`;

async function gemini(input:any,previous?:string){
 const key=Deno.env.get("GEMINI_API_KEY");
 if(!key)throw Error("مفتاح Gemini غير مضبوط على الخادم.");

 const body:any={
  model:MODEL,
  input,
  tools,
  system_instruction:INSTRUCTIONS
 };

 if(previous)body.previous_interaction_id=previous;

 let lastError="";
 for(let attempt=0;attempt<3;attempt++){
 const r=await fetch(GEMINI,{
  method:"POST",
  headers:{"Content-Type":"application/json","x-goog-api-key":key},
  body:JSON.stringify(body)
 });

 const d=await r.json();
 if(r.ok)return d;
 lastError=d?.error?.message||"تعذر الاتصال بـ Gemini.";
 if(/high demand|try again later|temporarily|rate limit|429/i.test(lastError) && attempt<2){
  await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));
  continue;
 }
 throw Error(lastError);
 }
 throw Error(lastError||"تعذر الاتصال بـ Gemini.");
}

function callsOf(r:any){
 return (r?.output||r?.steps||[]).filter((x:any)=>
   x.type==="function_call" || x.type==="function_call_request"
 );
}

function textOf(r:any){
 if(typeof r?.output_text==="string" && r.output_text.trim())return r.output_text;
 for(const x of (r?.output||r?.steps||[])){
  if(x.type==="text" && typeof x.text==="string")return x.text;
  if(x.content)for(const c of x.content){
   if(c.type==="text"&&typeof c.text==="string")return c.text;
  }
 }
 return "لم أتمكن من تكوين إجابة الآن.";
}

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);

 try{
  const {db,profile,user}=await auth(req);
  const body=await req.json();
  const message=clean(body?.message);

  if(!message)return json({error:"اكتب سؤالك أولًا."},400);

  const {data:ctx}=await db.from("ai_conversations")
    .select("previous_interaction_id,last_question,last_answer")
    .eq("user_id",user.id).maybeSingle();

  let input:any[]=[{
   type:"user_input",
   content:[{type:"text",text:message}]
  }];

  if(ctx?.last_question && ctx?.last_answer){
   input.unshift({
    type:"user_input",
    content:[{
     type:"text",
     text:`السياق السابق:
السؤال السابق: ${ctx.last_question}
الإجابة السابقة: ${ctx.last_answer.slice(0,5000)}

السؤال الحالي: ${message}`
    }]
   });
  }

  let r=await gemini(input,ctx?.previous_interaction_id||undefined);

  for(let round=0;round<8;round++){
   const calls=callsOf(r);
   if(!calls.length)break;

   const results:any[]=[];

   for(const call of calls){
    let args:any={};
    try{
     args=JSON.parse(call.arguments||call.args||"{}");
    }catch{}

    try{
     const result=await tool(call.name,args,db);
     results.push({
      type:"function_result",
      name:call.name,
      call_id:call.id||call.call_id,
      result:[{type:"text",text:JSON.stringify(result)}]
     });
    }catch(e:any){
     results.push({
      type:"function_result",
      name:call.name,
      call_id:call.id||call.call_id,
      result:[{type:"text",text:JSON.stringify({error:e?.message||"Tool error"})}]
     });
    }
   }

   r=await gemini(results,r.id);
  }

  let answer=textOf(r);\n  if(answer==="لم أتمكن من تكوين إجابة الآن." && r?.status==="completed" && Array.isArray(r?.steps)){
   const texts=r.steps.flatMap((s:any)=>Array.isArray(s?.content)?s.content:[]).filter((x:any)=>x?.type==="text"&&typeof x.text==="string").map((x:any)=>x.text.trim()).filter(Boolean);
   if(texts.length)answer=texts[texts.length-1];
  }

  await db.from("ai_conversations").upsert({
   user_id:user.id,
   previous_interaction_id:r.id||null,
   last_question:message,
   last_answer:answer,
   updated_at:new Date().toISOString()
  });

  try{
   await db.from("activity_log").insert({
    user_id:user.id,
    action:"andalus_ai_query",
    details:JSON.stringify({question:message.slice(0,500),model:MODEL})
   });
  }catch{}

  return json({answer,model:MODEL});
 }catch(e:any){
  console.error("andalus-ai",e);
  return json({error:e?.message||"حدث خطأ غير متوقع."},500);
 }
});
