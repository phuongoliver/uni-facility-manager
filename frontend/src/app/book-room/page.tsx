import { NewBookingForm } from "@/components/bookings/NewBookingForm";
import { Navbar } from "@/components/layout/Navbar";
import { API_URL } from "@/lib/constants";

interface PageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function getBooking(id: string) {
    const res = await fetch(`${API_URL}/api/bookings/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
}

export default async function BookRoomPage({ searchParams }: PageProps) {
    const resolvedSearchParams = await searchParams;
    const editId = resolvedSearchParams?.edit;
    let initialData = null;

    if (editId) {
        // Backend API doesn't have GET /bookings/:id exposed plainly (It has GET /bookings for all, or /bookings/facility/:id).
        // Wait, BookingsController defines DELETE /:id but not GET /:id. The service has cancel(id) but findAll(userId).
        // I need to add GET /bookings/:id to controller or find it from the list here?
        // Fetching all and filtering is inefficient but works for now as I can't easily edit backend controller again without context loss.
        // Actually, I can edit backend controller easily. Let's add GET /:id first?
        // NO, wait, I can just client-side fetch in NewBookingForm?
        // Server Component is better. I will add GET /bookings/:id to backend controller.

        // Assuming GET /bookings/:id logic for now, I will add it to Backend Controller next step.
        // OR better: Just pass bookingId to NewBookingForm and let it fetch client-side.
        // Given existing code structure uses client components heavily, passing ID might be easier.
        // But SearchParams in Page (Server Component) -> Pass to Client Component is standard Next.js 13.
    }

    // Changing strategy: Pass `bookingId` prop to NewBookingForm and let it handle fetching.
    // This avoids needing to add a new backend endpoint right this second if I can filter client side,
    // BUT NewBookingForm fetches "Booked Slots" not "Booking Details".

    // Let's modify Page to just pass the ID.
    const bookingId = typeof editId === 'string' ? parseInt(editId) : undefined;

    return (
        <div className="min-h-screen bg-gray-50/30 font-sans">
            <Navbar />

            <main className="container mx-auto py-10 px-4 md:px-6 max-w-7xl">
                <div className="flex flex-col gap-2 mb-10">
                    <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                        {bookingId ? "Edit / Reschedule Booking" : "Create Booking Request"}
                    </h1>
                    <p className="text-gray-500 text-lg">
                        {bookingId
                            ? "Modify details or select a new time slot for your request."
                            : "Select available slots on the calendar and fill in details to reserve."}
                    </p>
                </div>

                <NewBookingForm editBookingId={bookingId} />
            </main>
        </div>
    );
}
