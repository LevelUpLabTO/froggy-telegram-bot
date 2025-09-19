import { Bot, GrammyError, HttpError } from "grammy";
import { Env, safeReply } from "./bot.js";
import { fetchFreeGames } from "./game-finder.js";
import { SubscriptionType, subscribe, unsubscribe } from "./db-helpers.js";
import { escapeMarkdownV2IgnoreLinks as escMD } from "./md-helpers.js";
import { HELP_MESSAGE, WELCOME_MESSAGE } from "./messages.js";


export function createBot(env: Env): Bot {
  const bot = new Bot(env.BOT_TOKEN);

  addErrorHandlers(bot, env); 
  addCoreCommands(bot, env);
  addEventCommands(bot, env);
  addFreeGameCommands(bot, env);

  return bot;
}

function addErrorHandlers(bot: Bot, env: Env) {
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`An error occurred during bot update ${ctx.update.update_id}:`);
    
    const e = err.error;
    if (e instanceof GrammyError) {
      console.error("Request error:", e.description);
    } else if (e instanceof HttpError) {
      console.error("Cannot connect to Telegram servers:", e);
    } else {
      console.error("Unknown error:", e);
    }

    safeReply(ctx, "An error occurred while processing your request.");
  });
}

function addCoreCommands(bot: Bot, env: Env) {
  bot.command("start", async (ctx) => {
      await safeReply(ctx, WELCOME_MESSAGE);
  });

  bot.command("help", async (ctx) => {
      await safeReply(ctx, HELP_MESSAGE);
  });
}

function addEventCommands(bot: Bot, env: Env) {
  bot.command("events", async (ctx) => {
    await safeReply(ctx, escMD("⚠️ Event reminders are currently in development and not yet available."));
  });

  bot.command("start_events", async (ctx) => {
    await subscribe(ctx, env.DB, SubscriptionType.EVENTS_LUL);
  });

  bot.command("stop_events", async (ctx) => {
    await unsubscribe(ctx, env.DB, SubscriptionType.EVENTS_LUL);
  });
}

function addFreeGameCommands(bot: Bot, env: Env) {
  bot.command("freegames", async (ctx) => {
    const games = await fetchFreeGames();
    await safeReply(ctx, games);
  });

  bot.command("start_freegames", async (ctx) => {
    await subscribe(ctx, env.DB, SubscriptionType.FREE_GAMES);
  });

  bot.command("stop_freegames", async (ctx) => {
    await unsubscribe(ctx, env.DB, SubscriptionType.FREE_GAMES);
  });
}
