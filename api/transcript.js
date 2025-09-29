// api/transcript.js - UPDATED for new Recall.ai API
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

    console.log(`[TRANSCRIPT] Fetching bot info for: ${bot_id}`);

    // Step 1: Get bot info (new API endpoint)
    const botResp = await fetch(`${BASE}/bot/${bot_id}`, {
      headers: { 
        "Authorization": `Token ${API_KEY}`,
        "Accept": "application/json"
      }
    });
    
    if (!botResp.ok) {
      const text = await botResp.text();
      console.error(`[TRANSCRIPT] Bot fetch error (${botResp.status}):`, text);
      return res.status(botResp.status).json({ 
        error: "Failed to fetch bot info", 
        details: text
      });
    }

    const botData = await botResp.json();
    const state = botData.state || botData.status || "unknown";
    
    console.log(`[TRANSCRIPT] Bot state: ${state}`);
    console.log(`[TRANSCRIPT] Recordings count:`, botData.recordings?.length || 0);

    // Step 2: Extract download URL from recordings
    const recording = botData.recordings?.[0];
    const transcriptData = recording?.media_shortcuts?.transcript;
    const downloadUrl = transcriptData?.data?.download_url;

    if (!downloadUrl) {
      console.log(`[TRANSCRIPT] No download URL yet. State: ${state}`);
      return res.status(200).json({
        success: true,
        state,
        ready: false,
        transcript: "",
        note: "Transcript not ready yet - still processing"
      });
    }

    console.log(`[TRANSCRIPT] Download URL found, fetching transcript...`);

    // Step 3: Download the actual transcript
    const transcriptResp = await fetch(downloadUrl);
    
    if (!transcriptResp.ok) {
      console.error(`[TRANSCRIPT] Download error (${transcriptResp.status})`);
      return res.status(200).json({
        success: true,
        state,
        ready: false,
        transcript: "",
        note: "Transcript URL exists but download failed"
      });
    }

    const transcriptArray = await transcriptResp.json();
    console.log(`[TRANSCRIPT] Downloaded ${transcriptArray.length} transcript blocks`);

    // Step 4: Format the transcript
    const formattedText = transcriptArray.map(block => {
      const participant = block.participant?.name || "Unknown Speaker";
      const words = block.words?.map(w => w.text).join(" ") || "";
      return `${participant}: ${words}`;
    }).join("\n");

    console.log(`[TRANSCRIPT] Final transcript: ${formattedText.length} chars`);

    return res.status(200).json({
      success: true,
      state,
      ready: true,
      transcript: formattedText,
      char_count: formattedText.length,
      note: "Transcript ready"
    });

  } catch (err) {
    console.error(`[TRANSCRIPT] Unexpected error:`, err);
    return res.status(500).json({ 
      error: "Internal error", 
      message: err.message 
    });
  }
}
