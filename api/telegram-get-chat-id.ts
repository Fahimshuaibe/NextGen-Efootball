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
      error: "Method Not Allowed. Use POST /api/telegram-get-chat-id",
    });
  }

  try {
    const payload =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { botToken } = payload;

    if (!botToken || !String(botToken).trim()) {
      return res.status(400).json({ ok: false, error: "Bot Token প্রদান করা আবশ্যক।" });
    }

    const cleanToken = String(botToken).trim();
    const updatesRes = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(cleanToken)}/getUpdates?limit=15`
    );
    const data = await updatesRes.json().catch(() => ({}));

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
        error:
          "আপনার বটে এখনো কোনো মেসেজ পাওয়া যায়নি। দয়া করে টেলিগ্রামে গিয়ে আপনার তৈরি করা বটে ঢুকুন এবং 'Start' বাটনে চাপ দিন (অথবা 'Hi' লিখে মেসেজ পাঠান)। তারপর এই বাটনে আবার চাপুন।",
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
    return res.status(200).json({
      ok: false,
      error: err?.message || "সার্ভার থেকে টেলিগ্রামের সংযোগে সমস্যা হয়েছে।",
    });
  }
}
