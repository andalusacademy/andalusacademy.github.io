import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = Deno.env.get("ANDALUS_AI_MODEL") || "gpt-6-luna";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

function cleanText(value: unknown, max = 4000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function requireAdmin(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) throw new Error("غير مصرح: يلزم تسجيل الدخول.");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(jwt);
  if (authError || !user) throw new Error("جلسة الدخول غير صالحة.");

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await adminClient
    .from("user_profiles")
    .select("id,role,full_name,name,allowed_pages")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw new Error("تعذر التحقق من صلاحيات المستخدم.");
  const isAdmin = profile?.role === "admin";
  const allowed = Array.isArray(profile?.allowed_pages) ? profile.allowed_pages : null;
  if (!isAdmin && allowed && !allowed.includes("dashboard")) {
    throw new Error("ليس لديك صلاحية استخدام Andalus AI.");
  }

  return { user, profile, db: adminClient };
}

const tools = [
  {
    type: "function",
    name: "get_center_overview",
    description: "إرجاع أرقام آمنة ومختصرة عن المركز: عدد الطلاب والبرامج والمواد والليدز، دون بيانات شخصية.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    type: "function",
    name: "search_students",
    description: "البحث عن طلاب بالاسم أو رقم القيد. رقم القيد في نظام الأندلس هو حقل id في جدول الطلاب. استخدمها فقط عندما يطلب المستخدم بيانات طالب محدد أو قائمة صغيرة.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "اسم الطالب أو رقم القيد" } },
      required: ["query"], additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_student_finance",
    description: "إرجاع ملخص مدفوعات طالب محدد: المدفوع والمتبقي وسجل الدفعات. لا تستخدمها إلا بعد معرفة رقم القيد أو student_id.",
    parameters: {
      type: "object",
      properties: { student_id: { type: "string" } },
      required: ["student_id"], additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_student_academic",
    description: "إرجاع درجات وحضور طالب محدد. استخدمها لأسئلة المستوى الدراسي والدرجات والحضور.",
    parameters: {
      type: "object",
      properties: { student_id: { type: "string" } },
      required: ["student_id"], additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_payment_risk",
    description: "إرجاع قائمة مختصرة بالطلاب الذين لديهم دفعات غير مسددة أو متأخرة، مع أرقام القيد والمبالغ فقط.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
];

async function runTool(name: string, args: Record<string, unknown>, db: ReturnType<typeof createClient>) {
  if (name === "get_center_overview") {
    const [students, programs, subjects, leads] = await Promise.all([
      db.from("students").select("id", { count: "exact", head: true }).is("deleted_at", null),
      db.from("programs").select("id", { count: "exact", head: true }),
      db.from("subjects").select("id", { count: "exact", head: true }),
      db.from("leads").select("id", { count: "exact", head: true }),
    ]);
    return { الطلاب: students.count ?? 0, البرامج: programs.count ?? 0, المواد: subjects.count ?? 0, الاستفسارات: leads.count ?? 0 };
  }

  if (name === "search_students") {
    const q = cleanText(args.query, 100);
    if (!q) return { students: [] };
    const escaped = q.replace(/[%_]/g, "");
    const { data, error } = await db
      .from("students")
      .select("id,name,branch,program_id")
      .is("deleted_at", null)
      .or(`name.ilike.%${escaped}%,id.ilike.%${escaped}%`)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error("تعذر البحث عن الطالب.");
    return { students: (data || []).map((s: any) => ({ id: s.id, registration_no: s.id, name: s.name, branch: s.branch, program_id: s.program_id })) };
  }

  if (name === "get_student_finance") {
    const studentId = cleanText(args.student_id, 100);
    const [{ data: student }, { data: payments }] = await Promise.all([
      db.from("students").select("id,name,program_id").eq("id", studentId).maybeSingle(),
      db.from("payments").select("payment_type,amount,paid,paid_date,due_date,notes").eq("student_id", studentId).order("due_date"),
    ]);
    if (!student) return { error: "الطالب غير موجود." };
    const rows = payments || [];
    const paid = rows.filter((p: any) => p.paid).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const due = rows.filter((p: any) => !p.paid).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    return { student: { id: student.id, registration_no: student.id, name: student.name }, total_paid: paid, total_due: due, payments: rows.slice(0, 30) };
  }

  if (name === "get_student_academic") {
    const studentId = cleanText(args.student_id, 100);
    const [{ data: student }, { data: grades }, { data: attendance }] = await Promise.all([
      db.from("students").select("id,name,program_id,branch").eq("id", studentId).maybeSingle(),
      db.from("grades").select("*").eq("student_id", studentId),
      db.from("attendance").select("date,status,session_id").eq("student_id", studentId).order("date", { ascending: false }).limit(100),
    ]);
    if (!student) return { error: "الطالب غير موجود." };
    const att = attendance || [];
    const present = att.filter((x: any) => String(x.status || "").includes("حاضر") || String(x.status || "").toLowerCase() === "present").length;
    return { student: { id: student.id, registration_no: student.id, name: student.name, branch: student.branch }, grades: grades || [], attendance: { total_records: att.length, present, percentage: att.length ? Math.round((present / att.length) * 100) : null } };
  }

  if (name === "get_payment_risk") {
    const { data: payments, error } = await db.from("payments").select("student_id,amount,paid,paid_date,due_date").eq("paid", false).order("due_date").limit(200);
    if (error) throw new Error("تعذر قراءة حالة المدفوعات.");
    const ids = [...new Set((payments || []).map((p: any) => p.student_id).filter(Boolean))].slice(0, 100);
    if (!ids.length) return { students: [] };
    const { data: students } = await db.from("students").select("id,name").in("id", ids).is("deleted_at", null);
    const byId = new Map((students || []).map((s: any) => [s.id, s]));
    return { students: ids.map(id => { const s: any = byId.get(id); const ps = (payments || []).filter((p: any) => p.student_id === id); return { id, registration_no: id, name: s?.name ?? "غير معروف", unpaid_count: ps.length, unpaid_amount: ps.reduce((n: number, p: any) => n + (Number(p.amount) || 0), 0), nearest_due_date: ps.map((p: any) => p.due_date).filter(Boolean).sort()[0] ?? null }; }).slice(0, 50) };
  }

  throw new Error("أداة غير معروفة.");
}

async function callOpenAI(input: unknown, previousResponseId?: string) {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("مفتاح OpenAI غير مضبوط على الخادم.");
  const payload: Record<string, unknown> = {
    model: MODEL,
    input,
    tools,
    tool_choice: "auto",
    instructions: `أنت Andalus AI، المساعد الإداري الذكي لمركز الأندلس للتدريب.\n- أجب بالعربية المصرية الواضحة والمباشرة.\n- بيانات المركز لا تُخمن: استخدم الأدوات عندما يكون السؤال عن النظام أو الطلاب أو المدفوعات أو الحضور أو الدرجات.\n- لا تخترع أرقامًا أو أسماء. إذا لم تتوفر البيانات قل ذلك بوضوح.\n- لا تعرض أسرارًا أو مفاتيح أو بيانات لا علاقة لها بالسؤال.\n- عند عرض بيانات طالب، اعرض الحد الأدنى اللازم فقط.\n- لا تنفذ أي تعديل أو حذف؛ هذه النسخة للقراءة والتحليل فقط.`,
    max_output_tokens: 1200,
  };
  if (previousResponseId) payload.previous_response_id = previousResponseId;

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "تعذر الاتصال بخدمة الذكاء الاصطناعي.");
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { db, profile } = await requireAdmin(req);
    const body = await req.json();
    const message = cleanText(body?.message, 6000);
    if (!message) return json({ error: "اكتب سؤالك أولًا." }, 400);

    let response = await callOpenAI([{ role: "user", content: message }]);
    for (let round = 0; round < 4; round++) {
      const calls = (response.output || []).filter((item: any) => item.type === "function_call");
      if (!calls.length) break;
      const outputs = [];
      for (const call of calls) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(call.arguments || "{}"); } catch { args = {}; }
        const result = await runTool(call.name, args, db);
        outputs.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) });
      }
      response = await callOpenAI(outputs, response.id);
    }

    const answer = response.output_text || "لم أتمكن من تكوين إجابة الآن.";
    try {
      await db.from("activity_log").insert({
        action: "andalus_ai_query",
        details: { user_id: profile?.id, question: message.slice(0, 500), model: MODEL },
      });
    } catch (_) { /* logging must not block the answer */ }

    return json({ answer, model: MODEL });
  } catch (error) {
    console.error("andalus-ai:", error);
    return json({ error: error instanceof Error ? error.message : "حدث خطأ غير متوقع." }, 500);
  }
});