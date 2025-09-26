export default async function handler(req, res) {
  // CORS
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

    // (Optional) get bot state
    const s = await fetch(`${BASE}/bot/${bot_id}/`, {
      headers: { "Authorization": `Token ${API_KEY}` }
    });
    const botInfo = s.ok ? await s.json() : {};
    const state = botInfo.state || botInfo.status || ""; // "joining" | "recording" | "done" ...

    // Get transcript (live if available, final after call)
    const r = await fetch(`${BASE}/bot/${bot_id}/transcript/`, {
      headers: { "Authorization": `Token ${API_KEY}` }
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: "Failed to fetch transcript", details: text, state });
    }

    const data = await r.json();

    // Flexible parsing: array-of-blocks-with-words OR { utterances: [] }
    const flatten = (payload) => {
      if (Array.isArray(payload)) {
        return payload.map(block => {
          const line = (block.words || []).map(w => w.text).join(" ");
          return block.speaker ? `${block.speaker}: ${line}` : line;
        }).join("\n");
      }
      if (payload?.utterances) {
        return payload.utterances.map(u =>
          (u.speaker ? `${u.speaker}: ${u.text}` : u.text)
        ).join("\n");
      }
      return "";
    };

    const text = flatten(data);
    const ready = !!text && text.trim().length > 0;

    return res.status(200).json({
      success: true,
      state,
      ready,
      transcript: text || ""
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal error", message: err.message });
  }
}
