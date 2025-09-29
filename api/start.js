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
    
    if (!zoom_url) {
      return res.status(400).json({ error: "zoom_url is required" });
    }

    const REGION = process.env.RECALL_REGION;
    const API_KEY = process.env.RECALL_API_KEY;
    
    if (!REGION || !API_KEY) {
      console.error('[START] Missing env vars: RECALL_REGION or RECALL_API_KEY');
      return res.status(500).json({ error: "Missing RECALL_REGION or RECALL_API_KEY env vars" });
    }

    const BASE = `https://${REGION}.recall.ai/api/v1`;

    // Construct webhook URL
    const publicBase = process.env.PUBLIC_BASE_URL;
    let webhookUrl = null;
    
    if (publicBase && /^https?:\/\//i.test(publicBase)) {
      webhookUrl = `${publicBase.replace(/\/+$/, "")}/api/recall/transcript`;
      console.log(`[START] Using PUBLIC_BASE_URL for webhook: ${webhookUrl}`);
    } else if (req.headers?.host && !/^localhost|127\.0\.0\.1/.test(req.headers.host)) {
      webhookUrl = `https://${req.headers.host}/api/recall/transcript`;
      console.log(`[START] Using host header for webhook: ${webhookUrl}`);
    } else {
      console.warn('[START] No valid webhook URL - live transcription will not work!');
      console.warn('[START] Set PUBLIC_BASE_URL env var in Vercel (e.g., https://your-app.vercel.app)');
    }

    const payload = {
      meeting_url: zoom_url,
      name: display_name || "Sales Notetaker",
      recording_config: {
        transcript: {
          provider: { recallai_streaming: {} }
        },
        ...(webhookUrl ? {
          realtime_endpoints: [
            {
              type: "webhook",
              url: webhookUrl,
              events: ["transcript.partial_data", "transcript.data"]
            }
          ]
        } : {})
      }
    };

    console.log(`[START] Creating bot for meeting: ${zoom_url}`);
    console.log(`[START] Webhook URL: ${webhookUrl || 'NONE - Live transcript disabled'}`);
    console.log(`[START] Payload:`, JSON.stringify(payload, null, 2));

    const resp = await fetch(`${BASE}/bot`, {
      method: "POST",
      headers: {
        "Authorization": `Token ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const details = await resp.text();
      console.error(`[START] Recall API error (${resp.status}):`, details);
      return res.status(resp.status).json({ 
        error: "Failed to create bot", 
        details,
        note: "Check Recall.ai API credentials and meeting URL"
      });
    }

    const data = await resp.json();
    console.log(`[START] Bot created successfully: ${data.id}`);
    console.log(`[START] Bot status: ${data.status || data.state || 'unknown'}`);

    return res.status(200).json({
      success: true,
      bot_id: data.id,
      message: "Bot is joining. If Zoom prompts, click 'Admit'.",
      webhook_configured: !!webhookUrl,
      webhook_url: webhookUrl || "Not configured - live transcription disabled"
    });

  } catch (err) {
    console.error(`[START] Unexpected error:`, err);
    return res.status(500).json({ 
      error: "Internal error", 
      message: err.message 
    });
  }
}
