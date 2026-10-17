import { visibleUsers } from '../../posts/post-access.js';
import { AppError } from '../../../errors.js';
import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { PaginatedUsers, SocialRepository, SocialUser } from '../social.types.js';

const socialUserSelect = {
  id: true,
  name: true,
  image: true,
} as const;

export class PrismaSocialRepository implements SocialRepository {
  constructor(private readonly database: PrismaClient) {}

  async userExists(userId: string, viewerId = userId) {
    return (
      (await this.database.user.count({ where: { id: userId, ...visibleUsers(viewerId) } })) > 0
    );
  }

  async follow(followerId: string, followingId: string) {
    await this.database.$transaction(async (transaction) => {
      const blocked = await transaction.userFilter.count({
        where: {
          kind: 'BLOCK',
          OR: [
            { actorId: followerId, targetId: followingId },
            { actorId: followingId, targetId: followerId },
          ],
        },
      });
      if (blocked)
        throw new AppError(403, 'USER_BLOCKED', 'Following is unavailable for this account.');
      const result = await transaction.follow.createMany({
        data: [{ followerId, followingId }],
        skipDuplicates: true,
      });
      if (result.count) {
        const actor = await transaction.user.findUniqueOrThrow({
          where: { id: followerId },
          select: { id: true, name: true, image: true },
        });
        await transaction.notification.create({
          data: {
            userId: followingId,
            actorId: followerId,
            type: 'FOLLOW',
            title: 'New follower',
            message: `${actor.name} started following you.`,
            data: { actor },
          },
        });
      }
    });
  }

  async unfollow(followerId: string, followingId: string) {
    await this.database.follow.deleteMany({ where: { followerId, followingId } });
  }

  async getFollowers(userId: string, page: number, limit: number, viewerId = userId) {
    const [follows, total] = await this.database.$transaction([
      this.database.follow.findMany({
        where: { followingId: userId, follower: visibleUsers(viewerId) },
        orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: { follower: { select: socialUserSelect } },
      }),
      this.database.follow.count({
        where: { followingId: userId, follower: visibleUsers(viewerId) },
      }),
    ]);

    return toPaginatedUsers(
      follows.map(({ follower }) => follower),
      page,
      limit,
      total,
    );
  }

  async getFollowing(userId: string, page: number, limit: number, viewerId = userId) {
    const [follows, total] = await this.database.$transaction([
      this.database.follow.findMany({
        where: { followerId: userId, following: visibleUsers(viewerId) },
        orderBy: [{ createdAt: 'desc' }, { followingId: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: { following: { select: socialUserSelect } },
      }),
      this.database.follow.count({
        where: { followerId: userId, following: visibleUsers(viewerId) },
      }),
    ]);

    return toPaginatedUsers(
      follows.map(({ following }) => following),
      page,
      limit,
      total,
    );
  }
}

function toPaginatedUsers(
  data: SocialUser[],
  page: number,
  limit: number,
  total: number,
): PaginatedUsers {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
