// src/components/Layout.jsx
import { useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutList, TrendingUp, Upload, Sparkles, Settings } from 'lucide-react'
import { useTabbarHeight } from '../hooks/useTabbarHeight'

const NAV = [
  { to: '/',            icon: LayoutList, label: 'Ledger'      },
  { to: '/forecast',    icon: TrendingUp, label: 'Forecast'    },
  { to: '/import',      icon: Upload,     label: 'Import'      },
  { to: '/suggestions', icon: Sparkles,   label: 'Suggestions' },
  { to: '/settings',    icon: Settings,   label: 'Settings'    },
]

function NavItem({ to, icon: Icon, label, sidebar }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        sidebar
          ? `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-navy-800 text-white'
                : 'text-navy-300 hover:bg-navy-800/60 hover:text-white'
            }`
          : `flex-1 flex flex-col items-center justify-center pt-2 pb-1 text-[11px] font-medium transition-colors ${
              isActive
                ? 'text-navy-600 dark:text-navy-300'
                : 'text-slate-400 dark:text-slate-500'
            }`
      }
    >
      <Icon size={sidebar ? 17 : 22} strokeWidth={1.8} />
      <span className={sidebar ? '' : 'mt-0.5'}>{label}</span>
    </NavLink>
  )
}

export default function Layout({ children }) {
  const tabbarRef = useRef(null)
  useTabbarHeight(tabbarRef)

  return (
    <div className="app-shell flex flex-col md:flex-row" style={{ backgroundColor: 'var(--bg-app)' }}>

      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-52 shrink-0 bg-navy-900 border-r border-navy-950">
        <div className="px-5 py-6 border-b border-navy-800">
          <p className="font-serif text-xl text-white tracking-wide">CashFlow</p>
          <p className="text-navy-400 text-xs mt-0.5">Forecast &amp; Plan</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(n => <NavItem key={n.to} {...n} sidebar />)}
        </nav>
        <div className="p-4 border-t border-navy-800 text-navy-500 text-xs">
          Data stored locally
        </div>
      </aside>

      {/*
        Column shell: main scrolls; tab bar is in NORMAL DOCUMENT FLOW at the
        bottom (not position:fixed). Fixed bottom chrome is what left the
        phantom Safari-toolbar gap on iOS Home Screen.
      */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-none">
          {children}
        </main>

        {/*
          Absolute layer above the in-flow tab bar for the ledger FAB.
          Not position:fixed — avoids iOS viewport clipping.
        */}
        <div
          id="fab-root"
          className="pointer-events-none absolute inset-x-0 top-0 z-40 md:hidden"
          style={{ bottom: 'var(--tabbar-total)' }}
        />

        <nav
          ref={tabbarRef}
          data-tabbar
          className="tabbar-flow md:hidden shrink-0 z-50 flex
                     border-t border-slate-200 dark:border-slate-700
                     bg-white dark:bg-slate-900"
        >
          {NAV.map(n => <NavItem key={n.to} {...n} sidebar={false} />)}
        </nav>
      </div>
    </div>
  )
}
