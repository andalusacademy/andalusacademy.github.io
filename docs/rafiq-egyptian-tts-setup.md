# رفيق الأندلس — صوت التحية المصري (ElevenLabs)

الصوت مخصص للتحية فقط، وباقي كلام رفيق (المصروفات والدرجات والإشعارات) بصوت الجهاز.
التحية تتقسم 3 أجزاء (مقدمة ثابتة + اسم الطالب + خاتمة ثابتة) وكل جزء بيتخزّن، فالرصيد بيستهلك حروف الاسم بس عند أول مرة.

## إعداد Cloudflare
1. أنشئ Worker باسم andalus-rafiq-tts والصق محتوى cloudflare/andalus-rafiq-tts-worker.js ثم Deploy.
2. Storage & Databases > KV > Create namespace باسم RAFIQ_CACHE. من Worker > Settings > Bindings > Add > KV namespace: الاسم RAFIQ_CACHE واختر الـ namespace.
3. Settings > Variables and Secrets: Secret باسم ELEVEN_API_KEY (مفتاح ElevenLabs). اختياري: ELEVEN_VOICE_ID و MONTHLY_CAP (الافتراضي 9000 حرف).
4. اختبر GET /health: لازم configured:true و cache:true.
5. أضف في index.html قبل سكربت رفيق: window.ANDALUS_RAFIQ_TTS_URL = "https://<worker>.<subdomain>.workers.dev";

لا تضع مفتاح ElevenLabs في الموقع أو المحادثة. لو الخدمة وقفت أو وصلت للحد الشهري، رفيق يرجع تلقائيًا لصوت الجهاز.
