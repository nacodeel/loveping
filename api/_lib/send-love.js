import webpush from "web-push";
import {
  getPairByMemberToken,
  getPairByShortcutToken,
  savePair
} from "./pairs.js";
import { loadState, saveState } from "./state.js";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:you@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

function buildNotificationPayload({ senderName, text }) {
  const trimmedText = typeof text === "string" ? text.trim() : "";

  return {
    title: "Я тебя люблю",
    body: trimmedText,
    icon: "/icon-heart.svg",
    badge: "/badge-heart.svg"
  };
}

export async function sendLoveMessage({ memberToken, shortcutToken, secret, text }) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return {
      status: 500,
      body: {
        error: "VAPID keys are not configured"
      }
    };
  }

  const normalizedText = text && text.trim() ? text.trim() : "";

  if (memberToken || shortcutToken) {
    const pairResult = memberToken
      ? await getPairByMemberToken(memberToken)
      : await getPairByShortcutToken(shortcutToken);

    if (!pairResult) {
      return {
        status: 404,
        body: {
          error: "Устройство не зарегистрировано в паре"
        }
      };
    }

    const { member, pair } = pairResult;
    const recipients = pair.members.filter(item => item.memberToken !== member.memberToken);

    if (recipients.length === 0) {
      return {
        status: 400,
        body: {
          error: "Сначала подключи второе устройство по ссылке-приглашению"
        }
      };
    }

    const staleTokens = [];
    let deliveredTo = 0;

    for (const recipient of recipients) {
      if (!recipient.subscription) {
        continue;
      }

      try {
        const payload = buildNotificationPayload({
          senderName: member.name,
          text: normalizedText
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

        return {
          status: error.statusCode || 500,
          body: {
            error: "Failed to send push notification",
            details: error.body || error.message
          }
        };
      }
    }

    if (staleTokens.length > 0) {
      pair.members = pair.members.filter(item => !staleTokens.includes(item.memberToken));
      await savePair(pair);
    }

    return {
      status: 200,
      body: {
        success: true,
        text: normalizedText || "Я тебя люблю",
        deliveredTo,
        senderName: member.name
      }
    };
  }

  if (secret !== process.env.SEND_SECRET) {
    return {
      status: 403,
      body: {
        error: "Forbidden"
      }
    };
  }

  const state = await loadState();
  const subscription = state.legacySubscription;

  if (!subscription) {
    return {
      status: 404,
      body: {
        error: "Девушка ещё не подписалась на уведомления"
      }
    };
  }

  try {
    const payload = buildNotificationPayload({
      senderName: "",
      text: normalizedText
    });

    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (error) {
    if (error.statusCode === 404 || error.statusCode === 410) {
      state.legacySubscription = null;
      await saveState(state);
    }

    return {
      status: error.statusCode || 500,
      body: {
        error: "Failed to send push notification",
        details: error.body || error.message
      }
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      text: normalizedText || "Я тебя люблю"
    }
  };
}
