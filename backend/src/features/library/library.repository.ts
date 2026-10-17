import type { PrismaClient } from '../../generated/prisma/client.js';
import { AppError, notFound } from '../../errors.js';
import { visiblePosts } from '../posts/post-access.js';
import type { CommunityPostReader } from '../community/community.repository.js';
import type { z } from '../../shared/zod.js';
import type { shoppingListDto } from './library.routes.js';
export class LibraryRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly posts: CommunityPostReader,
  ) {}
  saved(userId: string, page: number, limit: number) {
    return this.posts.getSavedPosts(userId, page, limit);
  }
  async save(userId: string, postId: string, saved: boolean) {
    if (saved) {
      if (!(await this.db.post.count({ where: { AND: [visiblePosts(userId), { id: postId }] } })))
        throw notFound('Post');
      await this.db.savedPost.createMany({ data: [{ userId, postId }], skipDuplicates: true });
    } else await this.db.savedPost.deleteMany({ where: { userId, postId } });
    return { saved };
  }
  async filterState(actorId: string, targetId: string) {
    const rows = await this.db.userFilter.findMany({ where: { actorId, targetId } });
    return {
      blocked: rows.some((r) => r.kind === 'BLOCK'),
      muted: rows.some((r) => r.kind === 'MUTE'),
    };
  }
  async setFilter(actorId: string, targetId: string, kind: 'BLOCK' | 'MUTE', enabled: boolean) {
    if (actorId === targetId)
      throw new AppError(400, 'SELF_FILTER', 'You cannot block or mute yourself.');
    if (!(await this.db.user.count({ where: { id: targetId } }))) throw notFound('User');
    await this.db.$transaction(async (tx) => {
      if (enabled) {
        await tx.userFilter.createMany({
          data: [{ actorId, targetId, kind }],
          skipDuplicates: true,
        });
        if (kind === 'BLOCK')
          await tx.follow.deleteMany({
            where: {
              OR: [
                { followerId: actorId, followingId: targetId },
                { followerId: targetId, followingId: actorId },
              ],
            },
          });
      } else await tx.userFilter.deleteMany({ where: { actorId, targetId, kind } });
    });
    return this.filterState(actorId, targetId);
  }
  async filters(actorId: string, kind: 'BLOCK' | 'MUTE', page: number, limit: number) {
    const where = { actorId, kind };
    const [data, total] = await this.db.$transaction([
      this.db.userFilter.findMany({
        where,
        include: { target: { select: { id: true, name: true, image: true } } },
        orderBy: [{ createdAt: 'desc' }, { targetId: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.userFilter.count({ where }),
    ]);
    return {
      data: data.map((r) => r.target),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
  async shoppingLists(userId: string, page: number, limit: number) {
    const where = { userId };
    const [data, total] = await this.db.$transaction([
      this.db.shoppingList.findMany({
        where,
        select: { id: true, title: true, createdAt: true, _count: { select: { items: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.shoppingList.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  async shoppingList(userId: string, id: string) {
    const list = await this.db.shoppingList.findFirst({
      where: { id, userId },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    if (!list) throw notFound('Shopping list');
    return list;
  }
  createShoppingList(userId: string, input: z.infer<typeof shoppingListDto>) {
    return this.db.shoppingList.create({
      data: {
        userId,
        title: input.title,
        items: { create: input.items.map((item, position) => ({ ...item, position })) },
      },
      include: { items: { orderBy: { position: 'asc' } } },
    });
  }
  async checkItem(userId: string, id: string, itemId: string, checked: boolean) {
    const changed = await this.db.shoppingItem.updateMany({
      where: { id: itemId, listId: id, list: { userId } },
      data: { checked },
    });
    if (!changed.count) throw notFound('Shopping item');
    return { checked };
  }
  async deleteList(userId: string, id: string) {
    if (!(await this.db.shoppingList.deleteMany({ where: { id, userId } })).count)
      throw notFound('Shopping list');
  }
  async registerDevice(userId: string, sessionId: string, token: string) {
    // One physical token belongs only to its most recently signed-in session.
    const previous = await this.db.pushDevice.findUnique({ where: { token } });
    if (!previous && (await this.db.pushDevice.count({ where: { userId } })) >= 10)
      throw new AppError(
        400,
        'TOO_MANY_DEVICES',
        'At most ten devices can receive notifications for this account.',
      );
    const device = await this.db.pushDevice.upsert({
      where: { token },
      create: { userId, sessionId, token },
      update: {
        userId,
        sessionId,
        ...(previous?.userId === userId && previous.sessionId === sessionId
          ? {}
          : { createdAt: new Date() }),
      },
    });
    return { id: device.id };
  }
  async unregisterDevice(userId: string, token: string) {
    await this.db.pushDevice.deleteMany({ where: { userId, token } });
  }
}
