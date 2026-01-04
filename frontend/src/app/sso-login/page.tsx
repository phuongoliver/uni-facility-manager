"use client";
import { API_URL } from "@/lib/constants";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Lock, User, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SSOLoginPage() {
    const { login } = useAuth();
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            // Simulation of SSO authentication delay
            await new Promise(resolve => setTimeout(resolve, 800));

            if (!username || !password) {
                throw new Error("Please enter both username and password");
            }

            // In a real SSO, we would validate credentials here.
            // For this mock, we accept any password but rely on the username (ssoId) to identify the user role in the backend mock.
            // Common test IDs: 
            // - Student: 20110456
            // - Admin: ADM001
            // - Manager: MANAGER001

            await login(username);
            // login function handles redirection
        } catch (err: any) {
            setError(err.message || "Authentication failed");
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f2f5] font-sans text-gray-900">
            {/* Simulation of a University SSO Header */}
            <div className="w-full bg-[#003da5] h-24 mb-10 flex items-center px-8 shadow-md">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center">
                        <span className="text-[#003da5] font-bold text-xl">U</span>
                    </div>
                    <div className="text-white">
                        <h1 className="text-xl font-bold uppercase tracking-wider">Ho Chi Minh City University of Technology</h1>
                        <p className="text-xs text-blue-200 uppercase tracking-widest">Central Authentication Service</p>
                    </div>
                </div>
            </div>

            {/* Demo Credentials Hint */}
            <div className="mb-6 bg-yellow-50 border border-yellow-200 p-4 rounded-lg max-w-md w-full text-sm text-yellow-800">
                <p className="font-bold mb-1">Demo Credentials:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span>Student:</span> <code className="bg-yellow-100 px-1 rounded">20110456</code>
                    <span>Admin:</span> <code className="bg-yellow-100 px-1 rounded">ADM001</code>
                    <span>Manager:</span> <code className="bg-yellow-100 px-1 rounded">MANAGER001</code>
                    <span>Password:</span> <span className="italic">Any text</span>
                </div>
            </div>

            <Card className="w-full max-w-md border-t-4 border-t-[#003da5] shadow-xl">
                <CardHeader className="text-center border-b border-gray-100 bg-gray-50/50 pb-6">
                    <h2 className="text-xl font-semibold text-gray-800">Sign in to begin your session</h2>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={handleLogin} className="space-y-4">
                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md flex items-center gap-2 border border-red-100">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="username">SSO ID / Username</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                    id="username"
                                    placeholder="e.g. 20110456"
                                    className="pl-9"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    className="pl-9"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-[#003da5] hover:bg-[#002a7a] text-white transition-colors h-11 text-base font-medium mt-2"
                            disabled={isLoading}
                        >
                            {isLoading ? "Authenticating..." : "LOGIN"}
                        </Button>

                        <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-gray-300" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white px-2 text-gray-500">Or continue with</span>
                            </div>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            className="w-full border-gray-300 hover:bg-gray-50 h-11 text-base font-medium flex items-center justify-center gap-2 text-gray-700"
                            onClick={() => {
                                const clientId = 'client_id'; // Replace with your actual client_id
                                const redirectUri = encodeURIComponent('http://localhost:3001/auth/callback');
                                const scope = 'read';
                                const authUrl = `https://devhcmutsso.namanhishere.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
                                window.location.href = authUrl;
                            }}
                        >
                            <svg className="w-5 h-5 text-[#003da5]" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-1.07 3.97-2.9 5.4z" />
                            </svg>
                            Sign in with HCMUT SSO
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col gap-4 bg-gray-50/50 border-t border-gray-100 py-4">
                    <div className="text-center text-xs text-gray-500">
                        <p>For security reasons, please Log Out and Exit your web browser when you are done accessing services that require authentication!</p>
                    </div>
                    <Link href="/login" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                        <ArrowLeft className="w-3 h-3" />
                        Back to Service Selection
                    </Link>
                </CardFooter>
            </Card>

            <div className="mt-8 text-center text-xs text-gray-400">
                <p>&copy; 2026 University Facility Manager. All rights reserved.</p>
            </div>
        </div>
    );
}
