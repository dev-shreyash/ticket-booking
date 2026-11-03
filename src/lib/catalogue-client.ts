import type { ApiResponse } from "@/types/catalogue";

export async function fetchCatalogue<T>(
  url: string,
  signal?: AbortSignal,
): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });

  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.success) {
    throw new Error(
      payload.message ?? "Unable to load catalogue data.",
    );
  }

  return payload;
}