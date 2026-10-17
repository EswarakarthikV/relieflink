import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage }          from '@/features/auth/LoginPage'
import { ForgotPasswordPage }  from '@/features/auth/ForgotPasswordPage'
import { ResetPasswordPage }   from '@/features/auth/ResetPasswordPage'
import { UpdatePasswordPage }  from '@/features/auth/UpdatePasswordPage'
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
import { MyRequestsPage }      from '@/routes/MyRequestsPage'
import { BrowseDonationsPage }  from '@/routes/BrowseDonationsPage'

import { TrackerPage }         from '@/features/requests/TrackerPage'

export const router = createBrowserRouter([
  // Root → redirect to home dashboard
  { path: '/',         element: <Navigate to="/home" replace /> },

  // Auth
  { path: '/login',           element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/update-password', element: <UpdatePasswordPage /> },
  { path: '/reset-password',  element: <ResetPasswordPage /> },

  // Main app tabs
  { path: '/home',             element: <HomePage /> },
  { path: '/browse',           element: <BrowsePage /> },
  { path: '/browse-donations', element: <BrowseDonationsPage /> },
  { path: '/drives',           element: <BrowseDrivesPage /> },
  { path: '/my-requests',      element: <MyRequestsPage /> },
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
