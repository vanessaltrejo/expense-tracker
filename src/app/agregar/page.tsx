import type { Metadata } from "next";
import { Suspense } from "react";

import { AddMovementScreen } from "@/components/add/AddMovementScreen";
import { FinanceGate } from "@/components/FinanceGate";

// The app only draws these pages after someone signs in, which is checked in the
// browser, so the server can't prove the page navigates instantly. Opting out keeps the
// dev warning quiet; it does not change how the page works.
export const instant = false;

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
