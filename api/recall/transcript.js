// api/recall/transcript.js - FIXED for nested webhook structure
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

    const event = body.event || "unknown";
    
    // Extract bot_id from the nested structure: body.data.bot.id
    const botId = body?.data?.bot?.id;
    
    console.log(`[WEBHOOK] Event: ${event}, BotId: ${botId}`);

    // Extract words from nested structure: body.data.data.words
    const words = body?.data?.data?.words || [];
    const participant = body?.data?.data?.participant?.name || "Unknown Speaker";
    
    // Convert words array to text
    const line = wordsToLine(words);

    if (botId && line && line.trim()) {
      const entry = liveCache.get(botId) || { lines: [], text: "", updated: 0 };
      
      // Add speaker prefix to this line
      const formattedLine = `${participant}: ${line.trim()}`;
      
      entry.lines.push(formattedLine);
      entry.text = entry.lines.join("\n");
      entry.updated = Date.now();
      
      liveCache.set(botId, entry);
      
      console.log(`[WEBHOOK] ✅ Cached for bot ${botId}: ${words.length} words, "${line.substring(0, 50)}..."`);
      console.log(`[WEBHOOK] Total cache: ${entry.lines.length} lines, ${entry.text.length} chars`);
    } else {
      console.log(`[WEBHOOK] ⚠️ Skipped - BotId: ${botId}, Words: ${words.length}, Line: "${line}"`);
    }

    // Always return 200 OK so Recall stops retrying
    return res.status(200).json({ 
      ok: true, 
      event, 
      bot_id: botId,
      processed: !!(botId && line && line.trim()),
      words_count: words.length
    });

  } catch (err) {
    console.error(`[WEBHOOK] Error processing webhook:`, err);
    // Still return 200 to avoid retries
    return res.status(200).json({ ok: true, error: err.message });
  }
}
