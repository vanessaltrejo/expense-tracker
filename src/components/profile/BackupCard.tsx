"use client";

import { exportBackup } from "@/services/financeService";
import { useFinance } from "../FinanceProvider";

async function downloadBackup(today: string) {
  const json = await exportBackup();
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `mis-gastos-respaldo-${today}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function BackupCard() {
  const { today } = useFinance();

  return (
    <section className="card">
      <h2 className="card-title">Respaldo</h2>
      <p className="text-sm text-ink-soft">
        Una copia de todo en un archivo, por si algún día pierdes el acceso a tu Sheets.
      </p>
      <button
        type="button"
        className="btn-secondary min-h-12"
        onClick={() => void downloadBackup(today)}
      >
        Descargar respaldo (JSON)
      </button>
    </section>
  );
}
