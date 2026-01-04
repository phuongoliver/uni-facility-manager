"use client";
import { API_URL } from "@/lib/constants";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

interface User {
    userId: number;
    ssoId: string;
    fullName: string;
    email: string;
    role: string;
    department?: string;
}

interface AuthContextType {
    user: User | null;
    login: (ssoId?: string) => Promise<void>;
    setSession: (user: User) => void;
    logout: () => void;
    isLoading: boolean;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setIsLoading(false);
    }, []);

    const login = async (ssoId: string = "20110456") => {
        try {
            // Call Mock API
            const res = await fetch(`${API_URL}/api/auth/login-mock`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ssoId }),
            });
            if (!res.ok) throw new Error("Login failed");
            const data = await res.json();

            setUser(data.user);
            localStorage.setItem("user", JSON.stringify(data.user));

            // Redirect based on role
            if (['ADMIN', 'FACILITY_MANAGER'].includes(data.user.role)) {
                router.push("/manage-facilities");
            } else {
                router.push("/my-bookings");
            }
        } catch (error) {
            console.error(error);
            alert("Đăng nhập thất bại. Vui lòng thử lại.");
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem("user");
        router.push("/login");
    };

    const setSession = (user: User) => {
        setUser(user);
        localStorage.setItem("user", JSON.stringify(user));
        // Redirect based on role
        if (['ADMIN', 'FACILITY_MANAGER'].includes(user.role)) {
            router.push("/manage-facilities");
        } else {
            router.push("/my-bookings");
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, setSession, logout, isLoading, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
};
