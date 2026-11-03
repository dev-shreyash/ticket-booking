
"use client";

import { useState } from "react";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";

const otpSchema = z.object({
  otp: z
    .string()
    .regex(/^\d{6}$/, "Enter the six-digit OTP."),
});

type OtpFormValues = z.infer<typeof otpSchema>;

type ApiResponse = {
  success: boolean;
  message?: string;
};

type VerifyOtpFormProps = {
  identifier: string;
};

function getSafeReturnTo(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return "/";
  }

  try {
    const url = new URL(value, window.location.origin);

    if (url.origin !== window.location.origin) {
      return "/";
    }

    if (
      url.pathname === "/login" ||
      url.pathname === "/verify-otp"
    ) {
      return "/";
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export default function VerifyOtpForm({
  identifier,
}: VerifyOtpFormProps) {
  const router = useRouter();

  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      otp: "",
    },
  });

  async function onSubmit(values: OtpFormValues) {
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({
          identifier,
          otp: values.otp,
        }),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        toast.error(data.message ?? "OTP verification failed.");
        return;
      }

      toast.success("Login successful.");

      // Read the destination preserved during the login process.
      const params = new URLSearchParams(window.location.search);
      const returnTo = getSafeReturnTo(
        params.get("returnTo"),
      );

      // Return the customer to the page they originally opened.
      router.replace(returnTo);
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  async function resendOtp() {
    setResending(true);

    try {
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ identifier }),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.success) {
        toast.error(data.message ?? "Unable to resend OTP.");
        return;
      }

      toast.success("A new demo OTP has been requested.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <p className="text-sm font-medium text-amber-300">
          Demo OTP: 123456
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          For this demonstration, enter the fixed six-digit OTP shown above.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-zinc-400">Verification sent for</p>
        <p className="break-all text-sm font-medium text-white">
          {identifier}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="otp"
            className="text-sm font-medium text-zinc-200"
          >
            Six-digit OTP
          </label>

          <input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            {...register("otp")}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-4 text-center text-2xl tracking-[0.5em] text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-400"
          />

          {errors.otp && (
            <p className="text-sm text-red-400">
              {errors.otp.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Verifying..." : "Verify and sign in"}
        </button>
      </form>

      <button
        type="button"
        onClick={resendOtp}
        disabled={resending}
        className="w-full text-center text-sm text-zinc-400 transition hover:text-white disabled:opacity-50"
      >
        {resending ? "Requesting..." : "Resend OTP"}
      </button>
    </div>
  );
}
