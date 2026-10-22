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

async function parseResponseSafely(
  res: Response
): Promise<{ ok: boolean; data?: any; isHtmlOr404?: boolean }> {
  try {
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("json") || res.status === 404) {
      return { ok: false, isHtmlOr404: true };
    }
    const data = await res.json();
    return { ok: res.ok, data };
  } catch {
    return { ok: false, isHtmlOr404: true };
  }
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
    const botToken = settings.telegramBotToken.trim();
    const chatId = settings.telegramChatId.trim();

    try {
      // First try server-side proxy route
      const res = await fetch("/api/notify-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken,
          chatId,
          message: tgHtmlMessage,
        }),
      });
      const parsed = await parseResponseSafely(res);
      if (parsed.data?.ok) {
        telegramSent = true;
      } else {
        // Direct browser fallback to Telegram Bot API
        const directUrl = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`;
        const directRes = await fetch(directUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: tgHtmlMessage,
            parse_mode: "HTML",
          }),
        });
        const directData = await directRes.json().catch(() => ({}));
        if (directData.ok) {
          telegramSent = true;
        } else {
          // Retry without HTML parse mode if tags fail
          const retryRes = await fetch(directUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: message,
            }),
          });
          const retryData = await retryRes.json().catch(() => ({}));
          if (retryData.ok) telegramSent = true;
        }

        // Fallback 3: Proxy via allorigins to bypass Bangladesh ISP block if direct fetch failed
        if (!telegramSent) {
          try {
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
              `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${encodeURIComponent(chatId)}&text=${encodeURIComponent(message)}`
            )}`;
            const pRes = await fetch(proxyUrl);
            const pData = await pRes.json().catch(() => ({}));
            if (pData.ok) telegramSent = true;
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      console.warn("Auto Telegram alert error:", err);
    }
  }

  // 2. Admin Gmail Notification: Disabled as Telegram and WhatsApp are connected for instant sound alerts.
  // Customer/User Gmail order receipts remain 100% active via dispatchOrderStatusNotification.
  emailSent = false;

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
      const parsed = await parseResponseSafely(res);
      if (parsed.data?.ok) {
        discordSent = true;
      } else {
        // Direct browser fallback
        await fetch(settings.discordWebhookUrl.trim(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: discordMsg }),
        }).catch(() => {});
        discordSent = true;
      }
    } catch (err) {
      console.warn("Discord alert error:", err);
    }
  }

  // 4. WhatsApp Option A: Green-API (Dedicated WhatsApp Gateway)
  if (settings.greenApiIdInstance?.trim() && settings.greenApiApiToken?.trim()) {
    const greenId = settings.greenApiIdInstance.trim();
    const greenToken = settings.greenApiApiToken.trim();
    let targetChatId = "";
    const rawTarget = String(settings.autoWhatsappPhone || settings.whatsapp || "01629802989").trim();
    if (rawTarget.includes("@g.us") || rawTarget.includes("@c.us")) {
      targetChatId = rawTarget;
    } else {
      let cleanPhone = rawTarget.replace(/\D/g, "");
      if (cleanPhone.startsWith("01")) cleanPhone = "88" + cleanPhone;
      targetChatId = `${cleanPhone}@c.us`;
    }

    try {
      const res = await fetch("/api/notify-whatsapp-green", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idInstance: greenId,
          apiTokenInstance: greenToken,
          phone: targetChatId,
          message,
        }),
      });
      const parsed = await parseResponseSafely(res);
      if (parsed.data?.ok) {
        whatsappSent = true;
      } else {
        // Direct browser fallback
        const directRes = await fetch(
          `https://api.green-api.com/waInstance${encodeURIComponent(greenId)}/sendMessage/${encodeURIComponent(greenToken)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chatId: targetChatId,
              message,
            }),
          }
        );
        const directData = await directRes.json().catch(() => ({}));
        if (directRes.ok && directData.idMessage) whatsappSent = true;
      }
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

  // Pre-validate token structure
  const tokenParts = token.split(":");
  if (tokenParts.length !== 2 || !tokenParts[0].match(/^\d+$/)) {
    return {
      ok: false,
      error: "⚠️ Bot Token ফরম্যাট সঠিক নয়। এটি সাধারণত সংখ্যা ও অক্ষরের সমন্বয়ে হয় (যেমন: 1234567890:AAHxxxxxx)।",
    };
  }
  if (tokenParts[1].length < 32) {
    return {
      ok: false,
      error: `⚠️ আপনার Bot Token-টি অসম্পূর্ণ মনে হচ্ছে (কোলনের পর মাত্র ${tokenParts[1].length} অক্ষর, সাধারণত ৩৫ অক্ষর হয়)। @BotFather থেকে পুরো টোকেনটি কপি করুন (শেষে কোনো অক্ষর বাদ পড়েছে)।`,
    };
  }

  // Attempt 1: Try proxy /api/telegram-get-chat-id
  try {
    const res = await fetch("/api/telegram-get-chat-id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botToken: token }),
    });
    const parsed = await parseResponseSafely(res);
    if (!parsed.isHtmlOr404 && parsed.data) {
      return parsed.data;
    }
  } catch {
    // Continue to direct browser fetch
  }

  // Attempt 2: Direct browser call to https://api.telegram.org/bot<TOKEN>/getUpdates
  let directData: any = null;
  try {
    const directRes = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/getUpdates?limit=15`
    );
    directData = await directRes.json().catch(() => ({}));
  } catch (directErr) {
    console.warn("Direct Telegram getUpdates failed (possibly ISP block in BD):", directErr);
  }

  // Attempt 3: Proxy via allorigins to bypass Bangladesh ISP block if direct call failed
  if (!directData) {
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
        `https://api.telegram.org/bot${token}/getUpdates?limit=15`
      )}`;
      const pRes = await fetch(proxyUrl);
      directData = await pRes.json().catch(() => ({}));
    } catch (proxyErr) {
      console.warn("Allorigins proxy getUpdates failed:", proxyErr);
    }
  }

  if (directData) {
    if (!directData.ok) {
      if (directData.error_code === 401) {
        return {
          ok: false,
          error:
            "❌ টেলিগ্রাম Bot Token সঠিক নয় (401 Unauthorized)। @BotFather থেকে দেওয়া আসল ও সম্পূর্ণ টোকেনটি কপি করে পেস্ট করুন।",
        };
      }
      return {
        ok: false,
        error:
          directData.description ||
          "টেলিগ্রাম Bot Token সঠিক নয়। দয়া করে @BotFather থেকে পাওয়া সঠিক টোকেন দিন।",
      };
    }

    const updates = directData.result || [];
    if (!Array.isArray(updates) || updates.length === 0) {
      return {
        ok: false,
        error:
          "আপনার বটে এখনো কোনো মেসেজ পাওয়া যায়নি। দয়া করে টেলিগ্রামে গিয়ে আপনার তৈরি করা বটে ঢুকুন এবং 'Start' বাটনে চাপ দিন (অথবা 'Hi' লিখে মেসেজ পাঠান)। তারপর এই বাটনে আবার চাপুন।",
      };
    }

    let lastChat: any = null;
    for (let i = updates.length - 1; i >= 0; i--) {
      const u = updates[i];
      const msg = u.message || u.edited_message || u.channel_post;
      if (msg && msg.chat) {
        lastChat = msg.chat;
        break;
      }
    }

    if (!lastChat || !lastChat.id) {
      return {
        ok: false,
        error: "চ্যাট আইডি পাওয়া যায়নি। দয়া করে বটে একটি মেসেজ পাঠিয়ে আবার চেষ্টা করুন।",
      };
    }

    const displayName =
      lastChat.first_name || lastChat.username || lastChat.title || "User";

    return {
      ok: true,
      chatId: String(lastChat.id),
      username: displayName,
    };
  }

  return {
    ok: false,
    error:
      "টেলিগ্রাম সার্ভারের সাথে সংযোগ করা যায়নি (Failed to fetch)। আপনার নেটওয়ার্কে Telegram ব্লক থাকলে ফোনের VPN চালু করতে পারেন অথবা Green-API WhatsApp ব্যবহার করতে পারেন।",
  };
}

/**
 * Checks Green-API instance authorization status (whether WhatsApp QR is scanned or not)
 */
export async function checkGreenApiInstanceStatus(
  idInstance: string,
  apiToken: string
): Promise<{ ok: boolean; status: string; message: string }> {
  const id = idInstance.trim();
  const token = apiToken.trim();
  if (!id || !token) {
    return { ok: false, status: "missing", message: "IdInstance এবং ApiToken উভয়টি দিন।" };
  }

  try {
    const res = await fetch(
      `https://api.green-api.com/waInstance${encodeURIComponent(id)}/getStateInstance/${encodeURIComponent(token)}`
    );
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.stateInstance) {
      if (data.stateInstance === "authorized") {
        return {
          ok: true,
          status: "authorized",
          message: "🟢 WhatsApp সফলভাবে সংযুক্ত (Authorized)! মেসেজ আদান-প্রদান করতে প্রস্তুত।",
        };
      } else if (data.stateInstance === "notAuthorized") {
        return {
          ok: false,
          status: "notAuthorized",
          message: "🟡 ইনস্ট্যান্স তৈরি হয়েছে, কিন্তু এখনো WhatsApp দিয়ে QR Code স্ক্যান করা হয়নি। green-api.com এ গিয়ে স্ক্যান করুন।",
        };
      } else {
        return {
          ok: false,
          status: data.stateInstance,
          message: `ইনস্ট্যান্স বর্তমান স্ট্যাটাস: ${data.stateInstance}`,
        };
      }
    } else if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        status: "unauthorized",
        message: "❌ IdInstance অথবা ApiTokenInstance সঠিক নয়। green-api.com ড্যাশবোর্ড থেকে মিলিয়ে পেস্ট করুন।",
      };
    }
    return {
      ok: false,
      status: "error",
      message: data.message || "Green-API স্ট্যাটাস পাওয়া যায়নি।",
    };
  } catch (err: any) {
    return {
      ok: false,
      status: "network_error",
      message: `নেটওয়ার্ক সমস্যা: ${err?.message || "সার্ভারে সংযোগ করা যায়নি"}`,
    };
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

  let targetChatId = "";
  const rawTarget = String(phone || "01629802989").trim();
  if (rawTarget.includes("@g.us") || rawTarget.includes("@c.us")) {
    targetChatId = rawTarget;
  } else {
    let cleanPhone = rawTarget.replace(/\D/g, "");
    if (cleanPhone.startsWith("01")) cleanPhone = "88" + cleanPhone;
    targetChatId = `${cleanPhone}@c.us`;
  }

  const testMsg = [
    `✅ *NextGen Efootball Green-API WhatsApp সফলভাবে সংযুক্ত হয়েছে!*`,
    `এখন থেকে ওয়েবসাইটে যেকোনো অর্ডার আসলে সরাসরি আপনার এই WhatsApp-এ নোটিফিকেশন চলে আসবে।`,
  ].join("\n");

  // Attempt 1: Call serverless endpoint /api/notify-whatsapp-green
  try {
    const res = await fetch("/api/notify-whatsapp-green", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idInstance: id,
        apiTokenInstance: token,
        phone: targetChatId,
        message: testMsg,
      }),
    });

    const parsed = await parseResponseSafely(res);
    if (!parsed.isHtmlOr404 && parsed.data) {
      if (parsed.data.ok) {
        return {
          ok: true,
          message: "✅ Green-API WhatsApp টেস্ট মেসেজ সফলভাবে পৌঁছেছে! আপনার WhatsApp ইনবক্স চেক করুন।",
        };
      }
      return {
        ok: false,
        message: `❌ Green-API ত্রুটি: ${parsed.data.error || "মেসেজ পাঠানো যায়নি।"}`
      };
    }
  } catch {
    // Proceed to direct call fallback
  }

  // Attempt 2: Direct browser call to Green-API REST API
  try {
    // Check instance state first
    try {
      const stateRes = await fetch(
        `https://api.green-api.com/waInstance${encodeURIComponent(id)}/getStateInstance/${encodeURIComponent(token)}`
      );
      if (stateRes.ok) {
        const stateData = await stateRes.json().catch(() => ({}));
        if (stateData.stateInstance === "notAuthorized") {
          return {
            ok: false,
            message:
              "⚠️ আপনার Green-API ইনস্ট্যান্সটি এখনো আপনার WhatsApp অ্যাকাউন্টের সাথে লিংক করা হয়নি! দয়া করে green-api.com ড্যাশবোর্ডে গিয়ে 'QR code' স্ক্যান করে কানেক্ট করুন।",
          };
        }
      } else if (stateRes.status === 401 || stateRes.status === 403) {
        return {
          ok: false,
          message:
            "❌ Green-API IdInstance অথবা ApiTokenInstance সঠিক নয়। green-api.com ড্যাশবোর্ড থেকে মিলিয়ে কপি করুন।",
        };
      }
    } catch {
      // Continue to sendMessage
    }

    const directRes = await fetch(
      `https://api.green-api.com/waInstance${encodeURIComponent(id)}/sendMessage/${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: targetChatId,
          message: testMsg,
        }),
      }
    );

    const directData = await directRes.json().catch(() => ({}));
    if (directRes.ok && directData.idMessage) {
      return {
        ok: true,
        message: "✅ Green-API WhatsApp টেস্ট মেসেজ সফলভাবে পৌঁছেছে! আপনার WhatsApp ইনবক্স চেক করুন।",
      };
    }

    if (directRes.status === 401 || directRes.status === 403) {
      return {
        ok: false,
        message: "❌ Green-API IdInstance বা ApiTokenInstance ভুল। green-api.com ড্যাশবোর্ড থেকে সঠিক তথ্য দিন।",
      };
    }

    return {
      ok: false,
      message: `❌ Green-API ত্রুটি: ${
        directData.message || "মেসেজ পাঠানো যায়নি। Green-API ড্যাশবোর্ডে ইনস্ট্যান্স অ্যাক্টিভ আছে কিনা দেখুন।"
      }`,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: `❌ নেটওয়ার্ক সমস্যা: ${
        err?.message || "সার্ভার বা Green-API এর সাথে সংযোগ করা যাচ্ছে না।"
      }`,
    };
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

  // Pre-validate token structure
  const tokenParts = token.split(":");
  if (tokenParts.length !== 2 || !tokenParts[0].match(/^\d+$/)) {
    return {
      ok: false,
      message: "⚠️ Bot Token ফরম্যাট সঠিক নয়। এটি সাধারণত সংখ্যা ও অক্ষরের সমন্বয়ে হয় (যেমন: 1234567890:AAHxxxxxx)।",
    };
  }
  if (tokenParts[1].length < 32) {
    return {
      ok: false,
      message: `⚠️ আপনার Bot Token-টি অসম্পূর্ণ মনে হচ্ছে (কোলনের পর মাত্র ${tokenParts[1].length} অক্ষর, সাধারণত ৩৫ অক্ষর থাকে)। @BotFather থেকে সম্পূর্ণ টোকেনটি হুবহু কপি করুন (শেষে কোনো অক্ষর বাদ পড়েছে)।`,
    };
  }

  const testMsg = [
    `✅ <b>NextGen Efootball টেলিগ্রাম অর্ডার বট সফলভাবে সংযুক্ত হয়েছে!</b>`,
    `━━━━━━━━━━━━━━━━━━`,
    `🎉 এখন থেকে ওয়েবসাইটে যেকোনো গ্রাহক অর্ডার করলেই সাথে সাথে আপনার এই টেলিগ্রামে সব তথ্য (আইডি, পাসওয়ার্ড, পেমেন্ট নাম্বার) চলে আসবে!`,
    `⚡ <i>Telegram Bot কোনো সার্ভার জ্যাম ছাড়াই ১০০% নিখুঁতভাবে ইনস্ট্যান্ট মেসেজ ডেলিভার করে।</i>`,
  ].join("\n");

  const plainMsg = [
    `✅ NextGen Efootball টেলিগ্রাম অর্ডার বট সফলভাবে সংযুক্ত হয়েছে!`,
    `━━━━━━━━━━━━━━━━━━`,
    `🎉 এখন থেকে ওয়েবসাইটে যেকোনো গ্রাহক অর্ডার করলেই সাথে সাথে আপনার এই টেলিগ্রামে সব তথ্য (আইডি, পাসওয়ার্ড, পেমেন্ট নাম্বার) চলে আসবে!`,
    `⚡ Telegram Bot কোনো সার্ভার জ্যাম ছাড়াই ১০০% নিখুঁতভাবে ইনস্ট্যান্ট মেসেজ ডেলিভার করে।`,
  ].join("\n");

  // Attempt 1: Serverless proxy route /api/notify-telegram
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
    const parsed = await parseResponseSafely(res);
    if (!parsed.isHtmlOr404 && parsed.data) {
      if (parsed.data.ok) {
        return { ok: true, message: "✅ সফল হয়েছে! আপনার টেলিগ্রাম বটে টেস্ট মেসেজ পৌঁছেছে।" };
      }
      return {
        ok: false,
        message: `❌ টেলিগ্রাম পাঠাতে ত্রুটি: ${parsed.data.error || "Bot Token অথবা Chat ID ভুল হতে পারে।"}`,
      };
    }
  } catch {
    // Continue to direct fallback
  }

  // Attempt 2: Direct browser call to Telegram Bot API
  let directData: any = null;
  try {
    let directRes = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chat,
          text: testMsg,
          parse_mode: "HTML",
        }),
      }
    );
    directData = await directRes.json().catch(() => ({}));
    if (!directData.ok) {
      // Retry without HTML parse mode if tags fail
      directRes = await fetch(
        `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chat,
            text: plainMsg,
          }),
        }
      );
      directData = await directRes.json().catch(() => ({}));
    }
  } catch (directErr) {
    console.warn("Direct Telegram call failed (possibly ISP block):", directErr);
  }

  // Attempt 3: Proxy via allorigins to bypass Bangladesh ISP blocking
  if (!directData) {
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
        `https://api.telegram.org/bot${token}/sendMessage?chat_id=${encodeURIComponent(chat)}&text=${encodeURIComponent(plainMsg)}`
      )}`;
      const pRes = await fetch(proxyUrl);
      directData = await pRes.json().catch(() => ({}));
    } catch (proxyErr) {
      console.warn("Allorigins proxy send failed:", proxyErr);
    }
  }

  if (directData) {
    if (directData.ok) {
      return { ok: true, message: "✅ সফল হয়েছে! আপনার টেলিগ্রাম বটে টেস্ট মেসেজ পৌঁছেছে।" };
    }
    if (directData.error_code === 401) {
      return {
        ok: false,
        message: "❌ টেলিগ্রাম Bot Token সঠিক নয় (401 Unauthorized)। @BotFather থেকে প্রাপ্ত আসল ও সম্পূর্ণ টোকেনটি কপি করে পেস্ট করুন।",
      };
    }
    return {
      ok: false,
      message: `❌ টেলিগ্রাম ত্রুটি: ${directData.description || "Bot Token অথবা Chat ID ভুল হতে পারে।"}`,
    };
  }

  return {
    ok: false,
    message: "❌ সংযোগ সমস্যা (Failed to fetch): বাংলাদেশে কিছু ইন্টারনেট প্রোভাইডার Telegram সরাসরি ব্লক করে রাখে। ফোনের VPN চালু করে দেখতে পারেন অথবা Green-API WhatsApp ব্যবহার করতে পারেন।",
  };
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
    const parsed = await parseResponseSafely(res);
    if (!parsed.isHtmlOr404 && parsed.data) {
      if (parsed.data.ok) {
        return { ok: true, message: "✅ Discord চ্যানেলে টেস্ট মেসেজ সফলভাবে গিয়েছে!" };
      }
      return { ok: false, message: `❌ Discord ত্রুটি: ${parsed.data.error || "Webhook কাজ করছে না।"}` };
    }

    // Direct fallback
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: msg }),
    });
    return { ok: true, message: "✅ Discord চ্যানেলে টেস্ট মেসেজ সফলভাবে গিয়েছে!" };
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
    const parsed = await parseResponseSafely(res);
    if (!parsed.isHtmlOr404 && parsed.data) {
      if (parsed.data.ok) {
        return {
          ok: true,
          message: `✅ আপনার জিমেইলে (${email}) টেস্ট ইমেইল পাঠানো হয়েছে! ইনবক্স চেক করুন।`,
        };
      }
      return {
        ok: false,
        message: `❌ ইমেইল পাঠাতে ত্রুটি: ${parsed.data.error || "সার্ভার রেসপন্স দেয়নি।"}`,
      };
    }
    return { ok: false, message: "সার্ভারে ইমেইল গেটওয়ে কনফিগার করা নেই।" };
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
