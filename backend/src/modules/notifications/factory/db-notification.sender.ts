import { Repository } from "typeorm";
import { INotificationSender } from "./notification-sender.interface";
import { Notification } from "../entities/notification.entity";

export class DbNotificationSender implements INotificationSender {
  constructor(
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async send(
    userId: number,
    title: string,
    message: string,
    type: string = "INFO",
  ): Promise<void> {
    const notification = this.notificationRepository.create({
      userId,
      title,
      message,
      type,
      isRead: false,
    });
    await this.notificationRepository.save(notification);
    console.log(`[DB NOTIFICATION] Saved for UserID: ${userId}`);
  }
}
