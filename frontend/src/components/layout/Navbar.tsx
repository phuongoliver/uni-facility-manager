"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Navbar() {
    const pathname = usePathname();
    const { user } = useAuth();

    const navItems = [
        { label: "Trang chủ", href: "/" },
        { label: "Mượn phòng", href: "/book-room" },
        { label: "Mượn Thiết Bị", href: "/equipments" },
        { label: "Lịch sử mượn", href: "/my-bookings" },
    ];

    return (
        <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-md px-6 h-16 flex items-center shadow-sm">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary mr-8">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                    BK
                </div>
                BKHub
            </Link>

            <nav className="hidden md:flex gap-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "px-4 py-2 text-sm font-medium rounded-full transition-all",
                                isActive
                                    ? "bg-blue-50 text-blue-600 font-semibold"
                                    : "text-gray-500 hover:text-blue-600 hover:bg-gray-50"
                            )}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="ml-auto flex items-center gap-4">
                {user ? (
                    <Link href="/my-bookings" className="flex items-center gap-2 hover:bg-gray-50 rounded-full px-2 py-1 transition-colors border border-transparent hover:border-gray-200">
                        <span className="text-sm font-medium text-gray-700 hidden sm:block">{user.fullName}</span>
                        <Avatar className="h-8 w-8 border border-gray-200">
                            <AvatarImage src={`https://ui-avatars.com/api/?name=${user.fullName}&background=random`} />
                            <AvatarFallback>{user.fullName.charAt(0)}</AvatarFallback>
                        </Avatar>
                    </Link>
                ) : (
                    <Link href="/login">
                        <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700 rounded-full px-6">
                            Đăng nhập
                        </Button>
                    </Link>
                )}
            </div>
        </header>
    );
}
