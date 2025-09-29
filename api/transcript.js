// api/transcript.js
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();

  const { bot_id } = req.query || {};
  if (!bot_id) {
    return res.status(400).json({ error: "bot_id is required" });
  }

  try {
    const REGION = process.env.RECALL_REGION;
    const API_KEY = process.env.RECALL_API_KEY;
    const BASE = `https://${REGION}.recall.ai/api/v1`;

    console.log(`[TRANSCRIPT] Fetching transcript for bot: ${bot_id}`);

    // Get bot state
    const s = await fetch(`${BASE}/bot/${bot_id}/`, {
      headers: { "Authorization": `Token ${API_KEY}` }
    });
    
    const botInfo = s.ok ? await s.json() : {};
    const state = botInfo.state || botInfo.status || "";
    
    console.log(`[TRANSCRIPT] Bot state: ${state}`);

    // Get transcript
    const r = await fetch(`${BASE}/bot/${bot_id}/transcript/`, {
      headers: { "Authorization": `Token ${API_KEY}` }
    });

    if (!r.ok) {
      const text = await r.text();
      console.error(`[TRANSCRIPT] API error (${r.status}):`, text);
      return res.status(r.status).json({ 
        error: "Failed to fetch transcript", 
        details: text, 
        state,
        note: state === "done" ? "Bot finished but transcript may not be ready yet" : "Bot still in progress"
      });
    }

    const data = await r.json();
    console.log(`[TRANSCRIPT] Response type:`, Array.isArray(data) ? `array (${data.length} items)` : typeof data);

    // Flexible parsing
    const flatten = (payload) => {
      if (Array.isArray(payload)) {
        if (payload.length === 0) {
          console.log('[TRANSCRIPT] Empty array received');
          return "";
        }
        
        const text = payload.map(block => {
          const line = (block.words || []).map(w => w.text).join(" ");
          return block.speaker ? `${block.speaker}: ${line}` : line;
        }).join("\n");
        
        console.log(`[TRANSCRIPT] Parsed ${payload.length} blocks into ${text.length} chars`);
        return text;
      }
      
      if (payload?.utterances) {
        console.log(`[TRANSCRIPT] Found ${payload.utterances.length} utterances`);
        return payload.utterances.map(u =>
          (u.speaker ? `${u.speaker}: ${u.text}` : u.text)
        ).join("\n");
      }
      
      console.log('[TRANSCRIPT] Unknown data structure:', Object.keys(payload));
      return "";
    };

    const text = flatten(data);
    const ready = !!text && text.trim().length > 0;

    console.log(`[TRANSCRIPT] Final: ${text.length} chars, ready: ${ready}`);

    return res.status(200).json({
      success: true,
      state,
      ready,
      transcript: text || "",
      char_count: text.length,
      note: ready ? "Transcript available" : (state === "done" ? "Processing complete but no transcript yet" : "Still recording")
    });

  } catch (err) {
    console.error(`[TRANSCRIPT] Unexpected error:`, err);
    return res.status(500).json({ 
      error: "Internal error", 
      message: err.message 
    });
  }
}
