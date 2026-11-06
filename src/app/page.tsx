import { FinanceGate } from "@/components/FinanceGate";
import { HomeScreen } from "@/components/home/HomeScreen";

// The app only draws these pages after a profile is chosen, and that choice lives in the
// browser, so the server can't prove the page navigates instantly. Opting out keeps the
// dev warning quiet; it does not change how the page works.
export const instant = false;

export default function HomePage() {
  return (
    <FinanceGate>
      <HomeScreen />
    </FinanceGate>
  );
}
