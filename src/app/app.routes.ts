import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        title: 'Tadabbur',
        loadComponent: () => import('./pages/home/home-page').then((m) => m.HomePage),
      },
      {
        path: 'quran',
        title: 'Quran · Tadabbur',
        loadComponent: () => import('./pages/quran/quran-page').then((m) => m.QuranPage),
      },
      {
        path: 'quran/:surah',
        title: 'Read · Tadabbur',
        loadComponent: () => import('./pages/surah/surah-page').then((m) => m.SurahPage),
      },
      {
        path: 'reflections',
        title: 'Reflections · Tadabbur',
        loadComponent: () => import('./pages/reflections/reflections-page').then((m) => m.ReflectionsPage),
      },
      {
        path: 'reflections/:id',
        title: 'Reflection · Tadabbur',
        loadComponent: () => import('./pages/reflection-detail/reflection-detail-page').then((m) => m.ReflectionDetailPage),
      },
      {
        path: 'search',
        title: 'Search · Tadabbur',
        loadComponent: () => import('./pages/search/search-page').then((m) => m.SearchPage),
      },
      {
        path: 'settings',
        title: 'Settings · Tadabbur',
        loadComponent: () => import('./pages/settings/settings-page').then((m) => m.SettingsPage),
      },
    ],
  },
  { path: '**', redirectTo: 'home' },
];
