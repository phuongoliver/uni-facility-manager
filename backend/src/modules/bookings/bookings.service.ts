import { Injectable, BadRequestException, NotFoundException, ConflictException, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, LessThan, MoreThan, In, DataSource, Not } from 'typeorm';

import { Booking } from './entities/booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingDetail } from './entities/booking-detail.entity';
import { Facility } from '../facilities/entities/facility.entity';
import { Equipment } from '../equipments/entities/equipment.entity';
import { BookingGroup } from './entities/booking-group.entity';
import { BookingStatus } from './../../common/enums/db-enums';
import { NotificationsService } from '../notifications/notifications.service';

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
        private readonly notificationsService: NotificationsService,
    ) { }

    async onModuleInit() {
        // Schema is now defined in database/init.sql
        // This is only for backward compatibility with existing databases
        try {
            // Add columns if they don't exist (for databases created before schema update)
            await this.dataSource.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurrence_group_id UUID;`);
            await this.dataSource.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;`);
            await this.dataSource.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;`);
            await this.dataSource.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS parent_booking_id INT REFERENCES bookings(booking_id) ON DELETE SET NULL;`);

            // Master-Detail Pattern for Recurring
            await this.dataSource.query(`
                CREATE TABLE IF NOT EXISTS booking_groups (
                    group_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
                    facility_id INT REFERENCES facilities(facility_id),
                    recurrence_pattern VARCHAR(100),
                    total_amount DECIMAL(15, 2) DEFAULT 0,
                    status VARCHAR(20) DEFAULT 'PENDING',
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
            `);
            await this.dataSource.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS group_id INT REFERENCES booking_groups(group_id) ON DELETE SET NULL;`);
            await this.dataSource.query(`ALTER TABLE facilities ADD COLUMN IF NOT EXISTS min_cancellation_hours INT DEFAULT 1;`);

            // Add enum values if they don't exist (for databases created before schema update)
            const enumValues = ['RESCHEDULED', 'CONFIRMED', 'IN_USE', 'ADMIN_HOLD', 'REVIEW_REQUIRED', 'WAITING_PAYMENT', 'PENDING_RESCHEDULE'];
            for (const val of enumValues) {
                try {
                    await this.dataSource.query(`ALTER TYPE booking_status ADD VALUE IF NOT EXISTS '${val}';`);
                } catch (e) {
                    // Ignore if already exists
                }
            }
        } catch (error) {
            console.error("Failed to update database schema:", error);
        }
    }

    private getSlotTime(date: string, slot: number): { start: Date; end: Date } {
        const startHour = 7 + (slot - 1);
        const startTimeResult = new Date(date);
        startTimeResult.setHours(startHour, 0, 0, 0);
        const endTimeResult = new Date(startTimeResult);
        endTimeResult.setMinutes(endTimeResult.getMinutes() + 50);
        return { start: startTimeResult, end: endTimeResult };
    }

    private async _createBookingTransaction(manager: EntityManager, userId: number, createBookingDto: CreateBookingDto): Promise<Booking[]> {
        const { facility_id, purpose, booking_date, start_slot, end_slot, booking_type, equipment_items, recurrence_type, recurrence_end_date } = createBookingDto;

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

        let savedGroup: BookingGroup | null = null;
        if (datesToBook.length > 1) {
            const group = new BookingGroup();
            group.userId = userId;
            group.facilityId = facility_id;
            group.recurrencePattern = recurrence_type;
            group.status = BookingStatus.WAITING_PAYMENT;
            savedGroup = await manager.save(BookingGroup, group);
        }

        if (start_slot > end_slot) {
            throw new BadRequestException('Start slot must be before or equal to End slot');
        }

        const facility = await manager.findOne(Facility, { where: { facilityId: facility_id } });
        if (!facility) {
            throw new NotFoundException(`Facility with ID ${facility_id} not found`);
        }

        let itemsToBook: { equipmentId: number, quantity: number, price: number }[] = [];
        let totalEquipmentCost = 0;

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
                const itemPrice = Number(eq.rentalPrice || 0);
                const itemTotal = itemPrice * item.quantity;
                totalEquipmentCost += itemTotal;
                itemsToBook.push({
                    equipmentId: item.equipment_id,
                    quantity: item.quantity,
                    price: itemPrice
                });
            }
        }

        // Calculate Facility Cost
        const slotDuration = end_slot - start_slot + 1;
        let facilityCost = 0;
        const fPrice = Number(facility.price || 0);

        // Using string comparison for enum to avoid import issues if enum isn't available in scope
        if (facility.priceType === 'PER_BOOKING' || facility.priceType === 'ONE_TIME') {
            facilityCost = fPrice;
        } else {
            // Default to PER_HOUR / PER_SLOT
            facilityCost = fPrice * slotDuration;
        }

        const totalBookingAmount = facilityCost + totalEquipmentCost;

        const resultBookings: Booking[] = [];

        for (const date of datesToBook) {
            const dateString = date.toISOString().split('T')[0];
            const firstSlot = this.getSlotTime(dateString, start_slot);
            const lastSlot = this.getSlotTime(dateString, end_slot);

            const checkInTime = firstSlot.start;
            const checkOutTime = lastSlot.end;

            const overlap = await manager.findOne(Booking, {
                where: {
                    facilityId: facility_id,
                    status: In([BookingStatus.APPROVED, BookingStatus.CONFIRMED, BookingStatus.WAITING_PAYMENT, BookingStatus.IN_USE]), // Check waiting payment too to avoid double book
                    checkInTime: LessThan(checkOutTime),
                    checkOutTime: MoreThan(checkInTime),
                },
            });

            if (overlap) {
                // If checking overlap yourself, ignore your own group? currently no group id in creating
                throw new ConflictException(`Phòng đã có người đặt vào ngày ${dateString} trong khung giờ này.`);
            }

            const booking = new Booking();
            booking.userId = userId;
            booking.facilityId = facility_id;
            booking.purpose = purpose;
            booking.bookingType = booking_type;
            booking.checkInTime = checkInTime;
            booking.checkOutTime = checkOutTime;
            booking.totalAmount = totalBookingAmount;

            if (savedGroup) {
                booking.group = savedGroup;
                booking.status = BookingStatus.WAITING_PAYMENT;
            } else {
                // Single booking
                if (createBookingDto.status && facility.managerId === userId) {
                    booking.status = createBookingDto.status;
                } else {
                    // Start as PENDING normally
                    booking.status = BookingStatus.PENDING;
                    // If we wanted single bookings to also be upfront pay:
                    // if (totalBookingAmount > 0) booking.status = BookingStatus.WAITING_PAYMENT;
                }
            }

            const savedBooking = await manager.save(Booking, booking);

            if (itemsToBook.length > 0) {
                const details = itemsToBook.map(item => {
                    const det = new BookingDetail();
                    det.bookingId = savedBooking.bookingId;
                    det.equipmentId = item.equipmentId;
                    det.quantity = item.quantity;
                    det.bookedPrice = item.price;
                    return det;
                });
                await manager.save(BookingDetail, details);
            }
            resultBookings.push(savedBooking);
        }

        if (savedGroup) {
            // Update total amount for the group
            await manager.query(
                `UPDATE booking_groups SET total_amount = (SELECT SUM(total_amount) FROM bookings WHERE group_id = $1) WHERE group_id = $1`,
                [savedGroup.groupId]
            );
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

            const finalBooking = await this.bookingsRepository.findOne({
                where: { bookingId: resultBookings[0].bookingId },
                relations: ['details', 'facility'],
            });

            if (finalBooking) {
                await this.notificationsService.send(userId, 'Booking Received', `Booking for ${finalBooking.facility?.name} is pending approval.`);
                if (finalBooking.facility?.managerId) {
                    await this.notificationsService.sendAll(finalBooking.facility.managerId, 'New Booking Request', `New booking request for ${finalBooking.facility.name} needs approval.`);
                }
            }
            return finalBooking;

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

    /**
     * Fork-based Reschedule Flow:
     * 1. Only CONFIRMED bookings can be rescheduled
     * 2. Creates a new booking with PENDING_RESCHEDULE status
     * 3. Links new booking to original via parentBookingId
     * 4. Original booking stays CONFIRMED
     * 5. Manager approves/rejects the reschedule request separately
     */
    async reschedule(oldBookingId: number, userId: number, createBookingDto: CreateBookingDto) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const oldBooking = await queryRunner.manager.findOne(Booking, {
                where: { bookingId: oldBookingId, userId },
                relations: ['facility'],
            });
            if (!oldBooking) throw new NotFoundException(`Booking #${oldBookingId} not found`);

            // Only CONFIRMED bookings can be rescheduled
            if (oldBooking.status !== BookingStatus.CONFIRMED) {
                throw new BadRequestException(`Only CONFIRMED bookings can be rescheduled. Current status: ${oldBooking.status}. Please cancel and create a new booking instead.`);
            }

            // Check if there's already a pending reschedule for this booking
            const existingReschedule = await queryRunner.manager.findOne(Booking, {
                where: { parentBookingId: oldBookingId, status: BookingStatus.PENDING_RESCHEDULE }
            });
            if (existingReschedule) {
                throw new BadRequestException(`A reschedule request for this booking is already pending (Booking #${existingReschedule.bookingId}).`);
            }

            // Create new booking as PENDING_RESCHEDULE (fork)
            const { facility_id, purpose, booking_date, start_slot, end_slot, booking_type, equipment_items } = createBookingDto;

            const dateString = booking_date;
            const firstSlot = this.getSlotTime(dateString, start_slot);
            const lastSlot = this.getSlotTime(dateString, end_slot);

            const rescheduleBooking = new Booking();
            rescheduleBooking.userId = userId;
            rescheduleBooking.facilityId = facility_id;
            rescheduleBooking.purpose = purpose;
            rescheduleBooking.bookingType = booking_type;
            rescheduleBooking.checkInTime = firstSlot.start;
            rescheduleBooking.checkOutTime = lastSlot.end;
            rescheduleBooking.status = BookingStatus.PENDING_RESCHEDULE;
            rescheduleBooking.parentBookingId = oldBookingId; // Link to original

            const savedBooking = await queryRunner.manager.save(Booking, rescheduleBooking);

            // Handle equipment if any
            if (equipment_items && equipment_items.length > 0) {
                const BookingDetail = (await import('./entities/booking-detail.entity')).BookingDetail;
                const details = equipment_items.map(item => {
                    const det = new BookingDetail();
                    det.bookingId = savedBooking.bookingId;
                    det.equipmentId = item.equipment_id;
                    det.quantity = item.quantity;
                    det.bookedPrice = 0;
                    return det;
                });
                await queryRunner.manager.save(details);
            }

            await queryRunner.commitTransaction();
            const final = await this.bookingsRepository.findOne({
                where: { bookingId: savedBooking.bookingId },
                relations: ['details', 'parentBooking', 'facility'],
            });

            if (final) {
                await this.notificationsService.send(userId, 'Reschedule Requested', `Reschedule request for ${final.facility?.name} submitted.`);
                if (final.facility?.managerId) {
                    await this.notificationsService.sendAll(final.facility.managerId, 'New Reschedule Request', `A reschedule request for ${final.facility.name} needs review.`);
                }
            }
            return final;
        } catch (err) {
            await queryRunner.rollbackTransaction();
            if (err.code === '23P01') throw new ConflictException('Xung đột lịch đặt phòng.');
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Approve Reschedule Request:
     * 1. Original booking → RESCHEDULED
     * 2. New booking → CONFIRMED (or WAITING_PAYMENT if paid facility)
     */
    async approveReschedule(rescheduleBookingId: number, managerId: number) {
        const rescheduleBooking = await this.bookingsRepository.findOne({
            where: { bookingId: rescheduleBookingId },
            relations: ['facility', 'parentBooking'],
        });

        if (!rescheduleBooking) throw new NotFoundException(`Booking #${rescheduleBookingId} not found`);
        if (rescheduleBooking.status !== BookingStatus.PENDING_RESCHEDULE) {
            throw new BadRequestException(`Booking must be PENDING_RESCHEDULE to approve. Current: ${rescheduleBooking.status}`);
        }
        if (!rescheduleBooking.parentBookingId) {
            throw new BadRequestException(`This booking is not a reschedule request (no parent booking).`);
        }

        // Check for time conflicts with confirmed bookings
        const conflict = await this.bookingsRepository.findOne({
            where: {
                facilityId: rescheduleBooking.facilityId,
                status: In([BookingStatus.APPROVED, BookingStatus.WAITING_PAYMENT, BookingStatus.CONFIRMED]),
                checkInTime: LessThan(rescheduleBooking.checkOutTime),
                checkOutTime: MoreThan(rescheduleBooking.checkInTime),
                bookingId: Not(rescheduleBooking.bookingId)
            }
        });

        if (conflict && conflict.bookingId !== rescheduleBooking.parentBookingId) {
            throw new ConflictException(`Facility is already booked during this time (Booking #${conflict.bookingId}).`);
        }

        // Use transaction to ensure atomicity
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Update original booking to RESCHEDULED
            const originalBooking = await queryRunner.manager.findOne(Booking, {
                where: { bookingId: rescheduleBooking.parentBookingId }
            });
            if (originalBooking) {
                originalBooking.status = BookingStatus.RESCHEDULED;
                await queryRunner.manager.save(originalBooking);
            }

            // Check if facility is free or paid
            const facilityPrice = parseFloat(rescheduleBooking.facility.price?.toString() || '0');
            if (facilityPrice === 0) {
                rescheduleBooking.status = BookingStatus.CONFIRMED;
            } else {
                rescheduleBooking.status = BookingStatus.WAITING_PAYMENT;
            }

            const result = await queryRunner.manager.save(rescheduleBooking);
            await queryRunner.commitTransaction();

            await this.notificationsService.sendAll(result.userId, 'Reschedule Approved', `Your reschedule request for ${rescheduleBooking.facility?.name} has been approved.`);

            return result;
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Reject Reschedule Request:
     * 1. New booking → REJECTED
     * 2. Original booking stays CONFIRMED
     */
    async rejectReschedule(rescheduleBookingId: number, managerId: number, reason: string) {
        const rescheduleBooking = await this.bookingsRepository.findOne({
            where: { bookingId: rescheduleBookingId },
            relations: ['facility'],
        });

        if (!rescheduleBooking) throw new NotFoundException(`Booking #${rescheduleBookingId} not found`);
        if (rescheduleBooking.status !== BookingStatus.PENDING_RESCHEDULE) {
            throw new BadRequestException(`Booking must be PENDING_RESCHEDULE to reject. Current: ${rescheduleBooking.status}`);
        }

        rescheduleBooking.status = BookingStatus.REJECTED;
        rescheduleBooking.cancellationReason = reason || 'Reschedule request rejected by manager';
        rescheduleBooking.cancelledAt = new Date();

        const saved = await this.bookingsRepository.save(rescheduleBooking);
        await this.notificationsService.sendAll(saved.userId, 'Reschedule Rejected', `Reschedule request rejected. Reason: ${saved.cancellationReason}`);
        return saved;
    }

    async findAll(userId: number) {
        return this.bookingsRepository.find({
            where: {
                userId,
                status: Not(BookingStatus.RESCHEDULED),
            },
            relations: ['facility', 'details', 'details.equipment', 'group'],
            order: { checkInTime: 'DESC' },
        });
    }

    async cancel(id: number, userId: number, reason: string) {
        const booking = await this.bookingsRepository.findOne({
            where: { bookingId: id },
            relations: ['facility'],
        });

        if (!booking) {
            throw new NotFoundException(`Booking #${id} not found`);
        }

        // Check permissions: Owner or Facility Manager
        const isOwner = booking.userId === userId;
        const isManager = booking.facility.managerId === userId;

        if (!isOwner && !isManager) {
            throw new NotFoundException(`Booking #${id} not found or access denied`);
        }

        if (booking.status === BookingStatus.CANCELLED) {
            throw new BadRequestException(`Booking #${id} is already cancelled`);
        }

        if (!isManager && (booking.status === BookingStatus.COMPLETED || booking.status === BookingStatus.REJECTED)) {
            throw new BadRequestException(`Cannot cancel booking with status ${booking.status}`);
        }

        // Time check - skipped for Manager
        if (!isManager) {
            const now = new Date();
            const minHours = booking.facility.minCancellationHours || 0;
            const timeDiff = booking.checkInTime.getTime() - now.getTime();
            const minDiff = minHours * 60 * 60 * 1000;

            if (timeDiff < minDiff) {
                throw new BadRequestException(`Cancellation deadline passed. Must cancel ${minHours} hours in advance.`);
            }
        }

        booking.status = BookingStatus.CANCELLED;
        booking.cancellationReason = reason;
        booking.cancelledAt = new Date();
        const cancelledBooking = await this.bookingsRepository.save(booking);

        if (!isManager && cancelledBooking.facility?.managerId) {
            await this.notificationsService.send(cancelledBooking.facility.managerId, 'Booking Cancelled', `Booking #${cancelledBooking.bookingId} for ${cancelledBooking.facility.name} was cancelled by user.`);
        }
        return cancelledBooking;
    }

    async approve(id: number, managerId: number) {
        const booking = await this.bookingsRepository.findOne({
            where: { bookingId: id },
            relations: ['facility'],
        });

        if (!booking) throw new NotFoundException(`Booking #${id} not found`);

        // Simple check: In real app, verify managerId manages booking.facilityId
        // const facility = await this.facilityRepository.findOne({ where: { facilityId: booking.facilityId, managerId } });
        // if (!facility) throw new ForbiddenException("Not authorized to manage this booking");

        if (booking.status !== BookingStatus.PENDING) {
            throw new BadRequestException(`Booking must be PENDING to approve. Current: ${booking.status}`);
        }

        // Check for double booking (Race condition check)
        const conflict = await this.bookingsRepository.findOne({
            where: {
                facilityId: booking.facilityId,
                status: In([BookingStatus.APPROVED, BookingStatus.WAITING_PAYMENT, BookingStatus.CONFIRMED]),
                checkInTime: LessThan(booking.checkOutTime),
                checkOutTime: MoreThan(booking.checkInTime),
                bookingId: Not(booking.bookingId)
            }
        });

        if (conflict) {
            throw new ConflictException(`Facility is already booked during this time.`);
        }

        // Check if facility is free (price = 0) or requires payment
        const facilityPrice = parseFloat(booking.facility.price?.toString() || '0');

        if (facilityPrice === 0) {
            // Free facility - go directly to CONFIRMED
            booking.status = BookingStatus.CONFIRMED;
        } else {
            // Paid facility - go to WAITING_PAYMENT
            booking.status = BookingStatus.WAITING_PAYMENT;
        }

        const saved = await this.bookingsRepository.save(booking);
        await this.notificationsService.sendAll(
            saved.userId,
            `Booking ${saved.status === BookingStatus.CONFIRMED ? 'Confirmed' : 'Approved'}`,
            `Your booking for ${saved.facility.name} is now ${saved.status}.`
        );
        return saved;
    }

    async confirmPayment(id: number, userId: number) {
        const booking = await this.bookingsRepository.findOne({
            where: { bookingId: id },
            relations: ['facility', 'group'],
        });

        if (!booking) throw new NotFoundException(`Booking #${id} not found`);

        // Only booking owner or facility manager can confirm payment
        const isOwner = booking.userId === userId;
        const isManager = booking.facility.managerId === userId;

        if (!isOwner && !isManager) {
            throw new BadRequestException(`Not authorized to confirm payment for this booking`);
        }

        if (booking.status !== BookingStatus.WAITING_PAYMENT) {
            throw new BadRequestException(`Booking must be WAITING_PAYMENT to confirm payment. Current: ${booking.status}`);
        }

        if (booking.groupId) {
            // Confirm ENTIRE Group
            await this.dataSource.manager.update(BookingGroup, { groupId: booking.groupId }, { status: BookingStatus.CONFIRMED });

            // Confirm ALL bookings in group
            await this.bookingsRepository.update({ groupId: booking.groupId }, { status: BookingStatus.CONFIRMED });

            // Reload for notification/return
            booking.status = BookingStatus.CONFIRMED;
            // Note: effectively simplified, but correct.
        } else {
            booking.status = BookingStatus.CONFIRMED;
            await this.bookingsRepository.save(booking);
        }

        // Notify Student
        await this.notificationsService.send(booking.userId, 'Payment Successful', `Your booking (and any recurring ones) for ${booking.facility.name} is now CONFIRMED.`);

        // Notify Manager if they didn't trigger it
        if (booking.facility?.managerId && booking.facility.managerId !== userId) {
            await this.notificationsService.send(booking.facility.managerId, 'Payment Confirmed', `Payment for booking #${booking.bookingId} confirmed.`);
        }

        return booking;
    }

    async reject(id: number, managerId: number, reason: string) {
        const booking = await this.bookingsRepository.findOne({
            where: { bookingId: id },
            relations: ['facility'],
        });

        if (!booking) throw new NotFoundException(`Booking #${id} not found`);

        if (booking.status === BookingStatus.REJECTED || booking.status === BookingStatus.CANCELLED) {
            throw new BadRequestException(`Booking is already ${booking.status}`);
        }

        booking.status = BookingStatus.REJECTED;
        booking.cancellationReason = reason; // Reusing field for manager rejection reason
        booking.cancelledAt = new Date();

        const saved = await this.bookingsRepository.save(booking);
        await this.notificationsService.sendAll(
            saved.userId,
            'Booking Rejected',
            `Your booking for ${saved.facility.name} was rejected. Reason: ${reason}`
        );
        return saved;
    }

    async findByFacility(facilityId: number) {
        return this.bookingsRepository.find({
            where: {
                facilityId,
                status: In([
                    BookingStatus.APPROVED,
                    BookingStatus.PENDING,
                    BookingStatus.WAITING_PAYMENT,
                    BookingStatus.PENDING_RESCHEDULE,
                    BookingStatus.CONFIRMED,
                    BookingStatus.IN_USE,
                    BookingStatus.ADMIN_HOLD
                ])
            },
            relations: ['user', 'details', 'details.equipment'],
            order: { checkInTime: 'ASC' }
        });
    }

    async getManagerStats(managerId: number) {
        const facilities = await this.facilityRepository.find({ where: { managerId } });
        const facilityIds = facilities.map(f => f.facilityId);
        if (facilityIds.length === 0) return { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 };

        const stats = await this.bookingsRepository
            .createQueryBuilder("booking")
            .select("booking.status", "status")
            .addSelect("COUNT(booking.bookingId)", "count")
            .where("booking.facilityId IN (:...ids)", { ids: facilityIds })
            .groupBy("booking.status")
            .getRawMany();

        const result = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 };
        stats.forEach(s => {
            result[s.status] = parseInt(s.count);
        });
        return result;
    }

    async getManagerBookings(
        managerId: number,
        status?: BookingStatus,
        page: number = 1,
        limit: number = 10,
        bookingType?: string,
        facilityId?: number,
        date?: string
    ) {
        const facilities = await this.facilityRepository.find({ where: { managerId } });
        const facilityIds = facilities.map(f => f.facilityId);
        if (facilityIds.length === 0) return { data: [], total: 0, page, lastPage: 0 };

        // Build where condition
        const qb = this.bookingsRepository.createQueryBuilder('booking')
            .leftJoinAndSelect('booking.facility', 'facility')
            .leftJoinAndSelect('booking.user', 'user')
            .leftJoinAndSelect('booking.details', 'details')
            .where('booking.facilityId IN (:...facilityIds)', { facilityIds });

        // Status filter
        if (status) {
            if (Array.isArray(status)) {
                qb.andWhere('booking.status IN (:...statuses)', { statuses: status });
            } else {
                qb.andWhere('booking.status = :status', { status });
            }
        }

        // Booking type filter
        if (bookingType && bookingType !== 'ALL') {
            qb.andWhere('booking.bookingType = :bookingType', { bookingType });
        }

        // Specific facility filter (override manager's facility list)
        if (facilityId) {
            // Make sure the facility is in manager's list
            if (facilityIds.includes(facilityId)) {
                qb.andWhere('booking.facilityId = :facilityId', { facilityId });
            }
        }

        // Date filter
        if (date) {
            // Filter bookings where checkInTime is on the specified date
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            qb.andWhere('booking.checkInTime >= :startOfDay', { startOfDay });
            qb.andWhere('booking.checkInTime <= :endOfDay', { endOfDay });
        }

        // Ordering and pagination
        qb.orderBy('booking.checkInTime', 'ASC')
            .skip((page - 1) * limit)
            .take(limit);

        const [data, total] = await qb.getManyAndCount();

        return { data, total, page, lastPage: Math.ceil(total / limit) };
    }
}