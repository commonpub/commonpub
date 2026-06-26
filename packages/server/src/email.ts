// Re-export from @commonpub/infra for backward compatibility
export {
  SmtpEmailAdapter,
  ResendEmailAdapter,
  ConsoleEmailAdapter,
  emailTemplates,
  EMAIL_HTTP_TIMEOUT_MS,
} from '@commonpub/infra/email';
export type { EmailAdapter, EmailMessage, EmailSendResult } from '@commonpub/infra/email';
