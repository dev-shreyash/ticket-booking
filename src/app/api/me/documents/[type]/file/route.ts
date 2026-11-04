
import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { documentTypeSchema } from "@/lib/document-validation";

import { getCustomerDocumentFile } from "@/modules/documents/document.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    type: string;
  }>;
};

const PRIVATE_FILE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
};

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required. Please sign in.",
          code: "UNAUTHENTICATED",
        },
        {
          status: 401,
          headers: PRIVATE_FILE_HEADERS,
        },
      );
    }

    const { type } = await params;
    const result = documentTypeSchema.safeParse(type);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid document type.",
          code: "INVALID_DOCUMENT_TYPE",
        },
        {
          status: 400,
          headers: PRIVATE_FILE_HEADERS,
        },
      );
    }

    const document = await getCustomerDocumentFile(
      user.id,
      result.data,
    );

    const fallbackFileName = document.fileName.replace(
      /["\\\r\n]/g,
      "_",
    );

    const encodedFileName = encodeURIComponent(document.fileName);

    return new Response(new Uint8Array(document.bytes), {
      status: 200,
      headers: {
        ...PRIVATE_FILE_HEADERS,
        "Content-Type": document.contentType,
        "Content-Length": String(document.fileSize),
        "Content-Disposition":
          `inline; filename="${fallbackFileName}"; filename*=UTF-8''${encodedFileName}`,
      },
    });
  } catch (error) {
    const response = apiErrorResponse(error);

    Object.entries(PRIVATE_FILE_HEADERS).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }
}
