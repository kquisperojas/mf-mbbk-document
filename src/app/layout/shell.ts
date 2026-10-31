import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { HubApiService } from '../core/hub-api.service';
import { DocIndexItem } from '../core/models';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html'
})
export class ShellComponent implements OnInit {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  private readonly hub = inject(HubApiService);

  sidebarOpen = false;
  userMenuOpen = false;
  catalogOpen = true;
  toast = '';
  private readonly allDocs = signal<DocIndexItem[]>([]);
  readonly docs = computed(() => this.allDocs().filter((doc) => doc.status !== 'borrador' && doc.hasReport !== false));
  private readonly url = signal('');
  hideFooter = computed(() => /\/(generar|administrar|iniciativas|informe)\b/.test(this.url()));
  isInforme = computed(() => /\/informe\b/.test(this.url()));

  ngOnInit(): void {
    const toast = this.auth.consumeLoginToast();
    if (toast) this.showToast(toast);
    this.refreshDocs();
    this.url.set(this.router.url);
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      this.url.set(e.urlAfterRedirects);
      this.sidebarOpen = false;
      this.userMenuOpen = false;
      if (/\/iniciativas\b/.test(e.urlAfterRedirects)) this.refreshDocs();
    });
  }

  refreshDocs(): void {
    this.hub.docsIndex().subscribe({
      next: (data) => this.allDocs.set(data.items || []),
      error: () => this.allDocs.set([])
    });
  }

  showToast(message: string): void {
    this.toast = message;
    setTimeout(() => {
      if (this.toast === message) this.toast = '';
    }, 2200);
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }

  @HostListener('document:click')
  closeMenus(): void {
    this.userMenuOpen = false;
  }

  hideAvatar(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }
}
