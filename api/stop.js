// api/stop.js
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

    console.log(`[STOP] Stopping bot ${bot_id}...`);

    // Leave call
    const stop = await fetch(`${BASE}/bot/${bot_id}/leave_call/`, {
      method: "POST",
      headers: { "Authorization": `Token ${API_KEY}` }
    });

    if (!stop.ok) {
      const text = await stop.text();
      console.error(`[STOP] Failed to stop bot: ${text}`);
      return res.status(stop.status).json({ error: "Failed to stop bot", details: text });
    }

    console.log(`[STOP] Bot ${bot_id} left the call successfully`);

    // Try to fetch transcript, but don't fail if it's not ready yet
    // The client will poll for it
    let finalText = "";
    try {
      const r = await fetch(`${BASE}/bot/${bot_id}/transcript/`, {
        headers: { "Authorization": `Token ${API_KEY}` }
      });

      if (r.ok) {
        const data = await r.json();
        console.log(`[STOP] Transcript response type:`, Array.isArray(data) ? 'array' : typeof data);
        
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
        
        console.log(`[STOP] Transcript length: ${finalText.length} chars`);
      } else {
        console.log(`[STOP] Transcript not ready yet (status ${r.status})`);
      }
    } catch (err) {
      console.error(`[STOP] Error fetching transcript:`, err.message);
    }

    return res.status(200).json({
      success: true,
      message: "Recording stopped. Transcript may take 30-60 seconds to process.",
      transcript: finalText || "",
      note: finalText ? "Transcript ready" : "Transcript still processing - poll /api/transcript"
    });

  } catch (err) {
    console.error(`[STOP] Unexpected error:`, err);
    return res.status(500).json({ error: "Internal error", message: err.message });
  }
}
