import { NavLink, useLocation } from 'react-router-dom'
import {
  Home,
  Compass,
  Plus,
  ClipboardList,
  Bell,
  User,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useNotifications } from '@/hooks/useNotifications'

// ── 5 tabs per spec override ──────────────────────────────────────────────
const NAV_TABS = [
  { to: '/home',        label: 'Home',        Icon: Home          },
  { to: '/browse',      label: 'Browse',      Icon: Compass       },
  // Create is the centre FAB — handled specially below
  { to: '/my-requests', label: 'My Requests', Icon: ClipboardList },
  { to: '/alerts',      label: 'Alerts',      Icon: Bell          },
]

interface BottomNavProps {
  onCreateClick?: () => void
}

export function BottomNav({ onCreateClick }: BottomNavProps = {}) {
  const location = useLocation()
  const { unreadCount } = useNotifications()

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

        {/* Tab 1: Home */}
        <NavLink
          to="/home"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 min-h-touch min-w-[56px]',
              'flex-1 rounded-input transition-colors',
              isActive ? 'text-brand-600' : 'text-ink-muted hover:text-ink',
            )
          }
          aria-label="Home"
        >
          <Home className="w-6 h-6" strokeWidth={location.pathname === '/home' ? 2.5 : 1.75} />
          <span className="text-label font-medium">Home</span>
        </NavLink>

        {/* Tab 2: Browse */}
        <NavLink
          to="/browse"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 min-h-touch min-w-[56px]',
              'flex-1 rounded-input transition-colors',
              isActive ? 'text-brand-600' : 'text-ink-muted hover:text-ink',
            )
          }
          aria-label="Browse requests"
        >
          <Compass className="w-6 h-6" strokeWidth={location.pathname === '/browse' ? 2.5 : 1.75} />
          <span className="text-label font-medium">Browse</span>
        </NavLink>

        {/* Tab 3: Create — elevated circular FAB */}
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
              location.pathname === '/create' || location.pathname === '/create-drive'
                ? 'text-brand-600'
                : 'text-ink-muted',
            )}
          >
            Create
          </span>
        </button>

        {/* Tab 4: My Requests */}
        <NavLink
          to="/my-requests"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 min-h-touch min-w-[56px]',
              'flex-1 rounded-input transition-colors',
              isActive ? 'text-brand-600' : 'text-ink-muted hover:text-ink',
            )
          }
          aria-label="My Requests"
        >
          <ClipboardList className="w-6 h-6" strokeWidth={location.pathname === '/my-requests' ? 2.5 : 1.75} />
          <span className="text-label font-medium">Requests</span>
        </NavLink>

        {/* Tab 5: Alerts */}
        <NavLink
          to="/alerts"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 min-h-touch min-w-[56px]',
              'flex-1 rounded-input transition-colors relative',
              isActive ? 'text-brand-600' : 'text-ink-muted hover:text-ink',
            )
          }
          aria-label="Alerts and notifications"
        >
          {({ isActive }) => (
            <>
              <div className="relative">
                <Bell className="w-6 h-6" strokeWidth={isActive ? 2.5 : 1.75} />
                {/* Unread badge */}
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {unreadCount}
                  </span>
                )}
              </div>
              <span className="text-label font-medium">Alerts</span>
            </>
          )}
        </NavLink>

      </div>
    </nav>
  )
}
