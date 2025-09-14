import { EpicFreeGames } from 'epic-free-games';

export async function fetchFreeGames(): Promise<string> {
  try {
    const epic = new EpicFreeGames({
      country: 'US',       // your region
      locale: 'en-US',     // language
      includeAll: false    // include upcoming free games too
    });

    const games = await epic.getGames();
    if (!games.currentGames || games.currentGames.length === 0) {
     return "No free games are currently available.";
    }

    let message = '*Current Free Games*\n\n';
    message += `_Found ${games.currentGames.length} from [Epic Games](https://store.epicgames.com/en-US/free-games)_\n`;
    games.currentGames.forEach(game => {
      const url = null;  //`https://store.epicgames.com/en-US/p/${game.urlSlug}`;
      const title = `[${game.title}](${url})`;
      const metadata =  escapeMarkdownV2(` - (${game.price.totalPrice.fmtPrice.originalPrice})`);

      message += `• ${title}${metadata}\n`;
    });

    return message;

  } catch (err) {
    const errorMessage = `Error fetching free games: ${err}`;
    console.error(errorMessage);
    return errorMessage;
  }
}

function escapeMarkdownV2(text: string): string {
  const specialChars = /[_*\[\]()~`>#+-=|{}.!]/g;
  return text.replace(specialChars, '\\$&');
}