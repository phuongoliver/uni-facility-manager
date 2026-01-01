import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { FacilityType } from '../../../common/enums/db-enums';

@Entity('facilities')
export class Facility {
  @PrimaryGeneratedColumn('identity', { name: 'facility_id' })
  facilityId: number;

  @Column({ name: 'manager_id', nullable: true })
  managerId: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'enum', enum: FacilityType })
  type: FacilityType;

  @Column()
  capacity: number;

  @Column({ name: 'image_url', nullable: true })
  imageUrl: string;

  @Column({ name: 'requires_approval', default: true })
  requiresApproval: boolean;

  @Column({ default: 'AVAILABLE' })
  status: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'price_per_hour' })
  pricePerHour: number;
}
