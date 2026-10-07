import type { FC, PropsWithChildren } from "hono/jsx";

export const HomeSection: FC<PropsWithChildren<{ id: string; title: string }>> = ({ id, title, children }) => (
  <section id={id} class="lp-section home-block" aria-labelledby={`${id}-title`}>
    <div class="container">
      <div class="section-head">
        <h2 id={`${id}-title`}>{title}</h2>
      </div>
      {children}
    </div>
  </section>
);
