"use client";

import { ENDPOINT_LABELS } from "@/domain/ledger";
import { formatMoney } from "@/domain/money";
import type { PocketId } from "@/domain/types";
import { useFinance } from "../FinanceProvider";
import { getUsageTone, POCKET_STYLES } from "../ui/styles";

const POCKETS: PocketId[] = ["cajita", "banorte", "efectivo", "porCobrarMama"];

export function PocketsDetails() {
  const { data, dashboard } = useFinance();
  const { balances, debt, creditLeft } = dashboard;
  const limit = data.settings.cardLimit;
  const usedPercent = limit > 0 ? Math.min(100, Math.max(0, (debt / limit) * 100)) : 0;
  const usage = getUsageTone(usedPercent);

  return (
    <details className="card group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-medium [&::-webkit-details-marker]:hidden">
        Bolsas y crédito
        <span aria-hidden="true" className="text-ink-soft transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>

      <ul className="grid grid-cols-2 gap-2">
        {POCKETS.map((pocket) => (
          <li key={pocket} className={`rounded-xl p-3 ${POCKET_STYLES[pocket].soft}`}>
            <p className={`text-xs font-semibold ${POCKET_STYLES[pocket].text}`}>
              {ENDPOINT_LABELS[pocket]}
            </p>
            <p className="amount mt-0.5 font-semibold">{formatMoney(balances[pocket])}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-soft">
        &ldquo;Por cobrar&rdquo; cuenta en tu libre de verdad, pero no sirve para pagar la tarjeta hasta que te lo regresen.
      </p>

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <div className="flex justify-between gap-3">
          <span className="text-ink-soft">Crédito disponible</span>
          <span className="amount font-semibold">{formatMoney(creditLeft)}</span>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-page"
          role="img"
          aria-label={`Usas ${usedPercent.toFixed(1)}% de tu límite`}
        >
          <div className={`h-full rounded-full ${usage.bar}`} style={{ width: `${usedPercent}%` }} />
        </div>
        <p className="amount text-sm text-ink-soft">
          Usas <span className={`font-semibold ${usage.text}`}>{usedPercent.toFixed(1)}%</span>{" "}
          de {formatMoney(limit)}
        </p>
      </div>
    </details>
  );
}
