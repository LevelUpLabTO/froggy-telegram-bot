import { escapeMarkdownV2IgnoreLinks as escMD } from "./md-helpers.js";

export const WELCOME_MESSAGE = (
`*🐸 Welcome\\, I'm Froggy\\!*
${escMD(`I'm the bot of [LevelUp Lab](https://leveluplab.it), student team of [Politecnico di Torino](https://www.polito.it/).
Type /help to see what I can do.`)}`
);

export const HELP_MESSAGE = (
`*LevelUp Events*
${escMD(`/events – Get upcoming LevelUp events
/start_events – Subscribe to event reminders
/stop_events – Unsubscribe from event reminders`)}

*Free games*
${escMD(`/freegames – Get the latest deals
/start_freegames – Subscribe to weekly notifications
/stop_freegames – Unsubscribe from weekly notifications`)}`
);
