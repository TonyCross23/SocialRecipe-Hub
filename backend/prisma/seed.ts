import 'dotenv/config';
import { createDatabase } from '../src/database.js';
import type { Prisma } from '../src/generated/prisma/client.js';
import { registerDto } from '../src/features/auth/dto/auth.dto.js';
import { ArgonPasswordService } from '../src/features/auth/services/password.service.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const adminRequested = Boolean(process.env.SEED_ADMIN_EMAIL || process.env.SEED_ADMIN_PASSWORD);
const admin = adminRequested
  ? registerDto.parse({
      email: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD,
      name: process.env.SEED_ADMIN_NAME ?? 'Administrator',
      dob: process.env.SEED_ADMIN_DOB ?? '2000-01-01',
    })
  : undefined;
const passwordHash = admin ? await new ArgonPasswordService().hash(admin.password) : undefined;
const db = createDatabase(process.env.DATABASE_URL);

const permissions = {
  'post:create': 'Create recipe posts',
  'post:read': 'Read permitted posts',
  'post:update:own': 'Edit own posts',
  'post:delete:own': 'Delete own posts',
  'comment:create': 'Write comments and replies',
  'like:create': 'Like posts and comments',
  'follow:manage': 'Follow and unfollow users',
  'report:create': 'Report content',
  'moderation:review': 'Review flagged content and reports',
  'policy:manage': 'Manage moderation policies',
  'rbac:manage': 'Manage roles and permission assignments',
  'admin:read': 'View the administration dashboard and user directory',
  'user:ban': 'Ban and unban community accounts',
};

const memberPermissions = [
  'post:create',
  'post:read',
  'post:update:own',
  'post:delete:own',
  'comment:create',
  'like:create',
  'follow:manage',
  'report:create',
] as const;

const rolePermissions = {
  member: memberPermissions,
  moderator: [...memberPermissions, 'moderation:review'],
  admin: Object.keys(permissions),
};

const policySettings = [
  {
    key: 'moderation.enabled',
    value: false,
    description: 'Enable after an AI moderation worker is configured',
  },
  {
    key: 'moderation.bannedKeywords',
    value: [],
    description: 'Case-insensitive banned terms',
  },
  {
    key: 'moderation.policy',
    value:
      'Disallow harassment, hate speech, threats, spam, and dangerous food preparation advice.',
    description: 'Instructions supplied to the moderation provider',
  },
] as const;

async function seedPermissions(transaction: Prisma.TransactionClient) {
  for (const [name, description] of Object.entries(permissions)) {
    await transaction.permission.upsert({
      where: { name },
      update: { description },
      create: { name, description },
    });
  }
}

async function seedRoles(transaction: Prisma.TransactionClient) {
  for (const [name, allowedPermissions] of Object.entries(rolePermissions)) {
    const role = await transaction.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    for (const permissionName of allowedPermissions) {
      const permission = await transaction.permission.findUniqueOrThrow({
        where: { name: permissionName },
      });

      await transaction.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }
}

async function seedPolicySettings(transaction: Prisma.TransactionClient) {
  for (const setting of policySettings) {
    await transaction.policySetting.upsert({
      where: { key: setting.key },
      update: {},
      create: {
        key: setting.key,
        value: setting.value as string | boolean | string[],
        description: setting.description,
      },
    });
  }
}

try {
  await db.$transaction(async (tx) => {
    await seedPermissions(tx);
    await seedRoles(tx);
    await seedPolicySettings(tx);

    if (admin && passwordHash) {
      const role = await tx.role.findUniqueOrThrow({ where: { name: 'admin' } });
      await tx.user.upsert({
        where: { email: admin.email },
        // Re-running the seed must not reset a password or undo an account ban.
        update: { roleId: role.id },
        create: {
          email: admin.email,
          name: admin.name,
          dob: new Date(`${admin.dob}T00:00:00.000Z`),
          passwordHash,
          emailVerifiedAt: new Date(),
          roleId: role.id,
        },
      });
    }
  });

  console.info('Default roles, permissions and policy settings are ready.');
  console.info(
    admin
      ? `Administrator ${admin.email} is ready. Existing passwords and account status are preserved.`
      : 'No admin account requested. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one.',
  );
} finally {
  await db.$disconnect();
}
