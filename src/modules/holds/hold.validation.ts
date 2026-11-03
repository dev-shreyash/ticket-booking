
import { z } from "zod";

import { MAX_HOLD_SEATS } from "./hold.constants";

const uuidSchema = z
  .string()
  .uuid("Invalid UUID.")
  .transform((value) => value.toLowerCase());

export const createHoldBodySchema = z
  .object({
    seatIds: z
      .array(uuidSchema)
      .min(1, "Select at least one seat.")
      .max(
        MAX_HOLD_SEATS,
        `You can select a maximum of ${MAX_HOLD_SEATS} seats.`,
      ),
  })
  .strict()
  .superRefine((value, context) => {
    const uniqueIds = new Set(value.seatIds);

    if (uniqueIds.size !== value.seatIds.length) {
      context.addIssue({
        code: "custom",
        path: ["seatIds"],
        message: "Duplicate seat IDs are not allowed.",
      });
    }
  });

export const showIdSchema = uuidSchema;

export const holdIdSchema = uuidSchema;

export type CreateHoldInput = z.infer<
  typeof createHoldBodySchema
>;
