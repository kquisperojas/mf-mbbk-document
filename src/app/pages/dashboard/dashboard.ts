import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HUB_INITIATIVES, HUB_MS_CARDS } from '../../core/hub-data';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html'
})
export class DashboardPage {
  readonly status = signal('all');
  readonly initiatives = HUB_INITIATIVES;
  readonly cards = HUB_MS_CARDS;

  readonly filteredInitiatives = computed(() => {
    const status = this.status();
    return this.initiatives.filter((row) => status === 'all' || row.status === status);
  });

  readonly filteredCards = computed(() => this.cards);

  setStatus(status: string): void {
    this.status.set(status);
  }
}
