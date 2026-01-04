import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EquipmentsService } from "./equipments.service";
import { EquipmentsController } from "./equipments.controller";
import { Equipment } from "./entities/equipment.entity";
import { FacilitiesModule } from "../facilities/facilities.module";

@Module({
  imports: [TypeOrmModule.forFeature([Equipment]), FacilitiesModule],
  controllers: [EquipmentsController],
  providers: [EquipmentsService],
  exports: [EquipmentsService],
})
export class EquipmentsModule {}
