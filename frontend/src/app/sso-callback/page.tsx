"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

function CallbackContent() {
    const searchParams = useSearchParams();
    const { setSession } = useAuth();

    useEffect(() => {
        const data = searchParams.get('data');
        if (data) {
            try {
                const parsedData = JSON.parse(decodeURIComponent(data));
                if (parsedData.user) {
                    setSession(parsedData.user);
                }
            } catch (e) {
                console.error("Failed to parse login data", e);
            }
        }
    }, [searchParams, setSession]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <p>Processing login...</p>
        </div>
    );
}

export default function SSOCallbackPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CallbackContent />
        </Suspense>
    );
}
