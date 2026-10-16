import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { ReportStatus } from '../../../generated/prisma/enums.js';
import type { CreateReportData, ModerationRepository, ReportPage } from '../moderation.types.js';

export class PrismaModerationRepository implements ModerationRepository {
  constructor(private readonly database: PrismaClient) {}

  async postExists(postId: string) {
    return (
      (await this.database.post.count({
        where: { id: postId, status: { notIn: ['DELETED', 'BANNED'] } },
      })) > 0
    );
  }

  async commentExists(commentId: string) {
    return (
      (await this.database.comment.count({
        where: { id: commentId, status: { notIn: ['DELETED', 'BANNED'] } },
      })) > 0
    );
  }

  createReport(reporterId: string, input: CreateReportData) {
    return this.database.$transaction(async (transaction) => {
      const report = await transaction.report.create({ data: { ...input, reporterId } });
      const reviewers = await transaction.user.findMany({
        where: {
          status: 'ACTIVE',
          role: {
            permissions: { some: { permission: { name: 'moderation:review' } } },
          },
        },
        select: { id: true },
      });
      if (reviewers.length > 0) {
        const target = input.postId ? 'post' : 'comment';
        await transaction.notification.createMany({
          data: reviewers.map(({ id }) => ({
            userId: id,
            type: 'NEW_REPORT',
            title: 'New content report',
            message: `A ${target} was reported and needs review.`,
            data: { reportId: report.id, postId: input.postId, commentId: input.commentId },
          })),
        });
      }
      return report;
    });
  }

  async getReports(page: number, limit: number, status?: ReportStatus) {
    const where = status ? { status } : {};
    const [reports, total] = await this.database.$transaction([
      this.database.report.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.database.report.count({ where }),
    ]);

    const result: ReportPage = {
      data: reports,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
    return result;
  }

  async updateReportStatus(reportId: string, status: ReportStatus) {
    const result = await this.database.report.updateMany({
      where: { id: reportId },
      data: { status },
    });
    if (result.count === 0) return null;
    return this.database.report.findUniqueOrThrow({ where: { id: reportId } });
  }

  async actionReport(
    reportId: string,
    action: 'DISMISS' | 'BAN_CONTENT',
    _reason: string,
    _now: Date,
  ) {
    return this.database.$transaction(async (transaction) => {
      const report = await transaction.report.findUnique({
        where: { id: reportId },
        include: {
          post: { select: { id: true, userId: true } },
          comment: { select: { id: true, userId: true } },
        },
      });
      if (!report) return null;

      if (action === 'DISMISS') {
        return transaction.report.update({
          where: { id: reportId },
          data: { status: 'DISMISSED' },
        });
      }

      if (report.postId) {
        await transaction.post.updateMany({
          where: { id: report.postId },
          data: { status: 'BANNED' },
        });
      }
      if (report.commentId) {
        await transaction.comment.updateMany({
          where: { id: report.commentId },
          data: { status: 'DELETED' },
        });
      }

      return transaction.report.update({
        where: { id: reportId },
        data: { status: 'ACTIONED' },
      });
    });
  }

  getPolicies() {
    return this.database.policySetting.findMany({ orderBy: { key: 'asc' } });
  }

  upsertPolicy(key: string, value: boolean | string | string[]) {
    return this.database.policySetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
