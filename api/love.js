import { sendLoveMessage } from "./_lib/send-love.js";

export default async function handler(req, res) {
  const payload = req.method === "POST" ? req.body || {} : req.query || {};
  const result = await sendLoveMessage({
    memberToken: payload.memberToken,
    shortcutToken: payload.t || payload.shortcutToken,
    secret: payload.secret,
    text: payload.text || payload.m
  });

  return res.status(result.status).json(result.body);
}
