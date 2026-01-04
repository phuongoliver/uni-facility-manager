import {
  IsString,
  IsInt,
  Min,
  IsEnum,
  IsBoolean,
  IsOptional,
  MaxLength,
  IsNumber,
} from "class-validator";
import {
  FacilityType,
  PriceType,
  TransactionType,
} from "../../../common/enums/db-enums";

export class UpdateFacilityDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsEnum(FacilityType)
  @IsOptional()
  type?: FacilityType;

  @IsString()
  @IsOptional()
  location?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsEnum(PriceType)
  @IsOptional()
  priceType?: PriceType;

  @IsEnum(TransactionType)
  @IsOptional()
  transactionType?: TransactionType;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsBoolean()
  @IsOptional()
  requiresApproval?: boolean;
}
