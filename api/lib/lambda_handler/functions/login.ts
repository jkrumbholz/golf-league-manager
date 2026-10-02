import { Handler } from 'aws-cdk-lib/aws-lambda';
import { handle, HttpError } from '../util/http';
import { withClient } from '../util/db';
import { newToken, verifyPassword } from '../util/password';

export const handler: Handler = async (event: any) => handle(event, async (body) => {
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!username || !password) throw new HttpError('Enter your username and password');

  return withClient(async (client) => {
    const result = await client.query(
      `
        SELECT id, username, password_hash, first_name AS "firstName", last_name AS "lastName",
               display_name AS "displayName", handicap_index::float AS "handicapIndex",
               profile_picture_url AS "profilePictureUrl"
        FROM app_user WHERE username = $1
      `,
      [username]
    );
    const row = result.rows[0];
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      return { isSuccess: false };
    }

    const token = newToken();
    await client.query(
      `INSERT INTO user_session (token, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
      [token, row.id]
    );
    return {
      isSuccess: true,
      token,
      user: {
        id: row.id,
        username: row.username,
        firstName: row.firstName,
        lastName: row.lastName,
        displayName: row.displayName,
        handicapIndex: row.handicapIndex,
        profilePictureUrl: row.profilePictureUrl,
      },
    };
  });
});
