import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Through - Project Analyzer",
  description: "Analyze and launch your development projects",
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
