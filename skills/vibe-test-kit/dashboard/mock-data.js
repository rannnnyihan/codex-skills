/**
 * vibe-test-kit — mock-data.js
 *
 * 生成一组示例用户事件，覆盖各种典型状态：
 *   - 完成全流程 + 填完问卷
 *   - 完成但 SUS/NPS 偏低
 *   - 上传完卡在处理阶段
 *   - 打开就离开（高犹豫）
 *   - 反复点击（困惑）
 *   - 报错用户
 *
 * 用法：在 dashboard 里选择"模拟数据"时调用 VibeMock.generate()。
 */
(function(global) {
'use strict';

var TEST_ID = 'demo_round';
var NOW = Date.now();

function iso(offset) { return new Date(NOW - offset * 1000).toISOString(); }

function makeEvents(uid, scenario) {
    var seq = 0;
    var t = 0; // elapsed
    var events = [];
    function push(type, detail, elapsed) {
        seq++;
        if (typeof elapsed === 'number') t = elapsed;
        else t += 1;
        events.push({
            seq: seq, uid: uid, test: TEST_ID,
            session: uid + '_mock',
            page: detail && detail.page || 'app',
            type: type,
            ts: iso(600 - t),
            elapsed: t,
            d: Object.assign({}, detail || {})
        });
    }

    // 所有场景共享的开头
    push('enter', { url: '/app', referrer: '', screen: '1440x900', viewport: '1280x800' }, 0);

    switch (scenario) {
    case 'complete_happy': {
        // 顺畅完成：6s 开始交互 → 任务 1-3 全部完成 → 填问卷
        push('first_interact', { how: 'click', hesitation: 6 }, 6);
        push('click', { target: '#btnStart', text: '开始', action: 'start' }, 8);
        push('milestone', { name: 'task_started' }, 12);
        push('survey_show', { checkpoint: 'onboard_ease', type: 'rating' }, 14);
        push('survey_answer', { checkpoint: 'onboard_ease', rating: 5 }, 22);
        push('phase_start', { phase: 'processing' }, 25);
        push('survey_show', { checkpoint: 'wait_sam', type: 'sam' }, 55);
        push('survey_answer', { checkpoint: 'wait_sam', sam: { arousal: 2, valence: 4 } }, 68);
        push('milestone', { name: 'view_result' }, 90);
        push('survey_show', { checkpoint: 'result_sam', type: 'sam' }, 93);
        push('survey_answer', { checkpoint: 'result_sam', sam: { valence: 5, dominance: 4 } }, 108);
        push('task_complete', { taskId: 'T1', label: '完成第一个目标任务', elapsed: 110 }, 110);
        push('milestone', { name: 'task_edit' }, 125);
        push('survey_show', { checkpoint: 'edit_ease', type: 'rating' }, 127);
        push('survey_answer', { checkpoint: 'edit_ease', rating: 4 }, 138);
        push('task_complete', { taskId: 'T2', label: '完成第二个目标任务', elapsed: 145 }, 145);
        push('click', { target: '#btnExport', action: 'export' }, 155);
        push('task_complete', { taskId: 'T3', label: '完成第三个目标任务', elapsed: 160 }, 160);
        push('survey_exit_submit', {
            susScore: 82.5,
            susAnswers: [5,2,5,1,5,2,5,1,4,2],
            ev: [5,4,5,4,5,5,4,4,5],
            nps: 9,
            npsWhy: '整体流畅，结果符合预期',
            words: ['简洁', '快', '好用'],
            open1: '偶尔加载稍慢',
            open2: '一键完成整个流程很方便'
        }, 210);
        push('leave', { duration: 215, scrollDepth: 80, interactions: seq + 5, hesitation: 6 }, 215);
        break;
    }
    case 'complete_low_sus': {
        push('first_interact', { how: 'click', hesitation: 11 }, 11);
        push('milestone', { name: 'task_started' }, 18);
        push('survey_answer', { checkpoint: 'onboard_ease', rating: 2 }, 30);
        push('phase_start', { phase: 'processing' }, 34);
        push('survey_answer', { checkpoint: 'wait_sam', sam: { arousal: 4, valence: 2 } }, 80);
        push('milestone', { name: 'view_result' }, 110);
        push('survey_answer', { checkpoint: 'result_sam', sam: { valence: 3, dominance: 2 } }, 125);
        push('task_complete', { taskId: 'T1', label: '完成第一个目标任务', elapsed: 130 }, 130);
        push('milestone', { name: 'task_edit' }, 160);
        push('survey_answer', { checkpoint: 'edit_ease', rating: 2, comment: '找不到在哪改' }, 180);
        push('task_complete', { taskId: 'T2', label: '完成第二个目标任务', elapsed: 200 }, 200);
        push('click', { target: '#btnExport', action: 'export' }, 220);
        push('task_complete', { taskId: 'T3', label: '完成第三个目标任务', elapsed: 225 }, 225);
        push('survey_exit_submit', {
            susScore: 52.5, susAnswers: [3,4,3,3,3,4,3,4,3,4],
            ev: [3,2,3,2,3,2,3,2,3], nps: 5,
            npsWhy: '功能够用但上手有门槛',
            words: ['复杂', '慢', '能用'], open1: '修改的入口很难找', open2: '基础功能还行'
        }, 280);
        push('leave', { duration: 290, scrollDepth: 60, interactions: seq + 3, hesitation: 11 }, 290);
        break;
    }
    case 'stuck_processing': {
        push('first_interact', { how: 'click', hesitation: 4 }, 4);
        push('milestone', { name: 'task_started' }, 8);
        push('survey_answer', { checkpoint: 'onboard_ease', rating: 4 }, 18);
        push('phase_start', { phase: 'processing' }, 22);
        push('tab_away', { elapsed: 55 }, 55);
        push('tab_back', { elapsed: 145 }, 145);
        push('tab_away', { elapsed: 160 }, 160);
        push('leave', { duration: 185, scrollDepth: 40, interactions: seq, hesitation: 4 }, 185);
        break;
    }
    case 'high_hesitation': {
        // 犹豫 30s，最后离开
        push('scroll', { depth: 20 }, 8);
        push('scroll', { depth: 55 }, 18);
        push('first_interact', { how: 'scroll', hesitation: 8 }, 8);
        push('tab_away', { elapsed: 35 }, 35);
        push('leave', { duration: 60, scrollDepth: 65, interactions: 3, hesitation: 8 }, 60);
        break;
    }
    case 'frustrated': {
        push('first_interact', { how: 'click', hesitation: 2 }, 2);
        push('click', { target: '#btnGo', text: '继续', action: '' }, 3);
        push('click', { target: '#btnGo', text: '继续', action: '' }, 4);
        push('click', { target: '#btnGo', text: '继续', action: '' }, 5);
        push('frustration', { target: '#btnGo', repeats: 3, hint: '反复点击同一元素，可能困惑' }, 5);
        push('click', { target: '#btnGo', text: '继续', action: '' }, 7);
        push('milestone', { name: 'task_started' }, 15);
        push('leave', { duration: 80, scrollDepth: 30, interactions: 8, hesitation: 2 }, 80);
        break;
    }
    case 'error_user': {
        push('first_interact', { how: 'click', hesitation: 5 }, 5);
        push('milestone', { name: 'task_started' }, 10);
        push('error', { msg: "Cannot read property 'xxx' of undefined", file: 'app.js', line: 42 }, 18);
        push('error', { msg: 'Network request failed', file: 'api.js', line: 88 }, 30);
        push('phase_start', { phase: 'processing' }, 32);
        push('error', { msg: 'Timeout', file: 'api.js', line: 101 }, 65);
        push('leave', { duration: 95, scrollDepth: 20, interactions: 6, hesitation: 5 }, 95);
        break;
    }
    case 'just_browsing': {
        push('scroll', { depth: 30 }, 12);
        push('scroll', { depth: 70 }, 25);
        push('first_interact', { how: 'scroll', hesitation: 12 }, 12);
        push('leave', { duration: 40, scrollDepth: 75, interactions: 2, hesitation: 12 }, 40);
        break;
    }
    }
    return events;
}

var SCENARIOS = [
    { uid: 'tester_01', scenario: 'complete_happy' },
    { uid: 'tester_02', scenario: 'complete_happy' },
    { uid: 'tester_03', scenario: 'complete_low_sus' },
    { uid: 'tester_04', scenario: 'stuck_processing' },
    { uid: 'tester_05', scenario: 'high_hesitation' },
    { uid: 'tester_06', scenario: 'frustrated' },
    { uid: 'tester_07', scenario: 'error_user' },
    { uid: 'tester_08', scenario: 'just_browsing' }
];

function generate() {
    var all = [];
    SCENARIOS.forEach(function(s) {
        all = all.concat(makeEvents(s.uid, s.scenario));
    });
    return all;
}

global.VibeMock = {
    generate: generate,
    scenarios: SCENARIOS
};

})(window);
