import { Handler } from 'aws-cdk-lib/aws-lambda';
import { handle, HttpError } from '../util/http';
import { withClient } from '../util/db';
import { requireUser } from '../util/auth';
import { listEvents } from '../services/events';

export const handler: Handler = async (event: any) => handle(event, async (body) => {
  const seasonId = Number(body.seasonId);
  if (!seasonId) throw new HttpError('Season is required');
  return withClient(async (client) => {
    const user = await requireUser(client, body);
    return listEvents(client, user, seasonId);
  });
});
