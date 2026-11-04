"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import DocumentUploader from "@/components/documents/document-uploader";
import { useCurrentUser } from "@/hooks/use-current-user";

export default function MyAccountPage() {
    const router = useRouter();
    const { user, loading } = useCurrentUser();

    useEffect(() => {
        if (!loading && !user) {
            router.replace(
                `/login?returnTo=${encodeURIComponent("/me")}`,
            );
        }
    }, [loading, user, router]);

    if (loading || !user) {
        return (
            <main className="mx-auto max-w-5xl px-5 py-16">
                <p className="text-sm text-zinc-400">
                    Loading your account...
                </p>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
            <div className="mb-8">
                <Link
                    href="/movies"
                    className="text-sm text-zinc-400 transition hover:text-white"
                >
                    ← Back to movies
                </Link>

                <p className="mt-7 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    Account
                </p>

                <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    My Account
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                    Manage your account information and the documents associated
                    with your bookings.
                </p>
            </div>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-7">
                <h2 className="text-lg font-semibold text-white">
                    Account information
                </h2>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500">
                            Name
                        </p>
                        <p className="mt-2 text-sm font-medium text-zinc-200">
                            {user.name || "Not provided"}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500">
                            Email
                        </p>
                        <p className="mt-2 break-all text-sm font-medium text-zinc-200">
                            {user.email || "Not provided"}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500">
                            Phone
                        </p>
                        <p className="mt-2 text-sm font-medium text-zinc-200">
                            {user.phone || "Not provided"}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs uppercase tracking-wider text-zinc-500">
                            Account type
                        </p>
                        <p className="mt-2 text-sm font-medium capitalize text-zinc-200">
                            {user.role.toLowerCase()}
                        </p>
                    </div>
                </div>
            </section>

            <section className="mt-8">
                <div className="mb-5">
                    <h2 className="text-xl font-semibold text-white">
                        My documents
                    </h2>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                        You can save one profile photograph and one identity
                        card. At least one of these documents is required when
                        confirming a booking. Uploading both is optional.
                    </p>
                </div>

                <DocumentUploader />
            </section>

            <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <h2 className="text-sm font-semibold text-white">
                    Document privacy
                </h2>

                <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Documents are stored in private cloud storage. They are
                    associated with your account and are not publicly accessible.
                    The application checks the uploaded file format and size;
                    uploading a document does not constitute identity
                    verification.
                </p>
            </section>
        </main>
    );
}