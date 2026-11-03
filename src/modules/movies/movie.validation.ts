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

export const movieListQuerySchema = z
  .object({
    page: pageSchema,
    limit: limitSchema,
    search: z.string().trim().max(100, "Search is too long.").optional(),
    language: z.string().trim().min(1).max(80).optional(),
    genre: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const movieIdSchema = z.string().uuid("Invalid movie ID.");

export type MovieListQuery = z.infer<typeof movieListQuerySchema>;
