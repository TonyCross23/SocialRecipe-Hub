import type { SocialRepository } from '../social.types.js';

export class SocialService {
  constructor(private readonly repository: SocialRepository) {}

  userExists(userId: string, viewerId?: string) {
    return this.repository.userExists(userId, viewerId);
  }

  follow(followerId: string, followingId: string) {
    return this.repository.follow(followerId, followingId);
  }

  unfollow(followerId: string, followingId: string) {
    return this.repository.unfollow(followerId, followingId);
  }

  getFollowers(userId: string, page: number, limit: number, viewerId?: string) {
    return this.repository.getFollowers(userId, page, limit, viewerId);
  }

  getFollowing(userId: string, page: number, limit: number, viewerId?: string) {
    return this.repository.getFollowing(userId, page, limit, viewerId);
  }
}
