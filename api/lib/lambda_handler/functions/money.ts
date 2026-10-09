import { Handler } from 'aws-cdk-lib/aws-lambda';
import { handle, HttpError } from '../util/http';
import { withClient } from '../util/db';
import { assertLeagueMember, requireUser } from '../util/auth';

interface Credit {
  userId: number;
  seasonId: number;
  startDate: string;
  eventName: string;
  label: string;
  amount: number;
}

interface MoneyLine {
  eventName: string;
  label: string;
  amount: number;
}

interface MoneyRow {
  userId: number;
  displayName: string;
  profilePictureUrl: string | null;
  total: number;
  lines: MoneyLine[];
}

export const handler: Handler = async (event: any) => handle(event, async (body) => {
  const leagueId = Number(body.leagueId);
  const seasonId = Number(body.seasonId);
  if (!leagueId) throw new HttpError('League is required');
  if (!seasonId) throw new HttpError('Season is required');
  return withClient(async (client) => {
    const user = await requireUser(client, body);
    await assertLeagueMember(client, leagueId, user.id);

    const [members, events, payouts, teamMembers, paid, winners] = await Promise.all([
      client.query(
        `
          SELECT u.id AS "userId", u.display_name AS "displayName",
                 u.profile_picture_url AS "profilePictureUrl"
          FROM league_member m
          JOIN app_user u ON u.id = m.user_id
          WHERE m.league_id = $1
        `,
        [leagueId]
      ),
      client.query(
        `
          SELECT e.id, e.season_id AS "seasonId", e.name,
                 e.start_date::text AS "startDate", e.team_size AS "teamSize",
                 e.ctp_entry_fee::float AS "ctpEntryFee",
                 e.long_drive_entry_fee::float AS "longDriveEntryFee"
          FROM event e
          JOIN season s ON s.id = e.season_id
          WHERE s.league_id = $1 AND e.deleted_at IS NULL
        `,
        [leagueId]
      ),
      client.query(
        `
          SELECT p.event_id AS "eventId", p.user_id AS "userId", p.team_id AS "teamId",
                 p.place, p.amount::float AS amount, p.description
          FROM payout p
          JOIN event e ON e.id = p.event_id
          JOIN season s ON s.id = e.season_id
          WHERE s.league_id = $1 AND e.deleted_at IS NULL
            AND (p.user_id IS NOT NULL OR p.team_id IS NOT NULL)
        `,
        [leagueId]
      ),
      client.query(
        `
          SELECT tm.team_id AS "teamId", tm.user_id AS "userId"
          FROM team_member tm
          JOIN team t ON t.id = tm.team_id
          JOIN event e ON e.id = t.event_id
          JOIN season s ON s.id = e.season_id
          WHERE s.league_id = $1 AND e.deleted_at IS NULL
        `,
        [leagueId]
      ),
      client.query(
        `
          SELECT r.event_id AS "eventId",
                 COUNT(*) FILTER (WHERE r.ctp_paid)::int AS "ctpPaid",
                 COUNT(*) FILTER (WHERE r.long_drive_paid)::int AS "longDrivePaid"
          FROM event_registration r
          JOIN event e ON e.id = r.event_id
          JOIN season s ON s.id = e.season_id
          WHERE s.league_id = $1 AND e.deleted_at IS NULL
          GROUP BY r.event_id
        `,
        [leagueId]
      ),
      client.query(
        `
          SELECT g.event_id AS "eventId", g.competition, g.winner_user_id AS "winnerUserId"
          FROM side_game_result g
          JOIN event e ON e.id = g.event_id
          JOIN season s ON s.id = e.season_id
          WHERE s.league_id = $1 AND e.deleted_at IS NULL
            AND g.winner_user_id IS NOT NULL
        `,
        [leagueId]
      ),
    ]);

    const eventById = new Map(events.rows.map(row => [Number(row.id), row]));
    const membersByTeam = new Map<number, number[]>();
    for (const row of teamMembers.rows) {
      const teamId = Number(row.teamId);
      const list = membersByTeam.get(teamId) ?? [];
      list.push(Number(row.userId));
      membersByTeam.set(teamId, list);
    }
    const paidByEvent = new Map(paid.rows.map(row => [Number(row.eventId), row]));
    const credits: Credit[] = [];

    for (const payout of payouts.rows) {
      const played = eventById.get(Number(payout.eventId));
      if (!played) continue;
      const amount = Number(payout.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const share = playerShare(amount, Number(played.teamSize));
      const people = payout.teamId != null
        ? membersByTeam.get(Number(payout.teamId)) ?? []
        : [Number(payout.userId)];
      const label = payoutLabel(payout);
      for (const userId of people) {
        if (!userId) continue;
        credits.push({
          userId,
          seasonId: Number(played.seasonId),
          startDate: String(played.startDate),
          eventName: played.name,
          label,
          amount: share,
        });
      }
    }

    for (const winner of winners.rows) {
      const played = eventById.get(Number(winner.eventId));
      if (!played) continue;
      const counts = paidByEvent.get(Number(winner.eventId));
      const closest = winner.competition === 'closest_to_pin';
      const paidCount = Number(closest ? counts?.ctpPaid : counts?.longDrivePaid) || 0;
      const fee = Number(closest ? played.ctpEntryFee : played.longDriveEntryFee) || 0;
      const pot = roundMoney(paidCount * fee);
      if (pot <= 0) continue;
      credits.push({
        userId: Number(winner.winnerUserId),
        seasonId: Number(played.seasonId),
        startDate: String(played.startDate),
        eventName: played.name,
        label: closest ? 'Closest to the pin' : 'Long drive',
        amount: pot,
      });
    }

    return {
      season: standings(members.rows, credits.filter(credit => credit.seasonId === seasonId)),
      allTime: standings(members.rows, credits),
    };
  });
});

/** A team payout is split by the event's team size. One player keeps the whole amount. */
function playerShare(amount: number, teamSize: number): number {
  const size = Number.isInteger(teamSize) && teamSize > 0 ? teamSize : 1;
  return roundMoney(amount / size);
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function payoutLabel(payout: { place: number | null; description: string | null }): string {
  const description = payout.description?.trim();
  if (description) return description;
  const place = Number(payout.place);
  if (place === 1) return '1st';
  if (place === 2) return '2nd';
  if (place === 3) return '3rd';
  if (place > 3) return `${place}th`;
  return 'Payout';
}

function standings(
  members: Array<{ userId: number; displayName: string; profilePictureUrl: string | null }>,
  credits: Credit[]
): MoneyRow[] {
  const byUser = new Map<number, Credit[]>();
  for (const credit of credits) {
    const list = byUser.get(credit.userId) ?? [];
    list.push(credit);
    byUser.set(credit.userId, list);
  }
  return members
    .map(member => {
      const lines = (byUser.get(Number(member.userId)) ?? [])
        .sort((a, b) => b.startDate.localeCompare(a.startDate) || a.label.localeCompare(b.label))
        .map(credit => ({ eventName: credit.eventName, label: credit.label, amount: credit.amount }));
      const total = roundMoney(lines.reduce((sum, line) => sum + line.amount, 0));
      return {
        userId: Number(member.userId),
        displayName: member.displayName,
        profilePictureUrl: member.profilePictureUrl || null,
        total,
        lines,
      };
    })
    .sort((a, b) => b.total - a.total || a.displayName.localeCompare(b.displayName));
}
