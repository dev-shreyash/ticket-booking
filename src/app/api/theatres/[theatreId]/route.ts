
import {
  apiErrorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";

import { getTheatreDetails } from "@/modules/theatres/theatre.service";
import { theatreIdSchema } from "@/modules/theatres/theatre.validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TheatreRouteContext = {
  params: Promise<{ theatreId: string }>;
};

export async function GET(
  _request: Request,
  context: TheatreRouteContext,
) {
  const { theatreId } = await context.params;
  const validation = theatreIdSchema.safeParse(theatreId);

  if (!validation.success) {
    return validationErrorResponse(validation.error);
  }

  try {
    const theatre = await getTheatreDetails(validation.data);

    return successResponse({ data: theatre });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
