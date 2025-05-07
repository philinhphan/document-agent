
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Make sure Tailwind globals are imported

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Conversational Coach",
  description: "MVP for querying knowledge resources",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <main className="container mx-auto p-4">
          {children}
        </main>
      </body>
    </html>
  );
}