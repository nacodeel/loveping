import { randomBytes } from "node:crypto";
import { loadState, saveState } from "./state.js";

function createToken(size = 18) {
  return randomBytes(size).toString("base64url");
}

function createPairId() {
  return randomBytes(8).toString("hex");
}

function ensureShortcutToken(member) {
  if (!member.shortcutToken) {
    member.shortcutToken = createToken(24);
  }

  return member.shortcutToken;
}

export function getSetupSecret() {
  return process.env.PAIR_SETUP_SECRET || process.env.SEND_SECRET;
}

async function getState() {
  const state = await loadState();

  if (!state || typeof state !== "object") {
    return {
      pairs: [],
      legacySubscription: null
    };
  }

  return {
    pairs: Array.isArray(state.pairs) ? state.pairs : [],
    legacySubscription: state.legacySubscription || null
  };
}

export async function createPairRecord() {
  const state = await getState();
  const pair = {
    id: createPairId(),
    inviteToken: createToken(12),
    createdAt: new Date().toISOString(),
    members: []
  };

  state.pairs = [...state.pairs, pair];
  await saveState(state);

  return pair;
}

export async function getPair(pairId) {
  if (!pairId) {
    return null;
  }

  const state = await getState();

  return state.pairs.find(pair => pair.id === pairId) || null;
}

export async function savePair(pair) {
  const state = await getState();
  state.pairs = state.pairs.map(item => (item.id === pair.id ? pair : item));
  await saveState(state);
}

export function publicPair(pair) {
  return {
    id: pair.id,
    createdAt: pair.createdAt,
    members: pair.members.map(member => ({
      name: member.name,
      partnerAlias: member.partnerAlias || "",
      createdAt: member.createdAt,
      updatedAt: member.updatedAt
    }))
  };
}

export async function getPairByShortcutToken(shortcutToken) {
  const state = await getState();

  for (const pair of state.pairs) {
    const member = pair.members.find(item => item.shortcutToken === shortcutToken);

    if (member) {
      return { pair, member };
    }
  }

  return null;
}

export async function getPairByMemberToken(memberToken) {
  const state = await getState();

  for (const pair of state.pairs) {
    const member = pair.members.find(item => item.memberToken === memberToken);

    if (member) {
      return { pair, member };
    }
  }

  return null;
}

export async function registerPairMember({
  inviteToken,
  memberToken,
  name,
  partnerAlias,
  pairId,
  subscription
}) {
  const state = await getState();
  const pair = state.pairs.find(item => item.id === pairId);

  if (!pair) {
    throw new Error("Пара не найдена");
  }

  if (pair.inviteToken !== inviteToken) {
    throw new Error("Ссылка-приглашение недействительна");
  }

  const now = new Date().toISOString();
  const trimmedName = name.trim();
  const trimmedPartnerAlias = typeof partnerAlias === "string" ? partnerAlias.trim() : "";
  const existingMember = memberToken
    ? pair.members.find(item => item.memberToken === memberToken)
    : null;

  if (existingMember) {
    existingMember.name = trimmedName;
    existingMember.partnerAlias = trimmedPartnerAlias;
    existingMember.subscription = subscription;
    existingMember.updatedAt = now;
    ensureShortcutToken(existingMember);

    await saveState(state);

    return {
      pair,
      member: existingMember
    };
  }

  if (pair.members.length >= 2) {
    throw new Error("Эта пара уже заполнена");
  }

  const newMember = {
    memberToken: createToken(),
    shortcutToken: createToken(24),
    name: trimmedName,
    partnerAlias: trimmedPartnerAlias,
    subscription,
    createdAt: now,
    updatedAt: now
  };

  pair.members = [...pair.members, newMember];

  await saveState(state);

  return {
    pair,
    member: newMember
  };
}
