import { Client } from 'pg';
import { HttpError } from './http';

export interface AuthUser {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  handicapIndex: number;
  profilePictureUrl: string | null;
}

const userColumns = `
  u.id,
  u.username,
  u.first_name AS "firstName",
  u.last_name AS "lastName",
  u.display_name AS "displayName",
  u.handicap_index::float AS "handicapIndex",
  u.profile_picture_url AS "profilePictureUrl"
`;

export async function requireUser(client: Client, body: any): Promise<AuthUser> {
  const token = body?.token;
  if (!token || typeof token !== 'string') {
    throw new HttpError('Sign in required', 401);
  }

  const result = await client.query<AuthUser>(
    `
      SELECT ${userColumns}
      FROM user_session s
      JOIN app_user u ON u.id = s.user_id
      WHERE s.token = $1 AND s.expires_at > NOW()
    `,
    [token]
  );

  if (result.rows.length === 0) {
    throw new HttpError('Sign in required', 401);
  }

  return result.rows[0];
}

export async function memberRole(client: Client, leagueId: number, userId: number): Promise<string | null> {
  const result = await client.query(
    `SELECT role FROM league_member WHERE league_id = $1 AND user_id = $2`,
    [leagueId, userId]
  );
  return result.rows[0]?.role ?? null;
}

export async function assertOrganizer(client: Client, leagueId: number, userId: number): Promise<void> {
  const role = await memberRole(client, leagueId, userId);
  if (role !== 'organizer') {
    throw new HttpError('Only a league organizer can do that', 403);
  }
}

export async function leagueIdForEvent(client: Client, eventId: number): Promise<number> {
  const result = await client.query(
    `
      SELECT s.league_id AS "leagueId"
      FROM event e
      JOIN season s ON s.id = e.season_id
      WHERE e.id = $1
    `,
    [eventId]
  );
  if (result.rows.length === 0) throw new HttpError('Event not found', 404);
  return Number(result.rows[0].leagueId);
}

export async function assertLeagueMember(client: Client, leagueId: number, userId: number): Promise<string> {
  const role = await memberRole(client, leagueId, userId);
  if (!role) throw new HttpError('You are not in this league', 403);
  return role;
}
