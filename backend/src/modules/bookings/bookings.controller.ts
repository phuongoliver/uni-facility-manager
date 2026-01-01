import { Controller, Post, Body, Req, Get, Delete, Param, ParseIntPipe } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) { }

  @Post()
  async create(@Body() createBookingDto: CreateBookingDto, @Req() req: any) {
    // TODO: Integrate with AuthGuard to get real userId
    // For Vertical Slice demo, we create a booking for the first User (Student) or Admin.
    // Assuming User ID 1 exists (Seed Data: 'Nguyen Van A').
    const userId = 1;

    return await this.bookingsService.create(userId, createBookingDto);
  }

  @Get()
  async findAll(@Req() req: any) {
    // Mock user ID 1
    const userId = 1;
    return await this.bookingsService.findAll(userId);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    // Mock user ID 1
    const userId = 1;
    return await this.bookingsService.cancel(id, userId);
  }

  @Get('facility/:id')
  async findByFacility(@Param('id', ParseIntPipe) id: number) {
    return await this.bookingsService.findByFacility(id);
  }

  @Post('reschedule')
  async reschedule(@Body() body: { oldBookingId: number, newBookingData: CreateBookingDto }, @Req() req: any) {
    const userId = 1; // Mock user ID
    return await this.bookingsService.reschedule(body.oldBookingId, userId, body.newBookingData);
  }
}