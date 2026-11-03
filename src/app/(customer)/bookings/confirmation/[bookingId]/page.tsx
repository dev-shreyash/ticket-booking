import BookingConfirmation from "@/components/bookings/booking-confirmation";

type PageProps = {
  params: Promise<{
    bookingId: string;
  }>;
};

export default async function BookingConfirmationPage({
  params,
}: PageProps) {
  const { bookingId } = await params;

  return <BookingConfirmation bookingId={bookingId} />;
}