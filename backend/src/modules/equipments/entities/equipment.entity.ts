import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { EquipmentStatus } from "../../../common/enums/db-enums";

@Entity("equipments")
export class Equipment {
  @PrimaryGeneratedColumn("identity", { name: "equipment_id" })
  equipmentId: number;

  @Column({ name: "facility_id", nullable: true })
  facilityId: number;

  @Column()
  name: string;

  @Column({ name: "total_quantity" })
  totalQuantity: number;

  @Column({ name: "available_quantity" })
  availableQuantity: number;

  @Column({
    type: "enum",
    enum: EquipmentStatus,
    default: EquipmentStatus.GOOD,
  })
  status: EquipmentStatus;

  @Column({
    type: "decimal",
    precision: 15,
    scale: 2,
    default: 0,
    name: "rental_price",
  })
  rentalPrice: number;
}
