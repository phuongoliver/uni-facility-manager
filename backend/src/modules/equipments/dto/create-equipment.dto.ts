import {
  IsString,
  IsInt,
  IsOptional,
  Min,
  IsNumber,
  IsEnum,
} from "class-validator";
import { EquipmentStatus } from "../../../common/enums/db-enums";

export class CreateEquipmentDto {
  @IsInt()
  @IsOptional()
  facilityId?: number;

  @IsString()
  name: string;

  @IsInt()
  @Min(0)
  totalQuantity: number;

  @IsNumber()
  @Min(0)
  rentalPrice: number;

  @IsEnum(EquipmentStatus)
  @IsOptional()
  status?: EquipmentStatus;
}
