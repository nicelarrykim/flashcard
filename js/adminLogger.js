// js/adminLogger.js
// ADMIN 프로필 전용 실시간 이벤트 및 동기화 로그 뷰어
// 일반 학습자 프로필이 선택된 경우 UI와 로깅이 완전히 비활성화됩니다.

export class AdminLogger {
  static _logs = [];
  static _maxLogs = 200;
  static _isOpen = false;
  static _filter = 'ALL'; // 'ALL' | 'SYNC' | 'IDB' | 'MASTERY' | 'EVENT' | 'ERROR'
  static _isAdminActive = false;
  static _toastTimer = null;

  static isAdmin() {
    return this._isAdminActive;
  }

  /**
   * 현재 활성 프로필이 ADMIN인지 판별하고 플로팅 UI 표시/숨김 갱신
   */
  static updateAdminState(activeProfile) {
    const isAdmin = Boolean(
      activeProfile &&
      (activeProfile.id === 'prof_admin' ||
        (activeProfile.name || '').trim().toUpperCase() === 'ADMIN')
    );
    const changed = this._isAdminActive !== isAdmin;
    this._isAdminActive = isAdmin;

    if (isAdmin) {
      this.ensureUI();
      if (changed) {
        this.log('EVENT', 'ADMIN 프로필 활성화됨 - 실시간 로그 모니터링 시작');
      }
    } else {
      this.removeUI();
    }
  }

  static formatTime(date = new Date()) {
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
  }

  /**
   * ADMIN 활성 시 로그 기록 + 실시간 토스트 알림 + 콘솔 출력
   */
  static log(category, message, detail = null) {
    if (!this._isAdminActive) return;

    const entry = {
      id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      time: this.formatTime(),
      category: (category || 'EVENT').toUpperCase(),
      message,
      detail
    };

    this._logs.unshift(entry);
    if (this._logs.length > this._maxLogs) {
      this._logs.length = this._maxLogs;
    }

    // 브라우저 콘솔에도 색상 구분 출력
    const detailStr = detail ? ` | ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : '';
    console.log(`%c[ADMIN][${entry.category}] ${entry.time} ${message}${detailStr}`, 'color: #38bdf8; font-weight: bold;');

    this.renderLogList();
    this.updateBadgeCount();

    // 동기화, IDB, 승급, 에러 등 중요 이벤트 발생 시 즉시 화면에 실시간 미니 알림 표시
    if (['SYNC', 'IDB', 'MASTERY', 'ERROR'].includes(entry.category)) {
      this.showLiveToast(entry);
    }
  }

  static getCategoryBadge(cat) {
    switch (cat) {
      case 'SYNC':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      case 'IDB':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'MASTERY':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'ERROR':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      default:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }
  }

  static showLiveToast(entry) {
    if (typeof document === 'undefined') return;
    let container = document.getElementById('admin-live-toast-box');
    if (!container) {
      container = document.createElement('div');
      container.id = 'admin-live-toast-box';
      container.className = 'fixed bottom-16 right-4 z-[9998] flex flex-col items-end gap-1.5 pointer-events-none max-w-xs sm:max-w-sm';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'px-3 py-2 rounded-xl bg-slate-900/95 text-white border border-slate-700 shadow-xl backdrop-blur text-[11px] flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150';
    toast.innerHTML = `
      <span class="px-1.5 py-0.5 rounded border text-[9px] font-black ${this.getCategoryBadge(entry.category)}">${entry.category}</span>
      <span class="font-mono text-[10px] text-slate-400 shrink-0">${entry.time}</span>
      <span class="font-semibold truncate">${this.escapeHtml(entry.message)}</span>
    `;

    container.prepend(toast);
    // 최대 3개까지만 동시 표시
    while (container.children.length > 3) {
      container.lastElementChild.remove();
    }

    setTimeout(() => {
      toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
      setTimeout(() => toast.remove(), 320);
    }, 2800);
  }

  static ensureUI() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('admin-logger-root')) return;

    const root = document.createElement('div');
    root.id = 'admin-logger-root';
    root.innerHTML = `
      <!-- 우측 하단 플로팅 토글 버튼 -->
      <button id="admin-logger-toggle-btn" class="fixed bottom-4 right-4 z-[9999] px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white border border-sky-500/60 shadow-2xl flex items-center gap-2 text-xs font-black transition transform hover:scale-105">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>📋 ADMIN 로그</span>
        <span id="admin-logger-count" class="px-1.5 py-0.2 rounded-full bg-sky-600 text-white text-[10px] font-mono">0</span>
      </button>

      <!-- 실시간 로그 패널 -->
      <div id="admin-logger-panel" class="hidden fixed bottom-16 right-4 z-[9999] w-[92vw] sm:w-[460px] max-h-[65vh] flex flex-col bg-slate-950/95 text-slate-100 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-md overflow-hidden">
        <div class="px-3.5 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="text-sm">🛠️</span>
            <span class="text-xs font-black text-sky-300">ADMIN 실시간 이벤트 · 동기화 로그</span>
          </div>
          <div class="flex items-center gap-1.5">
            <button id="admin-logger-copy-btn" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 transition">복사</button>
            <button id="admin-logger-clear-btn" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-[10px] font-bold text-rose-300 transition">비우기</button>
            <button id="admin-logger-close-btn" class="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-400 transition">✕</button>
          </div>
        </div>

        <!-- 카테고리 필터 -->
        <div class="px-3 py-1.5 bg-slate-900/60 border-b border-slate-800 flex items-center gap-1 overflow-x-auto text-[10px] font-bold">
          <button data-cat="ALL" class="admin-log-filter px-2 py-0.5 rounded-md bg-sky-600 text-white">전체</button>
          <button data-cat="SYNC" class="admin-log-filter px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700">동기화(SYNC)</button>
          <button data-cat="IDB" class="admin-log-filter px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700">저장소(IDB)</button>
          <button data-cat="MASTERY" class="admin-log-filter px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700">숙련도</button>
          <button data-cat="EVENT" class="admin-log-filter px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700">이벤트</button>
          <button data-cat="ERROR" class="admin-log-filter px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700">오류</button>
        </div>

        <!-- 로그 리스트 -->
        <div id="admin-logger-list" class="flex-1 overflow-y-auto p-2.5 space-y-1.5 font-mono text-[11px] min-h-[180px]">
          <div class="text-center text-slate-500 py-8">수집된 로그가 없습니다.</div>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    document.getElementById('admin-logger-toggle-btn')?.addEventListener('click', () => {
      this._isOpen = !this._isOpen;
      const panel = document.getElementById('admin-logger-panel');
      if (panel) panel.classList.toggle('hidden', !this._isOpen);
    });

    document.getElementById('admin-logger-close-btn')?.addEventListener('click', () => {
      this._isOpen = false;
      document.getElementById('admin-logger-panel')?.classList.add('hidden');
    });

    document.getElementById('admin-logger-clear-btn')?.addEventListener('click', () => {
      this._logs = [];
      this.renderLogList();
      this.updateBadgeCount();
    });

    document.getElementById('admin-logger-copy-btn')?.addEventListener('click', async () => {
      const text = this._logs.map(l => `[${l.time}] [${l.category}] ${l.message}${l.detail ? ' | ' + JSON.stringify(l.detail) : ''}`).join('\n');
      try {
        await navigator.clipboard.writeText(text);
        const btn = document.getElementById('admin-logger-copy-btn');
        if (btn) {
          btn.innerText = '복사됨!';
          setTimeout(() => { btn.innerText = '복사'; }, 1200);
        }
      } catch { /* ignore */ }
    });

    root.querySelectorAll('.admin-log-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        this._filter = btn.dataset.cat;
        root.querySelectorAll('.admin-log-filter').forEach(b => {
          if (b.dataset.cat === this._filter) {
            b.className = 'admin-log-filter px-2 py-0.5 rounded-md bg-sky-600 text-white';
          } else {
            b.className = 'admin-log-filter px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700';
          }
        });
        this.renderLogList();
      });
    });

    this.renderLogList();
    this.updateBadgeCount();
  }

  static removeUI() {
    if (typeof document === 'undefined') return;
    document.getElementById('admin-logger-root')?.remove();
    document.getElementById('admin-live-toast-box')?.remove();
    this._isOpen = false;
  }

  static updateBadgeCount() {
    const el = document.getElementById('admin-logger-count');
    if (el) el.innerText = String(this._logs.length);
  }

  static renderLogList() {
    const listEl = document.getElementById('admin-logger-list');
    if (!listEl) return;

    const filtered = this._filter === 'ALL'
      ? this._logs
      : this._logs.filter(l => l.category === this._filter);

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="text-center text-slate-500 py-8">표시할 로그가 없습니다.</div>`;
      return;
    }

    listEl.innerHTML = filtered.map(entry => {
      const detailHtml = entry.detail
        ? `<div class="mt-0.5 text-[10px] text-slate-400 break-all">${this.escapeHtml(typeof entry.detail === 'string' ? entry.detail : JSON.stringify(entry.detail))}</div>`
        : '';
      return `
        <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800/80">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-[10px] text-slate-500">${entry.time}</span>
            <span class="px-1.5 py-0.2 rounded border text-[9px] font-black ${this.getCategoryBadge(entry.category)}">${entry.category}</span>
            <span class="text-slate-100 font-sans font-semibold text-xs">${this.escapeHtml(entry.message)}</span>
          </div>
          ${detailHtml}
        </div>
      `;
    }).join('');
  }

  static escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
