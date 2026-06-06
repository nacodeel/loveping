import { kv } from "@vercel/kv";
import webpush from "web-push";
import { getPairByMemberToken, savePair } from "./_lib/pairs.js";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:you@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  const secret = req.method === "POST" ? req.body?.secret : req.query.secret;
  const memberToken = req.method === "POST" ? req.body?.memberToken : req.query.memberToken;

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(500).json({
      error: "VAPID keys are not configured"
    });
  }

  let text = req.method === "POST" ? req.body?.text : req.query.text;

  if (!text || text.trim() === "") {
    text = "Я тебя люблю";
  }

  if (memberToken) {
    const pairResult = await getPairByMemberToken(memberToken);

    if (!pairResult) {
      return res.status(404).json({
        error: "Устройство не зарегистрировано в паре"
      });
    }

    const { member, pair } = pairResult;
    const recipients = pair.members.filter(item => item.memberToken !== member.memberToken);

    if (recipients.length === 0) {
      return res.status(400).json({
        error: "Сначала подключи второе устройство по ссылке-приглашению"
      });
    }

    const staleTokens = [];
    let deliveredTo = 0;

    for (const recipient of recipients) {
      if (!recipient.subscription) {
        continue;
      }

      try {
        await webpush.sendNotification(
          recipient.subscription,
          JSON.stringify({
            title: "Я тебя люблю",
            body: text,
            icon: "/icon-heart.svg",
            badge: "/badge-heart.svg"
          })
        );

        deliveredTo += 1;
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          staleTokens.push(recipient.memberToken);
          continue;
        }

        return res.status(error.statusCode || 500).json({
          error: "Failed to send push notification",
          details: error.body || error.message
        });
      }
    }

    if (staleTokens.length > 0) {
      pair.members = pair.members.filter(item => !staleTokens.includes(item.memberToken));
      await savePair(pair);
    }

    return res.status(200).json({
      success: true,
      text,
      deliveredTo
    });
  }

  if (secret !== process.env.SEND_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const subscription = await kv.get("girl_subscription");

  if (!subscription) {
    return res.status(404).json({
      error: "Девушка ещё не подписалась на уведомления"
    });
  }

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: "Я тебя люблю",
        body: text,
        icon: "/icon-heart.svg",
        badge: "/badge-heart.svg"
      })
    );
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      await kv.del("girl_subscription");
    }

    return res.status(error.statusCode || 500).json({
      error: "Failed to send push notification",
      details: error.body || error.message
    });
  }

  return res.status(200).json({
    success: true,
    text
  });
}
