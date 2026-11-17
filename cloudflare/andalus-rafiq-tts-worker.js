const ALLOWED_ORIGIN = "https://andalusacademy.github.io";
const VOICE = "ar-EG-ShakirNeural";

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
function escapeXml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = cors(origin);
    if (request.method === "OPTIONS") return new Response(null, { headers });
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, voice: VOICE }, 200, headers);
    }
    if (url.pathname !== "/speak" || request.method !== "POST") {
      return json({ ok: false, error: "not_found" }, 404, headers);
    }
    if (origin && origin !== ALLOWED_ORIGIN) {
      return json({ ok: false, error: "origin_not_allowed" }, 403, headers);
    }
    if (!env.SPEECH_KEY || !env.SPEECH_REGION) {
      return json({ ok: false, error: "speech_service_not_configured" }, 503, headers);
    }
    try {
      const body = await request.json();
      const text = String(body.text || "").trim();
      if (!text || text.length > 1800) return json({ ok: false, error: "invalid_text" }, 400, headers);
      const ssml = '<speak version="1.0" xml:lang="ar-EG"><voice name="' + VOICE + '"><prosody rate="0%" pitch="0%">' + escapeXml(text) + '</prosody></voice></speak>';
      const response = await fetch("https://" + env.SPEECH_REGION + ".tts.speech.microsoft.com/cognitiveservices/v1", {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": env.SPEECH_KEY,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
          "User-Agent": "Andalus-Rafiq-TTS"
        },
        body: ssml
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 300);
        return json({ ok: false, error: "speech_provider_error", status: response.status, detail }, 502, headers);
      }
      const out = new Headers(headers);
      out.set("Content-Type", "audio/mpeg");
      out.set("Cache-Control", "no-store");
      out.set("X-Content-Type-Options", "nosniff");
      return new Response(response.body, { status: 200, headers: out });
    } catch (error) {
      return json({ ok: false, error: "request_failed", detail: String(error?.message || error).slice(0, 160) }, 400, headers);
    }
  }
};