import express from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { processOrderNotificationRequest } from "./api/notify-order";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, ".data");
const STATE_FILE = path.join(DATA_DIR, "store-state.json");

interface PersistedStateMap {
  [key: string]: {
    payloadJson: string;
    updatedAt: string;
  };
}

function readServerStateFromDisk(): PersistedStateMap {
  try {
    if (!fs.existsSync(STATE_FILE)) return {};
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    console.warn("Failed to read server state file:", err);
    return {};
  }
}

function writeServerStateToDisk(state: PersistedStateMap): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.warn("Failed to write server state file:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "10mb" }));

  // Persistent Server-Side State Sync Endpoints (ensures data never resets on browser refresh)
  app.get("/api/state", (_req, res) => {
    const state = readServerStateFromDisk();
    res.json({
      ok: true,
      state,
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/api/state", (req, res) => {
    try {
      const { key, payloadJson, updatedAt, bulk } = req.body || {};
      const current = readServerStateFromDisk();

      if (bulk && typeof bulk === "object") {
        for (const [k, v] of Object.entries(bulk)) {
          if (v && typeof (v as any).payloadJson === "string") {
            current[k] = {
              payloadJson: (v as any).payloadJson,
              updatedAt: (v as any).updatedAt || new Date().toISOString(),
            };
          }
        }
        writeServerStateToDisk(current);
        return res.json({ ok: true, count: Object.keys(bulk).length });
      }

      if (!key || typeof payloadJson !== "string") {
        return res.status(400).json({ ok: false, error: "Missing key or payloadJson" });
      }

      current[String(key)] = {
        payloadJson,
        updatedAt: updatedAt || new Date().toISOString(),
      };
      writeServerStateToDisk(current);
      return res.json({ ok: true, key, updatedAt: current[String(key)].updatedAt });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err?.message || "Failed to persist state" });
    }
  });

  // Health & configuration check endpoint (never exposes secrets)
  app.get("/api/notification-health", (_req, res) => {
    const rawKey = (process.env.RESEND_API_KEY || "").trim();
    const resendConfigured =
      Boolean(rawKey) &&
      !rawKey.startsWith("re_xxxxxxxxx") &&
      rawKey !== "MY_RESEND_API_KEY";

    res.json({
      ok: true,
      service: "NextGen Efootball Notification Engine",
      resendConfigured,
      fromEmail:
        (process.env.RESEND_FROM_EMAIL || "").trim() ||
        "NextGen Efootball <noreply@nextgenefootball.store>",
      timestamp: new Date().toISOString(),
    });
  });

  // Server-side Resend Order Notification Route (matches Vercel /api/notify-order)
  app.post("/api/notify-order", async (req, res) => {
    try {
      const result = await processOrderNotificationRequest(
        req.body || {},
        req.headers as Record<string, string | string[] | undefined>
      );
      res.status(result.httpStatus).json(result.body);
    } catch (err: any) {
      res.status(200).json({
        ok: false,
        deliveryStatus: "failed",
        provider: "resend",
        idempotencyKey: "unknown",
        attempts: 1,
        message: "সার্ভার ইমেইল প্রসেসিং ত্রুটি, তবে অর্ডার স্ট্যাটাস অক্ষুণ্ণ রয়েছে।",
        error: err?.message || "Unexpected server error",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Server-side Telegram Notification Proxy (no CORS, reliable delivery)
  app.post("/api/notify-telegram", async (req, res) => {
    try {
      const { botToken, chatId, message } = req.body || {};
      if (!botToken || !chatId || !message) {
        return res.status(400).json({
          ok: false,
          error: "Missing botToken, chatId, or message",
        });
      }

      // Try sending with HTML formatting first
      let tgRes = await fetch(
        `https://api.telegram.org/bot${encodeURIComponent(botToken.trim())}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId.trim(),
            text: message,
            parse_mode: "HTML",
          }),
        }
      );

      let data = await tgRes.json();

      // If HTML parse error occurred, retry without parse_mode
      if (!data.ok) {
        tgRes = await fetch(
          `https://api.telegram.org/bot${encodeURIComponent(botToken.trim())}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId.trim(),
              text: message,
            }),
          }
        );
        data = await tgRes.json();
      }

      if (data.ok) {
        return res.json({ ok: true, message: "Telegram notification sent successfully", data });
      } else {
        return res.status(200).json({
          ok: false,
          error: data.description || "Telegram API rejected the request",
        });
      }
    } catch (err: any) {
      console.warn("Telegram proxy error:", err);
      res.status(200).json({
        ok: false,
        error: err?.message || "Failed to reach Telegram servers",
      });
    }
  });

  // Server-side Discord Notification Proxy
  app.post("/api/notify-discord", async (req, res) => {
    try {
      const { webhookUrl, message } = req.body || {};
      if (!webhookUrl || !message) {
        return res.status(400).json({
          ok: false,
          error: "Missing webhookUrl or message",
        });
      }

      const discordRes = await fetch(webhookUrl.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: message,
        }),
      });

      if (discordRes.ok) {
        return res.json({ ok: true, message: "Discord notification sent" });
      } else {
        return res.status(200).json({
          ok: false,
          error: `Discord webhook failed with status ${discordRes.status}`,
        });
      }
    } catch (err: any) {
      console.warn("Discord proxy error:", err);
      res.status(200).json({
        ok: false,
        error: err?.message || "Failed to reach Discord servers",
      });
    }
  });

  // Auto-detect Telegram Chat ID from Bot Updates
  app.post("/api/telegram-get-chat-id", async (req, res) => {
    try {
      const { botToken } = req.body || {};
      if (!botToken || !botToken.trim()) {
        return res.status(400).json({ ok: false, error: "Bot Token প্রদান করা আবশ্যক।" });
      }

      const updatesRes = await fetch(
        `https://api.telegram.org/bot${encodeURIComponent(botToken.trim())}/getUpdates?limit=15`
      );
      const data = await updatesRes.json();

      if (!data.ok) {
        return res.status(200).json({
          ok: false,
          error: data.description || "টেলিগ্রাম Bot Token সঠিক নয়। দয়া করে সঠিক টোকেন দিন।",
        });
      }

      const updates = data.result || [];
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(200).json({
          ok: false,
          noMessages: true,
          error: "আপনার বটে এখনো কোনো মেসেজ পাওয়া যায়নি। দয়া করে টেলিগ্রামে গিয়ে আপনার তৈরি করা বটে ঢুকুন এবং 'Start' বাটনে চাপ দিন (অথবা 'Hi' লিখে মেসেজ পাঠান)। তারপর এই বাটনে আবার চাপুন।",
        });
      }

      // Find the last message with a chat id
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
        return res.status(200).json({
          ok: false,
          error: "চ্যাট আইডি পাওয়া যায়নি। দয়া করে বটে একটি মেসেজ পাঠিয়ে আবার চেষ্টা করুন।",
        });
      }

      const displayName =
        lastChat.first_name || lastChat.username || lastChat.title || "User";

      return res.json({
        ok: true,
        chatId: String(lastChat.id),
        username: displayName,
      });
    } catch (err: any) {
      console.warn("Telegram getUpdates error:", err);
      res.status(500).json({
        ok: false,
        error: err?.message || "সার্ভার থেকে টেলিগ্রামের সংযোগে সমস্যা হয়েছে।",
      });
    }
  });

  // Server-side Green-API (WhatsApp Alternative Gateway)
  app.post("/api/notify-whatsapp-green", async (req, res) => {
    try {
      const { idInstance, apiTokenInstance, phone, message } = req.body || {};
      if (!idInstance || !apiTokenInstance || !message) {
        return res.status(400).json({
          ok: false,
          error: "Missing idInstance, apiTokenInstance, or message",
        });
      }

      let targetChatId = "";
      const rawTarget = String(phone || "01629802989").trim();
      if (rawTarget.includes("@g.us") || rawTarget.includes("@c.us")) {
        targetChatId = rawTarget;
      } else {
        let cleanPhone = rawTarget.replace(/\D/g, "");
        if (cleanPhone.startsWith("01")) {
          cleanPhone = "88" + cleanPhone;
        }
        targetChatId = `${cleanPhone}@c.us`;
      }

      const url = `https://api.green-api.com/waInstance${encodeURIComponent(
        idInstance.trim()
      )}/sendMessage/${encodeURIComponent(apiTokenInstance.trim())}`;

      const greenRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: targetChatId,
          message,
        }),
      });

      const data = await greenRes.json().catch(() => ({}));
      if (greenRes.ok && data.idMessage) {
        return res.json({ ok: true, data });
      } else {
        let errorMsg = data.message || "Green-API বার্তা পাঠাতে পারেনি।";
        if (greenRes.status === 401 || greenRes.status === 403) {
          errorMsg = "Green-API IdInstance অথবা ApiTokenInstance ভুল হতে পারে। সঠিক ক্রেডেনশিয়াল দিন।";
        }
        return res.status(200).json({
          ok: false,
          error: errorMsg,
        });
      }
    } catch (err: any) {
      console.warn("Green-API proxy error:", err);
      res.status(500).json({
        ok: false,
        error: err?.message || "Green-API সার্ভারে পৌঁছাতে সমস্যা হয়েছে।",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`NextGen Efootball server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
