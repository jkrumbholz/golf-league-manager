import { Handler } from 'aws-cdk-lib/aws-lambda';
import { handle, HttpError } from '../util/http';
import { withClient } from '../util/db';
import { requireUser } from '../util/auth';
import { getScorecard } from '../services/events';

export const handler: Handler = async (event: any) => handle(event, async (body) => {
  const roundId = Number(body.roundId);
  if (!roundId) throw new HttpError('Round is required');
  return withClient(async (client) => {
    const user = await requireUser(client, body);
    const teamId = body.teamId == null || body.teamId === '' ? null : Number(body.teamId);
    const groupId = body.groupId == null || body.groupId === '' ? null : Number(body.groupId);
    return getScorecard(client, user, roundId, teamId, groupId);
  });
});
