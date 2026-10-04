import type { FC } from "hono/jsx";

type Props = { id: string; name: string; label: string; any: string; value: string | null; options: { value: string; label: string }[] };

/** A GET filter: "any" (empty value) plus fixed options. */
export const SelectFilter: FC<Props> = ({ id, name, label, any, value, options }) => (
  <div class="field">
    <label for={id}>{label}</label>
    <select id={id} name={name}>
      <option value="" selected={value === null}>
        {any}
      </option>
      {options.map((o) => (
        <option value={o.value} selected={o.value === value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);
