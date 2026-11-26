// js/games/siege.js
// VocaQuest 삼국지 9 50도시 정복전 & 6x8 타워 디펜스 모듈
// - 우측 최상단 '나의 왕국'에서 길로 연결된 50개 삼국지 도시를 정복
// - 6x8 구불구불한 전장: 적(상단 성문 -> 하단 전초기지) vs 아군 진격병(하단 전초기지 -> 상단 성문)
// - 아군 진격병이 적을 피해 성문에 도달하면 승리(무제한 연승 가능), 적이 전초기지 도달 시 패배(1일 4패 제한, 자정 리셋)
// - 점령 영토 및 일일 패배 횟수 Firebase / IndexedDB 동기화

import { StorageManager } from '../storage.js?v=20261127_01';
import { SoundManager } from '../tts.js?v=20261127_01';
import { MasteryManager, RANK_TYPES } from '../mastery.js?v=20261127_01';
import { FirebaseSyncManager } from '../firebaseSync.js?v=20261127_01';
import { IdbBackup } from '../idbBackup.js?v=20261127_01';
import { RTK_CITIES, RTK_EDGES, buildRtkAdjacency, getCityBattlePath } from './rtkMapData.js?v=20261127_01';

// 6종 방어 타워 정의 및 등급별 병력 소모 매트릭스 (훈련병 제외, 보병부터 전투 참가)
export const TOWER_DEFS = {
  wood: {
    id: 'wood',
    name: '나무망루',
    desc: '기본 화살 1발',
    image: 'assets/images/towers/tower_1_wood.jpg',
    range: 1.9,
    cooldownMs: 920,
    damage: 18,
    effect: 'arrow',
    accent: '#d97706',
    costs: { infantry: 60, junior: 30, senior: 16 }
  },
  stone: {
    id: 'stone',
    name: '돌타워',
    desc: '빠른 화살 연사',
    image: 'assets/images/towers/tower_2_stone.jpg',
    range: 2.1,
    cooldownMs: 500,
    damage: 21,
    effect: 'fast_arrow',
    accent: '#38bdf8',
    costs: { junior: 60, senior: 30, high: 16 }
  },
  iron: {
    id: 'iron',
    name: '철제타워',
    desc: '불화살 2발 + 화상',
    image: 'assets/images/towers/tower_3_iron.jpg',
    range: 2.2,
    cooldownMs: 850,
    damage: 24,
    effect: 'fire_twin',
    accent: '#f97316',
    costs: { senior: 60, high: 30, royal: 16, master: 8 }
  },
  magic: {
    id: 'magic',
    name: '마법 수정 타워',
    desc: '얼음(둔화) + 번개(기절)',
    image: 'assets/images/towers/tower_4_magic.jpg',
    range: 2.45,
    cooldownMs: 1000,
    damage: 30,
    effect: 'frost_shock',
    accent: '#a855f7',
    costs: { high: 60, royal: 30, master: 16 }
  },
  golden: {
    id: 'golden',
    name: '황금빛 성탑',
    desc: '빛의 화살 3발',
    image: 'assets/images/towers/tower_5_golden.jpg',
    range: 2.6,
    cooldownMs: 760,
    damage: 38,
    effect: 'light_triple',
    accent: '#eab308',
    costs: { royal: 60, master: 30 }
  },
  dragon: {
    id: 'dragon',
    name: '드래곤 타워',
    desc: '황금 관통 레이저 (4~5체)',
    image: 'assets/images/towers/tower_6_dragon.jpg',
    range: 3.1,
    cooldownMs: 1300,
    damage: 90,
    effect: 'dragon_laser',
    accent: '#ef4444',
    costs: { master: 100 }
  }
};

export const RANK_POOL_META = [
  { key: 'master',  label: '마스터',        short: '마', color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/40' },
  { key: 'royal',   label: '왕실근위대',    short: '근', color: 'text-rose-400',    bg: 'bg-rose-500/20 border-rose-500/40' },
  { key: 'high',    label: '고급기사',      short: '고', color: 'text-purple-400',  bg: 'bg-purple-500/20 border-purple-500/40' },
  { key: 'senior',  label: '중급기사',      short: '중', color: 'text-indigo-400',  bg: 'bg-indigo-500/20 border-indigo-500/40' },
  { key: 'junior',   label: '초급기사',      short: '초', color: 'text-sky-400',     bg: 'bg-sky-500/20 border-sky-500/40' },
  { key: 'infantry', label: '보병',          short: '보', color: 'text-amber-400',   bg: 'bg-amber-500/20 border-amber-500/40' }
];

export class SiegeManager {
  static MAX_DAILY_DEFEATS = 4;

  static getProfileId() {
    try {
      if (typeof StorageManager !== 'undefined' && StorageManager.getActiveProfileId) {
        return StorageManager.getActiveProfileId() || 'prof_default';
      }
    } catch { /* ignore */ }
    return 'prof_default';
  }

  static getConquestKey(profileId = null) {
    return `vocaquest_siege_conquest_${profileId || this.getProfileId()}`;
  }

  static getLocalDateStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  static getConquestState(profileId = null) {
    const pid = profileId || this.getProfileId();
    const key = this.getConquestKey(pid);
    const today = this.getLocalDateStr();

    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        const set = new Set([0, ...(Array.isArray(parsed.conqueredCities) ? parsed.conqueredCities.map(Number) : [])]);
        const isToday = parsed.date === today;
        return {
          conqueredCities: Array.from(set).sort((a, b) => a - b),
          date: today,
          defeatsToday: isToday ? (parsed.defeatsToday || 0) : 0,
          updatedAt: parsed.updatedAt || Date.now()
        };
      }
    } catch { /* ignore */ }

    const fresh = {
      conqueredCities: [0],
      date: today,
      defeatsToday: 0,
      updatedAt: Date.now()
    };
    this.saveConquestState(fresh, false, pid);
    return fresh;
  }

  static saveConquestState(state, syncServer = true, profileId = null) {
    const pid = profileId || this.getProfileId();
    const key = this.getConquestKey(pid);
    const cleanState = {
      conqueredCities: Array.from(new Set([0, ...(state.conqueredCities || []).map(Number)])).sort((a, b) => a - b),
      date: state.date || this.getLocalDateStr(),
      defeatsToday: state.defeatsToday || 0,
      updatedAt: Date.now()
    };

    try {
      localStorage.setItem(key, JSON.stringify(cleanState));
      IdbBackup.set('conquest_' + pid, cleanState);
      if (syncServer) {
        FirebaseSyncManager.uploadSiegeConquest(pid, cleanState);
      }
    } catch (e) {
      console.error('Failed to save conquest state:', e);
    }
    return cleanState;
  }

  static isAdminProfile() {
    const pid = this.getProfileId();
    if (pid === 'prof_admin') return true;
    try {
      const prof = StorageManager.getActiveProfile?.();
      if (prof && (prof.name || '').trim().toUpperCase() === 'ADMIN') return true;
    } catch { /* ignore */ }
    return false;
  }

  // performance.js 등 기존 호출부 호환용
  static getRecord() {
    const st = this.getConquestState();
    return {
      date: st.date,
      playCount: this.isAdminProfile() ? 0 : st.defeatsToday,
      defeatsToday: this.isAdminProfile() ? 0 : st.defeatsToday,
      conqueredCount: Math.max(0, st.conqueredCities.length - 1),
      bestWave: Math.max(0, st.conqueredCities.length - 1)
    };
  }

  static canPlay() {
    if (this.isAdminProfile()) return true;
    return this.getConquestState().defeatsToday < this.MAX_DAILY_DEFEATS;
  }

  static resetPlayCount() {
    const st = this.getConquestState();
    st.defeatsToday = 0;
    return this.saveConquestState(st, true);
  }

  static recordVictory(cityId) {
    const st = this.getConquestState();
    if (!st.conqueredCities.includes(cityId)) {
      st.conqueredCities.push(cityId);
    }
    return this.saveConquestState(st, true);
  }

  static recordDefeat() {
    const st = this.getConquestState();
    if (!this.isAdminProfile()) {
      st.defeatsToday = (st.defeatsToday || 0) + 1;
    }
    return this.saveConquestState(st, true);
  }

  /**
   * 모든 단어장의 보병(INFANTRY) 이상 전투 병력을 전부 합산하여 산출
   * (훈련병은 전투에서 제외)
   */
  static getTroopPoolFromWords() {
    const decks = StorageManager.getDecks ? StorageManager.getDecks() : [];
    const allWords = decks
      .flatMap(d => (d && Array.isArray(d.words)) ? d.words : [])
      .filter(Boolean);

    const counts = {
      infantry: 0,
      junior: 0,
      senior: 0,
      high: 0,
      royal: 0,
      master: 0
    };

    let combatWordCount = 0;
    allWords.forEach(w => {
      const rank = MasteryManager.getWordRank(w);
      if (rank === RANK_TYPES.RECRUIT) {
        return; // 훈련병은 전투에서 제외
      }
      combatWordCount++;
      if (rank === RANK_TYPES.INFANTRY) {
        counts.infantry++;
      } else if (rank === RANK_TYPES.JUNIOR_KNIGHT) {
        counts.junior++;
      } else if (rank === RANK_TYPES.SENIOR_KNIGHT) {
        counts.senior++;
      } else if (rank === RANK_TYPES.HIGH_KNIGHT) {
        counts.high++;
      } else if (rank === RANK_TYPES.ROYAL_GUARD) {
        counts.royal++;
      } else if (rank === RANK_TYPES.MASTER) {
        counts.master++;
      }
    });

    return { counts, totalWords: combatWordCount, allDeckWords: allWords.length, scale: 1 };
  }
}

export class SiegeGame {
  static activeInstance = null;

  static closeActiveGame() {
    if (this.activeInstance) {
      this.activeInstance.close();
    }
  }

  static pauseActiveGame() {
    const inst = this.activeInstance;
    if (inst && inst.screen === 'battle' && !inst.battleEnded) {
      inst._manualPause = true;
      inst.isPaused = true;
      const pauseBtn = document.getElementById('td-pause-btn');
      if (pauseBtn) pauseBtn.innerText = '▶️ 재개';
    }
  }

  constructor() {
    this.modalEl = null;
    this.adj = buildRtkAdjacency();
    this.selectedCityId = null;
    this.screen = 'map'; // 'map' | 'battle'

    // 전투 상태
    this.battleCity = null;
    this.battlePath = [];
    this.pathSet = new Set();
    this.towers = new Map(); // key: `${r}_${c}` -> towerObj
    this.troops = { infantry: 0, junior: 0, senior: 0, high: 0, royal: 0, master: 0 };
    this.maxTroops = { infantry: 0, junior: 0, senior: 0, high: 0, royal: 0, master: 0 };

    this.enemies = [];
    this.allies = [];
    this.projectiles = [];
    this.beams = [];
    this.particles = [];

    this.wave = 1;
    this.enemiesSpawnedInWave = 0;
    this.enemiesPerWave = 6;
    this.enemySpawnTimer = 0;
    this.allySpawnTimer = 0;
    this.nextId = 1;
    this.kills = 0;
    this.isPaused = false;
    this._manualPause = false;
    this.battleEnded = false;
    this.speedMultiplier = 1;
    this.rafId = null;
    this.lastFrameTime = 0;

    // 타워 이미지 프리로드 (로드 완료 시 정적 전장 레이어 갱신)
    this.towerImages = {};
    this._bgCanvas = null;
    this._bgDirty = true;
    this._canvasW = 0;
    this._canvasH = 0;
    this._dpr = 1;

    Object.values(TOWER_DEFS).forEach(def => {
      const img = new Image();
      img.onload = () => { this._bgDirty = true; };
      img.src = def.image;
      this.towerImages[def.id] = img;
    });

    this._onResize = () => this.setupBattleCanvas();
    this._onKeyDown = (e) => {
      if (e.key === 'Escape' && this.modalEl) {
        this.confirmClose();
      }
    };

    this._onConquestUpdated = () => {
      if (this.modalEl && this.screen === 'map') {
        this.renderWorldMap();
      }
    };
  }

  open() {
    SiegeGame.activeInstance = this;
    if (this.modalEl) this.modalEl.remove();

    this.modalEl = document.createElement('div');
    this.modalEl.id = 'siege-modal-overlay';
    this.modalEl.className = 'fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-1 sm:p-4 overflow-y-auto';
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.confirmClose();
      }
    });
    document.body.appendChild(this.modalEl);

    window.addEventListener('vocaquest_conquest_updated', this._onConquestUpdated);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('keydown', this._onKeyDown);

    // 최신 서버 정복 상태 백그라운드 동기화 후 맵 렌더
    const pid = SiegeManager.getProfileId();
    FirebaseSyncManager.downloadSiegeConquest(pid).catch(() => {});

    this.screen = 'map';
    this.renderWorldMap();
  }

  confirmClose() {
    if (this.screen === 'battle' && !this.battleEnded) {
      const wasPaused = this.isPaused;
      this.isPaused = true;
      if (confirm('진행 중인 타워 디펜스 전투가 있습니다. 정말 창을 닫으시겠습니까?\n(현재 전투는 저장되지 않습니다)')) {
        this.close();
      } else {
        this.isPaused = wasPaused;
      }
    } else {
      this.close();
    }
  }

  close() {
    this.stopBattleLoop();
    window.removeEventListener('vocaquest_conquest_updated', this._onConquestUpdated);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('keydown', this._onKeyDown);
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
    if (SiegeGame.activeInstance === this) {
      SiegeGame.activeInstance = null;
    }
  }

  stopBattleLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this._canvasObserver) {
      this._canvasObserver.disconnect();
      this._canvasObserver = null;
    }
  }

  isAttackable(cityId, conqueredSet) {
    if (conqueredSet.has(cityId)) return false;
    const neighbors = this.adj[cityId];
    if (!neighbors) return false;
    for (const nb of neighbors) {
      if (conqueredSet.has(nb)) return true;
    }
    return false;
  }

  getDifficultyMultiplier(conqueredCount) {
    return 1 + conqueredCount * 0.08;
  }

  // =========================================================================
  // 1. 삼국지 9 50도시 월드맵 화면
  // =========================================================================
  renderWorldMap() {
    if (!this.modalEl) return;
    this.stopBattleLoop();
    this.screen = 'map';

    const state = SiegeManager.getConquestState();
    const isAdmin = SiegeManager.isAdminProfile();
    const conqueredSet = new Set(state.conqueredCities);
    const conqueredCount = Math.max(0, conqueredSet.size - 1);
    const defeatsLeft = isAdmin ? 99 : Math.max(0, SiegeManager.MAX_DAILY_DEFEATS - state.defeatsToday);
    const diffMult = this.getDifficultyMultiplier(conqueredCount).toFixed(2);
    const troopInfo = SiegeManager.getTroopPoolFromWords();

    // 선택된 도시가 유효하지 않거나 이미 점령됐다면 첫 번째 침공 가능 도시 자동 선택
    if (!this.selectedCityId || !this.isAttackable(this.selectedCityId, conqueredSet)) {
      const firstAttackable = RTK_CITIES.find(c => c.id !== 0 && this.isAttackable(c.id, conqueredSet));
      this.selectedCityId = firstAttackable ? firstAttackable.id : null;
    }

    const selectedCity = this.selectedCityId ? RTK_CITIES[this.selectedCityId] : null;
    const heartsHtml = isAdmin
      ? '∞'
      : Array.from({ length: SiegeManager.MAX_DAILY_DEFEATS })
          .map((_, i) => i < defeatsLeft ? '❤️' : '🖤')
          .join('');

    this.modalEl.innerHTML = `
      <div class="w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh]">
        <!-- 상단 헤더 -->
        <div class="px-4 py-3 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <span class="text-xl">🗺️</span>
            <div>
              <h2 class="text-sm sm:text-base font-black text-white">삼국지 50성 천하통일 타워디펜스</h2>
              <p class="text-[11px] text-slate-400">우측 최상단 <strong class="text-amber-400">나의 왕국</strong>에서 연결된 도시를 침공해 성문을 함락하세요!</p>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <div class="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-emerald-400">
              점령: <span class="font-mono">${conqueredCount} / 50</span>
            </div>
            <div class="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-amber-400">
              적 난이도: <span class="font-mono">${diffMult}x</span>
            </div>
            <div class="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-rose-300" title="하루 ${SiegeManager.MAX_DAILY_DEFEATS}패 시 종료 (자정 12시 리셋, 승리 시 무제한 계속 가능)">
              남은 패배 기회: <span>${heartsHtml}</span> ${isAdmin ? '(ADMIN 무제한)' : `(${defeatsLeft}/${SiegeManager.MAX_DAILY_DEFEATS})`}
            </div>
            <button id="siege-close-btn" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition">
              ✕ 닫기
            </button>
          </div>
        </div>

        <!-- 보유 병력 요약 바 -->
        <div class="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center gap-2 overflow-x-auto text-[11px]">
          <span class="font-bold text-slate-400 shrink-0">⚔️ 전체 단어장 전투 병력(총 ${troopInfo.totalWords}명 · 훈련병 제외):</span>
          ${RANK_POOL_META.map(m => `
            <span class="px-2 py-0.5 rounded-lg border ${m.bg} ${m.color} font-bold shrink-0">
              ${m.label} <span class="font-mono">${troopInfo.counts[m.key]}</span>
            </span>
          `).join('')}
        </div>

        <!-- 삼국지 9 실사 지형 월드맵 -->
        <div class="relative flex-1 bg-slate-950 overflow-hidden flex items-center justify-center min-h-[260px]">
          <div class="relative w-full max-w-4xl aspect-[1000/562]">
            <img src="assets/images/rtk_world_map.jpg" alt="삼국지 대륙 지도" class="w-full h-full object-cover block select-none pointer-events-none" />
            <div class="absolute inset-0 bg-slate-950/15 pointer-events-none"></div>
            <svg id="siege-rtk-svg" viewBox="0 0 1000 562" class="absolute inset-0 w-full h-full select-none"></svg>
          </div>
        </div>

        <!-- 하단 출정 컨트롤 바 -->
        <div class="px-4 py-3 bg-slate-950/95 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          ${conqueredCount >= 50 ? `
            <div class="text-sm font-black text-amber-400">
              🏆 축하합니다! 삼국지 50개 도시를 모두 통일했습니다!
            </div>
            <button id="siege-reset-world-btn" class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition">
              🔄 천하통일 새 회차 시작
            </button>
          ` : selectedCity ? `
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-xl">🏯</div>
              <div>
                <div class="text-sm font-black text-white">
                  목표: <span class="text-rose-400">${selectedCity.name}</span>
                  <span class="text-xs font-normal text-slate-400 ml-1">(${selectedCity.region})</span>
                </div>
                <div class="text-xs text-slate-400">
                  적 난이도 <strong class="text-amber-400">${diffMult}x</strong> · 승리를 거두면 계속 다음 성으로 진격할 수 있습니다!
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2 ml-auto">
              ${defeatsLeft > 0 ? `
                <button id="siege-attack-btn" class="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-black text-sm shadow-lg shadow-rose-500/30 transition transform active:scale-95 flex items-center gap-2">
                  <span>⚔️</span>
                  <span>${selectedCity.name} 공격하기</span>
                </button>
              ` : `
                <div class="px-4 py-2 rounded-xl bg-rose-950/60 border border-rose-700 text-rose-300 text-xs font-bold">
                  오늘 패배 횟수(${SiegeManager.MAX_DAILY_DEFEATS}/${SiegeManager.MAX_DAILY_DEFEATS}) 소진 · 밤 12시에 초기화됩니다
                </div>
              `}
            </div>
          ` : `
            <div class="text-xs text-slate-400">공격 가능한 인접 도시를 선택하세요.</div>
          `}
        </div>
      </div>
    `;

    this.drawWorldMapSvg(conqueredSet);

    document.getElementById('siege-close-btn')?.addEventListener('click', () => this.close());
    document.getElementById('siege-attack-btn')?.addEventListener('click', () => {
      if (selectedCity && SiegeManager.canPlay()) {
        this.startBattle(selectedCity);
      }
    });
    document.getElementById('siege-reset-world-btn')?.addEventListener('click', () => {
      if (confirm('50성 점령 기록을 초기화하고 새 회차를 시작할까요?')) {
        SiegeManager.saveConquestState({
          conqueredCities: [0],
          date: SiegeManager.getLocalDateStr(),
          defeatsToday: state.defeatsToday
        }, true);
        this.renderWorldMap();
      }
    });
  }

  drawWorldMapSvg(conqueredSet) {
    const svg = document.getElementById('siege-rtk-svg');
    if (!svg) return;

    const ns = 'http://www.w3.org/2000/svg';
    let html = `
      <style>
        @keyframes rtkPulse { 0%, 100% { r: 12; opacity: 0.95; } 50% { r: 17; opacity: 0.25; } }
        .rtk-pulse { animation: rtkPulse 1.5s ease-in-out infinite; }
        .rtk-label { paint-order: stroke; stroke: rgba(15,23,42,0.92); stroke-width: 3px; stroke-linejoin: round; }
      </style>
    `;

    // 도로망 그리기
    RTK_EDGES.forEach(([a, b]) => {
      const ca = RTK_CITIES[a];
      const cb = RTK_CITIES[b];
      const both = conqueredSet.has(a) && conqueredSet.has(b);
      const one = conqueredSet.has(a) || conqueredSet.has(b);

      html += `<line x1="${ca.x}" y1="${ca.y}" x2="${cb.x}" y2="${cb.y}" stroke="rgba(15,23,42,0.65)" stroke-width="${(both || one) ? 4.2 : 2.6}" />`;
      if (both) {
        html += `<line x1="${ca.x}" y1="${ca.y}" x2="${cb.x}" y2="${cb.y}" stroke="#34d399" stroke-width="2.6" />`;
      } else if (one) {
        html += `<line x1="${ca.x}" y1="${ca.y}" x2="${cb.x}" y2="${cb.y}" stroke="#fb7185" stroke-width="2.2" stroke-dasharray="5 4" />`;
      } else {
        html += `<line x1="${ca.x}" y1="${ca.y}" x2="${cb.x}" y2="${cb.y}" stroke="#cbd5e1" stroke-width="1.3" stroke-opacity="0.5" />`;
      }
    });

    // 도시 마커
    RTK_CITIES.forEach(c => {
      const isHome = c.id === 0;
      const isConq = conqueredSet.has(c.id);
      const canAtk = this.isAttackable(c.id, conqueredSet);
      const isSel = this.selectedCityId === c.id;

      html += `<g class="rtk-city-btn cursor-pointer" data-city-id="${c.id}">`;
      if (canAtk) {
        html += `<circle cx="${c.x}" cy="${c.y}" r="13" fill="none" stroke="${isSel ? '#fde047' : '#fb7185'}" stroke-width="${isSel ? 3 : 2}" class="rtk-pulse" />`;
      }
      if (isSel) {
        html += `<circle cx="${c.x}" cy="${c.y}" r="12" fill="none" stroke="#fde047" stroke-width="2.5" />`;
      }

      const fill = isHome ? '#f59e0b' : isConq ? '#10b981' : canAtk ? '#f43f5e' : '#334155';
      const stroke = isHome ? '#fef3c7' : isConq ? '#d1fae5' : canAtk ? '#ffe4e6' : '#94a3b8';
      const r = isHome ? 11 : (isSel ? 9 : 7);

      html += `<circle cx="${c.x}" cy="${c.y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${isHome ? 2.5 : 1.8}" />`;

      const textFill = isHome ? '#fde68a' : isSel ? '#fef08a' : canAtk ? '#fecdd3' : isConq ? '#a7f3d0' : '#f1f5f9';
      html += `<text x="${c.x}" y="${c.y + (isHome ? 23 : 18)}" text-anchor="middle" font-size="${isHome ? 11 : 9.5}" font-weight="800" fill="${textFill}" class="rtk-label">${isHome ? '👑 나의 왕국' : c.name}</text>`;
      html += `</g>`;
    });

    svg.innerHTML = html;

    svg.querySelectorAll('.rtk-city-btn').forEach(el => {
      el.addEventListener('click', () => {
        const cid = parseInt(el.dataset.cityId, 10);
        if (this.isAttackable(cid, conqueredSet)) {
          this.selectedCityId = cid;
          this.renderWorldMap();
        }
      });
    });
  }

  // =========================================================================
  // 2. 6x8 타워 디펜스 + 아군 성문 진격 전장
  // =========================================================================
  startBattle(city) {
    this.stopBattleLoop();
    this.screen = 'battle';
    this.battleCity = city;
    this.battlePath = getCityBattlePath(city.id);
    this.pathSet = new Set(this.battlePath.map(([r, c]) => `${r}_${c}`));

    // 길이 아닌 땅의 절반(50%)을 랜덤하게 바위산(건설 불가)으로 지정
    const nonPathTiles = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 6; c++) {
        const k = `${r}_${c}`;
        if (!this.pathSet.has(k)) nonPathTiles.push(k);
      }
    }
    nonPathTiles.sort(() => Math.random() - 0.5);
    const rockCount = Math.floor(nonPathTiles.length / 2);
    this.rockSet = new Set(nonPathTiles.slice(0, rockCount));

    const state = SiegeManager.getConquestState();
    const conqueredCount = Math.max(0, state.conqueredCities.length - 1);
    this.conqueredCount = conqueredCount;
    this.diffMult = this.getDifficultyMultiplier(conqueredCount);

    const pool = SiegeManager.getTroopPoolFromWords();
    this.troops = { ...pool.counts };
    this.maxTroops = { ...pool.counts };
    this.towers = new Map();

    this.enemies = [];
    this.allies = [];
    this.projectiles = [];
    this.beams = [];
    this.particles = [];

    this.wave = 1;
    this.prepTimeLeft = 3000; // 전투 시작 전 3초 타워 배치 준비 시간
    this.enemyQueue = this.buildStageEnemyQueue(conqueredCount);
    this.enemySpawnTimer = 200; // 준비 시간 종료 직후 즉시 출격
    this.allySpawnTimer = 1400;
    this.nextId = 1;
    this.kills = 0;
    this.isPaused = false;
    this._manualPause = false;
    this.battleEnded = false;
    this.speedMultiplier = 1;

    // 새 전투마다 캔버스 크기/컨텍스트/배경 캐시 초기화
    this._canvasW = 0;
    this._canvasH = 0;
    this._ctx = null;
    this._unitSprites = null;
    this._bgDirty = true;

    this.renderBattleScreen();
    this.setupBattleCanvas();
    this.updateEnemyQueueUI();
    this.lastFrameTime = performance.now();
    this.loop(this.lastFrameTime);
  }

  /**
   * 스테이지 전체 적 웨이브 대기열 생성 (적 규모 2배 확대, 2~3마리 동시/연속 행군)
   */
  buildStageEnemyQueue(conqueredCount) {
    const queue = [];
    const extra = Math.floor(conqueredCount / 6);

    // Wave 1: 기존 대비 2배 규모
    const w1Count = (8 + extra) * 2;
    for (let i = 0; i < w1Count; i++) {
      const kind = i % 3 === 2 ? 'fast' : 'normal';
      const batchOffset = (i % 2 === 1) ? 0.22 : 0;
      const delayMs = (i % 2 === 0) ? 130 : 420;
      queue.push({ kind, wave: 1, delayMs, batchOffset });
    }

    // Wave 2: 기존 대비 2배 규모 (3마리 연속 행군)
    const w2Count = (10 + extra) * 2;
    for (let i = 0; i < w2Count; i++) {
      const kind = i % 4 === 3 ? 'heavy' : (i % 3 === 1 ? 'fast' : 'normal');
      const isBurstStart = i === 0;
      const delayMs = isBurstStart ? 1500 : (i % 3 === 0 ? 450 : 120);
      queue.push({ kind, wave: 2, delayMs, batchOffset: (i % 3) * 0.18 });
    }

    // Wave 3: 기존 대비 2배 규모 + 보스 2배
    const w3Count = (11 + extra) * 2;
    for (let i = 0; i < w3Count; i++) {
      const kind = i % 4 === 2 ? 'heavy' : (i % 2 === 1 ? 'fast' : 'normal');
      const delayMs = i === 0 ? 1600 : (i % 3 === 0 ? 420 : 110);
      queue.push({ kind, wave: 3, delayMs, batchOffset: (i % 3) * 0.18 });
    }

    const bossCount = (conqueredCount >= 15 ? 2 : 1) * 2;
    for (let b = 0; b < bossCount; b++) {
      queue.push({ kind: 'boss', wave: 3, delayMs: b === 0 ? 500 : 380, batchOffset: b * 0.22 });
    }

    return queue;
  }

  setupBattleCanvas() {
    const canvas = document.getElementById('td-canvas');
    if (!canvas) return;

    const syncSize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      // 6:8 정사각형 셀 비율 강제 유지
      const w = Math.max(300, Math.round(rect.width * dpr));
      const h = Math.max(400, Math.round(rect.height * dpr));
      if (this._canvasW !== w || this._canvasH !== h || this._dpr !== dpr || canvas.width !== w || canvas.height !== h || !this._ctx) {
        this._canvasW = w;
        this._canvasH = h;
        this._dpr = dpr;
        canvas.width = w;
        canvas.height = h;
        this._ctx = canvas.getContext('2d', { alpha: false });
        this._unitSprites = null;
        this._bgDirty = true;
      }
    };

    syncSize();

    if (!this._canvasObserver && typeof ResizeObserver !== 'undefined') {
      this._canvasObserver = new ResizeObserver(() => syncSize());
      this._canvasObserver.observe(canvas);
    }
  }

  buildUnitSprites(cellW, dpr) {
    const makeSprite = (sizePx, drawFn) => {
      const c = document.createElement('canvas');
      c.width = sizePx;
      c.height = sizePx;
      const sctx = c.getContext('2d');
      drawFn(sctx, sizePx);
      return c;
    };

    const allySize = Math.max(24, Math.round(cellW * 0.56));
    const enemySize = Math.max(28, Math.round(cellW * 0.60));
    const bossSize = Math.max(36, Math.round(cellW * 0.78));

    this._unitSprites = {
      ally: makeSprite(allySize, (sctx, s) => {
        const cx = s / 2;
        const r = s * 0.36;
        sctx.fillStyle = '#0ea5e9';
        sctx.beginPath();
        sctx.arc(cx, cx, r, 0, Math.PI * 2);
        sctx.fill();
        sctx.strokeStyle = '#e0f2fe';
        sctx.lineWidth = Math.max(1.5, 1.5 * dpr);
        sctx.stroke();
        sctx.textAlign = 'center';
        sctx.textBaseline = 'middle';
        sctx.font = `${Math.round(s * 0.45)}px sans-serif`;
        sctx.fillText('⚔️', cx, cx + 1);
      }),
      enemy: makeSprite(enemySize, (sctx, s) => {
        const cx = s / 2;
        sctx.textAlign = 'center';
        sctx.textBaseline = 'middle';
        sctx.font = `${Math.round(s * 0.56)}px sans-serif`;
        sctx.fillText('👾', cx, cx + 1);
      }),
      fast: makeSprite(enemySize, (sctx, s) => {
        const cx = s / 2;
        sctx.textAlign = 'center';
        sctx.textBaseline = 'middle';
        sctx.font = `${Math.round(s * 0.56)}px sans-serif`;
        sctx.fillText('🐺', cx, cx + 1);
      }),
      heavy: makeSprite(enemySize, (sctx, s) => {
        const cx = s / 2;
        sctx.textAlign = 'center';
        sctx.textBaseline = 'middle';
        sctx.font = `${Math.round(s * 0.56)}px sans-serif`;
        sctx.fillText('🛡️', cx, cx + 1);
      }),
      boss: makeSprite(bossSize, (sctx, s) => {
        const cx = s / 2;
        sctx.textAlign = 'center';
        sctx.textBaseline = 'middle';
        sctx.font = `${Math.round(s * 0.62)}px sans-serif`;
        sctx.fillText('👹', cx, cx + 1);
      })
    };
  }

  renderBattleScreen() {
    if (!this.modalEl) return;

    this.modalEl.innerHTML = `
      <div class="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[97vh]">
        <!-- 상단 전장 HUD -->
        <div class="px-3 sm:px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-1 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-300 text-xs font-black">
              ⚔️ ${this.battleCity.name} 공략전
            </span>
            <span class="text-xs font-mono text-amber-400 font-bold">
              난이도 ${this.diffMult.toFixed(2)}x
            </span>
            <span id="td-wave-label" class="text-xs font-mono text-slate-300 font-bold">
              Wave 1/3
            </span>
            <span id="td-kills-label" class="text-xs font-mono text-emerald-400 font-bold">
              처치 0
            </span>
          </div>

          <div class="flex items-center gap-1.5">
            <button id="td-speed-btn" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-black border border-slate-700 transition">
              ⏩ 1x
            </button>
            <button id="td-pause-btn" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition">
              ⏸ 일시정지
            </button>
            <button id="td-retreat-btn" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-rose-300 text-xs font-bold border border-slate-700 transition">
              🏳️ 후퇴
            </button>
            <button id="td-close-btn" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition">
              ✕
            </button>
          </div>
        </div>

        <!-- 보유 병력 실시간 잔량 바 -->
        <div id="td-troops-bar" class="px-3 py-1.5 bg-slate-900/95 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px]"></div>

        <!-- 6x8 전장 + 우측 남은 적 목록 -->
        <div class="relative flex-1 bg-slate-950 flex flex-col items-center justify-center p-2 overflow-hidden">
          <div id="td-prep-banner" class="mb-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-300 text-[11px] font-black flex items-center gap-2">
            <span>⏳ 전투 준비 중 (<span id="td-prep-sec">3.0</span>초) — 초록 칸(+)에 타워를 미리 배치하세요!</span>
            <button id="td-start-now-btn" class="px-2 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] transition">⚡ 바로 시작</button>
          </div>
          <div id="td-guide-banner" class="hidden text-[11px] text-slate-400 mb-1.5 text-center">
            초록 칸(+)을 터치해 타워를 지으세요! (⛰️ 바위산 건설 불가) · <strong class="text-sky-400">아군 병사</strong>가 <strong class="text-rose-400">적 성문</strong>에 도착하면 승리!
          </div>
          <div class="flex items-stretch justify-center gap-2 sm:gap-3 w-full max-w-2xl">
            <div class="relative shrink-0 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl bg-slate-900" style="width: min(74vw, 390px, calc((92vh - 155px) * 0.75)); aspect-ratio: 6 / 8;">
              <canvas id="td-canvas" class="w-full h-full block cursor-pointer touch-manipulation"></canvas>
              <!-- 타워 건설/관리 팝업 컨테이너 -->
              <div id="td-slot-popover" class="hidden absolute inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 z-20"></div>
              <!-- 승패 결과 오버레이 -->
              <div id="td-result-overlay" class="hidden absolute inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-30"></div>
            </div>

            <!-- 우측 남은 적 순서 패널 -->
            <div class="w-24 sm:w-36 shrink-0 bg-slate-900/95 border border-slate-700/80 rounded-2xl p-2 flex flex-col overflow-hidden" style="max-height: min(calc(74vw * 4 / 3), 520px, calc(92vh - 155px));">
              <div class="pb-1.5 mb-1.5 border-b border-slate-800 text-center">
                <div class="text-[11px] font-black text-rose-400">남은 적</div>
                <div id="td-remaining-count" class="text-sm font-black font-mono text-white">0</div>
              </div>
              <div id="td-enemy-queue-list" class="flex-1 overflow-y-auto space-y-1 pr-0.5 text-[11px]"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.updateTroopsBar();
    this.bindBattleEvents();
  }

  updateTroopsBar() {
    const bar = document.getElementById('td-troops-bar');
    if (!bar) return;
    bar.innerHTML = RANK_POOL_META.map(m => `
      <span class="px-2 py-0.5 rounded-lg border ${m.bg} ${m.color} font-bold shrink-0">
        ${m.short} <span class="font-mono">${this.troops[m.key]}/${this.maxTroops[m.key]}</span>
      </span>
    `).join('');
  }

  bindBattleEvents() {
    const speedBtn = document.getElementById('td-speed-btn');
    speedBtn?.addEventListener('click', () => {
      const nextMap = { 1: 2, 2: 3, 3: 4, 4: 1 };
      this.speedMultiplier = nextMap[this.speedMultiplier] || 1;
      speedBtn.innerText = `⏩ ${this.speedMultiplier}x`;
    });

    const pauseBtn = document.getElementById('td-pause-btn');
    pauseBtn?.addEventListener('click', () => {
      this.isPaused = !this.isPaused;
      this._manualPause = this.isPaused;
      pauseBtn.innerText = this.isPaused ? '▶️ 재개' : '⏸ 일시정지';
    });

    document.getElementById('td-retreat-btn')?.addEventListener('click', () => {
      if (this.battleEnded) {
        this.renderWorldMap();
        return;
      }
      if (confirm('전투에서 후퇴하고 월드맵으로 돌아갈까요? (패배 횟수가 차감되지 않습니다)')) {
        this.renderWorldMap();
      }
    });

    document.getElementById('td-close-btn')?.addEventListener('click', () => {
      this.confirmClose();
    });

    document.getElementById('td-start-now-btn')?.addEventListener('click', () => {
      this.prepTimeLeft = 0;
      document.getElementById('td-prep-banner')?.classList.add('hidden');
      document.getElementById('td-guide-banner')?.classList.remove('hidden');
    });

    const canvas = document.getElementById('td-canvas');
    if (canvas) {
      canvas.addEventListener('click', (e) => {
        if (this.battleEnded) return;
        const rect = canvas.getBoundingClientRect();
        const xRatio = (e.clientX - rect.left) / rect.width;
        const yRatio = (e.clientY - rect.top) / rect.height;
        const c = Math.max(0, Math.min(5, Math.floor(xRatio * 6)));
        const r = Math.max(0, Math.min(7, Math.floor(yRatio * 8)));
        this.handleTileTap(r, c);
      });
    }
  }

  handleTileTap(r, c) {
    const key = `${r}_${c}`;
    if (this.pathSet.has(key) || (this.rockSet && this.rockSet.has(key))) return; // 길과 바위산에는 건설 불가

    const existing = this.towers.get(key);
    const popover = document.getElementById('td-slot-popover');
    if (!popover) return;

    this.isPaused = true;
    const pauseBtn = document.getElementById('td-pause-btn');
    if (pauseBtn) pauseBtn.innerText = '▶️ 재개';

    if (existing) {
      const def = TOWER_DEFS[existing.type];
      const rankMeta = RANK_POOL_META.find(m => m.key === existing.rankKey);
      popover.innerHTML = `
        <div class="w-full max-w-xs bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl space-y-3 text-center">
          <img src="${def.image}" alt="${def.name}" class="w-20 h-20 mx-auto rounded-xl object-cover border border-slate-600" />
          <div>
            <h4 class="text-base font-black text-white">${def.name}</h4>
            <p class="text-xs text-slate-400">${def.desc} · 투입: ${rankMeta?.label || ''} ${existing.cost}명</p>
          </div>
          <div class="flex gap-2">
            <button id="td-demolish-btn" class="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition">
              🔨 철거 (병력 ${existing.cost}명 반환)
            </button>
            <button id="td-pop-close-btn" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition">
              닫기
            </button>
          </div>
        </div>
      `;
      popover.classList.remove('hidden');

      document.getElementById('td-demolish-btn')?.addEventListener('click', () => {
        this.troops[existing.rankKey] += existing.cost;
        this.towers.delete(key);
        this._bgDirty = true;
        this.updateTroopsBar();
        SoundManager.playTone('flip');
        this.closePopover();
      });
      document.getElementById('td-pop-close-btn')?.addEventListener('click', () => this.closePopover());
      return;
    }

    // 빈 슬롯: 건설 가능한 타워 목록 표시 (가장 높은 등급/적은 병력 우선 자동 선택)
    const cardsHtml = Object.values(TOWER_DEFS).map(def => {
      // 사용 가능한 최고 등급 찾기 (RANK_POOL_META 순서가 마스터 -> 훈련병 순)
      let bestChoice = null;
      const rankChoices = [];
      for (const m of RANK_POOL_META) {
        const cost = def.costs[m.key];
        if (cost !== undefined) {
          const canAfford = this.troops[m.key] >= cost;
          rankChoices.push({ ...m, cost, canAfford });
          if (!bestChoice && canAfford) {
            bestChoice = { rankKey: m.key, label: m.label, cost };
          }
        }
      }

      const canBuild = Boolean(bestChoice);
      return `
        <button data-tower-id="${def.id}" data-rank-key="${bestChoice ? bestChoice.rankKey : ''}" data-cost="${bestChoice ? bestChoice.cost : 0}"
          class="td-build-card w-full p-2 rounded-xl border text-left flex items-center gap-2.5 transition ${canBuild ? 'bg-slate-800/90 hover:bg-slate-700 border-slate-600 cursor-pointer' : 'bg-slate-900/60 border-slate-800 opacity-50 cursor-not-allowed'}" ${canBuild ? '' : 'disabled'}>
          <img src="${def.image}" alt="${def.name}" class="w-12 h-12 rounded-lg object-cover shrink-0 border border-slate-700" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1">
              <span class="text-xs font-black text-white truncate">${def.name}</span>
              ${bestChoice ? `
                <span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold shrink-0">
                  ${bestChoice.label} ${bestChoice.cost}명
                </span>
              ` : `
                <span class="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold shrink-0">병력 부족</span>
              `}
            </div>
            <div class="text-[10px] text-slate-400 truncate">${def.desc}</div>
            <div class="flex flex-wrap gap-1 mt-1">
              ${rankChoices.map(rc => `
                <span class="text-[9px] font-mono px-1 rounded ${rc.canAfford ? 'bg-slate-700 text-slate-200' : 'bg-slate-900 text-slate-500'}">
                  ${rc.short}:${rc.cost}
                </span>
              `).join('')}
            </div>
          </div>
        </button>
      `;
    }).join('');

    popover.innerHTML = `
      <div class="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl flex flex-col max-h-[85%]">
        <div class="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
          <h4 class="text-xs font-black text-white">🏰 타워 건설 (${r + 1}행 ${c + 1}열)</h4>
          <button id="td-pop-close-btn" class="px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white text-xs font-bold">✕</button>
        </div>
        <div class="space-y-1.5 overflow-y-auto pr-1">
          ${cardsHtml}
        </div>
      </div>
    `;
    popover.classList.remove('hidden');

    popover.querySelectorAll('.td-build-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const tid = btn.dataset.towerId;
        const rankKey = btn.dataset.rankKey;
        const cost = parseInt(btn.dataset.cost, 10);
        if (!tid || !rankKey || isNaN(cost) || this.troops[rankKey] < cost) return;

        this.troops[rankKey] -= cost;
        this.towers.set(key, {
          r, c,
          type: tid,
          rankKey,
          cost,
          cooldown: 0,
          magicToggle: 0 // 0: 얼음, 1: 번개 교대 발사
        });
        this._bgDirty = true;
        this.updateTroopsBar();
        SoundManager.playTone('correct');
        this.closePopover();
      });
    });

    document.getElementById('td-pop-close-btn')?.addEventListener('click', () => this.closePopover());
  }

  closePopover() {
    const popover = document.getElementById('td-slot-popover');
    if (popover) popover.classList.add('hidden');
    this.isPaused = false;
    const pauseBtn = document.getElementById('td-pause-btn');
    if (pauseBtn) pauseBtn.innerText = '⏸ 일시정지';
  }

  // =========================================================================
  // 3. 전투 시뮬레이션 루프 (적 스폰, 아군 진격, 타워 공격, 승패 판정)
  // =========================================================================
  loop(now) {
    if (!this.modalEl || this.screen !== 'battle') return;
    const rawDt = Math.min(40, Math.max(0, now - this.lastFrameTime));
    this.lastFrameTime = now;

    if (!this.battleEnded) {
      if (this.prepTimeLeft > 0 && !this._manualPause) {
        this.prepTimeLeft = Math.max(0, this.prepTimeLeft - rawDt);
        const secEl = document.getElementById('td-prep-sec');
        if (secEl) secEl.innerText = (this.prepTimeLeft / 1000).toFixed(1);
        if (this.prepTimeLeft <= 0) {
          document.getElementById('td-prep-banner')?.classList.add('hidden');
          document.getElementById('td-guide-banner')?.classList.remove('hidden');
        }
      } else if (this.prepTimeLeft <= 0 && !this.isPaused) {
        // 균형 잡힌 기본 속도(1.4x) + 1x~4x 배속 지원 (서브스텝 상한 4회로 CPU 부하 최소화)
        const totalDt = rawDt * 1.4 * this.speedMultiplier;
        const steps = Math.min(4, Math.max(1, Math.ceil(totalDt / 25)));
        const subDt = totalDt / steps;
        for (let s = 0; s < steps; s++) {
          if (this.battleEnded) break;
          this.updateBattle(subDt);
        }
      }
    }

    this.drawBattleCanvas();
    if (this._queueUiDirty) {
      this.updateEnemyQueueUI(false);
    }

    if (!this.battleEnded) {
      this.rafId = requestAnimationFrame((t) => this.loop(t));
    }
  }

  updateBattle(dt) {
    const pathLen = this.battlePath.length;

    // 1. 적 몬스터 대기열 순차/동시 스폰 (상단 성문 r=0)
    if (this.enemyQueue.length > 0) {
      this.enemySpawnTimer -= dt;
      while (this.enemyQueue.length > 0 && this.enemySpawnTimer <= 0) {
        const nextSpec = this.enemyQueue.shift();
        if (nextSpec.wave !== this.wave) {
          this.wave = nextSpec.wave;
          const waveEl = document.getElementById('td-wave-label');
          if (waveEl) waveEl.innerText = `Wave ${this.wave}/3`;
        }
        this.spawnEnemy(nextSpec);
        this.updateEnemyQueueUI();

        if (this.enemyQueue.length > 0) {
          const upcoming = this.enemyQueue[0];
          this.enemySpawnTimer += (upcoming.delayMs || 300) / Math.sqrt(this.diffMult);
        } else {
          this.enemySpawnTimer = 999999;
        }
      }
    }

    // 2. 아군 진격 병사 스폰 (적 전멸 시 즉시 돌격)
    this.allySpawnTimer -= dt;
    if (this.allySpawnTimer <= 0 || (this.enemyQueue.length === 0 && this.enemies.length === 0 && this.allies.length === 0)) {
      this.allies.push({
        id: this.nextId++,
        progress: pathLen - 1,
        speed: 1.55
      });
      this.allySpawnTimer = 4200;
    }

    // 대기열과 맵의 적이 모두 소탕되면 아군 병사 성문 돌격 가속
    const allEnemiesCleared = this.enemyQueue.length === 0 && this.enemies.length === 0;
    if (allEnemiesCleared) {
      this.allies.forEach(a => { a.speed = 4.8; });
    }

    // 3. 적 이동 및 상태이상(화상, 얼음 둔화, 번개 기절) 처리
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.burnTimer > 0) {
        e.burnTimer -= dt;
        e.hp -= (e.burnDps * dt) / 1000;
      }
      if (e.stunTimer > 0) {
        e.stunTimer -= dt;
      } else {
        let spd = e.baseSpeed;
        if (e.slowTimer > 0) {
          e.slowTimer -= dt;
          spd *= 0.52;
        }
        e.progress += (spd * dt) / 1000;
      }

      if (e.hp <= 0) {
        e._dead = true;
        this.kills++;
        const killsEl = document.getElementById('td-kills-label');
        if (killsEl) killsEl.innerText = `처치 ${this.kills}`;
        this.spawnBurst(e.progress, '#fbbf24');
        this.enemies.splice(i, 1);
        this._queueUiDirty = true;
        continue;
      }

      // 적이 하단 아군 전초기지(pathLen - 1)에 도달하면 패배!
      if (e.progress >= pathLen - 1.05) {
        this.finishBattle(false);
        return;
      }

      // 1회만 월드 좌표 계산해 타워 타겟팅/투사체/렌더링에서 재사용
      const pos = this.getPathWorldPos(e.progress);
      e._r = pos.r;
      e._c = pos.c;
    }

    // 4. 아군 진격 병사 이동 및 적 충돌 / 성문 도착 승리 판정
    for (let i = this.allies.length - 1; i >= 0; i--) {
      const a = this.allies[i];
      a.progress -= (a.speed * dt) / 1000;

      // 적과 만나면 소멸 (공격력/방어력 없음)
      let hitEnemy = false;
      for (let j = 0; j < this.enemies.length; j++) {
        if (Math.abs(this.enemies[j].progress - a.progress) < 0.38) {
          hitEnemy = true;
          break;
        }
      }
      if (hitEnemy) {
        this.spawnBurst(a.progress, '#38bdf8');
        this.allies.splice(i, 1);
        continue;
      }

      // 상단 적 성문(0)에 도달하면 승리!
      if (a.progress <= 0.15) {
        this.finishBattle(true);
        return;
      }
    }

    // 5. 타워 공격 로직 (제곱 거리 비교 & 사전 계산 좌표로 할당 최소화)
    const enemyCount = this.enemies.length;
    if (enemyCount > 0) {
      for (const tower of this.towers.values()) {
        const def = TOWER_DEFS[tower.type];
        tower.cooldown -= dt;
        if (tower.cooldown > 0) continue;

        const rangeSq = def.range * def.range;
        const inRange = [];
        for (let i = 0; i < enemyCount; i++) {
          const e = this.enemies[i];
          const dc = e._c - tower.c;
          const dr = e._r - tower.r;
          if (dc * dc + dr * dr <= rangeSq) {
            inRange.push(e);
          }
        }
        if (inRange.length === 0) continue;

        inRange.sort((a, b) => b.progress - a.progress); // 가장 전초기지에 가까운 적 우선
        tower.cooldown = def.cooldownMs;

        if (def.effect === 'dragon_laser') {
          const limit = Math.min(5, inRange.length);
          for (let k = 0; k < limit; k++) {
            const enemy = inRange[k];
            enemy.hp -= def.damage;
            this.beams.push({
              fromR: tower.r, fromC: tower.c,
              toR: enemy._r, toC: enemy._c,
              color: '#fde047',
              life: 240, maxLife: 240
            });
          }
          SoundManager.playTone('td_laser');
        } else if (def.effect === 'light_triple') {
          const limit = Math.min(3, inRange.length);
          for (let k = 0; k < limit; k++) {
            this.fireProjectile(tower, inRange[k], def.damage, '#fde047', 'light');
          }
          SoundManager.playTone('td_arrow');
        } else if (def.effect === 'fire_twin') {
          const t1 = inRange[0];
          const t2 = inRange[1] || t1;
          this.fireProjectile(tower, t1, def.damage, '#fb923c', 'fire');
          this.fireProjectile(tower, t2, def.damage, '#fb923c', 'fire');
          SoundManager.playTone('td_fire');
        } else if (def.effect === 'frost_shock') {
          const mode = tower.magicToggle === 0 ? 'frost' : 'shock';
          tower.magicToggle = 1 - tower.magicToggle;
          const color = mode === 'frost' ? '#38bdf8' : '#c084fc';
          this.fireProjectile(tower, inRange[0], def.damage, color, mode);
          SoundManager.playTone('td_magic');
        } else {
          this.fireProjectile(tower, inRange[0], def.damage, def.accent, 'arrow');
          SoundManager.playTone('td_arrow');
        }
      }
    } else {
      for (const tower of this.towers.values()) {
        if (tower.cooldown > 0) tower.cooldown = Math.max(0, tower.cooldown - dt);
      }
    }

    // 6. 투사체 이동 및 명중 처리 (O(1) 직접 참조)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const target = p.target;
      if (!target || target._dead || target.hp <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }
      const dx = target._c - p.c;
      const dy = target._r - p.r;
      const distSq = dx * dx + dy * dy;
      const step = (p.speed * dt) / 1000;
      p.angle = Math.atan2(dy, dx);

      if (distSq <= step * step) {
        target.hp -= p.damage;
        SoundManager.playTone('td_hit');
        if (p.kind === 'fire') {
          target.burnTimer = 3000;
          target.burnDps = 10;
        } else if (p.kind === 'frost') {
          target.slowTimer = 2500;
        } else if (p.kind === 'shock') {
          target.stunTimer = 750;
        }
        this.projectiles.splice(i, 1);
      } else {
        const invDist = 1 / Math.sqrt(distSq);
        p.c += dx * invDist * step;
        p.r += dy * invDist * step;
      }
    }

    // 7. 빔 & 파티클 감쇠
    for (let i = this.beams.length - 1; i >= 0; i--) {
      this.beams[i].life -= dt;
      if (this.beams[i].life <= 0) this.beams.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].life -= dt;
      if (this.particles[i].life <= 0) this.particles.splice(i, 1);
    }
  }

  spawnEnemy(spec) {
    const kind = spec?.kind || 'normal';
    const wave = spec?.wave || this.wave;
    const isBoss = kind === 'boss';
    // 적 에너지(HP) 2배 상향
    const baseHp = (52 + wave * 24) * 2 * this.diffMult;
    const hpMult = isBoss ? 3.4 : kind === 'heavy' ? 1.9 : kind === 'fast' ? 0.72 : 1.0;
    const speedMult = isBoss ? 0.78 : kind === 'heavy' ? 0.78 : kind === 'fast' ? 1.55 : 1.05;

    // 점령 영토 10개 미만(0~9개)까지는 초반 적응을 위해 적 체력 절반(0.5x), 이동 속도 추가 절반(0.25x) 적용
    const earlyHpMult = (this.conqueredCount || 0) < 10 ? 0.5 : 1.0;
    const earlySpeedMult = (this.conqueredCount || 0) < 10 ? 0.25 : 1.0;
    const hp = baseHp * hpMult * earlyHpMult;
    const speed = 1.32 * speedMult * (1 + Math.min(0.45, (this.diffMult - 1) * 0.15)) * earlySpeedMult;

    const spawnPos = this.getPathWorldPos(spec?.batchOffset || 0);
    this.enemies.push({
      id: this.nextId++,
      kind,
      wave,
      progress: spec?.batchOffset || 0,
      _r: spawnPos.r,
      _c: spawnPos.c,
      _dead: false,
      hp,
      maxHp: hp,
      baseSpeed: speed,
      isBoss,
      burnTimer: 0,
      burnDps: 0,
      slowTimer: 0,
      stunTimer: 0
    });
    this._queueUiDirty = true;
  }

  /**
   * 지도 우측 남은 적 순서 패널 갱신 (200ms 스로틀링으로 DOM 리플로우 최소화)
   */
  updateEnemyQueueUI(force = false) {
    const now = performance.now();
    const totalRemaining = this.enemies.length + this.enemyQueue.length;
    if (!force && totalRemaining > 0 && this._lastQueueUiAt && now - this._lastQueueUiAt < 200) {
      return;
    }
    this._lastQueueUiAt = now;
    this._queueUiDirty = false;

    const countEl = document.getElementById('td-remaining-count');
    const listEl = document.getElementById('td-enemy-queue-list');
    if (!countEl || !listEl) return;

    countEl.innerText = `${totalRemaining}체`;

    if (totalRemaining === 0) {
      listEl.innerHTML = `<div class="text-center text-emerald-400 font-bold py-4 text-[11px]">적 전멸!<br>성문 돌격 중!</div>`;
      return;
    }

    const metaMap = {
      normal: { icon: '👾', label: '일반', cls: 'bg-rose-950/50 border-rose-800/60 text-rose-200' },
      fast:   { icon: '🐺', label: '질풍', cls: 'bg-sky-950/50 border-sky-800/60 text-sky-200' },
      heavy:  { icon: '🛡️', label: '철갑', cls: 'bg-amber-950/50 border-amber-800/60 text-amber-200' },
      boss:   { icon: '👹', label: '보스', cls: 'bg-purple-950/70 border-purple-500/70 text-purple-200 font-black' }
    };

    const rows = [];
    // 현재 맵 위에서 진격 중인 적들
    this.enemies.slice(0, 12).forEach(e => {
      const m = metaMap[e.kind] || metaMap.normal;
      rows.push(`
        <div class="flex items-center justify-between gap-1 px-1.5 py-1 rounded-lg border ${m.cls}">
          <span class="flex items-center gap-1 truncate">
            <span>${m.icon}</span>
            <span class="truncate">${m.label}</span>
          </span>
          <span class="text-[9px] text-emerald-400 font-bold shrink-0">출전</span>
        </div>
      `);
    });

    // 앞으로 나올 대기열 적들 (최대 30개까지 순서대로 표시)
    const maxPreview = 30 - rows.length;
    this.enemyQueue.slice(0, Math.max(0, maxPreview)).forEach(q => {
      const m = metaMap[q.kind] || metaMap.normal;
      rows.push(`
        <div class="flex items-center justify-between gap-1 px-1.5 py-1 rounded-lg border border-slate-800 bg-slate-950/70 text-slate-300">
          <span class="flex items-center gap-1 truncate">
            <span>${m.icon}</span>
            <span class="truncate">${m.label}</span>
          </span>
          <span class="text-[9px] font-mono text-slate-500 shrink-0">W${q.wave}</span>
        </div>
      `);
    });

    if (totalRemaining > 30) {
      rows.push(`<div class="text-center text-[10px] text-slate-500 py-1">+ 외 ${totalRemaining - 30}체 대기</div>`);
    }

    listEl.innerHTML = rows.join('');
  }

  fireProjectile(tower, targetEnemy, damage, color, kind) {
    this.projectiles.push({
      r: tower.r,
      c: tower.c,
      target: targetEnemy,
      damage,
      color,
      kind,
      angle: Math.atan2(targetEnemy._r - tower.r, targetEnemy._c - tower.c),
      speed: 8.2
    });
  }

  spawnBurst(progress, color) {
    const pos = this.getPathWorldPos(progress);
    this.particles.push({ r: pos.r, c: pos.c, color, life: 320, maxLife: 320 });
  }

  getPathWorldPos(progress) {
    const maxIdx = this.battlePath.length - 1;
    const clamped = Math.max(0, Math.min(maxIdx, progress));
    const idx = Math.floor(clamped);
    const frac = clamped - idx;
    const [r1, c1] = this.battlePath[idx];
    const [r2, c2] = this.battlePath[Math.min(maxIdx, idx + 1)];
    return {
      r: r1 + (r2 - r1) * frac,
      c: c1 + (c2 - c1) * frac
    };
  }

  finishBattle(isVictory) {
    this.battleEnded = true;
    this.stopBattleLoop();

    const overlay = document.getElementById('td-result-overlay');
    if (!overlay) return;

    if (isVictory) {
      const updated = SiegeManager.recordVictory(this.battleCity.id);
      const conqueredCount = Math.max(0, updated.conqueredCities.length - 1);
      SoundManager.playTone('fanfare');
      if (typeof window.confetti === 'function') {
        window.confetti({ particleCount: 110, spread: 80, origin: { y: 0.6 } });
      }

      overlay.innerHTML = `
        <div class="bg-slate-900 border-2 border-emerald-500 rounded-3xl p-6 text-center max-w-xs w-full shadow-2xl space-y-3">
          <div class="text-5xl">🚩</div>
          <h3 class="text-xl font-black text-emerald-400">${this.battleCity.name} 함락 성공!</h3>
          <p class="text-xs text-slate-300 leading-relaxed">
            아군 병사가 적 성문에 무사히 도달했습니다!<br>
            점령 영토: <strong class="text-white">${conqueredCount} / 50</strong> (승리 시 계속 진격 가능!)
          </p>
          <button id="td-res-map-btn" class="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-sm shadow-lg">
            🗺️ 월드맵으로 (계속 진격)
          </button>
        </div>
      `;
    } else {
      const updated = SiegeManager.recordDefeat();
      const isAdmin = SiegeManager.isAdminProfile();
      const left = isAdmin ? 99 : Math.max(0, SiegeManager.MAX_DAILY_DEFEATS - updated.defeatsToday);
      SoundManager.playTone('wrong');

      overlay.innerHTML = `
        <div class="bg-slate-900 border-2 border-rose-500 rounded-3xl p-6 text-center max-w-xs w-full shadow-2xl space-y-3">
          <div class="text-5xl">💀</div>
          <h3 class="text-xl font-black text-rose-400">전초기지 방어 실패</h3>
          <p class="text-xs text-slate-300 leading-relaxed">
            적이 아군 전초기지에 도달했습니다.<br>
            ${isAdmin ? '<strong class="text-amber-400">ADMIN 무제한 도전 가능</strong>' : `오늘 남은 패배 기회: <strong class="text-amber-400">${left} / ${SiegeManager.MAX_DAILY_DEFEATS}</strong> (자정 12시 초기화)`}
          </p>
          <div class="flex flex-col gap-2">
            ${left > 0 ? `
              <button id="td-res-retry-btn" class="w-full py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm">
                🔄 ${this.battleCity.name} 다시 도전
              </button>
            ` : ''}
            <button id="td-res-map-btn" class="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm">
              🗺️ 월드맵으로 돌아가기
            </button>
          </div>
        </div>
      `;
    }

    overlay.classList.remove('hidden');
    document.getElementById('td-res-map-btn')?.addEventListener('click', () => this.renderWorldMap());
    document.getElementById('td-res-retry-btn')?.addEventListener('click', () => this.startBattle(this.battleCity));
  }

  // =========================================================================
  // 4. 6x8 전장 고해상도 캔버스 렌더링 (정적 배경 오프스크린 캐시로 60fps 보장)
  // =========================================================================
  rebuildStaticBgCanvas() {
    const w = this._canvasW;
    const h = this._canvasH;
    const dpr = this._dpr;
    if (!w || !h) return;

    if (!this._bgCanvas) {
      this._bgCanvas = document.createElement('canvas');
    }
    this._bgCanvas.width = w;
    this._bgCanvas.height = h;
    const ctx = this._bgCanvas.getContext('2d');
    const cellW = w / 6;
    const cellH = h / 8;

    ctx.clearRect(0, 0, w, h);

    // 1. 타일 그리기 (길 vs 바위산[건설불가] vs 타워 배치 가능 슬롯 명확히 구분)
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 6; c++) {
        const x = c * cellW;
        const y = r * cellH;
        const key = `${r}_${c}`;
        const isPath = this.pathSet.has(key);
        const isRock = this.rockSet && this.rockSet.has(key);

        if (isPath) {
          ctx.fillStyle = '#443627';
          ctx.fillRect(x, y, cellW, cellH);
          ctx.strokeStyle = '#786146';
          ctx.lineWidth = Math.max(1, dpr);
          ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
        } else if (isRock) {
          // 바위산 장애물 (타워 건설 불가)
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(x, y, cellW, cellH);
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = Math.max(1, dpr);
          ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);

          // 바위산 봉우리 벡터 그래픽
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.moveTo(x + cellW * 0.14, y + cellH * 0.80);
          ctx.lineTo(x + cellW * 0.42, y + cellH * 0.24);
          ctx.lineTo(x + cellW * 0.65, y + cellH * 0.56);
          ctx.lineTo(x + cellW * 0.88, y + cellH * 0.80);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.moveTo(x + cellW * 0.45, y + cellH * 0.80);
          ctx.lineTo(x + cellW * 0.66, y + cellH * 0.34);
          ctx.lineTo(x + cellW * 0.88, y + cellH * 0.80);
          ctx.closePath();
          ctx.fill();

          // 산 정상 하이라이트
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.moveTo(x + cellW * 0.42, y + cellH * 0.24);
          ctx.lineTo(x + cellW * 0.35, y + cellH * 0.38);
          ctx.lineTo(x + cellW * 0.49, y + cellH * 0.38);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillStyle = (r + c) % 2 === 0 ? '#143326' : '#183c2d';
          ctx.fillRect(x, y, cellW, cellH);
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.22)';
          ctx.lineWidth = Math.max(1, dpr);
          ctx.strokeRect(x + 2, y + 2, cellW - 4, cellH - 4);

          if (!this.towers.has(key)) {
            ctx.fillStyle = 'rgba(110, 231, 183, 0.25)';
            ctx.font = `bold ${Math.round(cellW * 0.34)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+', x + cellW / 2, y + cellH / 2);
          }
        }
      }
    }

    // 2. 길 중심선 (유도 점선)
    ctx.save();
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.28)';
    ctx.lineWidth = Math.max(2, dpr * 1.8);
    ctx.setLineDash([6 * dpr, 6 * dpr]);
    ctx.beginPath();
    this.battlePath.forEach(([r, c], idx) => {
      const px = (c + 0.5) * cellW;
      const py = (r + 0.5) * cellH;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();

    // 3. 상단 적 성문 & 하단 아군 전초기지 마커
    const [gr, gc] = this.battlePath[0];
    const [br, bc] = this.battlePath[this.battlePath.length - 1];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(cellW * 0.52)}px sans-serif`;
    ctx.fillText('🏯', (gc + 0.5) * cellW, (gr + 0.5) * cellH);
    ctx.fillText('🛡️', (bc + 0.5) * cellW, (br + 0.5) * cellH);

    // 4. 건설된 타워 스프라이트 (정적 캐시에 1회만 그림)
    for (const tower of this.towers.values()) {
      const x = tower.c * cellW;
      const y = tower.r * cellH;
      const img = this.towerImages[tower.type];
      const pad = Math.round(cellW * 0.08);

      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x + pad, y + pad, cellW - pad * 2, cellH - pad * 2, 8 * dpr);
        ctx.clip();
        ctx.drawImage(img, x + pad, y + pad, cellW - pad * 2, cellH - pad * 2);
        ctx.restore();
      } else {
        ctx.fillStyle = TOWER_DEFS[tower.type].accent;
        ctx.fillRect(x + pad, y + pad, cellW - pad * 2, cellH - pad * 2);
      }
    }

    this._bgDirty = false;
  }

  drawBattleCanvas() {
    const canvas = document.getElementById('td-canvas');
    if (!canvas) return;
    if (!this._canvasW || !this._canvasH) {
      this.setupBattleCanvas();
    }
    if (this._bgDirty) {
      this.rebuildStaticBgCanvas();
    }

    const w = this._canvasW;
    const h = this._canvasH;
    const dpr = this._dpr;
    const ctx = this._ctx || canvas.getContext('2d', { alpha: false });
    const cellW = w / 6;
    const cellH = h / 8;

    if (!this._unitSprites) {
      this.buildUnitSprites(cellW, dpr);
    }

    if (this._bgCanvas) {
      ctx.drawImage(this._bgCanvas, 0, 0);
    }

    // 5. 드래곤 타워 다중 광선 황금 레이저 빔
    this.beams.forEach(b => {
      const alpha = Math.max(0, b.life / b.maxLife);
      const x1 = (b.fromC + 0.5) * cellW;
      const y1 = (b.fromR + 0.5) * cellH;
      const x2 = (b.toC + 0.5) * cellW;
      const y2 = (b.toR + 0.5) * cellH;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(245, 158, 11, ${alpha * 0.45})`;
      ctx.lineWidth = 8 * dpr * alpha;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(254, 249, 195, ${alpha})`;
      ctx.lineWidth = 2.6 * dpr * alpha;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    });

    // 6. 아군 진격 병사 (오프스크린 스프라이트 고속 복사)
    const allySpr = this._unitSprites.ally;
    const allyHalf = allySpr.width / 2;
    for (let i = 0; i < this.allies.length; i++) {
      const pos = this.getPathWorldPos(this.allies[i].progress);
      const ax = (pos.c + 0.5) * cellW;
      const ay = (pos.r + 0.5) * cellH;
      ctx.drawImage(allySpr, ax - allyHalf, ay - allyHalf);
    }

    // 7. 적 몬스터 & 체력바 (이모지 fillText 제거 → 캐시된 비트맵 스프라이트로 60~120fps 유지)
    const enemySpr = this._unitSprites.enemy;
    const fastSpr = this._unitSprites.fast || enemySpr;
    const heavySpr = this._unitSprites.heavy || enemySpr;
    const bossSpr = this._unitSprites.boss;
    const bw = cellW * 0.56;
    const bh = 4 * dpr;

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      const ex = (e._c + 0.5) * cellW;
      const ey = (e._r + 0.5) * cellH;
      const radius = cellW * (e.isBoss ? 0.30 : 0.21);

      ctx.fillStyle = e.stunTimer > 0 ? '#a855f7' : e.slowTimer > 0 ? '#38bdf8' : e.isBoss ? '#991b1b' : e.kind === 'fast' ? '#0284c7' : e.kind === 'heavy' ? '#b45309' : '#e11d48';
      ctx.beginPath();
      ctx.arc(ex, ey, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = e.burnTimer > 0 ? '#fb923c' : '#ffe4e6';
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();

      const spr = e.isBoss ? bossSpr : e.kind === 'fast' ? fastSpr : e.kind === 'heavy' ? heavySpr : enemySpr;
      ctx.drawImage(spr, ex - spr.width / 2, ey - spr.height / 2);

      // 체력 바
      const bx = ex - bw / 2;
      const by = ey - radius - 6 * dpr;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), bh);
    }

    // 8. 사실적인 화살 및 마법 투사체 렌더링
    this.projectiles.forEach(p => {
      const px = (p.c + 0.5) * cellW;
      const py = (p.r + 0.5) * cellH;
      const ang = p.angle || 0;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);

      if (p.kind === 'frost') {
        // 얼음 결정 창
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        ctx.moveTo(9 * dpr, 0);
        ctx.lineTo(-2 * dpr, 4 * dpr);
        ctx.lineTo(-8 * dpr, 0);
        ctx.lineTo(-2 * dpr, -4 * dpr);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (p.kind === 'shock') {
        // 지그재그 번개 창
        ctx.strokeStyle = '#e879f9';
        ctx.lineWidth = 2.4 * dpr;
        ctx.beginPath();
        ctx.moveTo(-9 * dpr, -2 * dpr);
        ctx.lineTo(-2 * dpr, 3 * dpr);
        ctx.lineTo(3 * dpr, -3 * dpr);
        ctx.lineTo(9 * dpr, 0);
        ctx.stroke();
      } else {
        // 화살 (기본 / 빠른 / 불화살 / 빛의 화살)
        const len = 10 * dpr;
        const isFire = p.kind === 'fire';
        const isLight = p.kind === 'light';

        // 꼬리 깃털 (Fletching)
        ctx.strokeStyle = isFire ? '#fdba74' : isLight ? '#fef08a' : '#e2e8f0';
        ctx.lineWidth = 1.4 * dpr;
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.lineTo(-len - 3.5 * dpr, -3 * dpr);
        ctx.moveTo(-len, 0);
        ctx.lineTo(-len - 3.5 * dpr, 3 * dpr);
        ctx.stroke();

        // 화살대 (Shaft)
        ctx.strokeStyle = isLight ? '#fde047' : isFire ? '#ea580c' : '#d6b37c';
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.lineTo(len * 0.65, 0);
        ctx.stroke();

        // 화살촉 (Arrowhead)
        ctx.fillStyle = isFire ? '#ef4444' : isLight ? '#ffffff' : '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(len + 2 * dpr, 0);
        ctx.lineTo(len * 0.35, -3.4 * dpr);
        ctx.lineTo(len * 0.35, 3.4 * dpr);
        ctx.closePath();
        ctx.fill();

        // 불화살 화염 오라
        if (isFire) {
          ctx.fillStyle = 'rgba(253, 224, 71, 0.85)';
          ctx.beginPath();
          ctx.arc(len * 0.7, 0, 3 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    });

    // 9. 폭발/소멸 파티클
    this.particles.forEach(pt => {
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.arc((pt.c + 0.5) * cellW, (pt.r + 0.5) * cellH, cellW * 0.28 * (1.2 - alpha), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }
}
