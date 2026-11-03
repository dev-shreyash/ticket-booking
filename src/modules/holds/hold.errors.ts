export const HOLD_ERROR_STATUS = {
  UNAUTHENTICATED: 401,
  SHOW_NOT_FOUND: 404,
  SHOW_UNAVAILABLE: 409,
  SEAT_NOT_FOUND: 404,
  SEAT_UNAVAILABLE: 409,
  SEAT_INVENTORY_INCOMPLETE: 500,
  ACTIVE_HOLD_EXISTS: 409,
  HOLD_NOT_FOUND: 404,
  HOLD_FORBIDDEN: 403,
  HOLD_NOT_ACTIVE: 409,
  DATABASE_INTEGRITY_ERROR: 500,
  INVALID_HOLD_REQUEST: 400,
} as const;

export type HoldErrorCode = keyof typeof HOLD_ERROR_STATUS;

export class HoldError extends Error {
  readonly code: HoldErrorCode;
  readonly status: number;

  constructor(code: HoldErrorCode, message: string) {
    super(message);

    this.name = "HoldError";
    this.code = code;
    this.status = HOLD_ERROR_STATUS[code];
    
  }
}