import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jagantara — evidence-aware heritage discovery",
  description:
    "Trace a place through sourced history, attributed memory, and Qloo-powered cultural discovery.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
