import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../../errors.js';
import type { PublicUser } from './auth.types.js';
import type { AuthUseCases } from './use-cases/auth.use-cases.js';

declare global {
  namespace Express {
    interface Locals {
      actor?: { user: PublicUser; sessionId: string };
    }
  }
}

export function authenticate(auth: AuthUseCases): RequestHandler {
  return async (request, response, next) => {
    const accessToken = readBearerToken(request.headers.authorization);
    response.locals.actor = await auth.authenticate(accessToken);
    next();
  };
}

export function requirePermission(permission: string): RequestHandler {
  return (_request, response, next) => {
    const actor = response.locals.actor;

    if (!actor) {
      throw unauthorized();
    }

    if (!actor.user.permissions.includes(permission)) {
      throw forbidden();
    }

    next();
  };
}

function readBearerToken(authorizationHeader?: string) {
  const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(authorizationHeader ?? '');
  const token = match?.[1];

  if (!token || token.length > 4096) {
    throw unauthorized();
  }

  return token;
}
