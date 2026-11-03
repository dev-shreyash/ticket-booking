import { z } from "zod";

export const createBookingSchema = z
  .object({
    holdId: z.string().uuid().transform((value) => value.toLowerCase()),
  })
  .strict();

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(16)
  .max(128)
  .regex(
    /^[A-Za-z0-9._:-]+$/,
    "Invalid idempotency key format.",
  );

export const bookingListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});