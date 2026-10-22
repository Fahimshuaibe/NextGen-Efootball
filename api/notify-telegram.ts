export default async function handler(req: any, res: any) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method Not Allowed. Use POST /api/notify-telegram",
    });
  }

  try {
    const payload =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { botToken, chatId, message } = payload;

    if (!botToken || !chatId || !message) {
      return res.status(400).json({
        ok: false,
        error: "Missing botToken, chatId, or message",
      });
    }

    const cleanToken = String(botToken).trim();
    const cleanChatId = String(chatId).trim();

    // 1. Try sending with HTML formatting first
    let tgRes = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(cleanToken)}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );

    let data = await tgRes.json().catch(() => ({}));

    // If HTML parse error occurred, retry without parse_mode
    if (!data.ok) {
      tgRes = await fetch(
        `https://api.telegram.org/bot${encodeURIComponent(cleanToken)}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: cleanChatId,
            text: message,
          }),
        }
      );
      data = await tgRes.json().catch(() => ({}));
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
    return res.status(200).json({
      ok: false,
      error: err?.message || "Failed to reach Telegram servers",
    });
  }
}
