import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Team 7 · Issue Tracker",
  description:
    "Trello-backed issue tracker with an AI assistant. NYU OSPSD Team 7.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-gray-100 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
