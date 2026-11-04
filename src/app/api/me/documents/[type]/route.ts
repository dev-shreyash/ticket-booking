
import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/csrf";
import { documentTypeSchema } from "@/lib/document-validation";

import { removeCustomerDocument } from "@/modules/documents/document.service";

type RouteContext = {
  params: Promise<{
    type: string;
  }>;
};

export async function DELETE(
  request: Request,
  { params }: RouteContext,
) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request origin.",
          code: "INVALID_ORIGIN",
        },
        { status: 403 },
      );
    }

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required. Please sign in.",
          code: "UNAUTHENTICATED",
        },
        { status: 401 },
      );
    }

    const { type } = await params;
    const result = documentTypeSchema.safeParse(type);

    if (!result.success) {
      return validationErrorResponse(result.error);
    }

    const data = await removeCustomerDocument(
      user.id,
      result.data,
    );

    return successResponse({ data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
