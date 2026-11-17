const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin || "https://andalusacademy.github.io",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type,Range,If-Range",
  "Access-Control-Expose-Headers": "Content-Length,Content-Range,Accept-Ranges,ETag",
  "Vary": "Origin"
});

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });
}

function safeOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "https://andalusacademy.github.io").split(",").map(x => x.trim());
  return allowed.includes(origin) ? origin : (allowed[0] || "https://andalusacademy.github.io");
}

function supabaseHeaders(env, bearer) {
  return {
    apikey: env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${bearer || env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json"
  };
}

async function sbRows(env, table, query) {
  const url = new URL(`/rest/v1/${table}`, env.SUPABASE_URL);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const response = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  if (!response.ok) throw new Error(`database_${response.status}`);
  return await response.json();
}

async function requireAdmin(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;

  const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
  });
  if (!userResponse.ok) return false;

  const adminResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers: supabaseHeaders(env, token),
    body: "{}"
  });
  if (!adminResponse.ok) return false;
  return (await adminResponse.json()) === true;
}

async function authorizeStudent(env, videoId, sessionToken) {
  if (!/^[0-9a-f-]{36}$/i.test(sessionToken || "") || !/^[0-9a-f-]{36}$/i.test(videoId || "")) return null;
  const now = new Date().toISOString();

  const sessions = await sbRows(env, "competition_face_verified_sessions", {
    select: "student_id",
    token: `eq.${sessionToken}`,
    competition_type: "eq.student_portal",
    expires_at: `gt.${now}`,
    limit: "1"
  });
  if (!sessions[0]?.student_id) return null;
  const studentId = sessions[0].student_id;

  const students = await sbRows(env, "students", {
    select: "id",
    id: `eq.${studentId}`,
    deleted_at: "is.null",
    student_status: "eq.active",
    limit: "1"
  });
  if (!students.length) return null;

  const videos = await sbRows(env, "academy_videos", {
    select: "id,r2_object_key,content_type,size_bytes,title",
    id: `eq.${videoId}`,
    is_published: "eq.true",
    deleted_at: "is.null",
    limit: "1"
  });
  if (!videos[0]?.r2_object_key) return null;

  const entitlements = await sbRows(env, "academy_video_entitlements", {
    select: "id",
    student_id: `eq.${studentId}`,
    video_id: `eq.${videoId}`,
    revoked_at: "is.null",
    starts_at: `lte.${now}`,
    or: `(expires_at.is.null,expires_at.gt.${now})`,
    limit: "1"
  });
  if (!entitlements.length) return null;
  return { studentId, video: videos[0] };
}

function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return { invalid: true };
  let start, end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return { invalid: true };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return { invalid: true };
  end = Math.min(end, size - 1);
  return { start, end, length: end - start + 1 };
}

async function handleWatch(request, env, videoId) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method Not Allowed", { status: 405 });
  const url = new URL(request.url);
  const sessionToken = url.searchParams.get("session_token") || "";
  const authorized = await authorizeStudent(env, videoId, sessionToken);
  if (!authorized) return new Response("Access denied", { status: 403, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });

  const key = authorized.video.r2_object_key;
  const range = parseRange(request.headers.get("Range"), Number(authorized.video.size_bytes || 0));
  if (range?.invalid) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${authorized.video.size_bytes || 0}`, "Cache-Control": "no-store" } });

  const object = await env.VIDEOS_BUCKET.get(key, range ? { range: { offset: range.start, length: range.length } } : {});
  if (!object) return new Response("Video not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", authorized.video.content_type || object.httpMetadata?.contentType || "video/mp4");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Disposition", "inline");
  headers.set("ETag", object.httpEtag);
  if (range) {
    headers.set("Content-Length", String(range.length));
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${authorized.video.size_bytes || object.size}`);
  } else {
    headers.set("Content-Length", String(object.size));
  }
  return new Response(request.method === "HEAD" ? null : object.body, { status: range ? 206 : 200, headers });
}

async function handleAdminUpload(request, env, path) {
  if (!await requireAdmin(request, env)) return json({ ok: false, reason: "not_authorized" }, 401);

  if (path === "/admin/upload/init" && request.method === "POST") {
    const body = await request.json();
    const fileName = String(body.file_name || "video.mp4").slice(0, 180);
    const contentType = String(body.content_type || "video/mp4").slice(0, 120);
    const ext = (fileName.match(/\.([a-z0-9]{2,5})$/i)?.[1] || "mp4").toLowerCase();
    const key = `academy-videos/${crypto.randomUUID()}.${ext}`;
    const upload = await env.VIDEOS_BUCKET.createMultipartUpload(key, { httpMetadata: { contentType } });
    return json({ ok: true, object_key: key, upload_id: upload.uploadId, chunk_size: 8 * 1024 * 1024 });
  }

  if (path === "/admin/upload/part" && request.method === "POST") {
    const url = new URL(request.url);
    const key = url.searchParams.get("object_key") || "";
    const uploadId = url.searchParams.get("upload_id") || "";
    const partNumber = Number(url.searchParams.get("part_number"));
    if (!key.startsWith("academy-videos/") || !uploadId || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
      return json({ ok: false, reason: "invalid_upload_part" }, 400);
    }
    const upload = env.VIDEOS_BUCKET.resumeMultipartUpload(key, uploadId);
    const part = await upload.uploadPart(partNumber, request.body);
    return json({ ok: true, part_number: partNumber, etag: part.etag });
  }

  if (path === "/admin/upload/complete" && request.method === "POST") {
    const body = await request.json();
    const key = String(body.object_key || "");
    const uploadId = String(body.upload_id || "");
    const parts = Array.isArray(body.parts) ? body.parts.map(p => ({ partNumber: Number(p.part_number), etag: String(p.etag) })) : [];
    if (!key.startsWith("academy-videos/") || !uploadId || !parts.length) return json({ ok: false, reason: "invalid_upload" }, 400);
    const upload = env.VIDEOS_BUCKET.resumeMultipartUpload(key, uploadId);
    const object = await upload.complete(parts);
    return json({ ok: true, object_key: key, size_bytes: object.size, etag: object.httpEtag });
  }

  if (path === "/admin/upload/abort" && request.method === "POST") {
    const body = await request.json();
    const key = String(body.object_key || "");
    const uploadId = String(body.upload_id || "");
    if (key.startsWith("academy-videos/") && uploadId) {
      await env.VIDEOS_BUCKET.resumeMultipartUpload(key, uploadId).abort();
    }
    return json({ ok: true });
  }

  return json({ ok: false, reason: "not_found" }, 404);
}

export default {
  async fetch(request, env) {
    const origin = safeOrigin(request, env);
    const cors = corsHeaders(origin);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(request.url);

    try {
      if (url.pathname === "/health") {
        return json({ ok: true, message: "Andalus private video gateway ready" }, 200, cors);
      }
      if (url.pathname.startsWith("/admin/upload/")) {
        const response = await handleAdminUpload(request, env, url.pathname);
        const headers = new Headers(response.headers);
        for (const [k, v] of Object.entries(cors)) headers.set(k, v);
        return new Response(response.body, { status: response.status, headers });
      }
      const match = /^\/watch\/([0-9a-f-]{36})$/i.exec(url.pathname);
      if (match) {
        const response = await handleWatch(request, env, match[1]);
        const headers = new Headers(response.headers);
        for (const [k, v] of Object.entries(cors)) headers.set(k, v);
        return new Response(response.body, { status: response.status, headers });
      }
      return json({ ok: false, reason: "not_found" }, 404, cors);
    } catch (error) {
      return json({ ok: false, reason: "gateway_error", message: String(error?.message || "unknown").slice(0, 160) }, 500, cors);
    }
  }
};
