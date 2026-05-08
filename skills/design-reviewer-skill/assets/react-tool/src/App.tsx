/** Design Review - Main App */
import React, { useEffect } from 'react';
import { useReviewStore } from './store';
import type { ReviewConfig } from './types';
import { Layout } from './components/Layout';
import { ToastContainer } from './components/Toast';
import { PinPopup } from './components/PinPopup';
import { LoginModal } from './components/LoginModal';

interface Props {
  config?: Partial<ReviewConfig>;
}

export function DesignReviewApp({ config: userConfig }: Props) {
  const setConfig = useReviewStore(s => s.setConfig);
  const openPage = useReviewStore(s => s.openPage);
  const toggleAnnoMode = useReviewStore(s => s.toggleAnnoMode);
  const toggleLeft = useReviewStore(s => s.toggleLeft);
  const toggleRight = useReviewStore(s => s.toggleRight);
  const setEditing = useReviewStore(s => s.setEditing);
  const user = useReviewStore(s => s.user);

  /* Init once：注入配置 → 触发 adapter init → 选第一个页面 */
  useEffect(() => {
    if (userConfig) {
      setConfig(userConfig);
    } else {
      /* 无 config 也要触发一次 adapter 初始化 */
      useReviewStore.getState()._initAdapter();
    }
    /* 清除残留 */
    useReviewStore.setState({ editing: null, annoMode: false });
    const cfg = { ...useReviewStore.getState().config, ...(userConfig || {}) };
    if (cfg.pages[0]?.items[0]) {
      openPage(cfg.pages[0].items[0].key);
    }
  }, []); // eslint-disable-line

  /* 用户变化后也刷新 adapter（因为 user 是 adapter context 的一部分） */
  useEffect(() => {
    if (user) useReviewStore.getState()._initAdapter();
  }, [user?.nickname]);

  /* Keyboard shortcuts */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = (e.target as HTMLElement)?.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA') return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === '[') { e.preventDefault(); toggleLeft(); return; }
      if (mod && e.key === ']') { e.preventDefault(); toggleRight(); return; }
      if (mod) return;
      if (e.key === 'a' || e.key === 'A') { e.preventDefault(); toggleAnnoMode(); return; }
      if (e.key === 'Escape') {
        const s = useReviewStore.getState();
        if (s.editing) { setEditing(null); return; }
        if (s.annoMode) { useReviewStore.setState({ annoMode: false }); return; }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleAnnoMode, toggleLeft, toggleRight, setEditing]);

  return (
    <div className="review-app">
      <Layout />
      <PinPopup />
      <LoginModal />
      <ToastContainer />
    </div>
  );
}

export default DesignReviewApp;
