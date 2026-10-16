import type { CreateReportData, ModerationRepository } from '../moderation.types.js';
import type { ReportStatus } from '../../../generated/prisma/enums.js';

export class ModerationService {
  constructor(private readonly repository: ModerationRepository) {}

  postExists(postId: string) {
    return this.repository.postExists(postId);
  }

  commentExists(commentId: string) {
    return this.repository.commentExists(commentId);
  }

  createReport(reporterId: string, input: CreateReportData) {
    return this.repository.createReport(reporterId, input);
  }

  getReports(page: number, limit: number, status?: ReportStatus) {
    return this.repository.getReports(page, limit, status);
  }

  updateReportStatus(reportId: string, status: ReportStatus) {
    return this.repository.updateReportStatus(reportId, status);
  }

  actionReport(reportId: string, action: 'DISMISS' | 'BAN_CONTENT', reason: string, now: Date) {
    return this.repository.actionReport(reportId, action, reason, now);
  }

  getPolicies() {
    return this.repository.getPolicies();
  }

  updatePolicy(key: string, value: boolean | string | string[]) {
    return this.repository.upsertPolicy(key, value);
  }
}
