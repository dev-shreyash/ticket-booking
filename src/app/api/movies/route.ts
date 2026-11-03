import { NextResponse } from "next/server";

import { apiErrorResponse, successResponse, validationErrorResponse } from "@/lib/api-response";
import { listMovies } from "@/modules/movies/movie.service";
import { movieListQuerySchema } from "@/modules/movies/movie.validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const validation = movieListQuerySchema.safeParse(params);

  if (!validation.success) {
    return validationErrorResponse(validation.error);
  }

  try {
    const result = await listMovies(validation.data);
    return successResponse(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
