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
  // Limpa o estado e todos os locks de despacho de fase (1..5).
  // Permite re-testar a jornada inteira via /start sem locks pendurados.
  await redis.del(
    `dosto:${userId}`,
    `dosto:dispatch:${userId}:1`,
    `dosto:dispatch:${userId}:2`,
    `dosto:dispatch:${userId}:3`,
    `dosto:dispatch:${userId}:4`,
    `dosto:dispatch:${userId}:5`
  );
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

const PHASE_DISPATCH_TTL = 60 * 60; // 1 hora — uma vez disparado, fica trancado

// Lock atômico Redis para garantir que o despacho de fase rode no máximo uma
// vez por usuário/fase. Substitui o padrão check-then-set de getState/setState
// (que tem janela de race entre leitura e escrita) por um SETNX atômico.
// Retorna `true` se o caller deve disparar; `false` se outra invocação já
// reivindicou o despacho.
export async function claimPhaseDispatch(userId, phase) {
  const result = await redis.set(`dosto:dispatch:${userId}:${phase}`, "1", {
    nx: true,
    ex: PHASE_DISPATCH_TTL,
  });
  return result === "OK";
}
