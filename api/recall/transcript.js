// api/recall/transcript.js
// Webhook endpoint that receives real-time transcript from Recall.ai

const liveCache = globalThis.__liveCache || (globalThis.__liveCache = new Map());

function wordsToLine(words = []) {
  try { 
    return words.map(w => w.text).join(" "); 
  } catch { 
    return ""; 
  }
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    console.log(`[WEBHOOK] Invalid method: ${req.method}`);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse raw body
    let raw = "";
    await new Promise(resolve => {
      req.on("data", c => (raw += c));
      req.on("end", resolve);
    });

    let body = {};
    try { 
      body = JSON.parse(raw || "{}"); 
    } catch (e) {
      console.error('[WEBHOOK] Failed to parse JSON:', e.message);
      return res.status(200).json({ ok: true }); // Still return 200 to avoid retries
    }

    // Log the FULL webhook payload structure to debug
    console.log(`[WEBHOOK] ===== RAW WEBHOOK RECEIVED =====`);
    console.log(`[WEBHOOK] Full payload:`, JSON.stringify(body, null, 2));
    
    // Try multiple ways to extract bot_id
    const botId = 
      body?.bot_id || 
      body?.bot?.id || 
      body?.id || 
      body?.data?.bot_id ||
      body?.data?.bot?.id;
    
    const event = body.event || body.type || "unknown";
    
    console.log(`[WEBHOOK] Extracted - Event: ${event}, BotId: ${botId}`);

    // Extract text from various possible structures
    const d = body.data || body;
    const line =
      wordsToLine(d?.words) ||
      wordsToLine(d?.segment?.words) ||
      d?.text || 
      "";

    if (botId && line && line.trim()) {
      const entry = liveCache.get(botId) || { lines: [], text: "", updated: 0 };
      
      // Add speaker if available
      const speaker = d?.speaker || d?.segment?.speaker || "";
      const formattedLine = speaker ? `${speaker}: ${line.trim()}` : line.trim();
      
      entry.lines.push(formattedLine);
      entry.text = entry.lines.join("\n");
      entry.updated = Date.now();
      
      liveCache.set(botId, entry);
      
      console.log(`[WEBHOOK] Updated cache for bot ${botId}: ${entry.lines.length} lines, ${entry.text.length} chars`);
    } else {
      console.log(`[WEBHOOK] No usable text in webhook. BotId: ${botId}, Line: "${line}"`);
    }

    // Always return 200 OK so Recall stops retrying
    return res.status(200).json({ 
      ok: true, 
      event, 
      bot_id: botId,
      processed: !!(botId && line && line.trim())
    });

  } catch (err) {
    console.error(`[WEBHOOK] Error processing webhook:`, err);
    // Still return 200 to avoid retries
    return res.status(200).json({ ok: true, error: err.message });
  }
}
