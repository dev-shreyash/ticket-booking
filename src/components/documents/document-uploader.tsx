
"use client";

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type ChangeEvent,
} from "react";
import { toast } from "sonner";

type DocumentType = "PROFILE_PHOTO" | "ID_CARD";

type CustomerDocument = {
    id: string;
    type: DocumentType;
    fileName: string;
    contentType: string;
    fileSize: number;
    createdAt: string;
    updatedAt: string;
    viewUrl: string;
};

type ApiResponse<T> = {
    success: boolean;
    data?: T;
    message?: string;
};

type PresignData = {
    uploadUrl: string;
    objectKey: string;
    requiredHeaders: {
        "Content-Type": string;
    };
};

type DocumentUploaderProps = {
    required?: boolean;
    onEligibilityChange?: (
        hasRequiredDocument: boolean,
        loading: boolean,
    ) => void;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const DOCUMENT_CONFIG: Record<
    DocumentType,
    {
        title: string;
        description: string;
        accept: string;
        formats: string;
    }
> = {
    PROFILE_PHOTO: {
        title: "Profile photograph",
        description: "Upload a recent photograph.",
        accept: "image/jpeg,image/png,image/webp",
        formats: "JPG, PNG or WebP",
    },
    ID_CARD: {
        title: "Identity card",
        description: "Upload an identity document.",
        accept: "image/jpeg,image/png,application/pdf",
        formats: "JPG, PNG or PDF",
    },
};

function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function readApiResponse<T>(
    response: Response,
): Promise<ApiResponse<T>> {
    try {
        return (await response.json()) as ApiResponse<T>;
    } catch {
        throw new Error("The server returned an invalid response.");
    }
}

export default function DocumentUploader({
    required = false,
    onEligibilityChange,
}: DocumentUploaderProps) {
    const [documents, setDocuments] = useState<CustomerDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyType, setBusyType] = useState<DocumentType | null>(null);
    const [error, setError] = useState<string | null>(null);

    const photoInputRef = useRef<HTMLInputElement>(null);
    const idCardInputRef = useRef<HTMLInputElement>(null);

    const hasRequiredDocument = documents.length > 0;

    // Performs the actual fetch without synchronously changing loading state.
    // This is safe to invoke from the initial useEffect.
    const fetchDocuments = useCallback(async () => {
        try {
            const response = await fetch("/api/me/documents", {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store",
            });

            const result =
                await readApiResponse<CustomerDocument[]>(response);

            if (!response.ok || !result.success || !result.data) {
                throw new Error(
                    result.message ?? "Unable to load your documents.",
                );
            }

            setDocuments(result.data);
            setError(null);
        } catch (caught) {
            const message =
                caught instanceof Error
                    ? caught.message
                    : "Unable to load your documents.";

            setError(message);
            setDocuments([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial loading uses the initial loading=true state.
    useEffect(() => {
        void fetchDocuments();
    }, [fetchDocuments]);

    // Manual refresh explicitly enables the loading state.
    const loadDocuments = useCallback(async () => {
        setLoading(true);
        setError(null);

        await fetchDocuments();
    }, [fetchDocuments]);

    useEffect(() => {
        onEligibilityChange?.(hasRequiredDocument, loading);
    }, [hasRequiredDocument, loading, onEligibilityChange]);

    function getDocument(type: DocumentType) {
        return documents.find((document) => document.type === type);
    }

    function validateFile(file: File, type: DocumentType) {
        if (file.size <= 0) {
            throw new Error("The selected file is empty.");
        }

        if (file.size > MAX_FILE_SIZE) {
            throw new Error("File size cannot exceed 5 MB.");
        }

        const allowedTypes =
            type === "PROFILE_PHOTO"
                ? ["image/jpeg", "image/png", "image/webp"]
                : ["image/jpeg", "image/png", "application/pdf"];

        if (!allowedTypes.includes(file.type)) {
            throw new Error(
                type === "PROFILE_PHOTO"
                    ? "Choose a JPG, PNG or WebP image."
                    : "Choose a JPG, PNG or PDF file.",
            );
        }
    }

    async function uploadDocument(
        file: File,
        type: DocumentType,
    ) {
        validateFile(file, type);

        setBusyType(type);
        setError(null);

        try {
            // Step 1: Request a presigned S3 upload URL.
            const presignResponse = await fetch(
                "/api/me/documents/presign",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        type,
                        fileName: file.name,
                        contentType: file.type,
                        fileSize: file.size,
                    }),
                },
            );

            const presignResult =
                await readApiResponse<PresignData>(presignResponse);

            if (
                !presignResponse.ok ||
                !presignResult.success ||
                !presignResult.data
            ) {
                throw new Error(
                    presignResult.message ??
                        "Unable to prepare the document upload.",
                );
            }

            const { uploadUrl, objectKey, requiredHeaders } =
                presignResult.data;

            // Step 2: Upload the file directly to private S3 storage.
            const uploadResponse = await fetch(uploadUrl, {
                method: "PUT",
                headers: requiredHeaders,
                body: file,
            });

            if (!uploadResponse.ok) {
                throw new Error(
                    "The file could not be uploaded to storage. Please try again.",
                );
            }

            // Step 3: Ask the backend to verify and register the upload.
            const completeResponse = await fetch(
                "/api/me/documents/complete",
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        type,
                        fileName: file.name,
                        contentType: file.type,
                        fileSize: file.size,
                        objectKey,
                    }),
                },
            );

            const completeResult =
                await readApiResponse<CustomerDocument>(completeResponse);

            if (
                !completeResponse.ok ||
                !completeResult.success ||
                !completeResult.data
            ) {
                throw new Error(
                    completeResult.message ??
                        "The uploaded document could not be registered.",
                );
            }

            toast.success(
                type === "PROFILE_PHOTO"
                    ? "Profile photograph saved."
                    : "Identity card saved.",
            );

            await loadDocuments();
        } catch (caught) {
            const message =
                caught instanceof Error
                    ? caught.message
                    : "Document upload failed.";

            setError(message);
            toast.error(message);
        } finally {
            setBusyType(null);
        }
    }

    async function handleFileSelection(
        event: ChangeEvent<HTMLInputElement>,
        type: DocumentType,
    ) {
        const file = event.target.files?.[0];

        // Allow selecting the same file again after an unsuccessful attempt.
        event.target.value = "";

        if (!file) return;

        await uploadDocument(file, type);
    }

    async function deleteDocument(type: DocumentType) {
        const label =
            type === "PROFILE_PHOTO"
                ? "profile photograph"
                : "identity card";

        if (!window.confirm(`Delete your ${label}?`)) {
            return;
        }

        setBusyType(type);
        setError(null);

        try {
            const response = await fetch(
                `/api/me/documents/${type}`,
                {
                    method: "DELETE",
                    credentials: "same-origin",
                    cache: "no-store",
                },
            );

            const result =
                await readApiResponse<{ deleted: boolean }>(response);

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message ?? "Unable to delete this document.",
                );
            }

            toast.success("Document deleted.");
            await loadDocuments();
        } catch (caught) {
            const message =
                caught instanceof Error
                    ? caught.message
                    : "Unable to delete this document.";

            setError(message);
            toast.error(message);
        } finally {
            setBusyType(null);
        }
    }

    function renderDocumentCard(type: DocumentType) {
        const config = DOCUMENT_CONFIG[type];
        const document = getDocument(type);
        const busy = busyType === type;

        const inputRef =
            type === "PROFILE_PHOTO"
                ? photoInputRef
                : idCardInputRef;

        const isImage = document?.contentType.startsWith("image/");

        return (
            <section
                key={type}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6"
            >
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h3 className="text-base font-semibold text-white">
                            {config.title}
                        </h3>

                        <p className="mt-1 text-sm text-zinc-400">
                            {config.description}
                        </p>
                    </div>

                    {document ? (
                        <span className="rounded-full border border-emerald-800 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-300">
                            Uploaded
                        </span>
                    ) : (
                        <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
                            Not uploaded
                        </span>
                    )}
                </div>

                {document && (
                    <div className="mt-5 flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 sm:flex-row sm:items-center">
                        {isImage ? (
                            <a
                                href={document.viewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
                            >
                                {/* The URL is a short-lived private S3 view URL. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={document.viewUrl}
                                    alt={config.title}
                                    className="h-full w-full object-cover"
                                />
                            </a>
                        ) : (
                            <a
                                href={document.viewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:border-zinc-600"
                            >
                                <span className="text-2xl">PDF</span>
                                <span className="mt-1 text-[10px] text-zinc-500">
                                    Open file
                                </span>
                            </a>
                        )}

                        <div className="min-w-0 flex-1">
                            <p className="break-all text-sm font-medium text-white">
                                {document.fileName}
                            </p>

                            <p className="mt-1 text-xs text-zinc-500">
                                {formatFileSize(document.fileSize)}
                            </p>

                            <p className="mt-2 text-xs text-zinc-500">
                                Uploaded{" "}
                                {new Date(document.updatedAt).toLocaleDateString(
                                    "en-IN",
                                )}
                            </p>

                            <a
                                href={document.viewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex text-xs font-medium text-zinc-300 underline underline-offset-4 hover:text-white"
                            >
                                View document
                            </a>
                        </div>
                    </div>
                )}

                <input
                    ref={inputRef}
                    type="file"
                    accept={config.accept}
                    className="hidden"
                    disabled={busy || loading}
                    onChange={(event) =>
                        void handleFileSelection(event, type)
                    }
                />

                <div className="mt-5 flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={busy || loading}
                        className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {busy
                            ? "Please wait..."
                            : document
                              ? "Replace document"
                              : "Choose file"}
                    </button>

                    {document && (
                        <button
                            type="button"
                            onClick={() => void deleteDocument(type)}
                            disabled={busy || loading}
                            className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-red-800 hover:bg-red-950/30 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Delete
                        </button>
                    )}
                </div>

                <p className="mt-3 text-xs leading-5 text-zinc-500">
                    Accepted formats: {config.formats}. Maximum file size: 5 MB.
                </p>
            </section>
        );
    }

    return (
        <div className="space-y-5">
            {required && (
                <div
                    className={`rounded-xl border p-4 text-sm ${
                        hasRequiredDocument
                            ? "border-emerald-900 bg-emerald-950/20 text-emerald-300"
                            : "border-amber-800 bg-amber-950/20 text-amber-200"
                    }`}
                >
                    {loading
                        ? "Checking your saved documents..."
                        : hasRequiredDocument
                          ? "Document requirement satisfied. You can continue when your booking details are ready."
                          : "Booking requires at least one saved document: a profile photograph or an identity card. You do not need to upload both."}
                </div>
            )}

            {error && (
                <div className="rounded-xl border border-red-900 bg-red-950/30 p-4 text-sm text-red-300">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-400">
                    Loading your documents...
                </div>
            ) : (
                <div className="grid gap-5 md:grid-cols-2">
                    {renderDocumentCard("PROFILE_PHOTO")}
                    {renderDocumentCard("ID_CARD")}
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-zinc-500">
                    Your documents are stored privately. Viewing links expire automatically.
                </p>

                <button
                    type="button"
                    onClick={() => void loadDocuments()}
                    disabled={loading || busyType !== null}
                    className="text-xs font-medium text-zinc-300 underline underline-offset-4 hover:text-white disabled:opacity-50"
                >
                    Refresh documents
                </button>
            </div>
        </div>
    );
}
