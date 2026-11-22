// js/games/siege.js
// VocaQuest 성채 공성전 (Siege Defense) 게임 모듈
// 4x6 골짜기 미로 타일 맵, 단어장 기사단 기반 10명 단위 드래그&더블클릭 배치,
// 100웨이브 판타지 몹 디펜스, 10웨이브 단위 맵 변경 & 50% 부활, 성 함락 애니메이션

import { StorageManager } from '../storage.js?v=20261122_36';
import { SoundManager } from '../tts.js?v=20261122_36';
import { RANK_TYPES, RANK_CONFIG } from '../mastery.js?v=20261122_36';

export class SiegeManager {
  static STORAGE_KEY = 'vocaquest_siege_record_v2';

  /**
   * 오늘 공성전 기록 및 남은 횟수 조회 (새벽 12시 자동 리셋)
   */
  static getRecord() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.date === today) {
          return parsed;
        }
        // 날짜가 바뀌었으면 오늘 횟수 0으로 초기화하고 최고 기록은 보존
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
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(rec));
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

// 병사 계급별 기본 스펙 정의 (훈련병 -> 마스터로 갈수록 강화)
export const SOLDIER_SPECS = {
  [RANK_TYPES.RECRUIT]: {
    name: '훈련병',
    icon: '🪵',
    color: '#64748b',
    hp: 100,
    atk: 12,
    atkSpeed: 1000,
    range: 1.0,
    desc: '나무 몽둥이를 든 신병. 기본 체력과 공격력을 지닙니다.'
  },
  [RANK_TYPES.INFANTRY]: {
    name: '보병',
    icon: '🗡️',
    color: '#d97706',
    hp: 190,
    atk: 24,
    atkSpeed: 950,
    range: 1.0,
    desc: '가죽 갑옷과 단검을 든 일선 보병입니다.'
  },
  [RANK_TYPES.JUNIOR_KNIGHT]: {
    name: '초급기사',
    icon: '⚔️',
    color: '#0284c7',
    hp: 320,
    atk: 45,
    atkSpeed: 900,
    range: 1.1,
    desc: '사슬 갑옷과 롱소드를 갖춘 정식 기사입니다.'
  },
  [RANK_TYPES.SENIOR_KNIGHT]: {
    name: '중급기사',
    icon: '🛡️',
    color: '#6366f1',
    hp: 550,
    atk: 80,
    atkSpeed: 850,
    range: 1.2,
    desc: '강철 판금 갑옷과 굳건한 방패를 든 베테랑 기사입니다.'
  },
  [RANK_TYPES.HIGH_KNIGHT]: {
    name: '고급기사',
    icon: '✨⚔️',
    color: '#8b5cf6',
    hp: 950,
    atk: 140,
    atkSpeed: 800,
    range: 1.3,
    desc: '푸른 망토와 마법 룬검을 든 최정예 상급 기사입니다.'
  },
  [RANK_TYPES.ROYAL_GUARD]: {
    name: '왕실근위대',
    icon: '👑🛡️',
    color: '#f59e0b',
    hp: 1600,
    atk: 240,
    atkSpeed: 750,
    range: 1.5,
    desc: '황금 갑옷을 두르고 왕국을 수호하는 왕실 근위대입니다.'
  },
  [RANK_TYPES.MASTER]: {
    name: '마스터',
    icon: '🌟🧙‍♂️',
    color: '#ec4899',
    hp: 2800,
    atk: 420,
    atkSpeed: 700,
    range: 1.8,
    desc: '빛의 검기를 발산하는 전설의 마스터 기사입니다.'
  }
};

// 100웨이브 판타지 몬스터 테마 (10웨이브 단위로 진화)
export const MONSTER_THEMES = [
  { tier: 1, name: '슬라임 & 고블린', icon: '🟢', hp: 70, atk: 8, speed: 1.2, color: '#22c55e' },
  { tier: 2, name: '오크 보병단', icon: '👹', hp: 150, atk: 18, speed: 1.1, color: '#ea580c' },
  { tier: 3, name: '스켈레톤 군단', icon: '💀', hp: 280, atk: 32, speed: 1.0, color: '#94a3b8' },
  { tier: 4, name: '가고일 & 하피', icon: '🦇', hp: 460, atk: 55, speed: 1.3, color: '#7c3aed' },
  { tier: 5, name: '오우거 & 트롤', icon: '🧌', hp: 750, atk: 90, speed: 0.85, color: '#b45309' },
  { tier: 6, name: '골렘 & 가디언', icon: '🗿', hp: 1200, atk: 140, speed: 0.75, color: '#64748b' },
  { tier: 7, name: '다크 어쌔신 & 늑대', icon: '🐺', hp: 1800, atk: 220, speed: 1.4, color: '#4338ca' },
  { tier: 8, name: '데스나이트 & 리치', icon: '🧙‍♀️', hp: 2700, atk: 340, speed: 0.95, color: '#be185d' },
  { tier: 9, name: '와이번 & 히드라', icon: '🐉', hp: 4000, atk: 500, speed: 1.1, color: '#dc2626' },
  { tier: 10, name: '고대 파멸의 드래곤', icon: '🐲', hp: 6500, atk: 750, speed: 0.9, color: '#991b1b' }
];

export class SiegeGame {
  constructor() {
    this.container = null;
    this.rows = 6;
    this.cols = 4;
    this.map = []; // 6x4 타일 배열
    this.pathCoords = []; // 골짜기 경로 [(r, c), ...]
    
    // 병력 풀
    this.soldierPool = {}; // rankType -> 잔여 병사 수
    this.initialPool = {}; // 초기 병사 수
    this.deadPool = {}; // 지난 10웨이브 동안 사망한 병사 수
    
    // 배치 현황: key 'r_c' -> { rankType, count, currentHp, maxHp, lastAtkTime }
    this.placements = {};

    // 게임 상태
    this.state = 'IDLE'; // 'PREPARING' | 'BATTLE' | 'WAVE_CLEARED' | 'GAMEOVER'
    this.wave = 1;
    this.maxWave = 100;
    this.castleHp = 100;
    this.castleMaxHp = 100;
    this.totalKills = 0;
    this.totalCasualties = 0;

    // 전투 루프 객체들
    this.monsters = []; // 활성 몬스터 배열
    this.projectiles = []; // 투사체 효과
    this.spawnQueue = []; // 현재 웨이브 몬스터 스폰 대기열
    this.spawnTimer = null;
    this.animFrameId = null;
    this.lastLoopTime = 0;

    // 드래그 앤 드롭 상태
    this.draggedRank = null;
    this.draggedTile = null; // 타일에서 다른 곳으로 드래그할 때
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
   * 로비 화면: 오늘 출정 횟수 확인 & 출정 준비
   */
  renderLobby(canPlay, record) {
    const activeDeck = StorageManager.getActiveDeck();
    const words = (activeDeck && Array.isArray(activeDeck.words)) ? activeDeck.words : [];
    
    // 단어장 기반 병력 집계
    const ranksCount = this.calculateTroopsFromWords(words);
    const totalTroops = Object.values(ranksCount).reduce((a, b) => a + b, 0);

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
        <div class="bg-slate-900 text-white rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl border border-amber-500/40 relative overflow-hidden flex flex-col max-h-[92vh]">
          
          <!-- 배경 성채 실루엣 효과 -->
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
                단어장에서 육성한 기사단으로 몰려오는 100웨이브의 판타지 마물 군단으로부터 성을 방어하세요!
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

            <!-- 현재 보유 병력 (단어장 연동) -->
            <div class="p-4 rounded-2xl bg-slate-800/70 border border-slate-700 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-200 flex items-center gap-1.5">
                  <span>⚔️</span> <span>단어장 보유 병력 (총 ${totalTroops}명)</span>
                </span>
                <span class="text-[11px] text-slate-400">단어 1개 = 병사 10명 환산</span>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                ${Object.entries(ranksCount).map(([rank, count]) => {
                  const spec = SOLDIER_SPECS[rank];
                  return `
                    <div class="p-2 rounded-xl bg-slate-900/80 border border-slate-700/80">
                      <div class="text-xl">${spec.icon}</div>
                      <div class="font-bold text-[11px] text-slate-300 mt-0.5">${spec.name}</div>
                      <div class="text-xs font-black text-amber-400 font-mono">${count}명</div>
                      <div class="text-[9px] text-slate-400">공 ${spec.atk} / 체 ${spec.hp}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- 전투 규칙 요약 -->
            <div class="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-900/50 space-y-1.5 leading-relaxed text-[11px] text-indigo-200">
              <h4 class="font-black text-indigo-300 flex items-center gap-1">
                <span>📜</span> <span>공성전 규칙 안내</span>
              </h4>
              <ul class="list-disc list-inside space-y-1 text-slate-300">
                <li><strong>4x6 골짜기 전장</strong>: 상단 입구에서 하단 성채까지 이어지는 골짜기 길에만 병사를 배치할 수 있습니다.</li>
                <li><strong>10명 단위 배치 & 더블클릭</strong>: 병사를 골짜기로 드래그하여 10명씩 배치하고, 배치된 병사를 더블클릭하면 10명씩 증원됩니다.</li>
                <li><strong>10웨이브 단위 지형 변경 & 50% 부활</strong>: 10, 20, 30... 웨이브 클리어 시 지도가 바뀌고 전사한 병사의 50%가 부활합니다!</li>
                <li><strong>100웨이브 도전</strong>: 전멸하거나 성채가 파괴될 때까지 최대한 많은 웨이브를 버텨내세요!</li>
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
   * 단어장 기반 병력 수 계산 (단어 1개 = 10명 환산)
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
        counts[rank] += 10; // 단어 1개당 10명
      } else {
        counts[RANK_TYPES.RECRUIT] += 10;
      }
    });

    // 만약 단어장에 단어가 적어 총 병력이 50명 미만이면 신병 50명 기본 지원
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total < 50) {
      counts[RANK_TYPES.RECRUIT] += Math.max(30, 50 - total);
    }

    return counts;
  }

  /**
   * 출정 준비 단계: 4x6 맵 생성 및 병사 배치 화면
   */
  startPreparationPhase(troopsPool) {
    this.soldierPool = { ...troopsPool };
    this.initialPool = { ...troopsPool };
    this.deadPool = {};
    Object.keys(troopsPool).forEach(k => { this.deadPool[k] = 0; });
    this.placements = {};
    this.wave = 1;
    this.castleHp = 100;
    this.castleMaxHp = 100;
    this.totalKills = 0;
    this.totalCasualties = 0;
    this.state = 'PREPARING';

    this.generateNewMap();
    this.renderBattleArena();
  }

  /**
   * 4x6 골짜기 단일 일방향 미로 맵 생성 알고리즘
   * - Row 0 (상위 1열 4칸 중 1곳이 입구)
   * - Row 5 (최하위 6행 4칸 중 1곳이 출구)
   * - 막힌 길 없고, 되도는 길 없는 일방향 단일 골짜기 경로
   */
  generateNewMap() {
    this.map = Array(this.rows).fill(null).map(() => Array(this.cols).fill('mountain'));
    this.pathCoords = [];

    const startCol = Math.floor(Math.random() * this.cols); // 0..3
    const endCol = Math.floor(Math.random() * this.cols);   // 0..3

    let currR = 0;
    let currC = startCol;
    const path = [[currR, currC]];

    // 0행부터 5행까지 단계별 전진
    while (currR < this.rows - 1) {
      // 가로 이동 결정 (0..2칸 무작위 이동)
      const horizontalSteps = Math.floor(Math.random() * 3); // 0, 1, 2
      const dir = (Math.random() < 0.5) ? -1 : 1; // 좌 또는 우

      for (let s = 0; s < horizontalSteps; s++) {
        const nextC = currC + dir;
        if (nextC >= 0 && nextC < this.cols && !path.some(([r, c]) => r === currR && c === nextC)) {
          currC = nextC;
          path.push([currR, currC]);
        }
      }

      // 반드시 아래로 1칸 전진 (루프 방지 및 일방향 보장)
      currR += 1;
      path.push([currR, currC]);
    }

    // 마지막 5행에서 목표 출구(endCol)까지 가로로 연결
    while (currC !== endCol) {
      currC += (currC < endCol) ? 1 : -1;
      path.push([currR, currC]);
    }

    this.pathCoords = path;
    // 맵에 골짜기 타일 마킹
    path.forEach(([r, c]) => {
      this.map[r][c] = 'valley';
    });
  }

  /**
   * 메인 전투 및 배치 아레나 렌더링
   */
  renderBattleArena() {
    const isPrep = this.state === 'PREPARING' || this.state === 'WAVE_CLEARED';
    const startCoord = this.pathCoords[0];
    const endCoord = this.pathCoords[this.pathCoords.length - 1];

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in select-none overflow-hidden">
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
                <span class="text-rose-400">❤️ 성채 내구도:</span>
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
                    const isStart = (r === startCoord[0] && c === startCoord[1]);
                    const isEnd = (r === endCoord[0] && c === endCoord[1]);
                    const isValley = (type === 'valley');
                    const placed = this.placements[`${r}_${c}`];
                    const spec = placed ? SOLDIER_SPECS[placed.rankType] : null;

                    let bgClass = 'bg-stone-800/80 border-stone-700 text-stone-500'; // 산지
                    if (isValley) {
                      bgClass = 'bg-amber-950/40 border-amber-700/60 hover:border-amber-400 cursor-pointer shadow-sm';
                    }
                    if (isStart) bgClass += ' ring-2 ring-rose-500 ring-offset-1 ring-offset-slate-900';
                    if (isEnd) bgClass += ' ring-2 ring-emerald-500 ring-offset-1 ring-offset-slate-900';

                    return `
                      <div data-r="${r}" data-c="${c}" data-type="${type}"
                        class="siege-tile w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 flex flex-col items-center justify-center relative transition-all duration-150 ${bgClass}">
                        
                        ${isStart ? '<span class="absolute top-1 left-1 text-[9px] px-1 bg-rose-600 text-white font-black rounded-md z-10">입구</span>' : ''}
                        ${isEnd ? '<span class="absolute top-1 right-1 text-[9px] px-1 bg-emerald-600 text-white font-black rounded-md z-10">성채</span>' : ''}

                        <!-- 산지 그래픽 -->
                        ${!isValley ? `
                          <span class="text-xl opacity-30">⛰️</span>
                          <span class="text-[9px] opacity-40 font-bold">산지</span>
                        ` : ''}

                        <!-- 골짜기 빈 타일 안내 -->
                        ${isValley && !placed ? `
                          <span class="text-amber-500/30 text-xs font-bold">골짜기</span>
                        ` : ''}

                        <!-- 배치된 병사 표시 -->
                        ${placed ? `
                          <div class="placed-soldier-unit flex flex-col items-center justify-center w-full h-full animate-in zoom-in-75 duration-100" title="${spec.name} ${placed.count}명 (더블클릭 증원)">
                            <div class="text-xl sm:text-2xl">${spec.icon}</div>
                            <div class="text-[10px] font-black text-amber-300 font-mono px-1 rounded bg-black/60 mt-0.5">
                              ${placed.count}명
                            </div>
                            <!-- 타일 내 병사 총 체력 바 -->
                            <div class="w-10 sm:w-14 h-1.5 bg-slate-700 rounded-full overflow-hidden mt-0.5 border border-black/40">
                              <div class="tile-hp-bar h-full bg-emerald-500 transition-all duration-150" style="width: ${(placed.currentHp / placed.maxHp) * 100}%"></div>
                            </div>
                          </div>
                        ` : ''}

                        <!-- 타일에 진입한 몬스터 컨테이너 -->
                        <div class="tile-monsters-layer absolute inset-0 pointer-events-none flex items-center justify-center z-20"></div>

                        <!-- 피격/공격 효과 오버레이 -->
                        <div class="tile-fx-overlay absolute inset-0 pointer-events-none rounded-2xl z-30"></div>
                      </div>
                    `;
                  }).join('')
                ).join('')}
              </div>

              <!-- 하단 성채 불타는 오버레이 (함락 시) -->
              <div id="siege-flame-overlay" class="hidden absolute inset-0 bg-red-950/80 z-40 rounded-2xl flex flex-col items-center justify-center animate-pulse">
                <span class="text-6xl animate-bounce">🔥🏰🔥</span>
                <span class="text-lg font-black text-rose-400 mt-2">성채 함락!</span>
              </div>
            </div>

            <!-- 우측 정보 및 제어 패널 -->
            <div class="flex-1 flex flex-col justify-between max-w-sm w-full h-full space-y-3">
              
              <!-- 안내 배너 -->
              <div class="p-3 rounded-2xl bg-slate-800/80 border border-slate-700 text-xs">
                <div class="font-bold text-amber-300 flex items-center justify-between mb-1">
                  <span>${isPrep ? '🛡️ 병력 배치 단계' : '⚔️ 전투 진행 중'}</span>
                  <span class="text-[10px] text-slate-400">10웨이브마다 지형 변경</span>
                </div>
                <p class="text-[11px] text-slate-300 leading-relaxed">
                  ${isPrep 
                    ? '하단 병사를 드래그하여 골짜기에 10명씩 배치하세요. 배치된 병사를 <strong>더블클릭</strong>하면 10명씩 추가 증원됩니다!' 
                    : '몬스터들이 골짜기를 따라 성채를 공격해옵니다! 적을 격파하세요.'}
                </p>
              </div>

              <!-- 이번 웨이브 몬스터 예고 -->
              <div class="p-3 rounded-2xl bg-slate-800/50 border border-slate-700/80">
                <div class="text-[11px] font-bold text-slate-400 mb-1 flex items-center justify-between">
                  <span>출현 마물 군단</span>
                  <span class="text-amber-400 font-mono font-bold">Wave ${this.wave}</span>
                </div>
                ${(() => {
                  const themeIdx = Math.min(MONSTER_THEMES.length - 1, Math.floor((this.wave - 1) / 10));
                  const theme = MONSTER_THEMES[themeIdx];
                  const count = Math.min(25, 4 + Math.floor(this.wave * 0.7));
                  return `
                    <div class="flex items-center gap-2.5">
                      <span class="text-3xl">${theme.icon}</span>
                      <div>
                        <div class="font-bold text-xs text-white">${theme.name} x ${count}마리</div>
                        <div class="text-[10px] text-slate-400">마리당 체력 ${theme.hp + this.wave * 15} / 공격력 ${theme.atk + this.wave * 3}</div>
                      </div>
                    </div>
                  `;
                })()}
              </div>

              <!-- 전투 시작 및 일괄 제어 버튼 -->
              <div class="space-y-2">
                ${isPrep ? `
                  <button id="siege-start-battle-btn" class="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white font-black text-sm shadow-xl shadow-amber-500/20 transition flex items-center justify-center gap-2">
                    <span>⚔️</span> <span>전투 개시! (Wave ${this.wave})</span>
                  </button>
                  <button id="siege-auto-deploy-btn" class="w-full py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition">
                    ⚡ 빈 골짜기에 자동 균등 배치
                  </button>
                ` : `
                  <div class="p-3 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-center animate-pulse">
                    <span class="text-rose-400 font-black text-xs flex items-center justify-center gap-1.5">
                      <span>⚔️</span> <span>전투 교전 중입니다...</span>
                    </span>
                  </div>
                `}
              </div>

            </div>

          </div>

          <!-- 하단 병력 대기열 트레이 (드래그 소스) -->
          <div class="p-2 sm:p-3 rounded-2xl bg-slate-950 border border-slate-800 shrink-0">
            <div class="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1.5">
              <span>대기 중인 병력 (골짜기 타일로 드래그하여 10명 배치)</span>
              <span class="text-slate-500">배치 취소: 타일 병사를 여기로 드래그</span>
            </div>

            <div id="siege-soldier-tray" class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              ${Object.entries(this.soldierPool).map(([rank, count]) => {
                const spec = SOLDIER_SPECS[rank];
                const isAvailable = count > 0;
                return `
                  <div data-rank="${rank}" draggable="${isAvailable && isPrep}"
                    class="soldier-card shrink-0 px-3 py-2 rounded-xl border flex items-center gap-2 transition select-none
                      ${isAvailable && isPrep ? 'bg-slate-800/90 border-slate-700 hover:border-amber-400 cursor-grab active:cursor-grabbing shadow-sm' : 'bg-slate-900/60 border-slate-800 opacity-40 cursor-not-allowed'}">
                    <span class="text-xl">${spec.icon}</span>
                    <div>
                      <div class="font-bold text-[11px] text-slate-200 leading-tight">${spec.name}</div>
                      <div class="text-xs font-black text-amber-400 font-mono">${count}명</div>
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
   * 전장 이벤트 바인딩 (드래그, 더블클릭, 버튼)
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

    // 타일 드래그오버 & 드롭
    const tiles = this.container.querySelectorAll('.siege-tile');
    tiles.forEach(tile => {
      const r = parseInt(tile.dataset.r, 10);
      const c = parseInt(tile.dataset.c, 10);
      const type = tile.dataset.type;

      // 더블클릭 증원 이벤트 (요구사항 7번)
      tile.addEventListener('dblclick', () => {
        if (this.state !== 'PREPARING' && this.state !== 'WAVE_CLEARED') return;
        this.reinforceTile(r, c);
      });

      // 모바일 터치 대응 더블탭 감지
      let lastTap = 0;
      tile.addEventListener('touchend', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        if (tapLength < 350 && tapLength > 0) {
          e.preventDefault();
          if (this.state === 'PREPARING' || this.state === 'WAVE_CLEARED') {
            this.reinforceTile(r, c);
          }
        }
        lastTap = currentTime;
      });

      tile.addEventListener('dragover', (e) => {
        e.preventDefault();
      });

      tile.addEventListener('drop', (e) => {
        e.preventDefault();
        if (this.state !== 'PREPARING' && this.state !== 'WAVE_CLEARED') return;
        if (type !== 'valley') {
          // 산지에는 배치 불가
          return;
        }

        if (this.draggedRank) {
          this.deployToTile(r, c, this.draggedRank);
        }
      });
    });

    // 대기열 트레이로 드롭 시 배치 취소 (병사 회수)
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

  /**
   * 골짜기 타일에 병사 10명 배치
   */
  deployToTile(r, c, rankType) {
    const key = `${r}_${c}`;
    const current = this.placements[key];

    // 규칙 6: 한 종류의 병사가 배치된 골짜기에 다른 종류는 배치 불가
    if (current && current.rankType !== rankType) {
      alert(`이미 ${SOLDIER_SPECS[current.rankType].name}가 배치된 골짜기입니다. 다른 종류의 병사는 배치할 수 없습니다.`);
      return;
    }

    const available = this.soldierPool[rankType] || 0;
    if (available <= 0) {
      alert(`배치 가능한 ${SOLDIER_SPECS[rankType].name}가 없습니다.`);
      return;
    }

    // 10명 단위 배치 (10명 이하 남았으면 전원)
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
   * 배치된 병사 더블클릭 증원 (요구사항 7번)
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
   * 자동 균등 배치 편의 기능
   */
  autoDeployTroops() {
    const valleyCoords = [...this.pathCoords];
    // 출구(성채 바로 앞)부터 골짜기 타일 순회
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

    let vIdx = 0;
    for (const rank of rankPriority) {
      while (this.soldierPool[rank] > 0 && vIdx < emptyValleys.length) {
        const [r, c] = emptyValleys[vIdx];
        this.deployToTile(r, c, rank);
        vIdx++;
      }
    }
    this.renderBattleArena();
  }

  /**
   * ====================================================
   * 실시간 전투 루프 & 웨이브 진행
   * ====================================================
   */
  startWaveBattle() {
    this.state = 'BATTLE';
    this.monsters = [];
    this.renderBattleArena();

    // 이번 웨이브 몬스터 대기열 생성
    const themeIdx = Math.min(MONSTER_THEMES.length - 1, Math.floor((this.wave - 1) / 10));
    const theme = MONSTER_THEMES[themeIdx];
    const count = Math.min(25, 4 + Math.floor(this.wave * 0.7));

    this.spawnQueue = [];
    for (let i = 0; i < count; i++) {
      this.spawnQueue.push({
        id: `mob_${this.wave}_${i}`,
        name: theme.name,
        icon: theme.icon,
        hp: theme.hp + this.wave * 18,
        maxHp: theme.hp + this.wave * 18,
        atk: theme.atk + this.wave * 3,
        speed: theme.speed,
        pathIndex: 0, // 현재 pathCoords 상의 인덱스
        progress: 0,  // 타일 내 진행도 0.0 ~ 1.0
        lastAtkTime: 0
      });
    }

    // 1.2초마다 몬스터 스폰
    this.spawnTimer = setInterval(() => {
      if (this.spawnQueue.length > 0) {
        this.monsters.push(this.spawnQueue.shift());
      } else {
        clearInterval(this.spawnTimer);
        this.spawnTimer = null;
      }
    }, 1200);

    this.lastLoopTime = performance.now();
    this.animFrameId = requestAnimationFrame((t) => this.battleLoop(t));
  }

  battleLoop(timestamp) {
    if (this.state !== 'BATTLE') return;

    const dt = Math.min(100, timestamp - this.lastLoopTime); // delta ms
    this.lastLoopTime = timestamp;

    this.updateBattleState(dt, timestamp);
    this.renderBattleFrame();

    // 승패 체크
    if (this.castleHp <= 0) {
      this.triggerGameOver();
      return;
    }

    // 이번 웨이브 클리어 조건: 스폰 큐 비고 모든 몬스터 처치 완료
    if (this.spawnQueue.length === 0 && this.monsters.length === 0) {
      this.handleWaveClear();
      return;
    }

    this.animFrameId = requestAnimationFrame((t) => this.battleLoop(t));
  }

  /**
   * 전투 프레임 계산 (몬스터 전진, 아군/적군 공격 교전)
   */
  updateBattleState(dt, now) {
    const endIdx = this.pathCoords.length - 1;

    // 1. 몬스터 이동 및 교전
    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const mob = this.monsters[i];
      const [currR, currC] = this.pathCoords[mob.pathIndex];
      const key = `${currR}_${currC}`;
      const placed = this.placements[key];

      if (placed && placed.count > 0 && placed.currentHp > 0) {
        // 교전 중: 타일에 병사가 있으면 몬스터 이동 정지 및 병사와 맞서 싸움
        // 아군 공격
        const spec = SOLDIER_SPECS[placed.rankType];
        if (now - (placed.lastAtkTime || 0) >= spec.atkSpeed) {
          placed.lastAtkTime = now;
          const damage = placed.count * spec.atk;
          mob.hp -= damage;
          this.triggerTileFx(currR, currC, 'attack', damage);
        }

        // 몬스터의 반격 (1초 주기)
        if (now - (mob.lastAtkTime || 0) >= 1000) {
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
            delete this.placements[key]; // 타일 아군 전멸
          }
        }
      } else {
        // 전진: 골짜기를 따라 성채 방향으로 이동
        mob.progress += (mob.speed * dt) / 1000;
        if (mob.progress >= 1.0) {
          mob.progress = 0;
          mob.pathIndex++;

          // 성채 도달 체크!
          if (mob.pathIndex >= endIdx) {
            this.castleHp = Math.max(0, this.castleHp - 15);
            this.monsters.splice(i, 1);
            this.triggerTileFx(this.pathCoords[endIdx][0], this.pathCoords[endIdx][1], 'castle_hit', 15);
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
   * 화면 프레임 렌더링 (몬스터 및 체력 바 DOM 업데이트)
   */
  renderBattleFrame() {
    const hpEl = document.getElementById('siege-castle-hp');
    const killsEl = document.getElementById('siege-total-kills');
    if (hpEl) hpEl.innerText = this.castleHp;
    if (killsEl) killsEl.innerText = this.totalKills;

    // 타일별 몬스터 레이어 갱신
    const tiles = this.container.querySelectorAll('.siege-tile');
    tiles.forEach(tile => {
      const r = parseInt(tile.dataset.r, 10);
      const c = parseInt(tile.dataset.c, 10);
      const layer = tile.querySelector('.tile-monsters-layer');
      const hpBar = tile.querySelector('.tile-hp-bar');
      const key = `${r}_${c}`;
      const placed = this.placements[key];

      if (hpBar && placed) {
        hpBar.style.width = `${Math.max(0, (placed.currentHp / placed.maxHp) * 100)}%`;
      }

      if (layer) {
        // 이 타일에 위치한 몬스터 필터링
        const mobsOnTile = this.monsters.filter(m => {
          const coord = this.pathCoords[m.pathIndex];
          return coord && coord[0] === r && coord[1] === c;
        });

        if (mobsOnTile.length > 0) {
          layer.innerHTML = mobsOnTile.map(m => `
            <div class="flex flex-col items-center animate-in zoom-in-50 duration-75">
              <span class="text-xl sm:text-2xl">${m.icon}</span>
              <div class="w-8 h-1 bg-black/80 rounded-full overflow-hidden mt-0.5">
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
      fx.style.backgroundColor = 'rgba(234, 179, 8, 0.3)';
    } else if (type === 'damage') {
      fx.style.backgroundColor = 'rgba(239, 68, 68, 0.4)';
    } else if (type === 'castle_hit') {
      fx.style.backgroundColor = 'rgba(220, 38, 38, 0.6)';
    }
    setTimeout(() => { if (fx) fx.style.backgroundColor = 'transparent'; }, 150);
  }

  /**
   * 웨이브 클리어 처리 (요구사항 11 & 12번)
   */
  handleWaveClear() {
    this.stopBattleLoop();

    // 100웨이브 최종 승리!
    if (this.wave >= this.maxWave) {
      this.triggerVictory();
      return;
    }

    const nextWave = this.wave + 1;

    // 요구사항 12번: 10, 20, 30... 웨이브 단위로 지도가 바뀌고 사망한 병사의 절반이 부활!
    if (this.wave % 10 === 0) {
      this.handleDecadeMapShift(nextWave);
    } else {
      // 일반 웨이브 클리어: 사망한 병사는 그대로 유지된 채 다음 웨이브 준비
      this.state = 'WAVE_CLEARED';
      this.wave = nextWave;
      alert(`🎉 Wave ${this.wave - 1} 클리어!\n전열을 가다듬고 다음 웨이브에 대비하세요.`);
      this.renderBattleArena();
    }
  }

  /**
   * 10웨이브 단위: 새 맵 생성 & 50% 부활 & 재배치 (요구사항 12번)
   */
  handleDecadeMapShift(nextWave) {
    this.state = 'PREPARING';
    this.wave = nextWave;

    // 사망한 병사의 50% 부활 계산
    let totalRevived = 0;
    Object.keys(this.deadPool).forEach(rank => {
      const dead = this.deadPool[rank] || 0;
      if (dead > 0) {
        const revived = Math.ceil(dead * 0.5); // 절반 부활
        this.soldierPool[rank] = (this.soldierPool[rank] || 0) + revived;
        this.deadPool[rank] = Math.max(0, dead - revived);
        totalRevived += revived;
      }
    });

    // 배치된 병사들도 대기열로 안전하게 회수하여 새로운 지형에 재배치
    Object.values(this.placements).forEach(p => {
      this.soldierPool[p.rankType] = (this.soldierPool[p.rankType] || 0) + p.count;
    });
    this.placements = {};

    // 새로운 4x6 골짜기 지도 생성
    this.generateNewMap();

    alert(`✨ [지형 변경 & 부활]\nWave ${this.wave - 1} 격파 기념으로 새로운 전장이 열리고,\n전사한 병사 중 ${totalRevived}명이 명예롭게 부활했습니다!\n\n새로운 골짜기 지형에 병사를 재배치하세요!`);
    this.renderBattleArena();
  }

  /**
   * 성채 함락 & 게임 오버 연출 (요구사항 13번)
   */
  triggerGameOver() {
    this.stopBattleLoop();
    this.state = 'GAMEOVER';

    // 성채 불타는 연출 활성화
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
          <p class="text-xs text-slate-400 mt-1">적들의 맹공을 막아내지 못하고 성이 불타올랐습니다.</p>

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
