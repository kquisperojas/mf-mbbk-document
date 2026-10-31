import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { TeamMemberDto } from '../../core/models';
import { TeamApiService } from '../../core/team-api.service';

@Component({
  selector: 'app-squad',
  imports: [FormsModule],
  templateUrl: './squad.html'
})
export class SquadPage implements OnInit {
  private readonly api = inject(TeamApiService);
  readonly auth = inject(AuthService);

  members = signal<TeamMemberDto[]>([]);
  error = signal('');
  success = signal('');

  formOpen = signal(false);
  formMode = signal<'create' | 'edit'>('create');
  formSubmitting = signal(false);
  formError = signal('');
  editingId: string | null = null;
  nombre = '';
  rol = '';
  correo = '';
  numero = '';

  deleteOpen = signal(false);
  deleteSubmitting = signal(false);
  pendingDelete = signal<TeamMemberDto | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.api.list().subscribe({
      next: (rows) => this.members.set(rows),
      error: (err: Error) => this.error.set(err.message)
    });
  }

  startCreate(): void {
    if (!this.auth.canManageSquad()) return;
    this.formMode.set('create');
    this.editingId = null;
    this.resetForm();
    this.formError.set('');
    this.success.set('');
    this.formOpen.set(true);
  }

  startEdit(member: TeamMemberDto): void {
    if (!this.auth.canManageSquad()) return;
    this.formMode.set('edit');
    this.editingId = member.id;
    this.nombre = member.nombre;
    this.rol = member.rol;
    this.correo = member.correo || '';
    this.numero = member.numero || '';
    this.formError.set('');
    this.success.set('');
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editingId = null;
    this.formError.set('');
  }

  saveForm(): void {
    if (!this.auth.canManageSquad()) return;
    this.formError.set('');
    const payload = {
      nombre: this.nombre.trim(),
      rol: this.rol.trim(),
      correo: this.correo.trim(),
      numero: this.numero.trim()
    };
    const invalid = this.api.validate(payload);
    if (invalid) {
      this.formError.set(invalid);
      return;
    }
    this.formSubmitting.set(true);
    const isEdit = this.formMode() === 'edit';
    const request = isEdit && this.editingId
      ? this.api.update(this.editingId, payload)
      : this.api.create(payload);
    request.subscribe({
      next: (member) => {
        this.formSubmitting.set(false);
        this.closeForm();
        this.success.set(
          isEdit
            ? `${member.nombre} actualizado.`
            : `${member.nombre} guardado.`
        );
        this.reload();
      },
      error: (err: Error) => {
        this.formSubmitting.set(false);
        this.formError.set(err.message);
      }
    });
  }

  askDelete(member: TeamMemberDto): void {
    if (!this.auth.canManageSquad()) return;
    this.error.set('');
    this.success.set('');
    this.pendingDelete.set(member);
    this.deleteOpen.set(true);
  }

  closeDelete(): void {
    this.deleteOpen.set(false);
    this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    if (!this.auth.canManageSquad()) return;
    const member = this.pendingDelete();
    if (!member) return;
    this.deleteSubmitting.set(true);
    this.api.delete(member.id).subscribe({
      next: () => {
        this.deleteSubmitting.set(false);
        this.closeDelete();
        this.success.set(`${member.nombre} eliminado.`);
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
    this.nombre = '';
    this.rol = '';
    this.correo = '';
    this.numero = '';
  }
}
