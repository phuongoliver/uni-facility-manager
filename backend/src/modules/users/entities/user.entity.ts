import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';

export enum UserRole {
    STUDENT = 'STUDENT',
    LECTURER = 'LECTURER',
    ADMIN = 'ADMIN',
}

@Entity('users')
export class User {
    @PrimaryGeneratedColumn({ name: 'user_id' })
    userId: number;

    @Column({ name: 'sso_id', unique: true, length: 50 })
    ssoId: string;

    @Column({ name: 'full_name', length: 100 })
    fullName: string;

    @Column({ unique: true, length: 100 })
    email: string;

    @Column({
        type: 'enum',
        enum: UserRole,
    })
    role: UserRole;

    @Column({ length: 100, nullable: true })
    department: string;

    @Column({ default: 'ACTIVE', length: 20 })
    status: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @OneToMany(() => Booking, (booking) => booking.user)
    bookings: Booking[];
}
