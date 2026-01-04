import { Test, TestingModule } from '@nestjs/testing';
import { FacilitiesService } from './facilities.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Facility } from './entities/facility.entity';
import { Repository } from 'typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateFacilityDto } from './dto/create-facility.dto';
import { UpdateFacilityDto } from './dto/update-facility.dto';
import { FacilityType, PriceType } from '../../common/enums/db-enums';

const mockFacilityRepository = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
});

describe('FacilitiesService', () => {
    let service: FacilitiesService;
    let repository: Repository<Facility>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FacilitiesService,
                {
                    provide: getRepositoryToken(Facility),
                    useFactory: mockFacilityRepository,
                },
            ],
        }).compile();

        service = module.get<FacilitiesService>(FacilitiesService);
        repository = module.get<Repository<Facility>>(getRepositoryToken(Facility));
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('should create a facility successfully', async () => {
            const createDto: CreateFacilityDto = {
                name: 'Test Hall',
                location: 'B1',
                capacity: 100,
                type: FacilityType.HALL,
                price: 100000,
                priceType: PriceType.PER_HOUR,
                imageUrl: 'http://test.com/img.jpg',
            };
            const managerId = 1;

            jest.spyOn(repository, 'findOne').mockResolvedValue(null);
            jest.spyOn(repository, 'create').mockReturnValue({ ...createDto, managerId, status: 'AVAILABLE' } as any);
            jest.spyOn(repository, 'save').mockResolvedValue({ facilityId: 1, ...createDto, managerId, status: 'AVAILABLE' } as any);

            const result = await service.create(managerId, createDto);
            expect(result).toEqual(expect.objectContaining({ name: 'Test Hall', status: 'AVAILABLE' }));
            expect(repository.findOne).toHaveBeenCalledWith({ where: { name: 'Test Hall' } });
        });

        it('should throw ConflictException if duplicate name', async () => {
            const createDto: CreateFacilityDto = {
                name: 'Existing Hall',
                location: 'B1',
                capacity: 100,
                type: FacilityType.HALL,
                price: 100000,
                priceType: PriceType.PER_HOUR,
                imageUrl: 'test',
            };
            const managerId = 1;

            jest.spyOn(repository, 'findOne').mockResolvedValue({ facilityId: 1, name: 'Existing Hall' } as any);

            await expect(service.create(managerId, createDto)).rejects.toThrow(ConflictException);
        });
    });

    describe('update', () => {
        it('should update facility if manager owns it', async () => {
            const updateDto: UpdateFacilityDto = { name: 'Updated Name' };
            const managerId = 1;
            const facilityId = 10;
            const existingFacility = { facilityId, managerId, name: 'Old Name' };

            jest.spyOn(repository, 'findOne').mockResolvedValue(existingFacility as any);
            jest.spyOn(repository, 'save').mockResolvedValue({ ...existingFacility, ...updateDto } as any);

            const result = await service.update(facilityId, managerId, updateDto);
            expect(result.name).toEqual('Updated Name');
        });

        it('should throw ForbiddenException if manager does not own it', async () => {
            const updateDto: UpdateFacilityDto = { name: 'Updated Name' };
            const managerId = 2; // Different manager
            const facilityId = 10;
            const existingFacility = { facilityId, managerId: 1, name: 'Old Name' };

            jest.spyOn(repository, 'findOne').mockResolvedValue(existingFacility as any);

            await expect(service.update(facilityId, managerId, updateDto)).rejects.toThrow(ForbiddenException);
        });

        it('should throw NotFoundException if facility not found', async () => {
            jest.spyOn(repository, 'findOne').mockResolvedValue(null);
            await expect(service.update(999, 1, {})).rejects.toThrow(NotFoundException);
        });
    });
});
