// ===== এই ফাইলটি এডিট করে আপনার তথ্য বসান =====

export const SITE = {
  name: "NextGen TopUp", // আপনার ব্র্যান্ড নাম
  whatsapp: "8801575887881", // দেশের কোডসহ নম্বর, + ছাড়া
  facebookPage: "https://facebook.com/your-page",
  supportHours: "সকাল ১০টা – রাত ১২টা",
  platformNote: "শুধুমাত্র Android", // এই অফার কোন প্ল্যাটফর্মের জন্য
  offerBadge: "⏳ Limited Time Offer — শর্ত প্রযোজ্য",
  offerEndDate: "2026-10-21", // অফার শেষ হওয়ার তারিখ (YYYY-MM-DD)
};

// পেমেন্ট নম্বর (Send Money / Personal)
export const PAYMENTS = [
  { id: "bkash", label: "bKash", number: "01629802989", color: "#e2136e" },
  { id: "nagad", label: "Nagad", number: "01XXXXXXXXX", color: "#f6921e" },
  { id: "rocket", label: "Rocket", number: "01XXXXXXXXXX", color: "#8c3494" },
];

// কয়েন প্যাকেজ ও দাম (টাকা) — আপনার দাম অনুযায়ী বদলান
export const PACKAGES = [
  { id: "p1", coins: 130, price: 165 },
  { id: "p2", coins: 300, price: 350 },
  { id: "p3", coins: 550, price: 630, tag: "জনপ্রিয়" },
  { id: "p4", coins: 750, price: 840 },
  { id: "p5", coins: 1040, price: 1130 },
  { id: "p6", coins: 2130, price: 2200, tag: "সেরা দাম" },
  { id: "p7", coins: 3250, price: 3250 },
  { id: "p8", coins: 5700, price: 5350 },
  { id: "p9", coins: 12800, price: 11400 },
];

// স্পেশাল কম্বো অফার (একাধিক প্যাকেজ একসাথে, কম দামে)
export const COMBOS = [
  { id: "c1", coins: 1300, price: 1420, parts: "550+750" },
  { id: "c2", coins: 1790, price: 1900, parts: "750+1040" },
];

// স্পেশাল প্লেয়ার প্যাক অফার (নির্দিষ্ট প্লেয়ার/কার্ড + কয়েন বান্ডেল)
export const PLAYER_PACKS = [
  {
    id: "pp1",
    title: "CF Luis Suárez + 50 Coins",
    emoji: "⚽",
    price: 130,
  },
  {
    id: "pp2",
    title: "GK Iker Casillas + 3 Players + 100 Coins",
    emoji: "🧤",
    price: 320,
  },
];

// প্লেয়ার প্যাক কম্বো (উপরের দুটো একসাথে, কম দামে)
export const PLAYER_PACK_COMBO = {
  id: "ppc1",
  title: "Combo: Suárez Pack + Casillas Pack",
  price: 420,
};

// ঐচ্ছিক: Google Apps Script Web App URL দিলে প্রতিটি অর্ডার Google Sheet-এ সেভ হবে
export const SHEET_WEBHOOK_URL = "";
