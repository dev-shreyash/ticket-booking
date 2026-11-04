export const BOOKING_ERROR_STATUS = {
    UNAUTHENTICATED: 401,
    INVALID_BOOKING_REQUEST: 400,
    INVALID_IDEMPOTENCY_KEY: 400,
    IDEMPOTENCY_KEY_REUSED: 409,
    HOLD_NOT_FOUND: 404,
    HOLD_FORBIDDEN: 403,
    HOLD_NOT_ACTIVE: 409,
    HOLD_EXPIRED: 409,
    SHOW_UNAVAILABLE: 409,
    BOOKING_NOT_FOUND: 404,
    BOOKING_INTEGRITY_ERROR: 500,
    BOOKING_CONFLICT: 409,
    IDENTITY_DOCUMENT_REQUIRED: 409,
} as const;

export type BookingErrorCode = keyof typeof BOOKING_ERROR_STATUS;

export class BookingError extends Error {
  readonly code: BookingErrorCode;
  readonly status: number;

  constructor(code: BookingErrorCode, message: string) {
    super(message);

    this.name = "BookingError";
    this.code = code;
    this.status = BOOKING_ERROR_STATUS[code];
  }
}