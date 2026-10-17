import { describe, expect, it, vi } from 'vitest';
import { createResetMailer } from '../src/features/recovery/recovery.service.js';
import { testConfig } from './config.js';
const { sendMail } = vi.hoisted(() => ({
  sendMail: vi.fn(async (_message: { subject: string; text: string }) => ({})),
}));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }));
describe('English-only transactional emails', () => {
  it('uses English subjects and bodies for registration and reset regardless of app language', async () => {
    for (const purpose of ['registration', 'reset'] as const) {
      const mail = createResetMailer({ ...testConfig, SMTP_HOST: 'smtp.example.test' }, purpose);
      for (const language of ['my', 'en'] as const) {
        await mail.send('test@example.test', '123456', language);
        const message = sendMail.mock.calls.at(-1)?.[0] as unknown as {
          subject: string;
          text: string;
        };
        expect(message.subject).toMatch(purpose === 'reset' ? /password reset/ : /Verify/);
        expect(message.text).toContain('123456');
        expect(message.text).toContain('15 minutes');
        expect(message.text).not.toMatch(/[\u1000-\u109f]/);
      }
    }
  });
});
