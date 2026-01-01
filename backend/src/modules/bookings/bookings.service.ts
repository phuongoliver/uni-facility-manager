import { Injectable, BadRequestException, NotFoundException, ConflictException, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, LessThan, MoreThan, In, DataSource, Not } from 'typeorm';

import { Booking } from './entities/booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingDetail } from './entities/booking-detail.entity';
import { Facility } from '../facilities/entities/facility.entity';
import { Equipment } from '../equipments/entities/equipment.entity';
import { BookingStatus } from './../../common/enums/db-enums';

@Injectable()
export class BookingsService implements OnModuleInit {
    constructor(
        @InjectRepository(Booking)
        private bookingsRepository: Repository<Booking>,
        @InjectRepository(BookingDetail)
        private bookingDetailRepository: Repository<BookingDetail>,
        @InjectRepository(Facility)
        private facilityRepository: Repository<Facility>,
        @InjectRepository(Equipment)
        private equipmentRepository: Repository<Equipment>,
        private dataSource: DataSource,
    ) { }

    async onModuleInit() {
        // Fix for missing column and enum value in development environment without sync
        try {
            await this.dataSource.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurrence_group_id UUID;`);
            console.log("Database schema updated: recurrence_group_id added to bookings table.");

            // Add RESCHEDULED to enum if not exists
            await this.dataSource.query(`ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'RESCHEDULED';`);
            console.log("Database schema updated: RESCHEDULED added to booking_status enum.");

        } catch (error) {
            console.error("Failed to update database schema:", error);
        }
    }

    private getSlotTime(date: string, slot: number): { start: Date; end: Date } {
        // Logic: Slot 1 starts 7:00. Each slot 50 mins.
        // Assuming simple arithmetic based on user prompt "Tiết 1 (7:00-7:50), Tiết 2 (8:00-8:50)".
        // StartHour = 7 + (slot - 1).
        // StartMinute = 0.
        const startHour = 7 + (slot - 1);

        // Parse input date (YYYY-MM-DD)
        // Note: Date.parse might be UTC or Local. Best to construct robustly.
        const startTimeResult = new Date(date);
        startTimeResult.setHours(startHour, 0, 0, 0);

        const endTimeResult = new Date(startTimeResult);
        endTimeResult.setMinutes(endTimeResult.getMinutes() + 50);

        return { start: startTimeResult, end: endTimeResult };
    }

    private async _createBookingTransaction(manager: EntityManager, userId: number, createBookingDto: CreateBookingDto): Promise<Booking[]> {
        const { facility_id, purpose, booking_date, start_slot, end_slot, booking_type, equipment_items, recurrence_type, recurrence_end_date } = createBookingDto;

        // 0. Prepare dates logic
        let datesToBook: Date[] = [];
        const initialDate = new Date(booking_date);
        datesToBook.push(initialDate);

        if (recurrence_type && recurrence_end_date) {
            const endDate = new Date(recurrence_end_date);
            let nextDate = new Date(initialDate);

            while (true) {
                if (recurrence_type === 'DAILY') {
                    nextDate.setDate(nextDate.getDate() + 1);
                } else if (recurrence_type === 'WEEKLY') {
                    nextDate.setDate(nextDate.getDate() + 7);
                } else if (recurrence_type === 'MONTHLY') {
                    nextDate.setMonth(nextDate.getMonth() + 1);
                }

                if (nextDate > endDate) break;
                datesToBook.push(new Date(nextDate));
            }
        }

        const recurrenceGroupId = datesToBook.length > 1 ? crypto.randomUUID() : null;

        // 1. Time Slot Logic Helper
        if (start_slot > end_slot) {
            throw new BadRequestException('Start slot must be before or equal to End slot');
        }

        // 2. Validate Facility
        const facility = await manager.findOne(Facility, { where: { facilityId: facility_id } });
        if (!facility) {
            throw new NotFoundException(`Facility with ID ${facility_id} not found`);
        }

        // 3. Equipment Validation (Optimize: Check once if quantity sufficient)
        let itemsToBook: { equipmentId: number, quantity: number }[] = [];
        if (equipment_items && equipment_items.length > 0) {
            const equipIds = equipment_items.map(e => e.equipment_id);
            const equipmentsVector = await manager.findBy(Equipment, {
                equipmentId: In(equipIds),
            });
            const equipMap = new Map(equipmentsVector.map(e => [e.equipmentId, e]));

            for (const item of equipment_items) {
                const eq = equipMap.get(item.equipment_id);
                if (!eq) throw new NotFoundException(`Equipment ID ${item.equipment_id} not found`);
                if (eq.availableQuantity < item.quantity) {
                    throw new BadRequestException(`Thiết bị '${eq.name}' không đủ số lượng. Kho còn: ${eq.availableQuantity}, Yêu cầu: ${item.quantity}`);
                }
                itemsToBook.push({ equipmentId: item.equipment_id, quantity: item.quantity });
            }
        }

        const resultBookings: Booking[] = [];

        for (const date of datesToBook) {
            const dateString = date.toISOString().split('T')[0];
            const firstSlot = this.getSlotTime(dateString, start_slot);
            const lastSlot = this.getSlotTime(dateString, end_slot);

            const checkInTime = firstSlot.start;
            const checkOutTime = lastSlot.end;

            // Overlap Check per date
            const overlap = await manager.findOne(Booking, {
                where: {
                    facilityId: facility_id,
                    status: BookingStatus.APPROVED,
                    checkInTime: LessThan(checkOutTime),
                    checkOutTime: MoreThan(checkInTime),
                },
            });

            if (overlap) {
                throw new ConflictException(`Phòng đã có người đặt (APPROVED) vào ngày ${dateString} trong khung giờ này.`);
            }

            const booking = new Booking();
            booking.userId = userId;
            booking.facilityId = facility_id;
            booking.purpose = purpose;
            booking.bookingType = booking_type;
            booking.checkInTime = checkInTime;
            booking.checkOutTime = checkOutTime;
            booking.status = BookingStatus.PENDING;
            booking.recurrenceGroupId = recurrenceGroupId; // Add Group ID

            const savedBooking = await manager.save(Booking, booking);

            if (itemsToBook.length > 0) {
                const details = itemsToBook.map(item => {
                    const det = new BookingDetail();
                    det.bookingId = savedBooking.bookingId;
                    det.equipmentId = item.equipmentId;
                    det.quantity = item.quantity;
                    det.bookedPrice = 0;
                    return det;
                });
                await manager.save(BookingDetail, details);
            }
            resultBookings.push(savedBooking);
        }
        return resultBookings;
    }

    async create(userId: number, createBookingDto: CreateBookingDto) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const resultBookings = await this._createBookingTransaction(queryRunner.manager, userId, createBookingDto);
            await queryRunner.commitTransaction();

            // Return the first booking or all if needed (returning first for simplicity of existing API)
            return await this.bookingsRepository.findOne({
                where: { bookingId: resultBookings[0].bookingId },
                relations: ['details'],
            });

        } catch (err) {
            await queryRunner.rollbackTransaction();
            if (err.code === '23P01') {
                throw new ConflictException('Xung đột lịch đặt phòng (Race condition).');
            }
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    async reschedule(oldBookingId: number, userId: number, createBookingDto: CreateBookingDto) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            // 1. Get Old Booking
            const oldBooking = await queryRunner.manager.findOne(Booking, {
                where: { bookingId: oldBookingId, userId },
            });
            if (!oldBooking) throw new NotFoundException(`Booking #${oldBookingId} not found`);

            if (oldBooking.status === BookingStatus.CANCELLED || oldBooking.status === BookingStatus.REJECTED || oldBooking.status === BookingStatus.RESCHEDULED) {
                throw new BadRequestException(`Cannot reschedule booking with status ${oldBooking.status}`);
            }

            // 2. Update Old Booking Status
            oldBooking.status = BookingStatus.RESCHEDULED;
            await queryRunner.manager.save(Booking, oldBooking);

            // 3. Create New Booking(s)
            const resultBookings = await this._createBookingTransaction(queryRunner.manager, userId, createBookingDto);

            await queryRunner.commitTransaction();
            return await this.bookingsRepository.findOne({
                where: { bookingId: resultBookings[0].bookingId },
                relations: ['details'],
            });
        } catch (err) {
            await queryRunner.rollbackTransaction();
            if (err.code === '23P01') throw new ConflictException('Xung đột lịch đặt phòng.');
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    async findAll(userId: number) {
        return this.bookingsRepository.find({
            where: {
                userId,
                status: Not(BookingStatus.RESCHEDULED),
            },
            relations: ['facility', 'details', 'details.equipment'],
            order: { checkInTime: 'DESC' },
        });
    }

    async cancel(id: number, userId: number) {
        const booking = await this.bookingsRepository.findOne({
            where: { bookingId: id, userId },
        });

        if (!booking) {
            throw new NotFoundException(`Booking #${id} not found or access denied`);
        }

        if (booking.status === BookingStatus.CANCELLED) {
            throw new BadRequestException(`Booking #${id} is already cancelled`);
        }

        // Allow cancellation for Pending/Approved
        if (booking.status === BookingStatus.COMPLETED || booking.status === BookingStatus.REJECTED) {
            throw new BadRequestException(`Cannot cancel booking with status ${booking.status}`);
        }

        booking.status = BookingStatus.CANCELLED;
        return this.bookingsRepository.save(booking);
    }

    async findByFacility(facilityId: number) {
        return this.bookingsRepository.find({
            where: {
                facilityId,
                status: In([BookingStatus.APPROVED, BookingStatus.PENDING])
            },
            select: ['checkInTime', 'checkOutTime', 'status'],
        });
    }
}