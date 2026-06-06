export default function handler(_req, res) {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;

  if (!vapidPublicKey) {
    return res.status(500).json({
      error: "VAPID_PUBLIC_KEY is not configured"
    });
  }

  return res.status(200).json({
    vapidPublicKey
  });
}
