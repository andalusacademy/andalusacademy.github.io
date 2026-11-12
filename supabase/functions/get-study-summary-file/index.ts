import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);
  try {
    const { session_token, summary_id } = await req.json();
    if (typeof session_token !== "string" || session_token.length < 20 ||
        typeof summary_id !== "string" || summary_id.length < 30) {
      return json({ ok: false, reason: "invalid_request" }, 400);
    }
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ ok: false, reason: "server_not_configured" }, 500);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: session, error: sessionError } = await admin.from("competition_face_verified_sessions")
      .select("student_id").eq("token", session_token).eq("competition_type", "student_portal")
      .gt("expires_at", new Date().toISOString()).maybeSingle();
    if (sessionError || !session?.student_id) return json({ ok: false, reason: "session_expired" }, 401);
    const { data: student, error: studentError } = await admin.from("students")
      .select("id, deleted_at, student_status").eq("id", session.student_id).maybeSingle();
    if (studentError || !student || student.deleted_at ||
        (student.student_status && student.student_status !== "active")) {
      return json({ ok: false, reason: "student_unavailable" }, 403);
    }
    const now = new Date().toISOString();
    const { data: entitlement, error: entitlementError } = await admin.from("study_summary_entitlements")
      .select("id").eq("student_id", session.student_id).eq("summary_id", summary_id)
      .is("revoked_at", null).lte("starts_at", now)
      .or(`expires_at.is.null,expires_at.gt.${now}`).limit(1).maybeSingle();
    if (entitlementError || !entitlement) return json({ ok: false, reason: "access_denied" }, 403);
    const { data: summary, error: summaryError } = await admin.from("study_summaries")
      .select("delivery_pdf_path,is_published,is_approved").eq("id", summary_id).maybeSingle();
    if (summaryError || !summary || !summary.is_published || !summary.is_approved || !summary.delivery_pdf_path) {
      return json({ ok: false, reason: "file_unavailable" }, 404);
    }
    const { data: signed, error: signError } = await admin.storage.from("study-summary-pdfs")
      .createSignedUrl(summary.delivery_pdf_path, 900, { download: false });
    if (signError || !signed?.signedUrl) return json({ ok: false, reason: "sign_failed" }, 500);
    return json({ ok: true, signed_url: signed.signedUrl, expires_in: 900 });
  } catch (_error) {
    return json({ ok: false, reason: "invalid_request" }, 400);
  }
});
