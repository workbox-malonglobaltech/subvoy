import { Request, Response, NextFunction } from 'express';
import { logError } from '../services/error-logger.service';
import { checkAndAlert } from '../services/admin-alert.service';

interface AppError extends Error {
  status?: number;
  /** Set to true on errors that have safe, user-facing messages */
  expose?: boolean;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = err.status ?? 500;

  // Persist to DB + console — fire-and-forget
  logError({
    level:      status >= 500 ? 'error' : 'warn',
    message:    err.message,
    error:      err,
    route:      req.path,
    method:     req.method,
    statusCode: status,
    userId:     req.user?.id,
  });

  // Trigger admin alert if error rate crosses threshold
  if (status >= 500) {
    checkAndAlert({ route: req.path });
  }

  // For 5xx errors, never reveal internal details to the client
  // For 4xx errors with expose:true, the message is intentionally user-facing
  const isClientError = status >= 400 && status < 500;
  const clientMessage = (isClientError && err.expose !== false)
    ? (err.message ?? 'Bad request')
    : 'Internal Server Error';

  res.status(status).json({
    success: false,
    data:    null,
    error:   clientMessage,
  });
}
