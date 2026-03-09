import { EmailService, ConsoleEmailService, EmailData } from './console';

let emailService: EmailService;

export function initEmailService(): EmailService {
  if (process.env.NODE_ENV === 'production' && process.env.RESEND_API_KEY) {
    // Lazy load Resend in production
    const { ResendEmailService } = require('./resend');
    emailService = new ResendEmailService(process.env.RESEND_API_KEY, process.env.EMAIL_FROM || 'noreply@example.com');
  } else {
    emailService = new ConsoleEmailService();
  }
  
  return emailService;
}

export function getEmailService(): EmailService {
  if (!emailService) {
    return initEmailService();
  }
  return emailService;
}

export async function sendEmail(data: EmailData): Promise<void> {
  return getEmailService().send(data);
}

export type { EmailService, EmailData };
