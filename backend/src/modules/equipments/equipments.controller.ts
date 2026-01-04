import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Headers as HttpHeaders,
  Patch,
  Param,
} from "@nestjs/common";
import { EquipmentsService } from "./equipments.service";
import { CreateEquipmentDto } from "./dto/create-equipment.dto";
import { UpdateEquipmentDto } from "./dto/update-equipment.dto";

@Controller("equipments")
export class EquipmentsController {
  constructor(private readonly equipmentsService: EquipmentsService) {}

  @Get()
  findAll(
    @Query("managerId") managerId?: string,
    @Query("facilityId") facilityId?: string,
  ) {
    if (facilityId) {
      return this.equipmentsService.findByFacility(+facilityId);
    }
    if (managerId) {
      return this.equipmentsService.findByManager(+managerId);
    }
    return this.equipmentsService.findAll();
  }

  @Post()
  create(
    @Body() createEquipmentDto: CreateEquipmentDto,
    @HttpHeaders("x-user-id") userIdHeader: string,
  ) {
    // In real app, verify manager permissions
    const userId = userIdHeader ? parseInt(userIdHeader) : 1;
    return this.equipmentsService.create(userId, createEquipmentDto);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updateEquipmentDto: UpdateEquipmentDto,
    @HttpHeaders("x-user-id") userIdHeader: string,
  ) {
    const userId = userIdHeader ? parseInt(userIdHeader) : 1;
    return this.equipmentsService.update(+id, userId, updateEquipmentDto);
  }
}
