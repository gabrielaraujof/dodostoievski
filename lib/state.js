import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const STATE_TTL = 60 * 60 * 48; // 48 horas

export async function getState(userId) {
  const state = await redis.get(`dosto:${userId}`);
  if (!state) {
    return { phase: 1, history: [] };
  }
  return state;
}

export async function setState(userId, state) {
  await redis.set(`dosto:${userId}`, state, { ex: STATE_TTL });
}

export async function resetState(userId) {
  await redis.del(`dosto:${userId}`);
}
