
import type { Metadata } from "next";

import TheatreDetails from "@/components/theatres/theatre-details";

type TheatrePageProps = {
  params: Promise<{ theatreId: string }>;
};

export const metadata: Metadata = {
  title: "Theatre Details | Movie Ticket Booking",
  description: "Explore theatre information, movies and upcoming showtimes.",
};

export default async function TheatreDetailsPage({
  params,
}: TheatrePageProps) {
  const { theatreId } = await params;

  return <TheatreDetails theatreId={theatreId} />;
}
