import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function validDescriptor(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === 128 && value.every(n => typeof n === "number" && Number.isFinite(n) && n >= -10 && n <= 10);
}
function distance(a: number[], b: number[]) {
  return Math.sqrt(a.reduce((sum, n, i) => sum + Math.pow(n - b[i], 2), 0));
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "POST only" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return reply({ error: "Server configuration missing" }, 500);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ error: "Invalid JSON" }, 400); }

  // Legacy endpoint now requires an active administrator; public student face verification
  // uses the phone-verified student_face_* RPCs instead.
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return reply({ ok:false, message:"تسجيل الدخول مطلوب." },401);
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return reply({ ok:false, message:"جلسة الدخول غير صالحة." },401);
  const { data: profile, error: profileError } = await admin.from("user_profiles")
    .select("id,role,is_active").eq("id",authData.user.id).maybeSingle();
  if (profileError || !profile || profile.role !== "admin" || profile.is_active === false) {
    return reply({ ok:false, message:"هذه الخدمة القديمة متاحة للمدير النشط فقط." },403);
  }

  const reg = String(body.enrollment_number ?? "").trim().replace(/\s+/g, "");
  const action = String(body.action ?? "lookup");
  const type = body.competition_type === "public_competition" ? "public_competition" : "weekly_quiz";
  const competitionId = body.competition_id ? String(body.competition_id).slice(0, 120) : null;
  const deviceLabel = String(body.device_label ?? "").slice(0, 160) || null;
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 500) || null;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? null;
  const ip = forwarded && /^[0-9a-fA-F:.]+$/.test(forwarded) ? forwarded : null;
  const log = async (studentId: string | null, event: string, outcome: "success"|"failure"|"blocked"|"pending", reason: string, metadata: Record<string, unknown> = {}) => {
    const { error } = await admin.from("competition_security_logs").insert({
      competition_type: type, competition_id: competitionId, enrollment_number: reg.slice(0,40) || null,
      student_id: studentId, event_type: event, outcome, reason, ip_address: ip,
      user_agent: ua, device_label: deviceLabel, metadata
    });
    return !error;
  };
  if (action === "admin_logs") {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return reply({ok:false,message:"تسجيل الدخول مطلوب."},401);
    const {data: authData,error:authError} = await admin.auth.getUser(token);
    if (authError || !authData.user) return reply({ok:false,message:"جلسة الدخول غير صالحة."},401);
    const {data: profile,error:profileError} = await admin.from("user_profiles").select("id,role,is_active").eq("id",authData.user.id).maybeSingle();
    if (profileError || !profile || profile.role !== "admin" || profile.is_active === false) return reply({ok:false,message:"هذه اللوحة للمدير فقط."},403);
    const {data: logs,error:logsError} = await admin.from("competition_security_logs").select("id,competition_type,competition_id,enrollment_number,student_id,event_type,outcome,reason,ip_address,user_agent,device_label,created_at").order("created_at",{ascending:false}).limit(200);
    if (logsError) return reply({ok:false,message:"تعذر تحميل السجل الأمني."},500);
    return reply({ok:true,logs:logs||[]});
  }

  if (!reg || reg.length > 40 || !/^[\p{L}\p{N}-]+$/u.test(reg)) {
    await log(null, action, "failure", "invalid_registration_format");
    return reply({ ok:false, code:"invalid_input", message:"راجع رقم القيد وحاول مرة أخرى." }, 400);
  }
  if (ip) {
    const { count } = await admin.from("competition_security_logs").select("id", {count:"exact",head:true})
      .eq("ip_address", ip).eq("outcome","failure").gte("created_at",new Date(Date.now()-10*60*1000).toISOString());
    if ((count ?? 0) >= 12) {
      await log(null, "rate_limit", "blocked", "too_many_failed_attempts");
      return reply({ok:false,code:"rate_limited",message:"تم إيقاف المحاولات مؤقتًا. حاول بعد قليل."},429);
    }
  }
  let student: {id:string;name:string;enrollment_number:string|null}|null = null;
  const byId = await admin.from("students").select("id,name,enrollment_number").eq("id",reg).is("deleted_at",null).maybeSingle();
  if (byId.data) student = byId.data;
  if (!student) {
    const byReg = await admin.from("students").select("id,name,enrollment_number").eq("enrollment_number",reg).is("deleted_at",null).maybeSingle();
    if (byReg.data) student = byReg.data;
  }
  if (!student) {
    await log(null, action, "failure", "registration_not_found");
    return reply({ok:false,code:"not_found",message:"تعذر التحقق من رقم القيد. راجع الرقم أو تواصل مع الإدارة."},404);
  }
  if (action === "lookup") {
    const {data: enrolled, error} = await admin.from("competition_face_enrollments").select("id,active,face_descriptor")
      .eq("student_id",String(student.id)).eq("provider","face-api-local").eq("active",true).maybeSingle();
    if (error) { await log(String(student.id),"lookup","failure","enrollment_lookup_failed"); return reply({ok:false,code:"lookup_failed",message:"تعذر التحقق من بيانات الوجه."},500); }
    await log(String(student.id),"registration_lookup","pending",enrolled?.face_descriptor ? "face_enrollment_found" : "face_enrollment_required");
    return reply({ok:true,student:{id:student.id,name:student.name,enrollment_number:student.enrollment_number||reg},enrolled:!!enrolled?.face_descriptor,next_step:enrolled?.face_descriptor?"face_verification":"face_enrollment"});
  }
  if (action === "enroll") {
    if (body.consent !== true) { await log(String(student.id),"face_enroll","blocked","consent_required"); return reply({ok:false,code:"consent_required",message:"يجب الموافقة الصريحة قبل تسجيل الوجه."},400); }
    if (!validDescriptor(body.descriptor)) { await log(String(student.id),"face_enroll","failure","invalid_face_descriptor"); return reply({ok:false,code:"invalid_descriptor",message:"تعذر قراءة الوجه. أعد التصوير في إضاءة جيدة."},400); }
    const {data: old} = await admin.from("competition_face_enrollments").select("id").eq("student_id",String(student.id)).eq("provider","face-api-local").maybeSingle();
    const values = {student_id:String(student.id),enrollment_number:student.enrollment_number||reg,provider:"face-api-local",provider_subject_id:String(student.id),face_descriptor:body.descriptor,model_version:"face-api.js-0.22.2",consent_at:new Date().toISOString(),consent_version:"competition-face-consent-v1",active:true,updated_at:new Date().toISOString()};
    const result = old?.id
      ? await admin.from("competition_face_enrollments").update(values).eq("id",old.id)
      : await admin.from("competition_face_enrollments").insert(values);
    if (result.error) { await log(String(student.id),"face_enroll","failure","enrollment_save_failed"); return reply({ok:false,code:"save_failed",message:"تعذر حفظ تسجيل الوجه. حاول مرة أخرى."},500); }
    await log(String(student.id),"face_enroll","success","face_template_saved",{model_version:"face-api.js-0.22.2"});
    return reply({ok:true,student:{id:student.id,name:student.name,enrollment_number:student.enrollment_number||reg},message:"تم تسجيل قالب الوجه بنجاح."});
  }
  if (action === "verify") {
    if (!validDescriptor(body.descriptor)) { await log(String(student.id),"face_verify","failure","invalid_face_descriptor"); return reply({ok:false,code:"invalid_descriptor",message:"لم يتم التعرف على وجه واضح. حاول مرة أخرى."},400); }
    const {data: enrolled,error} = await admin.from("competition_face_enrollments").select("id,face_descriptor,active")
      .eq("student_id",String(student.id)).eq("provider","face-api-local").eq("active",true).maybeSingle();
    if (error || !enrolled?.face_descriptor || !validDescriptor(enrolled.face_descriptor)) {
      await log(String(student.id),"face_verify","failure","face_not_enrolled");
      return reply({ok:false,code:"face_not_enrolled",message:"لم يتم تسجيل وجه لهذا الرقم. سجّل الوجه أولًا."},409);
    }
    const d = distance(enrolled.face_descriptor as number[],body.descriptor);
    const matched = d <= 0.48;
    await log(String(student.id),"face_verify",matched?"success":"failure",matched?"face_match":"face_mismatch",{distance:Number(d.toFixed(4)),threshold:0.48});
    if (!matched) return reply({ok:false,code:"face_mismatch",message:"الوجه غير مطابق للوجه المسجل. لم يتم فتح المسابقة."},403);
    const sessionResult = await admin.from("competition_face_verified_sessions").insert({student_id:String(student.id),competition_type:type,competition_id:competitionId,expires_at:new Date(Date.now()+1800000).toISOString()}).select("token").single();
    if (sessionResult.error || !sessionResult.data) return reply({ok:false,message:"تعذر إنشاء جلسة تحقق."},500);
    return reply({ok:true,verified:true,student:{id:student.id,name:student.name,enrollment_number:student.enrollment_number||reg},verification_token:sessionResult.data.token});
  }
  await log(String(student.id),action,"failure","unknown_action");
  return reply({ok:false,code:"unknown_action",message:"طلب غير معروف."},400);
});
