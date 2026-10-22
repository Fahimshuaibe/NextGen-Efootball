import {
  Order,
  OrderNotificationEventType,
  OrderStatus,
  RegisteredUserAccount,
} from "../types";
import { convertBnToEnDigits, toBn } from "./order";

/**
 * Normalizes a phone number to a canonical 11-digit BD key (e.g., 01712345678)
 */
export function normalizePhoneForOwnership(phone?: string): string {
  if (!phone) return "";
  const en = convertBnToEnDigits(phone);
  let digits = en.replace(/\D/g, "");
  if (digits.startsWith("880")) digits = "0" + digits.slice(3);
  else if (digits.startsWith("88") && digits.length > 11) digits = digits.slice(2);
  else if (digits.startsWith("1") && digits.length === 10) digits = "0" + digits;
  return digits;
}

/**
 * 1. Generates a unique, collision-checked Order ID (e.g. EF261022-4829)
 */
export function generateUniqueOrderId(
  existingOrderIds: string[] = [],
  now: Date = new Date()
): string {
  const existingSet = new Set(existingOrderIds.map((id) => id.trim().toUpperCase()));
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");

  for (let attempt = 0; attempt < 25; attempt++) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    const timeSuffix = String(now.getTime()).slice(-3);
    const candidate =
      attempt === 0
        ? `EF${yy}${mm}${dd}${rand}`
        : `EF${yy}${mm}${dd}${rand}${timeSuffix.slice(-1)}`;
    if (!existingSet.has(candidate.toUpperCase())) {
      return candidate;
    }
  }

  return `EF${Date.now()}${Math.floor(10 + Math.random() * 89)}`;
}

/**
 * Computes a deterministic ownership signature binding an order to its owner's identity
 */
export function computeOrderOwnershipSignature(params: {
  orderNo: string;
  userId?: string;
  email?: string;
  phone?: string;
}): string {
  const cleanOrderNo = (params.orderNo || "").trim().toUpperCase();
  const cleanUserId = (params.userId || "guest").trim();
  const cleanEmail = (params.email || "").trim().toLowerCase();
  const cleanPhone = normalizePhoneForOwnership(params.phone);
  const raw = `${cleanOrderNo}|${cleanUserId}|${cleanEmail}|${cleanPhone}|NG2026`;

  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `sig_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * 6. Securely verifies whether an Order belongs to a given User Account (or active guest phone)
 */
export function verifyOrderUserRelationship(
  order: Order,
  user: RegisteredUserAccount | null,
  guestPhone?: string
): {
  verified: boolean;
  matchedBy?: "user_id" | "verified_email" | "account_phone" | "guest_phone";
  reason?: string;
} {
  if (!order || !order.orderNo) {
    return { verified: false, reason: "Invalid order record" };
  }

  // If the order explicitly belongs to a registered user ID and a different user is logged in,
  // prevent cross-account leakage unless email or phone matches the same person.
  if (user) {
    if (order.userId && order.userId === user.id) {
      return { verified: true, matchedBy: "user_id" };
    }

    const userEmail = (user.email || "").trim().toLowerCase();
    const orderCustomerEmail = (order.customerEmail || "").trim().toLowerCase();
    const orderPaymentEmail = (order.paymentLinkGmail || "").trim().toLowerCase();
    const orderKonamiEmail = order.konamiIdOrEmail?.includes("@")
      ? order.konamiIdOrEmail.trim().toLowerCase()
      : "";

    if (
      userEmail &&
      (userEmail === orderCustomerEmail ||
        userEmail === orderPaymentEmail ||
        userEmail === orderKonamiEmail)
    ) {
      return { verified: true, matchedBy: "verified_email" };
    }

    const userPhone = normalizePhoneForOwnership(user.phone);
    const orderPhone = normalizePhoneForOwnership(order.phone);
    const orderWa = normalizePhoneForOwnership(order.otpWhatsapp);

    if (
      userPhone &&
      userPhone.length >= 10 &&
      (userPhone === orderPhone || userPhone === orderWa)
    ) {
      return { verified: true, matchedBy: "account_phone" };
    }

    return {
      verified: false,
      reason: "Order does not belong to the authenticated user account",
    };
  }

  if (guestPhone) {
    const cleanGuest = normalizePhoneForOwnership(guestPhone);
    const orderPhone = normalizePhoneForOwnership(order.phone);
    const orderWa = normalizePhoneForOwnership(order.otpWhatsapp);
    if (
      cleanGuest &&
      cleanGuest.length >= 10 &&
      (cleanGuest === orderPhone || cleanGuest === orderWa)
    ) {
      return { verified: true, matchedBy: "guest_phone" };
    }
  }

  return { verified: false, reason: "No matching user account or phone session" };
}

/**
 * Resolves the target recipient email for an order notification
 */
export function resolveOrderRecipientEmail(
  order: Order,
  accountEmail?: string
): string {
  const candidates = [
    accountEmail,
    order.customerEmail,
    order.paymentLinkGmail,
    order.konamiIdOrEmail?.includes("@") ? order.konamiIdOrEmail : "",
  ];

  for (const candidate of candidates) {
    const clean = (candidate || "").trim().toLowerCase();
    if (clean && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      return clean;
    }
  }
  return "";
}

/**
 * Maps an OrderStatus to its corresponding notification event type
 */
export function getEventTypeForStatus(
  status: OrderStatus,
  isInitialCreation = false
): OrderNotificationEventType {
  if (isInitialCreation) return "order_created";
  switch (status) {
    case "processing":
      return "status_processing";
    case "completed":
      return "status_completed";
    case "cancelled":
      return "status_cancelled";
    case "pending":
    default:
      return "status_pending";
  }
}

/**
 * 9. Generates a deterministic Idempotency Key so duplicate status updates
 * never send duplicate emails for the same order status transition.
 */
export function generateNotificationIdempotencyKey(
  orderNo: string,
  eventType: OrderNotificationEventType
): string {
  const cleanOrder = (orderNo || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  return `ng_notif_${cleanOrder}_${eventType}`;
}

export function getOrderStatusLabelBn(status: OrderStatus): string {
  switch (status) {
    case "pending":
      return "Pending (পেন্ডিং)";
    case "processing":
      return "Processing (প্রসেসিং চলছে)";
    case "completed":
      return "Completed (কমপ্লিট)";
    case "cancelled":
      return "Cancelled (বাতিল)";
  }
}

/**
 * 4. Builds distinct, rich notification messages (Subject, Plain Text, and HTML Email)
 * for Order Created, Processing, Completed, and Cancelled events.
 */
export function buildOrderNotificationTemplate(
  order: Order,
  eventType: OrderNotificationEventType,
  siteName = "NextGen Efootball"
): {
  subject: string;
  headline: string;
  statusBadgeText: string;
  accentColor: string;
  bodyText: string;
  html: string;
} {
  const updatedTimeStr = new Date(
    order.statusUpdatedAt || order.time || new Date().toISOString()
  ).toLocaleString("bn-BD", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  let subject = "";
  let headline = "";
  let statusBadgeText = "";
  let accentColor = "#06b6d4";
  let mainMessageBn = "";
  let actionHintBn = "";

  switch (eventType) {
    case "order_created":
    case "status_pending":
      subject = `✅ অর্ডার রিসিভ হয়েছে (#${order.orderNo}) — ${siteName}`;
      headline = "আপনার অর্ডারটি সফলভাবে গ্রহণ করা হয়েছে!";
      statusBadgeText = "Pending (অর্ডার গ্রহণ করা হয়েছে)";
      accentColor = "#f59e0b";
      mainMessageBn = `প্রিয় ${order.name}, আপনার eFootball অর্ডার #${order.orderNo} (${order.packageName}) সফলভাবে আমাদের সিস্টেমে যুক্ত হয়েছে। আমরা আপনার পেমেন্ট যাচাই করছি।`;
      actionHintBn =
        "সাধারণত ৫–১০ মিনিটের মধ্যে পেমেন্ট যাচাই করে আপনার অর্ডার প্রসেসিং শুরু করা হবে। আপনি আপনার প্রোফাইলের Order History থেকে লাইভ স্ট্যাটাস দেখতে পারবেন।";
      break;

    case "status_processing":
      subject = `⚡ অর্ডার প্রসেসিং শুরু হয়েছে (#${order.orderNo}) — ${siteName}`;
      headline = "আপনার অর্ডারটির ডেলিভারি প্রসেসিং চলছে!";
      statusBadgeText = "Processing (প্রসেসিং চলছে)";
      accentColor = "#0ea5e9";
      mainMessageBn = `প্রিয় ${order.name}, সুখবর! আপনার অর্ডার #${order.orderNo} (${order.packageName})-এর পেমেন্ট ভেরিফাই সম্পন্ন হয়েছে এবং আমাদের অ্যাডমিন আপনার কয়েন/প্যাক টপ-আপ প্রসেস শুরু করেছেন।`;
      actionHintBn =
        order.serviceMethod === "payment_link"
          ? "আপনার জাপান পেমেন্ট লিংকের মাধ্যমে টপ-আপ প্রসেস করা হচ্ছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।"
          : "আপনার Konami ID লগইন করার জন্য জিমেইলে OTP যেতে পারে। অনুগ্রহ করে অনলাইনে বা চ্যাটে অ্যাক্টিভ থাকুন।";
      break;

    case "status_completed":
      subject = `🎉 অর্ডার কমপ্লিট হয়েছে! (#${order.orderNo}) — ${siteName}`;
      headline = "অভিনন্দন! আপনার অর্ডার সফলভাবে সম্পন্ন হয়েছে ⚽";
      statusBadgeText = "Completed (ডেলিভারি সম্পন্ন)";
      accentColor = "#10b981";
      mainMessageBn = `আলহামদুলিল্লাহ ${order.name}! আপনার eFootball অর্ডার #${order.orderNo} (${order.packageName}) সফলভাবে কমপ্লিট করা হয়েছে এবং আপনার অ্যাকাউন্টে কয়েন/প্যাক যুক্ত করে দেওয়া হয়েছে।`;
      actionHintBn =
        "এখনই গেমে প্রবেশ করে আপনার ব্যালেন্স চেক করুন। আমাদের সার্ভিস ভালো লাগলে ফেসবুক পেজে একটি রিভিউ দেওয়ার অনুরোধ রইলো!";
      break;

    case "status_cancelled":
      subject = `⚠️ অর্ডার বাতিল হয়েছে (#${order.orderNo}) — ${siteName}`;
      headline = "আপনার অর্ডারটি বাতিল (Cancelled) করা হয়েছে";
      statusBadgeText = "Cancelled (বাতিল)";
      accentColor = "#f43f5e";
      mainMessageBn = `প্রিয় ${order.name}, দুঃখিত! আপনার অর্ডার #${order.orderNo} (${order.packageName}) বাতিল করা হয়েছে।`;
      actionHintBn = order.adminNotes
        ? `অ্যাডমিন নোট / কারণ: ${order.adminNotes}। যেকোনো সাহায্যের জন্য আমাদের লাইভ চ্যাট বা WhatsApp সাপোর্টে যোগাযোগ করুন।`
        : "পেমেন্ট তথ্য বা লগইন তথ্যে অমিল থাকার কারণে অর্ডারটি বাতিল হতে পারে। বিস্তারিত জানতে আমাদের লাইভ চ্যাট বা WhatsApp সাপোর্টে যোগাযোগ করুন।";
      break;
  }

  const bodyText = [
    `${headline}`,
    `অর্ডার আইডি: #${order.orderNo}`,
    `স্ট্যাটাস: ${statusBadgeText}`,
    `সর্বশেষ আপডেট: ${updatedTimeStr}`,
    `প্যাকেজ: ${order.packageName}`,
    `মূল্য: ৳${toBn(order.price)} (${order.paymentMethod})`,
    ``,
    mainMessageBn,
    actionHintBn,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:24px;background-color:#070d1d;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f1f5f9;">
  <div style="max-width:560px;margin:0 auto;background-color:#0f172a;border:1px solid #1e293b;border-radius:18px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.5);">
    <div style="padding:20px 24px;background:linear-gradient(90deg,#0f172a,#1e293b);border-bottom:2px solid ${accentColor};">
      <div style="font-size:12px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:1px;">${siteName} • Official Order Update</div>
      <h1 style="margin:6px 0 0;font-size:20px;color:#ffffff;">${headline}</h1>
    </div>
    <div style="padding:24px;">
      <div style="display:inline-block;padding:6px 14px;border-radius:999px;background-color:${accentColor}22;border:1px solid ${accentColor};color:${accentColor};font-size:13px;font-weight:700;margin-bottom:16px;">
        ${statusBadgeText}
      </div>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#e2e8f0;">${mainMessageBn}</p>
      <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#94a3b8;background:#090f1f;padding:12px 14px;border-radius:12px;border-left:3px solid ${accentColor};">${actionHintBn}</p>

      <table style="width:100%;border-collapse:collapse;background-color:#090f1f;border-radius:12px;overflow:hidden;font-size:13px;">
        <tr>
          <td style="padding:10px 14px;color:#94a3b8;border-bottom:1px solid #1e293b;">ইউনিক অর্ডার আইডি</td>
          <td style="padding:10px 14px;color:#ffffff;font-weight:700;text-align:right;border-bottom:1px solid #1e293b;font-family:monospace;">#${order.orderNo}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#94a3b8;border-bottom:1px solid #1e293b;">প্যাকেজ</td>
          <td style="padding:10px 14px;color:#ffffff;font-weight:700;text-align:right;border-bottom:1px solid #1e293b;">${order.packageName}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#94a3b8;border-bottom:1px solid #1e293b;">মোট মূল্য ও মেথড</td>
          <td style="padding:10px 14px;color:#34d399;font-weight:700;text-align:right;border-bottom:1px solid #1e293b;">৳ ${order.price} (${order.paymentMethod})</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#94a3b8;">স্ট্যাটাস আপডেট সময়</td>
          <td style="padding:10px 14px;color:#cbd5e1;text-align:right;">${updatedTimeStr}</td>
        </tr>
      </table>
    </div>
    <div style="padding:14px 24px;background-color:#090f1f;border-top:1px solid #1e293b;font-size:11px;color:#64748b;text-align:center;">
      © ${new Date().getFullYear()} ${siteName} — স্বয়ংক্রিয় অর্ডার নোটিফিকেশন সিস্টেম
    </div>
  </div>
</body>
</html>`;

  return {
    subject,
    headline,
    statusBadgeText,
    accentColor,
    bodyText,
    html,
  };
}
