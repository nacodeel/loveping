import { get, put } from "@vercel/blob";

const STATE_PATHNAME = "love-push/state.json";

function getBlobAuthOptions() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      token: process.env.BLOB_READ_WRITE_TOKEN
    };
  }

  if (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN) {
    return {
      storeId: process.env.BLOB_STORE_ID,
      oidcToken: process.env.VERCEL_OIDC_TOKEN
    };
  }

  return {};
}

function createInitialState() {
  return {
    pairs: [],
    legacySubscription: null
  };
}

async function readStreamAsText(stream) {
  const response = new Response(stream);
  return response.text();
}

export async function loadState() {
  try {
    const result = await get(STATE_PATHNAME, {
      access: "private",
      ...getBlobAuthOptions()
    });

    if (!result || result.statusCode === 404) {
      return createInitialState();
    }

    const raw = await readStreamAsText(result.stream);
    const parsed = JSON.parse(raw);

    return {
      pairs: Array.isArray(parsed.pairs) ? parsed.pairs : [],
      legacySubscription: parsed.legacySubscription || null
    };
  } catch (error) {
    if (error?.statusCode === 404) {
      return createInitialState();
    }

    throw error;
  }
}

export async function saveState(state) {
  await put(STATE_PATHNAME, JSON.stringify(state, null, 2), {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
    ...getBlobAuthOptions()
  });
}
