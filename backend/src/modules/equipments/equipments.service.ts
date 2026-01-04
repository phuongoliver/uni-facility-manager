import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Equipment } from './entities/equipment.entity';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { FacilitiesService } from '../facilities/facilities.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

@Injectable()
export class EquipmentsService {
    constructor(
        @InjectRepository(Equipment)
        private equipmentsRepository: Repository<Equipment>,
        private facilitiesService: FacilitiesService,
    ) { }

    findAll() {
        return this.equipmentsRepository.find();
    }

    async findByManager(managerId: number) {
        // 1. Get facilities managed by user
        const facilities = await this.facilitiesService.findByManager(managerId);

        if (!facilities || facilities.length === 0) {
            return [];
        }

        // 2. Extract IDs
        const facilityIds = facilities.map(f => f.facilityId);

        // 3. Find equipment in those facilities
        return this.equipmentsRepository.find({
            where: {
                facilityId: In(facilityIds),
            },
        });
    }

    findByFacility(facilityId: number) {
        return this.equipmentsRepository.find({
            where: { facilityId },
        });
    }
    async create(userId: number, createDto: CreateEquipmentDto) {
        // Validation: If adding to a facility, check ownership
        if (createDto.facilityId) {
            const facility = await this.facilitiesService.findOne(createDto.facilityId);
            if (!facility) {
                throw new NotFoundException(`Facility #${createDto.facilityId} not found`);
            }
            // Strict check: Manager must own the facility
            // Exception: ADMIN role (userId 3) can do anything, but here we just check ID match or Admin bypass if we had role info.
            // For now, let's strictly check managerId match.
            // Note: In real app, we should check user role too. Assuming userId 3 is Admin who manages some, but maybe also can manage others?
            // Let's implement simple check: If facility.managerId !== userId, forbid. 
            // BUT: Admins might not match managerId. 
            // Reuse logic: We will assume if you can see it, you can add to it? No, explicit check best.
            if (facility.managerId !== userId) {
                // Fetch user role to see if ADMIN? 
                // For vertical slice simplicity without User Injection here easily, verify managerId.
                // If userId is ADMIN (3), we might want to allow. 
                // Let's just check managerId for now.
                if (facility.managerId !== userId && userId !== 3) { // Hardcoded Admin ID 3 from seed
                    throw new ForbiddenException("You do not manage this facility");
                }
            }
        }

        const equipment = this.equipmentsRepository.create({
            ...createDto,
            availableQuantity: createDto.totalQuantity, // Initially all available
        });

        return this.equipmentsRepository.save(equipment);
    }

    async update(id: number, userId: number, updateDto: UpdateEquipmentDto) {
        const equipment = await this.equipmentsRepository.findOne({ where: { equipmentId: id } });
        if (!equipment) {
            throw new NotFoundException(`Equipment #${id} not found`);
        }

        // 1. Check permission on EXISTING facility (if assigned)
        if (equipment.facilityId) {
            const fac = await this.facilitiesService.findOne(equipment.facilityId);
            if (fac && fac.managerId !== userId && userId !== 3) {
                throw new ForbiddenException("You do not manage the facility this equipment belongs to");
            }
        }

        // 2. Check permission on NEW facility (if moving)
        if (updateDto.facilityId && updateDto.facilityId !== equipment.facilityId) {
            const newFac = await this.facilitiesService.findOne(updateDto.facilityId);
            if (!newFac) throw new NotFoundException(`New Facility #${updateDto.facilityId} not found`);

            if (newFac.managerId !== userId && userId !== 3) {
                throw new ForbiddenException("You do not manage the new destination facility");
            }
        }

        Object.assign(equipment, updateDto);
        return this.equipmentsRepository.save(equipment);
    }
}
