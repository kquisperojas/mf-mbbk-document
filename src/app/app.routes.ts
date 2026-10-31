import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/auth.guard';
import { ShellComponent } from './layout/shell';
import { AdministrarPage } from './pages/administrar/administrar';
import { CatalogTablePage, CatalogoPage } from './pages/catalogo/catalogo';
import { DashboardPage } from './pages/dashboard/dashboard';
import { GenerarPage } from './pages/generar/generar';
import { InformePage } from './pages/informe/informe';
import { IniciativasPage } from './pages/iniciativas/iniciativas';
import { LoginPage } from './pages/login/login';
import { MsAgreementPage } from './pages/ms-agreement/ms-agreement';
import { PerfilPage } from './pages/perfil/perfil';
import { SquadPage } from './pages/squad/squad';
import { UsuariosPage } from './pages/usuarios/usuarios';
import { FichaIniciativaPage, FichaMsPage, VisionPage } from './pages/static/static-pages';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginPage, canActivate: [guestGuard] },
  {
    path: 'portal',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardPage },
      { path: 'squad', component: SquadPage },
      { path: 'vision', component: VisionPage },
      { path: 'ficha-iniciativa', component: FichaIniciativaPage },
      { path: 'ficha-ms', component: FichaMsPage },
      { path: 'generar', component: GenerarPage },
      { path: 'administrar', component: AdministrarPage },
      { path: 'iniciativas', component: IniciativasPage },
      { path: 'informe/:key', component: InformePage },
      { path: 'catalogo', component: CatalogoPage },
      { path: 'ms-experiencia', component: CatalogTablePage, data: { group: 'experiencia' } },
      { path: 'ms-soporte', component: CatalogTablePage, data: { group: 'soporte' } },
      { path: 'ms-agreement', component: MsAgreementPage },
      { path: 'usuarios', component: UsuariosPage, canActivate: [adminGuard] },
      { path: 'perfil', component: PerfilPage }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
