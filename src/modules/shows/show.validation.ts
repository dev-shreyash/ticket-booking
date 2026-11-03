import { z } from "zod";

function isRealCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const isoCalendarDateSchema = z
  .string()
  .refine(isRealCalendarDate, "Date must be a valid YYYY-MM-DD calendar date.");

export const showListQuerySchema = z
  .object({
    movieId: z.string().uuid("Invalid movie ID.").optional(),
    theatreId: z.string().uuid("Invalid theatre ID.").optional(),
    city: z.string().trim().min(1).max(120).optional(),
    date: isoCalendarDateSchema.optional(),
  })
  .strict();

export const showIdSchema = z.string().uuid("Invalid show ID.");

export type ShowListQuery = z.infer<typeof showListQuerySchema>;
