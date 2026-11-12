import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

async function listAllFiles(admin: ReturnType<typeof createClient>, path = ""): Promise<string[]> {
  const { data, error } = await admin.storage.from("study-summary-pdfs").list(path, {
    limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" },
  });
  if (error) throw error;
  const files: string[] = [];
  for (const item of data || []) {
    const full = path ? path + "/" + item.name : item.name;
    if (item.id == null && item.metadata == null) {
      files.push(...await listAllFiles(admin, full));
    } else {
      files.push(full);
    }
  }
  return files;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ ok: false, reason: "unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return json({ ok: false, reason: "server_not_configured" }, 500);
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ ok: false, reason: "unauthorized" }, 401);
    const { data: adminFlag, error: adminError } = await userClient.rpc("is_admin");
    if (adminError || adminFlag !== true) return json({ ok: false, reason: "admin_required" }, 403);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: state, error: stateError } = await admin.from("study_summary_store_state")
      .select("storage_purge_pending").eq("id", true).single();
    if (stateError) throw stateError;
    if (!state.storage_purge_pending) {
      return json({ ok: true, already_completed: true, object_count: 0 });
    }

    const paths = await listAllFiles(admin);
    for (let i = 0; i < paths.length; i += 1000) {
      const { error } = await admin.storage.from("study-summary-pdfs").remove(paths.slice(i, i + 1000));
      if (error) throw error;
    }
    const { error: updateError } = await admin.from("study_summary_store_state").update({
      storage_purge_pending: false,
      storage_purge_completed_at: new Date().toISOString(),
      storage_purge_object_count: paths.length,
      updated_at: new Date().toISOString(),
    }).eq("id", true);
    if (updateError) throw updateError;
    return json({ ok: true, deleted_objects: paths.length });
  } catch (error) {
    return json({ ok: false, reason: "purge_failed", message: String(error?.message || error) }, 500);
  }
});
