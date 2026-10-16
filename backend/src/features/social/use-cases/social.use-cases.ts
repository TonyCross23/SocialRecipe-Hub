import { AppError, notFound } from '../../../errors.js';
import type { SocialService } from '../services/social.service.js';

export class SocialUseCases {
  constructor(private readonly social: SocialService) {}

  async follow(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      throw new AppError(400, 'SELF_FOLLOW_NOT_ALLOWED', 'You cannot follow yourself');
    }

    await this.ensureUserExists(targetUserId);
    await this.social.follow(currentUserId, targetUserId);

    return { following: true };
  }

  async unfollow(currentUserId: string, targetUserId: string) {
    if (currentUserId === targetUserId) {
      throw new AppError(400, 'SELF_FOLLOW_NOT_ALLOWED', 'You cannot unfollow yourself');
    }

    await this.ensureUserExists(targetUserId);
    await this.social.unfollow(currentUserId, targetUserId);

    return { following: false };
  }

  async getFollowers(userId: string, page: number, limit: number) {
    await this.ensureUserExists(userId);
    return this.social.getFollowers(userId, page, limit);
  }

  async getFollowing(userId: string, page: number, limit: number) {
    await this.ensureUserExists(userId);
    return this.social.getFollowing(userId, page, limit);
  }

  private async ensureUserExists(userId: string) {
    if (!(await this.social.userExists(userId))) {
      throw notFound('User');
    }
  }
}
