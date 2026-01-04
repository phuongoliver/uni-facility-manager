import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Notification } from "../entities/notification.entity";
import { INotificationSender } from "./notification-sender.interface";
import { EmailNotificationSender } from "./email-notification.sender";
import { DbNotificationSender } from "./db-notification.sender";

export type NotificationType = "EMAIL" | "DB";

@Injectable()
export class NotificationFactory {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  getSender(type: NotificationType): INotificationSender {
    switch (type) {
      case "EMAIL":
        return new EmailNotificationSender();
      case "DB":
        return new DbNotificationSender(this.notificationRepository);
      default:
        throw new Error(`Invalid notification type: ${type}`);
    }
  }
}
