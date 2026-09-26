import { redirect } from "next/navigation";
import { Landing } from "@/components/landing/Landing";
import { driverWallet, isDemoMode } from "@/lib/config";

/** The landing page. Old `/?wallet=` share links still work: they are sent on to the dashboard. */
export default async function Home({ searchParams }: PageProps<"/">) {
  const { wallet } = await searchParams;
  if (typeof wallet === "string" && wallet.length >= 32) redirect(`/app?wallet=${encodeURIComponent(wallet)}`);
  return <Landing driverWallet={driverWallet()} demoMode={isDemoMode()} />;
}
