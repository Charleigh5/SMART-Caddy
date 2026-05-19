import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navigation } from './Navigation';

export function Layout() {
  return (
    <div className="min-h-screen pb-24">
      <Outlet />
      <Navigation />
    </div>
  );
}
