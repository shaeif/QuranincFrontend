import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/guards';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },

      /* ---------- Public ---------- */
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
        path: 'reflections/new',
        title: 'Write a reflection · Tadabbur',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/compose/compose-page').then((m) => m.ComposePage),
      },
      {
        path: 'reflections/:id/edit',
        title: 'Edit reflection · Tadabbur',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/compose/compose-page').then((m) => m.ComposePage),
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
        path: 'users/:id',
        title: 'Profile · Tadabbur',
        loadComponent: () => import('./pages/author/author-page').then((m) => m.AuthorPage),
      },
      {
        path: 'settings',
        title: 'Settings · Tadabbur',
        loadComponent: () => import('./pages/settings/settings-page').then((m) => m.SettingsPage),
      },

      /* ---------- Accounts ---------- */
      {
        path: 'login',
        title: 'Log in · Tadabbur',
        canActivate: [guestGuard],
        loadComponent: () => import('./pages/auth/login-page').then((m) => m.LoginPage),
      },
      {
        path: 'signup',
        title: 'Create an account · Tadabbur',
        canActivate: [guestGuard],
        loadComponent: () => import('./pages/auth/signup-page').then((m) => m.SignupPage),
      },
      {
        path: 'verify-email',
        title: 'Verify email · Tadabbur',
        loadComponent: () => import('./pages/auth/verify-email-page').then((m) => m.VerifyEmailPage),
      },
      {
        path: 'forgot-password',
        title: 'Forgot password · Tadabbur',
        loadComponent: () => import('./pages/auth/forgot-password-page').then((m) => m.ForgotPasswordPage),
      },
      {
        path: 'reset-password',
        title: 'New password · Tadabbur',
        loadComponent: () => import('./pages/auth/reset-password-page').then((m) => m.ResetPasswordPage),
      },

      /* ---------- Signed in ---------- */
      {
        path: 'you',
        title: 'You · Tadabbur',
        loadComponent: () => import('./pages/you/you-page').then((m) => m.YouPage),
      },
      {
        path: 'account',
        title: 'Account · Tadabbur',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/account/account-page').then((m) => m.AccountPage),
      },
      {
        path: 'feed',
        title: 'Your feed · Tadabbur',
        loadComponent: () => import('./pages/library/feed-page').then((m) => m.FeedPage),
      },
      {
        path: 'bookmarks',
        title: 'Bookmarks · Tadabbur',
        loadComponent: () => import('./pages/library/bookmarks-page').then((m) => m.BookmarksPage),
      },
      {
        path: 'likes',
        title: 'Likes · Tadabbur',
        loadComponent: () => import('./pages/library/likes-page').then((m) => m.LikesPage),
      },
      {
        path: 'following',
        title: 'Following · Tadabbur',
        loadComponent: () => import('./pages/library/following-page').then((m) => m.FollowingPage),
      },
      {
        path: 'notifications',
        title: 'Notifications · Tadabbur',
        loadComponent: () => import('./pages/library/notifications-page').then((m) => m.NotificationsPage),
      },
      {
        path: 'reading',
        title: 'Reading · Tadabbur',
        loadComponent: () => import('./pages/library/reading-page').then((m) => m.ReadingPage),
      },
      {
        path: 'moderation',
        title: 'Moderation · Tadabbur',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/moderation/moderation-page').then((m) => m.ModerationPage),
      },
      {
        path: 'admin/users',
        title: 'All users · Tadabbur',
        canActivate: [authGuard],
        loadComponent: () => import('./pages/moderation/admin-users-page').then((m) => m.AdminUsersPage),
      },
    ],
  },
  { path: '**', redirectTo: 'home' },
];
