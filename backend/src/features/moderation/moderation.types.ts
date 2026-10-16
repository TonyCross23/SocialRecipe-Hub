import type { ReportStatus } from '../../generated/prisma/enums.js';

export interface CreateReportData {
  reason: string;
  postId?: string;
  commentId?: string;
}

export interface ReportView {
  id: string;
  reason: string;
  status: ReportStatus;
  reporterId: string;
  postId: string | null;
  commentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyView {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportPage {
  data: ReportView[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ModerationRepository {
  postExists(postId: string): Promise<boolean>;
  commentExists(commentId: string): Promise<boolean>;
  createReport(reporterId: string, input: CreateReportData): Promise<ReportView>;
  getReports(page: number, limit: number, status?: ReportStatus): Promise<ReportPage>;
  updateReportStatus(reportId: string, status: ReportStatus): Promise<ReportView | null>;
  actionReport(
    reportId: string,
    action: 'DISMISS' | 'BAN_CONTENT',
    reason: string,
    now: Date,
  ): Promise<ReportView | null>;
  getPolicies(): Promise<PolicyView[]>;
  upsertPolicy(key: string, value: boolean | string | string[]): Promise<PolicyView>;
}
