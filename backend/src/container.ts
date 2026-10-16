import type { PrismaClient } from './generated/prisma/client.js';
import type { Config } from './config.js';
import { PrismaAuthRepository } from './features/auth/infrastructure/prisma-auth.repository.js';
import { ArgonPasswordService } from './features/auth/services/password.service.js';
import { JwtTokenService } from './features/auth/services/token.service.js';
import { AuthUseCases } from './features/auth/use-cases/auth.use-cases.js';
import { PrismaSocialRepository } from './features/social/infrastructure/prisma-social.repository.js';
import { SocialService } from './features/social/services/social.service.js';
import { SocialUseCases } from './features/social/use-cases/social.use-cases.js';
import { PrismaPostRepository } from './features/posts/infrastructure/prisma-post.repository.js';
import { ContentModerationService } from './features/posts/services/moderation.service.js';
import { PostService } from './features/posts/services/post.service.js';
import { PostUseCases } from './features/posts/use-cases/post.use-cases.js';
import { PrismaModerationRepository } from './features/moderation/infrastructure/prisma-moderation.repository.js';
import { ModerationService } from './features/moderation/services/moderation.service.js';
import { ModerationUseCases } from './features/moderation/use-cases/moderation.use-cases.js';
import { PrismaAdminRepository } from './features/admin/infrastructure/prisma-admin.repository.js';
import { AdminService } from './features/admin/services/admin.service.js';
import { AdminUseCases } from './features/admin/use-cases/admin.use-cases.js';

export interface ApplicationServices {
  auth: AuthUseCases;
  social: SocialUseCases;
  posts: PostUseCases;
  moderation: ModerationUseCases;
  admin: AdminUseCases;
}

export function createApplicationServices(
  database: PrismaClient,
  config: Config,
): ApplicationServices {
  const auth = new AuthUseCases(
    new PrismaAuthRepository(database),
    new ArgonPasswordService(),
    new JwtTokenService(config),
    {
      accessTtlSeconds: config.ACCESS_TOKEN_TTL_SECONDS,
      refreshTtlSeconds: config.REFRESH_TOKEN_TTL_SECONDS,
      sessionTtlSeconds: config.SESSION_TTL_SECONDS,
    },
  );

  const socialRepository = new PrismaSocialRepository(database);
  const postRepository = new PrismaPostRepository(database);
  const moderationRepository = new PrismaModerationRepository(database);

  return {
    auth,
    social: new SocialUseCases(new SocialService(socialRepository)),
    posts: new PostUseCases(
      new PostService(postRepository),
      new ContentModerationService(postRepository),
    ),
    moderation: new ModerationUseCases(new ModerationService(moderationRepository)),
    admin: new AdminUseCases(new AdminService(new PrismaAdminRepository(database))),
  };
}
