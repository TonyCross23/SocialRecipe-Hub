import type { Request, Response } from 'express';
import { loginDto, logoutDto, refreshTokenDto, registerDto } from '../dto/auth.dto.js';
import type { AuthUseCases } from '../use-cases/auth.use-cases.js';

export class AuthController {
  constructor(private readonly auth: AuthUseCases) {}

  register = async (request: Request, response: Response) => {
    const input = registerDto.parse(request.body);
    const result = await this.auth.register(input);

    response.status(201).json(result);
  };

  login = async (request: Request, response: Response) => {
    const input = loginDto.parse(request.body);
    const result = await this.auth.login(input);

    response.json(result);
  };

  refresh = async (request: Request, response: Response) => {
    const { refreshToken } = refreshTokenDto.parse(request.body);
    const result = await this.auth.refresh(refreshToken);

    response.json(result);
  };

  me = (_request: Request, response: Response) => {
    response.json({ user: response.locals.actor!.user });
  };

  logout = async (request: Request, response: Response) => {
    logoutDto.parse(request.body ?? {});

    const actor = response.locals.actor!;
    await this.auth.logout(actor.sessionId, actor.user.id);

    response.status(204).end();
  };
}
