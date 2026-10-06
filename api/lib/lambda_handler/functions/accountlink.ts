import { Handler } from 'aws-cdk-lib/aws-lambda';
import { handle, HttpError } from '../util/http';
import { withClient } from '../util/db';
import { claimAccountLink, previewAccountLink } from '../services/events';

export const handler: Handler = async (event: any) => handle(event, async (body) => {
  const token = String(body.token || '');
  if (!token) throw new HttpError('This link is not valid', 404);
  return withClient(async (client) => {
    if (body.password == null || body.password === '') return previewAccountLink(client, token);
    return claimAccountLink(client, body);
  });
});
