import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Headers as HttpHeaders,
  Body,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Initiate payment for a booking
   * POST /api/payments/initiate
   */
  @Post("initiate")
  async initiatePayment(
    @Body("bookingId") bookingId: number,
    @HttpHeaders("x-user-id") userIdHeader: string,
  ) {
    const userId = userIdHeader ? parseInt(userIdHeader) : 1;
    return await this.paymentsService.initiatePayment(bookingId, userId);
  }

  /**
   * Payment success callback (from BKPay)
   * GET /api/payments/callback/success
   */
  @Get("callback/success")
  async successCallback(
    @Query("transaction_ref") transactionRef: string,
    @Query("signature") signature: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.paymentsService.handleSuccessCallback(
        transactionRef,
        signature,
      );
      // Redirect to frontend success page
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return res.redirect(
        `${frontendUrl}/my-bookings?payment=success&booking=${result.bookingId}`,
      );
    } catch (error) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return res.redirect(
        `${frontendUrl}/my-bookings?payment=error&message=${encodeURIComponent(error.message)}`,
      );
    }
  }

  /**
   * Payment cancel callback (from BKPay)
   * GET /api/payments/callback/cancel
   */
  @Get("callback/cancel")
  async cancelCallback(
    @Query("transaction_ref") transactionRef: string,
    @Res() res: Response,
  ) {
    try {
      const result =
        await this.paymentsService.handleCancelCallback(transactionRef);
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return res.redirect(
        `${frontendUrl}/my-bookings?payment=cancelled&booking=${result.bookingId}`,
      );
    } catch (error) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return res.redirect(`${frontendUrl}/my-bookings?payment=error`);
    }
  }

  /**
   * Check payment status (for polling)
   * GET /api/payments/status/:transactionRef
   */
  @Get("status/:transactionRef")
  async checkPaymentStatus(@Param("transactionRef") transactionRef: string) {
    return await this.paymentsService.checkPaymentStatus(transactionRef);
  }

  /**
   * Simulate payment completion (for demo/testing)
   * POST /api/payments/simulate-complete
   */
  @Post("simulate-complete")
  async simulateComplete(@Body("transactionRef") transactionRef: string) {
    return await this.paymentsService.simulatePaymentComplete(transactionRef);
  }
}
