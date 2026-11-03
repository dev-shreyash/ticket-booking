import { apiErrorResponse, successResponse, validationErrorResponse } from "@/lib/api-response";
import { getMovieDetails } from "@/modules/movies/movie.service";
import { movieIdSchema } from "@/modules/movies/movie.validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ movieId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { movieId } = await context.params;
  const validation = movieIdSchema.safeParse(movieId);

  if (!validation.success) {
    return validationErrorResponse(validation.error);
  }

  try {
    const movie = await getMovieDetails(validation.data);
    return successResponse({ data: movie });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
