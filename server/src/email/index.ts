import { EmailService, ConsoleEmailService, EmailData } from './console';
import { ResendEmailService } from './resend';

let emailService: EmailService;

export function initEmailService(): EmailService {
  // Allow forcing email provider via EMAIL_PROVIDER env var
  // Options: 'resend' | 'console' | 'auto' (default)
  const provider = process.env.EMAIL_PROVIDER || 'auto';
  
  if (provider === 'resend' || (provider === 'auto' && process.env.NODE_ENV === 'production')) {
    if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
      emailService = new ResendEmailService(
        process.env.RESEND_API_KEY,
        process.env.EMAIL_FROM
      );
      console.log('Email service initialized: Resend');
      return emailService;
    } else {
      console.warn('RESEND_API_KEY or EMAIL_FROM not set, falling back to console');
    }
  }
  
  emailService = new ConsoleEmailService();
  console.log('Email service initialized: Console');
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
export * from './templates';
