/** PinPopup - 居中模态框，编辑当前选中的标注 */
import React, { useEffect, useRef, useState } from 'react';
import { useReviewStore } from '../store';
import { TYPE_META } from '../constants';
import type { AnnoType } from '../types';

export function PinPopup() {
  const editing = useReviewStore(s => s.editing);
  const pageAnnos = useReviewStore(s => s.pageAnnos);
  const snapAnnos = useReviewStore(s => s.snapAnnos);
  const updatePageAnno = useReviewStore(s => s.updatePageAnno);
  const deletePageAnno = useReviewStore(s => s.deletePageAnno);
  const updateSnapAnno = useReviewStore(s => s.updateSnapAnno);
  const deleteSnapAnno = useReviewStore(s => s.deleteSnapAnno);
  const setEditing = useReviewStore(s => s.setEditing);
  const showToast = useReviewStore(s => s.showToast);

  /* 找出正在编辑的标注 */
  const anno = React.useMemo(() => {
    if (!editing) return null;
    const list = editing.scope === 'page'
      ? (pageAnnos[editing.bucketKey] || [])
      : (snapAnnos[editing.bucketKey] || []);
    return list.find((a: any) => a.id === editing.annoId) || null;
  }, [editing, pageAnnos, snapAnnos]);

  const [text, setText] = useState('');
  const [type, setType] = useState<AnnoType>('interact');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (anno) {
      setText(anno.text || '');
      setType(anno.type);
      setTimeout(() => textareaRef.current?.focus(), 60);
    }
  }, [anno?.id]);

  if (!anno || !editing) return null;

  const handleClose = () => setEditing(null);

  function handleSave() {
    if (!editing) return;
    const patch = { text: text.trim(), type };
    if (editing.scope === 'page') {
      updatePageAnno(editing.bucketKey, editing.annoId, patch);
    } else {
      updateSnapAnno(editing.bucketKey, editing.annoId, patch);
    }
    setEditing(null);
    showToast('已保存');
  }

  function handleDelete() {
    if (!editing) return;
    if (!window.confirm('删除这条标注？')) return;
    if (editing.scope === 'page') {
      deletePageAnno(editing.bucketKey, editing.annoId);
    } else {
      deleteSnapAnno(editing.bucketKey, editing.annoId);
    }
    showToast('已删除');
  }

  return (
    <div className="rv-modal-mask" onClick={handleClose}>
      <div className="rv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rv-modal-head">
          <span className="rv-modal-title">编辑标注</span>
          <button className="rv-modal-close" onClick={handleClose} type="button">×</button>
        </div>

        {/* 类型选择 */}
        <div className="rv-type-row">
          {(Object.keys(TYPE_META) as AnnoType[]).map(t => (
            <button
              key={t}
              className={`rv-type-btn t-${t} ${type === t ? 'on' : ''}`}
              onClick={() => setType(t)}
              type="button"
            >
              {TYPE_META[t].label}
            </button>
          ))}
        </div>

        {/* 目标元素（仅页面标注显示） */}
        {editing.scope === 'page' && (anno as any).targetSummary && (
          <div className="rv-anno-target" title={(anno as any).selector || ''}>
            {(anno as any).targetSummary}
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="rv-modal-text"
          placeholder="写下标注内容..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.stopPropagation(); handleClose(); }
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave();
          }}
        />

        <div className="rv-modal-act">
          <button className="rv-btn rv-btn-danger" onClick={handleDelete} type="button">删除</button>
          <div className="rv-spacer" />
          <button className="rv-btn" onClick={handleClose} type="button">取消</button>
          <button className="rv-btn rv-btn-primary" onClick={handleSave} type="button">保存</button>
        </div>
      </div>
    </div>
  );
}
