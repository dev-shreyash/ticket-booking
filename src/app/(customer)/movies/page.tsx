import type { Metadata } from "next";

import MovieCatalogue from "@/components/movies/movie-catalogue";

export const metadata: Metadata = {
  title: "Movies | Movie Ticket Booking",
  description: "Browse movies and discover upcoming screenings.",
};

export default function MoviesPage() {
  return <MovieCatalogue />;
}
