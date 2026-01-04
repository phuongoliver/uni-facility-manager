import {
  Controller,
  Get,
  Query,
  Post,
  Body,
  Headers as HttpHeaders,
  Patch,
  Param,
} from "@nestjs/common";
import { FacilitiesService } from "./facilities.service";
import { CreateFacilityDto } from "./dto/create-facility.dto";
import { UpdateFacilityDto } from "./dto/update-facility.dto";

@Controller("facilities")
export class FacilitiesController {
  constructor(private readonly facilitiesService: FacilitiesService) {}

  @Post()
  create(
    @Body() createFacilityDto: CreateFacilityDto,
    @HttpHeaders("x-user-id") userIdHeader: string,
  ) {
    const managerId = userIdHeader ? parseInt(userIdHeader) : 1;
    return this.facilitiesService.create(managerId, createFacilityDto);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() updateFacilityDto: UpdateFacilityDto,
    @HttpHeaders("x-user-id") userIdHeader: string,
  ) {
    const managerId = userIdHeader ? parseInt(userIdHeader) : 1;
    return this.facilitiesService.update(+id, managerId, updateFacilityDto);
  }

  @Get()
  findAll(@Query("managerId") managerId?: string) {
    if (managerId) {
      return this.facilitiesService.findByManager(+managerId);
    }
    return this.facilitiesService.findAll();
  }
}
