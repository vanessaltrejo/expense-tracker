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
    <section className="card">
      <h2 className="card-title">Bolsas y crédito</h2>

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
    </section>
  );
}
