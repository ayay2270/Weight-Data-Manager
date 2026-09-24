import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  Scale,
  ArrowLeftRight,
  Settings,
} from 'lucide-react'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/weight-data', label: 'Weight Data', icon: Scale },
  { to: '/export', label: 'Import / Export', icon: ArrowLeftRight },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <img
          className="brand-logo"
          src={`${import.meta.env.BASE_URL}lenovo-logo.png`}
          alt="Lenovo"
          width={58}
          height={16}
        />
        <div className="brand-copy">
          <strong>Weight Data Manager</strong>
          <small>Engineering weight database</small>
        </div>
      </div>
      <nav>
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div>Local browser storage · V1</div>
        <div className="sidebar-build">Build: {__APP_GIT_COMMIT__}</div>
      </div>
    </aside>
  )
}
