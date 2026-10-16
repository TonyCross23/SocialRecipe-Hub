import type { Request, Response } from 'express';
import {
  createReportDto,
  policyKeyParamsDto,
  reportIdParamsDto,
  reportPaginationDto,
  reportActionDto,
  updatePolicyDto,
  updateReportDto,
  validatePolicyValue,
} from '../dto/moderation.dto.js';
import type { ModerationUseCases } from '../use-cases/moderation.use-cases.js';

export class ModerationController {
  constructor(private readonly moderation: ModerationUseCases) {}

  createReport = async (request: Request, response: Response) => {
    const input = createReportDto.parse(request.body);
    const report = await this.moderation.createReport(response.locals.actor!.user.id, input);
    response.status(201).json({ report });
  };

  reports = async (request: Request, response: Response) => {
    const { page, limit, status } = reportPaginationDto.parse(request.query);
    response.json(await this.moderation.getReports(page, limit, status));
  };

  updateReport = async (request: Request, response: Response) => {
    const { reportId } = reportIdParamsDto.parse(request.params);
    const { status } = updateReportDto.parse(request.body);
    const report = await this.moderation.updateReportStatus(reportId, status);
    response.json({ report });
  };

  actionReport = async (request: Request, response: Response) => {
    const { reportId } = reportIdParamsDto.parse(request.params);
    const { action, reason } = reportActionDto.parse(request.body);
    const report = await this.moderation.actionReport(reportId, action, reason);
    response.json({ report });
  };

  policies = async (_request: Request, response: Response) => {
    response.json({ data: await this.moderation.getPolicies() });
  };

  updatePolicy = async (request: Request, response: Response) => {
    const { key } = policyKeyParamsDto.parse(request.params);
    const { value } = updatePolicyDto.parse(request.body);
    const policy = await this.moderation.updatePolicy(key, validatePolicyValue(key, value));
    response.json({ policy });
  };
}
