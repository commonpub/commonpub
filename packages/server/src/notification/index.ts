export {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  createNotification,
  shouldEmailNotification,
  getNotificationEmailTarget,
  setNotificationEmailSender,
} from './notification.js';
export type { NotificationItem, NotificationFilters, NotificationType } from './notification.js';
