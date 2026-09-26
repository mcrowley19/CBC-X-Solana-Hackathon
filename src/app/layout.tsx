import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { WalletProviders } from "@/components/WalletProviders";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz"] });
const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500", "600"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Logbook — paid by the mile",
  description: "Drivers earn MILE tokens on Solana for every minute of dashcam footage and every annotated road event.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${plex.variable} ${jetbrains.variable} antialiased`}>
      <body className="min-h-screen">
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
