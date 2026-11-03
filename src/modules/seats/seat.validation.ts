import { z } from "zod";

export const seatMapShowIdSchema = z
  .string()
  .uuid("Invalid show ID.");

export type SeatMapShowId = z.infer<
  typeof seatMapShowIdSchema
>;