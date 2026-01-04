import { Test, TestingModule } from '@nestjs/testing';
import { FeeCalculationService } from './fee-calculation.service';

describe('Booking Fee Calculation', () => {
    let service: FeeCalculationService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [FeeCalculationService],
        }).compile();

        service = module.get<FeeCalculationService>(FeeCalculationService);
    });

    describe('calculateTotal', () => {
        // Case UT-01: Standard Booking
        it('UT-01: Standard Booking - 2 hours at 50,000 VND/hr with no deposit', () => {
            // Input: hours=2, rate=50000, deposit=false
            const result = service.calculateTotal(2, 50000, false);
            // Expected Output: 100,000
            expect(result).toEqual(100000);
        });

        // Case UT-02: Booking with Deposit
        it('UT-02: Booking with Deposit - 1 hour with required deposit (20%)', () => {
            // Input: hours=1, rate=50000, deposit=true
            const result = service.calculateTotal(1, 50000, true);
            // Expected Output: 60,000 (50k fee + 10k deposit)
            expect(result).toEqual(60000);
        });

        // Case UT-03: Invalid Input
        it('UT-03: Invalid Input (Negative Duration)', () => {
            // Input: hours=-1, rate=50000
            // Expected Output: Throw error
            expect(() => {
                service.calculateTotal(-1, 50000, false);
            }).toThrow('Duration cannot be negative');
        });
    });
});
