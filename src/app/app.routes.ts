import { Routes } from '@angular/router';
import { CatalogoComponent } from './pages/catalogo/catalogo';
import { EnviadoComponent } from './pages/enviado/enviado';
import { LinkInvalidoComponent } from './pages/link-invalido/link-invalido';

export const routes: Routes = [
  { path: 'c/:token', component: CatalogoComponent },
  { path: 'c/:token/enviado', component: EnviadoComponent },
  { path: 'link-invalido', component: LinkInvalidoComponent },
  { path: '', redirectTo: '/link-invalido', pathMatch: 'full' },
  { path: '**', redirectTo: '/link-invalido' }
];
