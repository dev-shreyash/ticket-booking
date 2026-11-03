import type { Metadata } from "next";

import ShowDetails from "@/components/shows/show-details";

type ShowPageProps = {
  params: Promise<{ showId: string }>;
};

export const metadata: Metadata = {
  title: "Show Details | Movie Ticket Booking",
};

export default async function ShowDetailsPage({ params }: ShowPageProps) {
  const { showId } = await params;
  return <ShowDetails showId={showId} />;
}
