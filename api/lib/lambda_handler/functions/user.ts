import { Handler } from 'aws-cdk-lib/aws-lambda';
import { handle, HttpError } from '../util/http';
import { withClient } from '../util/db';
import { requireUser } from '../util/auth';
import { defaultDisplayName } from '../scoring/scoring';

export const handler: Handler = async (event: any) => handle(event, async (body) => {
  return withClient(async (client) => {
    const user = await requireUser(client, body);
    if (event.httpMethod === 'POST') return { user };

    const firstName = String(body.firstName ?? user.firstName).trim();
    const lastName = String(body.lastName ?? user.lastName).trim();
    const displayName = String(body.displayName || defaultDisplayName(firstName, lastName)).trim();
    const handicapIndex = Number(body.handicapIndex ?? user.handicapIndex);
    const profilePictureUrl = body.profilePictureUrl?.trim?.() || null;
    if (!firstName || !lastName || !displayName) throw new HttpError('Name is required');
    if (!Number.isFinite(handicapIndex) || handicapIndex < -10 || handicapIndex > 54) {
      throw new HttpError('Enter a handicap index from -10 to 54');
    }

    const updated = await client.query(
      `
        UPDATE app_user
        SET first_name = $2, last_name = $3, display_name = $4, handicap_index = $5, profile_picture_url = $6
        WHERE id = $1
        RETURNING id, username, first_name AS "firstName", last_name AS "lastName",
                  display_name AS "displayName", handicap_index::float AS "handicapIndex",
                  profile_picture_url AS "profilePictureUrl"
      `,
      [user.id, firstName, lastName, displayName, handicapIndex, profilePictureUrl]
    );
    return { user: updated.rows[0] };
  });
});
