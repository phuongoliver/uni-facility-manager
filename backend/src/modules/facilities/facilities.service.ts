import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Facility } from "./entities/facility.entity";
import { CreateFacilityDto } from "./dto/create-facility.dto";
import { UpdateFacilityDto } from "./dto/update-facility.dto";

@Injectable()
export class FacilitiesService {
  constructor(
    @InjectRepository(Facility)
    private facilitiesRepository: Repository<Facility>,
  ) {}

  findAll() {
    return this.facilitiesRepository.find();
  }

  findOne(id: number) {
    return this.facilitiesRepository.findOne({ where: { facilityId: id } });
  }

  findByManager(managerId: number) {
    return this.facilitiesRepository.find({
      where: { managerId },
    });
  }

  async create(
    managerId: number,
    createFacilityDto: CreateFacilityDto,
  ): Promise<Facility> {
    // Check for duplicated name
    const existing = await this.facilitiesRepository.findOne({
      where: { name: createFacilityDto.name },
    });

    if (existing) {
      throw new ConflictException(
        `Facility with name "${createFacilityDto.name}" already exists.`,
      );
    }

    const facility = this.facilitiesRepository.create({
      ...createFacilityDto,
      managerId,
      status: "AVAILABLE", // Default status
    });

    return this.facilitiesRepository.save(facility);
  }

  async update(
    id: number,
    managerId: number,
    updateDto: UpdateFacilityDto,
  ): Promise<Facility> {
    const facility = await this.facilitiesRepository.findOne({
      where: { facilityId: id },
    });
    if (!facility) {
      throw new NotFoundException(`Facility #${id} not found`);
    }

    // Ownership check (3 is Admin ID from seed)
    if (facility.managerId !== managerId && managerId !== 3) {
      throw new ForbiddenException("You do not manage this facility");
    }

    Object.assign(facility, updateDto);
    return this.facilitiesRepository.save(facility);
  }
}
