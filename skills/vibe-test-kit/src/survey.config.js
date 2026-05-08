/**
 * vibe-test-kit — survey 默认配置
 *
 * 在你的项目里：
 *   1) 直接引用本文件：<script src="src/survey.config.js"></script>
 *   2) 或自行覆盖：window.VIBE_SURVEY_CONFIG = { tasks: [...], checkpoints: [...], ... }
 *
 * 本文件是"通用版"，所有文案都是中立占位，不涉及任何具体业务。
 * 你应根据自己产品的核心流程，替换 tasks / checkpoints 的文案与 trigger。
 */
window.VIBE_SURVEY_CONFIG = {
    // ===================
    // 受测者欢迎页
    // ===================
    welcome: {
        internal: {
            title: '感谢参与可用性测试',
            subtitle: '我们希望通过你的真实操作体验，发现产品的易用性问题。',
            note: '请像第一次使用一个新产品一样自然操作。没有对错之分，你遇到的任何困惑都是我们需要改进的地方。过程中会在关键节点弹出简短问卷，请如实作答。',
            estimatedTime: '5-8 分钟',
            resourceLabel: '',       // 如需提供素材下载（如"请先下载测试视频"），填在这里
            resourceHref: '',
            resourceFilename: ''
        },
        user: {
            title: '感谢参与体验测试',
            subtitle: '请按照引导完成几个基本任务。',
            note: '请像平时使用新产品一样自然操作。过程中会弹出几个简短问题，请如实作答。',
            estimatedTime: '5-8 分钟',
            resourceLabel: '',
            resourceHref: '',
            resourceFilename: ''
        }
    },

    // ===================
    // 任务目标（右下角气泡引导）
    //
    // internal: 内部测试（逐步引导，通常 3 个任务）
    // user:     真实用户（自由探索，通常 2 个任务）
    //
    // detect 字段指定：当 tracker 收到该 milestone 时，视为任务完成。
    //                 你可以在业务代码里 VibeTracker.milestone('task_1_done') 触发。
    // ===================
    tasks: {
        internal: [
            { id: 'T1', label: '完成第一个目标任务',   hint: '按你觉得合适的方式操作', detect: 'task_1_done' },
            { id: 'T2', label: '完成第二个目标任务',   hint: '',                       detect: 'task_2_done' },
            { id: 'T3', label: '完成第三个目标任务',   hint: '',                       detect: 'task_3_done' }
        ],
        user: [
            { id: 'T1', label: '完成核心任务',         hint: '', detect: 'task_1_done' },
            { id: 'T2', label: '完成辅助任务',         hint: '', detect: 'task_2_done' }
        ]
    },

    // ===================
    // 情境微问卷节点
    //
    // trigger:  等 tracker 收到哪个事件时触发（可以是 milestone name / event type / 自定义）
    // delay:    事件触发后多久弹出（ms）
    // type:     'rating'（5 点量表）/ 'sam'（情绪量表，多维度）
    // ===================
    checkpoints: {
        internal: [
            {
                id: 'onboard_ease',
                trigger: 'task_started',
                delay: 1500,
                type: 'rating',
                question: '刚才找到入口顺利吗？',
                scale: 5,
                labels: ['很困难', '有点绕', '还行', '比较顺', '一下就找到了'],
                allowComment: true,
                commentPH: '在哪卡住过？（可选）'
            },
            {
                id: 'wait_sam',
                trigger: 'processing_wait_30s',
                delay: 500,
                type: 'sam',
                question: '等待处理的这段时间感觉怎样？',
                dims: [
                    { id: 'arousal', label: '紧张程度', l: '很放松', r: '很焦虑' },
                    { id: 'valence', label: '心情',     l: '不太好', r: '挺好的' }
                ]
            },
            {
                id: 'result_sam',
                trigger: 'view_result',
                delay: 3000,
                type: 'sam',
                question: '看到结果时，感觉如何？',
                dims: [
                    { id: 'valence',   label: '满意程度', l: '不满意',         r: '很满意' },
                    { id: 'dominance', label: '掌控感',   l: '不知道怎么调',   r: '我知道怎么改' }
                ]
            },
            {
                id: 'edit_ease',
                trigger: 'task_edit',
                delay: 1500,
                type: 'rating',
                question: '刚才修改的操作顺利吗？',
                scale: 5,
                labels: ['完全不会', '有点绕', '还行', '比较顺', '很容易'],
                allowComment: true,
                commentPH: '哪个操作让你卡住了？（可选）'
            }
        ],
        user: [
            {
                id: 'onboard_ease',
                trigger: 'task_started',
                delay: 2000,
                type: 'rating',
                question: '开始使用顺利吗？',
                scale: 5,
                labels: ['很困难', '有点绕', '还行', '比较顺', '一下就找到了'],
                allowComment: false
            },
            {
                id: 'result_quality',
                trigger: 'view_result',
                delay: 3000,
                type: 'rating',
                question: '结果你满意吗？',
                scale: 5,
                labels: ['很不满意', '不太行', '一般', '还不错', '很满意'],
                allowComment: true,
                commentPH: '哪里满意/不满意？'
            }
        ]
    },

    // ===================
    // 总结问卷（全部任务完成后弹出）
    // ===================
    exitSurvey: {
        // 产品名字（用于 SUS / EV 问题里的 {product} 占位符）
        productName: '本产品',

        // SUS（System Usability Scale）10 题标准量表
        sus: [
            '我认为我会经常使用 {product}',
            '我觉得 {product} 不必要地复杂',
            '我认为 {product} 很容易使用',
            '我认为我需要技术人员的支持才能使用 {product}',
            '我觉得 {product} 的各项功能整合得很好',
            '我觉得 {product} 有太多不一致的地方',
            '我认为大多数人都能很快学会使用 {product}',
            '我觉得 {product} 用起来很麻烦',
            '我使用 {product} 时感到很有信心',
            '我需要学很多东西才能使用 {product}'
        ],

        // EV（Emotional Value）情绪价值量表
        ev: [
            '使用过程让我感到愉悦',
            '等待时我不觉得无聊',
            '看到结果让我惊喜',
            '{product} 让我觉得这件事不再困难',
            '整个过程让我有掌控感',
            '我愿意向朋友展示使用 {product} 的成果',
            '{product} 的界面让我感到专业和可信',
            '过程中的体验细节让人觉得用心',
            '整体体验超出了我的预期'
        ],

        // NPS 推荐意愿
        npsEnabled: true,

        // 开放题
        openQuestions: [
            { id: 'three_words', type: 'words',     label: '用三个词描述使用体验' },
            { id: 'best_value',  type: 'textarea', label: '你觉得最有价值的部分是什么？', ph: '请描述…' },
            { id: 'improve',     type: 'textarea', label: '你最希望改进的地方？',         ph: '请描述…' }
        ]
    }
};
