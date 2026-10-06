import { Client } from 'pg';
import { AuthUser, assertLeagueMember, assertOrganizer, leagueIdForEvent } from '../util/auth';
import { HttpError } from '../util/http';
import { hashPassword, newToken } from '../util/password';
import {
  CompetitorTotal,
  EventFormat,
  FORMAT_LABELS,
  HoleGross,
  HoleSetup,
  LadderTee,
  LeaderboardRow,
  orderLeaderboard,
  orderFromStartingHole,
  latestPlayedHole,
  PlayerSetup,
  TeamSetup,
  combineRounds,
  fixedTeamSize,
  individualPlayingHandicap,
  isKnownFormat,
  isTeamFormat,
  isTeamGrossFormat,
  keepQuotaError,
  defaultDisplayName,
  mergeGroupHoles,
  orderScoreLines,
  scoreRound,
  teamNameFromPlayers,
  usesRunningTee,
} from '../scoring/scoring';

interface EventRow {
  id: number;
  seasonId: number;
  leagueId: number;
  leagueName: string;
  name: string;
  format: EventFormat;
  courseConfigurationId: number | null;
  facilityId: number | null;
  entryFee: number;
  startDate: string;
  endDate: string;
  playersPickTeams: boolean;
  teamSize: number;
  signupToken: string;
  ctpEnabled: boolean;
  ctpEntryFee: number;
  longDriveEnabled: boolean;
  longDriveEntryFee: number;
  handicapAllowance: number;
}

interface RoundRow {
  id: number;
  roundNumber: number;
  playDate: string;
  courseConfigurationId: number | null;
}

interface TeeRow {
  id: number;
  roundId: number;
  platformTeeSetId: number;
  name: string;
  hexColorCode: string | null;
  ladderOrder: number;
}

interface HoleRow {
  roundId: number;
  sequence: number;
  platformHoleId: number;
  displayHoleNumber: number | null;
  par: number;
  strokeIndex: number | null;
  defaultLadderOrder: number | null;
  defaultTeeSetId: number | null;
}

interface RegistrationRow {
  userId: number;
  displayName: string;
  firstName: string;
  lastName: string;
  handicapIndex: number;
  profileHandicapIndex: number;
  paid: boolean;
  ctpEntered: boolean;
  longDriveEntered: boolean;
  ctpPaid: boolean;
  longDrivePaid: boolean;
}

interface GroupMemberRow {
  userId: number | null;
  teamId: number | null;
  displayName: string;
}

interface GroupRow {
  id: number;
  teeTime: string | null;
  startingHole: number;
  members: GroupMemberRow[];
}

interface Bundle {
  event: EventRow;
  rounds: RoundRow[];
  teeSets: TeeRow[];
  holes: HoleRow[];
  registrations: RegistrationRow[];
  teams: Array<TeamSetup & { members: PlayerSetup[] }>;
  groups: GroupRow[];
  scores: Array<HoleGross & { roundId: number }>;
  payouts: Array<{
    id: number;
    userId: number | null;
    teamId: number | null;
    place: number | null;
    amount: number;
    description: string | null;
  }>;
  sideGames: {
    closestToPinWinnerUserId: number | null;
    longDriveWinnerUserId: number | null;
  };
}

function asNumber(value: any, fallback: number | null = null): number | null {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function requireText(value: any, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(`${label} is required`);
  }
  return value.trim();
}

export async function listLeagues(client: Client, userId: number) {
  const result = await client.query(
    `
      SELECT
        l.id,
        l.name,
        l.description,
        l.logo_image_url AS "logoImageUrl",
        l.entry_fee::float AS "entryFee",
        l.home_facility_id AS "homeFacilityId",
        m.role,
        (
          SELECT s.name
          FROM season s
          WHERE s.league_id = l.id
          ORDER BY s.start_date DESC
          LIMIT 1
        ) AS "currentSeasonName",
        (SELECT COUNT(*) FROM season s WHERE s.league_id = l.id)::int AS "seasonCount",
        (SELECT COUNT(*) FROM league_member lm WHERE lm.league_id = l.id)::int AS "playerCount",
        (
          SELECT e.id
          FROM event e
          JOIN season s ON s.id = e.season_id
          WHERE s.league_id = l.id
            AND e.deleted_at IS NULL
            AND CURRENT_DATE BETWEEN e.start_date AND e.end_date
          ORDER BY e.start_date, e.id
          LIMIT 1
        ) AS "liveEventId"
      FROM league l
      JOIN league_member m ON m.league_id = l.id
      WHERE m.user_id = $1
      ORDER BY l.name
    `,
    [userId]
  );
  return result.rows;
}

export async function saveLeague(client: Client, user: AuthUser, body: any) {
  if (body.action === 'searchPlayers') return searchLeaguePlayers(client, user, body);
  if (body.action === 'addPlayer') return addLeaguePlayer(client, user, body);
  if (body.action === 'removePlayer') return removeLeaguePlayer(client, user, body);
  if (body.action === 'createPlayer') return createLeaguePlayer(client, user, body);
  if (body.action === 'updatePlayer') return updateLeaguePlayer(client, user, body);
  if (body.action === 'accountLink') return createAccountLink(client, user, body);
  if (body.action === 'addToLeague') return addGuestToLeague(client, user, body);
  if (body.action === 'setLogo') return setLeagueLogo(client, user, body);

  const name = requireText(body.name, 'League name');
  const description = body.description?.trim?.() || null;
  const logoImageUrl = body.logoImageUrl?.trim?.() || null;
  const entryFee = asNumber(body.entryFee, 0) ?? 0;
  const homeFacilityId = asNumber(body.homeFacilityId);

  if (body.id) {
    const leagueId = Number(body.id);
    await assertOrganizer(client, leagueId, user.id);
    const result = await client.query(
      `
        UPDATE league
        SET name = $2,
            description = $3,
            logo_image_url = $4,
            entry_fee = $5,
            home_facility_id = $6
        WHERE id = $1
        RETURNING id
      `,
      [leagueId, name, description, logoImageUrl, entryFee, homeFacilityId]
    );
    return { id: result.rows[0].id };
  }

  const inserted = await client.query(
    `
      INSERT INTO league (name, description, logo_image_url, entry_fee, home_facility_id, created_by_user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [name, description, logoImageUrl, entryFee, homeFacilityId, user.id]
  );
  const leagueId = inserted.rows[0].id;
  await client.query(
    `INSERT INTO league_member (league_id, user_id, role) VALUES ($1, $2, 'organizer')`,
    [leagueId, user.id]
  );
  return { id: leagueId };
}

async function setLeagueLogo(client: Client, user: AuthUser, body: any) {
  const leagueId = Number(body.leagueId);
  if (!leagueId) throw new HttpError('League is required');
  await assertOrganizer(client, leagueId, user.id);
  const logoImageUrl = body.logoImageUrl?.trim?.() || null;
  const result = await client.query(
    `UPDATE league SET logo_image_url = $2 WHERE id = $1 RETURNING id`,
    [leagueId, logoImageUrl]
  );
  if (result.rows.length === 0) throw new HttpError('League not found', 404);
  return { id: leagueId, logoImageUrl };
}

async function searchLeaguePlayers(client: Client, user: AuthUser, body: any) {
  const leagueId = Number(body.leagueId);
  await assertOrganizer(client, leagueId, user.id);
  const query = String(body.query || '').trim();
  if (query.length < 2) throw new HttpError('Type at least 2 characters');
  const pattern = `%${query.replace(/[%_]/g, '')}%`;
  const result = await client.query(
    `
      SELECT u.id AS "userId", u.username,
             u.first_name AS "firstName", u.last_name AS "lastName",
             u.display_name AS "displayName",
             u.handicap_index::float AS "handicapIndex"
      FROM app_user u
      WHERE (
          u.username ILIKE $2
          OR u.display_name ILIKE $2
          OR u.first_name ILIKE $2
          OR u.last_name ILIKE $2
          OR (u.first_name || ' ' || u.last_name) ILIKE $2
        )
        AND NOT EXISTS (
          SELECT 1 FROM league_member m
          WHERE m.league_id = $1 AND m.user_id = u.id
        )
      ORDER BY u.last_name, u.first_name
      LIMIT 15
    `,
    [leagueId, pattern]
  );
  return result.rows;
}

async function addLeaguePlayer(client: Client, user: AuthUser, body: any) {
  const leagueId = Number(body.leagueId);
  await assertOrganizer(client, leagueId, user.id);
  const userId = Number(body.userId);
  if (!userId) throw new HttpError('Choose a player');
  const found = await client.query(`SELECT id FROM app_user WHERE id = $1`, [userId]);
  if (found.rows.length === 0) throw new HttpError('Player not found', 404);
  await client.query(
    `
      INSERT INTO league_member (league_id, user_id, role)
      VALUES ($1, $2, 'player')
      ON CONFLICT (league_id, user_id) DO NOTHING
    `,
    [leagueId, userId]
  );
  return { leagueId };
}

async function removeLeaguePlayer(client: Client, user: AuthUser, body: any) {
  const leagueId = Number(body.leagueId);
  await assertOrganizer(client, leagueId, user.id);
  const userId = Number(body.userId);
  if (!userId) throw new HttpError('Choose a player');
  const member = await client.query(
    `SELECT role FROM league_member WHERE league_id = $1 AND user_id = $2`,
    [leagueId, userId]
  );
  if (member.rows.length === 0) throw new HttpError('That player is not in this league', 404);
  if (member.rows[0].role === 'organizer') {
    const organizers = await client.query(
      `SELECT COUNT(*)::int AS count FROM league_member WHERE league_id = $1 AND role = 'organizer'`,
      [leagueId]
    );
    if (Number(organizers.rows[0].count) <= 1) {
      throw new HttpError('Keep at least one organizer on this league');
    }
  }
  await client.query(
    `DELETE FROM league_member WHERE league_id = $1 AND user_id = $2`,
    [leagueId, userId]
  );
  return { leagueId };
}

async function addGuestToLeague(client: Client, user: AuthUser, body: any) {
  const leagueId = Number(body.leagueId);
  await assertOrganizer(client, leagueId, user.id);
  const userId = Number(body.userId);
  if (!userId) throw new HttpError('Choose a player');
  const played = await client.query(
    `
      SELECT u.username
      FROM event_registration r
      JOIN event e ON e.id = r.event_id
      JOIN season s ON s.id = e.season_id
      JOIN app_user u ON u.id = r.user_id
      WHERE r.user_id = $1 AND s.league_id = $2
      LIMIT 1
    `,
    [userId, leagueId]
  );
  if (played.rows.length === 0) throw new HttpError('That guest has not played an event in this league', 404);
  await client.query(
    `
      INSERT INTO league_member (league_id, user_id, role)
      VALUES ($1, $2, 'player')
      ON CONFLICT (league_id, user_id) DO NOTHING
    `,
    [leagueId, userId]
  );
  if (played.rows[0].username != null) return { leagueId, userId, token: null };
  const link = await issueAccountLink(client, userId, 'setup');
  return { leagueId, userId, token: link.token };
}

async function createLeaguePlayer(client: Client, user: AuthUser, body: any) {
  const leagueId = Number(body.leagueId);
  await assertOrganizer(client, leagueId, user.id);
  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();
  const handicapIndex = Number(body.handicapIndex ?? 0);
  if (!firstName || !lastName) throw new HttpError('First name and last name are required');
  if (!Number.isFinite(handicapIndex) || handicapIndex < -10 || handicapIndex > 54) {
    throw new HttpError('Enter a handicap from 0 to 54, or a plus index up to +10');
  }

  const inserted = await client.query(
    `
      INSERT INTO app_user (first_name, last_name, display_name, handicap_index)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [firstName, lastName, defaultDisplayName(firstName, lastName), handicapIndex]
  );
  const userId = Number(inserted.rows[0].id);
  await client.query(
    `INSERT INTO league_member (league_id, user_id, role) VALUES ($1, $2, 'player')`,
    [leagueId, userId]
  );
  const link = await issueAccountLink(client, userId, 'setup');
  return { leagueId, userId, ...link };
}

async function createAccountLink(client: Client, user: AuthUser, body: any) {
  const leagueId = Number(body.leagueId);
  await assertOrganizer(client, leagueId, user.id);
  const userId = Number(body.userId);
  if (!userId) throw new HttpError('Choose a player');
  const member = await client.query(
    `SELECT u.username FROM league_member m JOIN app_user u ON u.id = m.user_id WHERE m.league_id = $1 AND m.user_id = $2`,
    [leagueId, userId]
  );
  if (member.rows.length === 0) throw new HttpError('That player is not in this league', 404);
  const purpose = body.purpose === 'reset' ? 'reset' : 'setup';
  const hasLogin = member.rows[0].username != null;
  if (purpose === 'setup' && hasLogin) {
    throw new HttpError('This player already has a login. Send a password reset link.');
  }
  if (purpose === 'reset' && !hasLogin) {
    throw new HttpError('This player has not chosen a login yet. Send the setup link.');
  }
  return issueAccountLink(client, userId, purpose);
}

async function issueAccountLink(client: Client, userId: number, purpose: 'setup' | 'reset') {
  try {
    await client.query(
      `UPDATE account_link SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
      [userId]
    );
    const token = newToken();
    const inserted = await client.query(
      `
        INSERT INTO account_link (token, user_id, purpose, expires_at)
        VALUES ($1, $2, $3, NOW() + INTERVAL '3 days')
        RETURNING expires_at::text AS "expiresAt"
      `,
      [token, userId, purpose]
    );
    return { token, purpose, expiresAt: inserted.rows[0].expiresAt };
  } catch (error: any) {
    if (error?.code === '42P01') {
      throw new HttpError('Setup links are not ready yet. Run database/11_account_link.sql, then try again.');
    }
    throw error;
  }
}

export async function previewAccountLink(client: Client, token: string) {
  const link = await loadAccountLink(client, token);
  return {
    purpose: link.purpose,
    displayName: link.displayName,
    username: link.purpose === 'reset' ? link.username : null,
  };
}

export async function claimAccountLink(client: Client, body: any) {
  const token = String(body.token || '');
  const password = String(body.password || '');
  if (password.length < 8) throw new HttpError('Use at least 8 characters for the password');
  const link = await loadAccountLink(client, token);
  const passwordHash = await hashPassword(password);

  if (link.purpose === 'setup') {
    const username = String(body.username || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      throw new HttpError('Use 3 to 40 letters, numbers, dots, or dashes for the username');
    }
    try {
      await client.query(
        `UPDATE app_user SET username = $2, password_hash = $3 WHERE id = $1`,
        [link.userId, username, passwordHash]
      );
    } catch (error: any) {
      if (error?.code === '23505') throw new HttpError('That username is already taken');
      throw error;
    }
  } else {
    await client.query(`UPDATE app_user SET password_hash = $2 WHERE id = $1`, [link.userId, passwordHash]);
    await client.query(`DELETE FROM user_session WHERE user_id = $1`, [link.userId]);
  }

  await client.query(`UPDATE account_link SET used_at = NOW() WHERE token = $1`, [token]);
  return { ok: true };
}

async function loadAccountLink(client: Client, token: string) {
  if (!token) throw new HttpError('This link is not valid', 404);
  const found = await client.query(
    `
      SELECT l.purpose, l.expires_at AS "expiresAt", l.used_at AS "usedAt",
             u.id AS "userId", u.username, u.display_name AS "displayName"
      FROM account_link l
      JOIN app_user u ON u.id = l.user_id
      WHERE l.token = $1
    `,
    [token]
  );
  const link = found.rows[0];
  if (!link) throw new HttpError('This link is not valid. Ask your organizer for a new one.', 404);
  if (link.usedAt) throw new HttpError('This link has already been used. Ask your organizer for a new one.', 404);
  if (new Date(link.expiresAt).getTime() <= Date.now()) {
    throw new HttpError('This link has expired. Ask your organizer for a new one.', 404);
  }
  return link;
}

async function updateLeaguePlayer(client: Client, user: AuthUser, body: any) {
  const leagueId = Number(body.leagueId);
  await assertOrganizer(client, leagueId, user.id);
  const userId = Number(body.userId);
  if (!userId) throw new HttpError('Choose a player');
  const member = await client.query(
    `SELECT 1 FROM league_member WHERE league_id = $1 AND user_id = $2`,
    [leagueId, userId]
  );
  if (member.rows.length === 0) throw new HttpError('That player is not in this league', 404);

  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();
  const displayName = String(body.displayName || defaultDisplayName(firstName, lastName)).trim();
  const handicapIndex = Number(body.handicapIndex);
  if (!firstName || !lastName || !displayName) throw new HttpError('Name is required');
  if (!Number.isFinite(handicapIndex) || handicapIndex < -10 || handicapIndex > 54) {
    throw new HttpError('Enter a handicap from 0 to 54, or a plus index up to +10');
  }

  await client.query(
    `
      UPDATE app_user
      SET first_name = $2, last_name = $3, display_name = $4, handicap_index = $5
      WHERE id = $1
    `,
    [userId, firstName, lastName, displayName, handicapIndex]
  );
  return { userId, firstName, lastName, displayName, handicapIndex };
}

export async function listSeasons(client: Client, user: AuthUser, leagueId: number) {
  await assertLeagueMember(client, leagueId, user.id);
  const seasons = await client.query(
    `
      SELECT s.id, s.league_id AS "leagueId", s.name,
             s.start_date::text AS "startDate",
             s.end_date::text AS "endDate",
             (SELECT COUNT(*) FROM event e WHERE e.season_id = s.id AND e.deleted_at IS NULL)::int AS "eventCount",
             (CURRENT_DATE BETWEEN s.start_date AND s.end_date) AS "isActive"
      FROM season s
      WHERE s.league_id = $1
      ORDER BY s.start_date DESC
    `,
    [leagueId]
  );
  const league = await client.query(
    `
      SELECT id, name, description, logo_image_url AS "logoImageUrl",
             entry_fee::float AS "entryFee", home_facility_id AS "homeFacilityId"
      FROM league WHERE id = $1
    `,
    [leagueId]
  );
  const members = await client.query(
    `
      SELECT u.id AS "userId", u.username, u.first_name AS "firstName", u.last_name AS "lastName",
             u.display_name AS "displayName", m.role,
             u.handicap_index::float AS "handicapIndex"
      FROM league_member m
      JOIN app_user u ON u.id = m.user_id
      WHERE m.league_id = $1
      ORDER BY u.display_name
    `,
    [leagueId]
  );
  const role = await assertLeagueMember(client, leagueId, user.id);
  return {
    league: league.rows[0],
    role,
    seasons: seasons.rows,
    members: members.rows,
  };
}

export async function saveSeason(client: Client, user: AuthUser, body: any) {
  const leagueId = Number(body.leagueId);
  await assertOrganizer(client, leagueId, user.id);
  const name = requireText(body.name, 'Season name');
  const startDate = requireText(body.startDate, 'Start date');
  const endDate = requireText(body.endDate, 'End date');

  if (body.id) {
    const result = await client.query(
      `
        UPDATE season
        SET name = $2, start_date = $3, end_date = $4
        WHERE id = $1 AND league_id = $5
        RETURNING id
      `,
      [Number(body.id), name, startDate, endDate, leagueId]
    );
    if (result.rows.length === 0) throw new HttpError('Season not found', 404);
    return { id: result.rows[0].id };
  }

  const inserted = await client.query(
    `
      INSERT INTO season (league_id, name, start_date, end_date)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [leagueId, name, startDate, endDate]
  );
  return { id: inserted.rows[0].id };
}

export async function listEvents(client: Client, user: AuthUser, seasonId: number, archived = false) {
  const season = await client.query(`SELECT league_id AS "leagueId" FROM season WHERE id = $1`, [seasonId]);
  if (season.rows.length === 0) throw new HttpError('Season not found', 404);
  const leagueId = Number(season.rows[0].leagueId);
  if (archived) await assertOrganizer(client, leagueId, user.id);
  else await assertLeagueMember(client, leagueId, user.id);
  const events = await client.query(
    `
      SELECT e.id, e.season_id AS "seasonId", e.name, e.format,
             s.name AS "seasonName",
             s.league_id AS "leagueId",
             e.entry_fee::float AS "entryFee",
             e.start_date::text AS "startDate",
             e.end_date::text AS "endDate",
             e.deleted_at::text AS "deletedAt",
             e.signup_token AS "signupToken",
             e.facility_id AS "facilityId",
             e.course_configuration_id AS "courseConfigurationId",
             CASE
               WHEN CURRENT_DATE > e.end_date THEN 'done'
               WHEN CURRENT_DATE BETWEEN e.start_date AND e.end_date THEN 'live'
               ELSE 'upcoming'
             END AS status,
             (
               SELECT r.id FROM round r
               WHERE r.event_id = e.id
               ORDER BY r.round_number
               LIMIT 1
             ) AS "firstRoundId",
             (
               SELECT COUNT(*) FROM round_hole rh
               JOIN round r ON r.id = rh.round_id
               WHERE r.event_id = e.id
             )::int AS "holeCount"
      FROM event e
      JOIN season s ON s.id = e.season_id
      WHERE e.season_id = $1
        AND e.deleted_at IS ${archived ? 'NOT NULL' : 'NULL'}
      ORDER BY ${archived ? 'e.deleted_at DESC, e.id DESC' : 'e.start_date, e.id'}
    `,
    [seasonId]
  );
  return events.rows.map(row => ({
    ...row,
    formatLabel: FORMAT_LABELS[row.format as EventFormat] ?? row.format,
  }));
}

export async function saveEvent(client: Client, user: AuthUser, body: any) {
  if (!isKnownFormat(body.format)) throw new HttpError('Choose a format');
  const format = body.format as EventFormat;
  const name = requireText(body.name, 'Event name');
  const startDate = requireText(body.startDate, 'Start date');
  const endDate = requireText(body.endDate, 'End date');
  const fixed = fixedTeamSize(format);
  let teamSize = fixed ?? Number(body.teamSize ?? 2);
  if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 4) {
    throw new HttpError('Team size must be from 1 to 4');
  }
  if (fixed !== null) teamSize = fixed;
  if (fixed === null && teamSize < 2) teamSize = 2;

  const values = {
    name,
    format,
    courseConfigurationId: asNumber(body.courseConfigurationId),
    facilityId: asNumber(body.facilityId),
    entryFee: asNumber(body.entryFee, 0),
    startDate,
    endDate,
    playersPickTeams: Boolean(body.playersPickTeams) && isTeamFormat(format),
    teamSize,
    ctpEnabled: Boolean(body.ctpEnabled),
    ctpEntryFee: asNumber(body.ctpEntryFee, 0),
    longDriveEnabled: Boolean(body.longDriveEnabled),
    longDriveEntryFee: asNumber(body.longDriveEntryFee, 0),
    handicapAllowance: Math.min(100, Math.max(0, asNumber(body.handicapAllowance, 100) ?? 100)),
  };

  if (body.id) {
    const eventId = Number(body.id);
    const leagueId = await leagueIdForEvent(client, eventId);
    await assertOrganizer(client, leagueId, user.id);
    await client.query(
      `
        UPDATE event
        SET name = $2,
            format = $3,
            course_configuration_id = $4,
            facility_id = $5,
            entry_fee = $6,
            start_date = $7,
            end_date = $8,
            players_pick_teams = $9,
            team_size = $10,
            ctp_enabled = $11,
            ctp_entry_fee = $12,
            long_drive_enabled = $13,
            long_drive_entry_fee = $14,
            handicap_allowance = $15
        WHERE id = $1
      `,
      [
        eventId,
        values.name,
        values.format,
        values.courseConfigurationId,
        values.facilityId,
        values.entryFee,
        values.startDate,
        values.endDate,
        values.playersPickTeams,
        values.teamSize,
        values.ctpEnabled,
        values.ctpEntryFee,
        values.longDriveEnabled,
        values.longDriveEntryFee,
        values.handicapAllowance,
      ]
    );
    return { id: eventId };
  }

  const seasonId = Number(body.seasonId);
  const season = await client.query(`SELECT league_id AS "leagueId" FROM season WHERE id = $1`, [seasonId]);
  if (season.rows.length === 0) throw new HttpError('Season not found', 404);
  await assertOrganizer(client, Number(season.rows[0].leagueId), user.id);

  const inserted = await client.query(
    `
      INSERT INTO event (
        season_id, name, format, course_configuration_id, facility_id, entry_fee,
        start_date, end_date, players_pick_teams, team_size, signup_token,
        ctp_enabled, ctp_entry_fee, long_drive_enabled, long_drive_entry_fee, handicap_allowance
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING id
    `,
    [
      seasonId,
      values.name,
      values.format,
      values.courseConfigurationId,
      values.facilityId,
      values.entryFee,
      values.startDate,
      values.endDate,
      values.playersPickTeams,
      values.teamSize,
      newToken(),
      values.ctpEnabled,
      values.ctpEntryFee,
      values.longDriveEnabled,
      values.longDriveEntryFee,
      values.handicapAllowance,
    ]
  );
  const eventId = inserted.rows[0].id;
  await client.query(
    `
      INSERT INTO round (event_id, round_number, play_date, course_configuration_id)
      VALUES ($1, 1, $2, $3)
    `,
    [eventId, startDate, values.courseConfigurationId]
  );
  return { id: eventId };
}

export async function archiveEvent(client: Client, user: AuthUser, eventId: number) {
  const leagueId = await leagueIdForEvent(client, eventId);
  await assertOrganizer(client, leagueId, user.id);
  const updated = await client.query(
    `UPDATE event SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [eventId]
  );
  if (updated.rows.length === 0) throw new HttpError('Event not found', 404);
  return { id: eventId };
}

export async function hardDeleteEvent(client: Client, user: AuthUser, eventId: number) {
  const leagueId = await leagueIdForEvent(client, eventId);
  await assertOrganizer(client, leagueId, user.id);
  const found = await client.query(`SELECT deleted_at AS "deletedAt" FROM event WHERE id = $1`, [eventId]);
  if (found.rows.length === 0) throw new HttpError('Event not found', 404);
  if (!found.rows[0].deletedAt) throw new HttpError('Archive the event before deleting it');

  await client.query(
    `
      UPDATE round_hole
      SET default_tee_set_id = NULL
      WHERE round_id IN (SELECT id FROM round WHERE event_id = $1)
    `,
    [eventId]
  );
  await client.query(`DELETE FROM event WHERE id = $1`, [eventId]);
  return { id: eventId };
}

export async function publicSignup(client: Client, signupToken: string) {
  const bundle = await loadBundleBySignup(client, signupToken);
  return publicEvent(bundle.event);
}

export async function saveRegistration(client: Client, user: AuthUser, body: any) {
  if (body.signupToken && body.paid === undefined && body.markPaidForUserId === undefined) {
    const bundle = await loadBundleBySignup(client, String(body.signupToken));
    await client.query(
      `
        INSERT INTO league_member (league_id, user_id, role)
        VALUES ($1, $2, 'player')
        ON CONFLICT DO NOTHING
      `,
      [bundle.event.leagueId, user.id]
    );
    const ctpEntered = Boolean(body.ctpEntered) && bundle.event.ctpEnabled;
    const longDriveEntered = Boolean(body.longDriveEntered) && bundle.event.longDriveEnabled;
    await client.query(
      `
        INSERT INTO event_registration (event_id, user_id, handicap_index, ctp_entered, long_drive_entered)
        SELECT $1, id, handicap_index, $2, $3 FROM app_user WHERE id = $4
        ON CONFLICT (event_id, user_id) DO UPDATE
        SET ctp_entered = EXCLUDED.ctp_entered,
            long_drive_entered = EXCLUDED.long_drive_entered
      `,
      [bundle.event.id, ctpEntered, longDriveEntered, user.id]
    );
    return { eventId: bundle.event.id };
  }

  const eventId = Number(body.eventId);
  const leagueId = await leagueIdForEvent(client, eventId);
  await assertOrganizer(client, leagueId, user.id);

  if (body.refreshHandicaps) {
    const updated = await client.query(
      `
        UPDATE event_registration r
        SET handicap_index = u.handicap_index
        FROM app_user u
        WHERE r.event_id = $1
          AND u.id = r.user_id
          AND r.handicap_index IS DISTINCT FROM u.handicap_index
          AND NOT EXISTS (
            SELECT 1
            FROM score s
            JOIN round rd ON rd.id = s.round_id
            WHERE rd.event_id = r.event_id AND s.user_id = r.user_id
          )
      `,
      [eventId]
    );
    const locked = await client.query(
      `
        SELECT COUNT(DISTINCT s.user_id)::int AS count
        FROM score s
        JOIN round rd ON rd.id = s.round_id
        WHERE rd.event_id = $1
      `,
      [eventId]
    );
    return { eventId, updated: updated.rowCount ?? 0, locked: Number(locked.rows[0]?.count ?? 0) };
  }

  const targetUserId = Number(body.userId);
  if (!targetUserId) throw new HttpError('Choose a player');

  if (body.addPlayer) {
    const member = await client.query(
      `SELECT 1 FROM league_member WHERE league_id = $1 AND user_id = $2`,
      [leagueId, targetUserId]
    );
    if (member.rows.length === 0) throw new HttpError('That person is not in this league');
    await client.query(
      `
        INSERT INTO event_registration (event_id, user_id, handicap_index)
        SELECT $1, id, handicap_index FROM app_user WHERE id = $2
        ON CONFLICT (event_id, user_id) DO NOTHING
      `,
      [eventId, targetUserId]
    );
    return { eventId };
  }

  if (body.paid !== undefined) {
    await client.query(
      `
        UPDATE event_registration
        SET paid = $3,
            paid_at = CASE WHEN $3 THEN NOW() ELSE NULL END
        WHERE event_id = $1 AND user_id = $2
      `,
      [eventId, targetUserId, Boolean(body.paid)]
    );
  }
  if (body.ctpPaid !== undefined) {
    await client.query(
      `UPDATE event_registration SET ctp_paid = $3 WHERE event_id = $1 AND user_id = $2`,
      [eventId, targetUserId, Boolean(body.ctpPaid)]
    );
  }
  if (body.longDrivePaid !== undefined) {
    await client.query(
      `UPDATE event_registration SET long_drive_paid = $3 WHERE event_id = $1 AND user_id = $2`,
      [eventId, targetUserId, Boolean(body.longDrivePaid)]
    );
  }
  return { eventId };
}

export async function saveRound(client: Client, user: AuthUser, body: any) {
  const eventId = Number(body.eventId);
  const leagueId = await leagueIdForEvent(client, eventId);
  await assertOrganizer(client, leagueId, user.id);

  const teeSets = Array.isArray(body.teeSets) ? body.teeSets : [];
  const holes = Array.isArray(body.holes) ? body.holes : [];
  if (teeSets.length === 0 || holes.length === 0) {
    throw new HttpError('Add tees and holes before saving the course');
  }

  const playDate = requireText(body.playDate, 'Play date');
  const courseConfigurationId = asNumber(body.courseConfigurationId);

  await client.query('BEGIN');
  try {
    let roundId = body.roundId ? Number(body.roundId) : null;
    if (!roundId) {
      const next = await client.query(
        `SELECT COALESCE(MAX(round_number), 0) + 1 AS next FROM round WHERE event_id = $1`,
        [eventId]
      );
      const inserted = await client.query(
        `
          INSERT INTO round (event_id, round_number, play_date, course_configuration_id)
          VALUES ($1, $2, $3, $4)
          RETURNING id
        `,
        [eventId, next.rows[0].next, playDate, courseConfigurationId]
      );
      roundId = inserted.rows[0].id;
    } else {
      await client.query(
        `
          UPDATE round
          SET play_date = $2, course_configuration_id = $3
          WHERE id = $1 AND event_id = $4
        `,
        [roundId, playDate, courseConfigurationId, eventId]
      );
    }

    await client.query(`DELETE FROM score WHERE round_id = $1`, [roundId]);
    await client.query(`UPDATE round_hole SET default_tee_set_id = NULL WHERE round_id = $1`, [roundId]);
    await client.query(`DELETE FROM round_hole WHERE round_id = $1`, [roundId]);
    await client.query(`DELETE FROM round_tee_set WHERE round_id = $1`, [roundId]);

    const teeIds = new Map<number, number>();
    for (const tee of teeSets) {
      const inserted = await client.query(
        `
          INSERT INTO round_tee_set (round_id, platform_tee_set_id, name, hex_color_code, ladder_order)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `,
        [roundId, Number(tee.platformTeeSetId), String(tee.name), tee.hexColorCode ?? null, Number(tee.ladderOrder)]
      );
      teeIds.set(Number(tee.platformTeeSetId), inserted.rows[0].id);
    }

    for (const hole of holes) {
      const teeId = teeIds.get(Number(hole.platformTeeSetId)) ?? null;
      await client.query(
        `
          INSERT INTO round_hole (
            round_id, sequence, platform_hole_id, display_hole_number, par, stroke_index, default_tee_set_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          roundId,
          Number(hole.sequence),
          Number(hole.platformHoleId),
          hole.displayHoleNumber == null ? null : Number(hole.displayHoleNumber),
          Number(hole.par),
          hole.strokeIndex == null ? null : Number(hole.strokeIndex),
          teeId,
        ]
      );
    }

    await client.query(
      `UPDATE event SET course_configuration_id = COALESCE($2, course_configuration_id), facility_id = COALESCE($3, facility_id) WHERE id = $1`,
      [eventId, courseConfigurationId, asNumber(body.facilityId)]
    );
    await client.query('COMMIT');
    return { roundId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export async function saveTeam(client: Client, user: AuthUser, body: any) {
  const eventId = Number(body.eventId);
  const bundle = await loadBundle(client, eventId);
  const role = await assertLeagueMember(client, bundle.event.leagueId, user.id);
  if (!isTeamFormat(bundle.event.format)) throw new HttpError('This format does not use teams');

  const action = String(body.action || 'create');
  if (action === 'delete') {
    if (role !== 'organizer') throw new HttpError('Only a league organizer can delete a team', 403);
    await client.query(`DELETE FROM team WHERE id = $1 AND event_id = $2`, [Number(body.teamId), eventId]);
    return { eventId };
  }

  if (action === 'removeMember') {
    await assertCanEditTeam(bundle, role, user.id, Number(body.teamId));
    await client.query(`DELETE FROM team_member WHERE team_id = $1 AND user_id = $2`, [Number(body.teamId), Number(body.userId)]);
    await refreshTeamName(client, Number(body.teamId));
    return { eventId };
  }

  if (action === 'rename') {
    await assertCanEditTeam(bundle, role, user.id, Number(body.teamId));
    const name = requireText(body.name, 'Team name');
    await client.query(`UPDATE team SET name = $2 WHERE id = $1 AND event_id = $3`, [Number(body.teamId), name, eventId]);
    return { eventId };
  }

  let teamId = body.teamId ? Number(body.teamId) : null;
  if (!teamId) {
    if (!bundle.event.playersPickTeams && role !== 'organizer') {
      throw new HttpError('The organizer sets the teams for this event', 403);
    }
    const inserted = await client.query(
      `INSERT INTO team (event_id, name, created_by_user_id) VALUES ($1, $2, $3) RETURNING id`,
      [eventId, 'New team', user.id]
    );
    teamId = inserted.rows[0].id;
  } else {
    await assertCanEditTeam(bundle, role, user.id, teamId);
  }
  if (teamId == null) throw new HttpError('Team is required');

  const memberId = Number(body.userId || user.id);
  await assertRegistered(bundle, memberId);
  const existing = await client.query(
    `
      SELECT t.id
      FROM team_member tm
      JOIN team t ON t.id = tm.team_id
      WHERE t.event_id = $1 AND tm.user_id = $2
    `,
    [eventId, memberId]
  );
  if (existing.rows.length > 0 && Number(existing.rows[0].id) !== teamId) {
    throw new HttpError('That player is already on a team');
  }

  const count = await client.query(`SELECT COUNT(*)::int AS count FROM team_member WHERE team_id = $1`, [teamId]);
  if (Number(count.rows[0].count) >= bundle.event.teamSize && existing.rows.length === 0) {
    throw new HttpError(`This format uses ${bundle.event.teamSize} players per team`);
  }

  await client.query(
    `INSERT INTO team_member (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [teamId, memberId]
  );
  if (!body.name) await refreshTeamName(client, teamId);
  else await client.query(`UPDATE team SET name = $2 WHERE id = $1`, [teamId, requireText(body.name, 'Team name')]);
  return { eventId, teamId };
}

const GROUP_SIZE = 4;

export async function saveGroup(client: Client, user: AuthUser, body: any) {
  const eventId = Number(body.eventId);
  const bundle = await loadBundle(client, eventId);
  await assertOrganizer(client, bundle.event.leagueId, user.id);
  const action = String(body.action || 'create');
  const teamFormat = isTeamFormat(bundle.event.format);

  if (action === 'swapSlots') return swapGroupSlots(client, bundle, eventId, body);
  if (action === 'swapPlayers') return swapGroupPlayers(client, bundle, eventId, body);
  if (action === 'movePlayer') return moveGroupPlayer(client, bundle, eventId, body);
  if (action === 'moveTeam') return moveGroupTeam(client, bundle, eventId, body);
  if (action === 'swapTeams') return swapGroupTeams(client, bundle, eventId, body);
  if (action === 'dropPlayer') return dropEventPlayer(client, bundle, eventId, body);
  if (action === 'addGuest') return addEventGuest(client, eventId, body);

  if (action === 'create') {
    const teeTime = parseTeeTime(body.teeTime);
    const startingHole = parseStartingHole(body.startingHole, bundle);
    assertSlotFree(bundle, teeTime, startingHole);
    try {
      const inserted = await client.query(
        `INSERT INTO tee_group (event_id, tee_time, starting_hole) VALUES ($1, $2::time, $3) RETURNING id`,
        [eventId, teeTime, startingHole]
      );
      return { eventId, groupId: Number(inserted.rows[0].id) };
    } catch (error: any) {
      if (error?.code === '23505') throw new HttpError('Another group already starts on that hole at this tee time');
      throw error;
    }
  }

  const groupId = Number(body.groupId);
  const group = bundle.groups.find(item => item.id === groupId);
  if (!group) throw new HttpError('Group not found', 404);

  if (action === 'setTime') {
    const teeTime = parseTeeTime(body.teeTime);
    const startingHole = body.startingHole == null ? Number(group.startingHole) : parseStartingHole(body.startingHole, bundle);
    assertSlotFree(bundle, teeTime, startingHole, groupId);
    try {
      await client.query(
        `UPDATE tee_group SET tee_time = $2::time, starting_hole = $3 WHERE id = $1 AND event_id = $4`,
        [groupId, teeTime, startingHole, eventId]
      );
    } catch (error: any) {
      if (error?.code === '23505') throw new HttpError('Another group already starts on that hole at this tee time');
      throw error;
    }
    return { eventId, groupId };
  }

  if (action === 'delete') {
    await client.query(`DELETE FROM tee_group WHERE id = $1 AND event_id = $2`, [groupId, eventId]);
    return { eventId };
  }

  if (action === 'removePlayer') {
    await client.query(`DELETE FROM tee_group_member WHERE tee_group_id = $1 AND user_id = $2`, [groupId, Number(body.userId)]);
    return { eventId, groupId };
  }

  if (action === 'removeTeam') {
    await client.query(`DELETE FROM tee_group_member WHERE tee_group_id = $1 AND team_id = $2`, [groupId, Number(body.teamId)]);
    return { eventId, groupId };
  }

  if (action === 'addPlayer') {
    if (teamFormat) throw new HttpError('Add the team to the tee time');
    const userId = Number(body.userId);
    await assertRegistered(bundle, userId);
    assertGroupRoom(bundle, group, 1);
    await assertNotGrouped(client, eventId, 'user', userId);
    await client.query(`INSERT INTO tee_group_member (tee_group_id, user_id) VALUES ($1, $2)`, [groupId, userId]);
    return { eventId, groupId };
  }

  if (action === 'addTeam') {
    if (!teamFormat) throw new HttpError('Add each player to the tee time');
    const teamId = Number(body.teamId);
    if (!bundle.teams.some(team => team.teamId === teamId)) throw new HttpError('Team not found', 404);
    assertGroupRoom(bundle, group, Number(bundle.event.teamSize) || 1);
    await assertNotGrouped(client, eventId, 'team', teamId);
    await client.query(`INSERT INTO tee_group_member (tee_group_id, team_id) VALUES ($1, $2)`, [groupId, teamId]);
    return { eventId, groupId };
  }

  throw new HttpError('Unknown group action');
}

async function swapGroupSlots(client: Client, bundle: Bundle, eventId: number, body: any) {
  const firstId = Number(body.groupId);
  const secondId = Number(body.otherGroupId);
  if (!firstId || !secondId || firstId === secondId) throw new HttpError('Choose two tee times');
  const first = bundle.groups.find(group => group.id === firstId);
  const second = bundle.groups.find(group => group.id === secondId);
  if (!first || !second) throw new HttpError('Group not found', 404);
  const firstTime = String(first.teeTime || '').slice(0, 5);
  const secondTime = String(second.teeTime || '').slice(0, 5);
  await client.query('BEGIN');
  try {
    await client.query(
      `UPDATE tee_group SET tee_time = '23:59:59', starting_hole = 99 WHERE id = $1 AND event_id = $2`,
      [firstId, eventId]
    );
    await client.query(
      `UPDATE tee_group SET tee_time = $2::time, starting_hole = $3 WHERE id = $1 AND event_id = $4`,
      [secondId, firstTime, first.startingHole, eventId]
    );
    await client.query(
      `UPDATE tee_group SET tee_time = $2::time, starting_hole = $3 WHERE id = $1 AND event_id = $4`,
      [firstId, secondTime, second.startingHole, eventId]
    );
    await client.query('COMMIT');
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error?.code === '23505') throw new HttpError('Another group already starts on that hole at this tee time');
    throw error;
  }
  return { eventId };
}

async function swapGroupPlayers(client: Client, bundle: Bundle, eventId: number, body: any) {
  const firstId = Number(body.userId);
  const secondId = Number(body.otherUserId);
  if (!firstId || !secondId || firstId === secondId) throw new HttpError('Choose two different players');
  for (const userId of [firstId, secondId]) {
    if (!bundle.registrations.some(row => row.userId === userId)) throw new HttpError('That player is not signed up', 404);
  }
  await client.query('BEGIN');
  try {
    if (isTeamFormat(bundle.event.format)) {
      const seats = await client.query(
        `
          SELECT tm.team_id AS "teamId", tm.user_id AS "userId"
          FROM team_member tm
          JOIN team t ON t.id = tm.team_id
          WHERE t.event_id = $1 AND tm.user_id IN ($2, $3)
        `,
        [eventId, firstId, secondId]
      );
      if (seats.rows.length === 0) throw new HttpError('Neither player is on a team');
      if (seats.rows.length === 2 && Number(seats.rows[0].teamId) === Number(seats.rows[1].teamId)) {
        await client.query('COMMIT');
        return { eventId };
      }
      await client.query(
        `DELETE FROM team_member WHERE user_id IN ($1, $2) AND team_id IN (SELECT id FROM team WHERE event_id = $3)`,
        [firstId, secondId, eventId]
      );
      for (const seat of seats.rows) {
        const arriving = Number(seat.userId) === firstId ? secondId : firstId;
        await client.query(`INSERT INTO team_member (team_id, user_id) VALUES ($1, $2)`, [seat.teamId, arriving]);
      }
      for (const teamId of new Set(seats.rows.map(row => Number(row.teamId)))) {
        await refreshTeamName(client, teamId);
      }
    } else {
      const seats = await client.query(
        `
          SELECT m.tee_group_id AS "groupId", m.user_id AS "userId"
          FROM tee_group_member m
          JOIN tee_group g ON g.id = m.tee_group_id
          WHERE g.event_id = $1 AND m.user_id IN ($2, $3)
        `,
        [eventId, firstId, secondId]
      );
      if (seats.rows.length === 0) throw new HttpError('Neither player is in a group');
      if (seats.rows.length === 2 && Number(seats.rows[0].groupId) === Number(seats.rows[1].groupId)) {
        await client.query('COMMIT');
        return { eventId };
      }
      await client.query(
        `DELETE FROM tee_group_member WHERE user_id IN ($1, $2) AND tee_group_id IN (SELECT id FROM tee_group WHERE event_id = $3)`,
        [firstId, secondId, eventId]
      );
      for (const seat of seats.rows) {
        const arriving = Number(seat.userId) === firstId ? secondId : firstId;
        await client.query(`INSERT INTO tee_group_member (tee_group_id, user_id) VALUES ($1, $2)`, [seat.groupId, arriving]);
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  return { eventId };
}

async function moveGroupPlayer(client: Client, bundle: Bundle, eventId: number, body: any) {
  const userId = Number(body.userId);
  if (!bundle.registrations.some(row => row.userId === userId)) throw new HttpError('That player is not signed up', 404);
  if (isTeamFormat(bundle.event.format)) {
    const teamId = body.teamId == null || body.teamId === '' ? null : Number(body.teamId);
    const current = bundle.teams.filter(team => team.members.some(member => member.userId === userId)).map(team => team.teamId);
    if (teamId != null) {
      const team = bundle.teams.find(item => item.teamId === teamId);
      if (!team) throw new HttpError('Team not found', 404);
      if (team.members.some(member => member.userId === userId)) return { eventId };
      const size = Number(bundle.event.teamSize) || 1;
      if (team.members.length >= size) throw new HttpError('That team is full');
    }
    await client.query(
      `DELETE FROM team_member WHERE user_id = $1 AND team_id IN (SELECT id FROM team WHERE event_id = $2)`,
      [userId, eventId]
    );
    if (teamId != null) {
      await client.query(`INSERT INTO team_member (team_id, user_id) VALUES ($1, $2)`, [teamId, userId]);
    }
    for (const id of new Set([...current, ...(teamId == null ? [] : [teamId])])) {
      const left = await client.query(`SELECT COUNT(*)::int AS count FROM team_member WHERE team_id = $1`, [id]);
      if (Number(left.rows[0].count) === 0) await client.query(`DELETE FROM team WHERE id = $1`, [id]);
      else await refreshTeamName(client, id);
    }
    return { eventId };
  }
  const groupId = body.groupId == null || body.groupId === '' ? null : Number(body.groupId);
  if (groupId != null) {
    const group = bundle.groups.find(item => item.id === groupId);
    if (!group) throw new HttpError('Group not found', 404);
    if (group.members.some(member => member.userId === userId)) return { eventId, groupId };
    assertGroupRoom(bundle, group, 1);
  }
  await client.query(
    `DELETE FROM tee_group_member WHERE user_id = $1 AND tee_group_id IN (SELECT id FROM tee_group WHERE event_id = $2)`,
    [userId, eventId]
  );
  if (groupId != null) {
    await client.query(`INSERT INTO tee_group_member (tee_group_id, user_id) VALUES ($1, $2)`, [groupId, userId]);
  }
  return { eventId, groupId };
}

async function moveGroupTeam(client: Client, bundle: Bundle, eventId: number, body: any) {
  if (!isTeamFormat(bundle.event.format)) throw new HttpError('Add each player to the tee time');
  const teamId = Number(body.teamId);
  if (!bundle.teams.some(team => team.teamId === teamId)) throw new HttpError('Team not found', 404);
  const groupId = body.groupId == null || body.groupId === '' ? null : Number(body.groupId);
  if (groupId == null) {
    await client.query(
      `DELETE FROM tee_group_member WHERE team_id = $1 AND tee_group_id IN (SELECT id FROM tee_group WHERE event_id = $2)`,
      [teamId, eventId]
    );
    return { eventId };
  }
  const group = bundle.groups.find(item => item.id === groupId);
  if (!group) throw new HttpError('Group not found', 404);
  if (group.members.some(member => member.teamId === teamId)) return { eventId, groupId };
  assertGroupRoom(bundle, group, Number(bundle.event.teamSize) || 1);
  await client.query(
    `DELETE FROM tee_group_member WHERE team_id = $1 AND tee_group_id IN (SELECT id FROM tee_group WHERE event_id = $2)`,
    [teamId, eventId]
  );
  await client.query(`INSERT INTO tee_group_member (tee_group_id, team_id) VALUES ($1, $2)`, [groupId, teamId]);
  return { eventId, groupId };
}

async function swapGroupTeams(client: Client, bundle: Bundle, eventId: number, body: any) {
  if (!isTeamFormat(bundle.event.format)) throw new HttpError('Add each player to the tee time');
  const firstId = Number(body.teamId);
  const secondId = Number(body.otherTeamId);
  if (!firstId || !secondId || firstId === secondId) throw new HttpError('Choose two different teams');
  for (const teamId of [firstId, secondId]) {
    if (!bundle.teams.some(team => team.teamId === teamId)) throw new HttpError('Team not found', 404);
  }
  await client.query('BEGIN');
  try {
    const seats = await client.query(
      `
        SELECT m.tee_group_id AS "groupId", m.team_id AS "teamId"
        FROM tee_group_member m
        JOIN tee_group g ON g.id = m.tee_group_id
        WHERE g.event_id = $1 AND m.team_id IN ($2, $3)
      `,
      [eventId, firstId, secondId]
    );
    if (seats.rows.length === 0) throw new HttpError('Neither team is in a group');
    if (seats.rows.length === 2 && Number(seats.rows[0].groupId) === Number(seats.rows[1].groupId)) {
      await client.query('COMMIT');
      return { eventId };
    }
    await client.query(
      `DELETE FROM tee_group_member WHERE team_id IN ($1, $2) AND tee_group_id IN (SELECT id FROM tee_group WHERE event_id = $3)`,
      [firstId, secondId, eventId]
    );
    for (const seat of seats.rows) {
      const arriving = Number(seat.teamId) === firstId ? secondId : firstId;
      await client.query(`INSERT INTO tee_group_member (tee_group_id, team_id) VALUES ($1, $2)`, [seat.groupId, arriving]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  return { eventId };
}

async function dropEventPlayer(client: Client, bundle: Bundle, eventId: number, body: any) {
  const userId = Number(body.userId);
  if (!bundle.registrations.some(row => row.userId === userId)) throw new HttpError('That player is not signed up', 404);
  const teams = await client.query(
    `
      SELECT tm.team_id AS "teamId"
      FROM team_member tm
      JOIN team t ON t.id = tm.team_id
      WHERE t.event_id = $1 AND tm.user_id = $2
    `,
    [eventId, userId]
  );
  await client.query(
    `
      DELETE FROM score
      WHERE user_id = $1
        AND round_id IN (SELECT id FROM round WHERE event_id = $2)
    `,
    [userId, eventId]
  );
  await client.query(
    `DELETE FROM team_member WHERE user_id = $1 AND team_id IN (SELECT id FROM team WHERE event_id = $2)`,
    [userId, eventId]
  );
  await client.query(
    `DELETE FROM tee_group_member WHERE user_id = $1 AND tee_group_id IN (SELECT id FROM tee_group WHERE event_id = $2)`,
    [userId, eventId]
  );
  for (const teamId of teams.rows.map(row => Number(row.teamId))) {
    const left = await client.query(`SELECT COUNT(*)::int AS count FROM team_member WHERE team_id = $1`, [teamId]);
    if (Number(left.rows[0].count) === 0) await client.query(`DELETE FROM team WHERE id = $1`, [teamId]);
    else await refreshTeamName(client, teamId);
  }
  await client.query(`DELETE FROM event_registration WHERE event_id = $1 AND user_id = $2`, [eventId, userId]);
  return { eventId };
}

async function addEventGuest(client: Client, eventId: number, body: any) {
  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();
  const raw = body.handicapIndex;
  const handicapIndex = raw === undefined || raw === null || String(raw).trim() === '' ? 0 : Number(raw);
  if (!firstName || !lastName) throw new HttpError('First name and last name are required');
  if (!Number.isFinite(handicapIndex) || handicapIndex < -10 || handicapIndex > 54) {
    throw new HttpError('Enter a handicap from 0 to 54, or a plus index up to +10');
  }
  const inserted = await client.query(
    `
      INSERT INTO app_user (first_name, last_name, display_name, handicap_index)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [firstName, lastName, defaultDisplayName(firstName, lastName), handicapIndex]
  );
  const userId = Number(inserted.rows[0].id);
  await client.query(
    `INSERT INTO event_registration (event_id, user_id, handicap_index) VALUES ($1, $2, $3)`,
    [eventId, userId, handicapIndex]
  );
  return { eventId, userId };
}

export async function saveScores(client: Client, user: AuthUser, body: any) {
  const roundId = Number(body.roundId);
  const round = await client.query(`SELECT event_id AS "eventId" FROM round WHERE id = $1`, [roundId]);
  if (round.rows.length === 0) throw new HttpError('Round not found', 404);
  const eventId = Number(round.rows[0].eventId);
  const bundle = await loadBundle(client, eventId);
  const role = await assertLeagueMember(client, bundle.event.leagueId, user.id);
  const registered = bundle.registrations.some(row => row.userId === user.id);
  if (role !== 'organizer' && !registered) {
    throw new HttpError('Sign up before entering scores', 403);
  }

  const holes = holesFor(bundle, roundId);
  const incoming: HoleGross[] = Array.isArray(body.scores) ? body.scores : [];
  if (bundle.groups.length > 0) {
    const group = resolveGroup(bundle, role, user.id, asNumber(body.groupId));
    if (!group) throw new HttpError("You aren't in a group yet", 403);
    for (const score of incoming) {
      if (!scoreInGroup(bundle, group, score)) {
        throw new HttpError('You can only enter scores for this group', 403);
      }
    }
  }
  if (bundle.event.format === 'oceans_6') {
    if (role !== 'organizer') {
      for (const score of incoming) {
        const existing = bundle.scores.find(row =>
          Number(row.roundId) === roundId
          && Number(row.sequence) === Number(score.sequence)
          && Number(row.userId) === Number(score.userId)
        );
        if (existing?.kept == null) continue;
        const gross = score.gross == null || score.gross === ('' as any) ? null : Number(score.gross);
        if (gross == null || (score.kept ?? null) !== existing.kept) {
          throw new HttpError('Only a league organizer can change a keep or discard');
        }
      }
    }
    const merged = mergeGrosses(bundle.scores.filter(score => score.roundId === roundId), incoming);
    for (const score of incoming) {
      if (score.userId == null) continue;
      const error = keepQuotaError(holes, merged, Number(score.userId), Number(score.sequence), score.kept ?? null);
      if (error) throw new HttpError(error);
    }
  }

  for (const score of incoming) {
    const gross = score.gross == null || score.gross === ('' as any) ? null : Number(score.gross);
    if (gross != null && (!Number.isInteger(gross) || gross < 1 || gross > 20)) {
      throw new HttpError('Enter a gross score from 1 to 20');
    }
    if (isTeamGrossFormat(bundle.event.format)) {
      const teamId = Number(score.teamId);
      await client.query(`DELETE FROM score WHERE round_id = $1 AND sequence = $2 AND team_id = $3`, [roundId, Number(score.sequence), teamId]);
      if (gross != null) {
        await client.query(
          `
            INSERT INTO score (round_id, sequence, team_id, gross, updated_by_user_id)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [roundId, Number(score.sequence), teamId, gross, user.id]
        );
      }
    } else {
      const userId = Number(score.userId);
      await client.query(`DELETE FROM score WHERE round_id = $1 AND sequence = $2 AND user_id = $3`, [roundId, Number(score.sequence), userId]);
      if (gross != null) {
        await client.query(
          `
            INSERT INTO score (round_id, sequence, user_id, gross, kept, updated_by_user_id)
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [roundId, Number(score.sequence), userId, gross, score.kept ?? null, user.id]
        );
      }
    }
  }

  const fresh = await loadBundle(client, eventId);
  return scorecardFromBundle(fresh, roundId, asNumber(body.teamId), asNumber(body.groupId), user.id, role);
}

export async function getScorecard(client: Client, user: AuthUser, roundId: number, teamId: number | null, groupId: number | null) {
  const round = await client.query(`SELECT event_id AS "eventId" FROM round WHERE id = $1`, [roundId]);
  if (round.rows.length === 0) throw new HttpError('Round not found', 404);
  const bundle = await loadBundle(client, Number(round.rows[0].eventId));
  const role = await assertLeagueMember(client, bundle.event.leagueId, user.id);
  return scorecardFromBundle(bundle, roundId, teamId, groupId, user.id, role);
}

export async function getLeaderboard(client: Client, eventId: number) {
  const bundle = await loadBundle(client, eventId);
  const rows = orderLeaderboard(leaderboardFor(bundle).map(row => {
    const group = bundle.groups.find(item => item.members.some(member =>
      row.kind === 'team' ? member.teamId === row.competitorId : member.userId === row.competitorId
    ));
    const teeTimeSort = group?.teeTime ? String(group.teeTime).slice(0, 5) : null;
    return {
      ...row,
      teeTime: teeTimeSort ? formatTeeTime(teeTimeSort) : null,
      startingHole: group?.startingHole ?? null,
      teeTimeSort,
      memberUserIds: row.kind === 'team'
        ? bundle.teams.find(team => team.teamId === row.competitorId)?.members.map(member => member.userId) ?? []
        : [row.competitorId],
    };
  })).map(({ teeTimeSort: _teeTimeSort, card, ...row }) => {
    const startingHole = row.startingHole ?? null;
    const played = orderFromStartingHole(card ?? [], startingHole).filter(hole =>
      hole.gross != null || hole.players.some(player => player.gross != null)
    );
    return {
      ...row,
      detailName: nameWithHandicap(bundle, row),
      lastHole: latestPlayedHole(card ?? [], startingHole) ?? row.lastHole,
      card: played,
    };
  });
  const today = new Date().toISOString().slice(0, 10);
  const status = today > bundle.event.endDate
    ? 'done'
    : today >= bundle.event.startDate
      ? 'live'
      : 'upcoming';

  return {
    eventId: bundle.event.id,
    eventName: bundle.event.name,
    leagueId: bundle.event.leagueId,
    format: bundle.event.format,
    formatLabel: FORMAT_LABELS[bundle.event.format],
    usesRunningTee: usesRunningTee(bundle.event.format),
    facilityId: bundle.event.facilityId,
    courseConfigurationId: bundle.event.courseConfigurationId,
    startDate: bundle.event.startDate,
    status,
    thru: rows.reduce((most, row) => Math.max(most, row.thru), 0),
    holeCount: bundle.holes.filter(hole => Number(hole.roundId) === Number(bundle.rounds[0]?.id)).length,
    firstRoundId: bundle.rounds[0]?.id ?? null,
    rows,
    sideGames: sideGameWinners(bundle),
  };
}

function sideGameWinners(bundle: Bundle): Array<{ label: string; name: string }> {
  const nameOf = (userId: number | null) => {
    if (userId == null) return null;
    const player = bundle.registrations.find(row => Number(row.userId) === Number(userId));
    return player?.displayName ?? null;
  };
  const winners: Array<{ label: string; name: string }> = [];
  const closest = nameOf(bundle.sideGames.closestToPinWinnerUserId);
  const drive = nameOf(bundle.sideGames.longDriveWinnerUserId);
  if (closest) winners.push({ label: 'Closest to the pin', name: closest });
  if (drive) winners.push({ label: 'Long drive', name: drive });
  return winners;
}

export async function getDashboard(client: Client, user: AuthUser, eventId: number) {
  const bundle = await loadBundle(client, eventId);
  const role = await assertLeagueMember(client, bundle.event.leagueId, user.id);
  const mine = bundle.registrations.find(row => row.userId === user.id) ?? null;
  const myTeam = bundle.teams.find(team => team.members.some(member => member.userId === user.id)) ?? null;
  const leagueMembers = await client.query(
    `
      SELECT u.id AS "userId", u.display_name AS "displayName",
             u.handicap_index::float AS "handicapIndex"
      FROM league_member m
      JOIN app_user u ON u.id = m.user_id
      WHERE m.league_id = $1
      ORDER BY u.display_name
    `,
    [bundle.event.leagueId]
  );
  return {
    role,
    event: {
      ...publicEvent(bundle.event),
      signupToken: bundle.event.signupToken,
      playersPickTeams: bundle.event.playersPickTeams,
      teamSize: bundle.event.teamSize,
      courseConfigurationId: bundle.event.courseConfigurationId,
      facilityId: bundle.event.facilityId,
      leagueId: bundle.event.leagueId,
      leagueName: bundle.event.leagueName,
      seasonId: bundle.event.seasonId,
    },
    registration: mine,
    myTeam,
    rounds: bundle.rounds,
    teeSets: bundle.teeSets,
    holes: bundle.holes,
    registrations: bundle.registrations,
    leagueMembers: leagueMembers.rows,
    teams: bundle.teams,
    groups: publicGroups(bundle),
    payouts: bundle.payouts,
    sideGames: bundle.sideGames,
    leaderboard: leaderboardFor(bundle),
  };
}

export async function savePayout(client: Client, user: AuthUser, body: any) {
  const eventId = Number(body.eventId);
  const leagueId = await leagueIdForEvent(client, eventId);
  await assertOrganizer(client, leagueId, user.id);
  const amount = asNumber(body.amount, 0) ?? 0;
  if (body.id) {
    await client.query(
      `
        UPDATE payout
        SET user_id = $2, team_id = $3, place = $4, amount = $5, description = $6
        WHERE id = $1 AND event_id = $7
      `,
      [Number(body.id), asNumber(body.userId), asNumber(body.teamId), asNumber(body.place), amount, body.description?.trim?.() || null, eventId]
    );
    return { id: Number(body.id) };
  }
  const inserted = await client.query(
    `
      INSERT INTO payout (event_id, user_id, team_id, place, amount, description)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [eventId, asNumber(body.userId), asNumber(body.teamId), asNumber(body.place), amount, body.description?.trim?.() || null]
  );
  return { id: inserted.rows[0].id };
}

export async function deletePayout(client: Client, user: AuthUser, body: any) {
  const payout = await client.query(`SELECT event_id AS "eventId" FROM payout WHERE id = $1`, [Number(body.id)]);
  if (payout.rows.length === 0) throw new HttpError('Payout not found', 404);
  const leagueId = await leagueIdForEvent(client, Number(payout.rows[0].eventId));
  await assertOrganizer(client, leagueId, user.id);
  await client.query(`DELETE FROM payout WHERE id = $1`, [Number(body.id)]);
  return { id: Number(body.id) };
}

export async function saveSideGame(client: Client, user: AuthUser, body: any) {
  const eventId = Number(body.eventId);
  const leagueId = await leagueIdForEvent(client, eventId);
  await assertOrganizer(client, leagueId, user.id);
  const competition = body.competition === 'long_drive' ? 'long_drive' : 'closest_to_pin';
  const winnerUserId = asNumber(body.winnerUserId);
  if (winnerUserId != null) {
    const paid = await client.query(
      `
        SELECT ctp_paid AS "ctpPaid", long_drive_paid AS "longDrivePaid"
        FROM event_registration
        WHERE event_id = $1 AND user_id = $2
      `,
      [eventId, winnerUserId]
    );
    const row = paid.rows[0];
    const eligible = competition === 'long_drive' ? row?.longDrivePaid : row?.ctpPaid;
    if (!eligible) {
      throw new HttpError(competition === 'long_drive'
        ? 'Only a player who paid for long drive can win it'
        : 'Only a player who paid for closest to the pin can win it');
    }
  }
  await client.query(
    `
      INSERT INTO side_game_result (event_id, competition, winner_user_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (event_id, competition) DO UPDATE
      SET winner_user_id = EXCLUDED.winner_user_id
    `,
    [eventId, competition, winnerUserId]
  );
  return { eventId };
}

async function loadBundleBySignup(client: Client, signupToken: string): Promise<Bundle> {
  const found = await client.query(
    `SELECT id FROM event WHERE signup_token = $1 AND deleted_at IS NULL`,
    [signupToken]
  );
  if (found.rows.length === 0) throw new HttpError('Signup link not found', 404);
  return loadBundle(client, Number(found.rows[0].id));
}

async function loadBundle(client: Client, eventId: number): Promise<Bundle> {
  const eventResult = await client.query(
    `
      SELECT
        e.id,
        e.season_id AS "seasonId",
        s.league_id AS "leagueId",
        l.name AS "leagueName",
        e.name,
        e.format,
        e.course_configuration_id AS "courseConfigurationId",
        e.facility_id AS "facilityId",
        e.entry_fee::float AS "entryFee",
        e.start_date::text AS "startDate",
        e.end_date::text AS "endDate",
        e.players_pick_teams AS "playersPickTeams",
        e.team_size AS "teamSize",
        e.signup_token AS "signupToken",
        e.ctp_enabled AS "ctpEnabled",
        e.ctp_entry_fee::float AS "ctpEntryFee",
        e.long_drive_enabled AS "longDriveEnabled",
        e.long_drive_entry_fee::float AS "longDriveEntryFee",
        e.handicap_allowance::float AS "handicapAllowance"
      FROM event e
      JOIN season s ON s.id = e.season_id
      JOIN league l ON l.id = s.league_id
      WHERE e.id = $1
        AND e.deleted_at IS NULL
    `,
    [eventId]
  );
  if (eventResult.rows.length === 0) throw new HttpError('Event not found', 404);

  const [rounds, teeSets, holes, registrations, teamRows, memberRows, scores, payouts, sideGames, groupRows, groupMemberRows] = await Promise.all([
    client.query(
      `
        SELECT id, round_number AS "roundNumber", play_date::text AS "playDate",
               course_configuration_id AS "courseConfigurationId"
        FROM round WHERE event_id = $1 ORDER BY round_number
      `,
      [eventId]
    ),
    client.query(
      `
        SELECT ts.id, ts.round_id AS "roundId", ts.platform_tee_set_id AS "platformTeeSetId",
               ts.name, ts.hex_color_code AS "hexColorCode", ts.ladder_order AS "ladderOrder"
        FROM round_tee_set ts
        JOIN round r ON r.id = ts.round_id
        WHERE r.event_id = $1
        ORDER BY ts.ladder_order
      `,
      [eventId]
    ),
    client.query(
      `
        SELECT h.round_id AS "roundId", h.sequence, h.platform_hole_id AS "platformHoleId",
               h.display_hole_number AS "displayHoleNumber", h.par, h.stroke_index AS "strokeIndex",
               h.default_tee_set_id AS "defaultTeeSetId", ts.ladder_order AS "defaultLadderOrder"
        FROM round_hole h
        JOIN round r ON r.id = h.round_id
        LEFT JOIN round_tee_set ts ON ts.id = h.default_tee_set_id
        WHERE r.event_id = $1
        ORDER BY h.sequence
      `,
      [eventId]
    ),
    client.query(
      `
        SELECT r.user_id AS "userId", u.display_name AS "displayName",
               u.first_name AS "firstName", u.last_name AS "lastName",
               r.handicap_index::float AS "handicapIndex",
               u.handicap_index::float AS "profileHandicapIndex",
               r.paid, r.ctp_entered AS "ctpEntered", r.long_drive_entered AS "longDriveEntered",
               r.ctp_paid AS "ctpPaid", r.long_drive_paid AS "longDrivePaid"
        FROM event_registration r
        JOIN app_user u ON u.id = r.user_id
        WHERE r.event_id = $1
        ORDER BY u.display_name
      `,
      [eventId]
    ),
    client.query(`SELECT id AS "teamId", name FROM team WHERE event_id = $1 ORDER BY name, id`, [eventId]),
    client.query(
      `
        SELECT tm.team_id AS "teamId", tm.user_id AS "userId", u.display_name AS "displayName",
               u.handicap_index::float AS "handicapIndex"
        FROM team_member tm
        JOIN team t ON t.id = tm.team_id
        JOIN app_user u ON u.id = tm.user_id
        WHERE t.event_id = $1
        ORDER BY u.display_name
      `,
      [eventId]
    ),
    client.query(
      `
        SELECT s.round_id AS "roundId", s.sequence, s.user_id AS "userId", s.team_id AS "teamId",
               s.gross, s.kept
        FROM score s
        JOIN round r ON r.id = s.round_id
        WHERE r.event_id = $1
      `,
      [eventId]
    ),
    client.query(
      `
        SELECT id, user_id AS "userId", team_id AS "teamId", place, amount::float AS amount, description
        FROM payout WHERE event_id = $1 ORDER BY place NULLS LAST, id
      `,
      [eventId]
    ),
    client.query(
      `
        SELECT competition, winner_user_id AS "winnerUserId"
        FROM side_game_result WHERE event_id = $1
      `,
      [eventId]
    ),
    client.query(
      `
        SELECT id, tee_time::text AS "teeTime", starting_hole AS "startingHole"
        FROM tee_group
        WHERE event_id = $1
        ORDER BY tee_time, starting_hole, id
      `,
      [eventId]
    ),
    client.query(
      `
        SELECT m.tee_group_id AS "groupId", m.user_id AS "userId", m.team_id AS "teamId",
               COALESCE(u.display_name, t.name) AS "displayName"
        FROM tee_group_member m
        JOIN tee_group g ON g.id = m.tee_group_id
        LEFT JOIN app_user u ON u.id = m.user_id
        LEFT JOIN team t ON t.id = m.team_id
        WHERE g.event_id = $1
        ORDER BY COALESCE(u.display_name, t.name)
      `,
      [eventId]
    ),
  ]);

  const eventIndex = new Map(registrations.rows.map(row => [Number(row.userId), Number(row.handicapIndex)]));
  const teams = teamRows.rows.map(team => ({
    teamId: Number(team.teamId),
    name: team.name,
    members: memberRows.rows
      .filter(member => Number(member.teamId) === Number(team.teamId))
      .map(member => ({
        userId: Number(member.userId),
        displayName: member.displayName,
        handicapIndex: eventIndex.get(Number(member.userId)) ?? Number(member.handicapIndex),
        teamId: Number(team.teamId),
      })),
  }));

  const side = {
    closestToPinWinnerUserId: null as number | null,
    longDriveWinnerUserId: null as number | null,
  };
  for (const row of sideGames.rows) {
    if (row.competition === 'closest_to_pin') side.closestToPinWinnerUserId = row.winnerUserId;
    if (row.competition === 'long_drive') side.longDriveWinnerUserId = row.winnerUserId;
  }

  const groups: GroupRow[] = groupRows.rows.map(group => ({
    id: Number(group.id),
    teeTime: group.teeTime == null ? null : String(group.teeTime),
    startingHole: Number(group.startingHole) || 1,
    members: groupMemberRows.rows
      .filter(member => Number(member.groupId) === Number(group.id))
      .map(member => ({
        userId: member.userId == null ? null : Number(member.userId),
        teamId: member.teamId == null ? null : Number(member.teamId),
        displayName: member.displayName,
      })),
  }));

  return {
    event: eventResult.rows[0],
    rounds: rounds.rows,
    teeSets: teeSets.rows,
    holes: holes.rows,
    registrations: registrations.rows,
    teams,
    groups,
    scores: scores.rows,
    payouts: payouts.rows,
    sideGames: side,
  };
}

function publicEvent(event: EventRow) {
  return {
    id: event.id,
    name: event.name,
    leagueName: event.leagueName,
    format: event.format,
    formatLabel: FORMAT_LABELS[event.format],
    entryFee: event.entryFee,
    startDate: event.startDate,
    endDate: event.endDate,
    teamSize: event.teamSize,
    ctpEnabled: event.ctpEnabled,
    ctpEntryFee: event.ctpEntryFee,
    longDriveEnabled: event.longDriveEnabled,
    longDriveEntryFee: event.longDriveEntryFee,
  };
}

function holesFor(bundle: Bundle, roundId: number): HoleSetup[] {
  const ladder = ladderFor(bundle, roundId);
  const fallback = ladder[Math.floor((ladder.length - 1) / 2)]?.ladderOrder ?? 1;
  return bundle.holes
    .filter(hole => Number(hole.roundId) === roundId)
    .map(hole => ({
      sequence: Number(hole.sequence),
      par: Number(hole.par),
      strokeIndex: hole.strokeIndex == null ? null : Number(hole.strokeIndex),
      displayHoleNumber: hole.displayHoleNumber == null ? null : Number(hole.displayHoleNumber),
      defaultLadderOrder: hole.defaultLadderOrder == null ? fallback : Number(hole.defaultLadderOrder),
    }));
}

function ladderFor(bundle: Bundle, roundId: number): LadderTee[] {
  return bundle.teeSets
    .filter(tee => Number(tee.roundId) === roundId)
    .map(tee => ({
      ladderOrder: Number(tee.ladderOrder),
      name: tee.name,
      hexColorCode: tee.hexColorCode,
    }));
}

function playerSetups(bundle: Bundle): PlayerSetup[] {
  const teamByUser = new Map<number, number>();
  bundle.teams.forEach(team => team.members.forEach(member => teamByUser.set(member.userId, team.teamId)));
  return bundle.registrations.map(row => ({
    userId: Number(row.userId),
    displayName: row.displayName,
    handicapIndex: Number(row.handicapIndex),
    teamId: teamByUser.get(Number(row.userId)) ?? null,
  }));
}

function leaderboardFor(bundle: Bundle): LeaderboardRow[] {
  const players = playerSetups(bundle);
  const teams: TeamSetup[] = bundle.teams.map(team => ({ teamId: team.teamId, name: team.name }));
  const rounds: CompetitorTotal[][] = bundle.rounds.map(round => {
    const roundId = Number(round.id);
    return scoreRound(
      bundle.event.format,
      holesFor(bundle, roundId),
      ladderFor(bundle, roundId),
      players,
      teams,
      bundle.scores.filter(score => Number(score.roundId) === roundId),
      bundle.event.handicapAllowance
    );
  });
  if (rounds.length === 0) return [];
  return combineRounds(rounds, bundle.event.format);
}

function scorecardFromBundle(
  bundle: Bundle,
  roundId: number,
  requestedTeamId: number | null,
  requestedGroupId: number | null,
  viewerId: number,
  role: string
) {
  const players = playerSetups(bundle);
  const teams: TeamSetup[] = bundle.teams.map(team => ({ teamId: team.teamId, name: team.name }));
  const scored = scoreRound(
    bundle.event.format,
    holesFor(bundle, roundId),
    ladderFor(bundle, roundId),
    players,
    teams,
    bundle.scores.filter(score => Number(score.roundId) === roundId),
    bundle.event.handicapAllowance
  );
  const round = bundle.rounds.find(item => Number(item.id) === roundId);
  const base = {
    eventId: bundle.event.id,
    eventName: bundle.event.name,
    format: bundle.event.format,
    formatLabel: FORMAT_LABELS[bundle.event.format],
    teamGross: isTeamGrossFormat(bundle.event.format),
    runningTee: usesRunningTee(bundle.event.format),
    oceans6: bundle.event.format === 'oceans_6',
    organizer: role === 'organizer',
    roundId,
    roundNumber: round?.roundNumber ?? 1,
    playDate: round?.playDate ?? null,
    teams: bundle.teams,
    leaderboard: leaderboardFor(bundle),
    groups: role === 'organizer'
      ? publicGroups(bundle).map(group => ({ groupId: group.groupId, label: group.label }))
      : [],
    canPickGroup: false,
    groupId: null as number | null,
    groupLabel: null as string | null,
    startingHole: null as number | null,
    notice: null as string | null,
    competitorId: null as number | null,
    competitorName: null as string | null,
    holes: [] as ReturnType<typeof mergeGroupHoles>,
  };

  if (bundle.groups.length === 0) {
    const viewerTeam = bundle.teams.find(team => team.members.some(member => member.userId === viewerId));
    const competitorId = requestedTeamId ?? (isTeamFormat(bundle.event.format) ? viewerTeam?.teamId ?? null : viewerId);
    const competitor = isTeamFormat(bundle.event.format)
      ? scored.find(row => row.id === competitorId) ?? scored[0] ?? null
      : groupCard(scored, viewerId);
    return {
      ...base,
      notice: role === 'organizer' ? 'Assign groups and tee times to score one foursome at a time.' : null,
      competitorId: competitor?.id ?? null,
      competitorName: competitor?.name ?? null,
      holes: competitor?.holes ?? [],
    };
  }

  const group = resolveGroup(bundle, role, viewerId, requestedGroupId);
  const canPickGroup = role === 'organizer' && bundle.groups.length > 1;
  if (!group) {
    return { ...base, canPickGroup, notice: "You aren't in a group yet." };
  }

  const holes = mergeGroupHoles(competitorsInGroup(bundle, group, scored));
  const hasLines = holes.some(hole => hole.lines.length > 0);
  return {
    ...base,
    canPickGroup,
    groupId: group.id,
    groupLabel: groupOptionLabel(group),
    startingHole: group.startingHole,
    competitorId: group.id,
    competitorName: groupPlace(group),
    notice: hasLines ? null : 'Nobody is in this group yet.',
    holes: hasLines ? holes : [],
  };
}

function parseTeeTime(value: any): string {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) throw new HttpError('Enter a tee time');
  const [hour, minute] = value.split(':').map(Number);
  if (hour > 23 || minute > 59) throw new HttpError('Enter a tee time');
  return value;
}

function courseHoleNumbers(bundle: Bundle): number[] {
  const roundId = bundle.rounds[0] ? Number(bundle.rounds[0].id) : null;
  const holes = roundId == null
    ? bundle.holes
    : bundle.holes.filter(hole => Number(hole.roundId) === roundId);
  return holes.map(hole => hole.displayHoleNumber == null ? Number(hole.sequence) : Number(hole.displayHoleNumber));
}

function parseStartingHole(value: any, bundle: Bundle): number {
  const hole = Number(value);
  const onCourse = courseHoleNumbers(bundle);
  if (!Number.isInteger(hole) || hole < 1) throw new HttpError('Enter a starting hole');
  if (onCourse.length > 0) {
    if (!onCourse.includes(hole)) throw new HttpError('Pick a hole on this course');
    return hole;
  }
  if (hole > 36) throw new HttpError('Enter a starting hole from 1 to 36');
  return hole;
}

function assertSlotFree(bundle: Bundle, teeTime: string, startingHole: number, exceptGroupId?: number) {
  const taken = bundle.groups.some(group =>
    group.id !== exceptGroupId
    && String(group.teeTime || '').slice(0, 5) === teeTime
    && Number(group.startingHole) === startingHole
  );
  if (taken) throw new HttpError('Another group already starts on that hole at this tee time');
}

function groupSlots(bundle: Bundle, group: GroupRow): number {
  if (isTeamFormat(bundle.event.format)) {
    const size = Number(bundle.event.teamSize) || 1;
    return group.members.filter(member => member.teamId != null).length * size;
  }
  return group.members.filter(member => member.userId != null).length;
}

function assertGroupRoom(bundle: Bundle, group: GroupRow, adding: number) {
  if (groupSlots(bundle, group) + adding > GROUP_SIZE) {
    throw new HttpError('A tee time holds at most 4 players');
  }
}

async function assertNotGrouped(client: Client, eventId: number, kind: 'user' | 'team', id: number) {
  const column = kind === 'user' ? 'm.user_id' : 'm.team_id';
  const found = await client.query(
    `SELECT 1 FROM tee_group_member m JOIN tee_group g ON g.id = m.tee_group_id WHERE g.event_id = $1 AND ${column} = $2`,
    [eventId, id]
  );
  if (found.rows.length > 0) {
    throw new HttpError(kind === 'user' ? 'That player is already in a group' : 'That team is already in a group');
  }
}

function formatHandicap(index: number): string {
  const value = Number(index);
  if (!Number.isFinite(value)) return '';
  const magnitude = Math.round(Math.abs(value) * 10) / 10;
  return value < 0 ? `(+${magnitude})` : `(${magnitude})`;
}

function eventHoleCount(bundle: Bundle): number {
  const roundId = Number(bundle.rounds[0]?.id);
  const count = bundle.holes.filter(hole => Number(hole.roundId) === roundId).length;
  return count > 0 ? count : 18;
}

function strokesLabel(bundle: Bundle, index: number): string {
  const allowance = Number(bundle.event.handicapAllowance);
  const strokes = individualPlayingHandicap(
    bundle.event.format,
    index,
    eventHoleCount(bundle),
    Number.isFinite(allowance) ? allowance : 100
  );
  return formatHandicap(strokes);
}

function nameWithHandicap(bundle: Bundle, row: { kind: string; competitorId: number; name: string }): string {
  if (row.kind === 'team') {
    const team = bundle.teams.find(item => item.teamId === row.competitorId);
    if (!team || team.members.length === 0) return row.name;
    return team.members.map(member => `${member.displayName} ${strokesLabel(bundle, member.handicapIndex)}`.trim()).join(' / ');
  }
  const player = bundle.registrations.find(item => Number(item.userId) === row.competitorId);
  if (!player) return row.name;
  const handicap = strokesLabel(bundle, player.handicapIndex);
  return handicap ? `${row.name} ${handicap}` : row.name;
}

function formatTeeTime(value: string | null): string {
  if (!value) return 'No time';
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  let hour = Number(match[1]);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${match[2]} ${suffix}`;
}

function groupPlace(group: GroupRow): string {
  const time = formatTeeTime(group.teeTime);
  return group.startingHole ? `${time} · Hole ${group.startingHole}` : time;
}

function groupOptionLabel(group: GroupRow): string {
  const names = group.members.map(member => member.displayName).filter(name => name.length > 0);
  const place = groupPlace(group);
  return names.length > 0 ? `${place} · ${names.join(', ')}` : place;
}

function publicGroups(bundle: Bundle) {
  return bundle.groups.map(group => ({
    groupId: group.id,
    teeTime: group.teeTime ? group.teeTime.slice(0, 5) : '',
    startingHole: Number(group.startingHole) || 1,
    label: groupOptionLabel(group),
    members: group.members,
  }));
}

function groupForViewer(bundle: Bundle, viewerId: number): GroupRow | null {
  return bundle.groups.find(group => group.members.some(member => {
    if (member.userId === viewerId) return true;
    if (member.teamId == null) return false;
    const team = bundle.teams.find(item => item.teamId === member.teamId);
    return !!team?.members.some(person => person.userId === viewerId);
  })) ?? null;
}

function resolveGroup(bundle: Bundle, role: string, viewerId: number, requestedGroupId: number | null): GroupRow | null {
  const own = groupForViewer(bundle, viewerId);
  if (role !== 'organizer') return own;
  if (requestedGroupId != null) {
    return bundle.groups.find(group => group.id === requestedGroupId) ?? own ?? bundle.groups[0] ?? null;
  }
  return own ?? bundle.groups[0] ?? null;
}

function competitorsInGroup(bundle: Bundle, group: GroupRow, scored: CompetitorTotal[]): CompetitorTotal[] {
  const ids = isTeamFormat(bundle.event.format)
    ? group.members.map(member => member.teamId)
    : group.members.map(member => member.userId);
  return ids
    .filter((id): id is number => id != null)
    .map(id => scored.find(row => row.id === id))
    .filter((row): row is CompetitorTotal => !!row);
}

function scoreInGroup(bundle: Bundle, group: GroupRow, score: HoleGross): boolean {
  if (isTeamGrossFormat(bundle.event.format)) {
    return group.members.some(member => member.teamId === Number(score.teamId));
  }
  const userId = Number(score.userId);
  if (group.members.some(member => member.userId === userId)) return true;
  return group.members.some(member => {
    if (member.teamId == null) return false;
    const team = bundle.teams.find(item => item.teamId === member.teamId);
    return !!team?.members.some(person => person.userId === userId);
  });
}

function groupCard(scored: CompetitorTotal[], viewerId: number): CompetitorTotal | null {
  if (scored.length === 0) return null;
  const viewer = scored.find(row => row.id === viewerId) ?? scored[0];
  const holes = viewer.holes.map((hole, index) => ({
    ...hole,
    lines: orderScoreLines(scored.map(player => player.holes[index]?.lines[0]).filter((line): line is NonNullable<typeof line> => !!line)),
    countingScore: hole.countingScore,
    complete: hole.complete,
  }));
  return { ...viewer, name: 'Group', holes };
}

function mergeGrosses(existing: HoleGross[], incoming: HoleGross[]): HoleGross[] {
  const key = (score: HoleGross) => `${score.sequence}:${score.userId ?? ''}:${score.teamId ?? ''}`;
  const map = new Map<string, HoleGross>();
  existing.forEach(score => map.set(key(score), score));
  incoming.forEach(score => map.set(key(score), {
    sequence: Number(score.sequence),
    userId: score.userId == null ? null : Number(score.userId),
    teamId: score.teamId == null ? null : Number(score.teamId),
    gross: score.gross == null ? null : Number(score.gross),
    kept: score.kept ?? null,
  }));
  return [...map.values()];
}

async function assertRegistered(bundle: Bundle, userId: number) {
  if (!bundle.registrations.some(row => Number(row.userId) === userId)) {
    throw new HttpError('That player is not signed up');
  }
}

async function assertCanEditTeam(bundle: Bundle, role: string, userId: number, teamId: number) {
  if (role === 'organizer') return;
  if (!bundle.event.playersPickTeams) {
    throw new HttpError('The organizer sets the teams for this event', 403);
  }
  const team = bundle.teams.find(item => item.teamId === teamId);
  const onTeam = team?.members.some(member => member.userId === userId);
  if (!onTeam && team && team.members.length > 0) {
    throw new HttpError('You can only change your own team', 403);
  }
}

async function refreshTeamName(client: Client, teamId: number) {
  const members = await client.query(
    `
      SELECT u.display_name AS "displayName"
      FROM team_member tm
      JOIN app_user u ON u.id = tm.user_id
      WHERE tm.team_id = $1
      ORDER BY u.display_name
    `,
    [teamId]
  );
  const name = teamNameFromPlayers(members.rows.map(row => row.displayName)) || 'Team';
  await client.query(`UPDATE team SET name = $2 WHERE id = $1`, [teamId, name]);
}
