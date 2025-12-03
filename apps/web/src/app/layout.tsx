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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.global = window;`,
          }}
        />
      </head>
      <body className="antialiased">
        <div className="h-screen flex flex-col">
          {/* Draggable zone for window - reserve space for macOS traffic lights */}
          <div
            className="h-10 draggable flex-shrink-0 bg-white"
            style={{ paddingLeft: "80px" }}
          />
          <div className="flex-1 overflow-hidden">{children}</div>
        </div>
      </body>
    </html>
  );
}
