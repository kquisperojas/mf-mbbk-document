import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CredentialApiService } from '../../core/credential-api.service';
import { ApiCredential } from '../../core/models';

@Component({
  selector: 'app-credenciales',
  imports: [FormsModule],
  templateUrl: './credenciales.html'
})
export class CredencialesPage implements OnInit {
  private readonly api = inject(CredentialApiService);

  githubToken = '';
  jiraEmail = '';
  jiraToken = '';
  jiraBaseUrl = 'https://pichinchaperu.atlassian.net';
  githubSet = false;
  jiraTokenSet = false;
  submitting = signal(false);
  error = signal('');
  success = signal('');

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.error.set('');
    this.api.list().subscribe({
      next: (rows) => this.apply(rows),
      error: (err: Error) => this.error.set(err.message)
    });
  }

  save(): void {
    this.error.set('');
    this.success.set('');
    const jobs: ReturnType<CredentialApiService['upsert']>[] = [];
    if (this.githubToken.trim()) {
      jobs.push(
        this.api.upsert({
          proveedor: 'github',
          clave: 'GITHUB_TOKEN',
          valor: this.githubToken.trim(),
          descripcion: 'Token GitHub para leer ramas y código'
        })
      );
    }
    if (this.jiraEmail.trim()) {
      jobs.push(
        this.api.upsert({
          proveedor: 'jira',
          clave: 'JIRA_EMAIL',
          valor: this.jiraEmail.trim(),
          descripcion: 'Correo Atlassian'
        })
      );
    }
    if (this.jiraToken.trim()) {
      jobs.push(
        this.api.upsert({
          proveedor: 'jira',
          clave: 'JIRA_API_TOKEN',
          valor: this.jiraToken.trim(),
          descripcion: 'Token Jira Cloud'
        })
      );
    }
    if (this.jiraBaseUrl.trim()) {
      jobs.push(
        this.api.upsert({
          proveedor: 'jira',
          clave: 'JIRA_BASE_URL',
          valor: this.jiraBaseUrl.trim().replace(/\/+$/, ''),
          descripcion: 'Sitio Jira Cloud'
        })
      );
    }
    if (!jobs.length) {
      this.error.set('Ingresa al menos un valor para guardar.');
      return;
    }
    this.submitting.set(true);
    forkJoin(jobs).subscribe({
      next: () => {
        this.submitting.set(false);
        this.githubToken = '';
        this.jiraToken = '';
        this.success.set('Credenciales guardadas en credenciales_apis.');
        this.reload();
      },
      error: (err: Error) => {
        this.submitting.set(false);
        this.error.set(err.message);
      }
    });
  }

  private apply(rows: ApiCredential[]): void {
    const byKey = new Map(rows.map((row) => [row.clave.toUpperCase(), row]));
    const github = byKey.get('GITHUB_TOKEN');
    const email = byKey.get('JIRA_EMAIL');
    const token = byKey.get('JIRA_API_TOKEN');
    const site = byKey.get('JIRA_BASE_URL');
    this.githubSet = !!github?.configurado;
    this.jiraTokenSet = !!token?.configurado;
    if (email?.valor && email.valor !== '********') this.jiraEmail = email.valor;
    if (site?.valor && site.valor !== '********') this.jiraBaseUrl = site.valor;
  }
}
