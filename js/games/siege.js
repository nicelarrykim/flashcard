// js/games/siege.js
// VocaQuest 성채 공성전 (Siege Defense) 게임 모듈
// 4x6 골짜기 미로 전장, 단어장 실제 인원수(1:1) 기반 10명 단위 원클릭&드래그 증원 배치,
// 100웨이브 판타지 몹 대군단 스웜 디펜스, 10웨이브 단위 맵 변경 & 50% 부활, 성 함락 화염 연출

import { StorageManager } from '../storage.js?v=20261123_10';
import { SoundManager } from '../tts.js?v=20261123_10';
import { RANK_TYPES, RANK_CONFIG } from '../mastery.js?v=20261123_10';

export class SiegeManager {
  static getStorageKey() {
    let profId = 'prof_default';
    try {
      if (typeof StorageManager !== 'undefined' && StorageManager.getActiveProfileId) {
        profId = StorageManager.getActiveProfileId() || 'prof_default';
      }
    } catch (e) {
      profId = 'prof_default';
    }
    return `vocaquest_siege_record_${profId}_v2`;
  }

  /**
   * 오늘 공성전 기록 및 남은 횟수 조회 (새벽 12시 자동 리셋, 프로필별 독립 2회)
   */
  static getRecord() {
    const today = new Date().toISOString().slice(0, 10);
    const key = this.getStorageKey();
    try {
      let data = localStorage.getItem(key);
      // 이전 전역 키가 있고 기본 프로필인 경우 마이그레이션 호환 처리
      if (!data && key === 'vocaquest_siege_record_prof_default_v2') {
        const legacy = localStorage.getItem('vocaquest_siege_record_v2');
        if (legacy) {
          data = legacy;
          localStorage.setItem(key, legacy);
        }
      }

      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.date === today) {
          return parsed;
        }
        return {
          date: today,
          playCount: 0,
          bestWave: parsed.bestWave || 0,
          history: parsed.history || []
        };
      }
    } catch (e) {}

    const fresh = {
      date: today,
      playCount: 0,
      bestWave: 0,
      history: []
    };
    this.saveRecord(fresh);
    return fresh;
  }

  static canPlay() {
    return this.getRecord().playCount < 2;
  }

  static saveRecord(rec) {
    try {
      const key = this.getStorageKey();
      localStorage.setItem(key, JSON.stringify(rec));
    } catch (e) {}
  }

  static recordBattleResult(waveReached, totalKills, totalCasualties) {
    const rec = this.getRecord();
    rec.playCount += 1;
    const isNewRecord = waveReached > (rec.bestWave || 0);
    if (isNewRecord) {
      rec.bestWave = waveReached;
    }
    rec.history.unshift({
      date: Date.now(),
      wave: waveReached,
      kills: totalKills,
      casualties: totalCasualties
    });
    if (rec.history.length > 20) rec.history.pop();
    this.saveRecord(rec);
    return { isNewRecord, bestWave: rec.bestWave, playCount: rec.playCount };
  }
}

// 병사 계급별 밸런스 재조정 (몬스터 대비 과도한 강함 하향 조정, 1인당 스펙)
export const SOLDIER_SPECS = {
  [RANK_TYPES.RECRUIT]: {
    name: '훈련병',
    icon: '🪵',
    color: '#64748b',
    hp: 25,
    atk: 3,
    atkSpeed: 1100,
    range: 1.0,
    desc: '신병 (10명: HP 250, ATK 30)'
  },
  [RANK_TYPES.INFANTRY]: {
    name: '보병',
    icon: '🗡️',
    color: '#d97706',
    hp: 45,
    atk: 6,
    atkSpeed: 1000,
    range: 1.0,
    desc: '단검 보병 (10명: HP 450, ATK 60)'
  },
  [RANK_TYPES.JUNIOR_KNIGHT]: {
    name: '초급기사',
    icon: '⚔️',
    color: '#0284c7',
    hp: 75,
    atk: 10,
    atkSpeed: 950,
    range: 1.1,
    desc: '사슬 기사 (10명: HP 750, ATK 100)'
  },
  [RANK_TYPES.SENIOR_KNIGHT]: {
    name: '중급기사',
    icon: '🛡️',
    color: '#6366f1',
    hp: 120,
    atk: 16,
    atkSpeed: 900,
    range: 1.2,
    desc: '판금 기사 (10명: HP 1200, ATK 160)'
  },
  [RANK_TYPES.HIGH_KNIGHT]: {
    name: '고급기사',
    icon: '✨',
    color: '#8b5cf6',
    hp: 190,
    atk: 25,
    atkSpeed: 850,
    range: 1.3,
    desc: '룬검 기사 (10명: HP 1900, ATK 250)'
  },
  [RANK_TYPES.ROYAL_GUARD]: {
    name: '왕실근위대',
    icon: '👑',
    color: '#f59e0b',
    hp: 300,
    atk: 40,
    atkSpeed: 800,
    range: 1.5,
    desc: '근위대 (10명: HP 3000, ATK 400)'
  },
  [RANK_TYPES.MASTER]: {
    name: '마스터',
    icon: '🌟',
    color: '#ec4899',
    hp: 500,
    atk: 70,
    atkSpeed: 750,
    range: 1.8,
    desc: '마스터 기사 (10명: HP 5000, ATK 700)'
  }
};

// 100웨이브 판타지 몬스터 테마 (10웨이브 단위로 진화)
export const MONSTER_THEMES = [
  { tier: 1, name: '슬라임 & 고블린', type: 'slime', hp: 55, atk: 7, speed: 2.2, color: '#22c55e' },
  { tier: 2, name: '오크 보병단', type: 'orc', hp: 95, atk: 12, speed: 2.1, color: '#ea580c' },
  { tier: 3, name: '스켈레톤 군단', type: 'skeleton', hp: 160, atk: 18, speed: 2.3, color: '#cbd5e1' },
  { tier: 4, name: '가고일 & 하피', type: 'gargoyle', hp: 250, atk: 28, speed: 2.5, color: '#a855f7' },
  { tier: 5, name: '오우거 & 트롤', type: 'ogre', hp: 420, atk: 45, speed: 1.8, color: '#b45309' },
  { tier: 6, name: '골렘 & 가디언', type: 'golem', hp: 680, atk: 65, speed: 1.6, color: '#64748b' },
  { tier: 7, name: '다크 어쌔신 & 늑대', type: 'assassin', hp: 1050, atk: 95, speed: 2.8, color: '#4f46e5' },
  { tier: 8, name: '데스나이트 & 리치', type: 'deathknight', hp: 1600, atk: 140, speed: 2.0, color: '#e11d48' },
  { tier: 9, name: '와이번 & 히드라', type: 'wyvern', hp: 2400, atk: 210, speed: 2.4, color: '#dc2626' },
  { tier: 10, name: '파멸의 고대 흑룡', type: 'dragon', hp: 3800, atk: 320, speed: 2.2, color: '#991b1b' }
];

/**
 * 판타지 몬스터 전용 캐릭터 SVG 그래픽 렌더러
 */
export function getMonsterCharacterSVG(type, tier, size = 26) {
  switch (type) {
    case 'slime':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 32 32" class="drop-shadow">
          <path d="M16 4 C24 4 28 14 28 22 C28 28 23 29 16 29 C9 29 4 28 4 22 C4 14 8 4 16 4 Z" fill="#22c55e" />
          <ellipse cx="16" cy="22" rx="10" ry="6" fill="#15803d" opacity="0.4" />
          <circle cx="12" cy="14" r="2.5" fill="#ffffff" />
          <circle cx="13" cy="14" r="1.2" fill="#0f172a" />
          <circle cx="20" cy="14" r="2.5" fill="#ffffff" />
          <circle cx="19" cy="14" r="1.2" fill="#0f172a" />
          <path d="M13 20 Q16 23 19 20" stroke="#052e16" stroke-width="1.5" fill="none" stroke-linecap="round" />
        </svg>
      `;
    case 'orc':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 32 32" class="drop-shadow">
          <circle cx="16" cy="16" r="11" fill="#ea580c" />
          <path d="M5 12 L9 16 L5 20 Z" fill="#c2410c" />
          <path d="M27 12 L23 16 L27 20 Z" fill="#c2410c" />
          <circle cx="12" cy="14" r="2" fill="#fef08a" />
          <circle cx="12" cy="14" r="1" fill="#7f1d1d" />
          <circle cx="20" cy="14" r="2" fill="#fef08a" />
          <circle cx="20" cy="14" r="1" fill="#7f1d1d" />
          <path d="M13 22 L14 18 L15 22 Z" fill="#ffffff" />
          <path d="M17 22 L18 18 L19 22 Z" fill="#ffffff" />
          <path d="M11 22 Q16 25 21 22" stroke="#431407" stroke-width="2" fill="none" />
        </svg>
      `;
    case 'skeleton':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 32 32" class="drop-shadow">
          <ellipse cx="16" cy="14" rx="9" ry="8" fill="#e2e8f0" />
          <rect x="13" y="20" width="6" height="5" fill="#cbd5e1" rx="1" />
          <circle cx="12" cy="13" r="2.8" fill="#0f172a" />
          <circle cx="20" cy="13" r="2.8" fill="#0f172a" />
          <circle cx="12.5" cy="13" r="0.8" fill="#38bdf8" />
          <circle cx="19.5" cy="13" r="0.8" fill="#38bdf8" />
          <polygon points="16,16 15,18 17,18" fill="#0f172a" />
          <line x1="14" y1="23" x2="18" y2="23" stroke="#0f172a" stroke-width="1.5" />
          <line x1="15" y1="21" x2="15" y2="25" stroke="#0f172a" stroke-width="1.2" />
          <line x1="17" y1="21" x2="17" y2="25" stroke="#0f172a" stroke-width="1.2" />
        </svg>
      `;
    case 'gargoyle':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 32 32" class="drop-shadow">
          <path d="M4 16 Q8 6 14 12 L14 20 Z" fill="#9333ea" />
          <path d="M28 16 Q24 6 18 12 L18 20 Z" fill="#9333ea" />
          <circle cx="16" cy="16" r="8" fill="#6b21a8" />
          <path d="M13 10 L11 4 L14 8 Z" fill="#4c1d95" />
          <path d="M19 10 L21 4 L18 8 Z" fill="#4c1d95" />
          <circle cx="13" cy="15" r="1.8" fill="#facc15" />
          <circle cx="19" cy="15" r="1.8" fill="#facc15" />
          <path d="M14 20 Q16 22 18 20" stroke="#ffffff" stroke-width="1.5" fill="none" />
        </svg>
      `;
    case 'ogre':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 32 32" class="drop-shadow">
          <rect x="7" y="8" width="18" height="18" rx="7" fill="#b45309" />
          <path d="M16 6 L14 2 L17 4 Z" fill="#fde047" />
          <circle cx="12" cy="14" r="2" fill="#ef4444" />
          <circle cx="20" cy="14" r="2" fill="#ef4444" />
          <ellipse cx="16" cy="18" rx="3.5" ry="2" fill="#78350f" />
          <path d="M11 23 L13 19 L15 23 L17 19 L19 23 L21 21" stroke="#ffffff" stroke-width="1.8" fill="none" />
        </svg>
      `;
    case 'golem':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 32 32" class="drop-shadow">
          <rect x="8" y="7" width="16" height="18" rx="3" fill="#64748b" stroke="#334155" stroke-width="1.5" />
          <line x1="8" y1="14" x2="24" y2="14" stroke="#475569" stroke-width="1" />
          <line x1="16" y1="7" x2="16" y2="25" stroke="#475569" stroke-width="1" />
          <rect x="11" y="11" width="3" height="3" fill="#38bdf8" class="animate-pulse" />
          <rect x="18" y="11" width="3" height="3" fill="#38bdf8" class="animate-pulse" />
          <path d="M13 18 H19" stroke="#38bdf8" stroke-width="2" />
        </svg>
      `;
    case 'assassin':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 32 32" class="drop-shadow">
          <path d="M16 4 C9 4 7 12 7 20 C7 26 11 28 16 28 C21 28 25 26 25 20 C25 12 23 4 16 4 Z" fill="#1e1b4b" />
          <ellipse cx="16" cy="18" rx="6" ry="3.5" fill="#0f172a" />
          <circle cx="13" cy="17" r="1.5" fill="#a855f7" />
          <circle cx="19" cy="17" r="1.5" fill="#a855f7" />
          <path d="M4 18 L7 15 L6 22 Z" fill="#818cf8" />
          <path d="M28 18 L25 15 L26 22 Z" fill="#818cf8" />
        </svg>
      `;
    case 'deathknight':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 32 32" class="drop-shadow">
          <path d="M16 4 L22 9 L21 21 L16 26 L11 21 L10 9 Z" fill="#020617" stroke="#dc2626" stroke-width="1.5" />
          <path d="M13 7 L16 11 L19 7" stroke="#ef4444" stroke-width="1.5" fill="none" />
          <circle cx="13" cy="15" r="2" fill="#ef4444" />
          <circle cx="19" cy="15" r="2" fill="#ef4444" />
          <line x1="12" y1="21" x2="20" y2="21" stroke="#dc2626" stroke-width="2" />
        </svg>
      `;
    case 'wyvern':
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 32 32" class="drop-shadow">
          <path d="M3 13 Q10 4 16 10 Q22 4 29 13 Q24 22 16 19 Q8 22 3 13 Z" fill="#b91c1c" />
          <circle cx="16" cy="15" r="5" fill="#7f1d1d" />
          <circle cx="14" cy="14" r="1.5" fill="#facc15" />
          <circle cx="18" cy="14" r="1.5" fill="#facc15" />
          <path d="M16 18 L13 25 L16 23 L19 25 Z" fill="#ef4444" />
        </svg>
      `;
    case 'dragon':
    default:
      return `
        <svg width="${size}" height="${size}" viewBox="0 0 32 32" class="drop-shadow animate-pulse">
          <path d="M2 12 Q8 2 16 8 Q24 2 30 12 Q24 24 16 20 Q8 24 2 12 Z" fill="#450a0a" stroke="#ef4444" stroke-width="1.5" />
          <polygon points="16,4 13,10 19,10" fill="#dc2626" />
          <circle cx="13" cy="13" r="2" fill="#fbbf24" />
          <circle cx="13" cy="13" r="0.8" fill="#000000" />
          <circle cx="19" cy="13" r="2" fill="#fbbf24" />
          <circle cx="19" cy="13" r="0.8" fill="#000000" />
          <path d="M12 18 Q16 22 20 18" stroke="#f87171" stroke-width="2" fill="none" />
        </svg>
      `;
  }
}

export class SiegeGame {
  constructor() {
    this.container = null;
    this.rows = 6;
    this.cols = 4;
    this.map = []; // 6x4 타일 배열
    this.pathCoords = []; // 골짜기 경로 [(r, c), ...]
    
    // 병력 풀 (실제 단어 수 1:1 환산)
    this.soldierPool = {};
    this.initialPool = {};
    this.deadPool = {};
    
    // 배치 현황: key 'r_c' -> { rankType, count, currentHp, maxHp, lastAtkTime }
    this.placements = {};

    // 게임 상태
    this.state = 'IDLE'; // 'PREPARING' | 'BATTLE' | 'WAVE_CLEARED' | 'GAMEOVER'
    this.wave = 1;
    this.maxWave = 100;
    this.castleHp = 100;
    this.totalKills = 0;
    this.totalCasualties = 0;

    // 전투 루프 & 몬스터 스폰 큐
    this.monsters = [];
    this.spawnQueue = [];
    this.spawnTimer = null;
    this.animFrameId = null;
    this.lastLoopTime = 0;
    this.lastClashSoundTime = 0;
    this.lastDamageSoundTime = 0;

    // 드래그 상태
    this.draggedRank = null;
    this.draggedTile = null;
  }

  /**
   * 공성전 모달 열기
   */
  open() {
    this.initModalContainer();
    const canPlay = SiegeManager.canPlay();
    const record = SiegeManager.getRecord();
    this.renderLobby(canPlay, record);
  }

  initModalContainer() {
    let el = document.getElementById('siege-modal-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'siege-modal-container';
      document.body.appendChild(el);
    }
    this.container = el;
  }

  close() {
    this.stopBattleLoop();
    if (this.container) {
      this.container.innerHTML = '';
    }
    window.dispatchEvent(new CustomEvent('vocaquest_siege_completed'));
  }

  /**
   * 단어장 기반 실제 병력 수 계산 (단어 1개 = 실제 병사 1명)
   */
  calculateTroopsFromWords(words) {
    const counts = {
      [RANK_TYPES.RECRUIT]: 0,
      [RANK_TYPES.INFANTRY]: 0,
      [RANK_TYPES.JUNIOR_KNIGHT]: 0,
      [RANK_TYPES.SENIOR_KNIGHT]: 0,
      [RANK_TYPES.HIGH_KNIGHT]: 0,
      [RANK_TYPES.ROYAL_GUARD]: 0,
      [RANK_TYPES.MASTER]: 0
    };

    (words || []).forEach(w => {
      const rank = (w && w.mastery && w.mastery.status) ? w.mastery.status : RANK_TYPES.RECRUIT;
      if (counts[rank] !== undefined) {
        counts[rank] += 1; // 단어 1개 = 병사 1명! (*10 제거)
      } else {
        counts[RANK_TYPES.RECRUIT] += 1;
      }
    });

    return counts;
  }

  /**
   * 로비 화면: 오늘 출정 횟수 확인 & 출정 준비
   */
  renderLobby(canPlay, record) {
    const activeDeck = StorageManager.getActiveDeck();
    const words = (activeDeck && Array.isArray(activeDeck.words)) ? activeDeck.words : [];
    
    const ranksCount = this.calculateTroopsFromWords(words);
    const totalTroops = Object.values(ranksCount).reduce((a, b) => a + b, 0);

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
        <div class="bg-slate-900 text-white rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl border-2 border-amber-500/40 relative overflow-hidden flex flex-col max-h-[92vh]">
          
          <div class="absolute -right-12 -bottom-12 text-9xl opacity-10 pointer-events-none">
            🏰
          </div>

          <!-- 상단 헤더 -->
          <div class="flex items-start justify-between pb-4 border-b border-slate-800 shrink-0">
            <div>
              <div class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black border border-amber-500/30 mb-1.5">
                <span>🛡️</span> <span>공성전 (Siege Defense)</span>
              </div>
              <h2 class="text-xl sm:text-2xl font-black text-amber-400 flex items-center gap-2 tracking-tight">
                <span>🏰 성채 수호 공성전</span>
              </h2>
              <p class="text-xs text-slate-400 mt-1 leading-relaxed">
                단어장에서 육성한 실제 기사단으로 몰려오는 100웨이브의 마물 대군단으로부터 성채를 지켜내세요!
              </p>
            </div>
            <button id="siege-lobby-close-btn" class="p-2 text-slate-400 hover:text-white text-xl font-bold transition">
              ✕
            </button>
          </div>

          <!-- 본문 스크롤 영역 -->
          <div class="flex-1 overflow-y-auto py-4 space-y-4 pr-1 text-xs">
            
            <!-- 출정 상태 배너 -->
            <div class="p-4 rounded-2xl bg-gradient-to-r ${canPlay ? 'from-amber-950/60 to-indigo-950/60 border border-amber-500/30' : 'from-slate-800/80 to-slate-800/80 border border-slate-700'} flex items-center justify-between">
              <div>
                <span class="text-xs font-bold text-slate-300">오늘 출정 가능 횟수</span>
                <div class="text-xl font-black ${canPlay ? 'text-amber-400' : 'text-rose-400'} mt-0.5">
                  ${canPlay ? `${2 - record.playCount} / 2 회 남음` : '오늘 출정 횟수 소진 (0 / 2회)'}
                </div>
                <p class="text-[10px] text-slate-400 mt-0.5">매일 새벽 12시(00:00)에 2회로 자동 초기화됩니다.</p>
              </div>
              <div class="text-right">
                <span class="text-[10px] text-slate-400 font-bold">역대 최고 기록</span>
                <div class="text-lg font-black text-purple-300 font-mono">
                  ${record.bestWave > 0 ? `Wave ${record.bestWave}` : '기록 없음'}
                </div>
              </div>
            </div>

            <!-- 현재 보유 실제 병력 (단어장 1:1 연동) -->
            <div class="p-4 rounded-2xl bg-slate-800/70 border border-slate-700 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-200 flex items-center gap-1.5">
                  <span>⚔️</span> <span>단어장 보유 병력 (총 ${totalTroops}명)</span>
                </span>
                <span class="text-[11px] text-emerald-400 font-semibold">단어 1개 = 병사 1명 실시간 연동</span>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                ${Object.entries(ranksCount).map(([rank, count]) => {
                  const spec = SOLDIER_SPECS[rank];
                  return `
                    <div class="p-2 rounded-xl bg-slate-900/80 border border-slate-700/80">
                      <div class="text-xl">${spec.icon}</div>
                      <div class="font-bold text-[11px] text-slate-300 mt-0.5">${spec.name}</div>
                      <div class="text-sm font-black text-amber-400 font-mono">${count}명</div>
                      <div class="text-[9px] text-slate-400">공 ${spec.atk} / 체 ${spec.hp}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- 전투 규칙 요약 안내 -->
            <div class="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-900/50 space-y-1.5 leading-relaxed text-[11px] text-indigo-200">
              <h4 class="font-black text-indigo-300 flex items-center gap-1">
                <span>📜</span> <span>공성전 규칙 안내</span>
              </h4>
              <ul class="list-disc list-inside space-y-1 text-slate-300">
                <li><strong>4x6 골짜기 전장</strong>: 상단 입구에서 하단 성채까지 이어지는 일방향 골짜기 길에만 병사를 배치할 수 있습니다.</li>
                <li><strong>10명 단위 드래그 & 원클릭 증원</strong>: 10명씩 드래그하여 배치하고, 배치된 타일을 <strong>원클릭</strong>하면 대기열에서 10명씩 즉시 추가 증원됩니다.</li>
                <li><strong>바글바글 웨이브 군단</strong>: 적 마물들이 떼를 지어 고속으로 밀고 내려옵니다. 한 웨이브를 막아내면 즉시 다음 웨이브가 이어집니다!</li>
                <li><strong>10웨이브 단위 전장 변경 & 50% 부활</strong>: 10, 20, 30... 웨이브 클리어 시 새로운 지형이 열리고 전사자의 절반이 명예롭게 부활합니다!</li>
              </ul>
            </div>

          </div>

          <!-- 하단 출정 버튼 -->
          <div class="pt-4 border-t border-slate-800 flex items-center justify-between shrink-0">
            <span class="text-xs text-slate-400">단어장: <strong class="text-slate-200">${activeDeck ? activeDeck.name : '기본 단어장'}</strong></span>
            <button id="siege-start-prep-btn" ${canPlay ? '' : 'disabled'}
              class="px-6 py-2.5 rounded-2xl ${canPlay ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black shadow-lg shadow-amber-500/25' : 'bg-slate-700 text-slate-400 cursor-not-allowed'} text-sm transition flex items-center gap-2">
              <span>⚔️</span> <span>공성전 출정하기</span>
            </button>
          </div>

        </div>
      </div>
    `;

    const closeBtn = document.getElementById('siege-lobby-close-btn');
    if (closeBtn) closeBtn.onclick = () => this.close();

    const startBtn = document.getElementById('siege-start-prep-btn');
    if (startBtn && canPlay) {
      startBtn.onclick = () => {
        this.startPreparationPhase(ranksCount);
      };
    }
  }

  /**
   * 출정 준비 단계 시작: 맵 생성 및 배치 모드 진입
   */
  startPreparationPhase(ranksCount) {
    this.soldierPool = { ...ranksCount };
    this.initialPool = { ...ranksCount };
    this.deadPool = {
      [RANK_TYPES.RECRUIT]: 0,
      [RANK_TYPES.INFANTRY]: 0,
      [RANK_TYPES.JUNIOR_KNIGHT]: 0,
      [RANK_TYPES.SENIOR_KNIGHT]: 0,
      [RANK_TYPES.HIGH_KNIGHT]: 0,
      [RANK_TYPES.ROYAL_GUARD]: 0,
      [RANK_TYPES.MASTER]: 0
    };
    this.placements = {};
    this.castleHp = 100;
    this.wave = 1;
    this.totalKills = 0;
    this.totalCasualties = 0;
    this.state = 'PREPARING';

    this.generateNewMap();
    this.renderBattleArena();
  }

  /**
   * 4x6 무루프 일방향 골짜기 지도 생성
   */
  generateNewMap() {
    this.map = Array(this.rows).fill(null).map(() => Array(this.cols).fill('M')); // M: 산지, V: 골짜기
    this.pathCoords = [];

    const startCol = Math.floor(Math.random() * this.cols);
    const endCol = Math.floor(Math.random() * this.cols);

    let currR = 0;
    let currC = startCol;
    this.pathCoords.push([currR, currC]);
    this.map[currR][currC] = 'V';

    while (currR < this.rows - 1) {
      const remainingRows = (this.rows - 1) - currR;
      const colDist = endCol - currC;

      const actions = [];
      actions.push('DOWN');
      actions.push('DOWN');

      if (colDist > 0 && currC < this.cols - 1) actions.push('RIGHT');
      else if (colDist < 0 && currC > 0) actions.push('LEFT');
      else {
        if (currC > 0) actions.push('LEFT');
        if (currC < this.cols - 1) actions.push('RIGHT');
      }

      if (remainingRows <= 1 && colDist !== 0) {
        actions.length = 0;
        actions.push(colDist > 0 ? 'RIGHT' : 'LEFT');
      }

      const act = actions[Math.floor(Math.random() * actions.length)];
      if (act === 'DOWN') {
        currR += 1;
      } else if (act === 'LEFT' && currC > 0) {
        currC -= 1;
      } else if (act === 'RIGHT' && currC < this.cols - 1) {
        currC += 1;
      } else {
        currR += 1;
      }

      const already = this.pathCoords.some(([r, c]) => r === currR && c === currC);
      if (!already) {
        this.pathCoords.push([currR, currC]);
        this.map[currR][currC] = 'V';
      }
    }

    if (currC !== endCol) {
      const step = endCol > currC ? 1 : -1;
      while (currC !== endCol) {
        currC += step;
        const already = this.pathCoords.some(([r, c]) => r === this.rows - 1 && c === currC);
        if (!already) {
          this.pathCoords.push([this.rows - 1, currC]);
          this.map[this.rows - 1][currC] = 'V';
        }
      }
    }
  }

  /**
   * 메인 전투 및 배치 아레나 렌더링
   */
  renderBattleArena() {
    const isPrep = this.state === 'PREPARING' || this.state === 'WAVE_CLEARED';
    const startCoord = this.pathCoords[0];
    const endCoord = this.pathCoords[this.pathCoords.length - 1];

    this.container.innerHTML = `
      <style>
        @keyframes monster-swarm-walk {
          0% { transform: translate(var(--jx), var(--jy)) rotate(-5deg) scale(0.95); }
          50% { transform: translate(var(--jx), calc(var(--jy) - 3px)) rotate(5deg) scale(1.05); }
          100% { transform: translate(var(--jx), var(--jy)) rotate(-5deg) scale(0.95); }
        }
        @keyframes battle-tile-shake {
          0% { transform: translate(0, 0); }
          20% { transform: translate(-2px, 1.5px); }
          40% { transform: translate(2px, -1.5px); }
          60% { transform: translate(-1.5px, -1px); }
          80% { transform: translate(1.5px, 1px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes clash-sparks {
          0% { transform: scale(0.7) rotate(-15deg); opacity: 0.4; }
          50% { transform: scale(1.4) rotate(15deg); opacity: 1; filter: drop-shadow(0 0 10px #f59e0b); }
          100% { transform: scale(0.9) rotate(-5deg); opacity: 0.6; }
        }
        @keyframes soldier-thrust {
          0%, 100% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.15) translateY(-4px); }
        }
        @keyframes float-damage {
          0% { opacity: 1; transform: translateY(0) scale(0.8); }
          40% { opacity: 1; transform: translateY(-16px) scale(1.2); }
          100% { opacity: 0; transform: translateY(-32px) scale(0.9); }
        }
      </style>

      <div class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/92 backdrop-blur-md animate-in fade-in select-none overflow-hidden">
        <div class="bg-slate-900 text-white rounded-3xl max-w-4xl w-full h-[96vh] p-3 sm:p-5 shadow-2xl border border-slate-700 flex flex-col justify-between">
          
          <!-- 상단 상태 정보 바 -->
          <div class="flex items-center justify-between pb-2.5 border-b border-slate-800 shrink-0">
            <div class="flex items-center gap-2">
              <span class="text-xl">🏰</span>
              <div>
                <h3 class="text-sm sm:text-base font-black text-amber-400 flex items-center gap-2">
                  <span>성채 공성전</span>
                  <span class="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 text-xs font-bold border border-indigo-800 font-mono">
                    Wave ${this.wave} / ${this.maxWave}
                  </span>
                </h3>
              </div>
            </div>

            <!-- 성채 내구도 및 처치 통계 -->
            <div class="flex items-center gap-2 sm:gap-4 text-xs font-bold">
              <div class="flex items-center gap-1.5 bg-slate-800 px-3 py-1 rounded-xl border border-slate-700">
                <span class="text-rose-400">❤️ 성채:</span>
                <span id="siege-castle-hp" class="text-sm font-mono font-black text-white">${this.castleHp}</span>
                <span class="text-[10px] text-slate-400">/ 100</span>
              </div>
              <div class="flex items-center gap-1.5 bg-slate-800 px-3 py-1 rounded-xl border border-slate-700">
                <span class="text-amber-400">⚔️ 처치:</span>
                <span id="siege-total-kills" class="text-sm font-mono font-black text-white">${this.totalKills}</span>
              </div>
              <button id="siege-exit-btn" class="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition font-bold text-xs" title="전투 포기 및 나가기">
                ✕ 나가기
              </button>
            </div>
          </div>

          <!-- 메인 전장: 좌측 4x6 맵 + 우측 병력/몬스터 패널 -->
          <div class="flex-1 flex flex-col md:flex-row items-center justify-center gap-4 py-2 min-h-0 overflow-hidden">
            
            <!-- 4x6 전장 맵 컨테이너 -->
            <div class="relative bg-slate-950 p-2 sm:p-3 rounded-2xl border-2 border-slate-800 shadow-inner flex flex-col items-center justify-center shrink-0">
              <div id="siege-grid" class="grid grid-cols-4 gap-1.5 sm:gap-2">
                ${this.map.map((rowArr, r) => 
                  rowArr.map((type, c) => {
                    const isStart = startCoord[0] === r && startCoord[1] === c;
                    const isEnd = endCoord[0] === r && endCoord[1] === c;
                    const isValley = type === 'V';
                    const placementKey = `${r}_${c}`;
                    const placed = this.placements[placementKey];

                    let tileBg = 'bg-stone-800/80 border-stone-700 text-stone-500';
                    if (isValley) {
                      tileBg = 'bg-amber-950/40 border-amber-800/50 hover:border-amber-500/80 cursor-pointer';
                    }
                    if (isStart) {
                      tileBg = 'bg-rose-950/50 border-rose-600/70';
                    }
                    if (isEnd) {
                      tileBg = 'bg-indigo-950/60 border-indigo-500/80';
                    }

                    return `
                      <div class="siege-tile relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 ${tileBg} flex flex-col items-center justify-center transition-all overflow-hidden select-none"
                        data-r="${r}" data-c="${c}" data-type="${isValley ? 'valley' : 'mountain'}">
                        
                        <!-- 배경 지형 아이콘 / 라벨 -->
                        ${!isValley ? `
                          <span class="text-xl opacity-35 pointer-events-none">⛰️</span>
                        ` : isStart ? `
                          <div class="absolute top-1 text-[9px] font-black text-rose-400 bg-rose-950/90 px-1 rounded pointer-events-none z-10">입구 👹</div>
                        ` : isEnd ? `
                          <div class="absolute bottom-1 text-[9px] font-black text-indigo-300 bg-indigo-950/90 px-1 rounded pointer-events-none z-10">성채 🏰</div>
                        ` : ''}

                        <!-- 배치된 병사 표시 -->
                        ${placed ? `
                          <div class="tile-soldier-unit relative z-20 flex flex-col items-center justify-center pointer-events-none transition-transform duration-150">
                            <span class="text-xl sm:text-2xl">${SOLDIER_SPECS[placed.rankType].icon}</span>
                            <div class="flex items-center gap-1 mt-0.5">
                              <span class="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-slate-900/90 text-amber-300 font-mono border border-amber-500/40">
                                ${placed.count}명
                              </span>
                            </div>
                            <!-- 타일 아군 체력 게이지 -->
                            <div class="w-12 sm:w-14 h-1 bg-black/80 rounded-full overflow-hidden mt-1 border border-slate-700">
                              <div class="tile-hp-bar h-full bg-emerald-500 transition-all duration-100" style="width: ${(placed.currentHp / placed.maxHp) * 100}%"></div>
                            </div>
                          </div>
                        ` : isValley && isPrep ? `
                          <span class="text-[9px] text-amber-500/50 font-bold pointer-events-none">클릭 증원</span>
                        ` : ''}

                        <!-- 교전 중 중앙 칼부림 & 불꽃 스파크 레이어 -->
                        <div class="tile-clash-layer absolute inset-0 z-35 pointer-events-none flex items-center justify-center hidden">
                          <div class="clash-icon text-2xl drop-shadow-lg" style="animation: clash-sparks 0.3s infinite alternate;">⚔️💥</div>
                        </div>

                        <!-- 몬스터 스웜 레이어 (바글바글 떼지어 내려오는 레이아웃) -->
                        <div class="tile-monsters-layer absolute inset-0 z-30 pointer-events-none flex items-center justify-center overflow-visible"></div>

                        <!-- 타격 효과 및 부유 데미지 오버레이 -->
                        <div class="tile-fx-overlay absolute inset-0 z-40 pointer-events-none hidden"></div>
                      </div>
                    `;
                  }).join('')
                ).join('')}
              </div>

              <!-- 화염 오버레이 (성채 함락 시 활성화) -->
              <div id="siege-flame-overlay" class="absolute inset-0 z-50 bg-rose-950/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center hidden animate-in fade-in">
                <div class="text-7xl animate-bounce">🔥🏰🔥</div>
                <h4 class="text-xl font-black text-rose-400 mt-2">성채가 함락되었습니다!</h4>
              </div>
            </div>

            <!-- 우측 컨트롤 패널: 웨이브 마물 정보 & 배치 안내 -->
            <div class="flex-1 flex flex-col justify-between max-w-sm w-full h-full min-h-0 bg-slate-950/60 p-3 sm:p-4 rounded-2xl border border-slate-800 space-y-3">
              
              <!-- 이번 웨이브 몬스터 대군단 정보 -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-black text-amber-400 flex items-center gap-1.5">
                    <span>👹</span> <span>Wave ${this.wave} 침공 군단</span>
                  </span>
                  <span class="text-[11px] font-mono text-slate-400">
                    ${this.getThemeForWave(this.wave).name}
                  </span>
                </div>

                <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 text-xs">
                  <div class="flex items-center justify-between text-slate-300">
                    <span>침공 마물 수:</span>
                    <strong class="text-rose-400 font-mono text-sm">${this.calculateMonsterCountForWave(this.wave)} 마리 대군단</strong>
                  </div>
                  <div class="flex items-center justify-between text-slate-300">
                    <span>마물 능력치:</span>
                    <span class="text-slate-400">HP ${this.getThemeForWave(this.wave).hp + this.wave * 12} / 공 ${this.getThemeForWave(this.wave).atk + Math.floor(this.wave * 2)}</span>
                  </div>
                  <div class="flex items-center justify-between text-slate-300">
                    <span>침공 속도:</span>
                    <span class="text-amber-400 font-bold">초고속 돌진 ⚡</span>
                  </div>
                </div>
              </div>

              <!-- 배치 안내 팁 -->
              <div class="p-3 rounded-xl bg-indigo-950/30 border border-indigo-900/40 text-[11px] text-indigo-200 leading-relaxed space-y-1">
                <div class="font-bold text-amber-300 flex items-center gap-1">
                  <span>💡</span> <span>편리한 원클릭 조작법</span>
                </div>
                <div>• 하단의 병사를 골짜기로 <strong>드래그</strong>하거나, 골짜기 타일을 <strong>원클릭</strong>하면 10명씩 바로 증원됩니다.</div>
                <div>• 한 골짜기에는 같은 종류의 병사만 배치 가능합니다.</div>
                <div>• 타일 우클릭 시 해당 타일의 병사가 대기열로 회수됩니다.</div>
              </div>

              <!-- 전투 개시 / 자동 배치 버튼 -->
              <div class="pt-2 border-t border-slate-800 flex gap-2">
                <button id="siege-auto-deploy-btn" ${isPrep ? '' : 'disabled'}
                  class="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition border border-slate-700">
                  ⚡ 자동 균등 배치
                </button>
                <button id="siege-start-battle-btn" ${isPrep ? '' : 'disabled'}
                  class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-xs shadow-lg shadow-amber-500/25 transition">
                  ⚔️ 전투 개시!
                </button>
              </div>

            </div>
          </div>

          <!-- 하단 병력 대기열 트레이 (실제 단어 1:1 인원수) -->
          <div id="siege-soldier-tray" class="bg-slate-950/80 p-2.5 rounded-2xl border border-slate-800 shrink-0">
            <div class="flex items-center justify-between pb-1.5 px-1">
              <span class="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                <span>🛡️</span> <span>출정 대기 병력 (타일 원클릭 또는 드래그 시 10명씩 배치)</span>
              </span>
              <span class="text-[10px] text-slate-500">배치된 타일 우클릭: 대기열 회수</span>
            </div>

            <div class="flex items-center gap-2 overflow-x-auto py-1">
              ${Object.entries(SOLDIER_SPECS).map(([rank, spec]) => {
                const count = this.soldierPool[rank] || 0;
                return `
                  <div class="soldier-card shrink-0 px-3 py-1.5 rounded-xl bg-slate-900 border ${count > 0 ? 'border-slate-700 hover:border-amber-500 cursor-grab active:cursor-grabbing' : 'border-slate-800 opacity-40'} flex items-center gap-2 select-none"
                    draggable="${count > 0 && isPrep}" data-rank="${rank}">
                    <span class="text-lg">${spec.icon}</span>
                    <div>
                      <div class="text-[11px] font-bold text-slate-200">${spec.name}</div>
                      <div class="text-xs font-black font-mono ${count > 0 ? 'text-amber-400' : 'text-slate-500'}">${count}명</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

        </div>
      </div>
    `;

    this.bindArenaEvents();
  }

  /**
   * 전장 이벤트 바인딩 (원클릭 증원, 드래그배치, 우클릭 회수)
   */
  bindArenaEvents() {
    const exitBtn = document.getElementById('siege-exit-btn');
    if (exitBtn) {
      exitBtn.onclick = () => {
        if (confirm('공성전을 종료하고 나가시겠습니까? (현재 진행 기록은 소멸됩니다)')) {
          this.close();
        }
      };
    }

    const startBtn = document.getElementById('siege-start-battle-btn');
    if (startBtn) {
      startBtn.onclick = () => {
        this.startWaveBattle();
      };
    }

    const autoBtn = document.getElementById('siege-auto-deploy-btn');
    if (autoBtn) {
      autoBtn.onclick = () => {
        this.autoDeployTroops();
      };
    }

    // 드래그 앤 드롭: 대기열 카드
    const cards = this.container.querySelectorAll('.soldier-card');
    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        if (this.state !== 'PREPARING' && this.state !== 'WAVE_CLEARED') return;
        this.draggedRank = card.dataset.rank;
        this.draggedTile = null;
        e.dataTransfer.setData('text/plain', this.draggedRank);
      });
    });

    // 타일 이벤트 바인딩
    const tiles = this.container.querySelectorAll('.siege-tile');
    tiles.forEach(tile => {
      const r = parseInt(tile.dataset.r, 10);
      const c = parseInt(tile.dataset.c, 10);
      const type = tile.dataset.type;

      // 원클릭 증원 이벤트 (요청사항 반영: 원클릭으로 10명씩 증가)
      tile.addEventListener('click', (e) => {
        if (this.state !== 'PREPARING' && this.state !== 'WAVE_CLEARED') return;
        if (type !== 'valley') return;

        const key = `${r}_${c}`;
        const placed = this.placements[key];
        if (placed) {
          // 이미 배치된 타일 클릭 시: 같은 종류 10명 증원!
          this.reinforceTile(r, c);
        } else {
          // 빈 타일 클릭 시: 현재 가장 많이 남아있는 병종 10명 스마트 배치!
          const bestRank = this.getBestAvailableRank();
          if (bestRank) {
            this.deployToTile(r, c, bestRank);
          }
        }
      });

      // 우클릭: 병사 회수 (배치 취소)
      tile.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (this.state !== 'PREPARING' && this.state !== 'WAVE_CLEARED') return;
        this.withdrawFromTile(r, c);
      });

      tile.addEventListener('dragover', (e) => {
        e.preventDefault();
      });

      tile.addEventListener('drop', (e) => {
        e.preventDefault();
        if (this.state !== 'PREPARING' && this.state !== 'WAVE_CLEARED') return;
        if (type !== 'valley') return;

        if (this.draggedRank) {
          this.deployToTile(r, c, this.draggedRank);
        }
      });
    });

    // 대기열 트레이로 드롭 시 배치 취소
    const tray = document.getElementById('siege-soldier-tray');
    if (tray) {
      tray.addEventListener('dragover', (e) => e.preventDefault());
      tray.addEventListener('drop', (e) => {
        e.preventDefault();
        if (this.draggedTile) {
          this.withdrawFromTile(this.draggedTile.r, this.draggedTile.c);
        }
      });
    }
  }

  getBestAvailableRank() {
    const ranks = [
      RANK_TYPES.MASTER,
      RANK_TYPES.ROYAL_GUARD,
      RANK_TYPES.HIGH_KNIGHT,
      RANK_TYPES.SENIOR_KNIGHT,
      RANK_TYPES.JUNIOR_KNIGHT,
      RANK_TYPES.INFANTRY,
      RANK_TYPES.RECRUIT
    ];
    for (const r of ranks) {
      if ((this.soldierPool[r] || 0) > 0) return r;
    }
    return null;
  }

  /**
   * 골짜기 타일에 병사 10명 배치
   */
  deployToTile(r, c, rankType) {
    const key = `${r}_${c}`;
    const current = this.placements[key];

    if (current && current.rankType !== rankType) {
      alert(`이미 ${SOLDIER_SPECS[current.rankType].name}가 배치된 골짜기입니다. 다른 종류의 병사는 배치할 수 없습니다.`);
      return;
    }

    const available = this.soldierPool[rankType] || 0;
    if (available <= 0) {
      alert(`배치 가능한 ${SOLDIER_SPECS[rankType].name}가 없습니다.`);
      return;
    }

    // 10명 단위 배치 (10명 미만 남았으면 남은 전원 배치)
    const toDeploy = Math.min(10, available);
    this.soldierPool[rankType] -= toDeploy;

    const spec = SOLDIER_SPECS[rankType];
    if (!current) {
      this.placements[key] = {
        rankType,
        count: toDeploy,
        currentHp: toDeploy * spec.hp,
        maxHp: toDeploy * spec.hp,
        lastAtkTime: 0
      };
    } else {
      current.count += toDeploy;
      current.maxHp += toDeploy * spec.hp;
      current.currentHp += toDeploy * spec.hp;
    }

    this.renderBattleArena();
  }

  /**
   * 원클릭 10명 증원
   */
  reinforceTile(r, c) {
    const key = `${r}_${c}`;
    const placed = this.placements[key];
    if (!placed) return;

    const rankType = placed.rankType;
    const available = this.soldierPool[rankType] || 0;
    if (available <= 0) {
      return;
    }

    const toDeploy = Math.min(10, available);
    this.soldierPool[rankType] -= toDeploy;

    const spec = SOLDIER_SPECS[rankType];
    placed.count += toDeploy;
    placed.maxHp += toDeploy * spec.hp;
    placed.currentHp += toDeploy * spec.hp;

    this.renderBattleArena();
  }

  /**
   * 타일에서 병사 회수 (배치 취소)
   */
  withdrawFromTile(r, c) {
    const key = `${r}_${c}`;
    const placed = this.placements[key];
    if (!placed) return;

    this.soldierPool[placed.rankType] = (this.soldierPool[placed.rankType] || 0) + placed.count;
    delete this.placements[key];
    this.renderBattleArena();
  }

  /**
   * 자동 균등 배치
   */
  autoDeployTroops() {
    const valleyCoords = [...this.pathCoords];
    const emptyValleys = valleyCoords.filter(([r, c]) => !this.placements[`${r}_${c}`]);

    const rankPriority = [
      RANK_TYPES.MASTER,
      RANK_TYPES.ROYAL_GUARD,
      RANK_TYPES.HIGH_KNIGHT,
      RANK_TYPES.SENIOR_KNIGHT,
      RANK_TYPES.JUNIOR_KNIGHT,
      RANK_TYPES.INFANTRY,
      RANK_TYPES.RECRUIT
    ];

    let targetIdx = emptyValleys.length - 1; // 성채 앞부터 배치
    rankPriority.forEach(rank => {
      while ((this.soldierPool[rank] || 0) > 0 && targetIdx >= 0) {
        const [r, c] = emptyValleys[targetIdx];
        this.deployToTile(r, c, rank);
        targetIdx--;
      }
    });

    this.renderBattleArena();
  }

  getThemeForWave(wave) {
    const tierIdx = Math.min(MONSTER_THEMES.length - 1, Math.floor((wave - 1) / 10));
    return MONSTER_THEMES[tierIdx];
  }

  calculateMonsterCountForWave(wave) {
    // 바글바글 쏟아져 나오는 웨이브 느낌: 18마리부터 시작하여 웨이브마다 3.5마리씩 추가!
    return 18 + Math.floor(wave * 3.5);
  }

  playBattleClashSound() {
    const now = performance.now();
    if (!this.lastClashSoundTime || now - this.lastClashSoundTime > 160) {
      this.lastClashSoundTime = now;
      SoundManager.playTone('clash');
    }
  }

  playDamageSound() {
    const now = performance.now();
    if (!this.lastDamageSoundTime || now - this.lastDamageSoundTime > 220) {
      this.lastDamageSoundTime = now;
      SoundManager.playTone('hit_damage');
    }
  }

  /**
   * 웨이브 전투 개시
   */
  startWaveBattle() {
    // 배치된 병사가 1명이라도 있는지 확인
    const totalPlaced = Object.values(this.placements).reduce((acc, p) => acc + p.count, 0);
    if (totalPlaced <= 0) {
      alert('전장에 배치된 병사가 없습니다! 골짜기에 병사를 10명 이상 배치한 후 시작하세요.');
      return;
    }

    // 전쟁 나팔 사운드 울림!
    SoundManager.playTone('war_horn');

    this.state = 'BATTLE';
    this.renderBattleArena();

    const theme = this.getThemeForWave(this.wave);
    const mobCount = this.calculateMonsterCountForWave(this.wave);

    // 몬스터 스폰 큐 생성 (바글바글 Swarm 지터 좌표 부여)
    this.spawnQueue = [];
    this.monsters = [];

    for (let i = 0; i < mobCount; i++) {
      this.spawnQueue.push({
        id: `mob_${this.wave}_${i}`,
        name: theme.name,
        type: theme.type,
        hp: theme.hp + this.wave * 12,
        maxHp: theme.hp + this.wave * 12,
        atk: theme.atk + Math.floor(this.wave * 2),
        speed: theme.speed,
        pathIndex: 0,
        progress: 0,
        lastAtkTime: 0,
        jitterX: Math.round((Math.random() - 0.5) * 28), // 떼지어 몰려오는 좌우 지터
        jitterY: Math.round((Math.random() - 0.5) * 22), // 떼지어 몰려오는 상하 지터
        animSpeed: (0.35 + Math.random() * 0.2).toFixed(2),
        animDelay: (Math.random() * 0.3).toFixed(2)
      });
    }

    // 초고속 스폰 간격 (200ms ~ 280ms로 쉴 새 없이 우르르 쏟아져 나옴)
    const spawnInterval = Math.max(180, 320 - this.wave * 3);
    this.spawnTimer = setInterval(() => {
      if (this.spawnQueue.length > 0) {
        this.monsters.push(this.spawnQueue.shift());
      } else {
        clearInterval(this.spawnTimer);
        this.spawnTimer = null;
      }
    }, spawnInterval);

    this.lastLoopTime = performance.now();
    this.animFrameId = requestAnimationFrame((t) => this.battleLoop(t));
  }

  battleLoop(timestamp) {
    if (this.state !== 'BATTLE') return;

    const dt = Math.min(100, timestamp - this.lastLoopTime);
    this.lastLoopTime = timestamp;

    this.updateBattleState(dt, timestamp);
    this.renderBattleFrame();

    // 성채 파괴 체크
    if (this.castleHp <= 0) {
      this.triggerGameOver();
      return;
    }

    // 이번 웨이브 클리어 조건
    if (this.spawnQueue.length === 0 && this.monsters.length === 0) {
      this.handleWaveClear();
      return;
    }

    this.animFrameId = requestAnimationFrame((t) => this.battleLoop(t));
  }

  /**
   * 전투 프레임 계산 (몬스터 돌진, 아군/적군 난전 교전)
   */
  updateBattleState(dt, now) {
    const endIdx = this.pathCoords.length - 1;

    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const mob = this.monsters[i];
      const [currR, currC] = this.pathCoords[mob.pathIndex];
      const key = `${currR}_${currC}`;
      const placed = this.placements[key];

      if (placed && placed.count > 0 && placed.currentHp > 0) {
        // 교전 중: 아군 공격
        const spec = SOLDIER_SPECS[placed.rankType];
        if (now - (placed.lastAtkTime || 0) >= spec.atkSpeed) {
          placed.lastAtkTime = now;
          const damage = placed.count * spec.atk;
          mob.hp -= damage;
          this.triggerTileFx(currR, currC, 'attack', damage);
        }

        // 몬스터의 반격 (850ms 주기)
        if (now - (mob.lastAtkTime || 0) >= 850) {
          mob.lastAtkTime = now;
          placed.currentHp -= mob.atk;
          this.triggerTileFx(currR, currC, 'damage', mob.atk);

          // 병사 사망 체크 (1인당 체력 단위로 사망)
          const newCount = Math.ceil(placed.currentHp / spec.hp);
          if (newCount < placed.count) {
            const lost = placed.count - Math.max(0, newCount);
            placed.count = Math.max(0, newCount);
            this.deadPool[placed.rankType] = (this.deadPool[placed.rankType] || 0) + lost;
            this.totalCasualties += lost;
          }

          if (placed.count <= 0 || placed.currentHp <= 0) {
            delete this.placements[key];
          }
        }
      } else {
        // 전진: 골짜기를 따라 고속 돌진
        mob.progress += (mob.speed * dt) / 1000;
        if (mob.progress >= 1.0) {
          mob.progress = 0;
          mob.pathIndex++;

          // 성채 도달 체크
          if (mob.pathIndex >= endIdx) {
            this.castleHp = Math.max(0, this.castleHp - 10);
            this.monsters.splice(i, 1);
            this.triggerTileFx(this.pathCoords[endIdx][0], this.pathCoords[endIdx][1], 'castle_hit', 10);
            continue;
          }
        }
      }

      // 몬스터 사망 체크
      if (mob.hp <= 0) {
        this.monsters.splice(i, 1);
        this.totalKills++;
      }
    }
  }

  /**
   * 화면 프레임 렌더링 (몬스터 스웜, 실시간 교전 애니메이션 및 체력 바 DOM 업데이트)
   */
  renderBattleFrame() {
    const hpEl = document.getElementById('siege-castle-hp');
    const killsEl = document.getElementById('siege-total-kills');
    if (hpEl) hpEl.innerText = this.castleHp;
    if (killsEl) killsEl.innerText = this.totalKills;

    const tiles = this.container.querySelectorAll('.siege-tile');
    tiles.forEach(tile => {
      const r = parseInt(tile.dataset.r, 10);
      const c = parseInt(tile.dataset.c, 10);
      const layer = tile.querySelector('.tile-monsters-layer');
      const hpBar = tile.querySelector('.tile-hp-bar');
      const clashLayer = tile.querySelector('.tile-clash-layer');
      const soldierUnit = tile.querySelector('.tile-soldier-unit');
      const key = `${r}_${c}`;
      const placed = this.placements[key];

      if (hpBar && placed) {
        hpBar.style.width = `${Math.max(0, (placed.currentHp / placed.maxHp) * 100)}%`;
      }

      const mobsOnTile = this.monsters.filter(m => {
        const coord = this.pathCoords[m.pathIndex];
        return coord && coord[0] === r && coord[1] === c;
      });

      // 딱 몹과 부딪혔을 때: 교전 중 효과 애니메이션 활성화!
      const isClashing = placed && placed.count > 0 && mobsOnTile.length > 0;

      if (isClashing) {
        tile.classList.add('battle-tile-shake', 'border-rose-500', 'shadow-lg', 'shadow-rose-500/50');
        if (clashLayer) clashLayer.classList.remove('hidden');
        if (soldierUnit) soldierUnit.style.animation = 'soldier-thrust 0.35s infinite ease-in-out';
      } else {
        tile.classList.remove('battle-tile-shake', 'border-rose-500', 'shadow-lg', 'shadow-rose-500/50');
        if (clashLayer) clashLayer.classList.add('hidden');
        if (soldierUnit) soldierUnit.style.animation = '';
      }

      if (layer) {
        if (mobsOnTile.length > 0) {
          // 바글바글하게 떼를 지어 흔들거리며 내려오는 몬스터 캐릭터 그래픽
          layer.innerHTML = mobsOnTile.map(m => `
            <div class="absolute flex flex-col items-center pointer-events-none"
              style="--jx:${m.jitterX}px; --jy:${m.jitterY}px; animation: monster-swarm-walk ${m.animSpeed}s infinite ease-in-out ${m.animDelay}s;">
              ${getMonsterCharacterSVG(m.type, this.wave, 24)}
              <div class="w-6 h-0.5 bg-black/90 rounded-full overflow-hidden mt-0.5">
                <div class="h-full bg-rose-500" style="width: ${(m.hp / m.maxHp) * 100}%"></div>
              </div>
            </div>
          `).join('');
        } else {
          layer.innerHTML = '';
        }
      }
    });
  }

  triggerTileFx(r, c, type, val) {
    const tile = this.container.querySelector(`.siege-tile[data-r="${r}"][data-c="${c}"]`);
    if (!tile) return;
    const fx = tile.querySelector('.tile-fx-overlay');
    if (!fx) return;

    if (type === 'attack') {
      this.playBattleClashSound();
      fx.innerHTML = `
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span class="text-xs sm:text-sm font-black text-amber-300 font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" style="animation: float-damage 0.45s ease-out forwards;">💥-${val}</span>
        </div>
      `;
    } else if (type === 'damage') {
      this.playDamageSound();
      fx.innerHTML = `
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span class="text-xs sm:text-sm font-black text-rose-500 font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" style="animation: float-damage 0.45s ease-out forwards;">🩸-${val}</span>
        </div>
      `;
    } else if (type === 'castle_hit') {
      SoundManager.playTone('explosion');
      fx.innerHTML = `
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span class="text-sm sm:text-base font-black text-red-500 font-mono drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]" style="animation: float-damage 0.6s ease-out forwards;">🔥 성채 피격! -${val}</span>
        </div>
      `;
    }

    fx.classList.remove('hidden');
    setTimeout(() => {
      if (fx) fx.classList.add('hidden');
    }, 450);
  }

  /**
   * 웨이브 클리어 처리
   */
  handleWaveClear() {
    this.stopBattleLoop();

    // 웨이브 클리어 팡파레 사운드 울림!
    SoundManager.playTone('wave_clear');

    if (this.wave >= this.maxWave) {
      this.triggerVictory();
      return;
    }

    const nextWave = this.wave + 1;

    // 10웨이브 단위: 새 맵 생성 & 50% 부활 & 재배치
    if (this.wave % 10 === 0) {
      this.handleDecadeMapShift(nextWave);
    } else {
      // 일반 웨이브 클리어: 모달 닫으면 즉시 다음 웨이브 시작!
      this.state = 'WAVE_CLEARED';
      this.wave = nextWave;
      this.showWaveClearModal(this.wave - 1, () => {
        this.startWaveBattle();
      });
    }
  }

  /**
   * 웨이브 클리어 팝업 (확인 누르면 지체 없이 즉시 다음 웨이브 전투 개시!)
   */
  showWaveClearModal(clearedWave, onNextWave) {
    const modal = document.createElement('div');
    modal.id = 'siege-wave-clear-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in select-none';
    modal.innerHTML = `
      <div class="bg-slate-900 text-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border-2 border-emerald-500/60 text-center">
        <div class="text-5xl mb-2 animate-bounce">🎉⚔️</div>
        <h4 class="text-xl font-black text-emerald-400">Wave ${clearedWave} 클리어!</h4>
        <p class="text-xs text-slate-300 mt-1">마물 대군단을 성공적으로 막아냈습니다!</p>
        
        <div class="my-4 p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
          <div>다음 침공: <strong class="text-amber-400 font-mono">Wave ${clearedWave + 1}</strong></div>
          <div class="text-[11px] text-slate-500">확인을 누르면 즉시 다음 웨이브가 시작됩니다.</div>
        </div>

        <button id="siege-next-wave-btn" class="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-sm shadow-lg shadow-emerald-500/30 transition transform active:scale-95">
          다음 웨이브 즉시 시작 ⚔️
        </button>
      </div>
    `;
    this.container.appendChild(modal);

    const btn = document.getElementById('siege-next-wave-btn');
    if (btn) {
      btn.onclick = () => {
        modal.remove();
        if (typeof onNextWave === 'function') {
          onNextWave();
        }
      };
    }
  }

  /**
   * 10웨이브 단위: 새 맵 생성 & 50% 부활 & 재배치
   */
  handleDecadeMapShift(nextWave) {
    this.state = 'PREPARING';
    this.wave = nextWave;

    // 사망한 병사의 50% 부활
    let totalRevived = 0;
    Object.keys(this.deadPool).forEach(rank => {
      const dead = this.deadPool[rank] || 0;
      if (dead > 0) {
        const revived = Math.ceil(dead * 0.5);
        this.soldierPool[rank] = (this.soldierPool[rank] || 0) + revived;
        this.deadPool[rank] = Math.max(0, dead - revived);
        totalRevived += revived;
      }
    });

    // 배치된 병사들도 대기열로 안전 회수
    Object.values(this.placements).forEach(p => {
      this.soldierPool[p.rankType] = (this.soldierPool[p.rankType] || 0) + p.count;
    });
    this.placements = {};

    this.generateNewMap();

    alert(`✨ [지형 변경 & 50% 부활]\nWave ${this.wave - 1} 돌파 기념으로 새로운 전장이 열리고,\n전사자 중 ${totalRevived}명이 명예롭게 부활했습니다!\n\n새로운 골짜기 지형에 병사를 재배치하세요!`);
    this.renderBattleArena();
  }

  /**
   * 성채 함락 & 게임 오버 연출
   */
  triggerGameOver() {
    this.stopBattleLoop();
    this.state = 'GAMEOVER';

    const flame = document.getElementById('siege-flame-overlay');
    if (flame) flame.classList.remove('hidden');

    const result = SiegeManager.recordBattleResult(this.wave, this.totalKills, this.totalCasualties);

    setTimeout(() => {
      this.renderGameOverModal(result);
    }, 1800);
  }

  renderGameOverModal(result) {
    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in select-none">
        <div class="bg-slate-900 text-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-2 border-rose-500/50 text-center relative overflow-hidden">
          
          <div class="text-6xl mb-3 animate-bounce">🔥🏰🔥</div>
          <h3 class="text-2xl font-black text-rose-500 tracking-tight">성채가 함락되었습니다...</h3>
          <p class="text-xs text-slate-400 mt-1">마물 대군단의 파상공세를 막아내지 못하고 성채가 불타올랐습니다.</p>

          <div class="my-5 p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <div class="flex justify-between items-center text-slate-300">
              <span>최종 도달 웨이브:</span>
              <span class="font-black text-amber-400 font-mono text-base">Wave ${this.wave} / ${this.maxWave}</span>
            </div>
            <div class="flex justify-between items-center text-slate-300">
              <span>처치한 마물 군단:</span>
              <span class="font-black text-emerald-400 font-mono">${this.totalKills} 마리</span>
            </div>
            <div class="flex justify-between items-center text-slate-300">
              <span>명예롭게 전사한 병사:</span>
              <span class="font-black text-rose-400 font-mono">${this.totalCasualties} 명</span>
            </div>
            ${result.isNewRecord ? `
              <div class="pt-2 border-t border-slate-800 text-purple-400 font-black text-xs animate-pulse">
                👑 새로운 최고 방어 기록 달성!
              </div>
            ` : `
              <div class="pt-2 border-t border-slate-800 text-slate-400 text-[11px]">
                역대 최고 기록: Wave ${result.bestWave}
              </div>
            `}
          </div>

          <div class="flex gap-2">
            <button id="siege-done-btn" class="w-full py-3 rounded-2xl bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-bold text-xs transition">
              대시보드로 복귀
            </button>
          </div>

        </div>
      </div>
    `;

    const btn = document.getElementById('siege-done-btn');
    if (btn) btn.onclick = () => this.close();
  }

  triggerVictory() {
    this.stopBattleLoop();
    this.state = 'GAMEOVER';
    const result = SiegeManager.recordBattleResult(100, this.totalKills, this.totalCasualties);

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in select-none">
        <div class="bg-slate-900 text-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-2 border-amber-500/80 text-center">
          <div class="text-6xl mb-3">👑🏰🎉</div>
          <h3 class="text-2xl font-black text-amber-400 tracking-tight">100웨이브 최종 방어 성공!</h3>
          <p class="text-xs text-slate-300 mt-1">왕국의 성채가 마물들의 대침공을 완전히 물리쳤습니다!</p>
          <div class="my-5 p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1.5">
            <div>총 처치 몬스터: <strong class="text-emerald-400 font-mono">${this.totalKills}</strong> 마리</div>
            <div>기사단 전사자: <strong class="text-rose-400 font-mono">${this.totalCasualties}</strong> 명</div>
          </div>
          <button id="siege-victory-done-btn" class="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-indigo-600 text-white font-black text-xs transition">
            영광을 안고 대시보드로 복귀
          </button>
        </div>
      </div>
    `;

    const btn = document.getElementById('siege-victory-done-btn');
    if (btn) btn.onclick = () => this.close();
  }

  stopBattleLoop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.spawnTimer) {
      clearInterval(this.spawnTimer);
      this.spawnTimer = null;
    }
  }
}
