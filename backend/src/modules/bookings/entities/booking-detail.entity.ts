import { Entity, Column, ManyToOne, JoinColumn, PrimaryColumn } from "typeorm";
import { Booking } from "./booking.entity";
import { Equipment } from "../../equipments/entities/equipment.entity";

@Entity("booking_details")
export class BookingDetail {
  // Composite Primary Key
  @PrimaryColumn({ name: "booking_id" })
  bookingId: number;

  @PrimaryColumn({ name: "equipment_id" })
  equipmentId: number;

  @Column({ type: "int" })
  quantity: number;

  @Column({ type: "text", nullable: true })
  note: string;

  // Trigger snapshot giá tự động điền vào đây
  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    default: 0,
    name: "booked_price",
  })
  bookedPrice: number;

  @ManyToOne(() => Booking, (booking) => booking.details, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "booking_id" })
  booking: Booking;

  @ManyToOne(() => Equipment)
  @JoinColumn({ name: "equipment_id" })
  equipment: Equipment;
}
