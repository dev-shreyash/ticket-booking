export type CreatedSeatHold = {
  holdId: string;
  showId: string;
  seatIds: string[];
  expiresAt: string;
  durationSeconds: number;
};

type CreateHoldResponse = {
  success: boolean;
  message?: string;
  data?: CreatedSeatHold;
};

export async function createSeatHoldRequest(
  showId: string,
  seatIds: string[],
): Promise<CreatedSeatHold> {
  const response = await fetch(`/api/shows/${showId}/holds`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      seatIds,
    }),
  });

  const result = (await response.json()) as CreateHoldResponse;

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.message ?? "Unable to hold the selected seats.");
  }

  return result.data;
}