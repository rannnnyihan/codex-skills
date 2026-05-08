/** LoginModal - 首次进入时让用户填昵称 */
import React, { useState, useEffect, useRef } from 'react';
import { useReviewStore, colorFromName } from '../store';

export function LoginModal() {
  const user = useReviewStore(s => s.user);
  const setUser = useReviewStore(s => s.setUser);
  const [nickname, setNickname] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) setTimeout(() => inputRef.current?.focus(), 100);
  }, [user]);

  if (user) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = nickname.trim();
    if (!name) return;
    setUser({ nickname: name, color: colorFromName(name) });
  }

  return (
    <div className="rv-modal-mask" style={{ zIndex: 1500 }}>
      <form className="rv-modal rv-login-modal" onSubmit={handleSubmit}>
        <div className="rv-login-title">
          <span className="rv-login-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </span>
          欢迎使用设计评审
        </div>
        <p className="rv-login-desc">请填写你的昵称，评审留下的标注会标记为你的名字。</p>
        <input
          ref={inputRef}
          className="rv-login-input"
          type="text"
          placeholder="你的昵称（如：张三、产品-小明）"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          required
        />
        {nickname.trim() && (
          <div className="rv-login-preview">
            <span
              className="rv-avatar"
              style={{ background: colorFromName(nickname.trim()) }}
            >
              {nickname.trim().slice(0, 1).toUpperCase()}
            </span>
            <span className="rv-login-preview-name">{nickname.trim()}</span>
          </div>
        )}
        <button
          className="rv-btn rv-btn-primary rv-login-btn"
          type="submit"
          disabled={!nickname.trim()}
        >
          开始评审
        </button>
      </form>
    </div>
  );
}
