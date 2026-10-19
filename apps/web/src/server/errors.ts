const STATUS = {
  not_found: 404,
  unauthorized: 401,
  validation: 422,
  poll_not_open: 423,
  poll_closed: 423,
  already_voted: 409,
  code_used: 409,
  code_required: 400,
  code_invalid: 400,
  options_locked: 409,
  schedule_locked: 409,
  hidden_until_close: 403,
  rate_limited: 429,
} as const;

export type DomainErrorCode = keyof typeof STATUS;

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details?: unknown;

  constructor(code: DomainErrorCode, details?: unknown) {
    super(code);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

export function httpStatus(code: DomainErrorCode): number {
  return STATUS[code];
}
