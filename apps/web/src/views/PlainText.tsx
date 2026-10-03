import type { FC } from "hono/jsx";
import { parsePlainText } from "../domain/text.ts";

export const PlainText: FC<{ text: string }> = ({ text }) => (
  <div class="prose">
    {parsePlainText(text).map((block) =>
      block.kind === "p" ? (
        <p>{block.text}</p>
      ) : (
        <ul>
          {block.items.map((item) => (
            <li>{item}</li>
          ))}
        </ul>
      ),
    )}
  </div>
);
