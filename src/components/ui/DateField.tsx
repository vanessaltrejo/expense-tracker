"use client";

import type { IsoDate } from "@/domain/types";

/** The "Fecha" field of the add forms: today by default, any earlier day when it was recorded late. */
export function DateField({
  value,
  max,
  onChange,
}: {
  value: IsoDate;
  /** Last day that can be picked, normally today. */
  max: IsoDate;
  onChange: (value: IsoDate) => void;
}) {
  return (
    <label className="field-label">
      Fecha
      <input
        className="field"
        type="date"
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
