import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import {
  FacilityType,
  PriceType,
  TransactionType,
} from "../../../common/enums/db-enums";

@Entity("facilities")
export class Facility {
  @PrimaryGeneratedColumn("identity", { name: "facility_id" })
  facilityId: number;

  @Column({ name: "manager_id", nullable: true })
  managerId: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  location: string;

  @Column({ type: "enum", enum: FacilityType })
  type: FacilityType;

  @Column()
  capacity: number;

  @Column({ name: "image_url", nullable: true })
  imageUrl: string;

  @Column({ name: "requires_approval", default: true })
  requiresApproval: boolean;

  @Column({ default: "AVAILABLE" })
  status: string;

  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    default: 0,
    name: "price",
  })
  price: number;

  @Column({
    type: "enum",
    enum: PriceType,
    default: PriceType.PER_HOUR,
    name: "price_type",
  })
  priceType: PriceType;

  @Column({
    type: "enum",
    enum: TransactionType,
    default: TransactionType.RENTAL_FEE,
    name: "transaction_type",
  })
  transactionType: TransactionType;

  @Column({ name: "min_cancellation_hours", default: 1 })
  minCancellationHours: number;
}
