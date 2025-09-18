import { D1Database } from "@cloudflare/workers-types/experimental";
import { safeReply } from "./bot";

interface ChatsRow {
  id: number;
  created_at: string;
  updated_at: string;
  free_games: boolean;
  events_lul: boolean;
  events_igda: boolean;
  debug: boolean;
}

const tableName = "chats";

export enum SubscriptionType {
  EVENTS_LUL = "events_lul",
  EVENTS_IGDA = "events_igda",
  FREE_GAMES = "free_games",
  DEBUG = "debug",
}

export async function subscribe(
  ctx: any,
  db: D1Database,
  subType: SubscriptionType,
) {
  const subText = getSubText(subType);
  const exists = await isSubscribed(db, subType, ctx.chat.id);
  if (exists) {
    await safeReply(ctx, `You are already subscribed to ${subText} notifications!`);
  } else {
    await db.prepare(`INSERT OR IGNORE INTO ${tableName} (id) VALUES (?)`)
      .bind(ctx.chat.id)
      .run();
    
    // Set the subscription field to 1
    await setBoolField(ctx, db, subType, true);

    await safeReply(ctx, `You have been subscribed to receive ${subText} notifications!`);
  }
}

export async function unsubscribe(
  ctx: any,
  db: D1Database,
  subType: SubscriptionType,
) {
  const subText = getSubText(subType);
  const exists = await isSubscribed(db, subType, ctx.chat.id);

  if (!exists) {
    await safeReply(ctx, `You were not subscribed to ${subText} notifications.`);
    return;
  }

  // 1. Set the subscription field to 0
  await setBoolField(ctx, db, subType, false);

  // 2. Check all the flag fields
  const { results } = await db.prepare(
    `SELECT free_games, events_lul, events_igda, debug FROM ${tableName} WHERE id = ?`
  ).bind(ctx.chat.id).all<ChatsRow>();

  const chat = results[0];
  const allFlagsAreZero = !chat.free_games && !chat.events_lul && !chat.events_igda && !chat.debug;

  // 3. Delete the record if all fields are 0
  if (allFlagsAreZero) {
    await db.prepare(`DELETE FROM ${tableName} WHERE id = ?`)
      .bind(ctx.chat.id)
      .run();
    await safeReply(ctx, `You have been unsubscribed from all notifications.`);
  } else {
    await safeReply(ctx, `You have been unsubscribed from ${subText} notifications.`);
  }
}

export async function getAllSubscribers(
  db: D1Database,
  subType: SubscriptionType,
  onlyDebug = false,
): Promise<ChatsRow[]> {
  let query = `SELECT id FROM ${tableName} WHERE ${subType} = 1`;

  if (onlyDebug) {
    query += ` AND debug = 1`;
  }

  const { results } = await db.prepare(query).all<ChatsRow>();
  return results;
}

export async function countSubscribers(
  db: D1Database,
  subType: SubscriptionType,
  onlyDebug = false,
): Promise<number> {
  let query = `SELECT COUNT(*) as count FROM ${tableName} WHERE ${subType} = 1`;

  if (onlyDebug) {
    query += ` AND debug = 1`;
  }

  const { results } = await db.prepare(query).all<{ count: number }>();
  return results[0]?.count ?? 0;
}


async function isSubscribed(db: D1Database, subType: SubscriptionType, chatId: number): Promise<boolean> {
  const { results } = await db.prepare(`SELECT 1 FROM ${tableName} WHERE id = ? AND ${subType} = 1`)
    .bind(chatId)
    .all<{ "1": number }>();
  
  return results.length > 0;
}

async function setBoolField(
  ctx: any,
  db: D1Database,
  subType: SubscriptionType,
  value: boolean
) {
  const today = new Date().toISOString().split("T")[0];  // yyyy-mm-dd

  await db.prepare(`
    UPDATE ${tableName}
    SET ${subType} = ?, updated_at = ?
    WHERE id = ?
  `)
  .bind(value ? 1 : 0, today, ctx.chat.id)
  .run();
}

function getSubText(subType: SubscriptionType): string {
  switch (subType) {
    case SubscriptionType.EVENTS_LUL:   return "Level Up event";
    case SubscriptionType.EVENTS_IGDA:  return "IGDA event";
    case SubscriptionType.FREE_GAMES:   return "free game";
    case SubscriptionType.DEBUG:        return "debug";
    default:                            return "unknown";
  }
}
