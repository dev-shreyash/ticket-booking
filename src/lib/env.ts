import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z
    .string()
    .url("DATABASE_URL must be a valid PostgreSQL connection URL")
    .refine(
      (value) => {
        const protocol = new URL(value).protocol;
        return protocol === "postgres:" || protocol === "postgresql:";
      },
      "DATABASE_URL must use postgres:// or postgresql://",
    ),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must contain at least 32 characters"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

export type ServerEnvironment = z.infer<typeof environmentSchema>;

let cachedEnvironment: ServerEnvironment | undefined;

/** Validate server environment variables lazily at the server/database boundary. */
export function getServerEnvironment(): ServerEnvironment {
  if (cachedEnvironment) {
    return cachedEnvironment;
  }

  const result = environmentSchema.safeParse(process.env);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid environment configuration: ${details}`);
  }

  cachedEnvironment = result.data;
  return cachedEnvironment;
}
