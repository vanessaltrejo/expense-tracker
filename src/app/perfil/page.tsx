import type { Metadata } from "next";

import { FinanceGate } from "@/components/FinanceGate";
import { ProfileScreen } from "@/components/profile/ProfileScreen";

// The app only draws these pages after a profile is chosen, and that choice lives in the
// browser, so the server can't prove the page navigates instantly. Opting out keeps the
// dev warning quiet; it does not change how the page works.
export const instant = false;

export const metadata: Metadata = { title: "Perfil" };

export default function ProfilePage() {
  return (
    <FinanceGate>
      <ProfileScreen />
    </FinanceGate>
  );
}
