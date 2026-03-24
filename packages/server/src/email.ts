// Re-export from @commonpub/infra for backward compatibility
export {
  SmtpEmailAdapter,
  ResendEmailAdapter,
  ConsoleEmailAdapter,
  emailTemplates,
} from '@commonpub/infra/email';
export type { EmailAdapter, EmailMessage } from '@commonpub/infra/email';
