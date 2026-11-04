
import { NextResponse } from "next/server";

import {
    apiErrorResponse,
    successResponse,
} from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";

import { getCustomerDocuments } from "@/modules/documents/document.service";

export async function GET() {
    try {
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

        const data = await getCustomerDocuments(user.id);

        const response = successResponse({ data });

        response.headers.set(
            "Cache-Control",
            "private, no-store, no-cache, max-age=0, must-revalidate",
        );

        return response;
    } catch (error) {
        return apiErrorResponse(error);
    }
}
