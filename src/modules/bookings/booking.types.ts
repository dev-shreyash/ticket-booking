export type BookingConfirmationInput = {
  userId: string;
  holdId: string;
  idempotencyKey: string;
};

export type BookingConfirmationResult = {
  id: string;
  bookingReference: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: string;
  createdAt: string;
};

export type BookingConfirmationResponse = {
  booking: BookingConfirmationResult;
  replayed: boolean;
};