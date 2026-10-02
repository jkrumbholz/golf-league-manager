import { Handler } from 'aws-cdk-lib/aws-lambda';
import { handle, HttpError } from '../util/http';
import { withClient } from '../util/db';
import { publicSignup } from '../services/events';

export const handler: Handler = async (event: any) => handle(event, async (body) => {
  const signupToken = String(body.signupToken || '');
  if (!signupToken) throw new HttpError('Signup link is required');
  return withClient(async (client) => publicSignup(client, signupToken));
});
