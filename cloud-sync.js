/* ============================================================
 * cloud-sync.js — 微光集 云端同步层（GitHub Gist 版）
 * ------------------------------------------------------------
 * 依赖：无 SDK，直接用 GitHub REST API（浏览器原生 fetch）
 * 原理：
 *   - 数据 = 一个私密 Gist 里的 JSON 文件（events/timelines/currentTimelineId）
 *   - localStorage / IndexedDB 仍是离线缓存，断网也能用
 *   - 首次同步时弹出配置弹窗，粘贴 GitHub Token（只存本机 localStorage，不写进代码）
 *   - Gist 首次自动创建并记住 ID；换新设备时在弹窗里填同一个 Gist ID 即可互通
 * 安全：
 *   - Token 只存在浏览器本地，永不进入代码仓库
 *   - Gist 为 secret 模式，只有持有 Token 的人能读写
 * 同步逻辑（与 Supabase 版一致的双向合并）：
 *   - pull 云端 → 按 id 合并（同 id 取 updatedAt 最新）→ push 回写
 *   - 删除用墓碑机制（_deletedIds），保证删除能跨设备同步
 *   - 本地任何增删改都会触发 pushCloud
 * 对外接口（与旧版完全相同，index.html 无需改动）：
 *   getOwnerId / markDeleted / unmarkDeleted / clearSpaceName
 *   pushCloud / syncFromCloud / refreshSync
 * ============================================================ */

(function () {
  'use strict';

  const GH_API = 'https://api.github.com';
  const DATA_FILE = 'weiguangji-data.json';
  const TOKEN_KEY = 'lt_gh_token_v1';
  const GIST_KEY = 'lt_gist_id_v1';
  const SPACE_KEY = 'lt_space_name_v2';
  const DELETED_IDS_KEY = 'lt_deleted_ids_v1';

  // ===== 墓碑（删除同步） =====
  function getDeletedIds() {
    try {
      const raw = localStorage.getItem(DELETED_IDS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return (typeof parsed === 'object' && parsed !== null) ? parsed : {};
    } catch (e) { return {}; }
  }
  function setDeletedIds(map) {
    try { localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(map || {})); } catch (e) {}
  }
  function markDeleted(id) {
    if (!id) return;
    const map = getDeletedIds();
    map[id] = Date.now();
    setDeletedIds(map);
  }
  window.markDeleted = markDeleted;
  function unmarkDeleted(id) {
    if (!id) return;
    const map = getDeletedIds();
    delete map[id];
    setDeletedIds(map);
  }
  window.unmarkDeleted = unmarkDeleted;

  function clearSpaceName() {
    try { localStorage.removeItem(SPACE_KEY); } catch (e) {}
  }
  window.clearSpaceName = clearSpaceName;

  // 空间名：沿用原有 UI（本机标识；数据隔离由「一个 Token/Gist = 一个人的数据」保证）
  function getOwnerId() {
    try { return localStorage.getItem(SPACE_KEY) || null; } catch (e) { return null; }
  }
  window.getOwnerId = getOwnerId;

  function setStatus(type, text) {
    if (typeof updateSyncStatus === 'function') updateSyncStatus(type, text);
  }

  // ===== GitHub API =====
  function ghHeaders() {
    return {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + localStorage.getItem(TOKEN_KEY),
      'Content-Type': 'application/json'
    };
  }
  async function ghFetch(url, opts) {
    const res = await fetch(url, opts);
    if (res.status === 401) throw new Error('TOKEN 无效或已过期，请在「更多」里重新配置');
    if (res.status === 403) throw new Error('GitHub 请求被限流，请稍后再试');
    if (!res.ok) throw new Error('GitHub API 错误：HTTP ' + res.status);
    return res.json();
  }

  // ===== 配置弹窗（动态注入，不改 index.html；安卓 WebView 不支持 prompt） =====
  function showConfigModal(needGistId) {
    return new Promise(resolve => {
      const ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10000;display:flex;align-items:center;justify-content:center;';
      const box = document.createElement('div');
      box.style.cssText = 'background:#fff;color:#222;border-radius:14px;padding:22px;max-width:340px;width:88%;font-family:inherit;box-shadow:0 12px 40px rgba(0,0,0,.3);';
      // 文案跟随界面语言（lt_lang_v1 由 app-lang.js 维护，默认中文）
      let uiLang = 'zh';
      try { uiLang = localStorage.getItem('lt_lang_v1') || 'zh'; } catch (e) {}
      const en = uiLang === 'en';
      const T = en
        ? { title: '⚙️ Connect Cloud', desc: 'Paste your GitHub Token — saved on this device, asked only once.', ph: 'Token starting with ghp_', ok: 'Connect', cancel: 'Not now' }
        : { title: '⚙️ 连接云端', desc: '粘贴 GitHub Token，贴一次永久记住', ph: 'ghp_ 开头的 Token', ok: '连接', cancel: '暂不' };
      box.innerHTML =
        '<div style="font-weight:700;font-size:17px;margin-bottom:6px;">' + T.title + '</div>' +
        '<div style="font-size:13px;color:#666;line-height:1.6;margin-bottom:12px;">' + T.desc + '</div>' +
        '<input id="gh-token-input" placeholder="' + T.ph + '" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:10px;">' +
        '<button id="gh-config-ok" style="width:100%;padding:11px;border:none;border-radius:8px;background:#4f6ef7;color:#fff;font-size:15px;font-weight:600;cursor:pointer;">' + T.ok + '</button>' +
        '<div style="text-align:center;margin-top:8px;"><a id="gh-config-cancel" style="font-size:13px;color:#999;cursor:pointer;">' + T.cancel + '</a></div>';
      ov.appendChild(box);
      document.body.appendChild(ov);
      const ok = box.querySelector('#gh-config-ok');
      const cancel = box.querySelector('#gh-config-cancel');
      setTimeout(() => { try { box.querySelector('#gh-token-input').focus(); } catch (e) {} }, 60);
      const close = v => { try { ov.remove(); } catch (e) {} resolve(v); };
      cancel.onclick = () => close(null);
      ok.onclick = () => {
        const token = (box.querySelector('#gh-token-input').value || '').trim();
        if (!token) return;
        try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
        if (needGistId) {
          const gid = (box.querySelector('#gh-gist-input').value || '').trim();
          if (gid) { try { localStorage.setItem(GIST_KEY, gid); } catch (e) {} }
        }
        close(token);
      };
    });
  }

  // ===== 发现已有数据空间（多设备共用同一 Token 时自动复用，不再各建各的） =====
  // 注意：GitHub 列表接口的 files 不含 content（只有 raw_url），v9 起改用 raw_url 读内容
  async function discoverGist() {
    try {
      const res = await fetch(GH_API + '/gists?per_page=100', { headers: ghHeaders() });
      if (!res.ok) return null;
      const list = await res.json();
      const cands = [];
      await Promise.all((Array.isArray(list) ? list : []).map(async g => {
        const f = g.files && g.files[DATA_FILE];
        if (!f) return;
        try {
          let txt = null;
          if (typeof f.content === 'string' && f.content) {
            txt = f.content;
          } else if (f.raw_url) {
            const rr = await fetch(f.raw_url);  // raw 地址自带公开访问凭证，无需鉴权
            if (rr.ok) txt = await rr.text();
          }
          if (!txt) return;
          const d = JSON.parse(txt);
          cands.push({ id: g.id, savedAt: d.savedAt || 0, count: (d.events || []).length });
        } catch (e) {}
      }));
      if (!cands.length) return null;
      // 取事件最多（其次最新）的那个作为数据主空间
      cands.sort((a, b) => (b.count - a.count) || (b.savedAt - a.savedAt));
      return cands[0].id;
    } catch (e) { return null; }
  }

  // ===== Gist ID：每次会话都先向 GitHub 确认共用空间（v8 关键修复） =====
  // 旧版逻辑「本地存过 ID 就直接用」导致早期各设备各建各的 Gist，永远无法互通。
  // 现在每次会话启动时都会列出 Token 名下的全部 Gist，自动认领事件最多的那个；
  // 只有 Token 名下确实没有任何数据 Gist 时，才沿用本地记录或新建。
  let _gistResolved = null;
  async function getGistId() {
    if (_gistResolved) return _gistResolved;
    let stored = null;
    try { stored = localStorage.getItem(GIST_KEY); } catch (e) {}
    const found = await discoverGist();
    if (found) {
      if (found !== stored) {
        try { localStorage.setItem(GIST_KEY, found); } catch (e) {}
        if (typeof showToast === 'function') showToast('已接入现有云端空间，开始合并数据…');
      }
      _gistResolved = found;
      return found;
    }
    if (stored) { _gistResolved = stored; return stored; }
    const res = await fetch(GH_API + '/gists', {
      method: 'POST',
      headers: ghHeaders(),
      body: JSON.stringify({
        description: 'Glimmer · 微光集数据（自动同步）',
        public: false,
        files: { [DATA_FILE]: { content: JSON.stringify({ events: [], timelines: [], currentTimelineId: null, savedAt: Date.now() }) } }
      })
    });
    if (!res.ok) throw new Error('创建数据空间失败：HTTP ' + res.status);
    const data = await res.json();
    try { localStorage.setItem(GIST_KEY, data.id); } catch (e) {}
    _gistResolved = data.id;
    // 提醒用户记下 Space ID（换设备用）
    if (typeof showToast === 'function') showToast('已创建云端空间，ID: ' + data.id + '（换设备要填它）');
    return data.id;
  }


  // ===== 读云端 =====
  async function pullCloud() {
    if (!localStorage.getItem(TOKEN_KEY)) return null;
    const gid = await getGistId();
    const data = await ghFetch(GH_API + '/gists/' + gid, { headers: ghHeaders() });
    const f = data.files && data.files[DATA_FILE];
    if (!f || !f.content) return null;
    try { return JSON.parse(f.content); } catch (e) { return null; }
  }

  // ===== 写云端（合并结果整体回写） =====
  let _syncing = false;
  let _queued = false;
  async function pushCloud() {
    if (_syncing) { _queued = true; return; }  // 同步中触发的推送排队补跑，不再静默丢弃
    if (!localStorage.getItem(TOKEN_KEY)) return;
    _syncing = true;
    setStatus('syncing', '同步中…');
    try {
      do {
        _queued = false;
        const now = Date.now();
        for (const e of (events || [])) { if (!e.updatedAt || e.updatedAt < now - 86400000) e.updatedAt = now; }
        for (const t of (timelines || [])) { if (!t.updatedAt || t.updatedAt < now - 86400000) t.updatedAt = now; }
        for (const e of (events || [])) unmarkDeleted(e.id);
        for (const t of (timelines || [])) unmarkDeleted(t.id);
        const gid = await getGistId();
        await ghFetch(GH_API + '/gists/' + gid, {
          method: 'PATCH',
          headers: ghHeaders(),
          body: JSON.stringify({
            files: { [DATA_FILE]: { content: JSON.stringify({
              events: events || [],
              timelines: timelines || [],
              currentTimelineId: currentTimelineId || null,
              deletedIds: getDeletedIds(),
              savedAt: now
            }) } }
          })
        });
      } while (_queued);
      setStatus('ok', '已同步');
    } catch (e) {
      console.warn('[cloud] 上传失败：', e && e.message ? e.message : e);
      setStatus('error', '同步失败');
    } finally {
      _syncing = false;
    }
  }
  window.pushCloud = pushCloud;

  // ===== 合并（同 id 取 updatedAt 最新；墓碑优先） =====
  function mergeRecords(localArr, remoteArr) {
    const deletedMap = getDeletedIds();
    const map = {};
    for (const item of (localArr || [])) {
      if (item && item.id && !deletedMap[item.id]) map[item.id] = item;
    }
    for (const item of (remoteArr || [])) {
      if (!item || !item.id) continue;
      if (deletedMap[item.id]) continue;
      if (!map[item.id]) {
        map[item.id] = item;
      } else {
        const localNewer = (map[item.id].updatedAt || 0) > (item.updatedAt || 0);
        map[item.id] = localNewer ? map[item.id] : item;
      }
    }
    return Object.values(map);
  }

  // ===== 双向合并入口 =====
  // silent=true：启动时静默模式——未配置 Token 就直接跳过，绝不弹窗挡住页面
  async function syncFromCloud(silent) {
    if (!localStorage.getItem(TOKEN_KEY)) {
      if (silent) { setStatus('off', '未连云端'); return; }
      const token = await showConfigModal(false);
      if (!token) { setStatus('off', '未连云端'); return; }
    }
    setStatus('syncing', '同步中…');
    try {
      const remote = await pullCloud();  // 1) 先拉云端（避免用本地旧数据覆盖云端）
      if (remote) {
        // 先合并云端墓碑（v8：跨设备删除不再复活）
        if (remote.deletedIds && typeof remote.deletedIds === 'object') {
          const mine = getDeletedIds();
          let changed = false;
          for (const id in remote.deletedIds) {
            const ts = remote.deletedIds[id];
            if (!mine[id] || mine[id] < ts) { mine[id] = ts; changed = true; }
          }
          if (changed) setDeletedIds(mine);
        }
        const mergedEvents = mergeRecords(events, remote.events);
        const mergedTimelines = mergeRecords(timelines, remote.timelines);
        // 时间线去重，确保至少一条默认
        const seenTl = new Set();
        timelines = mergedTimelines.filter(t => {
          if (!t || !t.id || seenTl.has(t.id)) return false;
          seenTl.add(t.id); return true;
        });
        if (timelines.length === 0) {
          timelines = [{ id: (typeof uid === 'function' ? uid() : 'tl-' + Date.now()),
            name: '我的时间线', emoji: '🌟', createdAt: Date.now(), updatedAt: Date.now() }];
        }
        // 事件去重 + 孤儿归并
        const seenEv = new Set();
        events = mergedEvents.filter(e => {
          if (!e || !e.id || seenEv.has(e.id)) return false;
          seenEv.add(e.id);
          if (!e.timelineId || !timelines.some(t => t.id === e.timelineId)) e.timelineId = timelines[0].id;
          return true;
        });
        // 当前时间线
        if (remote.currentTimelineId && timelines.some(t => t.id === remote.currentTimelineId)) {
          currentTimelineId = remote.currentTimelineId;
        } else if (!currentTimelineId || !timelines.some(t => t.id === currentTimelineId)) {
          currentTimelineId = timelines[0].id;
        }
        if (typeof saveLocalOnly === 'function') saveLocalOnly();  // 3) 存本地（不触发 push）
        console.log('[cloud] 已同步 ' + events.length + ' 条事件, ' + timelines.length + ' 条时间线');
      }
      await pushCloud();  // 4) 推合并结果（云端为空时也把本地数据推上去）
      setStatus('ok', '已同步');
    } catch (e) {
      console.warn('[cloud] syncFromCloud 失败：', e && e.message ? e.message : e);
      setStatus('error', '同步失败');
      if (typeof showToast === 'function') showToast(e && e.message ? e.message : '同步失败');
    }
  }
  window.syncFromCloud = syncFromCloud;

  // ===== 手动刷新 =====
  async function refreshSync() {
    await syncFromCloud();
    if (typeof renderTimeline === 'function') renderTimeline();
    if (typeof renderTlBar === 'function') renderTlBar();
    if (typeof showToast === 'function') showToast('已刷新同步');
  }
  window.refreshSync = refreshSync;
})();
