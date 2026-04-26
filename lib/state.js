import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const STATE_TTL = 60 * 60 * 48; // 48 horas

export async function getState(userId) {
  const state = await redis.get(`dosto:${userId}`);
  if (!state) {
    return { phase: 1, substate: "puzzle", history: [] };
  }
  return state;
}

export async function setState(userId, state) {
  await redis.set(`dosto:${userId}`, state, { ex: STATE_TTL });
}

export async function resetState(userId) {
  await redis.del(`dosto:${userId}`);
}

const UPDATE_DEDUP_TTL = 60 * 5; // 5 minutos — janela do retry do Telegram

// Marca um update_id do Telegram como processado. Retorna `true` se for a
// primeira vez (devemos processar) e `false` se já foi visto (retry).
export async function claimUpdate(updateId) {
  if (updateId === undefined || updateId === null) return true;
  const result = await redis.set(`dosto:upd:${updateId}`, "1", {
    nx: true,
    ex: UPDATE_DEDUP_TTL,
  });
  return result === "OK";
}
