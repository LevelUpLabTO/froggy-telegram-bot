import dotenv from "dotenv";
dotenv.config();

export const botToken: string = process.env.BOT_TOKEN ?? (() => {
  throw new Error("BOT_TOKEN is not set in the environment variables.");
})();

export const chatId: string = process.env.CHAT_ID ?? (() => {
  throw new Error("CHAT_ID is not set in the environment variables.");
})();
