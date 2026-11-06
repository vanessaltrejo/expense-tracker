import type { CategoryComparison } from "@/domain/dashboard";
import { formatMonthName } from "@/domain/dates";
import { formatMoney } from "@/domain/money";
import { formatCategory } from "../ui/styles";

interface CategoryChartProps {
  categories: CategoryComparison[];
  thisMonthKey: string;
  lastMonthKey: string;
}

function Bar({
  value,
  max,
  colorClass,
  label,
}: {
  value: number;
  max: number;
  colorClass: string;
  label: string;
}) {
  const width = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
      <div className="h-2.5">
        {value > 0 ? (
          <div
            className={`h-full min-w-1 rounded-r ${colorClass}`}
            style={{ width: `${width}%` }}
          />
        ) : null}
      </div>
      <span className="amount w-24 text-right text-sm">
        <span className="sr-only">{label}: </span>
        {formatMoney(value)}
      </span>
    </div>
  );
}

/** Each bar has its value printed beside it, so nothing depends on color or on hovering. */
export function CategoryChart({
  categories,
  thisMonthKey,
  lastMonthKey,
}: CategoryChartProps) {
  const thisMonthName = formatMonthName(thisMonthKey);
  const lastMonthName = formatMonthName(lastMonthKey);
  const max = Math.max(
    ...categories.map((row) => Math.max(row.thisMonth, row.lastMonth)),
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex gap-4 text-sm text-ink-soft" aria-label="Leyenda">
        <li className="flex items-center gap-1.5 first-letter:uppercase">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-chart-current" />
          <span className="first-letter:uppercase">{thisMonthName}</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-chart-previous" />
          <span className="first-letter:uppercase">{lastMonthName}</span>
        </li>
      </ul>

      <ul className="flex flex-col gap-4">
        {categories.map((row) => (
          <li key={row.category} className="flex flex-col gap-1">
            <p className="text-sm font-medium">{formatCategory(row.category)}</p>
            <Bar
              value={row.thisMonth}
              max={max}
              colorClass="bg-chart-current"
              label={thisMonthName}
            />
            <Bar
              value={row.lastMonth}
              max={max}
              colorClass="bg-chart-previous"
              label={lastMonthName}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
