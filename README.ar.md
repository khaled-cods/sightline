<div dir="rtl">

# Sightline

**الذكاء الاصطناعي بيكتب واجهات، و Sightline بيخليه يشوفها فعلاً.**

الـ agents بتبني الواجهة وهي مش شايفاها: مش عارفة إن الكلام مش مقروء، أو الصورة متمطوطة، أو الزرار صغير جداً على الموبايل، أو الصفحة العربي اتعكست غلط. Sightline بيفتح صفحتك في متصفح حقيقي (موبايل + ديسكتوب)، ويطلّع العيوب، ويديّ الـ agent **صور عليها علامات + قايمة إصلاحات مرتبة**.

## تشغيل سريع

```bash
npx playwright install chromium   # مرة واحدة
npx sightline ./index.html        # أو http://localhost:3000
```

## مع Claude Code

```text
/plugin marketplace add khaled-cods/sightline
/plugin install sightline@sightline
```

## بيفحص إيه

- التخطيط: تمرير أفقي، نص مقصوص، صور متمطوطة أو مقصوصة أوي
- اللمس: أزرار أصغر من 44px
- الوصول: تباين الألوان WCAG، alt، labels، ترتيب العناوين، lang
- **العربي / RTL**: غياب `dir="rtl"`، letter-spacing على العربي (بيكسر وصل الحروف)، خطوط لاتينية للنص العربي، CSS بـ left/right بدل logical، أسهم في الاتجاه الغلط

## الرخصة

MIT

</div>
