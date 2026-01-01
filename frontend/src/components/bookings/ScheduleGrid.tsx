"use client";

import React, { useMemo } from "react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { vi } from "date-fns/locale";
import { cn } from "@/lib/utils";

// --- CONSTANTS ---
export const TIME_SLOTS = [
    { id: 1, label: "Tiết 1", start: "07:00", end: "07:50" },
    { id: 2, label: "Tiết 2", start: "08:00", end: "08:50" },
    { id: 3, label: "Tiết 3", start: "09:00", end: "09:50" },
    { id: 4, label: "Tiết 4", start: "10:00", end: "10:50" },
    { id: 5, label: "Tiết 5", start: "11:00", end: "11:50" },
    { id: 6, label: "Tiết 6", start: "13:00", end: "13:50" }, // Break 12:00-13:00
    { id: 7, label: "Tiết 7", start: "14:00", end: "14:50" },
    { id: 8, label: "Tiết 8", start: "15:00", end: "15:50" },
    { id: 9, label: "Tiết 9", start: "16:00", end: "16:50" },
    { id: 10, label: "Tiết 10", start: "17:00", end: "17:50" },
    { id: 11, label: "Tiết 11", start: "18:00", end: "18:50" },
    { id: 12, label: "Tiết 12", start: "19:00", end: "19:50" },
];

interface ScheduleGridProps {
    selectedDate: Date | null;
    selectedSlots: number[];
    onSlotClick: (date: Date, slotId: number) => void;
    bookedSlots?: { date: Date; slotId: number }[]; // Mock data for disabled slots
}

export function ScheduleGrid({
    selectedDate,
    selectedSlots,
    onSlotClick,
    bookedSlots = [],
}: ScheduleGridProps) {
    // Generate current week days (Mon-Sun)
    // Assuming we start from today or fixed start of week
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday start
    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
    }, [weekStart]);

    const isBooked = (date: Date, slotId: number) => {
        return bookedSlots.some(
            (b) => isSameDay(new Date(b.date), date) && b.slotId === slotId
        );
    };

    const isSelected = (date: Date, slotId: number) => {
        if (!selectedDate) return false;
        return isSameDay(selectedDate, date) && selectedSlots.includes(slotId);
    };

    return (
        <div className="overflow-x-auto border rounded-xl shadow-sm bg-white">
            <div className="min-w-[800px]">
                {/* Header: Days */}
                <div className="grid grid-cols-[100px_repeat(7,1fr)] bg-gray-50 border-b">
                    <div className="p-4 text-sm font-semibold text-gray-500 text-center border-r">
                        Tiết / Thứ
                    </div>
                    {weekDays.map((date) => (
                        <div
                            key={date.toString()}
                            className={cn(
                                "p-3 text-center border-r last:border-r-0 flex flex-col items-center justify-center transition-colors",
                                isSameDay(date, today) ? "bg-primary/5" : ""
                            )}
                        >
                            <span className="text-xs font-medium text-gray-500 uppercase">
                                {format(date, "EEE", { locale: vi })}
                            </span>
                            <span
                                className={cn(
                                    "text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full mt-1",
                                    isSameDay(date, today)
                                        ? "bg-primary text-white shadow-md"
                                        : "text-gray-900"
                                )}
                            >
                                {format(date, "d")}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Body: Slots */}
                <div className="divide-y">
                    {TIME_SLOTS.map((slot) => (
                        <div
                            key={slot.id}
                            className="grid grid-cols-[100px_repeat(7,1fr)] hover:bg-gray-50/50 transition-colors"
                        >
                            {/* Slot Label */}
                            <div className="p-3 text-sm font-medium text-gray-600 border-r flex flex-col justify-center items-center bg-gray-50/30">
                                <span>{slot.label}</span>
                                <span className="text-xs text-gray-400 font-normal">
                                    {slot.start}
                                </span>
                                <span className="text-xs text-gray-400 font-normal opacity-0">
                                    -
                                </span>
                                <span className="text-xs text-gray-400 font-normal">
                                    {slot.end}
                                </span>
                            </div>

                            {/* Day Cells */}
                            {weekDays.map((date) => {
                                const booked = isBooked(date, slot.id);
                                const selected = isSelected(date, slot.id);

                                return (
                                    <button
                                        key={`${date.toISOString()}-${slot.id}`}
                                        disabled={booked}
                                        onClick={() => onSlotClick(date, slot.id)}
                                        className={cn(
                                            "relative h-16 border-r last:border-r-0 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/50",
                                            booked
                                                ? "bg-gray-100 cursor-not-allowed" // Removed pattern classes
                                                : "cursor-pointer hover:bg-primary/10",
                                            selected ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""
                                        )}
                                    >
                                        {booked && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-xs font-bold text-gray-400 -rotate-12 bg-white/80 px-1 rounded">
                                                    ĐÃ ĐẶT
                                                </span>
                                            </div>
                                        )}

                                        {selected && (
                                            <div className="flex flex-col items-center justify-center h-full animate-in zoom-in-95 duration-200">
                                                <span className="text-sm font-bold">Chọn</span>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
