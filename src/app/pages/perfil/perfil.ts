import { Component, HostListener, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { GITHUB_USERNAME_PATTERN, UserApiService } from '../../core/user-api.service';

@Component({
  selector: 'app-perfil',
  imports: [FormsModule],
  templateUrl: './perfil.html'
})
export class PerfilPage {
  readonly auth = inject(AuthService);
  private readonly api = inject(UserApiService);

  editOpen = signal(false);
  submitting = signal(false);
  error = signal('');
  success = signal('');
  githubUsername = '';
  nombre = '';
  email = '';
  perfilGithub = '';

  hideAvatar(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  loginAt(): string {
    const at = this.auth.session()?.loginAt;
    return at ? new Date(at).toLocaleString('es-PE') : '';
  }

  publicHandle(): string {
    return this.auth.session()?.publicProfile || this.auth.session()?.username || '';
  }

  publicUrl(): string {
    return this.auth.githubUrl(this.publicHandle());
  }

  openEdit(event: Event): void {
    event.preventDefault();
    const session = this.auth.session();
    this.githubUsername = session?.username || '';
    this.nombre = session?.displayName || '';
    this.email = session?.email || '';
    this.perfilGithub = this.publicHandle();
    this.error.set('');
    this.editOpen.set(true);
  }

  closeEdit(): void {
    this.editOpen.set(false);
    this.error.set('');
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeEdit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.editOpen()) this.closeEdit();
  }

  save(): void {
    this.error.set('');
    this.success.set('');
    const id = this.auth.session()?.id;
    if (!id) {
      this.error.set('Vuelve a iniciar sesión para actualizar el perfil.');
      return;
    }
    const githubUsername = this.githubUsername.trim();
    const nombre = this.nombre.trim();
    const email = this.email.trim();
    const perfilGithub = this.perfilGithub.trim();
    if (!githubUsername || !nombre || !email || !perfilGithub) {
      this.error.set('Completa usuario, nombre, correo y perfil GitHub.');
      return;
    }
    if (!GITHUB_USERNAME_PATTERN.test(githubUsername) || !GITHUB_USERNAME_PATTERN.test(perfilGithub)) {
      this.error.set('Usuario y perfil GitHub no admiten espacios ni @.');
      return;
    }
    if (!email.includes('@')) {
      this.error.set('Ingresa un correo válido.');
      return;
    }
    this.submitting.set(true);
    this.api.updateProfile(id, { githubUsername, nombre, email, perfilGithub }).subscribe({
      next: (user) => {
        this.auth.saveFromUser(user, true);
        this.submitting.set(false);
        this.closeEdit();
        this.success.set('Perfil actualizado.');
      },
      error: (err: Error) => {
        this.submitting.set(false);
        this.error.set(err.message);
      }
    });
  }
}
