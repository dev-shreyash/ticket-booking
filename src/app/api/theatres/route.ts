import { apiErrorResponse, successResponse, validationErrorResponse } from "@/lib/api-response";
import { listTheatres } from "@/modules/theatres/theatre.service";
import { theatreListQuerySchema } from "@/modules/theatres/theatre.validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const validation = theatreListQuerySchema.safeParse(params);

  if (!validation.success) {
    return validationErrorResponse(validation.error);
  }

  try {
    const result = await listTheatres(validation.data);
    return successResponse(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
