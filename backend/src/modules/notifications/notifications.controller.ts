import {
  Controller,
  Get,
  Put,
  Param,
  ParseIntPipe,
  Headers as HttpHeaders,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(@HttpHeaders("x-user-id") userIdHeader: string) {
    const userId = userIdHeader ? parseInt(userIdHeader) : 1;
    const [notifications, unreadCount] = await Promise.all([
      this.notificationsService.getUserNotifications(userId),
      this.notificationsService.getUnreadCount(userId),
    ]);
    return { data: notifications, unread: unreadCount };
  }

  @Put("read-all")
  async markAllRead(@HttpHeaders("x-user-id") userIdHeader: string) {
    const userId = userIdHeader ? parseInt(userIdHeader) : 1;
    return this.notificationsService.markAllAsRead(userId);
  }

  @Put(":id/read")
  async markAsRead(
    @Param("id", ParseIntPipe) id: number,
    @HttpHeaders("x-user-id") userIdHeader: string,
  ) {
    const userId = userIdHeader ? parseInt(userIdHeader) : 1;
    return this.notificationsService.markAsRead(id, userId);
  }
}
