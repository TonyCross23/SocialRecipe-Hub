import type { Request, Response } from 'express';
import { paginationDto, userIdParamsDto } from '../dto/social.dto.js';
import type { SocialUseCases } from '../use-cases/social.use-cases.js';

export class SocialController {
  constructor(private readonly social: SocialUseCases) {}

  follow = async (request: Request, response: Response) => {
    const { userId } = userIdParamsDto.parse(request.params);
    const result = await this.social.follow(response.locals.actor!.user.id, userId);

    response.json(result);
  };

  unfollow = async (request: Request, response: Response) => {
    const { userId } = userIdParamsDto.parse(request.params);
    const result = await this.social.unfollow(response.locals.actor!.user.id, userId);

    response.json(result);
  };

  followers = async (request: Request, response: Response) => {
    const { userId } = userIdParamsDto.parse(request.params);
    const { page, limit } = paginationDto.parse(request.query);
    const result = await this.social.getFollowers(
      userId,
      page,
      limit,
      response.locals.actor!.user.id,
    );

    response.json(result);
  };

  following = async (request: Request, response: Response) => {
    const { userId } = userIdParamsDto.parse(request.params);
    const { page, limit } = paginationDto.parse(request.query);
    const result = await this.social.getFollowing(
      userId,
      page,
      limit,
      response.locals.actor!.user.id,
    );

    response.json(result);
  };
}
