import { D1Database } from "@cloudflare/workers-types/experimental";

export async function subscribe(
  ctx: any,
  db: D1Database,
  table: string,
  subscriptionType: string,
) {
  const exists = await isSubscribed(db, table, ctx.chat.id);
  if (exists) {
    await ctx.reply(`You are already subscribed to ${subscriptionType} notifications!`);
  } else {
    await db.prepare(`INSERT OR IGNORE INTO ${table} (chat_id) VALUES (?)`)
      .bind(ctx.chat.id)
      .run();
    await ctx.reply(`You have been subscribed to receive ${subscriptionType} notifications!`);
  }
}

export async function unsubscribe(
  ctx: any,
  db: D1Database,
  table: string,
  subscriptionType: string
) {
  const exists = await isSubscribed(db, table, ctx.chat.id);
  if (!exists) {
    await ctx.reply(`You were not subscribed to ${subscriptionType} notifications.`);
  } else {
    await db.prepare(`DELETE FROM ${table} WHERE chat_id = ?`)
      .bind(ctx.chat.id)
      .run();
    await ctx.reply(`You have been unsubscribed from ${subscriptionType} notifications.`);
  }
}

export async function getAllSubscribers<T>(
  db: D1Database,
  table: string
): Promise<T[]> {
  const { results } = await db.prepare(`SELECT chat_id FROM ${table}`)
    .all<T>();
  return results;
}

export async function countSubscribers(db: D1Database, table: string): Promise<number> {
  const { results } = await db.prepare(
    `SELECT COUNT(*) as count FROM ${table}`
  ).all<{ count: number }>();

  return results[0]?.count ?? 0;
}

async function isSubscribed(db: D1Database, table: string, chatId: number): Promise<boolean> {
  const { results } = await db.prepare(`SELECT 1 FROM ${table} WHERE chat_id = ?`)
    .bind(chatId)
    .all<{ "1": number }>();
  
  return results.length > 0;
}
