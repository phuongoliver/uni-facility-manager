import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseIntPipe,
  Headers as HttpHeaders,
  Query,
} from "@nestjs/common";
import { BookingsService } from "./bookings.service";
import { CreateBookingDto } from "./dto/create-booking.dto";

@Controller("bookings")
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  async create(
    @Body() createBookingDto: CreateBookingDto,
    @HttpHeaders("x-user-id") userIdHeader: string,
  ) {
    // Integrate with "Mock Auth" from frontend
    // Frontend sends 'x-user-id' header
    const userId = userIdHeader ? parseInt(userIdHeader) : 1;
    return await this.bookingsService.create(userId, createBookingDto);
  }

  @Get()
  async findAll(@HttpHeaders("x-user-id") userIdHeader: string) {
    const userId = userIdHeader ? parseInt(userIdHeader) : 1;
    return await this.bookingsService.findAll(userId);
  }

  @Post(":id/cancel")
  async cancel(
    @Param("id", ParseIntPipe) id: number,
    @Body("reason") reason: string,
    @HttpHeaders("x-user-id") userIdHeader: string,
  ) {
    const userId = userIdHeader ? parseInt(userIdHeader) : 1;
    if (!reason) reason = "No reason provided";
    return await this.bookingsService.cancel(id, userId, reason);
  }

  @Post(":id/approve")
  async approve(
    @Param("id", ParseIntPipe) id: number,
    @HttpHeaders("x-user-id") userIdHeader: string,
  ) {
    const managerId = userIdHeader ? parseInt(userIdHeader) : 1;
    return await this.bookingsService.approve(id, managerId);
  }

  @Post(":id/reject")
  async reject(
    @Param("id", ParseIntPipe) id: number,
    @Body("reason") reason: string,
    @HttpHeaders("x-user-id") userIdHeader: string,
  ) {
    const managerId = userIdHeader ? parseInt(userIdHeader) : 1;
    if (!reason) reason = "Rejected by manager";
    return await this.bookingsService.reject(id, managerId, reason);
  }

  @Post(":id/confirm-payment")
  async confirmPayment(
    @Param("id", ParseIntPipe) id: number,
    @HttpHeaders("x-user-id") userIdHeader: string,
  ) {
    const userId = userIdHeader ? parseInt(userIdHeader) : 1;
    return await this.bookingsService.confirmPayment(id, userId);
  }

  @Get("facility/:id")
  async findByFacility(@Param("id", ParseIntPipe) id: number) {
    return await this.bookingsService.findByFacility(id);
  }

  @Get("manager/stats")
  async getManagerStats(@Query("managerId") managerId: string) {
    if (!managerId) return {};
    return await this.bookingsService.getManagerStats(+managerId);
  }

  @Get("manager")
  async getManagerBookings(
    @Query("managerId") managerId: string,
    @Query("status") status: any,
    @Query("bookingType") bookingType: string,
    @Query("facilityId") facilityId: string,
    @Query("date") date: string,
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
  ) {
    if (!managerId) return { data: [], total: 0 };
    return await this.bookingsService.getManagerBookings(
      +managerId,
      status,
      +page,
      +limit,
      bookingType,
      facilityId ? +facilityId : undefined,
      date,
    );
  }

  @Post("reschedule")
  async reschedule(
    @Body() body: { oldBookingId: number; newBookingData: CreateBookingDto },
    @HttpHeaders("x-user-id") userIdHeader: string,
  ) {
    const userId = userIdHeader ? parseInt(userIdHeader) : 1;
    return await this.bookingsService.reschedule(
      body.oldBookingId,
      userId,
      body.newBookingData,
    );
  }

  @Post(":id/approve-reschedule")
  async approveReschedule(
    @Param("id", ParseIntPipe) id: number,
    @HttpHeaders("x-user-id") userIdHeader: string,
  ) {
    const managerId = userIdHeader ? parseInt(userIdHeader) : 1;
    return await this.bookingsService.approveReschedule(id, managerId);
  }

  @Post(":id/reject-reschedule")
  async rejectReschedule(
    @Param("id", ParseIntPipe) id: number,
    @Body("reason") reason: string,
    @HttpHeaders("x-user-id") userIdHeader: string,
  ) {
    const managerId = userIdHeader ? parseInt(userIdHeader) : 1;
    return await this.bookingsService.rejectReschedule(
      id,
      managerId,
      reason || "Reschedule request rejected",
    );
  }
}
