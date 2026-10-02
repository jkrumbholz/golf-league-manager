import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MembershipService } from './services/membership.service';

export const organizerGuard: CanActivateFn = async () => {
  const membership = inject(MembershipService);
  const router = inject(Router);
  if (await membership.isOrganizer()) return true;
  return router.createUrlTree(['/leagues']);
};
