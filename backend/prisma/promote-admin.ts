import 'dotenv/config';
import { createDatabase } from '../src/database.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes('@')) {
  throw new Error('Usage: npm run admin:promote -- user@example.com');
}
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const database = createDatabase(process.env.DATABASE_URL);

try {
  const adminRole = await database.role.findUnique({ where: { name: 'admin' } });
  if (!adminRole) throw new Error('Admin role is missing. Run npm run db:seed first.');

  const result = await database.user.updateMany({
    where: { email },
    data: { roleId: adminRole.id },
  });
  if (result.count === 0) throw new Error(`No registered user found for ${email}`);

  console.info(`${email} now has the admin role.`);
} finally {
  await database.$disconnect();
}
