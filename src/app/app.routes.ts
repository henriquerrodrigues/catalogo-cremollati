import { Routes } from '@angular/router';
import { CatalogoComponent } from './pages/catalogo/catalogo';

export const routes: Routes = [
  // Redireciona a raiz para o catálogo (opcional)
  { 
    path: '', 
    redirectTo: 'catalogo', 
    pathMatch: 'full' 
  },
  
  // Rota para acessar o catálogo
  { 
    path: 'catalogo', 
    component: CatalogoComponent 
  },
  
  // Rota coringa para caso digitem algo errado (opcional)
  { 
    path: '**', 
    redirectTo: 'catalogo' 
  }
];