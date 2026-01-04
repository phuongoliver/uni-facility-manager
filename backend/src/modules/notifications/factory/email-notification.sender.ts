import { INotificationSender } from './notification-sender.interface';

export class EmailNotificationSender implements INotificationSender {
    async send(userId: number, title: string, message: string): Promise<void> {
        // Mock email sending
        // In production, inject MailerService here
        console.log(`[EMAIL SENT] To UserID: ${userId} | Subject: ${title} | Body: ${message}`);
    }
}
