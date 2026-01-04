// src/components/bookings/BookingForm.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { differenceInHours } from "date-fns";
import { Plus, Trash2, Calculator, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingType } from "@/types/booking";
import { API_URL } from "@/lib/constants";

// Types matching backend entities
interface Facility {
  facilityId: number;
  name: string;
  price: number;
  priceType: 'PER_HOUR' | 'PER_BOOKING' | 'ONE_TIME';
  status: string;
}

interface Equipment {
  equipmentId: number;
  name: string;
  rentalPrice: number;
  availableQuantity: number;
  status: string;
}

// --- ZOD SCHEMA (Validation) ---
const bookingSchema = z.object({
  facilityId: z.string().min(1, "Vui lòng chọn phòng"), // Select trả về string
  bookingType: z.nativeEnum(BookingType),
  purpose: z.string().optional(),
  checkInTime: z.string().refine((val) => val !== "", "Chọn giờ bắt đầu"),
  checkOutTime: z.string().refine((val) => val !== "", "Chọn giờ kết thúc"),
  equipments: z.array(
    z.object({
      equipmentId: z.string().min(1, "Chọn thiết bị"),
      quantity: z.number().min(1, "Số lượng tối thiểu là 1"),
      note: z.string().optional(),
    })
  ).optional(),
}).refine((data) => {
  const start = new Date(data.checkInTime);
  const end = new Date(data.checkOutTime);
  return end > start;
}, {
  message: "Thời gian kết thúc phải sau thời gian bắt đầu",
  path: ["checkOutTime"],
});

type BookingFormValues = z.infer<typeof bookingSchema>;

export function BookingForm() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Fetch facilities and equipments on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [facilitiesRes, equipmentsRes] = await Promise.all([
          fetch(`${API_URL}/api/facilities`),
          fetch(`${API_URL}/api/equipments`),
        ]);

        if (facilitiesRes.ok) {
          const facilitiesData = await facilitiesRes.json();
          setFacilities(facilitiesData.filter((f: Facility) => f.status === 'AVAILABLE'));
        }

        if (equipmentsRes.ok) {
          const equipmentsData = await equipmentsRes.json();
          setEquipments(equipmentsData.filter((e: Equipment) => e.availableQuantity > 0 && e.status === 'GOOD'));
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      facilityId: "",
      bookingType: BookingType.ACADEMIC,
      equipments: [],
      checkInTime: "",
      checkOutTime: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "equipments",
  });

  // --- LOGIC TÍNH TOÁN GIÁ (CLIENT-SIDE) ---
  const watchAllFields = form.watch();

  const totalCost = useMemo(() => {
    let total = 0;

    // 1. Tính tiền phòng theo loại giá
    const facility = facilities.find(f => f.facilityId.toString() === watchAllFields.facilityId);
    const start = watchAllFields.checkInTime ? new Date(watchAllFields.checkInTime) : null;
    const end = watchAllFields.checkOutTime ? new Date(watchAllFields.checkOutTime) : null;

    if (facility && start && end && end > start) {
      const hours = differenceInHours(end, start) || 1; // Tối thiểu 1h
      const price = Number(facility.price);

      switch (facility.priceType) {
        case 'PER_HOUR':
          total += price * hours;
          break;
        case 'PER_BOOKING':
        case 'ONE_TIME':
          total += price;
          break;
        default:
          total += price * hours;
      }
    }

    // 2. Tính tiền thiết bị
    if (watchAllFields.equipments) {
      watchAllFields.equipments.forEach((item) => {
        const eq = equipments.find(e => e.equipmentId.toString() === item.equipmentId);
        if (eq && item.quantity) {
          total += Number(eq.rentalPrice) * item.quantity;
        }
      });
    }

    return total;
  }, [watchAllFields, facilities, equipments]);

  // --- SUBMIT HANDLER ---
  const onSubmit = async (data: BookingFormValues) => {
    try {
      setSubmitting(true);

      // Transform dữ liệu trước khi gửi API để match DTO
      const payload = {
        ...data,
        facilityId: parseInt(data.facilityId),
        checkInTime: new Date(data.checkInTime).toISOString(),
        checkOutTime: new Date(data.checkOutTime).toISOString(),
        equipments: data.equipments?.map(e => ({
          ...e,
          equipmentId: parseInt(e.equipmentId),
        }))
      };

      console.log("Payload match DTO:", payload);

      // TODO: Uncomment when API is ready
      // const response = await fetch(`${API_URL}/api/bookings`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload),
      // });
      // if (!response.ok) throw new Error('Booking failed');

      alert("Đặt phòng thành công! (Xem console log)");
    } catch (err) {
      console.error('Booking failed:', err);
      alert("Đặt phòng thất bại. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  // Format price for display
  const formatPrice = (facility: Facility) => {
    const price = Number(facility.price);
    if (price === 0) return 'Miễn phí';
    const priceLabel = facility.priceType === 'PER_HOUR' ? '/giờ' :
      facility.priceType === 'PER_BOOKING' ? '/lượt' : '/lần';
    return `${price.toLocaleString('vi-VN')}đ${priceLabel}`;
  };

  if (loading) {
    return (
      <Card className="w-full max-w-4xl mx-auto shadow-lg border-none bg-white/80 backdrop-blur-sm">
        <CardContent className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-gray-500">Đang tải dữ liệu...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto shadow-lg border-none bg-white/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-gray-800">Đặt Lịch Phòng Học</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* ROW 1: Thông tin chung */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="facilityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chọn Phòng</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn phòng học..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {facilities.map((f) => (
                          <SelectItem key={f.facilityId} value={f.facilityId.toString()}>
                            {f.name} ({formatPrice(f)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bookingType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loại hình</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Loại hình sử dụng" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(BookingType).map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* ROW 2: Thời gian */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="checkInTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Thời gian bắt đầu</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="checkOutTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Thời gian kết thúc</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mục đích sử dụng (Tùy chọn)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Nhập ghi chú..." className="resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* SECTION: Dynamic Equipments */}
            <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-700">Thiết bị kèm theo</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ equipmentId: "", quantity: 1, note: "" })}
                  disabled={equipments.length === 0}
                >
                  <Plus className="w-4 h-4 mr-2" /> Thêm thiết bị
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-4 items-end animate-in fade-in slide-in-from-top-2">
                  <FormField
                    control={form.control}
                    name={`equipments.${index}.equipmentId`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Chọn thiết bị" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {equipments.map((e) => (
                              <SelectItem key={e.equipmentId} value={e.equipmentId.toString()}>
                                {e.name} ({Number(e.rentalPrice) === 0 ? 'Miễn phí' : `${Number(e.rentalPrice).toLocaleString('vi-VN')}đ`})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`equipments.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem className="w-24">
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            {...field}
                            onChange={e => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {fields.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-2">
                  {equipments.length === 0 ? 'Không có thiết bị khả dụng.' : 'Chưa có thiết bị nào được chọn.'}
                </p>
              )}
            </div>

            {/* SECTION: Summary Footer */}
            <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/10">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <Calculator className="w-5 h-5" />
                <span>Tạm tính:</span>
              </div>
              <div className="text-2xl font-bold text-primary">
                {totalCost.toLocaleString('vi-VN')} VND
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-lg font-medium shadow-md hover:shadow-lg transition-all"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                'Xác nhận Đặt phòng'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}