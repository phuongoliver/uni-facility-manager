"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
    format, addDays, startOfWeek, isSameDay, startOfMonth,
    endOfMonth, endOfWeek, eachDayOfInterval, addMonths,
    subMonths, addWeeks, subWeeks, setHours, setMinutes, isBefore, isAfter, startOfDay
} from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// --- CONSTANTS ---
export const TIME_SLOTS = [
    { id: 1, label: "Slot 1", start: "07:00", end: "07:50" },
    { id: 2, label: "Slot 2", start: "08:00", end: "08:50" },
    { id: 3, label: "Slot 3", start: "09:00", end: "09:50" },
    { id: 4, label: "Slot 4", start: "10:00", end: "10:50" },
    { id: 5, label: "Slot 5", start: "11:00", end: "11:50" },
    { id: 6, label: "Slot 6", start: "13:00", end: "13:50" }, // Break 12:00-13:00
    { id: 7, label: "Slot 7", start: "14:00", end: "14:50" },
    { id: 8, label: "Slot 8", start: "15:00", end: "15:50" },
    { id: 9, label: "Slot 9", start: "16:00", end: "16:50" },
    { id: 10, label: "Slot 10", start: "17:00", end: "17:50" },
    { id: 11, label: "Slot 11", start: "18:00", end: "18:50" },
    { id: 12, label: "Slot 12", start: "19:00", end: "19:50" },
];

interface ScheduleGridProps {
    selectedDate: Date | null;
    selectedSlots: number[];
    onSlotClick: (date: Date, slotId: number) => void;
    bookedSlots?: { date: Date; slotId: number; status?: string }[];
}

type ViewMode = 'day' | 'week' | 'month';

export function ScheduleGrid({
    selectedDate,
    selectedSlots,
    onSlotClick,
    bookedSlots = [],
}: ScheduleGridProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('week');
    const [baseDate, setBaseDate] = useState(new Date());

    // Sync baseDate if selectedDate changes externally
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (selectedDate) setBaseDate(selectedDate);
    }, [selectedDate]);

    // Navigation handlers
    const handlePrev = () => {
        if (viewMode === 'day') setBaseDate(d => addDays(d, -1));
        else if (viewMode === 'week') setBaseDate(d => subWeeks(d, 1));
        else setBaseDate(d => subMonths(d, 1));
    };

    const handleNext = () => {
        if (viewMode === 'day') setBaseDate(d => addDays(d, 1));
        else if (viewMode === 'week') setBaseDate(d => addWeeks(d, 1));
        else setBaseDate(d => addMonths(d, 1));
    };

    const handleToday = () => {
        setBaseDate(new Date());
    };

    // Calculate days to show
    const daysToRender = useMemo(() => {
        if (viewMode === 'day') return [baseDate];
        if (viewMode === 'week') {
            const start = startOfWeek(baseDate, { weekStartsOn: 1 });
            return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
        }
        if (viewMode === 'month') {
            const start = startOfWeek(startOfMonth(baseDate), { weekStartsOn: 1 });
            const end = endOfWeek(endOfMonth(baseDate), { weekStartsOn: 1 });
            return eachDayOfInterval({ start, end });
        }
        return [];
    }, [viewMode, baseDate]);

    // Past validation logic
    const isSlotPast = (date: Date, slotEndTime?: string) => {
        const now = new Date();
        const startOfDate = startOfDay(date);
        const startOfToday = startOfDay(now);

        if (isBefore(startOfDate, startOfToday)) return true;

        if (isSameDay(date, now) && slotEndTime) {
            const [h, m] = slotEndTime.split(':').map(Number);
            const slotTime = setMinutes(setHours(date, h), m);
            return isBefore(slotTime, now);
        }
        return false;
    };

    // Data Helpers
    const getBooking = (date: Date, slotId: number) => {
        return bookedSlots.find(
            (b) => isSameDay(new Date(b.date), date) && b.slotId === slotId
        );
    };

    const isSelected = (date: Date, slotId: number) => {
        if (!selectedDate) return false;
        return isSameDay(selectedDate, date) && selectedSlots.includes(slotId);
    };

    // --- RENDERERS ---

    const renderMonthCell = (date: Date) => {
        const isToday = isSameDay(date, new Date());
        const isCurrentMonth = date.getMonth() === baseDate.getMonth();
        const dayBookings = bookedSlots.filter(b => isSameDay(new Date(b.date), date));
        const hasBookings = dayBookings.length > 0;
        const busyCount = dayBookings.length;
        const isDatePast = isBefore(startOfDay(date), startOfDay(new Date()));

        return (
            <div
                key={date.toISOString()}
                onClick={() => {
                    setBaseDate(date);
                    setViewMode('day'); // Drill down
                }}
                className={cn(
                    "min-h-[100px] border-r border-b p-2 cursor-pointer transition-colors hover:bg-gray-50",
                    !isCurrentMonth && "bg-gray-50/50 text-gray-400",
                    isToday && "bg-blue-50/30",
                    isDatePast && "bg-gray-100/50"
                )}
            >
                <div className="flex justify-between items-start">
                    <span className={cn(
                        "text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full",
                        isToday ? "bg-primary text-white" : "text-gray-700"
                    )}>
                        {format(date, 'd')}
                    </span>
                    {hasBookings && (
                        <span className="text-[10px] font-bold text-gray-500 bg-gray-200 px-1.5 rounded-full">
                            {busyCount}
                        </span>
                    )}
                </div>
                <div className="mt-2 space-y-1">
                    {hasBookings ? (
                        <div className="text-xs text-blue-600 bg-blue-50 rounded px-1 py-0.5 truncate border border-blue-100">
                            {busyCount} busy
                        </div>
                    ) : (
                        !isDatePast && <div className="text-xs text-green-600 px-1">Available</div>
                    )}
                    {isDatePast && <div className="text-xs text-gray-400 px-1">Past</div>}
                </div>
            </div>
        );
    };

    return (
        <div className="border rounded-xl shadow-sm bg-white flex flex-col h-full overflow-hidden">
            {/* TOOLBAR */}
            <div className="p-4 border-b flex items-center justify-between flex-wrap gap-4 bg-white sticky top-0 z-20">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleToday} className="mr-2">Today</Button>
                    <div className="flex items-center border rounded-md shadow-sm">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border-r hover:bg-gray-100" onClick={handlePrev}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-gray-100" onClick={handleNext}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="text-lg font-bold text-gray-800 ml-4 min-w-[150px]">
                        {format(baseDate, 'MMMM yyyy')}
                    </div>
                </div>

                <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                    <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="View" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="day">Day</SelectItem>
                        <SelectItem value="week">Week</SelectItem>
                        <SelectItem value="month">Month</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* GRID CONTENT */}
            <div className="overflow-x-auto flex-1 relative">
                <div className={cn("min-w-[800px]", viewMode === 'day' && "min-w-[400px]", viewMode === 'month' && "min-w-full")}>

                    {/* MONTH VIEW */}
                    {viewMode === 'month' && (
                        <div className="w-full">
                            <div className="grid grid-cols-7 border-b bg-gray-50">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                                    <div key={d} className="p-3 text-center text-sm font-semibold text-gray-500 border-r last:border-r-0 uppercase tracking-wider">
                                        {d}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7">
                                {daysToRender.map(date => renderMonthCell(date))}
                            </div>
                        </div>
                    )}

                    {/* DAY & WEEK VIEW */}
                    {(viewMode === 'day' || viewMode === 'week') && (
                        <>
                            <div className={cn(
                                "grid bg-gray-50 border-b sticky top-0 z-10",
                                viewMode === 'week' ? "grid-cols-[100px_repeat(7,1fr)]" : "grid-cols-[100px_1fr]"
                            )}>
                                <div className="p-4 text-sm font-semibold text-gray-500 text-center border-r flex items-center justify-center bg-gray-50">
                                    <Clock className="w-4 h-4 mr-2" /> Slot
                                </div>
                                {daysToRender.map((date) => (
                                    <div
                                        key={date.toString()}
                                        className={cn(
                                            "p-3 text-center border-r last:border-r-0 flex flex-col items-center justify-center transition-colors",
                                            isSameDay(date, new Date()) ? "bg-primary/5" : ""
                                        )}
                                    >
                                        <span className="text-xs font-medium text-gray-500 uppercase">
                                            {format(date, "EEE")}
                                        </span>
                                        <span
                                            className={cn(
                                                "text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full mt-1",
                                                isSameDay(date, new Date())
                                                    ? "bg-primary text-white shadow-md"
                                                    : "text-gray-900"
                                            )}
                                        >
                                            {format(date, "d")}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="divide-y relative">
                                {TIME_SLOTS.map((slot) => (
                                    <div
                                        key={slot.id}
                                        className={cn(
                                            "grid hover:bg-gray-50/50 transition-colors",
                                            viewMode === 'week' ? "grid-cols-[100px_repeat(7,1fr)]" : "grid-cols-[100px_1fr]"
                                        )}
                                    >
                                        <div className="p-3 text-sm font-medium text-gray-600 border-r flex flex-col justify-center items-center bg-gray-50/30">
                                            <span>{slot.label}</span>
                                            <span className="text-xs text-gray-400 font-normal mt-1">
                                                {slot.start} - {slot.end}
                                            </span>
                                        </div>

                                        {daysToRender.map((date) => {
                                            const booking = getBooking(date, slot.id);
                                            const isBooked = !!booking;
                                            const selected = isSelected(date, slot.id);
                                            const isAdminHold = booking?.status === 'ADMIN_HOLD';
                                            const isPast = isSlotPast(date, slot.end);

                                            const isDisabled = isBooked || isPast;

                                            return (
                                                <button
                                                    key={`${date.toISOString()}-${slot.id}`}
                                                    disabled={isDisabled}
                                                    onClick={() => onSlotClick(date, slot.id)}
                                                    className={cn(
                                                        "relative h-20 border-r last:border-r-0 transition-all duration-200 group focus:outline-none",
                                                        isPast ? "bg-gray-100 cursor-not-allowed" : "",
                                                        isBooked
                                                            ? isAdminHold ? "bg-gray-800 text-white cursor-not-allowed"
                                                                : "bg-red-50 cursor-not-allowed"
                                                            : "",
                                                        !isDisabled && "cursor-pointer hover:bg-blue-50/50 hover:shadow-inner",
                                                        selected ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md ring-2 ring-primary ring-inset" : ""
                                                    )}
                                                >
                                                    {isPast && !isBooked && (
                                                        <div className="w-full h-full flex items-center justify-center opacity-30">
                                                            <div className="w-full h-[1px] bg-gray-400 rotate-45 transform"></div>
                                                        </div>
                                                    )}

                                                    {isBooked && (
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-1">
                                                            <span className={cn(
                                                                "text-[10px] font-bold px-2 py-0.5 rounded shadow-sm w-full truncate text-center",
                                                                isAdminHold ? "text-white bg-gray-700" : "text-red-700 bg-red-100 border border-red-200"
                                                            )}>
                                                                {isAdminHold ? "MAINTENANCE" : "BOOKED"}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {selected && (
                                                        <div className="flex flex-col items-center justify-center h-full animate-in zoom-in-95 duration-200">
                                                            <span className="text-sm font-bold">Selected</span>
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
