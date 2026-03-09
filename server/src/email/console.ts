export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailService {
  send(data: EmailData): Promise<void>;
}

export class ConsoleEmailService implements EmailService {
  async send(data: EmailData): Promise<void> {
    console.log('\n========================================');
    console.log('📧 EMAIL (Development Mode)');
    console.log('========================================');
    console.log(`To: ${data.to}`);
    console.log(`Subject: ${data.subject}`);
    console.log('----------------------------------------');
    console.log('Text:', data.text || '(no plain text)');
    console.log('----------------------------------------');
    console.log('HTML:', data.html);
    console.log('========================================\n');
  }
}
