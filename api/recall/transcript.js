// api/recall/transcript.js
// Simple in-memory cache (per serverless instance). Good enough for MVP.
// For production, use Redis/Upstash instead.
const liveCache = globalThis.__liveCache || (globalThis.__liveCache = new Map());

function wordsToLine(words = []) {
  try { return words.map(w => w.text).join(" "); } catch { return ""; }
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Parse raw body safely (Recall posts JSON)
    let raw = "";
    await new Promise(resolve => {
      req.on("data", c => (raw += c));
      req.on("end", resolve);
    });
    let body = {};
    try { body = JSON.parse(raw || "{}"); } catch {}

    // Event shapes may vary slightly; extract essentials
    const event = body.event || body.type || "";
    const botId = body?.bot_id || body?.bot?.id || body?.id || body?.data?.bot_id;

    // Words/text can appear in different places depending on partial/final
    const d = body.data || body;
    const line =
      wordsToLine(d?.words) ||
      wordsToLine(d?.segment?.words) ||
      d?.text || "";

    if (botId) {
      const entry = liveCache.get(botId) || { lines: [], text: "", updated: 0 };
      if (line && line.trim()) {
        entry.lines.push(line.trim());
        entry.text = entry.lines.join("\n");
        entry.updated = Date.now();
        liveCache.set(botId, entry);
      }
    }

    // 200 OK so Recall stops retrying
    return res.status(200).json({ ok: true, event, bot_id: botId });
  } catch (err) {
    return res.status(200).json({ ok: true }); // still 200 to avoid retries
  }
}
