import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { PaginatedUsers, SocialRepository, SocialUser } from '../social.types.js';

const socialUserSelect = {
  id: true,
  name: true,
  image: true,
} as const;

export class PrismaSocialRepository implements SocialRepository {
  constructor(private readonly database: PrismaClient) {}

  async userExists(userId: string) {
    return (await this.database.user.count({ where: { id: userId } })) > 0;
  }

  async follow(followerId: string, followingId: string) {
    await this.database.follow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      update: {},
      create: { followerId, followingId },
    });
  }

  async unfollow(followerId: string, followingId: string) {
    await this.database.follow.deleteMany({ where: { followerId, followingId } });
  }

  async getFollowers(userId: string, page: number, limit: number) {
    const [follows, total] = await this.database.$transaction([
      this.database.follow.findMany({
        where: { followingId: userId },
        orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: { follower: { select: socialUserSelect } },
      }),
      this.database.follow.count({ where: { followingId: userId } }),
    ]);

    return toPaginatedUsers(
      follows.map(({ follower }) => follower),
      page,
      limit,
      total,
    );
  }

  async getFollowing(userId: string, page: number, limit: number) {
    const [follows, total] = await this.database.$transaction([
      this.database.follow.findMany({
        where: { followerId: userId },
        orderBy: [{ createdAt: 'desc' }, { followingId: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: { following: { select: socialUserSelect } },
      }),
      this.database.follow.count({ where: { followerId: userId } }),
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
