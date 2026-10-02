import { Handler } from 'aws-cdk-lib/aws-lambda';
import { handle } from '../util/http';
import { withClient } from '../util/db';
import { requireUser } from '../util/auth';
import { deletePayout, savePayout } from '../services/events';

export const handler: Handler = async (event: any) => handle(event, async (body) => {
  return withClient(async (client) => {
    const user = await requireUser(client, body);
    if (event.httpMethod === 'DELETE') return deletePayout(client, user, body);
    return savePayout(client, user, body);
  });
});
