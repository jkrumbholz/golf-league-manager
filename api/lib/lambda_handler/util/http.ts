import { LambdaApiUtil } from './LambdaApiUtil';

export class HttpError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function parseBody(event: any): any {
  if (!event?.body) return {};
  if (typeof event.body === 'object') return event.body;
  return JSON.parse(event.body);
}

export async function handle(event: any, fn: (body: any) => Promise<any>) {
  try {
    const result = await fn(parseBody(event));
    return LambdaApiUtil.buildResponse(200, result);
  } catch (err: any) {
    const status = err instanceof HttpError ? err.statusCode : 500;
    if (status === 500) console.error(err);
    return LambdaApiUtil.buildResponse(status, {
      error: status === 500 ? 'Internal server error' : err.message,
    });
  }
}
