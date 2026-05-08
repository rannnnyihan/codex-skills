/** Toast 容器 */
import React, { useEffect, useState } from 'react';
import { useReviewStore } from '../store';

export function ToastContainer() {
  const toasts = useReviewStore(s => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="rv-toast-wrap">
      {toasts.map(t => <ToastItem key={t.id} msg={t.msg} />)}
    </div>
  );
}

function ToastItem({ msg }: { msg: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setShow(true));
  }, []);
  return <div className={`rv-toast ${show ? 'show' : ''}`}>{msg}</div>;
}
