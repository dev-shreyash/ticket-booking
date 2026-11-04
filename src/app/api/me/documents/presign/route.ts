
import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/csrf";
import { documentPresignSchema } from "@/lib/document-validation";

import { createPresignedDocumentUpload } from "@/modules/documents/document.service";

export async function POST(request: Request) {
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

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid JSON request body.",
          code: "INVALID_DOCUMENT_REQUEST",
        },
        { status: 400 },
      );
    }

    const result = documentPresignSchema.safeParse(body);

    if (!result.success) {
      return validationErrorResponse(result.error);
    }

    const data = await createPresignedDocumentUpload(
      user.id,
      result.data,
    );

    return successResponse({ data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
