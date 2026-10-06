import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { organizerGuard } from './organizer.guard';
import { LoginComponent } from './components/login.component';
import { LeaguesComponent } from './components/leagues.component';
import { LeagueHomeComponent } from './components/league-home.component';
import { ScoreComponent } from './components/score.component';
import { ScorecardComponent } from './components/scorecard.component';
import { LeaderboardComponent } from './components/leaderboard.component';
import { SignupComponent } from './components/signup.component';
import { WelcomeComponent } from './components/welcome.component';
import { AccountComponent } from './components/account.component';
import { AdminLeaguesComponent } from './components/admin/admin-leagues.component';
import { AdminLeagueFormComponent } from './components/admin/admin-league-form.component';
import { AdminLeagueComponent } from './components/admin/admin-league.component';
import { AdminSeasonFormComponent } from './components/admin/admin-season-form.component';
import { AdminPlayerFormComponent } from './components/admin/admin-player-form.component';
import { AdminPlayerEditComponent } from './components/admin/admin-player-edit.component';
import { AdminSeasonComponent } from './components/admin/admin-season.component';
import { AdminSeasonArchiveComponent } from './components/admin/admin-season-archive.component';
import { AdminEventFormComponent } from './components/admin/admin-event-form.component';
import { AdminEventComponent } from './components/admin/admin-event.component';
import { AdminEventCourseComponent } from './components/admin/admin-event-course.component';
import { AdminEventPlayersComponent } from './components/admin/admin-event-players.component';
import { AdminEventPlayersAddComponent } from './components/admin/admin-event-players-add.component';
import { AdminEventTeamsComponent } from './components/admin/admin-event-teams.component';
import { AdminEventGroupsComponent } from './components/admin/admin-event-groups.component';
import { AdminEventGroupFormComponent } from './components/admin/admin-event-group-form.component';
import { AdminEventSideGamesComponent } from './components/admin/admin-event-side-games.component';
import { AdminEventPayoutsComponent } from './components/admin/admin-event-payouts.component';
import { AdminEventPayoutFormComponent } from './components/admin/admin-event-payout-form.component';
import { AdminEventSettingsComponent } from './components/admin/admin-event-settings.component';
import { AdminEventShareComponent } from './components/admin/admin-event-share.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'signup/:token', component: SignupComponent },
  { path: 'welcome/:token', component: WelcomeComponent },
  { path: 'leaderboard/:eventId', component: LeaderboardComponent, data: { broadcast: true } },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: 'leagues', component: LeaguesComponent },
      { path: 'leagues/:leagueId', component: LeagueHomeComponent },
      { path: 'events/:eventId', component: LeaderboardComponent },
      { path: 'events/:eventId/score/:roundId', component: ScoreComponent },
      { path: 'events/:eventId/score/:roundId/card', component: ScorecardComponent },
      { path: 'profile', component: AccountComponent },
      {
        path: 'admin',
        canActivate: [organizerGuard],
        children: [
          { path: 'leagues', component: AdminLeaguesComponent },
          { path: 'leagues/new', component: AdminLeagueFormComponent },
          { path: 'leagues/:leagueId', component: AdminLeagueComponent },
          { path: 'leagues/:leagueId/seasons/new', component: AdminSeasonFormComponent },
          { path: 'leagues/:leagueId/players/new', component: AdminPlayerFormComponent },
          { path: 'leagues/:leagueId/players/:userId', component: AdminPlayerEditComponent },
          { path: 'seasons/:seasonId', component: AdminSeasonComponent },
          { path: 'seasons/:seasonId/archive', component: AdminSeasonArchiveComponent },
          { path: 'seasons/:seasonId/events/new', component: AdminEventFormComponent },
          { path: 'events/:eventId', component: AdminEventComponent },
          { path: 'events/:eventId/course', component: AdminEventCourseComponent },
          { path: 'events/:eventId/players', component: AdminEventPlayersComponent },
          { path: 'events/:eventId/players/add', component: AdminEventPlayersAddComponent },
          { path: 'events/:eventId/teams', component: AdminEventTeamsComponent },
          { path: 'events/:eventId/groups/new', component: AdminEventGroupFormComponent },
          { path: 'events/:eventId/groups', component: AdminEventGroupsComponent },
          { path: 'events/:eventId/side-games', component: AdminEventSideGamesComponent },
          { path: 'events/:eventId/payouts', component: AdminEventPayoutsComponent },
          { path: 'events/:eventId/payouts/new', component: AdminEventPayoutFormComponent },
          { path: 'events/:eventId/payouts/:payoutId', component: AdminEventPayoutFormComponent },
          { path: 'events/:eventId/settings', component: AdminEventSettingsComponent },
          { path: 'events/:eventId/share', component: AdminEventShareComponent },
        ],
      },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'leagues' },
  { path: '**', redirectTo: 'leagues' },
];
