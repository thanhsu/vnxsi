export type TextBlock = { kind: "p"; text: string } | { kind: "ul"; items: string[] };

const BULLET = /^\s*-\s+(.*)$/;

export function parsePlainText(input: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  const paragraphs = input.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  for (const paragraph of paragraphs) {
    let lines: string[] = [];
    let items: string[] = [];
    const flushLines = () => {
      if (lines.length) blocks.push({ kind: "p", text: lines.join("\n") });
      lines = [];
    };
    const flushItems = () => {
      if (items.length) blocks.push({ kind: "ul", items });
      items = [];
    };
    for (const raw of paragraph.split("\n")) {
      if (!raw.trim()) continue;
      const bullet = BULLET.exec(raw);
      if (bullet) {
        flushLines();
        items.push((bullet[1] ?? "").trim());
      } else {
        flushItems();
        lines.push(raw.trim());
      }
    }
    flushLines();
    flushItems();
  }
  return blocks;
}
