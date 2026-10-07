import { Handler } from 'aws-cdk-lib/aws-lambda';
import { handle, HttpError } from '../util/http';
import { withClient } from '../util/db';
import { requireUser } from '../util/auth';
import { getLeaderboard } from '../services/events';

export const handler: Handler = async (event: any) => handle(event, async (body) => {
  const eventId = Number(body.eventId);
  if (!eventId) throw new HttpError('Event is required');
  return withClient(async (client) => {
    const viewerId = body.token ? (await requireUser(client, body)).id : null;
    return getLeaderboard(client, eventId, viewerId);
  });
});
