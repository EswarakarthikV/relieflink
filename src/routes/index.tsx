import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage }          from '@/features/auth/LoginPage'
import { ForgotPasswordPage }  from '@/features/auth/ForgotPasswordPage'
import { ResetPasswordPage }   from '@/features/auth/ResetPasswordPage'
import { UpdatePasswordPage }  from '@/features/auth/UpdatePasswordPage'
import { AuthCallbackPage }    from '@/features/auth/AuthCallbackPage'
import { HomePage }            from '@/features/requests/HomePage'
import { BrowsePage }          from '@/features/requests/BrowsePage'
import { RequestDetailPage }   from '@/features/requests/RequestDetailPage'
import { CreatePage }          from '@/features/offers/CreatePage'
import { AlertsPage }          from '@/features/notifications/AlertsPage'
import { AdminDashboard }      from '@/features/admin/AdminDashboard'
import { ProfilePage }         from '@/features/profile/ProfilePage'
import { CreateDrivePage }     from '@/routes/CreateDrivePage'
import { BrowseDrivesPage }     from '@/routes/BrowseDrivesPage'
import { DriveDetailPage }      from '@/routes/DriveDetailPage'
import { MyActivityPage }      from '@/routes/MyActivityPage'

import { TrackerPage }         from '@/features/requests/TrackerPage'

export const router = createBrowserRouter([
  // Root → redirect to home dashboard
  { path: '/',         element: <Navigate to="/home" replace /> },

  // Auth & Email Verification
  { path: '/login',           element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/update-password', element: <UpdatePasswordPage /> },
  { path: '/reset-password',  element: <ResetPasswordPage /> },
  { path: '/auth/callback',   element: <AuthCallbackPage /> },
  { path: '/verify-email',    element: <AuthCallbackPage /> },
  { path: '/confirm-email',   element: <AuthCallbackPage /> },

  // Main app tabs
  { path: '/home',             element: <HomePage /> },
  { path: '/browse',           element: <BrowsePage /> },
  { path: '/browse-donations', element: <Navigate to="/browse?type=donations" replace /> },
  { path: '/drives',           element: <BrowseDrivesPage /> },
  { path: '/my-activity',      element: <MyActivityPage /> },
  { path: '/my-requests',      element: <Navigate to="/my-activity" replace /> },
  { path: '/create',       element: <CreatePage /> },
  { path: '/create-drive', element: <Navigate to="/drives/create" replace /> },
  { path: '/alerts',        element: <AlertsPage /> },
  { path: '/notifications', element: <AlertsPage /> },
  { path: '/profile',       element: <ProfilePage /> },

  // Detail screens
  { path: '/requests/:id', element: <RequestDetailPage /> },
  { path: '/tracker/:id',  element: <TrackerPage /> },

  // Collection Drives
  { path: '/drives/create', element: <CreateDrivePage /> },
  { path: '/drives/:id',     element: <DriveDetailPage /> },

  // Admin
  { path: '/admin',    element: <AdminDashboard /> },

  // Catch-all
  { path: '*',         element: <Navigate to="/home" replace /> },
])
