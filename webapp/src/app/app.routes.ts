import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { collectorGuard, organizerGuard } from './organizer.guard';
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
import { AdminEventPartnerComponent } from './components/admin/admin-event-partner.component';
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
      { path: '', pathMatch: 'full', redirectTo: 'leagues' },
      { path: 'leagues', component: LeaguesComponent },
      { path: 'leagues/:leagueId', component: LeagueHomeComponent },
      { path: 'events/:eventId', component: LeaderboardComponent },
      { path: 'events/:eventId/score/:roundId', component: ScoreComponent },
      { path: 'events/:eventId/score/:roundId/card', component: ScorecardComponent },
      { path: 'profile', component: AccountComponent },
      {
        path: 'admin',
        children: [
          { path: 'leagues', canActivate: [organizerGuard], component: AdminLeaguesComponent },
          { path: 'leagues/new', canActivate: [organizerGuard], component: AdminLeagueFormComponent },
          { path: 'leagues/:leagueId', canActivate: [organizerGuard], component: AdminLeagueComponent },
          { path: 'leagues/:leagueId/seasons/new', canActivate: [organizerGuard], component: AdminSeasonFormComponent },
          { path: 'leagues/:leagueId/players/new', canActivate: [organizerGuard], component: AdminPlayerFormComponent },
          { path: 'leagues/:leagueId/players/:userId', canActivate: [organizerGuard], component: AdminPlayerEditComponent },
          { path: 'seasons/:seasonId', canActivate: [organizerGuard], component: AdminSeasonComponent },
          { path: 'seasons/:seasonId/archive', canActivate: [organizerGuard], component: AdminSeasonArchiveComponent },
          { path: 'seasons/:seasonId/events/new', canActivate: [organizerGuard], component: AdminEventFormComponent },
          { path: 'events/:eventId', canActivate: [collectorGuard], component: AdminEventComponent },
          { path: 'events/:eventId/course', canActivate: [organizerGuard], component: AdminEventCourseComponent },
          { path: 'events/:eventId/players', canActivate: [collectorGuard], component: AdminEventPlayersComponent },
          { path: 'events/:eventId/players/add', canActivate: [organizerGuard], component: AdminEventPlayersAddComponent },
          { path: 'events/:eventId/teams', canActivate: [organizerGuard], component: AdminEventTeamsComponent },
          { path: 'events/:eventId/partner', canActivate: [organizerGuard], component: AdminEventPartnerComponent },
          { path: 'events/:eventId/groups/new', canActivate: [organizerGuard], component: AdminEventGroupFormComponent },
          { path: 'events/:eventId/groups', canActivate: [organizerGuard], component: AdminEventGroupsComponent },
          { path: 'events/:eventId/side-games', canActivate: [organizerGuard], component: AdminEventSideGamesComponent },
          { path: 'events/:eventId/payouts', canActivate: [organizerGuard], component: AdminEventPayoutsComponent },
          { path: 'events/:eventId/payouts/new', canActivate: [organizerGuard], component: AdminEventPayoutFormComponent },
          { path: 'events/:eventId/payouts/:payoutId', canActivate: [organizerGuard], component: AdminEventPayoutFormComponent },
          { path: 'events/:eventId/settings', canActivate: [organizerGuard], component: AdminEventSettingsComponent },
          { path: 'events/:eventId/share', canActivate: [organizerGuard], component: AdminEventShareComponent },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'leagues' },
];
