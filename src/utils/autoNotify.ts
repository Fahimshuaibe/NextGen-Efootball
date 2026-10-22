import {
  Order,
  OrderNotificationEventType,
  OrderNotificationLog,
} from "../types";
import {
  getShopSettings,
  getAdminSecurityConfig,
  getRegisteredUsers,
  hasSentNotificationForKey,
  saveNotificationLog,
  isAdminSessionAuthorized,
} from "./storage";
import { formatBdWhatsappForUrl, toBn } from "./order";
import {
  buildOrderNotificationTemplate,
  generateNotificationIdempotencyKey,
  getEventTypeForStatus,
  resolveOrderRecipientEmail,
  verifyOrderUserRelationship,
} from "./orderNotification";

export function buildAutoOrderNotificationMessage(order: Order): string {
  const contactText =
    order.contactMethod === "facebook"
      ? `Facebook (${order.contactHandle || "N/A"})`
      : order.contactMethod === "telegram"
      ? `Telegram (${order.contactHandle || "N/A"})`
      : `WhatsApp (${order.otpWhatsapp || order.phone})`;

  const paymentSourceText =
    order.paymentSource === "shop"
      ? `🏪 দোকান থেকে পেমেন্ট (দোকানের শেষ ডিজিট: ${order.shopLastDigits || order.senderNumber})`
      : `📱 নিজের মোবাইল থেকে (প্রেরক: ${order.senderNumber} | TrxID: ${order.trxId})`;

  const serviceDetails =
    order.serviceMethod === "payment_link"
      ? `🔗 পেমেন্ট লিংক অর্ডার\nজিমেইল: ${order.paymentLinkGmail || order.konamiIdOrEmail}\nলিংক: ${order.paymentLinkJapan || "N/A"}`
      : `🎮 Konami Login\nID/Email: ${order.konamiIdOrEmail}\nPassword: ${order.konamiPassword}`;

  return [
    `🔔 *নতুন অর্ডার এসেছে! (NextGen Efootball)*`,
    `━━━━━━━━━━━━━━━━━━`,
    `🆔 অর্ডার নং: #${order.orderNo}`,
    `👤 নাম: ${order.name}`,
    `📞 মোবাইল: ${order.phone}`,
    `💬 OTP যোগাযোগ: ${contactText}`,
    `📦 প্যাকেজ: ${order.packageName}`,
    `💰 মোট টাকা: ৳${toBn(order.price)}`,
    `💳 পেমেন্ট মেথড: ${order.paymentMethod}`,
    `🧾 পেমেন্ট প্রমাণ: ${paymentSourceText}`,
    `━━━━━━━━━━━━━━━━━━`,
    serviceDetails,
    `🕒 সময়: ${new Date(order.time).toLocaleString("bn-BD")}`,
  ].join("\n");
}

export function buildTelegramOrderNotificationMessage(order: Order): string {
  const contactText =
    order.contactMethod === "facebook"
      ? `Facebook (${order.contactHandle || "N/A"})`
      : order.contactMethod === "telegram"
      ? `Telegram (${order.contactHandle || "N/A"})`
      : `WhatsApp (${order.otpWhatsapp || order.phone})`;

  const paymentSourceText =
    order.paymentSource === "shop"
      ? `🏪 দোকান থেকে পেমেন্ট (দোকানের শেষ ডিজিট: ${order.shopLastDigits || order.senderNumber})`
      : `📱 নিজের মোবাইল থেকে (প্রেরক: ${order.senderNumber} | TrxID: ${order.trxId})`;

  const serviceDetails =
    order.serviceMethod === "payment_link"
      ? `🔗 <b>পেমেন্ট লিংক অর্ডার</b>\nজিমেইল: <code>${order.paymentLinkGmail || order.konamiIdOrEmail}</code>\nলিংক: ${order.paymentLinkJapan || "N/A"}`
      : `🎮 <b>Konami Login</b>\nID/Email: <code>${order.konamiIdOrEmail}</code>\nPassword: <code>${order.konamiPassword}</code>`;

  return [
    `🔔 <b>নতুন অর্ডার এসেছে! (NextGen Efootball)</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    `🆔 <b>অর্ডার নং:</b> #${order.orderNo}`,
    `👤 <b>নাম:</b> ${order.name}`,
    `📞 <b>মোবাইল:</b> ${order.phone}`,
    `💬 <b>OTP যোগাযোগ:</b> ${contactText}`,
    `📦 <b>প্যাকেজ:</b> ${order.packageName}`,
    `💰 <b>মোট টাকা:</b> ৳${toBn(order.price)}`,
    `💳 <b>পেমেন্ট মেথড:</b> ${order.paymentMethod}`,
    `🧾 <b>পেমেন্ট তথ্য:</b> ${paymentSourceText}`,
    `━━━━━━━━━━━━━━━━━━`,
    serviceDetails,
    `🕒 <b>সময়:</b> ${new Date(order.time).toLocaleString("bn-BD")}`,
  ].join("\n");
}

/**
 * Automatically sends the order notification in the background to the Admin
 * through multiple reliable channels (Telegram Bot, Admin Gmail, Discord, and WhatsApp).
 */
export async function sendAutomaticAdminOrderAlert(order: Order): Promise<{
  telegramSent: boolean;
  emailSent: boolean;
  whatsappSent: boolean;
  discordSent: boolean;
}> {
  const settings = getShopSettings();
  const secConfig = getAdminSecurityConfig();
  const message = buildAutoOrderNotificationMessage(order);
  const tgHtmlMessage = buildTelegramOrderNotificationMessage(order);

  let telegramSent = false;
  let emailSent = false;
  let whatsappSent = false;
  let discordSent = false;

  // 1. Automatic Telegram Bot API (Primary & Most Reliable - 100% Free, No Server-Full Limits)
  if (settings.telegramBotToken?.trim() && settings.telegramChatId?.trim()) {
    try {
      // First try server-side proxy route (no CORS)
      const res = await fetch("/api/notify-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: settings.telegramBotToken.trim(),
          chatId: settings.telegramChatId.trim(),
          message: tgHtmlMessage,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        telegramSent = true;
      } else {
        // Direct browser fallback
        const directUrl = `https://api.telegram.org/bot${encodeURIComponent(
          settings.telegramBotToken.trim()
        )}/sendMessage`;
        const directRes = await fetch(directUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: settings.telegramChatId.trim(),
            text: message,
          }),
        });
        const directData = await directRes.json();
        if (directData.ok) telegramSent = true;
      }
    } catch (err) {
      console.warn("Auto Telegram alert error:", err);
    }
  }

  // 2. Server-side Resend Email Notification to Admin (shuaivehasanfahim@gmail.com)
  const adminEmail = (secConfig.securityEmail || "shuaivehasanfahim@gmail.com").trim();
  if (adminEmail) {
    try {
      const res = await fetch("/api/notify-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNo: order.orderNo,
          recipientEmail: adminEmail,
          customerName: order.name,
          eventType: "order_created",
          orderStatus: order.status,
          subject: `🔔 নতুন অর্ডার #${order.orderNo} - ${order.packageName} (৳${order.price})`,
          html: `<div style="font-family:sans-serif;padding:16px;background:#0f172a;color:#f8fafc;border-radius:12px;"><h2 style="color:#38bdf8;">নতুন অর্ডার #${order.orderNo}</h2><pre style="white-space:pre-wrap;font-family:monospace;color:#e2e8f0;">${message}</pre></div>`,
          text: message,
          idempotencyKey: `admin_alert_${order.orderNo}`,
        }),
      });
      if (res.ok) emailSent = true;
    } catch (err) {
      console.warn("Admin Resend email alert error:", err);
    }
  }

  // 3. Discord Webhook Notification (if configured)
  if (settings.discordWebhookUrl && settings.discordWebhookUrl.trim()) {
    try {
      const discordMsg = `**🔔 নতুন অর্ডার এসেছে! (NextGen Efootball)**\n\`\`\`\n${message}\n\`\`\``;
      const res = await fetch("/api/notify-discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl: settings.discordWebhookUrl.trim(),
          message: discordMsg,
        }),
      });
      if (res.ok) discordSent = true;
    } catch (err) {
      console.warn("Discord alert error:", err);
    }
  }

  // 4. WhatsApp Option A: Green-API (Dedicated WhatsApp Gateway - No CallMeBot Server Limits)
  if (settings.greenApiIdInstance?.trim() && settings.greenApiApiToken?.trim()) {
    try {
      const res = await fetch("/api/notify-whatsapp-green", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idInstance: settings.greenApiIdInstance.trim(),
          apiTokenInstance: settings.greenApiApiToken.trim(),
          phone: settings.autoWhatsappPhone || settings.whatsapp || "01629802989",
          message,
        }),
      });
      const gData = await res.json();
      if (gData.ok) whatsappSent = true;
    } catch (err) {
      console.warn("Green-API WhatsApp alert error:", err);
    }
  }

  // 5. WhatsApp Option B: CallMeBot Free WhatsApp API (as optional fallback)
  const targetWaPhone = formatBdWhatsappForUrl(
    settings.autoWhatsappPhone || settings.whatsapp || "01629802989"
  );
  const apiKey = (settings.callmebotApiKey || "").trim();

  if (!whatsappSent && targetWaPhone && apiKey) {
    try {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(
        targetWaPhone
      )}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apiKey)}`;
      await fetch(url, { method: "GET", mode: "no-cors" });
      whatsappSent = true;
    } catch (err) {
      console.warn("Auto WhatsApp CallMeBot alert error:", err);
    }
  }

  // 6. Custom WhatsApp Webhook URL (if configured)
  if (settings.whatsappWebhookUrl && settings.whatsappWebhookUrl.trim()) {
    try {
      await fetch(settings.whatsappWebhookUrl.trim(), {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: targetWaPhone,
          text: message,
          message,
          order,
        }),
      });
      whatsappSent = true;
    } catch (err) {
      console.warn("Custom WhatsApp Webhook error:", err);
    }
  }

  return { telegramSent, emailSent, whatsappSent, discordSent };
}

/**
 * Automatically discovers the user's Chat ID from their bot's recent updates
 */
export async function autoDiscoverTelegramChatId(
  botToken: string
): Promise<{ ok: boolean; chatId?: string; username?: string; error?: string }> {
  const token = botToken.trim();
  if (!token) {
    return { ok: false, error: "আগে Bot Token ঘরে আপনার টোকেনটি পেস্ট করুন।" };
  }

  try {
    const res = await fetch("/api/telegram-get-chat-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botToken: token }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { ok: false, error: err?.message || "সার্ভার সংযোগে সমস্যা হয়েছে।" };
  }
}

/**
 * Sends a test WhatsApp notification via Green-API
 */
export async function sendTestGreenApiAlert(
  idInstance: string,
  apiToken: string,
  phone: string
): Promise<{ ok: boolean; message: string }> {
  const id = idInstance.trim();
  const token = apiToken.trim();
  if (!id || !token) {
    return { ok: false, message: "দয়া করে Green-API IdInstance এবং ApiToken উভয়টি দিন।" };
  }

  const testMsg = [
    `✅ *NextGen Efootball Green-API WhatsApp সফলভাবে সংযুক্ত হয়েছে!*`,
    `এখন থেকে ওয়েবসাইটে যেকোনো অর্ডার আসলে সরাসরি আপনার এই WhatsApp-এ নোটিফিকেশন চলে আসবে।`,
  ].join("\n");

  try {
    const res = await fetch("/api/notify-whatsapp-green", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idInstance: id,
        apiTokenInstance: token,
        phone: phone || "01629802989",
        message: testMsg,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      return { ok: true, message: "✅ Green-API WhatsApp টেস্ট মেসেজ সফলভাবে পৌঁছেছে!" };
    }
    return { ok: false, message: `❌ Green-API ত্রুটি: ${data.error || "মেসেজ পাঠানো যায়নি।"}` };
  } catch (err: any) {
    return { ok: false, message: `❌ নেটওয়ার্ক সমস্যা: ${err?.message || "ব্যর্থ হয়েছে"}` };
  }
}

/**
 * Sends a test Telegram notification so the Admin can verify their Bot Token and Chat ID
 */
export async function sendTestTelegramAlert(
  botToken: string,
  chatId: string
): Promise<{ ok: boolean; message: string }> {
  const token = botToken.trim();
  const chat = chatId.trim();
  if (!token || !chat) {
    return {
      ok: false,
      message: "দয়া করে টেলিগ্রাম Bot Token এবং Chat ID উভয় তথ্যই প্রদান করুন।",
    };
  }

  const testMsg = [
    `✅ <b>NextGen Efootball টেলিগ্রাম অর্ডার বট সফলভাবে সংযুক্ত হয়েছে!</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    `🎉 এখন থেকে ওয়েবসাইটে যেকোনো গ্রাহক অর্ডার করলেই সাথে সাথে আপনার এই টেলিগ্রামে সব তথ্য (আইডি, পাসওয়ার্ড, পেমেন্ট নাম্বার) চলে আসবে!`,
    `⚡ <i>Telegram Bot কোনো সার্ভার জ্যাম ছাড়াই ১০০% নিখুঁতভাবে ইনস্ট্যান্ট মেসেজ ডেলিভার করে।</i>`,
  ].join("\n");

  try {
    const res = await fetch("/api/notify-telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        botToken: token,
        chatId: chat,
        message: testMsg,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      return { ok: true, message: "✅ সফল হয়েছে! আপনার টেলিগ্রাম বটে টেস্ট মেসেজ পৌঁছেছে।" };
    }
    return {
      ok: false,
      message: `❌ টেলিগ্রাম পাঠাতে ত্রুটি: ${data.error || "Bot Token অথবা Chat ID ভুল হতে পারে।"}`,
    };
  } catch (err: any) {
    return { ok: false, message: `❌ নেটওয়ার্ক ত্রুটি: ${err?.message || "সার্ভার সংযোগে সমস্যা।"}` };
  }
}

/**
 * Sends a test Discord Webhook notification
 */
export async function sendTestDiscordAlert(
  webhookUrl: string
): Promise<{ ok: boolean; message: string }> {
  const url = webhookUrl.trim();
  if (!url || !url.startsWith("http")) {
    return { ok: false, message: "দয়া করে সঠিক Discord Webhook URL দিন।" };
  }

  const msg = `✅ **NextGen Efootball Discord অ্যালার্ট সফলভাবে কানেক্ট হয়েছে!**\nএখন থেকে নতুন অর্ডার আসলে এই চ্যানেলে মেসেজ আসবে।`;
  try {
    const res = await fetch("/api/notify-discord", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ webhookUrl: url, message: msg }),
    });
    const data = await res.json();
    if (data.ok) {
      return { ok: true, message: "✅ Discord চ্যানেলে টেস্ট মেসেজ সফলভাবে গিয়েছে!" };
    }
    return { ok: false, message: `❌ Discord ত্রুটি: ${data.error || "Webhook কাজ করছে না।"}` };
  } catch (err: any) {
    return { ok: false, message: `❌ নেটওয়ার্ক ত্রুটি: ${err?.message || "ব্যর্থ হয়েছে"}` };
  }
}

/**
 * Sends a test Admin Email notification
 */
export async function sendTestAdminEmailAlert(
  adminEmail: string
): Promise<{ ok: boolean; message: string }> {
  const email = adminEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, message: "দয়া করে সঠিক জিমেইল অ্যাড্রেস দিন।" };
  }

  try {
    const res = await fetch("/api/notify-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderNo: `TEST-${Date.now().toString(36).toUpperCase()}`,
        recipientEmail: email,
        customerName: "অ্যাডমিন",
        eventType: "order_created",
        subject: `🔔 টেস্ট অর্ডার অ্যালার্ট - NextGen Efootball`,
        html: `<div style="font-family:sans-serif;padding:20px;background:#0f172a;color:#f8fafc;border-radius:12px;"><h2 style="color:#38bdf8;">✅ টেস্ট ইমেইল অ্যালার্ট সফল!</h2><p>আপনার অ্যাডমিন ইমেইল (${email}) এ নতুন অর্ডারের সব নোটিফিকেশন সুন্দরভাবে পৌঁছাবে।</p></div>`,
        text: `টেস্ট ইমেইল অ্যালার্ট সফল হয়েছে! আপনার অ্যাডমিন ইমেইল: ${email}`,
        idempotencyKey: `test_admin_${Date.now()}`,
        forceRetry: true,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      return { ok: true, message: `✅ আপনার জিমেইলে (${email}) টেস্ট ইমেইল পাঠানো হয়েছে! ইনবক্স চেক করুন।` };
    }
    return { ok: false, message: `❌ ইমেইল পাঠাতে ত্রুটি: ${data.error || "সার্ভার রেসপন্স দেয়নি।"}` };
  } catch (err: any) {
    return { ok: false, message: `❌ নেটওয়ার্ক ত্রুটি: ${err?.message || "ব্যর্থ হয়েছে"}` };
  }
}

/**
 * Sends a test WhatsApp message to the Admin's WhatsApp (CallMeBot)
 */
export async function sendTestAutoWhatsappAlert(
  phone: string,
  apiKey: string,
  webhookUrl?: string
): Promise<boolean> {
  const cleanPhone = formatBdWhatsappForUrl(phone || "01629802989");
  const testMsg = [
    `✅ *NextGen Efootball অটোমেটিক WhatsApp বট টেস্ট মেসেজ*`,
    `অর্ডার সংক্রান্ত স্বয়ংক্রিয় মেসেজ টেস্ট সফল হয়েছে।`,
  ].join("\n");

  let sent = false;
  if (cleanPhone && apiKey.trim()) {
    try {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(
        cleanPhone
      )}&text=${encodeURIComponent(testMsg)}&apikey=${encodeURIComponent(apiKey.trim())}`;
      await fetch(url, { method: "GET", mode: "no-cors" });
      sent = true;
    } catch {
      sent = false;
    }
  }

  if (webhookUrl && webhookUrl.trim()) {
    try {
      await fetch(webhookUrl.trim(), {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, text: testMsg, message: testMsg }),
      });
      sent = true;
    } catch {
      // ignore
    }
  }

  return sent;
}

export interface DispatchNotificationResult {
  ok: boolean;
  skippedDuplicate?: boolean;
  deliveryStatus: "sent" | "skipped_duplicate" | "failed";
  recipientEmail: string;
  message: string;
  log?: OrderNotificationLog;
}

/**
 * Core Server-Side Resend Order Status Notification Dispatcher
 * - Verifies order-to-user relationship
 * - Enforces idempotency so the same status change never sends duplicate emails
 * - Calls secure server-side `/api/notify-order` with retry handling
 * - Logs every notification outcome & never breaks order status updates on failure
 */
export async function dispatchOrderStatusNotification(params: {
  order: Order;
  eventType?: OrderNotificationEventType;
  customerEmail?: string;
  forceRetry?: boolean;
  isAdminAuthorized?: boolean;
}): Promise<DispatchNotificationResult> {
  const { order, forceRetry = false } = params;
  const eventType =
    params.eventType || getEventTypeForStatus(order.status, false);
  const settings = getShopSettings();

  // 1. Find linked user account & securely verify relationship
  const regUsers = getRegisteredUsers();
  const linkedUser =
    regUsers.find(
      (u) =>
        (order.userId && u.id === order.userId) ||
        verifyOrderUserRelationship(order, u).verified
    ) || null;

  const targetEmail = resolveOrderRecipientEmail(
    order,
    params.customerEmail || linkedUser?.email
  );

  console.log(`[EmailDebug] Resolving recipient email for order #${order.orderNo} [eventType: ${eventType}]:`, {
    orderCustomerEmail: order.customerEmail,
    orderKonamiIdOrEmail: order.konamiIdOrEmail,
    orderPaymentLinkGmail: order.paymentLinkGmail,
    paramCustomerEmail: params.customerEmail,
    linkedUserEmail: linkedUser?.email,
    resolvedTargetEmail: targetEmail,
  });

  const idempotencyKey = generateNotificationIdempotencyKey(
    order.orderNo,
    eventType
  );

  const template = buildOrderNotificationTemplate(
    order,
    eventType,
    settings.siteName || "NextGen Efootball"
  );

  // If no valid email is associated with this order/account, record a graceful log entry
  if (!targetEmail) {
    const noEmailLog: OrderNotificationLog = {
      id: `nlog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      idempotencyKey,
      orderNo: order.orderNo,
      userId: linkedUser?.id || order.userId,
      recipientEmail: "ইমেইল যুক্ত নেই",
      eventType,
      orderStatus: order.status,
      subject: template.subject,
      messagePreview: template.headline,
      deliveryStatus: "failed",
      provider: "resend",
      attempts: 0,
      errorMessage: "এই অর্ডারের সাথে কোনো ভ্যালিড ইমেইল অ্যাড্রেস পাওয়া যায়নি।",
      timestamp: new Date().toISOString(),
    };
    saveNotificationLog(noEmailLog);
    return {
      ok: false,
      deliveryStatus: "failed",
      recipientEmail: "",
      message: "অর্ডার স্ট্যাটাস আপডেট হয়েছে (ইউজারের ইমেইল না থাকায় ইমেইল স্কিপ করা হয়েছে)।",
      log: noEmailLog,
    };
  }

  // 2. Check Client-Side Idempotency Log (unless forceRetry is true)
  if (!forceRetry) {
    const existingSent = hasSentNotificationForKey(idempotencyKey);
    if (existingSent) {
      const dupLog: OrderNotificationLog = {
        ...existingSent,
        id: `nlog_${Date.now()}_dup`,
        deliveryStatus: "skipped_duplicate",
        timestamp: new Date().toISOString(),
      };
      saveNotificationLog(dupLog);
      return {
        ok: true,
        skippedDuplicate: true,
        deliveryStatus: "skipped_duplicate",
        recipientEmail: targetEmail,
        message: `একই স্ট্যাটাসের (${template.statusBadgeText}) ইমেইল ইতিমধ্যে ${targetEmail}-এ পাঠানো হয়েছে (ডুপ্লিকেট ইমেইল রোধ করা হয়েছে)।`,
        log: dupLog,
      };
    }
  }

  // 3. Verify Admin Authorization for status changes
  const adminAuth =
    params.isAdminAuthorized !== undefined
      ? params.isAdminAuthorized
      : isAdminSessionAuthorized();

  // 4. Call Server-Side Vercel / Express Function `/api/notify-order` with client-side network retry
  let lastError = "";
  let totalAttempts = 0;

  for (let netAttempt = 1; netAttempt <= 2; netAttempt++) {
    totalAttempts = netAttempt;
    try {
      const response = await fetch("/api/notify-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-authorized": adminAuth ? "true" : "false",
        },
        body: JSON.stringify({
          orderNo: order.orderNo,
          recipientEmail: targetEmail,
          customerName: order.name,
          eventType,
          orderStatus: order.status,
          subject: template.subject,
          html: template.html,
          text: template.bodyText,
          idempotencyKey,
          forceRetry,
          adminAuthorized: adminAuth,
        }),
      });

      const data = await response.json();
      const logEntry: OrderNotificationLog = {
        id: `nlog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        idempotencyKey,
        orderNo: order.orderNo,
        userId: linkedUser?.id || order.userId,
        recipientEmail: targetEmail,
        eventType,
        orderStatus: order.status,
        subject: template.subject,
        messagePreview: template.headline,
        deliveryStatus: data.deliveryStatus || (data.ok ? "sent" : "failed"),
        provider: data.provider || "resend",
        providerMessageId: data.providerMessageId,
        attempts: data.attempts || totalAttempts,
        errorMessage: data.error,
        timestamp: data.timestamp || new Date().toISOString(),
      };

      saveNotificationLog(logEntry);

      return {
        ok: Boolean(data.ok),
        skippedDuplicate: data.deliveryStatus === "skipped_duplicate",
        deliveryStatus: logEntry.deliveryStatus,
        recipientEmail: targetEmail,
        message:
          data.message ||
          (data.ok
            ? `ইমেইল নোটিফিকেশন (${targetEmail}) সফলভাবে পাঠানো হয়েছে!`
            : "ইমেইল পাঠাতে সমস্যা হলেও অর্ডার স্ট্যাটাস সফলভাবে আপডেট হয়েছে।"),
        log: logEntry,
      };
    } catch (err: any) {
      lastError = err?.message || "Server notification endpoint unreachable";
    }
  }

  // 5. Fault-isolated failure log (order status remains intact)
  const failedLog: OrderNotificationLog = {
    id: `nlog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    idempotencyKey,
    orderNo: order.orderNo,
    userId: linkedUser?.id || order.userId,
    recipientEmail: targetEmail,
    eventType,
    orderStatus: order.status,
    subject: template.subject,
    messagePreview: template.headline,
    deliveryStatus: "failed",
    provider: "resend",
    attempts: totalAttempts,
    errorMessage: lastError,
    timestamp: new Date().toISOString(),
  };
  saveNotificationLog(failedLog);

  return {
    ok: false,
    deliveryStatus: "failed",
    recipientEmail: targetEmail,
    message: `ইমেইল পাঠানো যায়নি (${lastError}), কিন্তু অর্ডার স্ট্যাটাস নিরাপদে সংরক্ষিত হয়েছে।`,
    log: failedLog,
  };
}

/**
 * Sends a verification code email to the customer's email address via server-side `/api/notify-order`
 * (Resend API) with automatic real-email backup if Resend API key is not yet configured.
 */
export async function sendCustomerVerificationEmail(
  customerEmail: string,
  customerName: string,
  code: string
): Promise<boolean> {
  const cleanEmail = customerEmail.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) return false;
  try {
    const res = await fetch("/api/notify-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderNo: `VERIFY-${Date.now().toString(36).toUpperCase()}`,
        recipientEmail: cleanEmail,
        customerName: customerName || "গ্রাহক",
        eventType: "email_verification",
        subject: `🔐 NextGen Efootball ইমেইল ভেরিফিকেশন কোড`,
        html: `<div style="font-family:sans-serif;padding:24px;background:#0f172a;color:#f8fafc;border-radius:16px;max-width:480px;margin:0 auto;"><h2 style="color:#38bdf8;margin-top:0;">ইমেইল ভেরিফিকেশন কোড</h2><p>প্রিয় ${customerName || "গ্রাহক"}, আপনার NextGen Efootball অ্যাকাউন্ট ভেরিফাই করার ৬-ডিজিটের গোপন কোড নিচে দেওয়া হলো:</p><div style="font-size:28px;font-weight:900;letter-spacing:6px;padding:14px 20px;background:#090f1f;color:#34d399;border:1px solid #1e293b;border-radius:12px;text-align:center;font-family:monospace;">${code}</div><p style="font-size:12px;color:#94a3b8;margin-top:16px;">নিরাপত্তার স্বার্থে এই কোডটি অন্য কারো সাথে শেয়ার করবেন না।</p></div>`,
        text: `আপনার NextGen Efootball ইমেইল ভেরিফিকেশন কোড হলো: ${code}`,
        idempotencyKey: `verify_${cleanEmail}_${Date.now()}`,
        forceRetry: true,
      }),
    });
    const data = await res.json();
    return Boolean(data.ok);
  } catch (err) {
    console.warn("Customer verification email error:", err);
    return false;
  }
}

/**
 * Sends an automated confirmation email to the customer when an order is created
 */
export async function sendCustomerOrderPlacedEmail(
  order: Order,
  customerEmail?: string
): Promise<boolean> {
  const res = await dispatchOrderStatusNotification({
    order,
    eventType: "order_created",
    customerEmail,
    isAdminAuthorized: false,
  });
  return res.ok;
}

/**
 * Sends an automated completion email to the customer when the Admin marks the order as Completed
 */
export async function sendCustomerOrderCompletedEmail(
  order: Order,
  customerEmail?: string
): Promise<boolean> {
  const res = await dispatchOrderStatusNotification({
    order,
    eventType: "status_completed",
    customerEmail,
    isAdminAuthorized: true,
  });
  return res.ok;
}
