"use client";

import { useState } from "react";

import { formatCategory, getCategoryIcon } from "../ui/styles";

/** One row of four tiles is enough to scan; the rest hides behind "Más". */
const COLUMNS = 4;
const VISIBLE_WITH_MORE = COLUMNS * 2 - 1;

/**
 * Categories as a grid of icon tiles instead of a long list of pills: four per row, so
 * a dozen categories take three short rows. When there are more than two rows' worth,
 * the first ones show and "Más" opens the rest in place.
 */
export function CategoryPicker({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string | null;
  onChange: (category: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isCrowded = options.length > COLUMNS * 2;

  let visible = options;
  if (isCrowded && !expanded) {
    visible = options.slice(0, VISIBLE_WITH_MORE);
    // A choice made from the hidden ones stays in view instead of vanishing.
    if (value && options.includes(value) && !visible.includes(value)) {
      visible = [...visible.slice(0, VISIBLE_WITH_MORE - 1), value];
    }
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1.5 text-sm font-medium text-ink-soft">Categoría</legend>
      <div className="grid grid-cols-4 gap-2">
        {visible.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            className="tile"
            onClick={() => onChange(option)}
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              {getCategoryIcon(option)}
            </span>
            <span
              className={`line-clamp-2 w-full leading-tight wrap-break-word ${
                option.length > 12 ? "text-[0.5625rem]" : "text-[0.6875rem]"
              }`}
            >
              {formatCategory(option)}
            </span>
          </button>
        ))}
        {isCrowded ? (
          <button
            type="button"
            aria-expanded={expanded}
            className="tile text-ink-soft"
            onClick={() => setExpanded(!expanded)}
          >
            <span aria-hidden="true" className="text-2xl leading-none">
              {expanded ? "▴" : "⋯"}
            </span>
            <span className="text-[0.6875rem] leading-tight">{expanded ? "Menos" : "Más"}</span>
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}
