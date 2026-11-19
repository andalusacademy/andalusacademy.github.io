// رفيق الأندلس — Worker للصوت (ElevenLabs) مع تخزين مؤقت وحد أقصى شهري.
// Secrets/Variables المطلوبة في Cloudflare:
//   ELEVEN_API_KEY  (Secret)   مفتاح ElevenLabs
//   ELEVEN_VOICE_ID (Variable) اختياري، الافتراضي صوت Mahmoud Elzaafrany
//   MONTHLY_CAP     (Variable) اختياري، الحد الأقصى للحروف شهريًا (الافتراضي 9000)
// KV Binding اختياري لكنه مهم جدًا: RAFIQ_CACHE (لتخزين الصوت وعدّاد الحروف)
const ALLOWED_ORIGIN = "https://andalusacademy.github.io";
const DEFAULT_VOICE = "XLs9B3i7c03AkJV2f5tY";
const MODEL = "eleven_multilingual_v2";
const MAX_TEXT = 140;

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}
function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });
}
function audio(body, headers, cacheStatus) {
  const out = new Headers(headers);
  out.set("Content-Type", "audio/mpeg");
  out.set("Cache-Control", "no-store");
  out.set("X-Content-Type-Options", "nosniff");
  out.set("X-Rafiq-Cache", cacheStatus);
  return new Response(body, { status: 200, headers: out });
}
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function monthKey() {
  return "usage:" + new Date().toISOString().slice(0, 7);
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = cors(origin);
    if (request.method === "OPTIONS") return new Response(null, { headers });
    const url = new URL(request.url);
    const voice = env.ELEVEN_VOICE_ID || DEFAULT_VOICE;
    const cap = Number(env.MONTHLY_CAP) > 0 ? Number(env.MONTHLY_CAP) : 9000;

    if (url.pathname === "/health" && request.method === "GET") {
      let used = null;
      if (env.RAFIQ_CACHE) { try { used = Number(await env.RAFIQ_CACHE.get(monthKey())) || 0; } catch (_) {} }
      return json({ ok: true, provider: "elevenlabs", voice, configured: !!env.ELEVEN_API_KEY, cache: !!env.RAFIQ_CACHE, used_chars_this_month: used, monthly_cap: cap }, 200, headers);
    }
    if (url.pathname !== "/speak" || request.method !== "POST") {
      return json({ ok: false, error: "not_found" }, 404, headers);
    }
    if (origin && origin !== ALLOWED_ORIGIN) {
      return json({ ok: false, error: "origin_not_allowed" }, 403, headers);
    }
    if (!env.ELEVEN_API_KEY) return json({ ok: false, error: "speech_service_not_configured" }, 503, headers);

    try {
      const body = await request.json();
      const text = String(body.text || "").trim();
      if (!text || text.length > MAX_TEXT) return json({ ok: false, error: "invalid_text" }, 400, headers);

      const cacheKey = "clip:" + voice + ":" + (await sha256Hex(text));
      if (env.RAFIQ_CACHE) {
        const hit = await env.RAFIQ_CACHE.get(cacheKey, "arrayBuffer");
        if (hit) return audio(hit, headers, "hit");
      }
      // Quota guard: only uncached requests count against the monthly cap.
      let used = 0;
      if (env.RAFIQ_CACHE) {
        used = Number(await env.RAFIQ_CACHE.get(monthKey())) || 0;
        if (used + text.length > cap) return json({ ok: false, error: "monthly_cap_reached" }, 429, headers);
      }
      const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(voice) + "?output_format=mp3_44100_64", {
        method: "POST",
        headers: { "xi-api-key": env.ELEVEN_API_KEY, "Content-Type": "application/json", "Accept": "audio/mpeg" },
        body: JSON.stringify({
          text,
          model_id: MODEL,
          voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true }
        })
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 200);
        return json({ ok: false, error: "speech_provider_error", status: response.status, detail }, 502, headers);
      }
      const buf = await response.arrayBuffer();
      if (env.RAFIQ_CACHE) {
        await env.RAFIQ_CACHE.put(cacheKey, buf);
        await env.RAFIQ_CACHE.put(monthKey(), String(used + text.length), { expirationTtl: 60 * 60 * 24 * 45 });
      }
      return audio(buf, headers, "miss");
    } catch (error) {
      return json({ ok: false, error: "request_failed", detail: String(error?.message || error).slice(0, 160) }, 400, headers);
    }
  }
};
