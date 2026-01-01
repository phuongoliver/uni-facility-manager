"use client";

import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { UserProfileSidebar } from "@/components/profile/UserProfileSidebar";

export default function MyBookingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-50/50 font-sans">
            <Navbar />
            <main className="container mx-auto py-8 px-4 md:px-6 max-w-7xl">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Left Column: Personal Profile */}
                    <div className="lg:col-span-1">
                        <UserProfileSidebar />
                    </div>

                    {/* Right Column: Page Content (Booking History) */}
                    <div className="lg:col-span-3">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
