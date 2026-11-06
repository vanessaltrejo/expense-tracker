import { FinanceGate } from "@/components/FinanceGate";
import { HomeScreen } from "@/components/home/HomeScreen";

export default function HomePage() {
  return (
    <FinanceGate>
      <HomeScreen />
    </FinanceGate>
  );
}
