import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import {
  NotificationFactory,
  NotificationType,
} from "./factory/notification.factory";
import { Notification } from "./entities/notification.entity";

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(
    private readonly factory: NotificationFactory,
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  async onModuleInit() {
    // Auto-create notifications table if not exists
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.query(`
                CREATE TABLE IF NOT EXISTS notifications (
                    notification_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
                    title VARCHAR(255) NOT NULL,
                    message TEXT NOT NULL,
                    type VARCHAR(50) DEFAULT 'INFO',
                    is_read BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
            `);
      // Add index for performance
      await queryRunner.query(`
                CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
            `);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Send notification via multiple channels
   */
  async send(
    userId: number,
    title: string,
    message: string,
    type: string = "INFO",
    channels: NotificationType[] = ["DB"],
  ) {
    const errors: any[] = [];
    for (const channel of channels) {
      try {
        const sender = this.factory.getSender(channel);
        await sender.send(userId, title, message, type);
      } catch (error) {
        console.error(`Failed to send notification via ${channel}:`, error);
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      console.warn(`Some notifications failed to send`);
    }
  }

  /**
   * Send to all supported channels
   */
  async sendAll(userId: number, title: string, message: string) {
    return this.send(userId, title, message, "INFO", ["DB", "EMAIL"]);
  }

  // --- Fetch & Update API ---

  async getUserNotifications(userId: number, limit: number = 20) {
    return this.repo.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  async getUnreadCount(userId: number) {
    return this.repo.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(notificationId: number, userId: number) {
    // userId check for security
    return this.repo.update({ notificationId, userId }, { isRead: true });
  }

  async markAllAsRead(userId: number) {
    return this.repo.update({ userId, isRead: false }, { isRead: true });
  }
}
