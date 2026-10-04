import type { FC } from "hono/jsx";
import { localizedPath, type Locale } from "../i18n/locales.ts";
import { translator } from "../i18n/t.ts";
import { Layout } from "./Layout.tsx";

export type ErrorKind = "notFound" | "forbidden" | "conflict" | "server";

export const ErrorPage: FC<{ locale: Locale; origin: string; rest: string; kind: ErrorKind; reference?: string }> = (props) => {
  const tr = translator(props.locale);
  const title = tr(`error.${props.kind}.title`);
  const body = props.kind === "server" ? tr("error.server.body", { id: props.reference ?? "-" }) : tr(`error.${props.kind}.body`);
  return (
    <Layout locale={props.locale} title={title} origin={props.origin} rest={props.rest} noindex>
      <section class="error">
        <h1>{title}</h1>
        <p>{body}</p>
        <p>
          <a href={localizedPath(props.locale, "/")}>{tr("error.backHome")}</a>
        </p>
      </section>
    </Layout>
  );
};
