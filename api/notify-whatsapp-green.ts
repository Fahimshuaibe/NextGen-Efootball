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
      error: "Method Not Allowed. Use POST /api/notify-whatsapp-green",
    });
  }

  try {
    const payload =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { idInstance, apiTokenInstance, phone, message } = payload;

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

    const cleanId = String(idInstance).trim();
    const cleanToken = String(apiTokenInstance).trim();

    // 1. Check instance state first
    let state = "unknown";
    try {
      const stateRes = await fetch(
        `https://api.green-api.com/waInstance${encodeURIComponent(cleanId)}/getStateInstance/${encodeURIComponent(cleanToken)}`
      );
      if (stateRes.ok) {
        const stateData = await stateRes.json().catch(() => ({}));
        state = stateData.stateInstance || "unknown";
      }
    } catch {
      // ignore state check failure, continue to sendMessage
    }

    if (state === "notAuthorized") {
      return res.status(200).json({
        ok: false,
        stateInstance: state,
        error: "⚠️ Green-API ইনস্ট্যান্সটি WhatsApp-এর সাথে স্ক্যান করা হয়নি! দয়া করে green-api.com ড্যাশবোর্ডে গিয়ে 'QR code' স্ক্যান করুন।",
      });
    }

    const url = `https://api.green-api.com/waInstance${encodeURIComponent(
      cleanId
    )}/sendMessage/${encodeURIComponent(cleanToken)}`;

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
      return res.json({ ok: true, idMessage: data.idMessage, stateInstance: state });
    } else {
      let errorMsg = data.message || "Green-API বার্তা পাঠাতে পারেনি।";
      if (greenRes.status === 401 || greenRes.status === 403) {
        errorMsg = "Green-API IdInstance অথবা ApiTokenInstance ভুল হতে পারে। সঠিক ক্রেডেনশিয়াল দিন।";
      }
      return res.status(200).json({
        ok: false,
        error: errorMsg,
        status: greenRes.status,
      });
    }
  } catch (err: any) {
    return res.status(200).json({
      ok: false,
      error: err?.message || "Green-API সার্ভারে পৌঁছাতে সমস্যা হয়েছে।",
    });
  }
}
