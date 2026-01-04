"use client";

import React, { useState, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Navbar } from "@/components/layout/Navbar";
import { API_URL } from "@/lib/constants";

// Type matching backend Equipment entity
interface Equipment {
    equipmentId: number;
    facilityId: number | null;
    name: string;
    totalQuantity: number;
    availableQuantity: number;
    status: 'GOOD' | 'BROKEN' | 'MAINTENANCE';
    rentalPrice: number;
}

// Category mapping based on equipment names (since DB doesn't have category field)
const getCategoryFromName = (name: string): string => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('projector') || lowerName.includes('máy chiếu')) return 'Office';
    if (lowerName.includes('micro') || lowerName.includes('speaker') || lowerName.includes('loa')) return 'Audio';
    if (lowerName.includes('router') || lowerName.includes('kit') || lowerName.includes('cisco')) return 'Teaching Aid';
    if (lowerName.includes('camera') || lowerName.includes('tripod') || lowerName.includes('light')) return 'Media';
    return 'Other';
};

// Default images based on category
const getDefaultImage = (category: string): string => {
    const images: Record<string, string> = {
        'Office': "https://images.unsplash.com/photo-1517246014-9b7cedcc1538?w=800&q=80",
        'Audio': "https://images.unsplash.com/photo-1590845947376-2638caa89309?w=800&q=80",
        'Teaching Aid': "https://images.unsplash.com/photo-1587612049655-c1030123a662?w=800&q=80",
        'Media': "https://images.unsplash.com/photo-1552168324-d612d7772fda?w=800&q=80",
        'Other': "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80",
    };
    return images[category] || images['Other'];
};

const CATEGORIES = ["All", "Office", "Audio", "Teaching Aid", "Media", "Other"];

export default function EquipmentsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [equipments, setEquipments] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch equipments from API
    useEffect(() => {
        const fetchEquipments = async () => {
            try {
                setLoading(true);
                const res = await fetch(`${API_URL}/api/equipments`);
                if (!res.ok) {
                    throw new Error('Failed to fetch equipments');
                }
                const data = await res.json();
                setEquipments(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setLoading(false);
            }
        };

        fetchEquipments();
    }, []);

    // Add category to each equipment for filtering
    const equipmentsWithCategory = equipments.map(eq => ({
        ...eq,
        category: getCategoryFromName(eq.name),
        image: getDefaultImage(getCategoryFromName(eq.name)),
    }));

    const filteredItems = equipmentsWithCategory.filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="min-h-screen bg-gray-50/50 font-sans">
            <Navbar />

            <main className="container mx-auto py-10 px-4 md:px-6 max-w-7xl">
                {/* Title & Controls */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">Shared Equipment Inventory</h1>
                        <p className="text-gray-500 text-lg max-w-2xl">
                            List of equipment for teaching and events. Please book at least 24h in advance.
                        </p>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Search equipment..."
                                className="pl-9 bg-white"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-[180px] bg-white">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                {CATEGORIES.map((cat) => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <span className="ml-2 text-gray-500">Loading equipment...</span>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="text-center py-20">
                        <h3 className="text-lg font-semibold text-red-600">Error loading equipment</h3>
                        <p className="text-gray-500">{error}</p>
                        <Button className="mt-4" onClick={() => window.location.reload()}>
                            Retry
                        </Button>
                    </div>
                )}

                {/* Gallery Grid */}
                {!loading && !error && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredItems.map((item) => (
                            <Card key={item.equipmentId} className="group overflow-hidden border-none shadow-sm hover:shadow-xl transition-all duration-300">
                                {/* Image Area */}
                                <div className="aspect-[4/3] overflow-hidden relative bg-gray-100">
                                    <img
                                        src={item.image}
                                        alt={item.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                    <div className="absolute top-2 right-2">
                                        <Badge variant="secondary" className="bg-white/90 backdrop-blur-sm text-gray-700 shadow-sm border-none">
                                            {item.category}
                                        </Badge>
                                    </div>
                                    {item.availableQuantity < 5 && item.availableQuantity > 0 && (
                                        <div className="absolute bottom-2 left-2">
                                            <Badge variant="destructive" className="shadow-sm">
                                                Only {item.availableQuantity} left
                                            </Badge>
                                        </div>
                                    )}
                                    {item.availableQuantity === 0 && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[1px]">
                                            <span className="text-white font-bold text-lg border-2 border-white px-4 py-1 rotate-12">OUT OF STOCK</span>
                                        </div>
                                    )}
                                    {item.status !== 'GOOD' && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[1px]">
                                            <span className="text-white font-bold text-lg border-2 border-white px-4 py-1">
                                                {item.status === 'BROKEN' ? 'BROKEN' : 'MAINTENANCE'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <CardHeader className="p-4 pb-2">
                                    <CardTitle className="text-lg font-bold leading-tight group-hover:text-primary transition-colors">
                                        {item.name}
                                    </CardTitle>
                                </CardHeader>

                                <CardContent className="p-4 py-2 space-y-3">
                                    <p className="text-sm text-gray-500 line-clamp-2 min-h-[40px]">
                                        {item.facilityId ? `Assigned to Facility #${item.facilityId}` : 'Available in portable storage'}
                                    </p>

                                    {/* Pricing Block */}
                                    <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Rental Price:</span>
                                            <span className="font-semibold text-gray-900">
                                                {Number(item.rentalPrice) === 0
                                                    ? 'Free'
                                                    : `${Number(item.rentalPrice).toLocaleString('vi-VN')}đ`}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Available:</span>
                                            <span className="font-semibold text-orange-600">
                                                {item.availableQuantity} / {item.totalQuantity}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>

                                <CardFooter className="p-4 pt-2">
                                    <Button
                                        className="w-full group-hover:bg-primary transition-colors"
                                        disabled={item.availableQuantity === 0 || item.status !== 'GOOD'}
                                    >
                                        {item.availableQuantity === 0 ? "Out of stock" : item.status !== 'GOOD' ? item.status : "Add to booking"}
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}

                {!loading && !error && filteredItems.length === 0 && (
                    <div className="text-center py-20">
                        <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">No equipment found</h3>
                        <p className="text-gray-500">Try changing keywords or category filters.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
