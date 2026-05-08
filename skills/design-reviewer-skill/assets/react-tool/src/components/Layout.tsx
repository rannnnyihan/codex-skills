/** Layout - Topbar + Sidebar + Preview + RightPanel */
import React from 'react';
import { useReviewStore } from '../store';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { PreviewArea } from './PreviewArea';
import { RightPanel } from './RightPanel';

export function Layout() {
  const leftCollapsed = useReviewStore(s => s.leftCollapsed);
  const rightCollapsed = useReviewStore(s => s.rightCollapsed);

  return (
    <>
      <Topbar />
      <div className="rv-main">
        {!leftCollapsed && <Sidebar />}
        <PreviewArea />
        {!rightCollapsed && <RightPanel />}
      </div>
    </>
  );
}
