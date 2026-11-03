import type { Metadata } from "next";

import MovieDetails from "@/components/movies/movie-details";

type MoviePageProps = {
  params: Promise<{ movieId: string }>;
};

export const metadata: Metadata = {
  title: "Movie Details | Movie Ticket Booking",
};

export default async function MovieDetailsPage({ params }: MoviePageProps) {
  const { movieId } = await params;
  return <MovieDetails movieId={movieId} />;
}
