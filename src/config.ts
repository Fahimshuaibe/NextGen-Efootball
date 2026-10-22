// ===== NextGen Efootball কনফিগারেশন ও ডাটা =====
import { CoinPackage, ComboPackage, PlayerPack } from "./types";

export interface BankAccountInfo {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchName: string;
  routingNumber: string;
}

export interface PaymentMethod {
  id: string;
  label: string;
  shortName: string;
  bnName: string;
  number: string;
  color: string;
  cardBg: string;
  type: string;
  dialCode?: string;
  appAction: string;
  instruction: string;
  category: "mobile_banking" | "bank_transfer";
}

export const SITE = {
  name: "NextGen Efootball", // আপনার ব্র্যান্ড নাম
  tagline: "অফিসিয়াল কয়েন টপ-আপ ও স্পেশাল প্লেয়ার প্যাক",
  logo: "/assets/aistudio/20260627_002155_69284c16.png",
  whatsapp: "8801575887881", // দেশের কোডসহ নম্বর (+8801575-887881)
  whatsappDisplay: "+8801575-887881",
  supportHours: "সকাল ১০টা – রাত ১২টা",
  platformNote: "শুধুমাত্র Android (Android Only)",
  offerBadge: "🔥 স্পেশাল লিমিটেড ডিসকাউন্ট অফার",
  offerEndDate: "2026-10-31",
  adminPin: "2026", // সিকিউর অ্যাডমিন ড্যাশবোর্ড পিন
};

// ব্যাংক একাউন্টসমূহ (NPSB Instant Transfer)
export const BANK_ACCOUNTS: BankAccountInfo[] = [
  {
    id: "trust_bank",
    bankName: "Trust Bank PLC.",
    accountName: "MD. SHUAIBE HASAN",
    accountNumber: "0020-0466009896",
    branchName: "CDA Avenue Branch",
    routingNumber: "240151485",
  },
  {
    id: "islami_bank",
    bankName: "Islami Bank Bangladesh PLC",
    accountName: "MD. SHUAIBE HASAN",
    accountNumber: "20501886700660110",
    branchName: "Sherpur Br.-Sherpur",
    routingNumber: "125890553",
  },
];

// পেমেন্ট মাধ্যম: বিকাশ, নগদ, রকেট, উপায়, সেলফিন এবং ব্যাংক একাউন্ট
export const PAYMENTS: PaymentMethod[] = [
  { 
    id: "bkash", 
    label: "bKash (বিকাশ)",
    shortName: "bKash",
    bnName: "বিকাশ",
    number: "01629802989", 
    color: "#e2136e",
    cardBg: "#d81b60",
    type: "Personal Account",
    dialCode: "*247#",
    appAction: "Send Money",
    instruction: "bKash অ্যাপ বা *247# ডায়াল করে Send Money করুন",
    category: "mobile_banking"
  },
  { 
    id: "nagad", 
    label: "Nagad (নগদ)",
    shortName: "Nagad",
    bnName: "নগদ",
    number: "01629802989", 
    color: "#f6921e",
    cardBg: "#e65100",
    type: "Personal Account",
    dialCode: "*167#",
    appAction: "Send Money",
    instruction: "Nagad অ্যাপ বা *167# ডায়াল করে Send Money করুন",
    category: "mobile_banking"
  },
  { 
    id: "rocket", 
    label: "Rocket (রকেট)",
    shortName: "Rocket",
    bnName: "রকেট",
    number: "01777414308", 
    color: "#8c3494",
    cardBg: "#7b1fa2",
    type: "Personal Account",
    dialCode: "*322#",
    appAction: "Send Money",
    instruction: "Rocket অ্যাপ বা *322# ডায়াল করে Send Money করুন",
    category: "mobile_banking"
  },
  { 
    id: "upay", 
    label: "Upay (উপায়)",
    shortName: "Upay",
    bnName: "উপায়",
    number: "01629802989", 
    color: "#0072bc",
    cardBg: "#005baa",
    type: "Personal Account",
    dialCode: "*268#",
    appAction: "Send Money",
    instruction: "Upay অ্যাপ বা *268# ডায়াল করে Send Money করুন",
    category: "mobile_banking"
  },
  { 
    id: "cellfin", 
    label: "Cellfin (সেলফিন)",
    shortName: "Cellfin",
    bnName: "সেলফিন",
    number: "01777414308", 
    color: "#008542",
    cardBg: "#006a4e",
    type: "Personal Account",
    appAction: "Fund Transfer / Send Money",
    instruction: "Cellfin অ্যাপ থেকে এই নম্বরে Send Money / Transfer করুন",
    category: "mobile_banking"
  },
  { 
    id: "bank", 
    label: "Bank Account (NPSB)",
    shortName: "Bank Transfer",
    bnName: "ব্যাংক একাউন্ট",
    number: "0020-0466009896", 
    color: "#2563eb",
    cardBg: "#1e3a8a",
    type: "NPSB Instant Transfer",
    appAction: "NPSB (Instant Transfer)",
    instruction: "ব্যাংক অ্যাপ থেকে অবশ্যই NPSB সিলেক্ট করে টাকা পাঠান",
    category: "bank_transfer"
  },
];

// ১. রেগুলার কয়েন প্যাকেজসমূহ (ট্যাগ আপডেট: ১০৪০, ২১৩০ জনপ্রিয় এবং ৩২৫০, ৫৭০০, ১২৮০০ সেরা দাম)
export const REGULAR_PACKAGES: CoinPackage[] = [
  { id: "p1", coins: 130, price: 165 },
  { id: "p2", coins: 300, price: 350 },
  { id: "p3", coins: 550, price: 630, tag: "জনপ্রিয়" },
  { id: "p4", coins: 750, price: 840 },
  { id: "p5", coins: 1040, price: 1130, tag: "জনপ্রিয়" },
  { id: "p6", coins: 2130, price: 2200, tag: "জনপ্রিয়" },
  { id: "p7", coins: 3250, price: 3250, tag: "সেরা দাম" },
  { id: "p8", coins: 5700, price: 5350, tag: "সেরা দাম" },
  { id: "p9", coins: 12800, price: 11400, tag: "সেরা দাম" },
];

// ২. কম্বো কয়েন এর ২ টা প্যাক
export const COIN_COMBOS: ComboPackage[] = [
  { 
    id: "c1", 
    coins: 1300, 
    price: 1420, 
    parts: "550 + 750 Coins",
    tag: "স্পেশাল কম্বো",
    description: "দুটো কয়েন প্যাক একসাথে কম খরচে নিন"
  },
  { 
    id: "c2", 
    coins: 1790, 
    price: 1900, 
    parts: "750 + 1040 Coins",
    tag: "বেশি সেভিংস",
    description: "সবচেয়ে বেশি কয়েন সেভিংস কম্বো প্যাক"
  },
];

// ৩. লুইস সুয়ারেজ, ইকার ক্যাসিয়াস এবং কম্বো ৩ টা প্যাক (ছবিসহ)
export const PLAYER_PACKS: PlayerPack[] = [
  {
    id: "pp1",
    title: "Starter Set: Luis Suárez + 50 Coins",
    emoji: "⚽",
    price: 130,
    coins: 50,
    image: "/assets/aistudio/Screenshot_20260929-225847_72392c40.png",
    subtitle: "CF 99 Luis Suárez কার্ড + ইন-গেম ৫০ কয়েন",
    tag: "জনপ্রিয় প্যাক",
  },
  {
    id: "pp2",
    title: "Starter Set: Iker Casillas + 100 Coins",
    emoji: "🧤",
    price: 320,
    coins: 100,
    image: "/assets/aistudio/casillas_card.png",
    subtitle: "GK 100 Casillas + CMF 95 + AMF 96 + ১০০ কয়েন",
    tag: "লেজেন্ডারি প্যাক",
  },
  {
    id: "pp3",
    title: "Combo: Suárez Pack + Casillas Pack",
    emoji: "🔥",
    price: 420,
    coins: 150,
    image: "/assets/aistudio/combo_suarez_casillas.png",
    isCombo: true,
    subtitle: "সুয়ারেজ ও ক্যাসিয়াস দুটো প্যাক একসাথে (১৫০ কয়েন + প্লেয়ার বান্ডেল)",
    tag: "সেরা কম্বো অফার",
  },
];

// সব অফার একত্রিত তালিকা (ড্রপডাউন বা কার্টের জন্য)
export const ALL_OFFERS = [
  ...REGULAR_PACKAGES.map((p) => ({
    id: p.id,
    label: `${p.coins.toLocaleString('bn-BD')} কয়েন (৳${p.price.toLocaleString('bn-BD')})`,
    name: `${p.coins.toLocaleString('bn-BD')} কয়েন`,
    price: p.price,
    coins: p.coins,
    tag: p.tag,
    category: "regular" as const,
  })),
  ...COIN_COMBOS.map((c) => ({
    id: c.id,
    label: `🎁 কম্বো ${c.coins.toLocaleString('bn-BD')} কয়েন [${c.parts}] (৳${c.price.toLocaleString('bn-BD')})`,
    name: `কম্বো ${c.coins.toLocaleString('bn-BD')} কয়েন (${c.parts})`,
    price: c.price,
    coins: c.coins,
    tag: c.tag,
    category: "combo" as const,
  })),
  ...PLAYER_PACKS.map((pp) => ({
    id: pp.id,
    label: `${pp.emoji} ${pp.title} (৳${pp.price.toLocaleString('bn-BD')})`,
    name: pp.title,
    price: pp.price,
    coins: pp.coins,
    image: pp.image,
    tag: pp.tag,
    category: "player_pack" as const,
  })),
];

// Google Sheet Webhook URL (যদি থাকে)
export const SHEET_WEBHOOK_URL = "";
