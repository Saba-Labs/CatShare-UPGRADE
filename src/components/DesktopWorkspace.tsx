import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { Link, useLocation } from 'react-router-dom';
import { FiArchive, FiBox, FiGrid, FiLayers, FiPackage, FiSettings, FiShoppingBag, FiShoppingCart, FiStar, FiUser } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import './DesktopWorkspace.css';

const WorkspaceContext = createContext(false);

const navigation = [
  { label: 'Products', path: '/', icon: FiPackage },
  { label: 'Catalogues', path: '/catalogues', icon: FiGrid },
  { label: 'Orders', path: '/orders', icon: FiShoppingCart },
  { label: 'Online Store', path: '/store', icon: FiShoppingBag },
  { label: 'Inventory', path: '/warehouse', icon: FiBox },
  { label: 'Categories', path: '/manage-categories', icon: FiLayers },
  { label: 'Shelf', path: '/shelf', icon: FiArchive },
  { label: 'Settings', path: '/settings', icon: FiSettings },
];

function isActive(pathname: string, path: string) {
  if (path === '/') return pathname === '/' || pathname === '/create' || pathname === '/create-bulk';
  if (path === '/settings') return pathname === path || (pathname.startsWith('/settings/') && !pathname.startsWith('/settings/pro'));
  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function DesktopWorkspace({ children }: { children: ReactNode }) {
  const nested = useContext(WorkspaceContext);
  const { pathname } = useLocation();
  const { user } = useAuth();

  if (nested || Capacitor.isNativePlatform()) return <>{children}</>;

  const current = navigation.find((item) => isActive(pathname, item.path));
  const title = pathname.startsWith('/settings/pro') ? 'Plans' : current?.label || 'Workspace';
  const name = user?.displayName || user?.email || 'Your account';

  return (
    <WorkspaceContext.Provider value>
      <div className="desktop-workspace">
        <aside className="desktop-workspace__sidebar" aria-label="Workspace navigation">
          <Link to="/" className="desktop-workspace__brand">
            <img src="https://cdn.builder.io/api/v1/image/assets%2F4b59de728c4149beae05f37141fcdb10%2Ff76700758c784ae1b7f01d6405d61f53?format=webp&width=800" alt="" />
            <span>CatShare<small>SELLER WORKSPACE</small></span>
          </Link>
          <div className="desktop-workspace__nav-label">WORKSPACE</div>
          <nav className="desktop-workspace__nav">
            {navigation.map(({ label, path, icon: Icon }) => (
              <Link key={path} to={path} className={isActive(pathname, path) ? 'is-active' : ''} aria-current={isActive(pathname, path) ? 'page' : undefined}>
                <Icon aria-hidden="true" /> <span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="desktop-workspace__sidebar-bottom">
            <Link to="/settings/pro" className={`desktop-workspace__plan ${pathname.startsWith('/settings/pro') ? 'is-active' : ''}`}>
              <FiStar aria-hidden="true" /> <span><strong>CatShare Pro</strong><small>Explore your plan</small></span><span aria-hidden="true">›</span>
            </Link>
            <Link to="/account" className="desktop-workspace__account">
              <span className="desktop-workspace__avatar">{name.charAt(0).toUpperCase()}</span>
              <span><strong>{name}</strong><small>Account settings</small></span>
              <FiUser aria-hidden="true" />
            </Link>
          </div>
        </aside>
        <div className="desktop-workspace__main">
          <header className={`desktop-workspace__header${pathname === '/' ? ' desktop-workspace__header--products' : pathname === '/catalogues' ? ' desktop-workspace__header--catalogues' : pathname === '/orders' ? ' desktop-workspace__header--orders' : ''}`}>
            <div><span className="desktop-workspace__eyebrow">YOUR WORKSPACE</span><strong>{title}</strong></div>
            <div className="desktop-workspace__header-actions">
              <Link to="/settings/pro" className="desktop-workspace__upgrade"><FiStar aria-hidden="true" /> Explore Pro</Link>
              <Link to="/account" className="desktop-workspace__header-account" aria-label="Account settings"><FiUser aria-hidden="true" /></Link>
            </div>
          </header>
          <div className="desktop-workspace__content">{children}</div>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
