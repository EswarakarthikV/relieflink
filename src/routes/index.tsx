import { createBrowserRouter, Navigate } from 'react-router-dom'
import { LoginPage }         from '@/features/auth/LoginPage'
import { HomePage }          from '@/features/requests/HomePage'
import { BrowsePage }        from '@/features/requests/BrowsePage'
import { RequestDetailPage } from '@/features/requests/RequestDetailPage'
import { CreatePage }        from '@/features/offers/CreatePage'
import { AlertsPage }        from '@/features/notifications/AlertsPage'
import { AdminDashboard }    from '@/features/admin/AdminDashboard'
import { ProfilePage }       from '@/features/profile/ProfilePage'
import { CreateDrivePage }   from '@/routes/CreateDrivePage'

export const router = createBrowserRouter([
  // Root → redirect to home dashboard
  { path: '/',         element: <Navigate to="/home" replace /> },

  // Auth
  { path: '/login',    element: <LoginPage /> },

  // Main app tabs
  { path: '/home',     element: <HomePage /> },
  { path: '/browse',   element: <BrowsePage /> },
  { path: '/create',       element: <CreatePage /> },
  { path: '/create-drive', element: <CreateDrivePage /> },
  { path: '/alerts',   element: <AlertsPage /> },
  { path: '/profile',  element: <ProfilePage /> },

  // Detail screens
  { path: '/requests/:id', element: <RequestDetailPage /> },

  // Admin
  { path: '/admin',    element: <AdminDashboard /> },

  // Catch-all
  { path: '*',         element: <Navigate to="/home" replace /> },
])
