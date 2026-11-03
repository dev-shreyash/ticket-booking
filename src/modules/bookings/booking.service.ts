import { BookingError } from "./booking.errors";
import { confirmBookingTransaction } from "./booking.repository";
import {
  getBookingForUser,
  listBookingsForUser,
} from "./booking-read.repository";

import type {
  BookingConfirmationInput,
} from "./booking.types";

export async function createBooking(
  input: BookingConfirmationInput,
) {
  if (!input.userId) {
    throw new BookingError(
      "UNAUTHENTICATED",
      "Authentication required.",
    );
  }

  return confirmBookingTransaction(input);
}

export async function listCustomerBookings(
  userId: string,
  page: number,
  pageSize: number,
) {
  return listBookingsForUser(userId, page, pageSize);
}

export async function getCustomerBooking(
  bookingId: string,
  userId: string,
) {
  return getBookingForUser(bookingId, userId);
}