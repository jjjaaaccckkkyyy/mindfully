import { Resend } from 'resend';
import { EmailService, EmailData } from './console';

export class ResendEmailService implements EmailService {
  private resend: Resend;
  private from: string;

  constructor(apiKey: string, from: string) {
    this.resend = new Resend(apiKey);
    this.from = from;
  }

  async send(data: EmailData): Promise<void> {
    try {
      const result = await this.resend.emails.send({
        from: this.from,
        to: data.to,
        subject: data.subject,
        html: data.html,
        text: data.text,
      });

      if (result.error) {
        console.error('Resend email error:', result.error);
        throw new Error(`Failed to send email: ${result.error.message}`);
      }

      console.log(`Email sent successfully to ${data.to}, ID: ${result.data?.id}`);
    } catch (error) {
      console.error('Failed to send email via Resend:', error);
      throw error;
    }
  }
}
