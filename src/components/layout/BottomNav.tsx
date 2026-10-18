import { NavLink, useLocation } from 'react-router-dom'
import {
  Home,
  Compass,
  Plus,
  ClipboardList,
  User,
} from 'lucide-react'
import { cn } from '@/utils/cn'

interface BottomNavProps {
  onCreateClick?: () => void
}

export function BottomNav({ onCreateClick }: BottomNavProps = {}) {
  const location = useLocation()

  // Active state calculations for bottom navigation items
  const isHomeActive = location.pathname === '/' || location.pathname === '/home'

  // Browse includes the main aid feed as well as legacy/nested routes
  const isBrowseActive =
    location.pathname === '/browse' ||
    location.pathname === '/drives' ||
    location.pathname === '/browse-donations'

  const isCreateActive =
    location.pathname === '/create' ||
    location.pathname === '/create-drive' ||
    location.pathname === '/drives/create'

  // My Activity combines user requests, donation offers, and collection drives
  const isMyActivityActive =
    location.pathname === '/my-activity' ||
    location.pathname === '/my-requests'

  const isProfileActive = location.pathname === '/profile'

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        'fixed bottom-0 inset-x-0 z-50',
        'bg-surface border-t border-slate-200',
        'shadow-nav pb-safe',
      )}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">

        {/* 1. Home → links to / */}
        <NavLink
          to="/"
          className={() =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 min-h-touch min-w-[48px]',
              'flex-1 rounded-input transition-colors',
              isHomeActive ? 'text-brand-600' : 'text-ink-muted hover:text-ink',
            )
          }
          aria-label="Home"
        >
          <Home className="w-6 h-6" strokeWidth={isHomeActive ? 2.5 : 1.75} />
          <span className="text-label font-medium">Home</span>
        </NavLink>

        {/* 2. Browse → links to /browse */}
        <NavLink
          to="/browse"
          className={() =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 min-h-touch min-w-[48px]',
              'flex-1 rounded-input transition-colors',
              isBrowseActive ? 'text-brand-600' : 'text-ink-muted hover:text-ink',
            )
          }
          aria-label="Browse requests"
        >
          <Compass className="w-6 h-6" strokeWidth={isBrowseActive ? 2.5 : 1.75} />
          <span className="text-label font-medium">Browse</span>
        </NavLink>

        {/* 3. Create (icon: Plus, elevated circular brand-600 button) → opens CreateChooser modal */}
        <button
          type="button"
          onClick={onCreateClick}
          className="flex flex-col items-center justify-center flex-1 -mt-5 focus:outline-none"
          aria-label="Create"
        >
          <div
            className={cn(
              'w-14 h-14 rounded-full bg-brand-600 shadow-fab',
              'flex items-center justify-center',
              'transition-transform active:scale-95 hover:bg-blue-700',
            )}
          >
            <Plus className="w-7 h-7 text-white" strokeWidth={2.5} />
          </div>
          <span
            className={cn(
              'text-label font-medium mt-0.5',
              isCreateActive ? 'text-brand-600' : 'text-ink-muted',
            )}
          >
            Create
          </span>
        </button>

        {/* 4. My Activity → links to /my-activity */}
        <NavLink
          to="/my-activity"
          className={() =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 min-h-touch min-w-[48px]',
              'flex-1 rounded-input transition-colors',
              isMyActivityActive ? 'text-brand-600' : 'text-ink-muted hover:text-ink',
            )
          }
          aria-label="My Activity"
        >
          <ClipboardList className="w-6 h-6" strokeWidth={isMyActivityActive ? 2.5 : 1.75} />
          <span className="text-label font-medium">My Activity</span>
        </NavLink>

        {/* 5. Profile → links to /profile */}
        <NavLink
          to="/profile"
          className={() =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 min-h-touch min-w-[48px]',
              'flex-1 rounded-input transition-colors',
              isProfileActive ? 'text-brand-600' : 'text-ink-muted hover:text-ink',
            )
          }
          aria-label="Profile"
        >
          <User className="w-6 h-6" strokeWidth={isProfileActive ? 2.5 : 1.75} />
          <span className="text-label font-medium">Profile</span>
        </NavLink>

      </div>
    </nav>
  )
}
