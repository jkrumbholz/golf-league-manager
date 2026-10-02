import { Handler } from 'aws-cdk-lib/aws-lambda';
import { handle } from '../util/http';
import { withClient } from '../util/db';

export const handler: Handler = async (event: any) => handle(event, async (body) => {
  if (!body.token) return { isSuccess: true };
  return withClient(async (client) => {
    await client.query(`DELETE FROM user_session WHERE token = $1`, [body.token]);
    return { isSuccess: true };
  });
});
