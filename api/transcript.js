export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { bot_id } = req.query || {};
  if (!bot_id) return res.status(400).json({ error: "bot_id is required" });

  try {
    const REGION = process.env.RECALL_REGION;
    const API_KEY = process.env.RECALL_API_KEY;
    const BASE = `https://${REGION}.recall.ai/api/v1`;

    const r = await fetch(`${BASE}/bot/${bot_id}/transcript/`, {
      headers: { "Authorization": `Token ${API_KEY}` }
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: "Failed to fetch transcript", details: text });
    }

    const data = await r.json();
    const text = (data?.utterances || [])
      .map(u => (u.speaker ? `${u.speaker}: ${u.text}` : u.text))
      .join("\n");

    return res.status(200).json({ success: true, transcript: text || "" });
  } catch (err) {
    return res.status(500).json({ error: "Internal error", message: err.message });
  }
}
