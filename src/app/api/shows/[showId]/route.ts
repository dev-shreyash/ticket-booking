import { apiErrorResponse, successResponse, validationErrorResponse } from "@/lib/api-response";
import { getShowDetails } from "@/modules/shows/show.service";
import { showIdSchema } from "@/modules/shows/show.validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ showId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { showId } = await context.params;
  const validation = showIdSchema.safeParse(showId);

  if (!validation.success) {
    return validationErrorResponse(validation.error);
  }

  try {
    const show = await getShowDetails(validation.data);
    return successResponse({ data: show });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
