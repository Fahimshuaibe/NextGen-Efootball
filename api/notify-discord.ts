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
      error: "Method Not Allowed. Use POST /api/notify-discord",
    });
  }

  try {
    const payload =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { webhookUrl, message } = payload;

    if (!webhookUrl || !message) {
      return res.status(400).json({
        ok: false,
        error: "Missing webhookUrl or message",
      });
    }

    const discordRes = await fetch(String(webhookUrl).trim(), {
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
    return res.status(200).json({
      ok: false,
      error: err?.message || "Failed to reach Discord servers",
    });
  }
}
