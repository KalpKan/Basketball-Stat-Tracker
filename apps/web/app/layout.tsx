import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Hoops Analytics",
  description: "Basketball shooting analytics dashboard"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
