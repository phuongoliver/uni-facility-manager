import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { Booking } from './entities/booking.entity';
import { BookingDetail } from './entities/booking-detail.entity';
import { Facility } from '../facilities/entities/facility.entity';
import { Equipment } from '../equipments/entities/equipment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, BookingDetail, Facility, Equipment])],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule { }