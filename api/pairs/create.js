import { createPairRecord, getSetupSecret, publicPair } from "../_lib/pairs.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = req.body?.secret;
  const setupSecret = getSetupSecret();

  if (!setupSecret) {
    return res.status(500).json({
      error: "PAIR_SETUP_SECRET or SEND_SECRET is not configured"
    });
  }

  if (secret !== setupSecret) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const pair = await createPairRecord();
  const origin =
    req.headers.origin ||
    `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
  const inviteUrl = `${origin}/?pair=${encodeURIComponent(pair.id)}&invite=${encodeURIComponent(pair.inviteToken)}`;

  return res.status(200).json({
    success: true,
    inviteUrl,
    pair: publicPair(pair)
  });
}
