import type { Metadata } from "next";

import TheatreCatalogue from "@/components/theatres/theatre-catalogue";

export const metadata: Metadata = {
  title: "Theatres | Movie Ticket Booking",
  description: "Browse participating movie theatres.",
};

export default function TheatresPage() {
  return <TheatreCatalogue />;
}
