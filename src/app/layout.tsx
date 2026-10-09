import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import { getSiteConfig } from "@/lib/config/site";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], display: "swap", weight: ["500", "600", "700"] });

export function generateMetadata(): Metadata {
  const site = getSiteConfig();
  return {
    metadataBase: new URL(site.url),
    title: { default: site.tagline ? `Workido · ${site.tagline}` : "Workido", template: "%s · Workido" },
    description: site.description,
    applicationName: "Workido",
    openGraph: { siteName: "Workido", type: "website", description: site.description },
  };
}

export const viewport: Viewport = {
  themeColor: "#FFFDF8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="top-center" toastOptions={{ classNames: { toast: "!rounded-2xl !border-border !font-sans" } }} />
      </body>
    </html>
  );
}
