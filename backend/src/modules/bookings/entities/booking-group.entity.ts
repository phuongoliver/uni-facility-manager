import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Booking } from './booking.entity';
import { User } from '../../users/entities/user.entity';
import { Facility } from '../../facilities/entities/facility.entity';
import { BookingStatus } from '../../../common/enums/db-enums';

@Entity('booking_groups')
export class BookingGroup {
    @PrimaryGeneratedColumn({ name: 'group_id' })
    groupId: number;

    @Column({ name: 'user_id' })
    userId: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ name: 'facility_id' })
    facilityId: number;

    @ManyToOne(() => Facility)
    @JoinColumn({ name: 'facility_id' })
    facility: Facility;

    @Column({ name: 'recurrence_pattern', nullable: true })
    recurrencePattern: string; // e.g. "WEEKLY until 2026-12-31"

    @Column({ name: 'total_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
    totalAmount: number;

    @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
    status: BookingStatus;

    @OneToMany(() => Booking, (booking) => booking.group)
    bookings: Booking[];

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;
}
