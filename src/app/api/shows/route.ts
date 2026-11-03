import { apiErrorResponse, successResponse, validationErrorResponse } from "@/lib/api-response";
import { listShows } from "@/modules/shows/show.service";
import { showListQuerySchema } from "@/modules/shows/show.validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const validation = showListQuerySchema.safeParse(params);

  if (!validation.success) {
    return validationErrorResponse(validation.error);
  }

  try {
    const shows = await listShows(validation.data);
    return successResponse({ data: shows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
