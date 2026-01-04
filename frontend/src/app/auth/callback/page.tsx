"use client";

import { useEffect, Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { API_URL } from "@/lib/constants";

function AuthCallbackContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { setSession } = useAuth();
    const [status, setStatus] = useState("Processing login...");

    useEffect(() => {
        const code = searchParams.get('code');
        const data = searchParams.get('data'); // Fallback for Scenario A if they mix it up

        if (code) {
            exchangeCode(code);
        } else if (data) {
            // Handle old/scenario A way
            try {
                const parsedData = JSON.parse(decodeURIComponent(data));
                if (parsedData.user) {
                    setSession(parsedData.user);
                }
            } catch (e) {
                console.error("Failed to parse login data", e);
                setStatus("Error parsing login data.");
            }
        } else {
            setStatus("No authorization code found.");
        }
    }, [searchParams]);

    const exchangeCode = async (code: string) => {
        try {
            setStatus("Exchanging token...");
            const res = await fetch(`${API_URL}/api/auth/exchange-sso`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });

            if (!res.ok) {
                throw new Error("Failed to exchange token");
            }

            const data = await res.json();
            if (data.user) {
                setStatus("Login successful! Redirecting...");
                setSession(data.user);
            } else {
                throw new Error("No user data received");
            }
        } catch (err: any) {
            console.error("Exchange Error:", err);
            setStatus(`Login failed: ${err.message}`);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center flex-col gap-4">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-600 font-medium">{status}</p>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AuthCallbackContent />
        </Suspense>
    );
}
