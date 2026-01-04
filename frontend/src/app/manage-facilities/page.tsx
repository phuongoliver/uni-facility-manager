"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Plus,
    Edit,
    Building2,
    Wrench,
    MapPin,
    Users,
    Search,
    Filter,
    CalendarCheck,
    X,
    Eye,
    CheckCircle2,
    XCircle,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Clock,
    Calendar as CalendarIcon,
    Trash
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfWeek, addDays, isSameDay, isWithinInterval, addMinutes, startOfDay, endOfDay } from "date-fns";

// Types
interface Facility {
    facilityId: number;
    name: string;
    location: string;
    capacity: number;
    status: string;
    imageUrl?: string;
    managerId: number;
    price: number;
    priceType: 'PER_HOUR' | 'PER_BOOKING' | 'ONE_TIME';
    transactionType: 'DEPOSIT' | 'RENTAL_FEE' | 'FINE';
    type?: string;
}

interface Equipment {
    equipmentId: number;
    name: string;
    totalQuantity: number;
    availableQuantity: number;
    status: string;
    facilityId?: number;
}

interface User {
    userId: number;
    fullName: string;
    ssoId: string;
    email: string;
    role: string;
}

interface Booking {
    bookingId: number;
    facility: Facility;
    user: User;
    status: string;
    checkInTime: string;
    checkOutTime: string;
    purpose: string;
    bookingType: string;
    cancellationReason?: string;
}

type Category = 'bookings' | 'facilities' | 'equipment' | 'history';

export default function ManageFacilitiesPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [activeCategory, setActiveCategory] = useState<Category>('bookings');
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [equipments, setEquipments] = useState<Equipment[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [bookingStats, setBookingStats] = useState<any>({});
    const [bookingPage, setBookingPage] = useState(1);
    const [bookingTotalPages, setBookingTotalPages] = useState(1);
    const [historyFilter, setHistoryFilter] = useState<string>('ALL');
    const [isFetching, setIsFetching] = useState(false);
    const [bookingTypeFilter, setBookingTypeFilter] = useState<string>('ALL');
    const [facilityFilter, setFacilityFilter] = useState<string>('ALL');
    const [dateFilter, setDateFilter] = useState<string>('');

    // Modal State
    const [isAddFacilityOpen, setIsAddFacilityOpen] = useState(false);
    const [isAddEquipmentOpen, setIsAddEquipmentOpen] = useState(false);
    const [bookingToReview, setBookingToReview] = useState<Booking | null>(null);
    const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);

    // Edit State
    const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
    const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
    const [prefilledFacilityId, setPrefilledFacilityId] = useState<number | null>(null);

    React.useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.push('/login');
            } else if (!['ADMIN', 'FACILITY_MANAGER'].includes(user.role)) {
                router.push('/');
            } else {
                fetchData(activeCategory);
                if (activeCategory === 'bookings') {
                    fetchBookingStats();
                    // Also fetch facilities for the filter dropdown
                    if (facilities.length === 0) {
                        fetchData('facilities');
                    }
                }
            }
        }
    }, [user, isLoading, router, activeCategory, bookingPage, historyFilter, bookingTypeFilter, facilityFilter, dateFilter]);

    const fetchData = async (category: Category) => {
        setIsFetching(true);
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3500';
            let endpoint = '';

            if (category === 'facilities') endpoint = `api/facilities?managerId=${user!.userId}`;
            else if (category === 'equipment') endpoint = `api/equipments?managerId=${user!.userId}`;
            else if (category === 'bookings') {
                // Include both PENDING (new bookings) and PENDING_RESCHEDULE (reschedule requests)
                let query = `api/bookings/manager?managerId=${user!.userId}&page=${bookingPage}&limit=10&status=PENDING&status=PENDING_RESCHEDULE`;
                if (bookingTypeFilter !== 'ALL') query += `&bookingType=${bookingTypeFilter}`;
                if (facilityFilter !== 'ALL') query += `&facilityId=${facilityFilter}`;
                if (dateFilter) query += `&date=${dateFilter}`;
                endpoint = query;
            }
            else if (category === 'history') {
                const statusQuery = historyFilter === 'ALL'
                    ? 'status=APPROVED&status=PENDING_PAYMENT&status=PENDING_RESCHEDULE&status=CONFIRMED&status=REJECTED&status=CANCELLED&status=RESCHEDULED&status=COMPLETED&status=IN_USE&status=ADMIN_HOLD&status=REVIEW_REQUIRED'
                    : `status=${historyFilter}`;
                endpoint = `api/bookings/manager?managerId=${user!.userId}&page=${bookingPage}&limit=10&${statusQuery}`;
            }

            console.log('Fetching:', `${API_URL}/${endpoint}`);
            const res = await fetch(`${API_URL}/${endpoint}`);

            if (res.ok) {
                const data = await res.json();
                console.log('Response data:', data);
                if (category === 'facilities') {
                    setFacilities(data);
                } else if (category === 'equipment') {
                    setEquipments(data);
                } else if (category === 'bookings' || category === 'history') {
                    setBookings(data.data || []);
                    setBookingTotalPages(data.lastPage || 1);
                }
            } else {
                console.error(`API Error: ${res.status} ${res.statusText}`, await res.text());
            }
        } catch (error) {
            console.error(`Failed to fetch ${category}`, error);
        } finally {
            setIsFetching(false);
        }
    };

    const fetchBookingStats = async () => {
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3500';
            const res = await fetch(`${API_URL}/api/bookings/manager/stats?managerId=${user!.userId}`);
            if (res.ok) {
                const data = await res.json();
                setBookingStats(data);
            }
        } catch (error) {
            console.error("Failed to fetch booking stats", error);
        }
    };

    const handleAddFacilitySuccess = () => {
        setIsAddFacilityOpen(false);
        fetchData('facilities');

        // If we were editing from detail modal, re-open it with updated data
        if (editingFacility) {
            // Find updated facility from refreshed data
            setTimeout(() => {
                // Re-open detail modal (we'll refresh data first)
                setSelectedFacility(editingFacility);
            }, 100);
        }
        setEditingFacility(null);
    };

    const handleAddEquipmentSuccess = () => {
        setIsAddEquipmentOpen(false);

        if (activeCategory === 'equipment') {
            fetchData('equipment');
        }

        // If we were editing from facility detail modal, re-open it
        if (editingEquipment && editingEquipment.facilityId) {
            // Find the facility and re-open detail modal
            const fac = facilities.find(f => f.facilityId === editingEquipment.facilityId);
            if (fac) {
                setTimeout(() => {
                    setSelectedFacility(fac);
                }, 100);
            }
        } else if (prefilledFacilityId) {
            // We were adding equipment from facility detail - re-open it
            const fac = facilities.find(f => f.facilityId === prefilledFacilityId);
            if (fac) {
                setTimeout(() => {
                    setSelectedFacility(fac);
                }, 100);
            }
        }
        setEditingEquipment(null);
        setPrefilledFacilityId(null);
    };

    const handleEditFacility = (facility: Facility) => {
        // Close detail modal first
        setSelectedFacility(null);
        // Then open edit modal
        setEditingFacility(facility);
        setIsAddFacilityOpen(true);
    };

    const handleEditEquipment = (equipment: Equipment) => {
        // Close detail modal first
        setSelectedFacility(null);
        // Then open edit modal
        setEditingEquipment(equipment);
        setIsAddEquipmentOpen(true);
    };

    const handleAddEquipmentForFacility = (facilityId: number) => {
        // Store the facility we're adding equipment to
        const fac = facilities.find(f => f.facilityId === facilityId);
        // Close detail modal first
        setSelectedFacility(null);
        // Set prefilled facility ID
        setPrefilledFacilityId(facilityId);
        // Open add equipment modal
        setIsAddEquipmentOpen(true);
    };

    const handleProcessBooking = async (bookingId: number, action: 'approve' | 'reject', reason?: string) => {
        if (!user) return;
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3500';

            // Check if this is a reschedule request
            const booking = bookings.find(b => b.bookingId === bookingId);
            const isReschedule = booking?.status === 'PENDING_RESCHEDULE';

            let endpoint = '';
            if (isReschedule) {
                endpoint = `/api/bookings/${bookingId}/${action}-reschedule`;
            } else {
                endpoint = `/api/bookings/${bookingId}/${action}`;
            }

            const res = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': user.userId.toString()
                },
                body: action === 'reject' ? JSON.stringify({ reason }) : undefined
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || `Failed to ${action} booking`);
            }

            // Success feedback
            alert(`Booking ${action}d successfully`);
            setBookingToReview(null);
            fetchData('bookings'); // Refresh list
            fetchBookingStats(); // Refresh stats
        } catch (error: any) {
            alert(error.message);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!user || !['ADMIN', 'FACILITY_MANAGER'].includes(user.role)) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
            <Navbar />

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar */}
                <aside className="w-64 bg-white border-r border-gray-200 hidden md:block flex-shrink-0 h-[calc(100vh-64px)] overflow-y-auto">
                    <div className="p-4 space-y-6">
                        <div className="space-y-1">
                            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">
                                Dashboard
                            </h2>
                            <button
                                onClick={() => { setActiveCategory('bookings'); setBookingPage(1); }}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                    activeCategory === 'bookings'
                                        ? "bg-blue-50 text-blue-700"
                                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                                )}
                            >
                                <CalendarCheck className="w-4 h-4" />
                                Manage Bookings
                            </button>
                            <button
                                onClick={() => setActiveCategory('facilities')}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                    activeCategory === 'facilities'
                                        ? "bg-blue-50 text-blue-700"
                                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                                )}
                            >
                                <Building2 className="w-4 h-4" />
                                Facilities Management
                            </button>
                            <button
                                onClick={() => setActiveCategory('equipment')}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                    activeCategory === 'equipment'
                                        ? "bg-blue-50 text-blue-700"
                                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                                )}
                            >
                                <Wrench className="w-4 h-4" />
                                Equipment Inventory
                            </button>
                            <button
                                onClick={() => { setActiveCategory('history'); setBookingPage(1); }}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                    activeCategory === 'history'
                                        ? "bg-blue-50 text-blue-700"
                                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                                )}
                            >
                                <ClipboardList className="w-4 h-4" />
                                Booking History
                            </button>
                        </div>

                        <div className="pt-4 border-t border-gray-100">
                            <div className="text-xs text-center text-gray-400">
                                Logged in as {user.fullName}
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 p-6 overflow-y-auto h-[calc(100vh-64px)]">
                    <div className="max-w-[1600px] mx-auto space-y-6">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                                    {activeCategory === 'bookings' ? "Manage Bookings" :
                                        activeCategory === 'facilities' ? "My Facilities" :
                                            activeCategory === 'equipment' ? "My Equipment" : "Booking History"}
                                </h1>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    {activeCategory === 'bookings' ? "Review and process pending booking requests." :
                                        activeCategory === 'history' ? "View all processed booking decisions and logs." :
                                            `Manage your ${activeCategory} and inventory assets.`}
                                </p>
                            </div>
                            {(activeCategory === 'facilities' || activeCategory === 'equipment') && (
                                <Button
                                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm gap-2 h-9 text-sm"
                                    onClick={() => {
                                        if (activeCategory === 'facilities') setIsAddFacilityOpen(true);
                                        else if (activeCategory === 'equipment') setIsAddEquipmentOpen(true);
                                    }}
                                >
                                    <Plus className="w-4 h-4" />
                                    Add {activeCategory === 'facilities' ? 'Facility' : 'Equipment'}
                                </Button>
                            )}
                            {activeCategory === 'history' && (
                                <div className="flex bg-white p-1 rounded-lg border border-gray-200 flex-wrap gap-1">
                                    {['ALL', 'PENDING_RESCHEDULE', 'PENDING_PAYMENT', 'APPROVED', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED'].map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => {
                                                setHistoryFilter(status);
                                                setBookingPage(1);
                                            }}
                                            className={cn(
                                                "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                                                historyFilter === status
                                                    ? "bg-blue-50 text-blue-700 shadow-sm"
                                                    : "text-gray-600 hover:bg-gray-50"
                                            )}
                                        >
                                            {status === 'ALL' ? 'All History' :
                                                status === 'PENDING_PAYMENT' ? 'Waiting Payment' :
                                                    status === 'PENDING_RESCHEDULE' ? 'Reschedule Req' :
                                                        status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {activeCategory === 'bookings' && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <StatsCard title="Pending Requests" value={(bookingStats.PENDING || 0) + (bookingStats.PENDING_RESCHEDULE || 0)} icon={<CalendarCheck className="w-5 h-5 text-blue-600" />} color="bg-blue-50 border-blue-100" />
                                <StatsCard title="Approved" value={bookingStats.APPROVED || 0} icon={<CalendarCheck className="w-5 h-5 text-green-600" />} color="bg-green-50 border-green-100" />
                                <StatsCard title="Rejected" value={bookingStats.REJECTED || 0} icon={<CalendarCheck className="w-5 h-5 text-red-600" />} color="bg-red-50 border-red-100" />
                                <StatsCard title="Cancelled" value={bookingStats.CANCELLED || 0} icon={<CalendarCheck className="w-5 h-5 text-gray-600" />} color="bg-gray-50 border-gray-100" />
                            </div>
                        )}

                        {/* Toolbar */}
                        {activeCategory !== 'bookings' && (
                            <div className="flex gap-3">
                                <div className="relative flex-1 max-w-sm">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder={`Search ${activeCategory}...`}
                                        className="pl-9 w-full h-9 rounded-md border border-gray-200 bg-white px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>
                                <Button variant="outline" size="sm" className="gap-2 h-9">
                                    <Filter className="w-3.5 h-3.5" />
                                    Filters
                                </Button>
                            </div>
                        )}

                        {/* Content Grid / Table */}
                        {activeCategory === 'bookings' ? (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <h3 className="font-semibold text-gray-900">Pending Requests Queue</h3>
                                    <div className="flex gap-2 flex-wrap">
                                        {/* Booking Type Filter */}
                                        <select
                                            value={bookingTypeFilter}
                                            onChange={(e) => { setBookingTypeFilter(e.target.value); setBookingPage(1); }}
                                            className="h-9 px-3 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="ALL">All Types</option>
                                            <option value="ACADEMIC">Academic</option>
                                            <option value="EVENT">Event</option>
                                            <option value="PERSONAL">Personal</option>
                                        </select>
                                        {/* Facility Filter */}
                                        <select
                                            value={facilityFilter}
                                            onChange={(e) => { setFacilityFilter(e.target.value); setBookingPage(1); }}
                                            className="h-9 px-3 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="ALL">All Facilities</option>
                                            {facilities.map((f) => (
                                                <option key={f.facilityId} value={f.facilityId.toString()}>{f.name}</option>
                                            ))}
                                        </select>
                                        {/* Date Filter */}
                                        <input
                                            type="date"
                                            value={dateFilter}
                                            onChange={(e) => { setDateFilter(e.target.value); setBookingPage(1); }}
                                            className="h-9 px-3 rounded-md border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        {/* Clear Filters */}
                                        {(bookingTypeFilter !== 'ALL' || facilityFilter !== 'ALL' || dateFilter) && (
                                            <button
                                                onClick={() => {
                                                    setBookingTypeFilter('ALL');
                                                    setFacilityFilter('ALL');
                                                    setDateFilter('');
                                                    setBookingPage(1);
                                                }}
                                                className="h-9 px-3 rounded-md border border-gray-200 bg-white text-sm text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-medium">
                                            <tr>
                                                <th className="px-6 py-3">Facility</th>
                                                <th className="px-6 py-3">User (MSSV/MSCB)</th>
                                                <th className="px-6 py-3">Purpose</th>
                                                <th className="px-6 py-3">Type</th>
                                                <th className="px-6 py-3">Date & Time</th>
                                                <th className="px-6 py-3">Status</th>
                                                <th className="px-6 py-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {isFetching ? (
                                                <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-500">Loading bookings...</td></tr>
                                            ) : bookings.length > 0 ? (
                                                bookings.map((booking) => (
                                                    <tr key={booking.bookingId} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-6 py-4 font-medium text-gray-900">{booking.facility?.name}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-gray-900">{booking.user?.fullName}</span>
                                                                <span className="text-xs text-gray-500">{booking.user?.ssoId}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 truncate max-w-xs" title={booking.purpose}>{booking.purpose}</td>
                                                        <td className="px-6 py-4">
                                                            <Badge
                                                                variant="outline"
                                                                className={cn(
                                                                    "text-xs font-medium",
                                                                    booking.bookingType === 'ACADEMIC' && "border-blue-200 bg-blue-50 text-blue-700",
                                                                    booking.bookingType === 'EVENT' && "border-purple-200 bg-purple-50 text-purple-700",
                                                                    booking.bookingType === 'PERSONAL' && "border-green-200 bg-green-50 text-green-700"
                                                                )}
                                                            >
                                                                {booking.bookingType}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-gray-900">{new Date(booking.checkInTime).toLocaleDateString()}</span>
                                                                <span className="text-xs text-gray-500">
                                                                    {new Date(booking.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                                                                    {new Date(booking.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4"><StatusBadge status={booking.status} /></td>
                                                        <td className="px-6 py-4 text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                                onClick={() => setBookingToReview(booking)}
                                                            >
                                                                Review
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-500">No pending bookings found.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={bookingPage <= 1}
                                        onClick={() => setBookingPage(p => p - 1)}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={bookingPage >= bookingTotalPages}
                                        onClick={() => setBookingPage(p => p + 1)}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        ) : activeCategory === 'history' ? (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                        <ClipboardList className="w-4 h-4 text-gray-500" />
                                        Process Log
                                    </h3>
                                    <div className="text-xs text-gray-500">
                                        Showing {bookings.length} records
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-medium">
                                            <tr>
                                                <th className="px-6 py-3">ID</th>
                                                <th className="px-6 py-3">Facility</th>
                                                <th className="px-6 py-3">User</th>
                                                <th className="px-6 py-3">Date & Time</th>
                                                <th className="px-6 py-3">Status</th>
                                                <th className="px-6 py-3">Note / Reason</th>
                                                {/* <th className="px-6 py-3 text-right">Action</th> */}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {isFetching ? (
                                                <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-500">Loading history...</td></tr>
                                            ) : bookings.length > 0 ? (
                                                bookings.map((booking) => (
                                                    <tr key={booking.bookingId} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-6 py-4 text-xs text-gray-400">#{booking.bookingId}</td>
                                                        <td className="px-6 py-4 font-medium text-gray-900 text-xs sm:text-sm">{booking.facility?.name}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-gray-900 text-xs sm:text-sm">{booking.user?.fullName}</span>
                                                                <span className="text-xs text-gray-500">{booking.user?.ssoId}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col text-xs sm:text-sm">
                                                                <span className="text-gray-900">{new Date(booking.checkInTime).toLocaleDateString()}</span>
                                                                <span className="text-xs text-gray-500">
                                                                    {new Date(booking.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                                                                    {new Date(booking.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4"><StatusBadge status={booking.status} /></td>
                                                        <td className="px-6 py-4 text-xs text-gray-500 max-w-xs truncate" title={booking.cancellationReason || booking.purpose}>
                                                            {booking.status === 'REJECTED' || booking.status === 'CANCELLED' ? (
                                                                <span className="text-red-500">{booking.cancellationReason || 'No reason provided'}</span>
                                                            ) : (
                                                                <span className="text-gray-400 italic">{booking.purpose}</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-500">No history records found.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={bookingPage <= 1}
                                        onClick={() => setBookingPage(p => p - 1)}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={bookingPage >= bookingTotalPages}
                                        onClick={() => setBookingPage(p => p + 1)}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            // Existing Grid for Facilities/Equipment
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                                {activeCategory === 'facilities' ? (
                                    isFetching ? (
                                        <div className="col-span-full py-10 text-center text-gray-500">Loading facilities...</div>
                                    ) : (
                                        facilities.map((facility) => (
                                            <FacilityCard
                                                key={facility.facilityId}
                                                facility={facility}
                                                onClick={() => setSelectedFacility(facility)}
                                            />
                                        ))
                                    )
                                ) : (
                                    equipments.map((item) => (
                                        <EquipmentCard
                                            key={item.equipmentId}
                                            item={item}
                                            onEdit={handleEditEquipment}
                                        />
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Modals */}
            {isAddFacilityOpen && (
                <AddFacilityModal
                    isOpen={isAddFacilityOpen}
                    onClose={() => {
                        setIsAddFacilityOpen(false);
                        // Re-open detail modal if we were editing from there
                        if (editingFacility) {
                            setSelectedFacility(editingFacility);
                        }
                        setEditingFacility(null);
                    }}
                    onSuccess={handleAddFacilitySuccess}
                    user={user}
                    initialData={editingFacility}
                />
            )}

            {isAddEquipmentOpen && (
                <AddEquipmentModal
                    isOpen={isAddEquipmentOpen}
                    onClose={() => {
                        setIsAddEquipmentOpen(false);
                        // Re-open detail modal if we were editing or adding from there
                        if (editingEquipment && editingEquipment.facilityId) {
                            const fac = facilities.find(f => f.facilityId === editingEquipment.facilityId);
                            if (fac) {
                                setSelectedFacility(fac);
                            }
                        } else if (prefilledFacilityId) {
                            const fac = facilities.find(f => f.facilityId === prefilledFacilityId);
                            if (fac) {
                                setSelectedFacility(fac);
                            }
                        }
                        setEditingEquipment(null);
                        setPrefilledFacilityId(null);
                    }}
                    onSuccess={handleAddEquipmentSuccess}
                    user={user}
                    initialData={editingEquipment}
                    prefilledFacilityId={prefilledFacilityId}
                />
            )}

            {bookingToReview && (
                <BookingReviewModal
                    booking={bookingToReview}
                    onClose={() => setBookingToReview(null)}
                    onProcess={handleProcessBooking}
                />
            )}

            {selectedFacility && (
                <FacilityDetailModal
                    facility={selectedFacility}
                    onClose={() => setSelectedFacility(null)}
                    onEditFacility={handleEditFacility}
                    onEditEquipment={handleEditEquipment}
                    onAddEquipment={handleAddEquipmentForFacility}
                />
            )}
        </div>
    );
}

function StatsCard({ title, value, icon, color }: any) {
    return (
        <div className={cn("p-4 rounded-xl border flex flex-col gap-2 relative overflow-hidden bg-white", color)}>
            <div className="flex justify-between items-start">
                <span className="text-gray-500 font-medium text-sm">{title}</span>
                {icon}
            </div>
            <span className="text-2xl font-bold text-gray-900">{value}</span>
        </div>
    )
}


// Sub-components

function FacilityCard({ facility, onClick }: { facility: Facility, onClick?: () => void }) {
    return (
        <Card
            className="flex flex-col h-full overflow-hidden hover:shadow-md transition-shadow duration-300 border-gray-200 group bg-white cursor-pointer"
            onClick={onClick}
        >
            <div className="relative h-32 bg-gray-100 w-full overflow-hidden">
                {facility.imageUrl ? (
                    <img
                        src={facility.imageUrl}
                        alt={facility.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-300">
                        <Building2 className="w-8 h-8" />
                    </div>
                )}
                <div className="absolute top-2 right-2 scale-90 origin-top-right">
                    <StatusBadge status={facility.status} />
                </div>
            </div>

            <CardHeader className="p-3 pb-0">
                <h3 className="font-semibold text-base text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1" title={facility.name}>
                    {facility.name}
                </h3>
            </CardHeader>

            <CardContent className="flex-1 space-y-1.5 p-3 pt-2">
                <div className="flex items-center text-xs text-gray-500 gap-2">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                    <span className="truncate">{facility.location || 'No location'}</span>
                </div>
                <div className="flex items-center text-xs text-gray-500 gap-2">
                    <Users className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                    <span>Capacity: {facility.capacity}</span>
                </div>
            </CardContent>

            <CardFooter className="p-3 pt-0 mt-auto">
                <div className="w-full flex items-center justify-between text-xs text-blue-600">
                    <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        View Details
                    </span>
                    <ChevronRight className="w-4 h-4" />
                </div>
            </CardFooter>
        </Card>
    );
}

// 1. Update EquipmentCard component
function EquipmentCard({ item, onEdit }: { item: Equipment, onEdit?: (item: Equipment) => void }) {
    return (
        <Card className="flex flex-col h-full hover:shadow-md transition-shadow duration-300 border-gray-200 group bg-white">
            <CardHeader className="p-3 pb-0">
                <div className="flex justify-between items-start mb-2">
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
                        <Wrench className="w-4 h-4" />
                    </div>
                    <StatusBadge status={item.status} />
                </div>
                <h3 className="font-semibold text-base text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {item.name}
                </h3>
            </CardHeader>
            <CardContent className="flex-1 space-y-1.5 p-3 pt-2">
                <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Inventory:</span>
                        <span className="font-medium text-gray-900">{item.availableQuantity} / {item.totalQuantity}</span>
                    </div>
                    {/* Progress bar for stock */}
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className={cn("h-full rounded-full transition-all",
                                item.availableQuantity === 0 ? "bg-red-500" :
                                    item.availableQuantity < item.totalQuantity * 0.3 ? "bg-yellow-500" : "bg-green-500"
                            )}
                            style={{ width: `${(item.availableQuantity / item.totalQuantity) * 100}%` }}
                        />
                    </div>
                </div>
            </CardContent>
            <CardFooter className="p-3 pt-0 mt-auto">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs gap-1.5 hover:bg-gray-50 hover:text-blue-600"
                    onClick={() => onEdit && onEdit(item)}
                >
                    <Edit className="w-3 h-3" />
                    Edit
                </Button>
            </CardFooter>
        </Card>
    );
}

function FacilityDetailModal({ facility, onClose, onEditFacility, onEditEquipment, onAddEquipment }: {
    facility: Facility,
    onClose: () => void,
    onEditFacility: (facility: Facility) => void,
    onEditEquipment: (equipment: Equipment) => void,
    onAddEquipment: (facilityId: number) => void
}) {
    const [activeTab, setActiveTab] = useState<'overview' | 'calendar'>('overview');
    const [facilityEquipments, setFacilityEquipments] = useState<Equipment[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]); // Calendar bookings
    const [isLoading, setIsLoading] = useState(true);
    const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);

    // Calendar State
    const [currentDate, setCurrentDate] = useState(new Date());

    // Selection State: Supports Range for Creation, Single for Existing
    const [selection, setSelection] = useState<{
        date: Date;
        slotIndices: number[]; // e.g. [1, 2, 3]
        booking?: Booking; // If existing booking is selected
    } | null>(null);

    // Fetch Equipments
    React.useEffect(() => {
        const fetchEquipments = async () => {
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3500';
                const res = await fetch(`${API_URL}/api/equipments?facilityId=${facility.facilityId}`);
                if (res.ok) {
                    const data = await res.json();
                    setFacilityEquipments(data);
                }
            } catch (error) {
                console.error("Failed to fetch facility equipments", error);
            }
        };
        fetchEquipments();
    }, [facility.facilityId]);

    // Fetch Bookings for Calendar
    React.useEffect(() => {
        if (activeTab === 'calendar') {
            const fetchBookings = async () => {
                try {
                    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3500';
                    const res = await fetch(`${API_URL}/api/bookings/facility/${facility.facilityId}`);
                    if (res.ok) {
                        const data = await res.json();
                        setBookings(data);
                    }
                } catch (error) {
                    console.error("Failed to fetch facility bookings", error);
                }
            };
            fetchBookings();
        }
    }, [activeTab, facility.facilityId]);

    // Calendar Logic
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const SLOTS = Array.from({ length: 15 }, (_, i) => {
        return {
            id: i + 1,
            label: `${(7 + i).toString().padStart(2, '0')}:00 - ${(7 + i).toString().padStart(2, '0')}:50`
        };
    });

    const getBookingForSlot = (date: Date, slotId: number) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();
        const slotStartHour = 7 + (slotId - 1);

        const slotTime = new Date(year, month, day, slotStartHour, 1, 0); // 1 min past start

        return bookings.find(b => {
            const start = new Date(b.checkInTime);
            const end = new Date(b.checkOutTime);
            return isWithinInterval(slotTime, { start, end }) &&
                ['APPROVED', 'CONFIRMED', 'IN_USE', 'ADMIN_HOLD'].includes(b.status);
        });
    };

    const handleSlotClick = (date: Date, slotIndex: number, booking?: Booking) => {
        // Case 1: Clicked existing booking
        if (booking) {
            setSelection({
                date,
                slotIndices: [slotIndex], // Just for highlighting context, though typically booking covers range
                booking
            });
            return;
        }

        // Case 2: Clicked empty slot (Creation Mode)
        // If we were viewing a booking, or different day, reset.
        if (!selection || selection.booking || !isSameDay(selection.date, date)) {
            setSelection({
                date,
                slotIndices: [slotIndex]
            });
            return;
        }

        // Multi-select logic (same day, creation mode)
        const currentSlots = selection.slotIndices;
        const isSelected = currentSlots.includes(slotIndex);
        let newSlots = [...currentSlots];

        if (isSelected) {
            newSlots = newSlots.filter(id => id !== slotIndex);
            if (newSlots.length === 0) {
                setSelection(null);
                return;
            }
        } else {
            // Check adjacency
            const min = Math.min(...currentSlots);
            const max = Math.max(...currentSlots);

            if (slotIndex === min - 1 || slotIndex === max + 1) {
                newSlots.push(slotIndex);
            } else {
                // Reset if not adjacent (start new range)
                newSlots = [slotIndex];
            }
        }

        newSlots.sort((a, b) => a - b);
        setSelection({
            ...selection,
            slotIndices: newSlots
        });
    };

    // Actions
    const handleDeleteBooking = async () => {
        if (!selection?.booking) return;

        // Ask for reason
        const reason = prompt("Please enter a reason for cancelling this booking:", "Cancelled by Manager via Calendar");
        if (reason === null) return; // User cancelled prompt

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3500';
            const res = await fetch(`${API_URL}/api/bookings/${selection.booking.bookingId}/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': '3' // Mock Admin ID
                },
                body: JSON.stringify({ reason })
            });

            if (res.ok) {
                alert("Booking cancelled.");
                // Refresh
                const res2 = await fetch(`${API_URL}/api/bookings/facility/${facility.facilityId}`);
                if (res2.ok) setBookings(await res2.json());
                setSelection(null);
            }
        } catch (e) { console.error(e); alert("Failed to cancel"); }
    };

    const handleCreateAdminHold = async () => {
        if (!selection || selection.booking) return;

        const slots = selection.slotIndices;
        const startSlotId = Math.min(...slots);
        const endSlotId = Math.max(...slots);

        const reason = prompt(`Create Admin Hold for ${slots.length} slot(s)?\nEnter reason (e.g. Maintenance):`);
        if (!reason) return;

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3500';
            const payload = {
                facility_id: facility.facilityId,
                purpose: `[ADMIN HOLD] ${reason}`,
                booking_type: 'EVENT',
                booking_date: format(selection.date, 'yyyy-MM-dd'),
                start_slot: startSlotId,
                end_slot: endSlotId,
                status: 'ADMIN_HOLD',
                equipment_items: []
            };

            const res = await fetch(`${API_URL}/api/bookings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': '3' // Admin
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                // Refresh
                const res2 = await fetch(`${API_URL}/api/bookings/facility/${facility.facilityId}`);
                if (res2.ok) setBookings(await res2.json());
                setSelection(null);
                alert("Admin Hold created successfully.");
            } else {
                const err = await res.json();
                alert("Failed: " + err.message);
            }
        } catch (e) { console.error(e); }
    };


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className={`bg-white rounded-xl shadow-xl w-full ${activeTab === 'calendar' ? 'max-w-6xl h-[90vh]' : 'max-w-3xl max-h-[90vh]'} overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col transition-all`}>
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <h2 className="text-xl font-bold text-gray-900">{facility.name} Details</h2>
                            <p className="text-xs text-gray-500">{facility.location}</p>
                        </div>
                        <div className="flex bg-gray-200 rounded-lg p-1 text-sm font-medium">
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={cn("px-3 py-1 rounded-md transition-all", activeTab === 'overview' ? "bg-white shadow text-blue-700" : "text-gray-600 hover:text-gray-900")}
                            >
                                Overview
                            </button>
                            <button
                                onClick={() => setActiveTab('calendar')}
                                className={cn("px-3 py-1 rounded-md transition-all flex items-center gap-1", activeTab === 'calendar' ? "bg-white shadow text-blue-700" : "text-gray-600 hover:text-gray-900")}
                            >
                                <CalendarIcon className="w-3.5 h-3.5" /> Calendar
                            </button>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-gray-500">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex">
                    {activeTab === 'overview' ? (
                        /* OVERVIEW TAB CONTENT (Previous UI) */
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="flex gap-6">
                                <div className="w-1/3 aspect-video bg-gray-100 rounded-lg overflow-hidden">
                                    {facility.imageUrl ? (
                                        <img src={facility.imageUrl} alt={facility.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <Building2 className="w-10 h-10" />
                                        </div>
                                    )}
                                </div>
                                <div className="w-2/3 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                            <span className="text-xs text-blue-600 font-semibold uppercase">Status</span>
                                            <div className="mt-1"><StatusBadge status={facility.status} /></div>
                                        </div>
                                        <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                                            <span className="text-xs text-green-600 font-semibold uppercase">Price</span>
                                            <div className="font-bold text-gray-900 mt-1">
                                                {facility.price === 0 ? 'Free' : `${facility.price.toLocaleString()} đ`}
                                                <span className="text-xs font-normal text-gray-500 ml-1">
                                                    /{facility.priceType === 'PER_HOUR' ? 'hr' : facility.priceType === 'PER_BOOKING' ? 'bk' : 'once'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                            <span className="text-xs text-gray-500 font-semibold uppercase">Capacity</span>
                                            <div className="font-medium text-gray-900 mt-1 flex items-center gap-1">
                                                <Users className="w-4 h-4 text-gray-400" /> {facility.capacity} People
                                            </div>
                                        </div>
                                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                            <span className="text-xs text-gray-500 font-semibold uppercase">Type</span>
                                            <div className="font-medium text-gray-900 mt-1">
                                                {facility.type}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                        <Wrench className="w-4 h-4 text-blue-600" />
                                        Associated Equipment ({facilityEquipments.length})
                                    </h3>
                                    <Button size="sm" variant="outline" className="gap-1 px-2 h-7 text-xs" onClick={() => onAddEquipment(facility.facilityId)}>
                                        <Plus className="w-3 h-3" /> Add
                                    </Button>
                                </div>
                                {facilityEquipments.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400 border border-dashed rounded-lg">No equipment found.</div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        {facilityEquipments.map(eq => (
                                            <div key={eq.equipmentId} className="flex justify-between items-center p-3 border rounded-lg hover:border-blue-300 transition-colors bg-white">
                                                <div>
                                                    <div className="font-medium text-sm text-gray-900">{eq.name}</div>
                                                    <div className="text-xs text-gray-500">{eq.availableQuantity}/{eq.totalQuantity} • {eq.status}</div>
                                                </div>
                                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onEditEquipment(eq)}><Edit className="w-3 h-3" /></Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* CALENDAR TAB CONTENT */
                        <div className="flex-1 flex overflow-hidden">
                            {/* Left: Calendar Grid */}
                            <div className="flex-1 flex flex-col border-r overflow-hidden">
                                <div className="p-3 border-b flex justify-between items-center bg-gray-50">
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(addDays(currentDate, -7))}>
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <span className="font-medium text-sm">
                                            {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
                                        </span>
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(addDays(currentDate, 7))}>
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={() => setCurrentDate(new Date())}>Today</Button>
                                </div>
                                <div className="flex-1 overflow-auto bg-white">
                                    <div className="min-w-[700px]">
                                        {/* Header Row */}
                                        <div className="grid grid-cols-8 border-b sticky top-0 bg-white z-10">
                                            <div className="p-2 border-r bg-gray-50 text-xs font-medium text-gray-400 text-center py-3">Time</div>
                                            {weekDays.map(day => (
                                                <div key={day.toString()} className={cn("p-2 border-r text-center", isSameDay(day, new Date()) ? "bg-blue-50" : "")}>
                                                    <div className="text-xs font-semibold text-gray-900">{format(day, 'EEE')}</div>
                                                    <div className={cn("text-xs mt-0.5", isSameDay(day, new Date()) ? "text-blue-600 font-bold" : "text-gray-500")}>{format(day, 'd')}</div>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Slots */}
                                        {SLOTS.map(slot => (
                                            <div key={slot.id} className="grid grid-cols-8 border-b h-14">
                                                <div className="p-2 border-r text-xs text-gray-400 font-medium flex items-center justify-center bg-gray-50/30">
                                                    {slot.label}
                                                </div>
                                                {weekDays.map(day => {
                                                    const booking = getBookingForSlot(day, slot.id);
                                                    // Selection Check
                                                    const isSelected = selection && isSameDay(selection.date, day) && selection.slotIndices.includes(slot.id);

                                                    return (
                                                        <div
                                                            key={day.toString()}
                                                            className={cn(
                                                                "border-r p-1 relative cursor-pointer transition-colors hover:bg-gray-50",
                                                                isSelected ? "ring-2 ring-inset ring-blue-600 bg-blue-50/50 z-10" : ""
                                                            )}
                                                            onClick={() => handleSlotClick(day, slot.id, booking)}
                                                        >
                                                            {booking ? (
                                                                <div className={cn(
                                                                    "w-full h-full rounded text-[10px] p-1 leading-tight overflow-hidden flex flex-col justify-center",
                                                                    booking.status === 'ADMIN_HOLD' ? "bg-gray-800 text-white" :
                                                                        booking.status === 'MAINTENANCE' ? "bg-red-800 text-white" :
                                                                            booking.status === 'CONFIRMED' || booking.status === 'APPROVED' ? "bg-green-100 text-green-700 border border-green-200" :
                                                                                booking.status === 'IN_USE' ? "bg-blue-100 text-blue-700 border border-blue-200" :
                                                                                    "bg-gray-100 text-gray-600"
                                                                )}>
                                                                    {booking.status === 'ADMIN_HOLD' || booking.status === 'MAINTENANCE' ? (
                                                                        <>
                                                                            <span className="font-bold block truncate text-center">ADMIN HOLD</span>
                                                                            <span className="truncate opacity-75 text-[9px] text-center italic">{booking.purpose?.replace('[ADMIN HOLD] ', '') || 'Maintenance'}</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <span className="font-bold block truncate">{booking.user?.fullName || "User"}</span>
                                                                            <span className="truncate opacity-80">{booking.bookingType}</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="w-full h-full"></div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Info Column */}
                            <div className="w-80 bg-gray-50 border-l flex flex-col">
                                <div className="p-4 border-b bg-white">
                                    <h3 className="font-semibold text-gray-900">Slot Details</h3>
                                </div>
                                <div className="flex-1 p-4 overflow-y-auto">
                                    {selection ? (
                                        selection.booking ? (
                                            <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
                                                <div className="bg-white p-3 rounded-lg border shadow-sm">
                                                    <div className="text-xs text-gray-500 mb-1">Status</div>
                                                    <StatusBadge status={selection.booking.status} />
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-xs font-medium text-gray-500 uppercase">Values</span>
                                                    <div className="bg-white p-3 rounded-lg border text-sm space-y-2">
                                                        <div><span className="text-gray-500 block text-xs">User</span> <span className="font-medium">{selection.booking.user?.fullName}</span></div>
                                                        <div><span className="text-gray-500 block text-xs">Date</span> <span className="font-medium">{format(new Date(selection.booking.checkInTime), "PP")}</span></div>
                                                        <div><span className="text-gray-500 block text-xs">Time</span> <span className="font-medium">{format(new Date(selection.booking.checkInTime), "HH:mm")} - {format(new Date(selection.booking.checkOutTime), "HH:mm")}</span></div>
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-xs font-medium text-gray-500 uppercase">Purpose</span>
                                                    <div className="bg-white p-3 rounded-lg border text-sm text-gray-800">
                                                        {selection.booking.purpose}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-10 text-gray-500 animate-in fade-in duration-200">
                                                <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600">
                                                    <Plus className="w-6 h-6" />
                                                </div>
                                                <p className="font-medium text-gray-900">New Selection</p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {format(selection.date, "EEEE, MMMM d")}<br />
                                                    {selection.slotIndices.length} slot(s) selected
                                                </p>
                                                <div className="mt-4 text-xs text-gray-400 bg-gray-100 p-2 rounded">
                                                    Slots: {selection.slotIndices.join(', ')}
                                                </div>
                                            </div>
                                        )
                                    ) : (
                                        <div className="text-center py-20 text-gray-400">
                                            Select a slot to view details or create a hold.
                                        </div>
                                    )}
                                </div>

                                {/* Bottom Actions */}
                                <div className="p-4 border-t bg-white">
                                    {selection ? (
                                        selection.booking ? (
                                            <div className="space-y-2">
                                                <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDeleteBooking}>
                                                    <Trash className="w-4 h-4 mr-2" /> Cancel Booking
                                                </Button>
                                                <Button variant="outline" className="w-full justify-start" disabled title="Reschedule feature coming soon">
                                                    <Clock className="w-4 h-4 mr-2" /> Reschedule
                                                </Button>
                                            </div>
                                        ) : (
                                            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleCreateAdminHold}>
                                                <Plus className="w-4 h-4 mr-2" /> Create Admin Hold
                                            </Button>
                                        )
                                    ) : (
                                        <div className="text-xs text-center text-gray-400">No selection</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer (only for overview) or Global Close */}
                {activeTab === 'overview' && (
                    <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 flex-shrink-0">
                        <Button variant="outline" onClick={onClose}>Close</Button>
                        <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => onEditFacility(facility)}>
                            <Edit className="w-4 h-4 mr-2" /> Edit Facility
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    let colorClass, label;

    switch (status) {
        case 'AVAILABLE':
            colorClass = "bg-green-100 text-green-700 hover:bg-green-200 border-green-200";
            label = "Available";
            break;
        case 'REJECTED':
            colorClass = "bg-red-100 text-red-700 border-red-200";
            label = "Rejected";
            break;
        case 'BOOKED':
            colorClass = "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200";
            label = "Booked";
            break;
        case 'PENDING':
            colorClass = "bg-purple-100 text-purple-700 border-purple-200";
            label = "Pending";
            break;
        case 'GOOD':
            colorClass = "bg-green-100 text-green-700 border-green-200";
            label = "Good Condition";
            break;
        case 'BROKEN':
            colorClass = "bg-red-100 text-red-700 border-red-200";
            label = "Broken";
            break;
        case 'MAINTENANCE':
            colorClass = "bg-orange-100 text-orange-700 border-orange-200";
            label = "Maintenance";
            break;
        case 'LOW_STOCK':
            colorClass = "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200";
            label = "Low Stock";
            break;
        case 'OUT_OF_STOCK':
            colorClass = "bg-red-100 text-red-700 hover:bg-red-200 border-red-200";
            label = "Out of Stock";
            break;
        case 'CONFIRMED':
            colorClass = "bg-green-100 text-green-700 hover:bg-green-200 border-green-200";
            label = "Confirmed";
            break;
        case 'IN_USE':
            colorClass = "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200";
            label = "In Use";
            break;
        case 'ADMIN_HOLD':
            colorClass = "bg-gray-800 text-white border-gray-900";
            label = "Admin Hold";
            break;
        case 'REVIEW_REQUIRED':
            colorClass = "bg-orange-100 text-orange-700 border-orange-200";
            label = "Review Required";
            break;
        case 'PENDING_PAYMENT':
            colorClass = "bg-amber-100 text-amber-700 border-amber-200";
            label = "Waiting Payment";
            break;
        case 'APPROVED':
            colorClass = "bg-blue-100 text-blue-700 border-blue-200";
            label = "Approved";
            break;
        case 'CANCELLED':
            colorClass = "bg-gray-100 text-gray-700 border-gray-200";
            label = "Cancelled";
            break;
        case 'COMPLETED':
            colorClass = "bg-teal-100 text-teal-700 border-teal-200";
            label = "Completed";
            break;
        case 'RESCHEDULED':
            colorClass = "bg-indigo-100 text-indigo-700 border-indigo-200";
            label = "Rescheduled";
            break;
        case 'PENDING_RESCHEDULE':
            colorClass = "bg-violet-100 text-violet-700 border-violet-200";
            label = "Pending Reschedule";
            break;
        default:
            colorClass = "bg-gray-100 text-gray-700";
            label = status;
    }

    return (
        <Badge variant="outline" className={cn("font-medium border shadow-sm", colorClass)}>
            {label}
        </Badge>
    );
}

function AddFacilityModal({ isOpen, onClose, onSuccess, user, initialData }: { isOpen: boolean, onClose: () => void, onSuccess: () => void, user: User, initialData?: Facility | null }) {
    const [formData, setFormData] = useState({
        name: '',
        location: '',
        type: 'CLASSROOM',
        capacity: 30,
        imageUrl: '',
        price: 0,
        priceType: 'PER_HOUR',
        transactionType: 'RENTAL_FEE'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    React.useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                location: initialData.location,
                type: initialData.type || 'CLASSROOM',
                capacity: initialData.capacity,
                imageUrl: initialData.imageUrl || '',
                price: initialData.price || 0,
                priceType: initialData.priceType || 'PER_HOUR',
                transactionType: initialData.transactionType || 'RENTAL_FEE'
            });
        } else {
            setFormData({
                name: '',
                location: '',
                type: 'CLASSROOM',
                capacity: 30,
                imageUrl: '',
                price: 0,
                priceType: 'PER_HOUR',
                transactionType: 'RENTAL_FEE'
            });
        }
    }, [initialData, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        // Client side basic validation
        if (!formData.name || !formData.capacity) {
            setError("Name and Capacity are required.");
            setIsSubmitting(false);
            return;
        }

        if (formData.price < 0) {
            setError("Price cannot be negative.");
            setIsSubmitting(false);
            return;
        }

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3500';
            const endpoint = initialData ? `/api/facilities/${initialData.facilityId}` : '/api/facilities';
            const method = initialData ? 'PATCH' : 'POST';

            const res = await fetch(`${API_URL}${endpoint}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': user.userId.toString() // Mock Auth
                },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || `Failed to ${initialData ? 'update' : 'create'} facility`);
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };



    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">{initialData ? 'Edit Facility' : 'Add New Facility'}</h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-gray-500">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-200">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Facility Name *</label>
                        <input
                            type="text"
                            required
                            className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Lecture Hall C1"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Type</label>
                            <select
                                className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            >
                                <option value="CLASSROOM">Classroom</option>
                                <option value="HALL">Hall</option>
                                <option value="LAB">Laboratory</option>
                                <option value="OUTDOOR">Outdoor</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Capacity *</label>
                            <input
                                type="number"
                                required
                                min="1"
                                className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.capacity}
                                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Location</label>
                        <input
                            type="text"
                            className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Block C, Floor 1"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Pricing Type</label>
                            <select
                                className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.priceType}
                                onChange={(e) => setFormData({ ...formData, priceType: e.target.value })}
                            >
                                <option value="PER_HOUR">Per Hour</option>
                                <option value="PER_BOOKING">Per Booking (Times)</option>
                                <option value="ONE_TIME">One-Time Fee</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                                Price (VND) {formData.price === 0 && <span className="text-green-600 text-xs">Free</span>}
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="1000"
                                className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.price}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setFormData({ ...formData, price: isNaN(val) ? 0 : val });
                                }}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Transaction Type</label>
                        <select
                            className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.transactionType}
                            onChange={(e) => setFormData({ ...formData, transactionType: e.target.value })}
                        >
                            <option value="RENTAL_FEE">Rental Fee</option>
                            <option value="DEPOSIT">Deposit Required</option>
                            <option value="FINE">Fine-Based</option>
                        </select>
                        <p className="text-xs text-gray-500">
                            {formData.transactionType === 'DEPOSIT' && 'A deposit will be collected before booking.'}
                            {formData.transactionType === 'RENTAL_FEE' && 'Standard rental fee will be charged.'}
                            {formData.transactionType === 'FINE' && 'Fines may be applied for late returns or damages.'}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Image URL</label>
                        <input
                            type="text"
                            className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="https://..."
                            value={formData.imageUrl}
                            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                        />
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : (initialData ? 'Update Facility' : 'Save Facility')}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function AddEquipmentModal({ isOpen, onClose, onSuccess, user, initialData, prefilledFacilityId }: {
    isOpen: boolean,
    onClose: () => void,
    onSuccess: () => void,
    user: User,
    initialData?: Equipment | null,
    prefilledFacilityId?: number | null
}) {
    const [formData, setFormData] = useState({
        name: '',
        totalQuantity: 1,
        rentalPrice: 0,
        status: 'GOOD',
        facilityId: ''
    });
    const [facilities, setFacilities] = useState<Facility[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingFacs, setIsLoadingFacs] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch facilities for dropdown
    React.useEffect(() => {
        const fetchFacs = async () => {
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3500';
                const endpoint = `api/facilities?managerId=${user.userId}`;
                const res = await fetch(`${API_URL}/${endpoint}`);
                if (res.ok) {
                    const data = await res.json();
                    setFacilities(data);
                }
            } catch (error) {
                console.error("Failed to fetch facilities for dropdown", error);
            } finally {
                setIsLoadingFacs(false);
            }
        }
        fetchFacs();
    }, [user.userId]);

    // Pre-fill form when editing or adding to specific facility
    React.useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name,
                totalQuantity: initialData.totalQuantity,
                rentalPrice: (initialData as any).rentalPrice || 0,
                status: initialData.status,
                facilityId: initialData.facilityId ? initialData.facilityId.toString() : ''
            });
        } else {
            setFormData({
                name: '',
                totalQuantity: 1,
                rentalPrice: 0,
                status: 'GOOD',
                // Use prefilled facility ID if provided
                facilityId: prefilledFacilityId ? prefilledFacilityId.toString() : ''
            });
        }
    }, [initialData, isOpen, prefilledFacilityId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        if (!formData.name || formData.totalQuantity < 0) {
            setError("Name is required and Quantity must be non-negative.");
            setIsSubmitting(false);
            return;
        }

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3500';

            const payload = {
                ...formData,
                facilityId: formData.facilityId ? parseInt(formData.facilityId) : null,
                totalQuantity: parseInt(formData.totalQuantity as any),
                rentalPrice: parseInt(formData.rentalPrice as any)
            };

            const endpoint = initialData ? `/api/equipments/${initialData.equipmentId}` : '/api/equipments';
            const method = initialData ? 'PATCH' : 'POST';

            const res = await fetch(`${API_URL}${endpoint}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': user.userId.toString()
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || `Failed to ${initialData ? 'update' : 'add'} equipment`);
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">{initialData ? 'Edit Equipment' : 'Add New Equipment'}</h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-gray-500">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-200">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Equipment Name *</label>
                        <input
                            type="text"
                            required
                            className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Projector X200"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Total Quantity *</label>
                            <input
                                type="number"
                                required
                                min="0"
                                className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.totalQuantity}
                                onChange={(e) => setFormData({ ...formData, totalQuantity: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Rental Price (VND)</label>
                            <input
                                type="number"
                                min="0"
                                step="1000"
                                className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.rentalPrice}
                                onChange={(e) => setFormData({ ...formData, rentalPrice: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Assigned Facility (Optional)</label>
                        <select
                            className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.facilityId}
                            onChange={(e) => setFormData({ ...formData, facilityId: e.target.value })}
                        >
                            <option value="">-- Shared Inventory / No Fixed Facility --</option>
                            {isLoadingFacs ? <option disabled>Loading facilities...</option> :
                                facilities.map(fac => (
                                    <option key={fac.facilityId} value={fac.facilityId}>{fac.name}</option>
                                ))
                            }
                        </select>
                        <p className="text-xs text-gray-500">If selected, this equipment belongs to the specific facility.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Status</label>
                        <select
                            className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        >
                            <option value="GOOD">Good</option>
                            <option value="MAINTENANCE">Maintenance</option>
                            <option value="BROKEN">Broken</option>
                        </select>
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : (initialData ? 'Update Equipment' : 'Save Equipment')}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function BookingReviewModal({ booking, onClose, onProcess }: { booking: Booking, onClose: () => void, onProcess: (id: number, action: 'approve' | 'reject', reason?: string) => void }) {
    const [rejectReason, setRejectReason] = useState("");
    const [isRejecting, setIsRejecting] = useState(false);

    const handleAction = (action: 'approve' | 'reject') => {
        if (action === 'reject' && !isRejecting) {
            setIsRejecting(true);
            return;
        }

        // If confirming reject
        if (action === 'reject') {
            onProcess(booking.bookingId, 'reject', rejectReason);
        } else {
            onProcess(booking.bookingId, 'approve');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            {booking.status === 'PENDING_RESCHEDULE' ? 'Review Reschedule Request' : 'Review Request'} #{booking.bookingId}
                        </h2>
                        <p className="text-sm text-gray-500">Submitted by {booking.user?.fullName}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-gray-500">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Key Info Grid */}
                    <div className="grid grid-cols-2 gap-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Facility</span>
                            <div className="flex items-center gap-2 mt-1">
                                <Building2 className="w-4 h-4 text-blue-600" />
                                <span className="font-medium text-gray-900">{booking.facility?.name}</span>
                            </div>
                        </div>
                        <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</span>
                            <div className="flex items-center gap-2 mt-1">
                                <CalendarCheck className="w-4 h-4 text-blue-600" />
                                <span className="font-medium text-gray-900">
                                    {new Date(booking.checkInTime).toLocaleDateString()} <span className="text-gray-400 font-normal">|</span> {new Date(booking.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(booking.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-900">Purpose of Use</label>
                        <div className="p-3 border rounded-md bg-white text-gray-700 text-sm min-h-[60px]">
                            {booking.purpose}
                        </div>
                    </div>

                    {/* Conflict Check Badge (Mock) */}
                    <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-md text-sm text-green-800">
                        <div className="bg-green-100 p-1 rounded-full"><Users className="w-4 h-4 text-green-600" /></div>
                        <div>
                            <span className="font-semibold">System Check Passed:</span> No time conflicts with other approved bookings.
                        </div>
                    </div>

                    {/* Rejection Input */}
                    {isRejecting && (
                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                            <label className="text-sm font-medium text-red-600">Reason for Rejection (Optional)</label>
                            <textarea
                                className="w-full min-h-[80px] p-3 border border-red-200 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-sm"
                                placeholder="e.g. Facility is under maintenance, prioritize another event..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                autoFocus
                            />
                        </div>
                    )}
                </div>

                <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                    {!isRejecting ? (
                        <>
                            <Button variant="ghost" onClick={() => handleAction('reject')} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                Reject Request
                            </Button>
                            <Button onClick={() => handleAction('approve')} className="bg-blue-600 hover:bg-blue-700 shadow-sm">
                                Approve Request
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => setIsRejecting(false)}>
                                Cancel Rejection
                            </Button>
                            <Button onClick={() => handleAction('reject')} variant="destructive">
                                Confirm Reject
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
