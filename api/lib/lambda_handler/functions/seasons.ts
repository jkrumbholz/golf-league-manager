import { Handler } from 'aws-cdk-lib/aws-lambda';
import { handle, HttpError } from '../util/http';
import { withClient } from '../util/db';
import { requireUser } from '../util/auth';
import { listSeasons } from '../services/events';

export const handler: Handler = async (event: any) => handle(event, async (body) => {
  const leagueId = Number(body.leagueId);
  if (!leagueId) throw new HttpError('League is required');
  return withClient(async (client) => {
    const user = await requireUser(client, body);
    return listSeasons(client, user, leagueId);
  });
});
