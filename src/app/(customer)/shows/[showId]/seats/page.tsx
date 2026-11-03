import type { Metadata } from "next";

import SeatMap from "@/components/seats/seat-map";

type SeatSelectionPageProps = {
  params: Promise<{
    showId: string;
  }>;
};

export const metadata: Metadata = {
  title: "Select Seats | Movie Ticket Booking",
  description: "View the seating layout and select available seats.",
};

export default async function SeatSelectionPage({
  params,
}: SeatSelectionPageProps) {
  const { showId } = await params;

  return <SeatMap showId={showId} />;
}