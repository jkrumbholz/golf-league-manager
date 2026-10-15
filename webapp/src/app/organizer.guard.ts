import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LeagueSummary, MembershipService } from './services/membership.service';

async function leaguesOf(membership: MembershipService): Promise<LeagueSummary[]> {
  try {
    return await membership.leagues(true);
  } catch {
    return [];
  }
}

export const organizerGuard: CanActivateFn = async () => {
  const membership = inject(MembershipService);
  const router = inject(Router);
  const leagues = await leaguesOf(membership);
  if (leagues.some(league => league.role === 'organizer')) return true;
  return router.createUrlTree(['/leagues']);
};

/** Organizers, and players designated to collect money for a league. */
export const collectorGuard: CanActivateFn = async () => {
  const membership = inject(MembershipService);
  const router = inject(Router);
  const leagues = await leaguesOf(membership);
  if (leagues.some(league => league.role === 'organizer' || league.role === 'collector')) return true;
  return router.createUrlTree(['/leagues']);
};
