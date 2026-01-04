import { IsString, IsInt, IsOptional, Min, IsNumber, IsEnum } from 'class-validator';
import { EquipmentStatus } from '../../../common/enums/db-enums';

export class UpdateEquipmentDto {
    @IsInt()
    @IsOptional()
    facilityId?: number;

    @IsString()
    @IsOptional()
    name?: string;

    @IsInt()
    @Min(0)
    @IsOptional()
    totalQuantity?: number;

    @IsNumber()
    @Min(0)
    @IsOptional()
    rentalPrice?: number;

    @IsEnum(EquipmentStatus)
    @IsOptional()
    status?: EquipmentStatus;
}
