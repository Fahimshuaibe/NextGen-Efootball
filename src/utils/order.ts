import { ProductSortOption } from "../types";

/**
 * Convert Bengali numerals (০-৯) to English ASCII numerals (0-9)
 */
export function convertBnToEnDigits(str: string): string {
  if (!str) return "";
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return str.replace(/[০-৯]/g, (d) => bnDigits.indexOf(d).toString());
}

/**
 * Normalizes any Bangladeshi phone number to the official international 13-digit format (8801XXXXXXXXX)
 * Strips all non-digit characters, handles Bengali digits, missing country code, or extra zeros.
 */
export function formatBdWhatsappForUrl(phone: string): string {
  if (!phone) return "";
  const enStr = convertBnToEnDigits(phone);
  let digits = enStr.replace(/\D/g, "");

  // If starts with 008801...
  if (digits.startsWith("0088")) {
    digits = digits.slice(2);
  }

  // Already 8801... (13 digits)
  if (digits.startsWith("8801") && digits.length === 13) {
    return digits;
  }

  // Standard BD format 01... (11 digits) -> 8801...
  if (digits.startsWith("01") && digits.length === 11) {
    return "88" + digits;
  }

  // Missing leading 0: 1... (10 digits) -> 8801...
  if (digits.startsWith("1") && digits.length === 10) {
    return "880" + digits;
  }

  // 881... (12 digits, missing 0 after 88)
  if (digits.startsWith("881") && digits.length === 12) {
    return "880" + digits.slice(2);
  }

  // If already starts with 88 and is at least 11 digits
  if (digits.startsWith("88") && digits.length >= 12) {
    return digits;
  }

  // Starts with 0
  if (digits.startsWith("0")) {
    return "88" + digits;
  }

  return "880" + digits;
}

/**
 * Pretty formats for display: +880 1XXX-XXXXXX
 */
export function formatBdPhonePretty(phone: string): string {
  const norm = formatBdWhatsappForUrl(phone);
  if (norm.length === 13 && norm.startsWith("8801")) {
    return `+880 ${norm.slice(3, 7)}-${norm.slice(7)}`;
  }
  return phone;
}

export function isValidBdPhone(phone: string): boolean {
  if (!phone) return false;
  const enStr = convertBnToEnDigits(phone);
  const digits = enStr.replace(/\D/g, "");
  return (digits.startsWith("01") && digits.length === 11) ||
         (digits.startsWith("8801") && digits.length === 13) ||
         (digits.startsWith("1") && digits.length === 10);
}

export function isValidWhatsapp(phone: string): boolean {
  return isValidBdPhone(phone);
}

export function isValidTrxId(trxId: string): boolean {
  return trxId.trim().length >= 6;
}

export function toBn(n: number | string): string {
  if (typeof n === "number") {
    return n.toLocaleString("bn-BD");
  }
  return n;
}

export function isOfferActive(endDateStr?: string): boolean {
  if (!endDateStr) return true;
  const end = new Date(endDateStr + "T23:59:59");
  return new Date() <= end;
}

/**
 * Step 1: Start login message to ask if user is active
 */
export function getLoginStartWhatsappMessage(
  customerName: string,
  orderNo: string
): string {
  return `আসসালামু আলাইকুম ${customerName} ভাই, NextGen Efootball থেকে বলছি। আপনার অর্ডার নম্বর #${orderNo} এর প্রসেসিং শুরু করতে যাচ্ছি।\n\n` +
    `আপনার আইডি লগইন করা হবে। আপনি কি এক্টিভ আছেন?`;
}

/**
 * Step 2: Request OTP message with 5 minute notice
 */
export function getOtpRequestWhatsappMessage(
  customerName: string,
  orderNo: string,
  emailOrKonamiId: string
): string {
  return `আপনার এই অর্ডারটির (#${orderNo}) জন্য NextGen Efootball থেকে লগইন করা হচ্ছে।\n\n` +
    `আপনার জিমেইল অ্যাড্রেস: ${emailOrKonamiId} এ একটা OTP পাঠানো হয়েছে। Otp এর মেয়াদ থাকে ৫ মিনিট।\n` +
    `Otp দিলে ২ মিনিটের মধ্যে অর্ডার কমপ্লিট করা হবে এবং আপনাকে জানিয়ে দেওয়া হবে।`;
}

/**
 * Step 3: Completed order message including Facebook review and inviting friends
 */
export function getCompletedOrderWhatsappMessage(
  customerName: string,
  orderNo: string,
  packageName: string,
  facebookUrl = "facebook.com/nextgenefootball01"
): string {
  const cleanFb = facebookUrl.replace(/^https?:\/\//, "");
  return `আলহামদুলিল্লাহ ${customerName} ভাই! 🎉⚽\n` +
    `আপনার eFootball অর্ডার নম্বর: ${orderNo} (${packageName}) সফলভাবে সম্পন্ন হয়েছে এবং আপনার গেমে কয়েন যুক্ত করে দেওয়া হয়েছে।\n\n` +
    `ভবিষ্যতে কয়েন এর প্রয়োজন হলে অবশ্যই যোগাযোগ করবেন। আর আমার ফেসবুক পেজ এ একটা রিভিউ দিয়ে আসেন: https://${cleanFb}\n` +
    `সাথে যারা Efootball খেলে তাদের ইনভাইট দিয়ে দিতে ভুলবেন না! ❤️⚽\n\n` +
    `- NextGen Efootball`;
}

export function getSortOptionLabel(sortBy: ProductSortOption): string {
  switch (sortBy) {
    case "popularity":
      return "Sort by popularity";
    case "latest":
      return "Sort by latest";
    case "price_asc":
      return "Sort by price: low to high";
    case "price_desc":
      return "Sort by price: high to low";
    default:
      return "Default sorting";
  }
}

/**
 * Normalizes Bengali & English text for search:
 * - Converts Bengali numerals (০-৯) to ASCII (0-9)
 * - Strips Latin accents/diacritics (e.g., "Suárez" -> "suarez")
 * - Normalizes Bengali য় / য় variations
 * - Lowercases and collapses extra spaces
 */
export function normalizeSearchText(str: string): string {
  if (!str) return "";
  const withEnDigits = convertBnToEnDigits(str).replace(/(\d),(\d)/g, "$1$2");
  return withEnDigits
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u09af\u09bc/g, "\u09df") // য় -> য়
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts a numeric coin query if the user is searching for a coin amount
 * e.g. "800 কয়েন", "৭০০ কয়েন", "700", "800 coins", "500 coin"
 */
export function extractRequestedCoinAmount(query: string): number | null {
  const norm = normalizeSearchText(query);
  if (!norm) return null;

  // Match numbers in the query
  const matches = norm.match(/\d+/g);
  if (!matches || matches.length === 0) return null;

  // Check if query is primarily numeric or mentions coin/pack/taka keywords or player names
  const nonCoinPlayerKeywords = ["suarez", "casillas", "সুয়ারেজ", "সুয়ারেজ", "ক্যাসিয়াস", "ক্যাসিয়াস", " নেইমার", "মেসি"];
  if (nonCoinPlayerKeywords.some((kw) => norm.includes(normalizeSearchText(kw)))) {
    return null;
  }

  const num = parseInt(matches[0], 10);
  if (isNaN(num) || num <= 0) return null;
  return num;
}

export interface SearchableCatalogItem {
  id: string;
  title: string;
  subtitle: string;
  price: number;
  coins?: number;
  image?: string;
  tag?: string;
  category: string;
  sectionId: string;
  keywords?: string;
}

export interface SmartSearchSuggestion extends SearchableCatalogItem {
  matchType: "exact" | "nearby";
  coinDiff?: number;
  matchBadge: string;
}

/**
 * Computes smart live search suggestions across all catalog items:
 * - Matches English & Bengali queries (e.g. "Luis Suarez", "Casillas", "কম্বো")
 * - Matches exact coin or price amounts
 * - When a user searches a coin amount (e.g. "700 কয়েন" or "800 কয়েন") that doesn't exist,
 *   finds and ranks the closest nearby coin packages (e.g. 750 Coins, 550 Coins, 1040 Coins).
 */
export function getSmartSearchSuggestions(
  catalog: SearchableCatalogItem[],
  rawQuery: string,
  maxResults = 6
): SmartSearchSuggestion[] {
  const normQuery = normalizeSearchText(rawQuery);
  if (!normQuery) return [];

  const targetCoins = extractRequestedCoinAmount(rawQuery);

  // Clean text tokens excluding generic filler words like "coin", "coins", "কয়েন", "কয়েন"
  const queryTokens = normQuery
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !["coin", "coins", "কয়েন", "কয়েন", "pack", "প্যাক", "এর", "টা", "টি"].includes(t));

  const exactMatches: SmartSearchSuggestion[] = [];

  for (const item of catalog) {
    const searchableBlob = normalizeSearchText(
      `${item.title} ${item.subtitle} ${item.tag || ""} ${item.keywords || ""} ${item.coins || ""} ${item.price}`
    );
    const searchableWords = searchableBlob.split(/[^a-z0-9\u0980-\u09ff]+/).filter(Boolean);

    const hasDigitsInQuery = /\d/.test(normQuery);
    const directSubstringMatch = hasDigitsInQuery
      ? false
      : searchableBlob.includes(normQuery);

    const tokenMatch =
      queryTokens.length > 0 &&
      queryTokens.every((tok) =>
        /^\d+$/.test(tok) ? searchableWords.includes(tok) : searchableBlob.includes(tok)
      );
    const exactCoinMatch =
      targetCoins !== null && item.coins !== undefined && item.coins === targetCoins;

    if (directSubstringMatch || tokenMatch || exactCoinMatch) {
      exactMatches.push({
        ...item,
        matchType: "exact",
        coinDiff:
          targetCoins !== null && item.coins !== undefined
            ? Math.abs(item.coins - targetCoins)
            : 0,
        matchBadge: exactCoinMatch
          ? "সঠিক পরিমাণ"
          : item.category === "playerPacks"
          ? "প্লেয়ার প্যাক"
          : item.category === "combos"
          ? "কম্বো অফার"
          : "কয়েন প্যাক",
      });
    }
  }

  // If the user searched for a coin amount (e.g. 700 or 800), also find nearby coin packages
  if (targetCoins !== null) {
    const exactIds = new Set(exactMatches.map((m) => m.id));
    const nearbyCandidates = catalog
      .filter((item) => item.coins !== undefined && !exactIds.has(item.id))
      .map((item) => {
        const diff = Math.abs((item.coins || 0) - targetCoins);
        return {
          ...item,
          matchType: "nearby" as const,
          coinDiff: diff,
          matchBadge:
            diff <= 100
              ? `${toBn(targetCoins)} কয়েনের সবচেয়ে কাছাকাছি (${toBn(item.coins || 0)} 🪙)`
              : `${toBn(targetCoins)} কয়েনের কাছাকাছি অফার`,
        };
      })
      .sort((a, b) => (a.coinDiff ?? 999999) - (b.coinDiff ?? 999999));

    const combined = [...exactMatches, ...nearbyCandidates];
    return combined.slice(0, maxResults);
  }

  return exactMatches.slice(0, maxResults);
}

export function filterAndSortPackages<
  T extends { id: string; price: number; coins?: number | null; tag?: string }
>(
  items: T[],
  searchQuery: string,
  sortBy: ProductSortOption,
  getText: (item: T) => string
): T[] {
  const normQuery = normalizeSearchText(searchQuery);
  if (!normQuery) {
    return sortPackagesList([...items], sortBy);
  }

  const targetCoins = extractRequestedCoinAmount(searchQuery);
  const queryTokens = normQuery
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !["coin", "coins", "কয়েন", "কয়েন", "pack", "প্যাক", "এর", "টা", "টি"].includes(t));

  // 1. Direct / token matches
  const directMatches = items.filter((item) => {
    const text = normalizeSearchText(getText(item));
    const priceStr = String(item.price);
    const coinsStr = item.coins ? String(item.coins) : "";
    const blob = `${text} ${priceStr} ${coinsStr}`;
    const words = blob.split(/[^a-z0-9\u0980-\u09ff]+/).filter(Boolean);

    const hasDigits = /\d/.test(normQuery);
    if (!hasDigits && blob.includes(normQuery)) return true;
    if (
      queryTokens.length > 0 &&
      queryTokens.every((tok) => (/^\d+$/.test(tok) ? words.includes(tok) : blob.includes(tok)))
    ) {
      return true;
    }
    return false;
  });

  // 2. If user searched a coin number (like 700 or 800) and we have items with coins:
  // Include nearest coin packages if no direct match or to show surrounding coin options
  if (targetCoins !== null) {
    const itemsWithCoins = items.filter((i) => typeof i.coins === "number" && i.coins > 0);
    if (itemsWithCoins.length > 0) {
      // Sort by closeness to targetCoins
      const rankedByProximity = [...itemsWithCoins].sort(
        (a, b) => Math.abs((a.coins || 0) - targetCoins) - Math.abs((b.coins || 0) - targetCoins)
      );

      // Take top closest packages (up to 4 for regular coins, or 2 for combos)
      // Only include player packs if targetCoins <= 200 or direct match
      const isSmallCoinPack = itemsWithCoins.every((i) => (i.coins || 0) <= 200);
      if (isSmallCoinPack && targetCoins > 250 && directMatches.length === 0) {
        return [];
      }

      const nearbyCount = items.length > 4 ? 4 : 2;
      const nearby = rankedByProximity.slice(0, nearbyCount);
      const mergedIds = new Set<string>();
      const merged: T[] = [];

      for (const d of directMatches) {
        if (!mergedIds.has(d.id)) {
          mergedIds.add(d.id);
          merged.push(d);
        }
      }
      for (const n of nearby) {
        if (!mergedIds.has(n.id)) {
          mergedIds.add(n.id);
          merged.push(n);
        }
      }

      if (sortBy === "default") {
        // Keep sorted by proximity to targetCoins so closest (e.g. 750 for 700/800) is first
        return merged.sort(
          (a, b) => Math.abs((a.coins || 0) - targetCoins) - Math.abs((b.coins || 0) - targetCoins)
        );
      }
      return sortPackagesList(merged, sortBy);
    }
  }

  return sortPackagesList(directMatches, sortBy);
}

function sortPackagesList<T extends { id: string; price: number; coins?: number | null; tag?: string }>(
  list: T[],
  sortBy: ProductSortOption
): T[] {
  if (sortBy === "price_asc") {
    return [...list].sort((a, b) => a.price - b.price);
  }
  if (sortBy === "price_desc") {
    return [...list].sort((a, b) => b.price - a.price);
  }
  if (sortBy === "popularity") {
    return [...list].sort((a, b) => {
      const aHot = a.tag ? 1 : 0;
      const bHot = b.tag ? 1 : 0;
      if (bHot !== aHot) return bHot - aHot;
      return b.price - a.price;
    });
  }
  if (sortBy === "latest") {
    return [...list].reverse();
  }
  return list;
}

/**
 * Validates changing a user's email address using their account password
 */
export function validateEmailChangeWithPassword(params: {
  currentEmail?: string;
  newEmail: string;
  inputPassword: string;
  actualPassword?: string;
}): { ok: boolean; normalizedEmail?: string; error?: string } {
  const cleanNewEmail = params.newEmail.trim().toLowerCase();
  const cleanCurrentEmail = (params.currentEmail || "").trim().toLowerCase();
  const cleanInputPass = params.inputPassword.trim();
  const cleanActualPass = (params.actualPassword || "").trim();

  if (!cleanNewEmail || !cleanNewEmail.includes("@") || !cleanNewEmail.includes(".")) {
    return { ok: false, error: "অনুগ্রহ করে একটি সঠিক নতুন ইমেইল অ্যাড্রেস লিখুন।" };
  }

  if (cleanNewEmail === cleanCurrentEmail) {
    return { ok: false, error: "নতুন ইমেইল অ্যাড্রেসটি আপনার বর্তমান ইমেইলের মতোই। আলাদা ইমেইল দিন।" };
  }

  if (!cleanInputPass) {
    return { ok: false, error: "ইমেইল অ্যাড্রেস পরিবর্তন করতে আপনার অ্যাকাউন্টের পাসওয়ার্ড দিন।" };
  }

  if (cleanActualPass && cleanInputPass !== cleanActualPass) {
    return { ok: false, error: "আপনার দেওয়া পাসওয়ার্ডটি সঠিক নয়! সঠিক পাসওয়ার্ড দিয়ে আবার চেষ্টা করুন।" };
  }

  return { ok: true, normalizedEmail: cleanNewEmail };
}

/**
 * Validates Step 1 of the multi-step Order Form (Konami Login + Customer Name/Phone/OTP Contact)
 */
export function validateOrderStepOne(params: {
  cartCount: number;
  konamiIdOrEmail: string;
  konamiPassword: string;
  name: string;
  phone: string;
  contactMethod: "whatsapp" | "facebook" | "telegram";
  otpWhatsapp: string;
  sameWhatsapp: boolean;
  contactHandle: string;
}): { ok: boolean; cleanPhone?: string; cleanWa?: string; error?: string } {
  if (params.cartCount <= 0) {
    return { ok: false, error: "আপনার কার্ট খালি! অনুগ্রহ করে অন্তত একটি প্যাকেজ নির্বাচন করুন।" };
  }
  if (!params.konamiIdOrEmail.trim()) {
    return { ok: false, error: "অনুগ্রহ করে আপনার Konami ID অথবা লিংক করা জিমেইল এড্রেস লিখুন।" };
  }
  if (!params.konamiPassword.trim()) {
    return { ok: false, error: "অনুগ্রহ করে আপনার Konami অ্যাকাউন্টের পাসওয়ার্ড লিখুন।" };
  }
  if (!params.name.trim()) {
    return { ok: false, error: "অনুগ্রহ করে আপনার নাম লিখুন।" };
  }

  const cleanPhone = convertBnToEnDigits(params.phone.trim());
  if (!isValidBdPhone(cleanPhone)) {
    return {
      ok: false,
      error: "অনুগ্রহ করে সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 01712345678)।",
    };
  }

  const cleanWa = params.sameWhatsapp
    ? cleanPhone
    : convertBnToEnDigits(params.otpWhatsapp.trim());

  if (params.contactMethod === "whatsapp") {
    if (!isValidBdPhone(cleanWa)) {
      return {
        ok: false,
        error: "অনুগ্রহ করে OTP নেওয়ার জন্য সঠিক ১১ ডিজিটের WhatsApp নম্বর দিন।",
      };
    }
  } else if (params.contactMethod === "facebook") {
    if (!params.contactHandle.trim()) {
      return {
        ok: false,
        error: "অনুগ্রহ করে OTP ও যোগাযোগের জন্য আপনার ফেসবুক আইডির নাম বা প্রোফাইল লিংক দিন।",
      };
    }
  } else if (params.contactMethod === "telegram") {
    if (!params.contactHandle.trim()) {
      return {
        ok: false,
        error: "অনুগ্রহ করে OTP ও যোগাযোগের জন্য আপনার টেলিগ্রাম আইডি বা নম্বর দিন।",
      };
    }
  }

  return { ok: true, cleanPhone, cleanWa };
}

/**
 * Validates and formats the payment proof in Step 3:
 * - Mobile Banking (bKash, Nagad, Rocket, Upay, Cellfin):
 *   - Personal: accepts Transaction ID (TrxID) OR Mobile Last 3 Digits (e.g. "989") OR full phone
 *   - Shop: accepts Shop Number's Last 3 Digits (e.g. "458")
 * - Bank Account (NPSB):
 *   - Requires Sender Bank Name / Account Holder Name (যে ব্যাংক থেকে পাঠিয়েছে ওই ব্যাংক অ্যাকাউন্ট নাম)
 */
export function validateAndFormatPaymentProof(params: {
  paymentId: string;
  paymentSource: "personal" | "shop" | "bank";
  customerPhone: string;
  personalProofInput: string; // TrxID or Mobile Last 3 digits
  shopLastDigits: string;
  senderBankAccountName: string;
  targetBankName?: string;
}): {
  ok: boolean;
  finalSenderNumber?: string;
  finalTrxId?: string;
  resolvedPaymentSource?: "personal" | "shop" | "bank";
  cleanShopDigits?: string;
  error?: string;
} {
  const cleanCustomerPhone = convertBnToEnDigits(params.customerPhone.trim());

  // Case 1: Bank Account (NPSB)
  if (params.paymentId === "bank" || params.paymentSource === "bank") {
    const cleanBankAcc = params.senderBankAccountName.trim();
    if (cleanBankAcc.length < 2) {
      return {
        ok: false,
        error: "ব্যাংক থেকে টাকা পাঠালে যে ব্যাংক থেকে পাঠিয়েছেন ওই ব্যাংক ও অ্যাকাউন্টের নাম লিখুন।",
      };
    }
    const targetBank = params.targetBankName || "Bank NPSB";
    return {
      ok: true,
      resolvedPaymentSource: "bank",
      finalSenderNumber: `ব্যাংক একাউন্ট: ${cleanBankAcc} (প্রাপক: ${targetBank})`,
      finalTrxId: `NPSB: ${cleanBankAcc}`,
    };
  }

  // Case 2: Mobile Banking from a Shop (দোকান থেকে পাঠাইলে দোকানের নম্বর এর লাস্ট ৩ ডিজিট)
  if (params.paymentSource === "shop") {
    const cleanShopDigits = convertBnToEnDigits(params.shopLastDigits.trim()).replace(/\D/g, "");
    if (cleanShopDigits.length < 3) {
      return {
        ok: false,
        error: "দোকান থেকে টাকা পাঠালে প্রমাণ হিসেবে দোকানের নম্বরের লাস্ট ৩ ডিজিট লিখুন।",
      };
    }
    return {
      ok: true,
      resolvedPaymentSource: "shop",
      cleanShopDigits,
      finalSenderNumber: `দোকান (লাস্ট ডিজিট: ${cleanShopDigits})`,
      finalTrxId: `SHOP-${cleanShopDigits}`,
    };
  }

  // Case 3: Mobile Banking from Own Number (ট্রানজেকশন আইডি অথবা মোবাইলের লাস্ট ৩ ডিজিট)
  const rawProof = convertBnToEnDigits(params.personalProofInput.trim());
  if (!rawProof || rawProof.length < 3) {
    return {
      ok: false,
      error: "প্রমাণ হিসেবে আপনার ট্রানজেকশন আইডি (TrxID) অথবা মোবাইল নম্বরের লাস্ট ৩ ডিজিট লিখুন।",
    };
  }

  const digitsOnly = rawProof.replace(/\D/g, "");
  const isPureDigits = /^\d+$/.test(rawProof);

  if (isPureDigits && digitsOnly.length >= 3 && digitsOnly.length <= 5) {
    // User provided last 3-5 digits of mobile number
    return {
      ok: true,
      resolvedPaymentSource: "personal",
      finalSenderNumber: `${cleanCustomerPhone} (মোবাইল লাস্ট ডিজিট: ${digitsOnly})`,
      finalTrxId: `LAST3-${digitsOnly}`,
    };
  }

  if (isPureDigits && digitsOnly.length === 11 && digitsOnly.startsWith("01")) {
    const last3 = digitsOnly.slice(-3);
    return {
      ok: true,
      resolvedPaymentSource: "personal",
      finalSenderNumber: `${digitsOnly} (লাস্ট ৩ ডিজিট: ${last3})`,
      finalTrxId: `MOB-${last3}`,
    };
  }

  // Otherwise treated as Transaction ID (TrxID)
  return {
    ok: true,
    resolvedPaymentSource: "personal",
    finalSenderNumber: cleanCustomerPhone,
    finalTrxId: rawProof.toUpperCase(),
  };
}



