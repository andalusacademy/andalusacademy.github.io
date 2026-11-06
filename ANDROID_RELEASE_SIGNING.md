# إعداد توقيع إصدار أكاديمية الأندلس

هذه الخطوات مطلوبة مرة واحدة قبل إنشاء AAB موقّع للرفع إلى Google Play.

## 1) إنشاء مفتاح الرفع على جهاز موثوق

نفّذ الأمر التالي محليًا على جهازك، وليس داخل GitHub Actions أو داخل المستودع:

```bash
keytool -genkeypair -v -keystore andalus-upload-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias andalus-upload
```

احتفظ بملف `andalus-upload-key.jks` وكلمات المرور واسم alias في مكان آمن، مع نسخة احتياطية مشفرة. فقدان المفتاح قد يعطل تحديث التطبيق إذا لم تكن خدمة Play App Signing وإجراءات استعادة مفتاح الرفع متاحة لحسابك.

## 2) تحويل الملف إلى Base64

Linux:
```bash
base64 -w 0 andalus-upload-key.jks
```

macOS:
```bash
base64 < andalus-upload-key.jks | tr -d '\\n'
```

انسخ الناتج مباشرة إلى GitHub Secret ولا تضعه في ملف داخل المستودع أو في محادثة عامة.

## 3) إضافة GitHub Actions Secrets

من المستودع افتح Settings → Secrets and variables → Actions → New repository secret، وأضف:

- `ANDROID_KEYSTORE_BASE64`: محتوى Base64 لملف JKS.
- `ANDROID_KEYSTORE_PASSWORD`: كلمة مرور ملف JKS.
- `ANDROID_KEY_ALIAS`: في المثال أعلاه `andalus-upload`.
- `ANDROID_KEY_PASSWORD`: كلمة مرور المفتاح.

لا ترسل كلمات المرور أو ملف JKS في المحادثة، ولا ترفع ملف المفتاح إلى GitHub.

## 4) تشغيل البناء

من Actions شغّل workflow باسم **Build Andalus Academy Android** على الفرع `play-store-production`.

- سيُنتج البناء دائمًا Debug APK/AAB للاختبار.
- عند توافر الأسرار الأربعة، سيُنتج أيضًا Release APK وAAB موقّعين.
- إذا لم تكن الأسرار موجودة، سيكتمل بناء Debug فقط، ولن يكون هناك AAB صالح للنشر.

## تنبيه

هذا الإعداد لا يعني أن التطبيق أصبح جاهزًا للنشر. يجب اختبار النسخة الموقعة على أجهزة فعلية، والتحقق من البوابات الثلاث والامتحانات والكاميرا والملفات وسياسة الخصوصية وبيانات Google Play قبل الإطلاق. لا ترفع نسخة Release إلى Production قبل مراجعة الأكاديمية.
