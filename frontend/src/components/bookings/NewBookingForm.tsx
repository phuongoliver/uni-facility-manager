"use client";
import { API_URL } from "@/lib/constants";

import React, { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
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
    CalendarDays,
    Check,
    ChevronsUpDown
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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
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

// Vietnamese number formatter (uses dots as thousand separators)
const formatVND = (num: number): string => {
    return Math.round(num).toLocaleString('vi-VN');
};

// --- STATE & TYPES ---
interface FacilityItem {
    id: number;
    name: string;
    capacity: number;
    price: number;
    priceType: 'PER_HOUR' | 'PER_BOOKING' | 'ONE_TIME';
    transactionType: 'DEPOSIT' | 'RENTAL_FEE' | 'FINE';
    deposit: number;
    type: string;
}

interface EquipmentItem {
    id: number;
    name: string;
    price: number;
    deposit: number;
}


// --- ZOD SCHEMA ---
const bookingSchema = z.object({
    facilityId: z.string().min(1, "Please select a facility"),
    bookingType: z.nativeEnum(BookingType),
    purpose: z.string()
        .min(10, "Purpose description is too short")
        .refine((val) => val.trim().split(/\s+/).length <= 150, "Must not exceed 150 words"),
    equipments: z.array(
        z.object({
            equipmentId: z.string().min(1, "Select equipment"),
            quantity: z.number().min(1, "Minimum quantity is 1"),
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
    const [openFacility, setOpenFacility] = useState(false);
    const [facilitySearch, setFacilitySearch] = useState("");

    // Check if recurrence
    const [isRecurring, setIsRecurring] = useState(false);

    const { user } = useAuth();
    const [facilities, setFacilities] = useState<FacilityItem[]>([]);
    const [equipmentsList, setEquipmentsList] = useState<EquipmentItem[]>([]);
    const [editFacilityName, setEditFacilityName] = useState<string>('');

    // Fetch Init Data
    React.useEffect(() => {
        const fetchInitData = async () => {
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3500';

                const [facRes, eqRes] = await Promise.all([
                    fetch(`${API_URL}/api/facilities`),
                    fetch(`${API_URL}/api/equipments`)
                ]);

                if (facRes.ok) {
                    const data = await facRes.json();
                    setFacilities(data.map((f: any) => ({
                        id: f.facilityId,
                        name: f.name,
                        capacity: f.capacity,
                        price: parseFloat(f.price) || 0,  // Convert from string/decimal
                        priceType: f.priceType || 'PER_HOUR',
                        transactionType: f.transactionType || 'RENTAL_FEE',
                        deposit: 0, // Default deposit
                        type: f.type
                    })));
                }

                if (eqRes.ok) {
                    const data = await eqRes.json();
                    setEquipmentsList(data.map((e: any) => ({
                        id: e.equipmentId,
                        name: e.name,
                        price: parseFloat(e.rentalPrice) || 0,  // Convert from string/decimal
                        deposit: 0
                    })));
                }
            } catch (error) {
                console.error("Failed to fetch init data", error);
            }
        };

        fetchInitData();
    }, []);

    const form = useForm<BookingFormValues>({
        resolver: zodResolver(bookingSchema),
        defaultValues: {
            facilityId: "",
            bookingType: BookingType.ACADEMIC,
            equipments: [],
            purpose: "",
            recurrence_end_date: "",
            rescheduleReason: "",
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "equipments",
    });

    // Automatically set default recurrence type when recurring is enabled
    React.useEffect(() => {
        if (isRecurring) {
            const current = form.getValues("recurrence_type");
            if (!current) {
                form.setValue("recurrence_type", "WEEKLY");
            }
        }
    }, [isRecurring, form]);

    // --- FETCH EDIT DATA ---
    React.useEffect(() => {
        if (!editBookingId) return;
        // Wait for facilities to load first
        if (facilities.length === 0) return;

        // Fetch user bookings (since they are in history) or finding specific booking
        fetch(`${API_URL}/api/bookings`, {
            headers: {
                'x-user-id': user?.userId?.toString() || '1'
            }
        })
            .then(res => res.json())
            .then((bookings: any[]) => {
                const booking = bookings.find(b => b.bookingId === editBookingId);
                if (booking) {
                    // Store facility name for display
                    const facilityName = booking.facility?.name || facilities.find(f => f.id === booking.facilityId)?.name || '';
                    setEditFacilityName(facilityName);

                    form.reset({
                        facilityId: booking.facilityId.toString(),
                        purpose: booking.purpose,
                        bookingType: booking.bookingType,
                        equipments: booking.details?.map((d: any) => ({ equipmentId: d.equipmentId.toString(), quantity: d.quantity })) || [],
                    });

                    // Set Date and Slots
                    const checkIn = new Date(booking.checkInTime);
                    const checkOut = new Date(booking.checkOutTime);
                    setSelectedDate(checkIn);

                    // Find slots
                    const startSlotId = checkIn.getHours() - 7 + 1;
                    const endSlotId = checkOut.getMinutes() > 0 ? checkOut.getHours() - 7 + 1 : checkOut.getHours() - 7;
                    const slots = [];
                    for (let s = startSlotId; s <= endSlotId; s++) {
                        slots.push(s);
                    }
                    setSelectedSlots(slots);
                }
            })
            .catch(console.error);
    }, [editBookingId, form, facilities, user]);

    // --- FETCH BOOKING LOGIC ---
    const [bookedSlots, setBookedSlots] = useState<{ date: Date; slotId: number; status?: string }[]>([]);

    const facilityId = form.watch("facilityId");

    // Fetch bookings when facility changes
    React.useEffect(() => {
        if (!facilityId) {
            setBookedSlots([]);
            return;
        }

        const fetchBookings = async () => {
            try {
                const res = await fetch(`${API_URL}/api/bookings/facility/${facilityId}`);
                if (!res.ok) throw new Error("Failed to fetch bookings");
                const bookings: any[] = await res.json();

                // Transform API bookings to slots
                const occupied: { date: Date; slotId: number; status?: string }[] = [];

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
                                slotId: slot.id,
                                status: b.status
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
        let oneTimeTotalRental = 0;
        let oneTimeTotalDeposit = 0;

        // Facility Cost (One Time)
        const facility = facilities.find(f => f.id.toString() === watchAllFields.facilityId);
        const slotsCount = selectedSlots.length;

        let facilityRental = 0;
        let facilityDeposit = 0;

        if (facility) {
            switch (facility.priceType) {
                case 'PER_HOUR':
                    facilityRental = slotsCount > 0 ? facility.price * slotsCount : 0;
                    break;
                case 'PER_BOOKING':
                    facilityRental = facility.price;
                    break;
                case 'ONE_TIME':
                    facilityRental = facility.price;
                    break;
                default:
                    facilityRental = slotsCount > 0 ? facility.price * slotsCount : 0;
            }
            facilityDeposit = facility.deposit;

            oneTimeTotalRental += facilityRental;
            oneTimeTotalDeposit += facilityDeposit;
        }

        // Equipments Cost (One Time)
        let equipmentRental = 0;
        let equipmentDeposit = 0;

        if (watchAllFields.equipments) {
            watchAllFields.equipments.forEach((item) => {
                const eq = equipmentsList.find(e => e.id.toString() === item.equipmentId);
                if (eq && item.quantity) {
                    const r = eq.price * item.quantity;
                    const d = eq.deposit * item.quantity;

                    equipmentRental += r;
                    equipmentDeposit += d;

                    oneTimeTotalRental += r;
                    oneTimeTotalDeposit += d;
                }
            });
        }

        // Recurrence Multiplier
        let occurrenceCount = 1;
        if (isRecurring && selectedDate && watchAllFields.recurrence_end_date && watchAllFields.recurrence_type) {
            const endDate = new Date(watchAllFields.recurrence_end_date);
            // reset hours to compare dates only
            const start = new Date(selectedDate);
            start.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);

            if (endDate >= start) {
                let count = 0;
                const current = new Date(start);
                // Safety break
                let safe = 0;
                while (current <= endDate && safe < 366) { // Limit to 1 year approx to prevent freeze
                    count++;
                    safe++;
                    // Increment
                    if (watchAllFields.recurrence_type === 'DAILY') current.setDate(current.getDate() + 1);
                    else if (watchAllFields.recurrence_type === 'WEEKLY') current.setDate(current.getDate() + 7);
                    else if (watchAllFields.recurrence_type === 'MONTHLY') current.setMonth(current.getMonth() + 1);
                    else break;
                }
                occurrenceCount = count > 0 ? count : 1;
            }
        }

        return {
            total: (oneTimeTotalRental * occurrenceCount) + (oneTimeTotalDeposit * occurrenceCount),
            totalRental: oneTimeTotalRental * occurrenceCount,
            totalDeposit: oneTimeTotalDeposit * occurrenceCount,

            // Per single booking costs for display if needed
            oneTimeRental: oneTimeTotalRental,
            oneTimeDeposit: oneTimeTotalDeposit,

            facilityRental,
            facilityDeposit,
            equipmentRental,
            equipmentDeposit,
            occurrenceCount
        };
    }, [watchAllFields, selectedSlots, facilities, equipmentsList, isRecurring, selectedDate]);

    // --- SUBMIT ---
    const onSubmit = (data: BookingFormValues) => {
        if (!selectedDate || selectedSlots.length === 0) {
            alert("Please select a time slot on the calendar!");
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
            fetch(`${API_URL}/api/bookings/reschedule`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-user-id": user?.userId.toString() || '1'
                },
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
                    alert("Rescheduled successfully!");
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
        fetch(`${API_URL}/api/bookings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-user-id": user?.userId.toString() || '1'
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
                alert("Booking request created successfully!");
                if (onSuccess) {
                    onSuccess();
                } else {
                    window.location.reload();
                }
            })
            .catch((err) => {
                console.error(err);
                alert(`Error: ${err.message}`);
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

        const title = `Booking Facility: ${facilities.find(f => f.id.toString() === watchAllFields.facilityId)?.name || 'Facility'}`;
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
                        Schedule
                    </h2>
                    <div className="flex gap-2 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-gray-100 border rounded"></div> Booked
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-white border rounded"></div> Available
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-primary rounded"></div> Selecting
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
                            <span className="font-semibold text-primary">Selected Time: </span>
                            <span className="text-gray-700 font-medium">
                                {format(selectedDate, "dd/MM/yyyy")} —
                                {TIME_SLOTS.find(s => s.id === Math.min(...selectedSlots))?.start} to {TIME_SLOTS.find(s => s.id === Math.max(...selectedSlots))?.end}
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
                        <CardTitle>Booking Details</CardTitle>
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
                                            <FormLabel>Area / Room</FormLabel>
                                            {editBookingId ? (
                                                <div className="p-3 bg-gray-100 rounded-md border text-gray-700 font-medium">
                                                    {editFacilityName || facilities.find(f => f.id.toString() === field.value)?.name || "Loading..."}
                                                    <span className="block text-xs text-gray-500 font-normal mt-1">Cannot change facility when rescheduling</span>
                                                </div>
                                            ) : (
                                                <Popover open={openFacility} onOpenChange={setOpenFacility}>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button
                                                                variant="outline"
                                                                role="combobox"
                                                                className={
                                                                    cn(
                                                                        "w-full justify-between h-12 font-normal",
                                                                        !field.value && "text-muted-foreground"
                                                                    )}
                                                            >
                                                                {field.value
                                                                    ? facilities.find(
                                                                        (f) => f.id.toString() === field.value
                                                                    )?.name
                                                                    : "Select facility..."}
                                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                                        <div className="p-2 border-b">
                                                            <Input
                                                                placeholder="Search..."
                                                                value={facilitySearch}
                                                                onChange={e => setFacilitySearch(e.target.value)}
                                                                className="h-8 border-none focus-visible:ring-0 shadow-none bg-transparent"
                                                            />
                                                        </div>
                                                        <div className="max-h-60 overflow-y-auto p-1">
                                                            {facilities.filter(f => f.name.toLowerCase().includes(facilitySearch.toLowerCase())).length === 0 && (
                                                                <div className="p-4 text-center text-sm text-gray-500">
                                                                    No facility found.
                                                                </div>
                                                            )}
                                                            {facilities
                                                                .filter(f => f.name.toLowerCase().includes(facilitySearch.toLowerCase()))
                                                                .map((f) => (
                                                                    <div
                                                                        key={f.id}
                                                                        className={cn("relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-gray-100 transition-colors",
                                                                            field.value === f.id.toString() && "bg-blue-50 text-blue-700"
                                                                        )}
                                                                        onClick={() => {
                                                                            form.setValue("facilityId", f.id.toString());
                                                                            setOpenFacility(false);
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                field.value === f.id.toString()
                                                                                    ? "opacity-100"
                                                                                    : "opacity-0"
                                                                            )}
                                                                        />
                                                                        <div className="flex flex-col">
                                                                            <span className="font-semibold">{f.name}</span>
                                                                            <span className="text-xs text-gray-500">
                                                                                Capacity: {f.capacity} | {f.type} | {f.price === 0 ? 'Free' : `${formatVND(f.price)}đ/${f.priceType === 'PER_HOUR' ? 'hr' : f.priceType === 'PER_BOOKING' ? 'booking' : 'one-time'}`}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Booking Type */}
                                <FormField
                                    control={form.control}
                                    name="bookingType"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Booking Type</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select booking type..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value={BookingType.ACADEMIC}>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">Academic</span>
                                                            <span className="text-xs text-gray-500">Classes, lectures, tutorials</span>
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value={BookingType.EVENT}>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">Event</span>
                                                            <span className="text-xs text-gray-500">Meetings, seminars, workshops</span>
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value={BookingType.PERSONAL}>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">Personal</span>
                                                            <span className="text-xs text-gray-500">Individual or group study</span>
                                                        </div>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
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
                                                <FormLabel>Purpose</FormLabel>
                                                <span className={cn("text-xs",
                                                    (field.value?.trim().split(/\s+/).length || 0) > 150 ? "text-red-500" : "text-gray-400"
                                                )}>
                                                    {field.value?.trim() ? field.value.trim().split(/\s+/).length : 0}/150 words
                                                </span>
                                            </div>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Briefly describe the purpose..."
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
                                                <FormLabel className="text-blue-600">Reschedule Reason (Required)</FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="Enter reschedule reason..."
                                                        className="resize-none"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormDescription className="text-xs">
                                                    Reschedule fees may apply.
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
                                                Recurring Booking
                                            </label>
                                        </div>

                                        {isRecurring && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="recurrence_type"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Repeat by</FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value || 'WEEKLY'}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select frequency" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="DAILY">Daily</SelectItem>
                                                                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                                                                    <SelectItem value="MONTHLY">Monthly</SelectItem>
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
                                                            <FormLabel>End Date</FormLabel>
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
                                        <FormLabel>Additional Equipment</FormLabel>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-primary hover:text-primary hover:bg-primary/10"
                                            onClick={() => append({ equipmentId: "", quantity: 1 })}
                                        >
                                            <Plus className="w-4 h-4 mr-1" /> Add
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
                                                                    <SelectValue placeholder="Type" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {equipmentsList.map((e) => (
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
                                    <FormLabel>Attach File (Plan/Permit)</FormLabel>
                                    <div className="border border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 hover:bg-gray-50 transition cursor-pointer">
                                        <Upload className="w-8 h-8 mb-2 opacity-50" />
                                        <span className="text-sm">Click to upload</span>
                                    </div>
                                </div>

                            </form>
                        </Form>
                    </CardContent >
                    <CardFooter className="flex-col gap-4 border-t bg-gray-50/50 p-6">
                        {/* PRICING */}
                        <div className="w-full space-y-2">
                            {/* Facility */}
                            {(() => {
                                const facility = facilities.find(f => f.id.toString() === watchAllFields.facilityId);
                                const priceLabel = facility?.priceType === 'PER_HOUR'
                                    ? `${selectedSlots.length} slots`
                                    : facility?.priceType === 'PER_BOOKING'
                                        ? 'per booking'
                                        : 'one-time fee';
                                return (
                                    <div className="flex justify-between text-sm text-gray-600">
                                        <span>
                                            Facility Rental ({priceLabel}):
                                            {facility?.price === 0 && <span className="ml-1 text-green-600 font-medium">FREE</span>}
                                        </span>
                                        <span>{formatVND(calcResults.facilityRental)} đ</span>
                                    </div>
                                );
                            })()}
                            {calcResults.facilityDeposit > 0 && (
                                <div className="flex justify-between text-sm text-orange-600/80">
                                    <span>Facility Deposit:</span>
                                    <span>{formatVND(calcResults.facilityDeposit)} đ</span>
                                </div>
                            )}

                            {/* Equipment */}
                            {(calcResults.equipmentRental > 0 || calcResults.equipmentDeposit > 0) && (
                                <div className="border-t border-dashed my-1"></div>
                            )}

                            {calcResults.equipmentRental > 0 && (
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Equipment Rental:</span>
                                    <span>{formatVND(calcResults.equipmentRental)} đ</span>
                                </div>
                            )}
                            {calcResults.equipmentDeposit > 0 && (
                                <div className="flex justify-between text-sm text-orange-600/80">
                                    <span>Equipment Deposit:</span>
                                    <span>{formatVND(calcResults.equipmentDeposit)} đ</span>
                                </div>
                            )}

                            <div className="flex justify-between items-center pt-3 border-t mt-2">
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-800">Estimated Total:</span>
                                    <span className="text-xs text-gray-400 font-normal">
                                        (Rental: {formatVND(calcResults.totalRental)} + Deposit: {formatVND(calcResults.totalDeposit)})
                                    </span>
                                    {calcResults.occurrenceCount > 1 && (
                                        <span className="text-xs text-blue-600 font-medium">
                                            Includes {calcResults.occurrenceCount} recurring bookings
                                        </span>
                                    )}
                                </div>
                                <span className="text-2xl font-bold text-primary">
                                    {formatVND(calcResults.total)} đ
                                </span>
                            </div>
                        </div>

                        <Button
                            onClick={form.handleSubmit(onSubmit)}
                            className="w-full size-lg text-md font-semibold shadow-primary/20 shadow-lg"
                        >
                            {editBookingId ? "Save Changes / Reschedule" : "Confirm Booking"}
                        </Button>
                    </CardFooter>
                </Card >
            </div >
        </div >
    );
}
