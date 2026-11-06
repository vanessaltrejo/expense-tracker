import type { Metadata } from "next";

import { FinanceGate } from "@/components/FinanceGate";
import { ProfileScreen } from "@/components/profile/ProfileScreen";

export const metadata: Metadata = { title: "Perfil" };

export default function ProfilePage() {
  return (
    <FinanceGate>
      <ProfileScreen />
    </FinanceGate>
  );
}
