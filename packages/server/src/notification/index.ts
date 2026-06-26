export {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  createNotification,
  setNotificationEmailSender,
} from './notification.js';
export type { NotificationItem, NotificationFilters, NotificationType } from './notification.js';
export { shouldEmailNotification, getNotificationEmailTarget } from './emailPrefs.js';
