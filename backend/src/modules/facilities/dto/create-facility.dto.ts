import { IsNotEmpty, IsString, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { FacilityType, PriceType, TransactionType } from '../../../common/enums/db-enums';

export class CreateFacilityDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    location?: string;

    @IsNotEmpty()
    @IsEnum(FacilityType)
    type: FacilityType;

    @IsNotEmpty()
    @IsNumber()
    @Min(1)
    capacity: number;

    @IsOptional()
    @IsString()
    imageUrl?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    price?: number;

    @IsOptional()
    @IsEnum(PriceType)
    priceType?: PriceType;

    @IsOptional()
    @IsEnum(TransactionType)
    transactionType?: TransactionType;

    @IsOptional()
    @IsNumber()
    @Min(1)
    minCancellationHours?: number;
}
