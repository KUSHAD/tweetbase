import { MailerSend } from 'mailersend';

export const mailerSend = new MailerSend({
  apiKey: process.env.MAILERSEND_API_KEY,
});
