import { IsNotEmpty, IsInt, IsString, IsEnum, IsArray, ValidateNested, Min, Max, IsDateString, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, Validate, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { BookingType } from '../../../common/enums/db-enums';

@ValidatorConstraint({ name: 'wordCount', async: false })
export class WordCountValidator implements ValidatorConstraintInterface {
  validate(text: string, args: ValidationArguments) {
    if (!text) return true; // Let IsNotEmpty handle empty check
    const wordCount = text.trim().split(/\s+/).length;
    const maxWords = args.constraints[0];
    return wordCount <= maxWords;
  }

  defaultMessage(args: ValidationArguments) {
    return `($property) must not exceed ${args.constraints[0]} words`;
  }
}

export class BookingEquipmentItemDto {
  @IsInt()
  @Min(1)
  equipment_id: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateBookingDto {
  @IsInt()
  @IsNotEmpty()
  facility_id: number;

  @IsString()
  @IsNotEmpty()
  @Validate(WordCountValidator, [150])
  purpose: string;

  @IsDateString()
  @IsNotEmpty()
  booking_date: string; // YYYY-MM-DD

  @IsInt()
  @Min(1)
  @Max(12) // Assuming 12 slots max per day usually
  start_slot: number;

  @IsInt()
  @Min(1)
  @Max(12)
  end_slot: number;

  @IsEnum(BookingType)
  booking_type: BookingType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingEquipmentItemDto)
  equipment_items: BookingEquipmentItemDto[];

  @IsEnum(['DAILY', 'WEEKLY', 'MONTHLY'])
  @IsOptional()
  recurrence_type?: 'DAILY' | 'WEEKLY' | 'MONTHLY';

  @IsDateString()
  @IsOptional()
  recurrence_end_date?: string;
}