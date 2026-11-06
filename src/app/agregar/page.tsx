import type { Metadata } from "next";
import { Suspense } from "react";

import { AddMovementScreen } from "@/components/add/AddMovementScreen";
import { FinanceGate } from "@/components/FinanceGate";

export const metadata: Metadata = { title: "Agregar movimiento" };

export default function AddMovementPage() {
  return (
    <FinanceGate>
      <Suspense fallback={null}>
        <AddMovementScreen />
      </Suspense>
    </FinanceGate>
  );
}
