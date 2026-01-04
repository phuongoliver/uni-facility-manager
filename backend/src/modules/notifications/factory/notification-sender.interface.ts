export interface INotificationSender {
  send(
    userId: number,
    title: string,
    message: string,
    type?: string,
  ): Promise<void>;
}
