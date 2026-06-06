import { kv } from "@vercel/kv";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:you@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  const secret = req.query.secret;

  if (secret !== process.env.SEND_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const subscription = await kv.get("girl_subscription");

  if (!subscription) {
    return res.status(404).json({
      error: "Девушка ещё не подписалась на уведомления"
    });
  }

  let text = req.query.text;

  if (!text || text.trim() === "") {
    text = "я тебя люблю ❤️";
  }

  await webpush.sendNotification(
    subscription,
    JSON.stringify({
      title: "❤️",
      body: text
    })
  );

  return res.status(200).json({
    success: true,
    text
  });
}