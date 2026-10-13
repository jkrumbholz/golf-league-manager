import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VirtualPartner, VirtualPartnerPlayer } from '../../models/dashboard';
import { FaceComponent } from '../../ui/face.component';
import { ShellComponent } from '../../ui/shell.component';
import { AdminEventScreen } from './admin-event-screen';

type CeremonyPhase = 'intro' | 'saving' | 'shuffling' | 'slowing' | 'reveal' | 'celebration';

@Component({
  selector: 'app-admin-event-partner',
  standalone: true,
  imports: [RouterLink, ShellComponent, FaceComponent],
  templateUrl: './admin-event-partner.component.html',
})
export class AdminEventPartnerComponent extends AdminEventScreen implements OnInit, OnDestroy {
  phase: CeremonyPhase = 'intro';
  shown: VirtualPartnerPlayer | null = null;
  /** The draw the ceremony is presenting. Stays on the persisted result across the animation. */
  private live: VirtualPartner | null = null;
  readonly confetti = Array.from({ length: 28 }, (_, index) => ({
    left: (index * 37) % 100,
    delay: (index % 8) * 80,
    color: index % 3 === 0 ? '#f5c518' : index % 3 === 1 ? '#ffffff' : '#8d9cc4',
  }));

  private token = 0;
  private pendingWaits: Array<() => void> = [];

  async ngOnInit(): Promise<void> {
    await this.load();
    this.phase = this.partner?.selected ? 'celebration' : 'intro';
  }

  ngOnDestroy(): void {
    this.token += 1;
    this.stopWaits();
  }

  get partner(): VirtualPartner | null {
    return this.dashboard?.virtualPartner ?? null;
  }

  get view(): VirtualPartner | null {
    return this.live ?? this.partner;
  }

  get status(): string {
    if (this.phase === 'shuffling') return 'Drawing a name';
    if (this.phase === 'slowing') return 'Here it comes';
    if (this.phase === 'reveal') return 'Your partner';
    if (this.phase === 'celebration') return 'It\'s a team';
    if (this.phase === 'saving') return 'Locking in the draw';
    return 'Who\'s your partner?';
  }

  async draw(): Promise<void> {
    if (this.busy || !this.partner) return;
    if (this.partner.selected) {
      await this.play(this.partner);
      return;
    }
    if (this.partner.eligible.length === 0) return;
    await this.persist(false);
  }

  async redraw(): Promise<void> {
    if (this.busy || !this.partner?.selected) return;
    if (!window.confirm('Redraw the partner? The current selection will be replaced and the standings will update.')) return;
    await this.persist(true);
  }

  private async persist(redraw: boolean): Promise<void> {
    this.phase = 'saving';
    await this.run(async () => {
      const saved = await this.api.put<VirtualPartner>('team', {
        action: redraw ? 'redrawVirtualPartner' : 'drawVirtualPartner',
        eventId: this.eventId,
        confirm: redraw ? true : undefined,
      }, { quiet: true });
      await this.play(saved);
    });
    if (this.error) this.phase = this.partner?.selected ? 'celebration' : 'intro';
  }

  private async play(draw: VirtualPartner): Promise<void> {
    const selected = draw.selected;
    if (!selected) return;
    this.live = draw;
    const token = ++this.token;
    this.stopWaits();
    const pool = draw.eligible.length > 0 ? draw.eligible : [selected];
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.shown = selected;
      this.phase = 'celebration';
      return;
    }

    this.phase = 'shuffling';
    let previous: VirtualPartnerPlayer | undefined;
    for (let step = 0; step < 16; step++) {
      previous = this.flash(pool, previous);
      this.shown = previous;
      if (!await this.wait(68, token)) return;
    }

    this.phase = 'slowing';
    for (const delay of [150, 220, 320, 460, 640, 880]) {
      previous = this.flash(pool, previous);
      this.shown = previous;
      if (!await this.wait(delay, token)) return;
    }

    this.phase = 'reveal';
    this.shown = null;
    if (!await this.wait(460, token)) return;
    this.shown = selected;
    if (!await this.wait(1200, token)) return;
    if (token !== this.token) return;
    this.phase = 'celebration';
  }

  private flash(pool: VirtualPartnerPlayer[], avoid?: VirtualPartnerPlayer): VirtualPartnerPlayer {
    if (pool.length === 1) return pool[0];
    const choices = avoid ? pool.filter(player => player.userId !== avoid.userId) : pool;
    return choices[Math.floor(Math.random() * choices.length)] ?? pool[0];
  }

  private wait(ms: number, token: number): Promise<boolean> {
    return new Promise(resolve => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      const id = window.setTimeout(() => {
        this.pendingWaits = this.pendingWaits.filter(item => item !== cancel);
        finish(token === this.token);
      }, ms);
      const cancel = () => {
        window.clearTimeout(id);
        finish(false);
      };
      this.pendingWaits.push(cancel);
    });
  }

  private stopWaits(): void {
    const pending = this.pendingWaits.splice(0);
    for (const cancel of pending) cancel();
  }
}
