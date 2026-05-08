import type { TypeMeta, ReviewConfig, PageGroup } from './types';

export const DEFAULT_PAGES: PageGroup[] = [
  {
    group: '主流程',
    items: [
      { key: 'home',       file: '/',            name: 'Create 首页',  desc: '技能选择与团队展示' },
      { key: 'translate',  file: '/translate',   name: '影视译制',     desc: '翻译工作流' },
      { key: 'generate',   file: '/generate',    name: '视频制作',     desc: 'AI 分镜生成' },
      { key: 'livestream', file: '/livestream',  name: '直播剪辑',     desc: '直播切片工具' },
    ],
  },
  {
    group: '精调页',
    items: [
      { key: 'translate-finetune', file: '/translate/finetune', name: '译制精调', desc: '字幕/配音精调' },
      { key: 'generate-finetune',  file: '/generate/finetune',  name: '分镜精调', desc: '分镜编辑与风格调整' },
    ],
  },
];

export const DEFAULT_CONFIG: ReviewConfig = {
  productName: 'Design Review',
  storageKey: 'review_v4',
  pages: DEFAULT_PAGES,
};

export const TYPE_META: Record<string, TypeMeta> = {
  interact: { label: '交互',     color: '#3b82f6' },
  bug:      { label: '问题',     color: '#ef4444' },
  suggest:  { label: '建议',     color: '#f59e0b' },
  intent:   { label: '设计意图', color: '#6b7280' },
};
