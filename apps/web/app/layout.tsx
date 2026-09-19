import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PostHogProvider } from "../components/posthog-provider";

const description =
  "Shot maps, session stats and progress for mini-hoop shooting sessions sent through the Basketball Stat Tracker ingest API. The iPhone capture app is not available yet.";

export const metadata: Metadata = {
  title: "Hoops Analytics",
  description,
  metadataBase: new URL("https://hoops.kalpkan.com"),
  icons: { icon: "/basketball-logo.svg" },
  openGraph: {
    title: "Hoops Analytics",
    description,
    url: "https://hoops.kalpkan.com",
    siteName: "Hoops Analytics",
    type: "website"
  },
  twitter: { card: "summary", title: "Hoops Analytics", description }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
