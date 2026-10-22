# eFootball Coin TopUp Website

React + Vite + Tailwind CSS।

## চালানো
```bash
npm install
npm run dev      # লোকালে দেখুন
npm run build    # production build (dist ফোল্ডার)
```

## কাস্টমাইজ
`src/config.js` ফাইলে বদলান:
- ব্র্যান্ড নাম, WhatsApp নম্বর, Facebook লিংক
- bKash / Nagad / Rocket নম্বর
- কয়েন প্যাকেজ ও দাম
- `SHEET_WEBHOOK_URL` (ঐচ্ছিক): Google Apps Script দিয়ে অর্ডার Google Sheet-এ সেভ

## Vercel-এ ডিপ্লয়
1. প্রজেক্ট GitHub-এ পুশ করুন
2. Vercel → Add New Project → রিপো ইমপোর্ট (Framework: Vite, স্বয়ংক্রিয় ডিটেক্ট হবে)
3. Deploy → Settings → Domains → আপনার ডোমেইন যোগ করে Vercel-এর দেখানো DNS রেকর্ড সেট করুন

## Google Sheet-এ অর্ডার সেভ (ঐচ্ছিক)
Google Sheet → Extensions → Apps Script-এ:
```js
function doPost(e) {
  const o = JSON.parse(e.postData.contents);
  SpreadsheetApp.getActiveSheet().appendRow([
    o.orderNo, o.time, o.name, o.phone, o.gameId, o.platform,
    o.coins, o.price, o.paymentMethod, o.senderNumber, o.trxId
  ]);
  return ContentService.createTextOutput("ok");
}
```
Deploy → Web app → Who has access: Anyone → URL কপি করে `SHEET_WEBHOOK_URL`-এ বসান।
