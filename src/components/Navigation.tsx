import React from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, ClipboardList, Target, Compass, Video, MapPin, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '../lib/utils';

export function Navigation() {
  const navItems = [
    { to: '/', label: 'Home', icon: Target },
    { to: '/scorecards', label: 'Scorecards', icon: MapPin },
    { to: '/caddy', label: 'Caddy', icon: Compass },
    { to: '/library', label: 'Swings', icon: Video },
    { to: '/ledger', label: 'Ledger', icon: ClipboardList },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-md border-t border-zinc-800 pb-safe">
      <div className="flex justify-around items-center h-16 container mx-auto max-w-md px-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
              isActive ? "text-blue-400" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] uppercase font-semibold tracking-wider">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
