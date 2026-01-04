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
import { Navbar } from "@/components/layout/Navbar";
import Link from "next/link";
import { API_URL } from "@/lib/constants";

// Type matching backend Facility entity
interface Facility {
  facilityId: number;
  name: string;
  location: string;
  type: string;
  capacity: number;
  imageUrl: string | null;
  status: string;
  price: number;
  priceType: 'PER_HOUR' | 'PER_BOOKING' | 'ONE_TIME';
  transactionType: string;
  requiresApproval: boolean;
  managerId: number;
}

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch facilities from API
  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/facilities`);
        if (!res.ok) {
          throw new Error('Failed to fetch facilities');
        }
        const data = await res.json();
        setFacilities(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchFacilities();
  }, []);

  const filteredFacilities = facilities.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper to get a fallback image based on facility type
  const getDefaultImage = (type: string) => {
    const images: Record<string, string> = {
      HALL: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80",
      CLASSROOM: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80",
      LAB: "https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=800&q=80",
      OUTDOOR: "https://images.unsplash.com/photo-1626245652674-8d49f697412e?w=800&q=80",
    };
    return images[type] || "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80";
  };

  // Helper to format facility type for display
  const formatType = (type: string) => {
    const typeMap: Record<string, string> = {
      HALL: "Hall",
      CLASSROOM: "Classroom",
      LAB: "Laboratory",
      OUTDOOR: "Outdoor",
    };
    return typeMap[type] || type;
  };

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans">
      <Navbar />

      <main className="container mx-auto py-10 px-4 md:px-6 max-w-7xl">
        {/* Hero / Header Section */}
        <div className="flex flex-col items-center justify-center text-center space-y-4 mb-16">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-gray-900">
            Booking & Facilities <span className="text-primary">BK University</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-500 max-w-3xl mx-auto">
            Booking management system for meeting rooms, lecture halls, sports grounds, and shared equipment for staff and students.
          </p>

          {/* Search Bar */}
          <div className="w-full max-w-md relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search rooms, halls..."
              className="pl-10 py-6 text-lg shadow-sm border-gray-200 focus-visible:ring-primary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Facilities Grid */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Facilities Directory</h2>
            <span className="text-sm text-gray-500">
              {loading ? "Loading..." : `${filteredFacilities.length} results`}
            </span>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2 text-gray-500">Loading facilities...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-20">
              <h3 className="text-lg font-semibold text-red-600">Error loading facilities</h3>
              <p className="text-gray-500">{error}</p>
              <Button className="mt-4" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          )}

          {/* Facilities Grid */}
          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredFacilities.map((facility) => (
                <Card key={facility.facilityId} className="group overflow-hidden border-none shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full">
                  {/* Image */}
                  <div className="aspect-video overflow-hidden relative bg-gray-100">
                    <img
                      src={facility.imageUrl || getDefaultImage(facility.type)}
                      alt={facility.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-white/90 text-gray-800 backdrop-blur-sm shadow-sm hover:bg-white">
                        {formatType(facility.type)}
                      </Badge>
                    </div>
                    {facility.status !== 'AVAILABLE' && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                        <span className="text-white font-bold border-2 border-white px-4 py-1">
                          {facility.status === 'MAINTENANCE' ? 'MAINTENANCE' : 'UNAVAILABLE'}
                        </span>
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
                      {facility.location || "Location not specified"}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-gray-900">{facility.capacity}</span> seats
                      </div>
                      <div className="w-px h-4 bg-gray-300"></div>
                      <div className="flex items-center gap-1">
                        {Number(facility.price) === 0 ? (
                          <span className="font-semibold text-green-600">Free</span>
                        ) : (
                          <>
                            <span className="font-semibold text-primary">
                              {Number(facility.price).toLocaleString('vi-VN')}đ
                            </span>
                            <span>
                              /{facility.priceType === 'PER_HOUR' ? 'hour' : facility.priceType === 'PER_BOOKING' ? 'booking' : 'one-time'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="p-5 pt-2">
                    <Link href="/book-room" className="w-full">
                      <Button
                        className="w-full"
                        variant={facility.status === 'AVAILABLE' ? "default" : "secondary"}
                        disabled={facility.status !== 'AVAILABLE'}
                      >
                        {facility.status === 'AVAILABLE' ? "Book Now" : "Unavailable"}
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          {!loading && !error && filteredFacilities.length === 0 && (
            <div className="text-center py-20">
              <h3 className="text-lg font-semibold text-gray-900">No results found</h3>
              <p className="text-gray-500">Try a different keyword.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}