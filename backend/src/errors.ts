export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = () =>
  new AppError(401, 'UNAUTHORIZED', 'Invalid or expired credentials');

export const forbidden = () =>
  new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action');

export const notFound = (resource: string) =>
  new AppError(404, 'NOT_FOUND', `${resource} was not found`);

export const conflict = (code: string, message: string) => new AppError(409, code, message);
