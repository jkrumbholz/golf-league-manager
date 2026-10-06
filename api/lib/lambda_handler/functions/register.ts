import { Handler } from 'aws-cdk-lib/aws-lambda';
import { handle, HttpError } from '../util/http';
import { withClient } from '../util/db';
import { hashPassword, newToken } from '../util/password';
import { defaultDisplayName } from '../scoring/scoring';

export const handler: Handler = async (event: any) => handle(event, async (body) => {
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();
  const handicapIndex = Number(body.handicapIndex ?? 0);
  if (!username || !password || !firstName || !lastName) {
    throw new HttpError('Username, password, first name, and last name are required');
  }
  if (password.length < 6) throw new HttpError('Use at least 6 characters for the password');
  if (!Number.isFinite(handicapIndex) || handicapIndex < -10 || handicapIndex > 54) {
    throw new HttpError('Enter a handicap from 0 to 54, or a plus index up to +10');
  }

  const displayName = defaultDisplayName(firstName, lastName);
  const passwordHash = await hashPassword(password);

  return withClient(async (client) => {
    try {
      const inserted = await client.query(
        `
          INSERT INTO app_user (username, password_hash, first_name, last_name, display_name, handicap_index)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, username, first_name AS "firstName", last_name AS "lastName",
                    display_name AS "displayName", handicap_index::float AS "handicapIndex",
                    profile_picture_url AS "profilePictureUrl"
        `,
        [username, passwordHash, firstName, lastName, displayName, handicapIndex]
      );
      const user = inserted.rows[0];
      const token = newToken();
      await client.query(
        `INSERT INTO user_session (token, user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
        [token, user.id]
      );
      return { isSuccess: true, token, user };
    } catch (error: any) {
      if (error?.code === '23505') throw new HttpError('That username is already taken');
      throw error;
    }
  });
});
