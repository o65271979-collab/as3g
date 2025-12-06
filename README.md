# نظام التفعيل بـ Firebase - موقع الإدارة

## 🌐 الوصول للموقع

افتح الملف التالي في المتصفح:
```
activation-admin-panel/index.html
```

---

## 🔐 بيانات الدخول الأولية

### إنشاء حساب مسؤول


1. **افتح Firebase Console**: https://console.firebase.google.com
2. **اختر المشروع**: `code-d2d3c`
3. **انتقل إلى**: Authentication > Users
4. **أضف مستخدم جديد**:
   - البريد: `admin@system.as3g`
   - كلمة المرور: اختر كلمة مرور قوية

---

## إعداد Firebase Security Rules

في Firebase Console:

1. **Firestore Database** > Rules
2. **الصق هذه القواعد**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /activationCodes/{code} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    match /activatedDevices/{device} {
      allow read, write: if true;
    }
  }
}
```

3. **Publish** - احفظ التغييرات

---

## 📚 المجموعات المطلوبة

سيتم إنشاء المجموعات تلقائياً عند أول استخدام:
- `activationCodes`
- `activatedDevices`

---

## 🎯 الاستخدام

### 1. تسجيل الدخول
- افتح `index.html`
- أدخل البريد وكلمة المرور
- ستنتقل تلقائياً للوحة التحكم

### 2. إنشاء أكواد تفعيل
- اضغط "➕ إنشاء كود جديد"
- حدد مدة الاشتراك (بالأيام)
- حدد عدد الأكواد
- اضغط "إنشاء"

### 3. إدارة الأجهزة
- انتقل لتبويب "الأجهزة المفعلة"
- شاهد جميع الأجهزة
- يمكنك إيقاف أي جهاز عن بُعد
- يمكنك حذف أي جهاز

---

## ⚠️ ملاحظات مهمة

1. **الأمان**: لا تشارك بيانات الدخول
2. **النسخ الاحتياطي**: احتفظ بنسخة من أكواد التفعيل
3. **المراقبة**: راجع الأجهزة المفعلة دورياً
4. **التحديث التلقائي**: البيانات تتحدث كل 30 ثانية

---

## 🔗 التالي

بعد إعداد موقع الإدارة، سنقوم بـ:
1. تحديث التطبيق ليستخدم Firebase
2. إزالة الأكواد المحلية
3. إضافة التحقق عبر الإنترنت
