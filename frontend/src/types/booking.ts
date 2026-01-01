// src/types/booking.ts

// Enum giả lập theo common/enums/db-enums
export enum BookingType {
  ACADEMIC = 'ACADEMIC',
  EVENT = 'EVENT',
  PERSONAL = 'PERSONAL',
}

export interface BookingDetailDto {
  equipmentId: number;
  quantity: number;
  note?: string;
  // Các field phụ trợ hiển thị (không gửi lên server)
  equipmentName?: string;
  unitPrice?: number;
}

export interface CreateBookingDto {
  facilityId: number;
  purpose?: string;
  bookingType: BookingType;
  checkInTime: string; // ISO String
  checkOutTime: string; // ISO String
  equipments?: BookingDetailDto[];
}