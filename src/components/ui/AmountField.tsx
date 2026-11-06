"use client";

interface AmountFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  autoFocus?: boolean;
  /** Large version for the main amount of a form, where the number is the point. */
  size?: "normal" | "large";
}

export function AmountField({
  label,
  value,
  onChange,
  hint,
  autoFocus,
  size = "normal",
}: AmountFieldProps) {
  const isLarge = size === "large";

  return (
    <label className="field-label">
      {label}
      <span className="relative flex items-center">
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-3 text-ink-soft ${
            isLarge ? "text-2xl" : "text-base"
          }`}
        >
          $
        </span>
        <input
          className={`field amount pl-7 ${
            isLarge ? "min-h-16 pl-8 text-3xl font-semibold text-ink" : ""
          }`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
      {hint ? <span className="text-xs font-normal">{hint}</span> : null}
    </label>
  );
}
