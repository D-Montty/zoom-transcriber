export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { zoom_url, display_name } = req.body || {};
    if (!zoom_url) return res.status(400).json({ error: "zoom_url is required" });

    const REGION = process.env.RECALL_REGION;      // e.g. "us-east-1"
    const API_KEY = process.env.RECALL_API_KEY;
    const BASE = `https://${REGION}.recall.ai/api/v1`;

    // Create Bot with REAL-TIME transcription enabled
    // "prioritize_low_latency" gives snappier live updates (English).
    const create = await fetch(`${BASE}/bot/`, {
      method: "POST",
      headers: {
        "Authorization": `Token ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        meeting_url: zoom_url,
        name: display_name || "Sales Notetaker",
        transcription_options: {
          provider: "recallai",
          mode: "prioritize_low_latency",
          language_code: "en"
        }
      })
    });

    if (!create.ok) {
      const text = await create.text();
      return res.status(create.status).json({ error: "Failed to create bot", details: text });
    }

    const data = await create.json(); // contains data.id (bot_id)
    return res.status(200).json({
      success: true,
      bot_id: data.id,
      message: "Bot is joining. If Zoom prompts, click 'Admit'."
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal error", message: err.message });
  }
}
