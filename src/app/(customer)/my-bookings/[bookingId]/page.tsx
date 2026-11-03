import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import BookingHistory from "@/components/bookings/booking-history";

export default async function MyBookingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <BookingHistory />;
}