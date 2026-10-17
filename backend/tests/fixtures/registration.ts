import request from 'supertest';
import type { Express } from 'express';
import type { ResetMailer } from '../../src/features/recovery/recovery.service.js';
const messages = new Map<string, string>();
export const registrationMailer: ResetMailer = {
  async send(email, code) {
    messages.set(email.toLowerCase(), code);
  },
};
export async function registerVerified(
  app: Express,
  input: { email: string; [key: string]: unknown },
) {
  const started = await request(app).post('/api/v1/auth/register').send(input).expect(202);
  const code = messages.get(input.email.toLowerCase());
  if (!code) throw new Error('Verification email was not delivered');
  return request(app)
    .post('/api/v1/auth/register/verify')
    .send({ requestId: started.body.requestId, code })
    .expect(201);
}
