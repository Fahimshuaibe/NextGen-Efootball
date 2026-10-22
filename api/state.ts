// Vercel Serverless Function fallback for /api/state (works alongside Firebase Firestore & local server.ts)
let memoryStoreState: Record<string, any> = {};

function unwrapPayload(val: any): any {
  if (val && typeof val === "object" && !Array.isArray(val) && typeof val.payloadJson === "string") {
    try {
      return JSON.parse(val.payloadJson);
    } catch {
      return val;
    }
  }
  return val;
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    const cleanState: Record<string, any> = {};
    for (const [k, v] of Object.entries(memoryStoreState)) {
      cleanState[k] = unwrapPayload(v);
    }
    return res.status(200).json({ ok: true, state: cleanState });
  }

  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      if (body && typeof body.key === "string") {
        memoryStoreState[body.key] = unwrapPayload(body.value);
      } else if (body && body.entries && typeof body.entries === "object") {
        for (const [k, v] of Object.entries(body.entries)) {
          memoryStoreState[k] = unwrapPayload(v);
        }
      }
      return res.status(200).json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e?.message || "Failed to save state" });
    }
  }

  return res.status(405).json({ ok: false, error: "Method Not Allowed" });
}
