import { notFound } from '../../../errors.js';
import type { ReportStatus } from '../../../generated/prisma/enums.js';
import type { CreateReportData } from '../moderation.types.js';
import type { ModerationService } from '../services/moderation.service.js';

export class ModerationUseCases {
  constructor(private readonly moderation: ModerationService) {}

  async createReport(reporterId: string, input: CreateReportData) {
    if (input.postId && !(await this.moderation.postExists(input.postId))) {
      throw notFound('Post');
    }
    if (input.commentId && !(await this.moderation.commentExists(input.commentId))) {
      throw notFound('Comment');
    }

    return this.moderation.createReport(reporterId, input);
  }

  getReports(page: number, limit: number, status?: ReportStatus) {
    return this.moderation.getReports(page, limit, status);
  }

  async updateReportStatus(reportId: string, status: ReportStatus) {
    const report = await this.moderation.updateReportStatus(reportId, status);
    if (!report) {
      throw notFound('Report');
    }
    return report;
  }

  async actionReport(reportId: string, action: 'DISMISS' | 'BAN_CONTENT', reason: string) {
    const report = await this.moderation.actionReport(reportId, action, reason, new Date());
    if (!report) throw notFound('Report');
    return report;
  }

  getPolicies() {
    return this.moderation.getPolicies();
  }

  updatePolicy(key: string, value: boolean | string | string[]) {
    return this.moderation.updatePolicy(key, value);
  }
}
