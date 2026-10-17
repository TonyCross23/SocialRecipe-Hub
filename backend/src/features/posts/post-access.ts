import type { Prisma } from '../../generated/prisma/client.js';
export function visibleUsers(viewerId: string, includeMuted = false): Prisma.UserWhereInput {
  return {
    status: 'ACTIVE',
    filteredBy: {
      none: { actorId: viewerId, kind: includeMuted ? { in: ['BLOCK', 'MUTE'] } : 'BLOCK' },
    },
    contentFilters: { none: { targetId: viewerId, kind: 'BLOCK' } },
  };
}
export function visiblePosts(viewerId: string, includeMuted = false): Prisma.PostWhereInput {
  return {
    status: { notIn: ['DELETED', 'BANNED'] },
    user: visibleUsers(viewerId, includeMuted),
    OR: [
      { visibility: 'PUBLIC' },
      { userId: viewerId },
      { visibility: 'FOLLOWERS', user: { followers: { some: { followerId: viewerId } } } },
    ],
  };
}
export function visibleNotifications(userId: string): Prisma.NotificationWhereInput {
  return { userId, OR: [{ actorId: null }, { actor: { is: visibleUsers(userId, true) } }] };
}
