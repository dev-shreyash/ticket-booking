
import { z } from "zod";

const pageSchema = z
  .string()
  .regex(/^\d+$/, "Page must be a positive integer.")
  .default("1")
  .transform(Number)
  .pipe(z.number().int().min(1).max(100_000));

const limitSchema = z
  .string()
  .regex(/^\d+$/, "Limit must be a positive integer.")
  .default("12")
  .transform(Number)
  .pipe(z.number().int().min(1).max(50));

export const theatreListQuerySchema = z
  .object({
    page: pageSchema,
    limit: limitSchema,
    city: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const theatreIdSchema = z.string().uuid("Invalid theatre ID.");

export type TheatreListQuery = z.infer<typeof theatreListQuerySchema>;
