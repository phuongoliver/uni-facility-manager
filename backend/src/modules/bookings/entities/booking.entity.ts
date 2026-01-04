import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BookingDetail } from './booking-detail.entity';
import { BookingType, BookingStatus } from '../../../common/enums/db-enums';
import { User } from '../../users/entities/user.entity';
import { Facility } from '../../facilities/entities/facility.entity';
import { BookingGroup } from './booking-group.entity';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('identity', { name: 'booking_id' })
  bookingId: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, (user) => user.bookings)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'facility_id' })
  facilityId: number;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ type: 'text', nullable: true })
  purpose: string;

  @Column({ type: 'enum', enum: BookingType, name: 'booking_type' })
  bookingType: BookingType;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  @Column({ type: 'timestamptz', name: 'check_in_time' })
  checkInTime: Date;

  @Column({ type: 'timestamptz', name: 'check_out_time' })
  checkOutTime: Date;

  // Cột này do Trigger DB tự tính, NestJS chỉ đọc
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'total_amount' })
  totalAmount: number;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date;

  @Column({ name: 'recurrence_group_id', type: 'uuid', nullable: true })
  recurrenceGroupId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'parent_booking_id', nullable: true })
  parentBookingId: number;

  @ManyToOne(() => Booking, { nullable: true })
  @JoinColumn({ name: 'parent_booking_id' })
  parentBooking: Booking;

  @Column({ name: 'group_id', nullable: true })
  groupId: number;

  @ManyToOne(() => BookingGroup, (group) => group.bookings, { nullable: true })
  @JoinColumn({ name: 'group_id' })
  group: BookingGroup;

  @OneToMany(() => BookingDetail, (detail) => detail.booking)
  details: BookingDetail[];
}