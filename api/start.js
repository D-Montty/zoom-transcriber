// api/start.js
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
    if (!REGION || !API_KEY) {
      return res.status(500).json({ error: "Missing RECALL_REGION or RECALL_API_KEY env vars" });
    }

    const BASE = `https://${REGION}.recall.ai/api/v1`;

    // Public URL so Recall can POST webhook events.
    // Set PUBLIC_BASE_URL in Vercel, e.g., https://your-app.vercel.app
    const publicBase = process.env.PUBLIC_BASE_URL;
    let webhookUrl = null;
    if (publicBase && /^https?:\/\//i.test(publicBase)) {
      webhookUrl = `${publicBase.replace(/\/+$/, "")}/api/recall/transcript`;
    } else if (req.headers?.host && !/^localhost|127\.0\.0\.1/.test(req.headers.host)) {
      webhookUrl = `https://${req.headers.host}/api/recall/transcript`;
    }

    const payload = {
      meeting_url: zoom_url,
      name: display_name || "Sales Notetaker",
      // Per docs: enable real-time transcription via recallai_streaming
      recording_config: {
        transcript: {
          provider: { recallai_streaming: {} }
        },
        ...(webhookUrl
          ? {
              realtime_endpoints: [
                {
                  type: "webhook",
                  url: webhookUrl,
                  // stream both partial and finalized chunks
                  events: ["transcript.partial_data", "transcript.data"]
                }
              ]
            }
          : {})
      }
    };

    const resp = await fetch(`${BASE}/bot/`, {
      method: "POST",
      headers: {
        "Authorization": `Token ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const details = await resp.text();
      return res.status(resp.status).json({ error: "Failed to create bot", details });
    }

    const data = await resp.json(); // includes data.id
    return res.status(200).json({
      success: true,
      bot_id: data.id,
      message: "Bot is joining. If Zoom prompts, click 'Admit'."
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal error", message: err.message });
  }
}
