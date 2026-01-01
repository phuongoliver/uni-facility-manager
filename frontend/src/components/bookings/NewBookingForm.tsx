"use client";

import React, { useState, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, isSameDay, setHours, setMinutes } from "date-fns";
import { vi } from "date-fns/locale";
import {
    Calendar as CalendarIcon,
    Plus,
    Trash2,
    DollarSign,
    Upload,
    AlertCircle,
    CalendarDays
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookingType } from "@/types/booking";
import { ScheduleGrid, TIME_SLOTS } from "./ScheduleGrid";

// --- MOCK DATA ---
const FACILITIES = [
    { id: 1, name: "Phòng Hội Thảo A", capacity: 50, pricePerHour: 500000, deposit: 1000000, type: "Hội trường" },
    { id: 2, name: "Phòng Học 101", capacity: 30, pricePerHour: 200000, deposit: 500000, type: "Phòng học" },
    { id: 3, name: "Lab Máy Tính", capacity: 25, pricePerHour: 300000, deposit: 2000000, type: "Phòng Lab" },
    { id: 4, name: "Sân Bóng Chuyền", capacity: 200, pricePerHour: 150000, deposit: 500000, type: "Ngoài trời" },
];

const EQUIPMENTS = [
    { id: 1, name: "Máy chiếu 4K", price: 100000, deposit: 2000000 },
    { id: 2, name: "Micro không dây", price: 50000, deposit: 500000 },
    { id: 3, name: "Bảng viết kính", price: 20000, deposit: 0 },
    { id: 4, name: "Loa thùng", price: 80000, deposit: 1000000 },
];

// Mock booked slots (e.g., Slot 2&3 on Today are busy)
const BOOKED_SLOTS_MOCK = [
    { date: new Date(), slotId: 2 },
    { date: new Date(), slotId: 3 },
];

// --- ZOD SCHEMA ---
const bookingSchema = z.object({
    facilityId: z.string().min(1, "Vui lòng chọn phòng"),
    bookingType: z.nativeEnum(BookingType),
    purpose: z.string()
        .min(10, "Mục đích sử dụng quá ngắn")
        .refine((val) => val.trim().split(/\s+/).length <= 150, "Không được quá 150 từ"),
    equipments: z.array(
        z.object({
            equipmentId: z.string().min(1, "Chọn thiết bị"),
            quantity: z.number().min(1, "Số lượng tối thiểu là 1"),
        })
    ).optional(),
    recurrence_type: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
    recurrence_end_date: z.string().optional(), // Date string from input type="date"
    rescheduleReason: z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

interface NewBookingFormProps {
    editBookingId?: number;
    onSuccess?: () => void;
}

export function NewBookingForm({ editBookingId, onSuccess }: NewBookingFormProps) {
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedSlots, setSelectedSlots] = useState<number[]>([]);

    // Check if recurrence
    const [isRecurring, setIsRecurring] = useState(false);

    const form = useForm<BookingFormValues>({
        resolver: zodResolver(bookingSchema),
        defaultValues: {
            facilityId: "",
            bookingType: BookingType.ACADEMIC,
            equipments: [],
            purpose: "",
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "equipments",
    });

    // --- FETCH EDIT DATA ---
    React.useEffect(() => {
        if (!editBookingId) return;

        // Fetch user bookings (since they are in history) or finding specific booking
        // Using common finding logic (mocked by fetching all for user for now, or findByFacility if we had API)
        // Correct approach: We use the API we have.
        // Let's assume we can fetch all bookings for user (we are user) and find it.
        // Actually, getting /api/bookings returns history.
        fetch('http://localhost:3500/api/bookings')
            .then(res => res.json())
            .then((bookings: any[]) => {
                const booking = bookings.find(b => b.bookingId === editBookingId);
                if (booking) {
                    form.reset({
                        facilityId: booking.facilityId.toString(),
                        purpose: booking.purpose,
                        bookingType: booking.bookingType,
                        equipments: booking.details.map((d: any) => ({ equipmentId: d.equipmentId.toString(), quantity: d.quantity })),
                    });

                    // Set Date and Slots
                    const checkIn = new Date(booking.checkInTime);
                    const checkOut = new Date(booking.checkOutTime);
                    setSelectedDate(checkIn);

                    // Find slots
                    // Calculate start slot ID from time
                    // Start 7:00 => ID 1. (Hr - 7) + 1?
                    // Slot 1: 7:00. Slot 2: 8:00.
                    const startSlotId = checkIn.getHours() - 7 + 1;
                    const endSlotId = checkOut.getMinutes() > 0 ? checkOut.getHours() - 7 + 1 : checkOut.getHours() - 7; // If 8:50 end, it's slot 2. 9:00 end might be end of slot 2 if exactly on hour?
                    // Actually checkOut is +50 mins.
                    // Let's deduce slots:
                    const slots = [];
                    for (let s = startSlotId; s <= endSlotId; s++) {
                        slots.push(s);
                    }
                    setSelectedSlots(slots);
                }
            })
            .catch(console.error);
    }, [editBookingId, form]);

    // --- FETCH BOOKING LOGIC ---
    const [bookedSlots, setBookedSlots] = useState<{ date: Date; slotId: number }[]>([]);

    const facilityId = form.watch("facilityId");

    // Fetch bookings when facility changes
    React.useEffect(() => {
        if (!facilityId) {
            setBookedSlots([]);
            return;
        }

        const fetchBookings = async () => {
            try {
                const res = await fetch(`http://localhost:3500/api/bookings/facility/${facilityId}`);
                if (!res.ok) throw new Error("Failed to fetch bookings");
                const bookings: any[] = await res.json();

                // Transform API bookings to slots
                const occupied: { date: Date; slotId: number }[] = [];

                bookings.forEach(b => {
                    const checkIn = new Date(b.checkInTime);
                    const checkOut = new Date(b.checkOutTime);

                    // Logic to find which slots overlap with [checkIn, checkOut]
                    // Iterate over TIME_SLOTS and check overlap
                    // Simple check: same date

                    TIME_SLOTS.forEach(slot => {
                        const [sH, sM] = slot.start.split(':').map(Number);
                        const [eH, eM] = slot.end.split(':').map(Number);

                        // Create Date objects for this slot on the Booking Date
                        // Note: Booking might span multiple days (currently assume single day booking)
                        // Use checkIn date as base
                        const slotStart = setMinutes(setHours(new Date(checkIn), sH), sM);
                        const slotEnd = setMinutes(setHours(new Date(checkIn), eH), eM);

                        // Check overlap
                        // Slot [s, e], Booking [B_s, B_e]
                        // Overlap if s < B_e && e > B_s
                        // Be careful with exact boundaries if contiguous
                        if (slotStart < checkOut && slotEnd > checkIn) {
                            occupied.push({
                                date: new Date(checkIn), // Mark this day
                                slotId: slot.id
                            });
                        }
                    });
                });

                setBookedSlots(occupied);
            } catch (err) {
                console.error(err);
                setBookedSlots([]);
            }
        };

        fetchBookings();
    }, [facilityId]);


    // Handle Slot Click
    const handleSlotClick = (date: Date, slotId: number) => {
        // If different day, reset
        if (!selectedDate || !isSameDay(selectedDate, date)) {
            setSelectedDate(date);
            setSelectedSlots([slotId]);
            return;
        }

        // Same day logic
        const isSelected = selectedSlots.includes(slotId);
        let newSlots = [...selectedSlots];

        if (isSelected) {
            newSlots = newSlots.filter(id => id !== slotId);
        } else {
            // Check adjacency
            const min = Math.min(...selectedSlots);
            const max = Math.max(...selectedSlots);

            if (slotId === min - 1 || slotId === max + 1) {
                newSlots.push(slotId);
            } else {
                // Reset if not adjacent or empty
                newSlots = [slotId];
            }
        }

        // Sort slots
        newSlots.sort((a, b) => a - b);
        setSelectedSlots(newSlots);
    };

    // --- CALCULATIONS ---
    const watchAllFields = form.watch();

    const calcResults = useMemo(() => {
        let totalRental = 0;
        let totalDeposit = 0;

        // Facility Cost
        const facility = FACILITIES.find(f => f.id.toString() === watchAllFields.facilityId);
        const slotsCount = selectedSlots.length;

        let facilityRental = 0;
        let facilityDeposit = 0;

        if (facility && slotsCount > 0) {
            facilityRental = facility.pricePerHour * slotsCount;
            facilityDeposit = facility.deposit;

            totalRental += facilityRental;
            totalDeposit += facilityDeposit;
        }

        // Equipments Cost
        let equipmentRental = 0;
        let equipmentDeposit = 0;

        if (watchAllFields.equipments) {
            watchAllFields.equipments.forEach((item) => {
                const eq = EQUIPMENTS.find(e => e.id.toString() === item.equipmentId);
                if (eq && item.quantity) {
                    const r = eq.price * item.quantity;
                    const d = eq.deposit * item.quantity;

                    equipmentRental += r;
                    equipmentDeposit += d;

                    totalRental += r;
                    totalDeposit += d;
                }
            });
        }

        return {
            total: totalRental + totalDeposit,
            totalRental,
            totalDeposit,
            facilityRental,
            facilityDeposit,
            equipmentRental,
            equipmentDeposit
        };
    }, [watchAllFields, selectedSlots]);

    // --- SUBMIT ---
    const onSubmit = (data: BookingFormValues) => {
        if (!selectedDate || selectedSlots.length === 0) {
            alert("Vui lòng chọn thời gian trên lịch!");
            return;
        }

        // Calculate actual time range
        const sortedSlots = [...selectedSlots].sort((a, b) => a - b);
        const startSlotId = sortedSlots[0];
        const endSlotId = sortedSlots[sortedSlots.length - 1];

        const startSlot = TIME_SLOTS.find(s => s.id === startSlotId);
        const endSlot = TIME_SLOTS.find(s => s.id === endSlotId);

        if (!startSlot || !endSlot) return;

        const [startH, startM] = startSlot.start.split(':').map(Number);
        const [endH, endM] = endSlot.end.split(':').map(Number);

        const checkIn = setMinutes(setHours(selectedDate, startH), startM);
        const checkOut = setMinutes(setHours(selectedDate, endH), endM);

        // Handle Reschedule Reason
        let finalPurpose = data.purpose;
        if (editBookingId && data.rescheduleReason) {
            finalPurpose = `${data.purpose}\n\n[Reschedule Reason]: ${data.rescheduleReason}`;
        }

        const payload = {
            facility_id: parseInt(data.facilityId),
            purpose: finalPurpose,
            booking_date: format(checkIn, 'yyyy-MM-dd'),
            start_slot: startSlotId,
            end_slot: endSlotId,
            booking_type: data.bookingType,
            equipment_items: data.equipments?.map(e => ({
                equipment_id: parseInt(e.equipmentId),
                quantity: e.quantity
            })) || [],
            recurrence_type: isRecurring ? data.recurrence_type : undefined,
            recurrence_end_date: isRecurring ? data.recurrence_end_date : undefined,
        };

        if (editBookingId) {
            // RESCHEDULE
            fetch("http://localhost:3500/api/bookings/reschedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    oldBookingId: editBookingId,
                    newBookingData: payload
                }),
            })
                .then(async (res) => {
                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.message || "Failed to reschedule");
                    }
                    return res.json();
                })
                .then(() => {
                    alert("Đã dời lịch thành công!");
                    if (onSuccess) {
                        onSuccess();
                    } else {
                        window.location.href = "/my-bookings";
                    }
                })
                .catch((err) => {
                    console.error(err);
                    alert(`Lỗi: ${err.message}`);
                });
            return;
        }

        // Call API
        fetch("http://localhost:3500/api/bookings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        })
            .then(async (res) => {
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.message || "Failed to create booking");
                }
                return res.json();
            })
            .then(() => {
                alert("Đã tạo yêu cầu đặt phòng thành công!");
                if (onSuccess) {
                    onSuccess();
                } else {
                    window.location.reload();
                }
            })
            .catch((err) => {
                console.error(err);
                alert(`Lỗi: ${err.message}`);
            });
    };

    // --- GOOGLE CALENDAR SYNC ---
    const addToGoogleCalendar = () => {
        if (!selectedDate || selectedSlots.length === 0) return;
        const sortedSlots = [...selectedSlots].sort((a, b) => a - b);
        const startSlot = TIME_SLOTS.find(s => s.id === sortedSlots[0]);
        const endSlot = TIME_SLOTS.find(s => s.id === sortedSlots[sortedSlots.length - 1]);

        if (!startSlot || !endSlot) return;

        const [startH, startM] = startSlot.start.split(':').map(Number);
        const [endH, endM] = endSlot.end.split(':').map(Number);

        const startTime = setMinutes(setHours(selectedDate, startH), startM);
        const endTime = setMinutes(setHours(selectedDate, endH), endM);

        const title = `Booking Facility: ${FACILITIES.find(f => f.id.toString() === watchAllFields.facilityId)?.name || 'Facility'}`;
        const details = watchAllFields.purpose || 'No details';
        const location = 'University Campus';

        const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");

        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${fmt(startTime)}/${fmt(endTime)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;

        window.open(url, '_blank');
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">

            {/* LEFT: SCHEDULE GRID */}
            <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-primary" />
                        Lịch Biểu
                    </h2>
                    <div className="flex gap-2 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-gray-100 border rounded"></div> Đã đặt
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-white border rounded"></div> Trống
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-primary rounded"></div> Đang chọn
                        </div>
                    </div>
                </div>

                <ScheduleGrid
                    selectedDate={selectedDate}
                    selectedSlots={selectedSlots}
                    onSlotClick={handleSlotClick}
                    bookedSlots={bookedSlots}
                />

                {selectedDate && selectedSlots.length > 0 && (
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
                        <div>
                            <span className="font-semibold text-primary">Thời gian đã chọn: </span>
                            <span className="text-gray-700 font-medium">
                                {format(selectedDate, "dd/MM/yyyy")} —
                                {TIME_SLOTS.find(s => s.id === Math.min(...selectedSlots))?.start} đến {TIME_SLOTS.find(s => s.id === Math.max(...selectedSlots))?.end}
                            </span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 text-primary border-primary/20 hover:bg-primary/10"
                            onClick={addToGoogleCalendar}
                            type="button"
                        >
                            <CalendarDays className="w-4 h-4" /> Sync Google Calendar
                        </Button>
                    </div>
                )}
            </div>

            {/* RIGHT: FORM */}
            <div className="space-y-6">
                <Card className="border-none shadow-lg bg-white/80 backdrop-blur-sm sticky top-24">
                    <CardHeader>
                        <CardTitle>Thông Tin Chi Tiết</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                                {/* Facility */}
                                <FormField
                                    control={form.control}
                                    name="facilityId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Khu vực / Phòng</FormLabel>
                                            {editBookingId ? (
                                                <div className="p-3 bg-gray-100 rounded-md border text-gray-700 font-medium">
                                                    {FACILITIES.find(f => f.id.toString() === field.value)?.name || "Đang tải..."}
                                                    <span className="block text-xs text-gray-500 font-normal mt-1">Không thể thay đổi địa điểm khi dời lịch</span>
                                                </div>
                                            ) : (
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-12">
                                                            <SelectValue placeholder="Chọn địa điểm..." />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {FACILITIES.map((f) => (
                                                            <SelectItem key={f.id} value={f.id.toString()}>
                                                                <div className="flex flex-col text-left">
                                                                    <span className="font-semibold">{f.name}</span>
                                                                    <span className="text-xs text-gray-400">
                                                                        Sức chứa: {f.capacity} | {f.type}
                                                                    </span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Purpose */}
                                <FormField
                                    control={form.control}
                                    name="purpose"
                                    render={({ field }) => (
                                        // Note: 'purpose' validation logic in schema
                                        <FormItem>
                                            <div className="flex justify-between items-center">
                                                <FormLabel>Mục đích</FormLabel>
                                                <span className={cn("text-xs",
                                                    (field.value?.trim().split(/\s+/).length || 0) > 150 ? "text-red-500" : "text-gray-400"
                                                )}>
                                                    {field.value?.trim() ? field.value.trim().split(/\s+/).length : 0}/150 từ
                                                </span>
                                            </div>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Mô tả ngắn gọn mục đích sử dụng..."
                                                    className="resize-none min-h-[100px]"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {editBookingId && (
                                    <FormField
                                        control={form.control}
                                        name="rescheduleReason"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-blue-600">Lý do dời lịch (Bắt buộc)</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="Nhập lý do dời lịch..."
                                                        className="resize-none"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormDescription className="text-xs">
                                                    Phí chuyển đổi có thể được áp dụng tùy theo quy định.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}

                                {/* Recurrence */}
                                {!editBookingId && (
                                    <div className="p-4 bg-gray-50 rounded-lg space-y-4 border">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="recurrence"
                                                checked={isRecurring}
                                                onChange={(e) => setIsRecurring(e.target.checked)}
                                                className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                                            />
                                            <label htmlFor="recurrence" className="font-medium text-gray-700 cursor-pointer select-none">
                                                Đặt lịch lặp lại (Chu kỳ)
                                            </label>
                                        </div>

                                        {isRecurring && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="recurrence_type"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Lặp lại theo</FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value || 'WEEKLY'}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Chọn chu kỳ" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="DAILY">Hàng ngày</SelectItem>
                                                                    <SelectItem value="WEEKLY">Hàng tuần</SelectItem>
                                                                    <SelectItem value="MONTHLY">Hàng tháng</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="recurrence_end_date"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Đến ngày</FormLabel>
                                                            <FormControl>
                                                                <Input type="date" {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Equipments */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <FormLabel>Thiết bị thêm</FormLabel>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-primary hover:text-primary hover:bg-primary/10"
                                            onClick={() => append({ equipmentId: "", quantity: 1 })}
                                        >
                                            <Plus className="w-4 h-4 mr-1" /> Thêm
                                        </Button>
                                    </div>

                                    {fields.map((field, index) => (
                                        <div key={field.id} className="flex gap-2 items-start">
                                            <FormField
                                                control={form.control}
                                                name={`equipments.${index}.equipmentId`}
                                                render={({ field }) => (
                                                    <FormItem className="flex-1">
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Loại" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {EQUIPMENTS.map((e) => (
                                                                    <SelectItem key={e.id} value={e.id.toString()}>
                                                                        {e.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name={`equipments.${index}.quantity`}
                                                render={({ field }) => (
                                                    <FormItem className="w-20">
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                min={1}
                                                                {...field}
                                                                onChange={e => field.onChange(parseInt(e.target.value))}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-400 hover:text-red-600"
                                                onClick={() => remove(index)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>

                                {/* File Upload Mock */}
                                <div className="space-y-2">
                                    <FormLabel>Đính kèm tệp (Kế hoạch/Giấy phép)</FormLabel>
                                    <div className="border border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 hover:bg-gray-50 transition cursor-pointer">
                                        <Upload className="w-8 h-8 mb-2 opacity-50" />
                                        <span className="text-sm">Click để tải lên</span>
                                    </div>
                                </div>

                            </form>
                        </Form>
                    </CardContent>
                    <CardFooter className="flex-col gap-4 border-t bg-gray-50/50 p-6">
                        {/* PRICING */}
                        <div className="w-full space-y-2">
                            {/* Facility */}
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Phí thuê phòng ({selectedSlots.length} tiết):</span>
                                <span>{calcResults.facilityRental.toLocaleString()} đ</span>
                            </div>
                            {calcResults.facilityDeposit > 0 && (
                                <div className="flex justify-between text-sm text-orange-600/80">
                                    <span>Cọc phòng:</span>
                                    <span>{calcResults.facilityDeposit.toLocaleString()} đ</span>
                                </div>
                            )}

                            {/* Equipment */}
                            {(calcResults.equipmentRental > 0 || calcResults.equipmentDeposit > 0) && (
                                <div className="border-t border-dashed my-1"></div>
                            )}

                            {calcResults.equipmentRental > 0 && (
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Phí thuê thiết bị:</span>
                                    <span>{calcResults.equipmentRental.toLocaleString()} đ</span>
                                </div>
                            )}
                            {calcResults.equipmentDeposit > 0 && (
                                <div className="flex justify-between text-sm text-orange-600/80">
                                    <span>Cọc thiết bị:</span>
                                    <span>{calcResults.equipmentDeposit.toLocaleString()} đ</span>
                                </div>
                            )}

                            <div className="flex justify-between items-center pt-3 border-t mt-2">
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-800">Tổng tạm tính:</span>
                                    <span className="text-xs text-gray-400 font-normal">
                                        (Thuê: {calcResults.totalRental.toLocaleString()} + Cọc: {calcResults.totalDeposit.toLocaleString()})
                                    </span>
                                </div>
                                <span className="text-2xl font-bold text-primary">
                                    {calcResults.total.toLocaleString()} đ
                                </span>
                            </div>
                        </div>

                        <Button
                            onClick={form.handleSubmit(onSubmit)}
                            className="w-full size-lg text-md font-semibold shadow-primary/20 shadow-lg"
                        >
                            {editBookingId ? "Lưu thay đổi / Dời lịch" : "Xác nhận đặt"}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
