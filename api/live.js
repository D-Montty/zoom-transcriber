// api/live.js
const liveCache = globalThis.__liveCache || (globalThis.__liveCache = new Map());

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { bot_id } = req.query || {};
  if (!bot_id) return res.status(400).json({ error: "bot_id is required" });

  const entry = liveCache.get(bot_id);
  return res.status(200).json({
    success: true,
    hasData: !!(entry && entry.text && entry.text.trim()),
    transcript: entry?.text || "",
    updated: entry?.updated || 0
  });
}
