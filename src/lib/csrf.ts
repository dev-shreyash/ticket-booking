import { getServerEnvironment } from "@/lib/env";

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    const expectedOrigin = new URL(
      getServerEnvironment().NEXT_PUBLIC_APP_URL,
    ).origin;

    const receivedOrigin = new URL(origin).origin;

    return receivedOrigin === expectedOrigin;
  } catch {
    return false;
  }
}