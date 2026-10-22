import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { processOrderNotificationRequest } from "./api/notify-order";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "2mb" }));

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
