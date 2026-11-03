"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";

const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Enter your email or mobile number."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type ApiResponse = {
  success: boolean;
  message?: string;
};

export default function LoginForm() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
    },
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          identifier: values.identifier,
        }),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        toast.error(data.message ?? "Unable to request OTP.");
        return;
      }

      toast.success("OTP requested successfully.");

      router.push(
        `/verify-otp?identifier=${encodeURIComponent(
          values.identifier.trim(),
        )}`,
      );
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="identifier"
          className="text-sm font-medium text-zinc-200"
        >
          Email or mobile number
        </label>

        <input
          id="identifier"
          type="text"
          autoComplete="username"
          placeholder="you@example.com or 9876543210"
          {...register("identifier")}
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-zinc-400"
        />

        {errors.identifier && (
          <p className="text-sm text-red-400">
            {errors.identifier.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Requesting OTP..." : "Continue"}
      </button>
    </form>
  );
}