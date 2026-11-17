# مكتبة الفيديوهات المدفوعة — مركز الأندلس

## التصميم
- ملفات الفيديو نفسها محفوظة في Cloudflare R2 داخل bucket خاص اسمه `andalus-private-videos`.
- قاعدة Supabase تحتفظ بالبيانات الوصفية والطلبات وصلاحيات المشاهدة فقط.
- الطالب يُعرّف بجلسة `competition_face_verified_sessions` من نوع `student_portal`، ولا نعتمد على رقم القيد الذي يرسله المتصفح.
- بوابة Worker تعيد التحقق من الجلسة والطالب والصلاحية عند كل طلب فيديو، بما في ذلك طلبات HTTP Range.
- اعتماد الدفع اليدوي يتم من صفحة الإدارة، وبعده تنشأ صلاحية مشاهدة بتاريخ بداية ونهاية.

## ما تم إضافته في قاعدة البيانات
- `academy_videos`
- `academy_video_orders`
- `academy_video_entitlements`
- `academy_video_settings`
- RPCs: `student_list_academy_videos`, `student_create_academy_video_order`, `student_submit_academy_video_payment_reference`, `admin_review_academy_video_order`

الجداول الجديدة مفعّل عليها RLS. لا توجد صلاحية مباشرة للطالب لقراءة جداول الطلبات أو الصلاحيات؛ الوصول للطالب يتم عبر RPC يتحقق من جلسة البوابة.

## إعداد Worker الحالي
استخدم ملف `cloudflare/andalus-video-gateway.js` في Worker الموجود باسم `andalus-video-gateway`.

1. اترك R2 bucket خاصًا. لا تفعّل Public Access ولا رابط `r2.dev`.
2. اربط R2 bucket `andalus-private-videos` بالـ Worker باسم binding: `VIDEOS_BUCKET`.
3. أضف متغيرات/Secrets في إعدادات Worker:
   - `SUPABASE_URL` — رابط مشروع Supabase.
   - `SUPABASE_ANON_KEY` — مفتاح anon/publishable الخاص بالمشروع.
   - `SUPABASE_SERVICE_ROLE_KEY` — يوضع كـ Secret داخل Worker فقط، ولا يوضع مطلقًا في GitHub أو كود المتصفح.
   - `ALLOWED_ORIGINS` — القيمة `https://andalusacademy.github.io`.
4. استبدل كود Worker بكود الملف أعلاه ثم Deploy.
5. اختبر `/health` ويجب أن يعيد `ok: true`.
6. انسخ رابط Worker (workers.dev) وضعه في خانة «إعداد بوابة R2» داخل صفحة مكتبة الفيديوهات في لوحة الإدارة.

## الرفع والتشغيل
- الرفع يستخدم Multipart على أجزاء 8MB، حتى لا يُرسل ملف الفيديو كاملًا في طلب واحد.
- Worker يقبل الرفع فقط مع JWT صالح لمستخدم إداري تتحقق منه دالة `is_admin()`.
- المشاهدة تمر عبر `/watch/{video_id}?session_token=...` وتعيد التحقق من جلسة الطالب وصلاحية الفيديو قبل كل طلب/جزء.
- لا يتم إظهار مفتاح R2 أو Supabase service-role للمتصفح.

## تنبيهات
- هذا يمنع الوصول المباشر إلى ملفات R2 ويصعّب مشاركة رابط التشغيل، لكنه لا يمنع تصوير الشاشة بكاميرا خارجية أو تسجيل الشاشة على جهاز مخترق.
- لا تنشر فرع التطوير على الموقع قبل اكتمال إعداد Worker واختبار الرفع والشراء والاعتماد والمشاهدة على حساب طالب تجريبي.
- لا تحذف أي بيانات من الملخصات أو الامتحانات أو الطلاب أثناء تفعيل المكتبة.
