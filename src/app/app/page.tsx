import { Dashboard } from "@/components/dashboard/Dashboard";
import { driverWallet, isDemoMode } from "@/lib/config";

/**
 * The dashboard always opens on the account set in DRIVER_WALLET, the wallet the dashcam pays out to.
 * `/app?wallet=<address>` still opens any other wallet's logbook read-only.
 */
export default async function AppHome({ searchParams }: PageProps<"/app">) {
  const { wallet } = await searchParams;
  const address = typeof wallet === "string" && wallet.length >= 32 ? wallet : driverWallet();
  return <Dashboard demoMode={isDemoMode()} address={address} />;
}
