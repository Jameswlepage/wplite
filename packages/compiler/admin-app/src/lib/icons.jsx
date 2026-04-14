import React from 'react';
import {
  Activity,
  Add,
  Api,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Blog,
  ChartLine,
  ChevronLeft,
  Close,
  Copy,
  Dashboard as DashboardIcon,
  Debug,
  Document,
  DragVertical,
  Earth,
  Edit,
  Email,
  Events,
  Globe,
  Image,
  Integration,
  Launch,
  List,
  Menu,
  OpenPanelLeft,
  OverflowMenuVertical,
  Portfolio,
  Quotes,
  Renew,
  Search,
  Settings as SettingsIcon,
  SidePanelClose,
  SidePanelOpen,
  CheckmarkFilled,
  WarningAlt,
  Purchase,
  Locked,
  Upload,
  User,
  UserAvatar,
  View,
  ViewOff,
} from '@carbon/icons-react';

/* ── Carbon Icon registry ── */
export const iconRegistry = {
  Activity,
  Add,
  Api,
  ArrowLeft,
  Blog,
  Dashboard: DashboardIcon,
  Document,
  Earth,
  Email,
  Events,
  Globe,
  Image,
  Integration,
  Launch,
  List,
  OverflowMenuVertical,
  Portfolio,
  Quotes,
  Settings: SettingsIcon,
  SidePanelClose,
  SidePanelOpen,
  User,
  UserAvatar,
};

export function CarbonIcon({ name, size = 20, ...props }) {
  const Component = iconRegistry[name];
  if (!Component) return null;
  return <Component size={size} {...props} />;
}

/* ── Default icon map for built-in nav items ── */
export const defaultIconMap = {
  api: 'Api',
  dashboard: 'Dashboard',
  domains: 'Earth',
  docs: 'Document',
  integrations: 'Integration',
  logs: 'Activity',
  post: 'Blog',
  pages: 'Document',
  media: 'Image',
  site: 'Globe',
  users: 'User',
};

export function getNavIcon(item) {
  if (item.icon && iconRegistry[item.icon]) return <CarbonIcon name={item.icon} size={20} />;
  const mapped = defaultIconMap[item.id];
  if (mapped) return <CarbonIcon name={mapped} size={20} />;
  if (item.kind === 'collection') return <CarbonIcon name="List" size={20} />;
  if (item.kind === 'singleton') return <CarbonIcon name="Settings" size={20} />;
  return <CarbonIcon name="Document" size={20} />;
}

// Re-export individual icons used directly by components
export {
  Activity,
  Add,
  Api,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Blog,
  ChartLine,
  ChevronLeft,
  Close,
  Copy,
  DashboardIcon,
  Debug,
  Document,
  DragVertical,
  Earth,
  Edit,
  Email,
  Events,
  Globe,
  Image,
  Integration,
  Launch,
  List,
  Menu,
  OpenPanelLeft,
  OverflowMenuVertical,
  Portfolio,
  Quotes,
  Renew,
  Search,
  SettingsIcon,
  SidePanelClose,
  SidePanelOpen,
  CheckmarkFilled,
  WarningAlt,
  Purchase,
  Locked,
  Upload,
  User,
  UserAvatar,
  View,
  ViewOff,
};
