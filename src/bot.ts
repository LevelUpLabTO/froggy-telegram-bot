import dotenv from 'dotenv';
import { Bot } from "grammy";


// Load variables from .env into process.env
dotenv.config();

const botToken = process.env.BOT_TOKEN;
if (!botToken) {
  throw new Error("BOT_TOKEN is not set in the environment variables.");
}

const bot = new Bot(botToken);

// Handle the /start command.
bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));

// Handle other messages.
bot.on("message", (ctx) => ctx.reply("Got another message!"));

// Start the bot.
bot.start();
console.log("Bot is up and running...", );
