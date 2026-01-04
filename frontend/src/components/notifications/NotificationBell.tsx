"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";

type Notification = {
    notificationId: number;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: string;
};

export function NotificationBell() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    const fetchNotifications = async () => {
        if (!user) return;
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3500';
            const res = await fetch(`${API_URL}/api/notifications`, {
                headers: { 'x-user-id': user.userId.toString() }
            });
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.data);
                setUnreadCount(data.unread);
            }
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 15000); // 15s polling
        return () => clearInterval(interval);
    }, [user]);

    const handleMarkAllRead = async () => {
        if (!user) return;
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3500';
            await fetch(`${API_URL}/api/notifications/read-all`, {
                method: 'PUT',
                headers: { 'x-user-id': user.userId.toString() }
            });
            fetchNotifications();
        } catch (err) { }
    };

    const handleRead = async (id: number) => {
        // Optimistic update
        setNotifications(prev => prev.map(n => n.notificationId === id ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));

        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3500';
        if (!user) return;
        await fetch(`${API_URL}/api/notifications/${id}/read`, {
            method: 'PUT',
            headers: { 'x-user-id': user.userId.toString() }
        });
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative hover:bg-gray-100 rounded-full h-10 w-10">
                    <Bell className="h-5 w-5 text-gray-600" />
                    {unreadCount > 0 && (
                        <Badge className="absolute top-1 right-1 h-4 w-4 flex items-center justify-center p-0 rounded-full bg-red-500 text-white text-[10px] border border-white">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 mr-4 shadow-xl border-gray-200" align="end">
                <div className="flex items-center justify-between p-4 border-b bg-gray-50/50">
                    <h4 className="font-semibold text-sm text-gray-900">Notifications</h4>
                    {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="h-auto px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                            Mark all read
                        </Button>
                    )}
                </div>
                <div className="max-h-[400px] overflow-y-auto bg-white">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center">
                            <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">No notifications yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {notifications.map((n) => (
                                <div
                                    key={n.notificationId}
                                    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${!n.isRead ? 'bg-blue-50/40' : ''}`}
                                    onClick={() => !n.isRead && handleRead(n.notificationId)}
                                >
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="flex-1">
                                            <p className={`text-sm ${!n.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{n.title}</p>
                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{n.message}</p>
                                            <span className="text-[10px] text-gray-400 mt-2 block font-medium">
                                                {new Date(n.createdAt).toLocaleDateString()} • {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        {!n.isRead && (
                                            <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5 shadow-sm" title="Unread" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
