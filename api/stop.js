export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { bot_id } = req.body || {};
    if (!bot_id) return res.status(400).json({ error: "bot_id is required" });

    const REGION = process.env.RECALL_REGION;
    const API_KEY = process.env.RECALL_API_KEY;
    const BASE = `https://${REGION}.recall.ai/api/v1`;

    // Tell bot to leave immediately
    const stop = await fetch(`${BASE}/bot/${bot_id}/leave_call/`, {
      method: "POST",
      headers: { "Authorization": `Token ${API_KEY}` }
    });

    if (!stop.ok) {
      const text = await stop.text();
      return res.status(stop.status).json({ error: "Failed to stop bot", details: text });
    }

    // Fetch the final transcript once more
    const r = await fetch(`${BASE}/bot/${bot_id}/transcript/`, {
      headers: { "Authorization": `Token ${API_KEY}` }
    });

    let finalText = "";
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data)) {
        finalText = data.map(block => {
          const line = (block.words || []).map(w => w.text).join(" ");
          return block.speaker ? `${block.speaker}: ${line}` : line;
        }).join("\n");
      } else if (data?.utterances) {
        finalText = data.utterances.map(u =>
          (u.speaker ? `${u.speaker}: ${u.text}` : u.text)
        ).join("\n");
      }
    }

    return res.status(200).json({
      success: true,
      message: "Recording stopped",
      transcript: finalText || ""
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal error", message: err.message });
  }
}
