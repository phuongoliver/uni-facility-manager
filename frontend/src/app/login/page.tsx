"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, GraduationCap, Shield } from "lucide-react";

export default function LoginPage() {
    const { login } = useAuth();
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleLogin = async (role: 'STUDENT' | 'ADMIN') => {
        setIsLoggingIn(true);
        // Demo defaults: Student maps to 20110456, Admin to ADM001
        const ssoId = role === 'STUDENT' ? '20110456' : 'ADM001';
        await login(ssoId);
        setIsLoggingIn(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="mx-auto w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4 shadow-lg shadow-blue-600/20">
                        <GraduationCap className="h-6 w-6 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">University Facility Manager</h1>
                    <p className="text-gray-500 mt-2 text-sm">Hệ thống quản lý cơ sở vật chất trường đại học</p>
                </div>

                <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
                    <CardHeader className="space-y-1 text-center pb-2">
                        <CardTitle className="text-xl">Đăng nhập hệ thống</CardTitle>
                        <CardDescription>
                            Vui lòng chọn phương thức đăng nhập SSO
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 pt-4">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-gray-100" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white px-2 text-gray-400">HCMUT SSO</span>
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            className="h-12 relative overflow-hidden border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all group"
                            onClick={() => handleLogin('STUDENT')}
                            disabled={isLoggingIn}
                        >
                            <div className="absolute inset-0 w-1 bg-blue-600 transition-all group-hover:w-full opacity-5" />
                            <LogIn className="mr-2 h-4 w-4 text-blue-600 group-hover:text-blue-700" />
                            Đăng nhập sinh viên / GV
                        </Button>

                        <Button
                            variant="outline"
                            className="h-12 relative overflow-hidden border-gray-200 hover:bg-gray-50 transition-all"
                            onClick={() => handleLogin('ADMIN')}
                            disabled={isLoggingIn}
                        >
                            <Shield className="mr-2 h-4 w-4 text-gray-500" />
                            Đăng nhập Quản trị viên (Demo)
                        </Button>
                    </CardContent>
                    <CardFooter>
                        <p className="text-xs text-center text-gray-400 w-full">
                            Demo Version 1.0.0 &copy; 2026
                        </p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
