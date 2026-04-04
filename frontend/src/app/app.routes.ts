import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/landing-page.component').then(
        (module) => module.LandingPageComponent,
      ),
  },
];
