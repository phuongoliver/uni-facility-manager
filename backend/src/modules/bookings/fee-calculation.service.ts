import { Injectable } from '@nestjs/common';

@Injectable()
export class FeeCalculationService {
    /**
     * Calculates the total fee for a booking.
     * 
     * @param hours Number of hours booked (must be non-negative)
     * @param hourlyRate The rate per hour (in VND)
     * @param hasDeposit Whether a deposit is required (20% of total rental fee)
     * @returns Total amount in VND
     */
    calculateTotal(hours: number, hourlyRate: number, hasDeposit: boolean): number {
        if (hours < 0) {
            throw new Error("Duration cannot be negative");
        }

        const rentalFee = hours * hourlyRate;
        let total = rentalFee;

        if (hasDeposit) {
            // Deposit is 20% of the rental fee
            // Scenario UT-02 says: 1 hour @ 50k + deposit = 50k + 10k = 60k.
            const deposit = rentalFee * 0.2;
            total += deposit;
        }

        return total;
    }
}
