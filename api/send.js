import webpush from "web-push";
import { getPairByMemberToken, getPairByShortcutToken, savePair } from "./_lib/pairs.js";
import { loadState, saveState } from "./_lib/state.js";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:you@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const MAX_SENDER_NAME_LENGTH = 24;
const MAX_BODY_LENGTH = 120;
const MAX_TITLE_LENGTH = 60;

function truncateText(value, maxLength) {
  const normalizedValue = typeof value === "string" ? value.trim() : "";

  if (!normalizedValue || normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, maxLength - 1)}…`;
}

function buildNotificationPayload({ senderName, text }) {
  const safeSenderName = truncateText(senderName || "Никита", MAX_SENDER_NAME_LENGTH) || "Никита";
  const trimmedText = truncateText(text, MAX_BODY_LENGTH);
  const defaultTitle = truncateText(`Я тебя люблю от ${safeSenderName}`, MAX_TITLE_LENGTH);

  return {
    title: defaultTitle,
    body: trimmedText,
    icon: "/icon-heart.svg",
    badge: "/badge-heart.svg"
  };
}

export default async function handler(req, res) {
  const secret = req.method === "POST" ? req.body?.secret : req.query.secret;
  const memberToken = req.method === "POST" ? req.body?.memberToken : req.query.memberToken;
  const shortcutToken = req.method === "POST" ? req.body?.shortcutToken : req.query.shortcutToken;

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(500).json({
      error: "VAPID keys are not configured"
    });
  }

  let text = req.method === "POST" ? req.body?.text : req.query.text;

  text = text && text.trim() ? text.trim() : "";

  if (memberToken || shortcutToken) {
    const pairResult = memberToken
      ? await getPairByMemberToken(memberToken)
      : await getPairByShortcutToken(shortcutToken);

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
        const payload = buildNotificationPayload({
          senderName: member.notificationName || member.name,
          text
        });

        await webpush.sendNotification(
          recipient.subscription,
          JSON.stringify(payload)
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
      text: text || "Я тебя люблю от Никита",
      deliveredTo
    });
  }

  if (secret !== process.env.SEND_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const state = await loadState();
  const subscription = state.legacySubscription;

  if (!subscription) {
    return res.status(404).json({
      error: "Девушка ещё не подписалась на уведомления"
    });
  }

  try {
    const payload = buildNotificationPayload({
      senderName: "",
      text
    });

    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload)
    );
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      state.legacySubscription = null;
      await saveState(state);
    }

    return res.status(error.statusCode || 500).json({
      error: "Failed to send push notification",
      details: error.body || error.message
    });
  }

  return res.status(200).json({
    success: true,
    text: text || "Я тебя люблю от Никита"
  });
}
