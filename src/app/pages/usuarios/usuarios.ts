import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { FALLBACK_ROLES, FALLBACK_SQUADS } from '../../core/hub-data';
import { CatalogItem, UserDto } from '../../core/models';
import { UserApiService } from '../../core/user-api.service';

@Component({
  selector: 'app-usuarios',
  imports: [FormsModule],
  templateUrl: './usuarios.html'
})
export class UsuariosPage implements OnInit {
  private readonly api = inject(UserApiService);
  readonly auth = inject(AuthService);

  users = signal<UserDto[]>([]);
  roles = signal<CatalogItem[]>([]);
  squads = signal<CatalogItem[]>([]);
  error = signal('');
  success = signal('');

  formOpen = signal(false);
  formMode = signal<'create' | 'edit'>('create');
  formSubmitting = signal(false);
  formError = signal('');
  showPassword = false;
  editingId: string | null = null;
  githubUsername = '';
  email = '';
  password = '';
  nombre = '';
  rol = 'Software engineer';
  squad = FALLBACK_SQUADS[0];
  perfilPublico = '';

  deleteOpen = signal(false);
  deleteSubmitting = signal(false);
  pendingDelete = signal<UserDto | null>(null);

  ngOnInit(): void {
    this.reload();
    this.api.roles().subscribe({
      next: (rows) => {
        const catalog = rows.length ? rows : FALLBACK_ROLES.map((nombre, i) => ({ id: String(i), nombre }));
        this.roles.set(catalog);
      },
      error: () => this.roles.set(FALLBACK_ROLES.map((nombre, i) => ({ id: String(i), nombre })))
    });
    this.api.squads().subscribe({
      next: (rows) => this.squads.set(rows.length ? rows : [{ id: 'sq', nombre: FALLBACK_SQUADS[0] }]),
      error: () => this.squads.set([{ id: 'sq', nombre: FALLBACK_SQUADS[0] }])
    });
  }

  reload(): void {
    this.api.list().subscribe({
      next: (rows) => this.users.set(rows),
      error: (err: Error) => this.error.set(err.message)
    });
  }

  startCreate(): void {
    this.formMode.set('create');
    this.editingId = null;
    this.resetForm();
    this.formError.set('');
    this.success.set('');
    this.formOpen.set(true);
  }

  startEdit(user: UserDto): void {
    this.formMode.set('edit');
    this.editingId = user.id;
    this.githubUsername = user.githubUsername;
    this.email = user.email;
    this.password = '';
    this.nombre = user.nombre;
    this.rol = user.rol;
    this.squad = user.squad;
    this.perfilPublico = user.perfilPublico || user.githubUsername;
    this.formError.set('');
    this.success.set('');
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editingId = null;
    this.formError.set('');
    this.password = '';
  }

  saveForm(): void {
    this.formError.set('');
    const payload = {
      githubUsername: this.githubUsername.trim(),
      email: this.email.trim(),
      password: this.password,
      nombre: this.nombre.trim(),
      rol: this.rol || this.roles()[0]?.nombre || FALLBACK_ROLES[0],
      squad: this.squad || this.squads()[0]?.nombre || FALLBACK_SQUADS[0],
      perfilPublico: (this.perfilPublico || this.githubUsername).trim()
    };
    const isEdit = this.formMode() === 'edit';
    const invalid = this.api.validateCreate({
      ...payload,
      password: isEdit ? payload.password || '********' : payload.password
    });
    if (invalid && !(isEdit && invalid.toLowerCase().includes('contraseña'))) {
      this.formError.set(invalid);
      return;
    }
    if (isEdit && payload.password && payload.password.length < 8) {
      this.formError.set('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    this.formSubmitting.set(true);
    const request = isEdit && this.editingId
      ? this.api.update(this.editingId, payload)
      : this.api.register(payload);
    request.subscribe({
      next: (user) => {
        this.formSubmitting.set(false);
        this.closeForm();
        this.success.set(
          isEdit
            ? `Usuario ${user.githubUsername} actualizado.`
            : `Usuario ${user.githubUsername} guardado en PostgreSQL.`
        );
        this.reload();
      },
      error: (err: Error) => {
        this.formSubmitting.set(false);
        this.formError.set(err.message);
      }
    });
  }

  askDelete(user: UserDto): void {
    this.error.set('');
    this.success.set('');
    if (user.githubUsername.toLowerCase() === this.auth.session()?.username?.toLowerCase()) {
      this.error.set('No puedes eliminar tu propio usuario.');
      return;
    }
    this.pendingDelete.set(user);
    this.deleteOpen.set(true);
  }

  closeDelete(): void {
    this.deleteOpen.set(false);
    this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    const user = this.pendingDelete();
    if (!user) return;
    this.deleteSubmitting.set(true);
    this.api.delete(user.id).subscribe({
      next: () => {
        this.deleteSubmitting.set(false);
        this.closeDelete();
        this.success.set(`Usuario ${user.githubUsername} eliminado.`);
        this.reload();
      },
      error: (err: Error) => {
        this.deleteSubmitting.set(false);
        this.closeDelete();
        this.error.set(err.message);
      }
    });
  }

  onOverlayClick(event: MouseEvent, kind: 'form' | 'delete'): void {
    if (event.target !== event.currentTarget) return;
    if (kind === 'form') this.closeForm();
    else this.closeDelete();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.deleteOpen()) this.closeDelete();
    else if (this.formOpen()) this.closeForm();
  }

  private resetForm(): void {
    this.githubUsername = '';
    this.email = '';
    this.password = '';
    this.nombre = '';
    this.perfilPublico = '';
    this.rol =
      this.roles().find((row) => row.nombre === 'Software engineer')?.nombre ||
      this.roles()[0]?.nombre ||
      FALLBACK_ROLES[0];
    this.squad = this.squads()[0]?.nombre || FALLBACK_SQUADS[0];
  }
}
