"use client";

import { useState } from "react";
import { useRouter } from "next/navigation"; // Changed from useAuth
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, ArrowRight, ShieldCheck } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const handleSSORedirect = () => {
        setIsLoading(true);
        // Simulate redirect delay
        setTimeout(() => {
            router.push('/sso-login');
        }, 500);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="mx-auto w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4 shadow-lg shadow-blue-600/20">
                        <GraduationCap className="h-6 w-6 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">University Facility Manager</h1>
                    <p className="text-gray-500 mt-2 text-sm">University Facility Management System</p>
                </div>

                <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
                    <CardHeader className="space-y-1 text-center pb-2">
                        <CardTitle className="text-xl">Welcome Back</CardTitle>
                        <CardDescription>
                            Please sign in to access the facility management system
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 pt-4">
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center">
                            <p className="text-sm text-blue-800 font-medium mb-1">Authenticated Access Only</p>
                            <p className="text-xs text-blue-600">You will be redirected to the University SSO portal to verify your identity.</p>
                        </div>

                        <Button
                            className="h-12 bg-[#003da5] hover:bg-[#002a7a] text-white shadow-md shadow-blue-900/10 transition-all group"
                            onClick={handleSSORedirect}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Redirecting to SSO...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4" />
                                    Sign in with SSO
                                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                                </span>
                            )}
                        </Button>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <div className="text-center w-full">
                            <span className="text-xs text-gray-400 block mb-2">Supported Roles</span>
                            <div className="flex justify-center gap-3 text-xs text-gray-500">
                                <span className="px-2 py-1 bg-gray-100 rounded">Student</span>
                                <span className="px-2 py-1 bg-gray-100 rounded">Admin</span>
                                <span className="px-2 py-1 bg-gray-100 rounded">Staff</span>
                            </div>
                        </div>
                        <p className="text-xs text-center text-gray-400 w-full border-t border-gray-100 pt-4 mt-2">
                            Demo Version 1.0.0 &copy; 2026
                        </p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
