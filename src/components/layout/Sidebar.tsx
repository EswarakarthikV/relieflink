import { NavLink, useLocation } from 'react-router-dom'
import { Home, Compass, ClipboardList, Plus, User } from 'lucide-react'
import { cn } from '@/utils/cn'

interface SidebarProps {
  className?: string
  onCreateClick?: () => void
}

export function Sidebar({ className, onCreateClick }: SidebarProps) {
  const location = useLocation()

  // Track active state for navigation highlights
  const isBrowseActive =
    location.pathname === '/browse' ||
    location.pathname === '/drives' ||
    location.pathname === '/browse-donations'

  const isMyActivityActive =
    location.pathname === '/my-activity' ||
    location.pathname === '/my-requests'

  const isCreateActive =
    location.pathname === '/create' ||
    location.pathname === '/create-drive' ||
    location.pathname === '/drives/create'

  return (
    <aside
      aria-label="Desktop navigation"
      className={cn(
        'w-[240px] h-screen fixed left-0 top-0 z-40',
        'bg-navy-900 text-white flex flex-col justify-between p-4 select-none',
        className,
      )}
    >
      {/* ── Top section: Logo & Nav List ─────────────────────────── */}
      <div className="flex flex-col gap-6">
        {/* Logo (official brand asset + wordmark) */}
        <NavLink
          to="/home"
          className="flex items-center gap-3 px-2 py-2 rounded-input hover:bg-white/5 transition-colors"
          aria-label="ReliefLink Home"
        >
          <img
            src="/icons/icon-192.png"
            alt="ReliefLink"
            className="w-9 h-9 rounded-input object-cover shrink-0 shadow-sm border border-brand-teal/20"
          />
          <span className="text-h3 font-bold text-white tracking-tight">ReliefLink</span>
        </NavLink>

        {/* Vertical nav list: 5 unified primary tabs */}
        <nav aria-label="Sidebar main links" className="flex flex-col gap-1.5">
          {/* 1. Home Dashboard */}
          <NavLink
            to="/home"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 h-[44px] rounded-pill text-body transition-colors relative',
                isActive
                  ? 'bg-brand-600 text-white font-semibold shadow-sm'
                  : 'text-brand-100 hover:text-white hover:bg-white/10 font-medium',
              )
            }
          >
            <Home className="w-6 h-6 shrink-0" strokeWidth={2} />
            <span className="text-body font-medium">Home</span>
          </NavLink>

          {/* 2. Browse (Unified aid hub: Requests, Donations, Drives & Near Me filters) */}
          <NavLink
            to="/browse"
            className={() =>
              cn(
                'flex items-center gap-3 px-3 h-[44px] rounded-pill text-body transition-colors relative',
                isBrowseActive
                  ? 'bg-brand-600 text-white font-semibold shadow-sm'
                  : 'text-brand-100 hover:text-white hover:bg-white/10 font-medium',
              )
            }
          >
            <Compass className="w-6 h-6 shrink-0" strokeWidth={2} />
            <span className="text-body font-medium">Browse</span>
          </NavLink>

          {/* 3. My Activity (Unified hub for user's requests, donation commitments & drives) */}
          <NavLink
            to="/my-activity"
            className={() =>
              cn(
                'flex items-center gap-3 px-3 h-[44px] rounded-pill text-body transition-colors relative',
                isMyActivityActive
                  ? 'bg-brand-600 text-white font-semibold shadow-sm'
                  : 'text-brand-100 hover:text-white hover:bg-white/10 font-medium',
              )
            }
          >
            <ClipboardList className="w-6 h-6 shrink-0" strokeWidth={2} />
            <span className="text-body font-medium">My Activity</span>
          </NavLink>

          {/* 4. Create (Modal chooser for requests and collection drives) */}
          <button
            type="button"
            onClick={onCreateClick}
            className={cn(
              'flex items-center gap-3 px-3 h-[44px] rounded-pill text-body transition-colors relative text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600',
              isCreateActive
                ? 'bg-brand-600 text-white font-semibold shadow-sm'
                : 'text-brand-100 hover:text-white hover:bg-white/10 font-medium',
            )}
            aria-label="Create item"
          >
            <Plus className="w-6 h-6 shrink-0" strokeWidth={2} />
            <span className="text-body font-medium">Create</span>
          </button>

          {/* 5. User Profile & Settings */}
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 h-[44px] rounded-pill text-body transition-colors relative',
                isActive
                  ? 'bg-brand-600 text-white font-semibold shadow-sm'
                  : 'text-brand-100 hover:text-white hover:bg-white/10 font-medium',
              )
            }
          >
            <User className="w-6 h-6 shrink-0" strokeWidth={2} />
            <span className="text-body font-medium">Profile</span>
          </NavLink>
        </nav>
      </div>

      {/* ── Bottom section: User Card ────────────────────────────── */}
      <div className="pt-4 border-t border-white/10 px-2 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white font-semibold text-caption shrink-0">
          PS
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-body font-semibold text-white truncate leading-tight">
            Priya Sharma
          </span>
          <span className="text-[12px] text-brand-100 font-medium">Donor</span>
        </div>
      </div>
    </aside>
  )
}
