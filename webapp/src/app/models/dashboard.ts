export interface Registration {
  userId: number;
  displayName: string;
  handicapIndex: number;
  profileHandicapIndex?: number;
  paid: boolean;
  ctpEntered: boolean;
  longDriveEntered: boolean;
  ctpPaid: boolean;
  longDrivePaid: boolean;
}

export interface Team {
  teamId: number;
  name: string;
  members: Array<{ userId: number; displayName: string }>;
}

export interface TeeGroupMember {
  userId: number | null;
  teamId: number | null;
  displayName: string;
}

export interface TeeGroup {
  groupId: number;
  teeTime: string;
  startingHole: number;
  label: string;
  members: TeeGroupMember[];
}

export interface EventDetail {
  id: number;
  name: string;
  format: string;
  formatLabel: string;
  entryFee: number;
  handicapAllowance: number;
  startDate: string;
  endDate: string;
  teamSize: number;
  playersPickTeams: boolean;
  signupToken: string;
  ctpEnabled: boolean;
  ctpEntryFee: number;
  longDriveEnabled: boolean;
  longDriveEntryFee: number;
  facilityId: number | null;
  courseConfigurationId: number | null;
  leagueName: string;
  leagueId: number;
  seasonId: number;
}

export interface Payout {
  id: number;
  place: number | null;
  amount: number;
  description: string | null;
  userId: number | null;
  teamId: number | null;
}

export interface Dashboard {
  role: string;
  event: EventDetail;
  registration: Registration | null;
  myTeam: Team | null;
  rounds: Array<{ id: number; roundNumber: number; playDate: string }>;
  registrations: Registration[];
  leagueMembers: Array<{ userId: number; displayName: string; handicapIndex: number }>;
  teams: Team[];
  groups?: TeeGroup[];
  payouts: Payout[];
  leaderboard?: Array<{
    rank: number;
    competitorId: number;
    kind: 'player' | 'team';
    name: string;
    thru: number;
  }>;
  sideGames: { closestToPinWinnerUserId: number | null; longDriveWinnerUserId: number | null };
  holes: Array<{ roundId: number }>;
}
