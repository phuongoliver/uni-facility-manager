"use client";
import { useRouter } from "next/navigation";

import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import {
    Clock,
    MapPin,
    Loader2,
    Edit,
    Trash2
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
    };
    details: any[];
}

export default function MyBookingsPage() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchBookings = async () => {
        try {
            const res = await fetch("http://localhost:3500/api/bookings");
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
        fetchBookings();
    }, []);



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
        alert("Dời lịch thành công!");
        setIsRescheduling(false);
        setBookingToEdit(null);
        fetchBookings(); // Refresh list
    };

    const handleCancel = async () => {
        if (!bookingToEdit) return;
        if (!window.confirm("Bạn có chắc chắn muốn hủy đơn này không? Hành động này không thể hoàn tác.")) return;

        try {
            const res = await fetch(`http://localhost:3500/api/bookings/${bookingToEdit}`, {
                method: "DELETE",
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

            alert("Đã hủy đơn đặt phòng thành công.");
            setBookingToEdit(null);
            setSelectedBooking(null); // Close detail modal
        } catch (error) {
            console.error(error);
            alert("Có lỗi xảy ra khi hủy.");
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
            case "PENDING": return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100/80";
            case "REJECTED": return "bg-red-100 text-red-700 hover:bg-red-100/80";
            case "CANCELLED": return "bg-gray-100 text-gray-700 hover:bg-gray-100/80";
            case "COMPLETED": return "bg-blue-100 text-blue-700 hover:bg-blue-100/80";
            default: return "bg-gray-100 text-gray-700";
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "APPROVED": return "Đã duyệt";
            case "PENDING": return "Chờ duyệt";
            case "REJECTED": return "Từ chối";
            case "CANCELLED": return "Đã hủy";
            case "COMPLETED": return "Hoàn thành";
            default: return status;
        }
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key !== columnKey) return <span className="ml-1 text-gray-300">↕</span>;
        return sortConfig.direction === 'asc' ? <span className="ml-1 text-primary">↑</span> : <span className="ml-1 text-primary">↓</span>;
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Lịch Sử Đặt Phòng</h1>
                    <p className="text-gray-500 mt-1 text-sm">Quản lý các yêu cầu mượn phòng và thiết bị của bạn.</p>
                </div>
                <Button onClick={fetchBookings} variant="outline" size="sm">
                    <Clock className="w-4 h-4 mr-2" /> Làm mới
                </Button>
            </div>

            <Card className="border-none shadow-sm overflow-hidden bg-white mb-6">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                                <TableHead className="w-[80px] text-center">
                                    STT
                                </TableHead>
                                <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('facility')}>
                                    Địa điểm <SortIcon columnKey="facility" />
                                </TableHead>
                                <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('checkInTime')}>
                                    Thời gian <SortIcon columnKey="checkInTime" />
                                </TableHead>
                                <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('purpose')}>
                                    Mục đích <SortIcon columnKey="purpose" />
                                </TableHead>
                                <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('totalAmount')}>
                                    Tổng tiền <SortIcon columnKey="totalAmount" />
                                </TableHead>
                                <TableHead className="cursor-pointer hover:bg-gray-100" onClick={() => handleSort('status')}>
                                    Trạng thái <SortIcon columnKey="status" />
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-32 text-center">
                                        <div className="flex items-center justify-center gap-2 text-gray-500">
                                            <Loader2 className="w-5 h-5 animate-spin" /> Đang tải dữ liệu...
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : paginatedBookings.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-32 text-center text-gray-500">
                                        Bạn chưa có yêu cầu đặt phòng nào.
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
                        Trang {currentPage} / {Math.max(totalPages, 1)}
                    </div>
                    <div className="space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            Trước
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                        >
                            Sau
                        </Button>
                    </div>
                </div>
            )}



            {/* Booking Detail Modal */}
            {selectedBooking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                Chi Tiết Đơn Đặt #{selectedBooking.bookingId}
                            </h3>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedBooking(null)} className="rounded-full h-8 w-8 hover:bg-gray-100">
                                <span className="text-lg">✕</span>
                            </Button>
                        </div>

                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                            {/* Header Info */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                                <div className="flex flex-col">
                                    <span className="text-sm text-gray-500">Trạng thái</span>
                                    <Badge variant="outline" className={`mt-1 px-3 py-1 w-fit border-0 ${getStatusColor(selectedBooking.status)}`}>
                                        {getStatusLabel(selectedBooking.status)}
                                    </Badge>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-sm text-gray-500">Tổng chi phí</span>
                                    <span className="font-bold text-2xl text-primary">
                                        {selectedBooking.totalAmount ? parseInt(selectedBooking.totalAmount).toLocaleString() + ' đ' : '0 đ'}
                                    </span>
                                </div>
                            </div>

                            {/* Main Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-medium text-gray-500 flex items-center gap-1"><MapPin className="w-4 h-4" /> Địa điểm</h4>
                                    <p className="font-medium text-gray-900 text-lg">{selectedBooking.facility?.name}</p>
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-sm font-medium text-gray-500 flex items-center gap-1"><Clock className="w-4 h-4" /> Thời gian</h4>
                                    <div className="font-medium text-gray-900">
                                        {format(new Date(selectedBooking.checkInTime), "dd/MM/yyyy")}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        {format(new Date(selectedBooking.checkInTime), "HH:mm")} - {format(new Date(selectedBooking.checkOutTime), "HH:mm")}
                                    </div>
                                </div>
                            </div>

                            <div className="border-t pt-4"></div>

                            {/* Purpose */}
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-gray-500">Mục đích sử dụng</h4>
                                <div className="p-4 bg-gray-50 rounded-md border text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                                    {selectedBooking.purpose}
                                </div>
                            </div>

                            {/* Equipment */}
                            {selectedBooking.details && selectedBooking.details.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-gray-500">Thiết bị kèm theo</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedBooking.details.map((detail: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-sm font-medium border border-blue-100">
                                                <span>{detail.equipment?.name || "Thiết bị"}</span>
                                                <span className="bg-white px-1.5 rounded-sm text-xs border border-blue-200">x{detail.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                            <Button
                                variant="outline"
                                onClick={() => setSelectedBooking(null)}
                            >
                                Đóng
                            </Button>
                            {(selectedBooking.status === 'PENDING' || selectedBooking.status === 'APPROVED') && (
                                <>
                                    <Button
                                        onClick={handleReschedule}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        <Clock className="w-4 h-4 mr-2" />
                                        Dời lịch
                                    </Button>
                                    <Button
                                        onClick={handleCancel}
                                        variant="destructive"
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Hủy đơn
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Reschedule Modal (Large) */}
            {isRescheduling && bookingToEdit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                            <h2 className="text-xl font-bold text-gray-800">Dời Lịch Đặt Phòng #{bookingToEdit}</h2>
                            <Button variant="ghost" size="sm" onClick={() => setIsRescheduling(false)}>
                                ✕ Đóng
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
            )}
        </div>
    );
}
