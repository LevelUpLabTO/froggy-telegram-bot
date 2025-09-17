import { Bot } from "grammy";
import { Env, sendFreeGames, sendLevelUpEvents } from "./bot.js";
import { countSubscribers, SubscriptionType } from "./db-helpers.js";

export function isDevRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.pathname.startsWith("/dev");
}

export async function performDevActions(request: Request, bot: Bot, env: Env): Promise<Response> {
  const url = new URL(request.url);

  const authHeader = request.headers.get("dev-api-key");
  if (authHeader !== env.DEV_API_KEY) {
    return new Response("Unauthorized", { status: 401 });
  }

  switch (url.pathname) {
    case "/dev/sendevents": return await sendDebugEvents(bot, env);
    case "/dev/sendgames":  return await sendDebugFreeGames(bot, env);
  }
  
  return new Response("Dev command not found.", { status: 404 });
}

async function sendDebugEvents(bot: Bot, env: Env): Promise<Response> {
  try {
    await sendLevelUpEvents(bot, env, true);
  }
  catch (err) {
    return new Response(`Error sending LevelUp events: ${err}`, { status: 500 });
  }

  const eventSubsCount = await countSubscribers(env.DB, SubscriptionType.EVENTS_LUL, true);
  return new Response(`Sent events to ${eventSubsCount} subscribers.`);
}

async function sendDebugFreeGames(bot: Bot, env: Env): Promise<Response> {
  try {
    await sendFreeGames(bot, env, true);
  }
  catch (err) {
    return new Response(`Error sending free games: ${err}`, { status: 500 });
  }
  
  const freeGameSubsCount = await countSubscribers(env.DB, SubscriptionType.FREE_GAMES, true);
  return new Response(`Sent free games to ${freeGameSubsCount} subscribers.`);
}