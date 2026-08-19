import React, { useState } from 'react';
import { useIsDesktop } from '../hooks/useMediaQuery';

interface CollapsibleSidebarProps {
  /** Existing sidebar content, unwrapped from its own fixed-width outer div. */
  children: React.ReactNode;
  /** Shown as the mobile drawer header title. */
  label: string;
  icon?: string;
  /** Desktop expanded width in px. Defaults to 208 (matches the previous w-52 sites). */
  widthPx?: number;
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  className?: string;
}

export const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({
  children,
  label,
  icon,
  widthPx = 208,
  collapsed,
  mobileOpen,
  onMobileOpenChange,
  className = ''
}) => {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <div
        className={`shrink-0 overflow-hidden transition-[width] duration-200 ${className}`}
        style={{ width: collapsed ? 0 : widthPx }}
      >
        <div style={{ width: widthPx }} className="h-full">
          {children}
        </div>
      </div>
    );
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40"
          onClick={() => onMobileOpenChange(false)}
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-[85vw] max-w-[300px] flex-col bg-white shadow-xl transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${className}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-3.5 py-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            {icon && <span className="material-symbols-outlined text-base">{icon}</span>}
            {label}
          </span>
          <button
            type="button"
            onClick={() => onMobileOpenChange(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            title="關閉"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </>
  );
};

interface SidebarToggleButtonProps {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}

export const SidebarToggleButton: React.FC<SidebarToggleButtonProps> = ({
  collapsed,
  onToggle,
  className = ''
}) => (
  <button
    type="button"
    onClick={onToggle}
    className={`flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 ${className}`}
    title={collapsed ? '展開側邊欄' : '收合側邊欄'}
  >
    <span className="material-symbols-outlined text-[18px]">
      {collapsed ? 'dock_to_right' : 'dock_to_left'}
    </span>
  </button>
);

// Pure so it's testable without rendering: which piece of state a toggle click should flip,
// and what the toggle button's own on/off state should read as, given the current breakpoint.
export function sidebarToggleTarget(isDesktop: boolean): 'collapsed' | 'mobileOpen' {
  return isDesktop ? 'collapsed' : 'mobileOpen';
}

export function sidebarToggleButtonState(isDesktop: boolean, collapsed: boolean, mobileOpen: boolean): boolean {
  return isDesktop ? collapsed : !mobileOpen;
}

export function useCollapsibleSidebar(defaultCollapsed = false) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDesktop = useIsDesktop();

  const toggle = () => {
    if (sidebarToggleTarget(isDesktop) === 'collapsed') setCollapsed(c => !c);
    else setMobileOpen(o => !o);
  };

  return {
    collapsed,
    mobileOpen,
    setMobileOpen,
    toggle,
    toggleButtonState: sidebarToggleButtonState(isDesktop, collapsed, mobileOpen)
  };
}
