"use client";

import React, { useState } from "react";
import { Search } from "lucide-react";
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

// --- MOCK DATA ---
const EQUIPMENT_LIST = [
    {
        id: 1,
        name: "Máy chiếu Sony 4K HDR",
        category: "Văn phòng",
        image: "https://images.unsplash.com/photo-1517246014-9b7cedcc1538?w=800&q=80",
        rentalPrice: 150000,
        deposit: 2000000,
        available: 5,
        description: "Độ sáng cao, phù hợp hội trường lớn.",
    },
    {
        id: 2,
        name: "Micro Sennheiser Wireless",
        category: "Âm thanh",
        image: "https://images.unsplash.com/photo-1590845947376-2638caa89309?w=800&q=80",
        rentalPrice: 50000,
        deposit: 500000,
        available: 12,
        description: "Pin 8h, sóng xa 50m.",
    },
    {
        id: 3,
        name: "Loa JBL PartyBox",
        category: "Âm thanh",
        image: "https://images.unsplash.com/photo-1543536448-d209d2d13a1c?w=800&q=80",
        rentalPrice: 200000,
        deposit: 3000000,
        available: 3,
        description: "Công suất lớn, có đèn LED.",
    },
    {
        id: 4,
        name: "Bảng Huion Kamvas",
        category: "Thiết bị dạy học",
        image: "https://images.unsplash.com/photo-1587612049655-c1030123a662?w=800&q=80",
        rentalPrice: 80000,
        deposit: 1500000,
        available: 8,
        description: "Bảng vẽ điện tử cho giảng dạy online.",
    },
    {
        id: 5,
        name: "Tripod Máy Quay",
        category: "Media",
        image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80",
        rentalPrice: 30000,
        deposit: 200000,
        available: 15,
        description: "Chân máy quay chuyên nghiệp, carbon fiber.",
    },
    {
        id: 6,
        name: "Đèn Studio Godox",
        category: "Media",
        image: "https://images.unsplash.com/photo-1552168324-d612d7772fda?w=800&q=80",
        rentalPrice: 100000,
        deposit: 1000000,
        available: 4,
        description: "Ánh sáng liên tục 150W.",
    },
];

const CATEGORIES = ["Tất cả", "Văn phòng", "Âm thanh", "Thiết bị dạy học", "Media"];

export default function EquipmentsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("Tất cả");

    const filteredItems = EQUIPMENT_LIST.filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === "Tất cả" || item.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="min-h-screen bg-gray-50/50 font-sans">
            <Navbar />

            <main className="container mx-auto py-10 px-4 md:px-6 max-w-7xl">
                {/* Title & Controls */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">Kho Thiết Bị Dùng Chung</h1>
                        <p className="text-gray-500 text-lg max-w-2xl">
                            Danh sách thiết bị hỗ trợ giảng dạy và sự kiện. Vui lòng đặt trước ít nhất 24h.
                        </p>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Tìm thiết bị..."
                                className="pl-9 bg-white"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-[180px] bg-white">
                                <SelectValue placeholder="Danh mục" />
                            </SelectTrigger>
                            <SelectContent>
                                {CATEGORIES.map((cat) => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Gallery Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredItems.map((item) => (
                        <Card key={item.id} className="group overflow-hidden border-none shadow-sm hover:shadow-xl transition-all duration-300">
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
                                {item.available < 5 && item.available > 0 && (
                                    <div className="absolute bottom-2 left-2">
                                        <Badge variant="destructive" className="shadow-sm">
                                            Chỉ còn {item.available}
                                        </Badge>
                                    </div>
                                )}
                                {item.available === 0 && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[1px]">
                                        <span className="text-white font-bold text-lg border-2 border-white px-4 py-1 rotate-12">HẾT HÀNG</span>
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
                                    {item.description}
                                </p>

                                {/* Pricing Block */}
                                <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Giá thuê (ngày):</span>
                                        <span className="font-semibold text-gray-900">{item.rentalPrice.toLocaleString()}đ</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Tiền cọc:</span>
                                        <span className="font-semibold text-orange-600">{item.deposit.toLocaleString()}đ</span>
                                    </div>
                                </div>
                            </CardContent>

                            <CardFooter className="p-4 pt-2">
                                <Button className="w-full group-hover:bg-primary transition-colors" disabled={item.available === 0}>
                                    {item.available === 0 ? "Tạm hết" : "Thêm vào đơn mượn"}
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>

                {filteredItems.length === 0 && (
                    <div className="text-center py-20">
                        <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Không tìm thấy thiết bị nào</h3>
                        <p className="text-gray-500">Hãy thử thay đổi từ khóa hoặc bộ lọc danh mục.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
