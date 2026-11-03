import type { Metadata } from "next";

import { Toaster } from "sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: "Movie Ticket Booking",
  description: "Movie, show and seat booking application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}