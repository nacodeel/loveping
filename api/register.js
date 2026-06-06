import { publicPair, registerPairMember } from "./_lib/pairs.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { inviteToken, memberToken, name, notificationName, pairId, subscription } = req.body || {};

  if (!pairId || !inviteToken) {
    return res.status(400).json({
      error: "pairId and inviteToken are required"
    });
  }

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      error: "Name is required"
    });
  }

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({
      error: "Subscription is required"
    });
  }

  try {
    const result = await registerPairMember({
      inviteToken,
      memberToken,
      name,
      notificationName,
      pairId,
      subscription
    });

    return res.status(200).json({
      success: true,
      memberToken: result.member.memberToken,
      shortcutToken: result.member.shortcutToken,
      pair: publicPair(result.pair)
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message
    });
  }
}
