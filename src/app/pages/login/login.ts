import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { FALLBACK_ROLES, FALLBACK_SQUADS, PUBLIC_REGISTER_ROLES, isPublicRegisterRole } from '../../core/hub-data';
import { CatalogItem } from '../../core/models';
import { UserApiService } from '../../core/user-api.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  host: { class: 'login-host' }
})
export class LoginPage implements OnInit {
  private readonly api = inject(UserApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  username = '';
  password = '';
  showPassword = false;
  submitting = signal(false);
  error = signal('');
  success = signal('');

  registerOpen = signal(false);
  regUsername = '';
  regEmail = '';
  regPassword = '';
  regNombre = '';
  regRol = '';
  regSquad = '';
  showRegPassword = false;
  regSubmitting = signal(false);
  regError = signal('');
  roles = signal<CatalogItem[]>([]);
  squads = signal<CatalogItem[]>([]);

  forgotOpen = signal(false);
  forgotUsername = '';
  forgotPassword = '';
  showForgotPassword = false;
  forgotSubmitting = signal(false);
  forgotError = signal('');

  ngOnInit(): void {
    this.api.roles().subscribe({
      next: (rows) => this.setRoles(rows),
      error: () => this.setRoles([])
    });
    this.api.squads().subscribe({
      next: (rows) => this.setSquads(rows),
      error: () => this.setSquads([])
    });
  }

  private setRoles(rows: CatalogItem[]): void {
    const source = rows.length ? rows : FALLBACK_ROLES.map((nombre, i) => ({ id: String(i), nombre }));
    const only = source.filter((row) => isPublicRegisterRole(row.nombre));
    this.roles.set(only.length ? only : PUBLIC_REGISTER_ROLES.map((nombre, i) => ({ id: String(i), nombre })));
    this.regRol = this.defaultPublicRole();
  }

  private defaultPublicRole(): string {
    return (
      this.roles().find((row) => row.nombre.toLowerCase() === 'software engineer')?.nombre ||
      this.roles()[0]?.nombre ||
      PUBLIC_REGISTER_ROLES[0]
    );
  }

  private setSquads(rows: CatalogItem[]): void {
    this.squads.set(rows.length ? rows : FALLBACK_SQUADS.map((nombre, i) => ({ id: String(i), nombre })));
    this.regSquad = this.squads()[0].nombre;
  }

  login(): void {
    this.error.set('');
    this.success.set('');
    this.submitting.set(true);
    this.api.login(this.username, this.password).subscribe({
      next: (user) => {
        this.auth.saveFromUser(user);
        const next = this.route.snapshot.queryParamMap.get('next') || this.auth.homePath();
        void this.router.navigateByUrl(next);
      },
      error: (err: Error) => {
        this.submitting.set(false);
        this.error.set(err.message);
      }
    });
  }

  openRegister(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.closeForgot();
    this.regError.set('');
    this.success.set('');
    this.regRol = this.defaultPublicRole();
    this.regSquad = this.squads()[0]?.nombre || FALLBACK_SQUADS[0];
    this.registerOpen.set(true);
  }

  closeRegister(): void {
    this.registerOpen.set(false);
  }

  openForgot(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.closeRegister();
    this.forgotError.set('');
    this.success.set('');
    this.forgotUsername = this.username.trim();
    this.forgotPassword = '';
    this.showForgotPassword = false;
    this.forgotOpen.set(true);
  }

  closeForgot(): void {
    this.forgotOpen.set(false);
    this.forgotError.set('');
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target !== event.currentTarget) return;
    this.closeRegister();
    this.closeForgot();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.registerOpen()) this.closeRegister();
    if (this.forgotOpen()) this.closeForgot();
  }

  resetPassword(): void {
    this.forgotError.set('');
    const githubUsername = this.forgotUsername.trim();
    const newPassword = this.forgotPassword;
    if (!githubUsername || !newPassword) {
      this.forgotError.set('Completa usuario GitHub y contraseña nueva.');
      return;
    }
    if (newPassword.length < 8) {
      this.forgotError.set('La contraseña nueva debe tener al menos 8 caracteres.');
      return;
    }
    this.forgotSubmitting.set(true);
    this.api.resetPassword(githubUsername, newPassword).subscribe({
      next: (user) => {
        this.forgotSubmitting.set(false);
        this.closeForgot();
        this.username = user.githubUsername;
        this.password = newPassword;
        this.error.set('');
        this.success.set(`Contraseña de ${user.githubUsername} actualizada. Ya puedes entrar.`);
      },
      error: (err: Error) => {
        this.forgotSubmitting.set(false);
        this.forgotError.set(err.message);
      }
    });
  }

  register(): void {
    this.regError.set('');
    const payload = {
      githubUsername: this.regUsername.trim(),
      email: this.regEmail.trim(),
      password: this.regPassword,
      nombre: this.regNombre.trim(),
      rol: this.regRol || this.defaultPublicRole(),
      squad: this.regSquad || this.squads()[0]?.nombre || FALLBACK_SQUADS[0]
    };
    const invalid = this.api.validateCreate(payload);
    if (invalid) {
      this.regError.set(invalid);
      return;
    }
    if (!isPublicRegisterRole(payload.rol)) {
      this.regError.set('El registro solo permite Software engineer o Tech Lead.');
      return;
    }
    this.regSubmitting.set(true);
    this.api.register(payload).subscribe({
      next: (user) => {
        this.regSubmitting.set(false);
        this.registerOpen.set(false);
        this.username = user.githubUsername;
        this.password = this.regPassword;
        this.error.set('');
        this.success.set(`Usuario ${user.githubUsername} guardado. Ya puedes entrar con esa contraseña.`);
      },
      error: (err: Error) => {
        this.regSubmitting.set(false);
        this.regError.set(err.message);
      }
    });
  }
}
