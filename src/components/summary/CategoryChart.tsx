import type { CategoryShare } from "@/domain/dashboard";
import { formatMoney } from "@/domain/money";
import { formatCategory, getCategoryIcon } from "../ui/styles";

/** One bar per category. Every bar has its amount and its percentage printed beside it. */
export function CategoryChart({ categories }: { categories: CategoryShare[] }) {
  const max = Math.max(...categories.map((row) => row.amount), 0);

  return (
    <ul className="flex flex-col gap-4">
      {categories.map((row) => (
        <li key={row.category} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span aria-hidden="true">{getCategoryIcon(row.category)}</span>
              {formatCategory(row.category)}
            </p>
            <p className="amount text-sm">
              <span className="font-semibold">{formatMoney(row.amount)}</span>
              <span className="text-ink-soft"> · {Math.round(row.share * 100)}%</span>
            </p>
          </div>
          <div className="h-2.5 rounded-full bg-page" aria-hidden="true">
            <div
              className="h-full min-w-1 rounded-full bg-chart-current"
              style={{ width: `${max > 0 ? (row.amount / max) * 100 : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
