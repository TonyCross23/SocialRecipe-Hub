import { z } from '../../../shared/zod.js';

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
const passwordSchema = z.string().min(12).max(128);

const dateOfBirthSchema = z.iso.date().refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    date.toISOString().slice(0, 10) === value &&
    date.getTime() <= Date.now() &&
    date.getUTCFullYear() >= 1900
  );
}, 'dob must be a real date between 1900 and today');

export const registerDto = z.strictObject({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: passwordSchema,
  image: z
    .url({ protocol: /^https$/ })
    .max(2048)
    .nullable()
    .optional(),
  dob: dateOfBirthSchema,
});

export const loginDto = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const refreshTokenDto = z.strictObject({
  refreshToken: z.string().min(1).max(4096),
});

export const changePasswordDto = z.strictObject({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const logoutDto = z.strictObject({});

export const updateProfileDto = registerDto
  .pick({ name: true, dob: true, image: true })
  .required({ image: true });
