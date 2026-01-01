"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User as UserIcon, Mail, Building2, ShieldCheck, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function UserProfileSidebar() {
    const { user, logout } = useAuth();

    if (!user) {
        return (
            <Card className="border-none shadow-sm">
                <CardContent className="p-6 text-center">
                    <p className="text-gray-500 mb-4">Bạn chưa đăng nhập.</p>
                    <Button variant="outline" onClick={logout}>Đăng nhập ngay</Button>
                </CardContent>
            </Card>
        )
    }

    // Get initials
    const initials = user.fullName
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return (
        <div className="space-y-6">
            <Card className="border-none shadow-sm overflow-hidden text-center md:text-left">
                <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-90"></div>
                <div className="px-6 relative">
                    <div className="-mt-12 mb-4 flex justify-center md:justify-start">
                        <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
                            <AvatarImage src={`https://ui-avatars.com/api/?name=${user.fullName}&background=random`} />
                            <AvatarFallback className="bg-blue-100 text-blue-700 font-bold text-xl">{initials}</AvatarFallback>
                        </Avatar>
                    </div>

                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-gray-900">{user.fullName}</h3>
                        <p className="text-sm text-gray-500">{user.ssoId}</p>
                        <div className="mt-2 flex flex-wrap gap-2 justify-center md:justify-start">
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">
                                {user.role}
                            </Badge>
                        </div>
                    </div>
                </div>

                <div className="border-t border-gray-100 p-6 space-y-4">
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="truncate" title={user.email}>{user.email}</span>
                    </div>
                    {user.department && (
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span>{user.department}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                        <ShieldCheck className="w-4 h-4 text-gray-400" />
                        <span>Verified Student Account</span>
                    </div>
                </div>

                <div className="p-6 pt-0">
                    <Button
                        variant="outline"
                        className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
                        onClick={logout}
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Đăng xuất
                    </Button>
                </div>
            </Card>

            {/* Helper Links or Stats could go here */}
            <Card className="border-none shadow-sm hidden md:block">
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Trợ giúp</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-gray-500">
                    <p>Cần hỗ trợ? Liên hệ P.CSVC:</p>
                    <div className="flex items-center gap-2 text-blue-600">
                        <MapPin className="w-4 h-4" /> P. Quản trị Thiết bị
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
