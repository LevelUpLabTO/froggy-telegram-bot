const specialCharsRegex = /[_*\[\]()~`>#+-=|{}.!]/g;

// Regex to match MarkdownV2 links: [display](url)
const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;


export function escapeMarkdownV2(text: string): string {
  return text.replace(specialCharsRegex, '\\$&');
}

export function escapeMarkdownV2IgnoreLinks(text: string): string {
  let lastIndex = 0;
  let result = '';
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    // Escape everything before the link
    const before = text.slice(lastIndex, match.index);
    result += before.replace(specialCharsRegex, '\\$&');

    // Keep the link itself as-is
    result += match[0];

    lastIndex = match.index + match[0].length;
  }

  // Escape the text after the last link
  const after = text.slice(lastIndex);
  result += after.replace(specialCharsRegex, '\\$&');

  return result;
}
