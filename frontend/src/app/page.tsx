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
import { Navbar } from "@/components/layout/Navbar";
import Link from "next/link";

// --- MOCK DATA ---
const FACILITIES = [
  {
    id: 1,
    name: "Phòng Hội Thảo A",
    capacity: 50,
    pricePerHour: 500000,
    type: "Hội trường",
    image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80",
    description: "Hệ thống âm thanh, ánh sáng hiện đại. Phù hợp hội nghị, workshop.",
    available: true
  },
  {
    id: 2,
    name: "Phòng Học 101",
    capacity: 30,
    pricePerHour: 200000,
    type: "Phòng học",
    image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80",
    description: "Trang bị bảng thông minh, điều hòa. Thích hợp lớp học nhỏ.",
    available: true
  },
  {
    id: 3,
    name: "Lab Máy Tính",
    capacity: 25,
    pricePerHour: 300000,
    type: "Phòng Lab",
    image: "https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=800&q=80",
    description: "25 máy PC cấu hình cao (Core i7, 32GB RAM). Mạng LAN 1Gbps.",
    available: true
  },
  {
    id: 4,
    name: "Sân Bóng Chuyền",
    capacity: 200,
    pricePerHour: 150000,
    type: "Ngoài trời",
    image: "https://images.unsplash.com/photo-1626245652674-8d49f697412e?w=800&q=80",
    description: "Sân tiêu chuẩn thi đấu. Hệ thống đèn chiếu sáng ban đêm.",
    available: true
  },
  {
    id: 5,
    name: "Phòng Họp Nhóm B",
    capacity: 10,
    pricePerHour: 100000,
    type: "Phòng họp",
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
    description: "Không gian yên tĩnh, bảng trắng, TV trình chiếu.",
    available: true
  },
  {
    id: 6,
    name: "Giảng Đường Lớn C1",
    capacity: 500,
    pricePerHour: 2000000,
    type: "Hội trường",
    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80",
    description: "Sức chứa lớn, âm thanh vòm. Dành cho sự kiện toàn trường.",
    available: false
  },
];

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredFacilities = FACILITIES.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans">
      <Navbar />

      <main className="container mx-auto py-10 px-4 md:px-6 max-w-7xl">
        {/* Hero / Header Section */}
        <div className="flex flex-col items-center justify-center text-center space-y-4 mb-16">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-gray-900">
            Đặt Phòng & Tiện Ích <span className="text-primary">Đại Học Bách Khoa</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-500 max-w-3xl mx-auto">
            Hệ thống quản lý đặt phòng họp, giảng đường, sân bãi và thiết bị dùng chung cho cán bộ và sinh viên.
          </p>

          {/* Search Bar */}
          <div className="w-full max-w-md relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Tìm kiếm phòng, hội trường..."
              className="pl-10 py-6 text-lg shadow-sm border-gray-200 focus-visible:ring-primary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Facilities Grid */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Danh Sách Phòng & Cơ Sở</h2>
            <span className="text-sm text-gray-500">{filteredFacilities.length} kết quả</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredFacilities.map((facility) => (
              <Card key={facility.id} className="group overflow-hidden border-none shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full">
                {/* Image */}
                <div className="aspect-video overflow-hidden relative bg-gray-100">
                  <img
                    src={facility.image}
                    alt={facility.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-white/90 text-gray-800 backdrop-blur-sm shadow-sm hover:bg-white">{facility.type}</Badge>
                  </div>
                  {!facility.available && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                      <span className="text-white font-bold border-2 border-white px-4 py-1">BẢO TRÌ</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <CardHeader className="p-5 pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-primary transition-colors">
                      {facility.name}
                    </CardTitle>
                  </div>
                </CardHeader>

                <CardContent className="p-5 py-2 flex-grow">
                  <p className="text-gray-500 text-sm line-clamp-2 mb-4">
                    {facility.description}
                  </p>

                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-gray-900">{facility.capacity}</span> chỗ
                    </div>
                    <div className="w-px h-4 bg-gray-300"></div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-primary">{facility.pricePerHour.toLocaleString()}đ</span> /giờ
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="p-5 pt-2">
                  <Link href="/book-room" className="w-full">
                    <Button className="w-full" variant={facility.available ? "default" : "secondary"} disabled={!facility.available}>
                      {facility.available ? "Đặt Ngay" : "Tạm Ngưng"}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>

          {filteredFacilities.length === 0 && (
            <div className="text-center py-20">
              <h3 className="text-lg font-semibold text-gray-900">Không tìm thấy kết quả</h3>
              <p className="text-gray-500">Thử từ khóa khác xem sao.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}