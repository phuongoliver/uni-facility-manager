import { Module, Global } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationsService } from "./notifications.service";
import { NotificationFactory } from "./factory/notification.factory";
import { Notification } from "./entities/notification.entity";

import { NotificationsController } from "./notifications.controller";

@Global() // Make it global so we can use NotificationService everywhere without importing Module
@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationFactory],
  exports: [NotificationsService],
})
export class NotificationsModule {}
