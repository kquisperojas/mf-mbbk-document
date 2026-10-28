import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />'
})
export class App {
  private readonly router = inject(Router);

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      const login = event.urlAfterRedirects.startsWith('/login');
      document.body.className = login ? 'login-page' : 'app-page';
      document.title = login ? 'Ingresar · Portal MBBK' : 'Portal MBBK';
    });
  }
}
