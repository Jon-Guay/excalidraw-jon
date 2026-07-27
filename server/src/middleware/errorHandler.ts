import type { NextFunction, Request, Response } from "express";

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const message =
    error instanceof Error ? error.message : "Internal server error";
  const status = error instanceof HttpError ? error.status : (500 as const);

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({ error: message });
};

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}
