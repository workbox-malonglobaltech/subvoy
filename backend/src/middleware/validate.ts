import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = (result.error as ZodError).issues
        .map(i => `${i.path.join('.') || 'field'}: ${i.message}`)
        .join(', ');
      res.status(400).json({ success: false, data: null, error: message });
      return;
    }
    req.body = result.data;
    next();
  };
}
