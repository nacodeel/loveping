import { loadState, saveState } from "./_lib/state.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const subscription = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Invalid subscription" });
  }

  const state = await loadState();
  state.legacySubscription = {
    ...subscription,
    savedAt: new Date().toISOString()
  };
  await saveState(state);

  return res.status(200).json({ success: true });
}
