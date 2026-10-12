# התזונה שלי

מעקב קלוריות וחלבון לאייפון: היום מוכן מראש לפי מה שאוכלים בדרך כלל, ומאשרים בלחיצה.
אפליקציית ווב (Next.js) שמוסיפים למסך הבית, עם Supabase לנתונים ולכניסה.

## מה יש בגרסה הזו (אבן דרך 1)

- כניסה עם מייל וסיסמה; לכל משתמש נתונים נפרדים (Row Level Security).
- משתמש חדש מקבל אוטומטית יעד שמירה (2,350 קק״ל, 125 ג׳ חלבון) ו-10 הארוחות מהסיכום של ג׳מיני.
- מסך **היום**: ציר משבצות (בוקר, ביניים, צהריים, אחה״צ, ערב, לילה) עם ניבוי לפי 28 הימים האחרונים,
  אישור בלחיצה, חצי מנה, וריאציות, החלפה, דילוג, הזנה ידנית, ותחזית לסוף היום.
- הצעה לסגירת הפער בערב מתוך המאגר.
- מסך **המאגר**: הוספה ועריכה של ארוחות.
- מסך **יעדים**: שינוי שלב ויעדים (נשמר כשלב חדש, ההיסטוריה נשמרת).
- **צילום ארוחה** (אבן דרך 2): צילום או בחירה מהגלריה, זיהוי עם Claude, התאמה לארוחה מהמאגר,
  עריכת המספרים, בחירת משבצת לפי השעה, ושמירה למאגר.
- **העלאה מהגלריה**: כמה תמונות בבת אחת; היום והארוחה נקבעים לפי שעת הצילום (עד שבוע אחורה).
- מסך **היסטוריה**: 7/14/30 ימים — ממוצעים, ימים ביעד, גרף קלוריות וגרף חלבון מול היעד, פירוט לכל יום וטבלה.

## הקמה

### 1. Supabase
1. פרויקט חדש ב-supabase.com.
2. SQL Editor ← להדביק ולהריץ את `supabase/migrations/0001_init.sql`.
3. כניסה עם מייל וסיסמה: Authentication ← Sign In / Providers ← Email — לכבות **Confirm email**.
   אחרי ששני המשתמשים נרשמו, לכבות **Allow new users to sign up** כדי שאף אחד אחר לא יוכל להירשם.
4. Authentication ← URL Configuration: Site URL = כתובת האפליקציה ב-Vercel,
   ולהוסיף ל-Redirect URLs את `https://<הכתובת>/auth/callback`.
5. (בהמשך) כניסה עם Google: Authentication ← Providers ← Google, עם Client ID ו-Secret מ-Google Cloud.

### 2. Vercel
1. Add New ← Project ← לייבא את המאגר `nutrition-tracker`.
2. Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (או `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   (שניהם מ-Supabase ← Project Settings ← API)
3. לזיהוי תמונות: `ANTHROPIC_API_KEY` (מ-platform.claude.com ← API Keys).
   אופציונלי: `ANTHROPIC_MODEL` (ברירת מחדל `claude-sonnet-5-5`).
4. Deploy.

### 3. אייפון
לפתוח את הכתובת ב-Safari ← שיתוף ← "הוסף למסך הבית".

## פיתוח

```bash
cp .env.example .env.local   # למלא את הערכים
npm install
npm run dev
npm test                     # בדיקות לוגיקת הניבוי
```

## מבנה

- `lib/predict.ts` — ניבוי היום והצעות לסגירת פער (עם בדיקות ב-`lib/predict.test.ts`).
- `app/page.tsx` + `app/timeline.tsx` — מסך היום.
- `app/actions.ts` — כל הפעולות שכותבות לנתונים.
- `supabase/migrations/` — מבנה הנתונים, הרשאות, ומאגר ההתחלה.

## הבא בתור

2. ~~צילום וזיהוי באפליקציה~~ ✓ · קיצור דרך לסנכרון אלבום "אוכל".
3. התראות (Web Push) ושאלות יזומות.
4. משקל ואימונים מ-Apple Health, גרף מגמה וכיול יעד.
5. פרופיל נוסף ושיתוף ארוחות משפחתיות.
