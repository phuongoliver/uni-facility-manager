"use client";
import { API_URL } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

import React, { useEffect, useState } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addDays, addWeeks, addMonths, subWeeks, subMonths, isBefore, startOfDay, getHours, setHours, setMinutes } from "date-fns";
import {
    Clock,
    MapPin,
    Loader2,
    Edit,
    Trash2,
    CreditCard,
    QrCode,
    CheckCircle2,
    XCircle,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Download
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Card,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { NewBookingForm } from "@/components/bookings/NewBookingForm";

// Define Type manually since we don't have shared types yet
interface Booking {
    bookingId: number;
    userId: number;
    facilityId: number;
    purpose: string;
    bookingType: string;
    checkInTime: string;
    checkOutTime: string;
    status: string;
    totalAmount: string; // Decimal comes as string
    facility: {
        name: string;
        minCancellationHours?: number;
    };
    details: any[];
    cancellationReason?: string; // Added field
    groupId?: number;
}

export default function MyBookingsPage() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { user } = useAuth();

    const fetchBookings = async () => {
        if (!user) return;
        try {
            const res = await fetch(`${API_URL}/api/bookings`, {
                headers: {
                    'x-user-id': user.userId.toString()
                }
            });
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setBookings(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchBookings();
        }
    }, [user]);



    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'bookingId', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedBookings = React.useMemo(() => {
        if (!sortConfig) return bookings;
        return [...bookings].sort((a, b) => {
            let aValue: any = a[sortConfig.key as keyof Booking];
            let bValue: any = b[sortConfig.key as keyof Booking];

            // Special handling for nested properties
            if (sortConfig.key === 'facility') {
                aValue = a.facility?.name || '';
                bValue = b.facility?.name || '';
            }

            // Special handling for numeric/date values
            if (sortConfig.key === 'totalAmount') {
                aValue = parseFloat(a.totalAmount || '0');
                bValue = parseFloat(b.totalAmount || '0');
            }
            if (sortConfig.key === 'checkInTime') {
                aValue = new Date(a.checkInTime).getTime();
                bValue = new Date(b.checkInTime).getTime();
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [bookings, sortConfig]);

    const totalPages = Math.ceil(sortedBookings.length / ITEMS_PER_PAGE);
    const paginatedBookings = sortedBookings.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

    const router = useRouter();
    const [bookingToEdit, setBookingToEdit] = useState<number | null>(null);
    const [isRescheduling, setIsRescheduling] = useState(false);

    // Open detail modal when clicking a row
    const handleRowClick = (booking: Booking) => {
        setSelectedBooking(booking);
        setBookingToEdit(booking.bookingId); // Also set this for actions
    };

    const handleReschedule = () => {
        if (bookingToEdit) {
            setSelectedBooking(null); // Close detail modal
            setIsRescheduling(true);
        }
    };

    const handleRescheduleSuccess = () => {
        alert("Rescheduled successfully!");
        setIsRescheduling(false);
        setBookingToEdit(null);
        fetchBookings(); // Refresh list
    };

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentData, setPaymentData] = useState<{
        transactionRef: string;
        qrCodeData: string;
        expiresAt: string;
        amount: number;
        bookingId: number;
    } | null>(null);
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [paymentMessage, setPaymentMessage] = useState('');

    // Initiate Payment
    const handleInitiatePayment = async (booking: Booking) => {
        setPaymentStatus('loading');
        setPaymentMessage('');

        try {
            const res = await fetch(`${API_URL}/api/payments/initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': user?.userId.toString() || '1',
                },
                body: JSON.stringify({ bookingId: booking.bookingId }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to initiate payment');
            }

            const data = await res.json();
            setPaymentData({
                transactionRef: data.transaction_ref,
                qrCodeData: data.qr_code_data,
                expiresAt: data.expires_at,
                amount: parseFloat(booking.totalAmount),
                bookingId: booking.bookingId,
            });
            setShowPaymentModal(true);
            setPaymentStatus('idle');
        } catch (error: any) {
            setPaymentStatus('error');
            setPaymentMessage(error.message || 'Failed to initiate payment');
            alert(error.message || 'Failed to initiate payment');
        }
    };

    // Simulate Payment Complete (for demo)
    const handleSimulatePayment = async () => {
        if (!paymentData) return;

        setPaymentStatus('loading');
        try {
            const res = await fetch(`${API_URL}/api/payments/simulate-complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transactionRef: paymentData.transactionRef }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Payment failed');
            }

            setPaymentStatus('success');
            setPaymentMessage('Payment successful! Your booking is now confirmed.');

            // Close modal and refresh after delay
            setTimeout(() => {
                setShowPaymentModal(false);
                setPaymentData(null);
                setPaymentStatus('idle');
                setSelectedBooking(null);
                fetchBookings();
            }, 2000);
        } catch (error: any) {
            setPaymentStatus('error');
            setPaymentMessage(error.message || 'Payment failed');
        }
    };

    // Close payment modal
    const handleClosePaymentModal = () => {
        setShowPaymentModal(false);
        setPaymentData(null);
        setPaymentStatus('idle');
        setPaymentMessage('');
    };

    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancellationReason, setCancellationReason] = useState("");

    const handleRequestCancel = () => {
        if (!bookingToEdit) return;
        // Check local time constraint (optional UI enhancement)
        const booking = bookings.find(b => b.bookingId === bookingToEdit);
        if (booking) {
            // Logic to warn if needed, but we'll let the user proceed to see backend error or policy
        }
        setShowCancelModal(true);
    };

    const executeCancellation = async () => {
        if (!bookingToEdit) return;
        if (!cancellationReason.trim()) {
            alert("Please enter a cancellation reason.");
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/bookings/${bookingToEdit}/cancel`, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': user?.userId.toString() || '1'
                },
                body: JSON.stringify({ reason: cancellationReason })
            });

            if (!res.ok) {
                const err = await res.json();
                alert(err.message || "Failed to cancel");
                return;
            }

            // Update local state
            setBookings(prev => prev.map(b =>
                b.bookingId === bookingToEdit ? { ...b, status: 'CANCELLED' } : b
            ));

            alert("Booking cancelled successfully.");
            setShowCancelModal(false);
            setCancellationReason("");
            setBookingToEdit(null);
            setSelectedBooking(null); // Close detail modal
        } catch (error) {
            console.error(error);
            alert("An error occurred during cancellation.");
        }
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };



    const getStatusColor = (status: string) => {
        switch (status) {
            case "APPROVED": return "bg-green-100 text-green-700 hover:bg-green-100/80";
            case "CONFIRMED": return "bg-green-100 text-green-700 hover:bg-green-100/80";
            case "PENDING": return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100/80";
            case "WAITING_PAYMENT": return "bg-amber-100 text-amber-700 hover:bg-amber-100/80";
            case "PENDING_RESCHEDULE": return "bg-indigo-100 text-indigo-700 hover:bg-indigo-100/80";
            case "REJECTED": return "bg-red-100 text-red-700 hover:bg-red-100/80";
            case "CANCELLED": return "bg-gray-100 text-gray-700 hover:bg-gray-100/80";
            case "COMPLETED": return "bg-blue-100 text-blue-700 hover:bg-blue-100/80";
            case "IN_USE": return "bg-blue-600 text-white hover:bg-blue-700";
            case "ADMIN_HOLD": return "bg-gray-800 text-white hover:bg-gray-900";
            case "REVIEW_REQUIRED": return "bg-orange-100 text-orange-700 hover:bg-orange-100/80";
            case "RESCHEDULED": return "bg-slate-100 text-slate-700 hover:bg-slate-100/80";
            default: return "bg-gray-100 text-gray-700";
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "APPROVED": return "Approved";
            case "CONFIRMED": return "Confirmed";
            case "PENDING": return "Pending";
            case "WAITING_PAYMENT": return "Waiting Payment";
            case "PENDING_RESCHEDULE": return "Pending Reschedule";
            case "REJECTED": return "Rejected";
            case "CANCELLED": return "Cancelled";
            case "COMPLETED": return "Completed";
            case "IN_USE": return "In Use";
            case "ADMIN_HOLD": return "Admin Hold";
            case "REVIEW_REQUIRED": return "Review Required";
            case "RESCHEDULED": return "Rescheduled";
            default: return status;
        }
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key !== columnKey) return <span className="ml-1 text-gray-300">↕</span>;
        return sortConfig.direction === 'asc' ? <span className="ml-1 text-primary">↑</span> : <span className="ml-1 text-primary">↓</span>;
    };

    const [activeTab, setActiveTab] = useState<'history' | 'payments' | 'calendar'>('history');

    // Calendar State
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [calendarView, setCalendarView] = useState<'month' | 'week'>('month');

    const generateICS = () => {
        let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//UniFacilityManager//EN\n";

        // Filter out cancelled/rejected if desired, or keep all
        const validBookings = bookings.filter(b => b.status !== 'CANCELLED' && b.status !== 'REJECTED');

        validBookings.forEach(b => {
            const start = new Date(b.checkInTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            const end = new Date(b.checkOutTime).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

            icsContent += "BEGIN:VEVENT\n";
            icsContent += `UID:${b.bookingId}@unifacility.com\n`;
            icsContent += `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'}\n`;
            icsContent += `DTSTART:${start}\n`;
            icsContent += `DTEND:${end}\n`;
            icsContent += `SUMMARY:${b.facility.name} Booking\n`;
            icsContent += `DESCRIPTION:${b.purpose}\n`;
            icsContent += "END:VEVENT\n";
        });

        icsContent += "END:VCALENDAR";

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.setAttribute('download', 'my_bookings.ics');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Calculate aggregated payments for the Payments Tab
    const paymentGroups = React.useMemo(() => {
        const waiting = bookings.filter(b => b.status === 'WAITING_PAYMENT');
        const groups: { [key: string]: Booking[] } = {};
        const singles: Booking[] = [];

        waiting.forEach(b => {
            if (b.groupId) {
                if (!groups[b.groupId]) groups[b.groupId] = [];
                groups[b.groupId].push(b);
            } else {
                singles.push(b);
            }
        });

        const mergedGroups: any[] = [];

        // Process Groups
        Object.keys(groups).forEach(groupId => {
            const members = groups[groupId];
            members.sort((a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime());
            const first = members[0];
            const last = members[members.length - 1];
            const totalAmount = members.reduce((sum, b) => sum + parseFloat(b.totalAmount || '0'), 0);

            mergedGroups.push({
                ...first,
                isGroup: true,
                groupCount: members.length,
                dateRange: `${format(new Date(first.checkInTime), "dd/MM")} - ${format(new Date(last.checkInTime), "dd/MM/yyyy")}`,
                totalGroupAmount: totalAmount,
                members
            });
        });

        // Process Singles
        singles.forEach(b => {
            mergedGroups.push({
                ...b,
                isGroup: false,
                totalGroupAmount: parseFloat(b.totalAmount || '0')
            });
        });

        return mergedGroups;
    }, [bookings]);

    // Calendar Days
    const calendarDays = React.useMemo(() => {
        if (calendarView === 'month') {
            const start = startOfWeek(startOfMonth(calendarDate), { weekStartsOn: 1 });
            const end = endOfWeek(endOfMonth(calendarDate), { weekStartsOn: 1 });
            return eachDayOfInterval({ start, end });
        } else {
            const start = startOfWeek(calendarDate, { weekStartsOn: 1 });
            return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
        }
    }, [calendarDate, calendarView]);

    const renderCalendar = () => (
        <Card className="border-none shadow-sm overflow-hidden bg-white mb-6 border animate-in fade-in">
            <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center border rounded-md shadow-sm">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border-r" onClick={() => setCalendarDate(prev => calendarView === 'month' ? subMonths(prev, 1) : subWeeks(prev, 1))}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => setCalendarDate(prev => calendarView === 'month' ? addMonths(prev, 1) : addWeeks(prev, 1))}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <span className="text-lg font-bold text-gray-800">
                        {format(calendarDate, "MMMM yyyy")}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <Select value={calendarView} onValueChange={(v: any) => setCalendarView(v)}>
                        <SelectTrigger className="w-[100px] h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="month">Month</SelectItem>
                            <SelectItem value="week">Week</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={generateICS} className="h-8 gap-2">
                        <Download className="w-3.5 h-3.5" /> Sync Calendar
                    </Button>
                </div>
            </div>

            <div className="overflow-x-auto">
                {/* Calendar Grid */}
                <div className="min-w-[800px]">
                    {/* Header Days */}
                    <div className="grid grid-cols-7 border-b bg-gray-50">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                            <div key={day} className="p-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider border-r last:border-r-0">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days */}
                    <div className="grid grid-cols-7 bg-white">
                        {calendarDays.map((date) => {
                            const isToday = isSameDay(date, new Date());
                            const isCurrentMonth = date.getMonth() === calendarDate.getMonth();

                            // Find bookings for this day
                            const dayBookings = bookings.filter(b => isSameDay(new Date(b.checkInTime), date));

                            return (
                                <div
                                    key={date.toString()}
                                    className={`min-h-[120px] p-2 border-b border-r last:border-r-0 relative group hover:bg-gray-50 transition-colors ${!isCurrentMonth ? 'bg-gray-50/50' : ''}`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-white' : isCurrentMonth ? 'text-gray-700' : 'text-gray-400'}`}>
                                            {format(date, "d")}
                                        </span>
                                    </div>

                                    {/* Bookings List */}
                                    <div className="space-y-1">
                                        {dayBookings.map(booking => (
                                            <div
                                                key={booking.bookingId}
                                                onClick={() => handleRowClick(booking)}
                                                className={`text-[10px] px-1.5 py-0.5 rounded border truncate cursor-pointer hover:opacity-80
                                                    ${booking.status === 'CONFIRMED' || booking.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' :
                                                        booking.status === 'WAITING_PAYMENT' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                            booking.status === 'CANCELLED' || booking.status === 'REJECTED' ? 'bg-gray-100 text-gray-500 border-gray-200 line-through' :
                                                                'bg-blue-50 text-blue-700 border-blue-200'
                                                    }`}
                                                title={`${format(new Date(booking.checkInTime), 'HH:mm')} - ${booking.facility.name}`}
                                            >
                                                <span className="font-bold mr-1">
                                                    {format(new Date(booking.checkInTime), 'HH:mm')}
                                                </span>
                                                {booking.facility.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Card>
    );

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">My Bookings</h1>
                    <p className="text-gray-500 mt-1 text-sm">Manage your room and equipment booking requests.</p>
                </div>
                <Button onClick={fetchBookings} variant="outline" size="sm">
                    <Clock className="w-4 h-4 mr-2" /> Refresh
                </Button>
            </div>

            {/* Custom Tabs */}
            <div className="flex space-x-1 rounded-lg bg-gray-100 p-1 mb-6 w-fit">
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'}`}
                >
                    <Clock className="w-4 h-4" /> History
                </button>
                <button
                    onClick={() => setActiveTab('payments')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'payments' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'}`}
                >
                    <CreditCard className="w-4 h-4" /> Payments
                    {paymentGroups.length > 0 && (
                        <span className="ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-semibold text-red-600">
                            {paymentGroups.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('calendar')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'calendar' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'}`}
                >
                    <Calendar className="w-4 h-4" /> Calendar
                </button>
            </div>

            {activeTab === 'calendar' && renderCalendar()}

            {activeTab === 'history' ? (
                /* HISTORY TAB CONTENT */
                <>
                    <Card className="border-none shadow-sm overflow-hidden bg-white mb-6 animate-in fade-in duration-300">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                                        <TableHead className="w-[80px] text-center">
                                            No.
                                        </TableHead>
                                        <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('facility')}>
                                            Facility <SortIcon columnKey="facility" />
                                        </TableHead>
                                        <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('checkInTime')}>
                                            Time <SortIcon columnKey="checkInTime" />
                                        </TableHead>
                                        <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('purpose')}>
                                            Purpose <SortIcon columnKey="purpose" />
                                        </TableHead>
                                        <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('totalAmount')}>
                                            Total <SortIcon columnKey="totalAmount" />
                                        </TableHead>
                                        <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('status')}>
                                            Status <SortIcon columnKey="status" />
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-32 text-center">
                                                <div className="flex items-center justify-center gap-2 text-gray-500">
                                                    <Loader2 className="w-5 h-5 animate-spin" /> Loading data...
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : paginatedBookings.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-32 text-center text-gray-500">
                                                You have no bookings.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedBookings.map((booking, index) => (
                                            <TableRow
                                                key={booking.bookingId}
                                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                                                onClick={() => handleRowClick(booking)}
                                            >
                                                <TableCell className="font-medium text-gray-900 text-center">
                                                    {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 font-medium text-gray-700">
                                                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                                        {booking.facility?.name || "Unknown Facility"}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col text-sm">
                                                        <span className="font-semibold text-gray-700">
                                                            {format(new Date(booking.checkInTime), "dd/MM/yyyy")}
                                                        </span>
                                                        <span className="text-gray-500 text-xs">
                                                            {format(new Date(booking.checkInTime), "HH:mm")} - {format(new Date(booking.checkOutTime), "HH:mm")}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[150px]">
                                                    <span className="truncate block text-gray-600 text-sm" title={booking.purpose}>
                                                        {booking.purpose}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-semibold text-gray-900">
                                                    {booking.totalAmount
                                                        ? parseInt(booking.totalAmount).toLocaleString() + ' đ'
                                                        : '0 đ'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className={`border-none ${getStatusColor(booking.status)}`}>
                                                        {getStatusLabel(booking.status)}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>

                    {/* PAGINATION CONTROLS */}
                    {!isLoading && bookings.length > 0 && (
                        <div className="flex items-center justify-end space-x-2 py-4">
                            <div className="flex-1 text-sm text-gray-500">
                                Page {currentPage} / {Math.max(totalPages, 1)}
                            </div>
                            <div className="space-x-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                /* PAYMENTS TAB CONTENT */
                <Card className="border-none shadow-sm overflow-hidden bg-white mb-6 animate-in fade-in duration-300">
                    <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50/50">
                        <h2 className="text-lg font-semibold text-gray-900">Pending Payments</h2>
                        <p className="text-sm text-gray-500">
                            Review and pay for your booking requests. Recurring bookings are grouped together.
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/50">
                                    <TableHead className="w-[60px] text-center">No.</TableHead>
                                    <TableHead>Facility</TableHead>
                                    <TableHead>Date / Range</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Total Amount</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paymentGroups.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-48 text-center text-gray-500">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <CheckCircle2 className="w-8 h-8 text-green-500/50" />
                                                <p>All caught up! No pending payments.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paymentGroups.map((item, index) => (
                                        <TableRow key={index} className="hover:bg-gray-50">
                                            <TableCell className="text-center font-medium text-gray-500">{index + 1}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 font-medium text-gray-900">
                                                    <MapPin className="w-4 h-4 text-blue-500" />
                                                    {item.facility?.name}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-900">
                                                        {item.isGroup ? item.dateRange : format(new Date(item.checkInTime), "dd/MM/yyyy")}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {item.isGroup
                                                            ? `${item.groupCount} bookings`
                                                            : `${format(new Date(item.checkInTime), "HH:mm")} - ${format(new Date(item.checkOutTime), "HH:mm")}`}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {item.isGroup ? (
                                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Recurring Group</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Single Booking</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-lg font-bold text-blue-600">
                                                    {item.totalGroupAmount.toLocaleString()} đ
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleInitiatePayment(item)}
                                                    className="bg-blue-600 hover:bg-blue-700 shadow-sm"
                                                >
                                                    Pay Now
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            )}

            {/* Hidden for simplicity: Original Pagination is inside History Tab block now */}

            {/* Booking Detail Modal */}
            {selectedBooking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                Booking Details #{selectedBooking.bookingId}
                            </h3>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedBooking(null)} className="rounded-full h-8 w-8 hover:bg-gray-100">
                                <span className="text-lg">✕</span>
                            </Button>
                        </div>

                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                            {/* Header Info */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                                <div className="flex flex-col">
                                    <span className="text-sm text-gray-500">Status</span>
                                    <Badge variant="outline" className={`mt-1 px-3 py-1 w-fit border-0 ${getStatusColor(selectedBooking.status)}`}>
                                        {getStatusLabel(selectedBooking.status)}
                                    </Badge>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-sm text-gray-500">Total Cost</span>
                                    <span className="font-bold text-2xl text-primary">
                                        {selectedBooking.totalAmount ? parseInt(selectedBooking.totalAmount).toLocaleString() + ' đ' : '0 đ'}
                                    </span>
                                </div>
                            </div>

                            {/* Main Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-medium text-gray-500 flex items-center gap-1"><MapPin className="w-4 h-4" /> Facility</h4>
                                    <p className="font-medium text-gray-900 text-lg">{selectedBooking.facility?.name}</p>
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-sm font-medium text-gray-500 flex items-center gap-1"><Clock className="w-4 h-4" /> Time</h4>
                                    <div className="font-medium text-gray-900">
                                        {format(new Date(selectedBooking.checkInTime), "dd/MM/yyyy")}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        {format(new Date(selectedBooking.checkInTime), "HH:mm")} - {format(new Date(selectedBooking.checkOutTime), "HH:mm")}
                                    </div>
                                </div>
                            </div>

                            {/* Calendar Link */}
                            <div className="mt-2">
                                <a
                                    href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Booking: ${selectedBooking.facility?.name}`)}&dates=${format(new Date(selectedBooking.checkInTime), "yyyyMMdd'T'HHmmss")}/${format(new Date(selectedBooking.checkOutTime), "yyyyMMdd'T'HHmmss")}&details=${encodeURIComponent(selectedBooking.purpose)}&location=${encodeURIComponent(selectedBooking.facility?.name)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                >
                                    <Calendar className="w-3 h-3" /> Add to Google Calendar
                                </a>
                            </div>

                            <div className="border-t pt-4"></div>

                            {/* Purpose */}
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-gray-500">Purpose</h4>
                                <div className="p-4 bg-gray-50 rounded-md border text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                                    {selectedBooking.purpose}
                                </div>
                            </div>

                            {/* Equipment */}
                            {selectedBooking.details && selectedBooking.details.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-gray-500">Included Equipment</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedBooking.details.map((detail: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm font-medium border border-blue-100">
                                                <span>{detail.equipment?.name || "Item"}</span>
                                                <span className="bg-white px-1.5 rounded-sm text-xs border border-blue-200">x{detail.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Rejection/Cancellation Reason */}
                            {(selectedBooking.status === 'CANCELLED' || selectedBooking.status === 'REJECTED') && (
                                <div className="space-y-2">
                                    <h4 className={`text-sm font-medium ${selectedBooking.status === 'REJECTED' ? 'text-red-600' : 'text-orange-600'}`}>
                                        {selectedBooking.status === 'REJECTED' ? 'Rejection Reason' : 'Cancellation Reason'}
                                    </h4>
                                    <div className={`p-4 rounded-md border text-sm whitespace-pre-wrap leading-relaxed ${selectedBooking.status === 'REJECTED' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-orange-50 border-orange-200 text-orange-900'}`}>
                                        {selectedBooking.cancellationReason || "No reason provided."}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                            <Button
                                variant="outline"
                                onClick={() => setSelectedBooking(null)}
                            >
                                Close
                            </Button>
                            {/* WAITING_PAYMENT: Show Pay Button */}
                            {selectedBooking.status === 'WAITING_PAYMENT' && (
                                <>
                                    <Button
                                        onClick={() => handleInitiatePayment(selectedBooking)}
                                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                                    >
                                        <CreditCard className="w-4 h-4 mr-2" />
                                        Pay by BKPay
                                    </Button>
                                    <Button
                                        onClick={handleRequestCancel}
                                        variant="destructive"
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Cancel Booking
                                    </Button>
                                </>
                            )}
                            {/* CONFIRMED: Reschedule or Cancel */}
                            {selectedBooking.status === 'CONFIRMED' && (
                                <>
                                    <Button
                                        onClick={handleReschedule}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        <Clock className="w-4 h-4 mr-2" />
                                        Request Reschedule
                                    </Button>
                                    <Button
                                        onClick={handleRequestCancel}
                                        variant="destructive"
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Cancel Booking
                                    </Button>
                                </>
                            )}
                            {/* PENDING, APPROVED: Cancel only */}
                            {(selectedBooking.status === 'PENDING' || selectedBooking.status === 'APPROVED') && (
                                <Button
                                    onClick={handleRequestCancel}
                                    variant="destructive"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Cancel Booking
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )
            }

            {/* Reschedule Modal (Large) */}
            {
                isRescheduling && bookingToEdit && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                            <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                                <h2 className="text-xl font-bold text-gray-800">Reschedule Booking #{bookingToEdit}</h2>
                                <Button variant="ghost" size="sm" onClick={() => setIsRescheduling(false)}>
                                    ✕ Close
                                </Button>
                            </div>
                            <div className="p-6">
                                <NewBookingForm
                                    editBookingId={bookingToEdit}
                                    onSuccess={handleRescheduleSuccess}
                                />
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Cancel Booking Modal */}
            {
                showCancelModal && selectedBooking && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b">
                                <h3 className="text-xl font-bold text-red-600 flex items-center gap-2">
                                    <Trash2 className="w-5 h-5" /> Cancel Booking
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Please read the cancellation policy below.
                                </p>
                            </div>

                            <div className="p-6 space-y-4">
                                {/* Policy Warning */}
                                <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-sm text-orange-800">
                                    <span className="font-bold block mb-1">Cancellation Policy:</span>
                                    You must cancel at least <span className="font-bold">{selectedBooking.facility.minCancellationHours || 0} hours before check-in.</span>
                                    <br />
                                    <span className="text-xs text-orange-600 mt-1 block">
                                        Check-in time: {format(new Date(selectedBooking.checkInTime), "HH:mm dd/MM/yyyy")}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Cancellation Reason <span className="text-red-500">*</span></label>
                                    <textarea
                                        className="w-full min-h-[100px] p-3 border rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-sm resize-none"
                                        placeholder="Enter cancellation reason..."
                                        value={cancellationReason}
                                        onChange={(e) => setCancellationReason(e.target.value)}
                                    ></textarea>
                                </div>
                            </div>

                            <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowCancelModal(false)}
                                >
                                    Close
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={executeCancellation}
                                    disabled={!cancellationReason.trim()}
                                >
                                    Confirm Cancellation
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* BKPay Payment Modal */}
            {showPaymentModal && paymentData && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                        <CreditCard className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">BKPay</h3>
                                        <p className="text-xs text-blue-100">Secure Payment Gateway</p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleClosePaymentModal}
                                    className="text-white hover:bg-white/20 rounded-full h-8 w-8"
                                >
                                    <XCircle className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-6">
                            {paymentStatus === 'success' ? (
                                <div className="text-center py-8">
                                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle2 className="w-10 h-10 text-green-600" />
                                    </div>
                                    <h4 className="text-xl font-bold text-green-600 mb-2">Payment Successful!</h4>
                                    <p className="text-gray-500">{paymentMessage}</p>
                                </div>
                            ) : (
                                <>
                                    {/* QR Code */}
                                    <div className="flex flex-col items-center">
                                        <div className="bg-gray-100 p-4 rounded-xl border-2 border-dashed border-gray-300">
                                            <div className="w-48 h-48 bg-white rounded-lg flex items-center justify-center relative">
                                                <QrCode className="w-32 h-32 text-gray-400" />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="text-center">
                                                        <p className="text-xs text-gray-400 mt-40">Demo QR Code</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-3">Scan with BKPay or Banking App</p>
                                    </div>

                                    {/* Payment Info */}
                                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Transaction Ref</span>
                                            <span className="font-mono text-gray-900">{paymentData.transactionRef}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Booking ID</span>
                                            <span className="font-medium text-gray-900">#{paymentData.bookingId}</span>
                                        </div>
                                        <div className="flex justify-between text-sm border-t pt-3">
                                            <span className="text-gray-500">Amount</span>
                                            <span className="font-bold text-xl text-blue-600">
                                                {paymentData.amount.toLocaleString('vi-VN')} đ
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-gray-400">Expires at</span>
                                            <span className="text-gray-500">
                                                {format(new Date(paymentData.expiresAt), 'HH:mm dd/MM/yyyy')}
                                            </span>
                                        </div>
                                    </div>

                                    {paymentStatus === 'error' && (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                                            {paymentMessage}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        {paymentStatus !== 'success' && (
                            <div className="p-4 border-t bg-gray-50 space-y-3">
                                <Button
                                    onClick={handleSimulatePayment}
                                    disabled={paymentStatus === 'loading'}
                                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                                >
                                    {paymentStatus === 'loading' ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4 mr-2" />
                                            Simulate Payment Success (Demo)
                                        </>
                                    )}
                                </Button>
                                <p className="text-xs text-center text-gray-400">
                                    In production, scan QR code to complete payment
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div >
    );
}
