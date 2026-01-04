import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as crypto from "crypto";
import { Booking } from "../bookings/entities/booking.entity";
import { BookingGroup } from "../bookings/entities/booking-group.entity";
import { BookingStatus } from "../../common/enums/db-enums";

export interface BKPayRequest {
  merchant_id: string;
  transaction_ref: string;
  amount: number;
  currency: string;
  order_info: string;
  user_id: string;
  return_url: string;
  cancel_url: string;
  timestamp: string;
  signature: string;
}

export interface BKPayResponse {
  success: boolean;
  payment_url?: string;
  qr_code_data?: string;
  transaction_ref: string;
  expires_at: string;
  message?: string;
}

@Injectable()
export class PaymentsService {
  private readonly MERCHANT_ID = "HCMUT_FACILITY_SYSTEM";
  private readonly SECRET_KEY = "bkpay_secret_key_demo_2026"; // In real app, use env variable
  private readonly BASE_URL = process.env.APP_URL || "http://localhost:3500";

  // Store pending transactions (in real app, use database)
  private pendingTransactions: Map<
    string,
    { bookingId: number; expires: Date; amount: number }
  > = new Map();

  constructor(
    @InjectRepository(Booking)
    private bookingsRepository: Repository<Booking>,
  ) { }

  /**
   * Generate unique transaction reference
   */
  private generateTransactionRef(bookingId: number): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `BOOK_${dateStr}_${bookingId}_${random}`;
  }

  /**
   * Generate HMAC-SHA256 signature
   */
  private generateSignature(payload: object): string {
    const sortedPayload = Object.keys(payload)
      .sort()
      .reduce(
        (acc, key) => {
          acc[key] = payload[key];
          return acc;
        },
        {} as Record<string, any>,
      );

    const dataString = JSON.stringify(sortedPayload);
    return crypto
      .createHmac("sha256", this.SECRET_KEY)
      .update(dataString)
      .digest("hex");
  }

  /**
   * Initiate payment - simulates BKPay API call
   */
  async initiatePayment(
    bookingId: number,
    userId: number,
  ): Promise<BKPayResponse> {
    const booking = await this.bookingsRepository.findOne({
      where: { bookingId },
      relations: ["facility", "user", "group"],
    });

    if (!booking) {
      throw new NotFoundException(`Booking #${bookingId} not found`);
    }

    if (booking.userId !== userId) {
      throw new BadRequestException(
        "You are not authorized to pay for this booking",
      );
    }

    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        `Booking must be PENDING_PAYMENT to initiate payment. Current: ${booking.status}`,
      );
    }

    const transactionRef = this.generateTransactionRef(bookingId);
    let amount = parseFloat(booking.totalAmount?.toString() || "0");
    if (booking.group) {
      amount = parseFloat(booking.group.totalAmount?.toString() || "0");
    }
    const timestamp = new Date().toISOString();

    // Build BKPay request payload
    const payload: Omit<BKPayRequest, "signature"> = {
      merchant_id: this.MERCHANT_ID,
      transaction_ref: transactionRef,
      amount: amount,
      currency: "VND",
      order_info: `Rental Fee: ${booking.facility.name} (Booking #${bookingId})`,
      user_id: userId.toString(),
      return_url: `${this.BASE_URL}/api/payments/callback/success`,
      cancel_url: `${this.BASE_URL}/api/payments/callback/cancel`,
      timestamp: timestamp,
    };

    const signature = this.generateSignature(payload);
    const fullPayload: BKPayRequest = { ...payload, signature };

    // Store transaction for later verification
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    this.pendingTransactions.set(transactionRef, {
      bookingId,
      expires: expiresAt,
      amount,
    });

    // MOCK: In real implementation, this would call BKPay API
    // For demo, we simulate BKPay response with QR code data
    const qrCodeData = JSON.stringify({
      type: "BKPAY_QR",
      transaction_ref: transactionRef,
      amount: amount,
      merchant: this.MERCHANT_ID,
      expires: expiresAt.toISOString(),
    });

    console.log("BKPay Request:", fullPayload);

    return {
      success: true,
      payment_url: `https://sandbox.bkpay.vn/pay/${transactionRef}`,
      qr_code_data: qrCodeData,
      transaction_ref: transactionRef,
      expires_at: expiresAt.toISOString(),
    };
  }

  /**
   * Handle successful payment callback
   */
  async handleSuccessCallback(
    transactionRef: string,
    _signature?: string,
  ): Promise<{ success: boolean; bookingId: number; message: string }> {
    const transaction = this.pendingTransactions.get(transactionRef);

    if (!transaction) {
      throw new BadRequestException(
        `Transaction ${transactionRef} not found or expired`,
      );
    }

    if (new Date() > transaction.expires) {
      this.pendingTransactions.delete(transactionRef);
      throw new BadRequestException(
        `Transaction ${transactionRef} has expired`,
      );
    }

    // Update booking status to CONFIRMED
    const booking = await this.bookingsRepository.findOne({
      where: { bookingId: transaction.bookingId },
      relations: ["group"],
    });

    if (!booking) {
      throw new NotFoundException(`Booking not found`);
    }

    if (booking.groupId) {
      // Confirm Group
      await this.bookingsRepository.manager.update(
        BookingGroup,
        { groupId: booking.groupId },
        { status: BookingStatus.CONFIRMED },
      );
      // Confirm All
      await this.bookingsRepository.update(
        { groupId: booking.groupId },
        { status: BookingStatus.CONFIRMED },
      );
      booking.status = BookingStatus.CONFIRMED;
    } else {
      booking.status = BookingStatus.CONFIRMED;
      await this.bookingsRepository.save(booking);
    }

    // Clean up transaction
    this.pendingTransactions.delete(transactionRef);

    return {
      success: true,
      bookingId: transaction.bookingId,
      message: "Payment successful. Your booking is now confirmed.",
    };
  }

  /**
   * Handle cancelled payment callback
   */
  async handleCancelCallback(
    transactionRef: string,
  ): Promise<{ success: boolean; bookingId: number; message: string }> {
    const transaction = this.pendingTransactions.get(transactionRef);

    if (!transaction) {
      throw new BadRequestException(
        `Transaction ${transactionRef} not found or expired`,
      );
    }

    // Clean up transaction but don't change booking status
    this.pendingTransactions.delete(transactionRef);

    return {
      success: true,
      bookingId: transaction.bookingId,
      message: "Payment cancelled. Your booking is still pending payment.",
    };
  }

  /**
   * Check payment status (for polling)
   */
  async checkPaymentStatus(transactionRef: string): Promise<{
    status: "pending" | "completed" | "expired" | "not_found";
    bookingId?: number;
  }> {
    const transaction = this.pendingTransactions.get(transactionRef);

    if (!transaction) {
      return { status: "not_found" };
    }

    if (new Date() > transaction.expires) {
      this.pendingTransactions.delete(transactionRef);
      return { status: "expired", bookingId: transaction.bookingId };
    }

    // Check if booking is already confirmed (payment completed)
    const booking = await this.bookingsRepository.findOne({
      where: { bookingId: transaction.bookingId },
    });

    if (booking?.status === BookingStatus.CONFIRMED) {
      this.pendingTransactions.delete(transactionRef);
      return { status: "completed", bookingId: transaction.bookingId };
    }

    return { status: "pending", bookingId: transaction.bookingId };
  }

  /**
   * Simulate payment completion (for demo/testing)
   */
  async simulatePaymentComplete(
    transactionRef: string,
  ): Promise<{ success: boolean; message: string }> {
    return await this.handleSuccessCallback(transactionRef);
  }
}
