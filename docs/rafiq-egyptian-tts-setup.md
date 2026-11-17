# رفيق الأندلس — خدمة الصوت المصري

هذا Worker مستقل عن بوابة الفيديو ولا يغيّر مسارات الفيديو أو أسراره.

## إعداد Cloudflare
1. أنشئ Worker جديدًا باسم مثل andalus-rafiq-tts والصق محتوى cloudflare/andalus-rafiq-tts-worker.js.
2. في Settings > Variables and Secrets أضف Secret باسم SPEECH_KEY لمفتاح Azure Speech، وVariable باسم SPEECH_REGION لمنطقة مورد Speech كما تظهر في Azure.
3. انشر Worker واختبر GET /health. يجب أن يرجع ok: true و ar-EG-ShakirNeural.
4. عنوان النشر يكون عادةً https://<worker-name>.<account-subdomain>.workers.dev. لا تضع مفتاح Azure في ملفات الموقع أو ترسله في المحادثة.

## واجهة الخدمة
أرسل POST /speak مع Content-Type: application/json وبيانات {"text":"إزيك يا بطل؟"}. الاستجابة الناجحة ملف MP3.

الصوت المثبت هو Azure Neural المصري الرجالي ar-EG-ShakirNeural. الخدمة تقبل طلبات من نطاق الأكاديمية فقط. قد يحتاج المتصفح على الهاتف إلى لمسة أولى للسماح بتشغيل الصوت.

## ملاحظة الدمج
بعد نشر Worker، يجب ضبط عنوانه في كود رفيق الأندلس وربط تشغيل MP3 به. لم يتم تعديل بوابة الفيديو أو بيانات الطلاب أو جداول Supabase.