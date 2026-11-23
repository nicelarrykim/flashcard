// js/games/speed-drop.js
// 단어 낙하 방패 디펜스 (Speed Drop Shield Defense) 아케이드 게임 모듈
// 하늘에서 최대 2개의 단어가 떨어지며, 화면 아래 4개의 뜻 방패에 드래그하여 매칭하는 게임

import { StorageManager } from '../storage.js?v=20261124_01';
import { SoundManager } from '../tts.js?v=20261124_01';

export class SpeedDropGame {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.allPool = [];
    this.activeWords = []; // 현재 떨어지고 있는 단어 목록 (최대 2개)
    this.shields = [];     // 아래 4개 방패 선택지 [{ wordObj, meaning, id }]
    this.lives = 3;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.dropBaseSpeed = 0.14; // 기본 낙하 속도 (%/frame) - 속도 완화 적용
    this.animationFrame = null;
    this.isPlaying = false;
    this.lastSpawnTime = 0;
    this.spawnInterval = 3800; // ms 단위로 2번째 단어 스폰 간격 (여유 있는 템포)
    this.draggingWord = null;  // 현재 드래그 중인 단어 객체
    this.selectedWord = null;  // 클릭 선택된 단어 객체 (원클릭 조작 편의용)
    this.dragOffset = { x: 0, y: 0 };
    this.arenaRect = null;
    this.nextId = 1;
  }

  init() {
    this.container = this.container || document.getElementById(this.containerId);
    this.renderStartScreen();
  }

  renderStartScreen() {
    this.container = this.container || document.getElementById(this.containerId);
    if (!this.container) return;

    const mgr = (typeof StorageManager !== 'undefined' && typeof StorageManager?.getActiveDeck === 'function')
      ? StorageManager
      : (window.StorageManager || null);
    const studyWords = StorageManager.getStudyWords ? StorageManager.getStudyWords() : (mgr?.getWords?.() || []);
    const activeDeck = mgr?.getActiveDeck?.() || { name: '기본 단어장' };
    const canPlay = studyWords.length >= 4 || (mgr?.getWords?.() || []).length >= 4;

    this.container.innerHTML = `
      <div class="max-w-md mx-auto text-center py-10 px-6 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700">
        <div class="text-6xl mb-4">🛡️</div>
        <div class="inline-block px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-black mb-3">
          📖 단어장: ${activeDeck?.name || '기본 단어장'} (${studyWords.length}단어)
        </div>
        <h2 class="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">단어 낙하 방패 디펜스</h2>
        <p class="text-slate-500 dark:text-slate-400 mb-6 text-sm leading-relaxed">
          하늘에서 <strong>최대 2개의 영단어</strong>가 떨어집니다!<br>
          단어를 <strong>올바른 뜻이 적힌 방패</strong>로 끌어당겨 넣으세요.<br>
          <span class="text-xs text-indigo-500 dark:text-indigo-400 font-semibold">드래그 & 드롭 또는 단어 클릭 후 방패 클릭으로 수호하세요!</span>
        </p>

        ${!canPlay ? `
          <div class="p-4 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-2xl text-sm mb-4">
            방패 4개를 구성하려면 최소 4개 이상의 단어가 필요합니다.
          </div>
        ` : `
          <button id="drop-start-btn" class="w-full py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white font-black text-lg rounded-2xl shadow-lg shadow-indigo-500/30 transition transform hover:-translate-y-0.5 active:translate-y-0">
            방패 디펜스 시작하기 ⚔️
          </button>
        `}
      </div>
    `;

    const startBtn = document.getElementById('drop-start-btn');
    if (startBtn) startBtn.addEventListener('click', () => this.startGame());
  }

  startGame() {
    let pool = StorageManager.getStudyWords ? StorageManager.getStudyWords() : StorageManager.getWords();
    if (pool.length < 4) {
      pool = StorageManager.getActiveWords ? StorageManager.getActiveWords() : StorageManager.getWords();
    }
    if (pool.length < 4) return;

    this.allPool = [...pool].sort(() => Math.random() - 0.5);
    this.activeWords = [];
    this.shields = [];
    this.lives = 3;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.isPlaying = true;
    this.draggingWord = null;
    this.selectedWord = null;
    this.lastSpawnTime = performance.now();

    this.renderGameField();
    this.spawnWord(); // 첫 번째 단어 생성
    this.updateShields(); // 방패 4개 생성
    this.bindArenaEvents();

    this.loop(performance.now());
  }

  /**
   * 새 단어 낙하 스폰
   */
  spawnWord() {
    if (!this.isPlaying || this.activeWords.length >= 2) return;

    // 풀에서 단어 선택 (이미 떨어지고 있는 단어 제외)
    const existingIds = this.activeWords.map(w => w.wordObj.id);
    let available = this.allPool.filter(w => !existingIds.includes(w.id));
    if (available.length === 0) {
      available = [...this.allPool];
    }
    const chosen = available[Math.floor(Math.random() * available.length)];

    // 가로 위치 랜덤 (단, 2개가 너무 겹치지 않도록 분산)
    let randomX = 12 + Math.random() * 64; // 12% ~ 76%
    if (this.activeWords.length === 1) {
      const otherX = this.activeWords[0].x;
      if (otherX < 45) {
        randomX = 50 + Math.random() * 28;
      } else {
        randomX = 12 + Math.random() * 28;
      }
    }

    const currentSpeed = Math.min(0.38, this.dropBaseSpeed + (this.score / 3500) * 0.08);

    const fallingItem = {
      id: 'drop_' + (this.nextId++),
      wordObj: chosen,
      x: randomX,
      y: 4, // 상단 4%에서 시작
      speed: currentSpeed,
      isDragging: false,
      dragPosX: 0,
      dragPosY: 0
    };

    this.activeWords.push(fallingItem);
    this.lastSpawnTime = performance.now();

    // 단어 발음 자동 1회 재생
    SoundManager.speak(chosen.word, chosen.audioUrl);

    // 방패 보기 보장 갱신
    this.updateShields();
  }

  /**
   * 아래 4개 방패 선택지 구성
   * (현재 떨어지는 단어들의 올바른 뜻은 무조건 포함하고, 나머지는 풀에서 채움)
   */
  updateShields() {
    const requiredWords = this.activeWords.map(w => w.wordObj);
    const existingShieldWordIds = this.shields.map(s => s.wordObj.id);

    // 현재 필수 단어들이 모두 방패에 포함되어 있는지 확인
    const allRequiredPresent = requiredWords.every(rw => existingShieldWordIds.includes(rw.id));

    if (allRequiredPresent && this.shields.length === 4) {
      this.renderShieldsUI();
      return;
    }

    // 새로운 4개 방패 조합 생성
    const newShieldWords = [...requiredWords];
    const otherPool = this.allPool.filter(w => !requiredWords.some(rw => rw.id === w.id));
    const shuffledOthers = [...otherPool].sort(() => Math.random() - 0.5);

    while (newShieldWords.length < 4 && shuffledOthers.length > 0) {
      newShieldWords.push(shuffledOthers.pop());
    }

    // 4개 방패 셔플
    this.shields = newShieldWords.sort(() => Math.random() - 0.5).map((w, idx) => ({
      slot: idx,
      wordObj: w,
      meaning: w.meaning
    }));

    this.renderShieldsUI();
  }

  renderGameField() {
    this.container.innerHTML = `
      <div class="max-w-3xl mx-auto flex flex-col items-center select-none" id="speed-drop-root">
        <!-- 상단 헤더: 하트, 콤보, 점수 -->
        <div class="w-full flex items-center justify-between mb-3 px-4 py-2.5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-1 text-xl" id="drop-lives">
              ${'❤️'.repeat(this.lives)}${'🖤'.repeat(3 - this.lives)}
            </div>
            <div id="drop-combo-badge" class="${this.combo > 1 ? '' : 'hidden'} px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-black text-xs animate-bounce shadow">
              🔥 <span id="drop-combo-num">${this.combo}</span> 콤보!
            </div>
          </div>

          <div class="flex items-center gap-4">
            <span class="text-xs text-slate-400 font-semibold hidden sm:inline">단어를 방패로 드래그하세요! 🛡️</span>
            <div class="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono" id="drop-score">
              ${this.score} 점
            </div>
          </div>
        </div>

        <!-- 게임 경기장 (Game Arena) -->
        <div id="drop-arena" class="relative w-full h-[480px] sm:h-[520px] bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950/80 rounded-3xl overflow-hidden border-2 border-slate-700 shadow-2xl touch-none">
          <!-- 밤하늘 별빛 및 기사 격자 배경 -->
          <div class="absolute inset-0 bg-[radial-gradient(#475569_1px,transparent_1px)] [background-size:24px_24px] opacity-30"></div>
          
          <!-- 상단 성벽 처마 장식 -->
          <div class="absolute top-0 left-0 right-0 h-4 bg-slate-800/80 border-b border-indigo-500/30 flex justify-around">
            <div class="w-4 h-full bg-slate-700"></div>
            <div class="w-4 h-full bg-slate-700"></div>
            <div class="w-4 h-full bg-slate-700"></div>
            <div class="w-4 h-full bg-slate-700"></div>
            <div class="w-4 h-full bg-slate-700"></div>
          </div>

          <!-- 떨어지는 단어들이 렌더링되는 레이어 -->
          <div id="drop-falling-layer" class="absolute inset-0 pointer-events-none"></div>

          <!-- 위험 바닥 라인 (성벽 지상 라인) -->
          <div class="absolute bottom-[115px] sm:bottom-[130px] left-0 right-0 h-2 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500 opacity-60"></div>

          <!-- 하단 방패 4개 도크 (Shield Dock) -->
          <div class="absolute bottom-2 left-2 right-2 h-[105px] sm:h-[120px] grid grid-cols-4 gap-2 sm:gap-3" id="drop-shields-dock">
            <!-- 4개 방패가 renderShieldsUI()에 의해 들어감 -->
          </div>
        </div>
      </div>
    `;

    this.renderShieldsUI();
  }

  /**
   * 4개 방패 UI 렌더링
   */
  renderShieldsUI() {
    const dock = document.getElementById('drop-shields-dock');
    if (!dock) return;

    // 4가지 방패 문양 및 컬러
    const shieldDesigns = [
      { name: '사자 방패', color: 'from-amber-600 to-red-700', border: 'border-amber-400', icon: '🦁' },
      { name: '용 방패', color: 'from-indigo-600 to-purple-800', border: 'border-indigo-400', icon: '🐉' },
      { name: '독수리 방패', color: 'from-sky-600 to-blue-800', border: 'border-sky-400', icon: '🦅' },
      { name: '십자 방패', color: 'from-emerald-600 to-teal-800', border: 'border-emerald-400', icon: '✝️' }
    ];

    dock.innerHTML = this.shields.map((shield, idx) => {
      const design = shieldDesigns[idx % shieldDesigns.length];
      return `
        <div data-shield-idx="${idx}" data-word-id="${shield.wordObj.id}" class="shield-target group relative w-full h-full bg-slate-900/90 hover:bg-slate-800/90 rounded-2xl border-2 ${design.border} flex flex-col items-center justify-between p-2 cursor-pointer transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg backdrop-blur overflow-hidden">
          
          <!-- 방패 그래픽 헤더 -->
          <div class="w-full flex items-center justify-center gap-1.5 pt-0.5">
            <span class="text-sm sm:text-base">${design.icon}</span>
            <!-- 미니 방패 SVG 뱃지 -->
            <svg width="18" height="22" viewBox="0 0 24 28" fill="none" class="drop-shadow">
              <path d="M12 2 L22 6 L22 16 Q22 24 12 27 Q2 24 2 16 L2 6 Z" class="fill-current text-white/30" stroke="#fff" stroke-width="1.5" />
            </svg>
          </div>

          <!-- 방패 아래 적힌 단어의 '뜻' (핵심) + 그림 썸네일 -->
          <div class="my-auto text-center w-full px-0.5 sm:px-1 flex flex-col items-center justify-center gap-1">
            ${(typeof StorageManager !== 'undefined' && StorageManager.shouldShowPhoto(shield.wordObj)) ? `
              <div class="w-7 h-7 sm:w-9 sm:h-9 rounded-lg overflow-hidden border border-white/20 bg-black/40 flex items-center justify-center p-0.5">
                <img src="${shield.wordObj.imageUrl}" alt="${shield.meaning}" onerror="this.parentElement.style.display='none'" class="w-full h-full object-contain">
              </div>
            ` : ''}
            <p class="text-[10px] sm:text-xs font-black text-white leading-tight break-keep line-clamp-2 drop-shadow-md">
              ${shield.meaning}
            </p>
          </div>

          <!-- 하단 슬롯 표시바 -->
          <div class="w-full h-1 bg-gradient-to-r ${design.color} rounded-full"></div>
        </div>
      `;
    }).join('');
  }

  /**
   * 경기장 인터랙션 이벤트 바인딩 (마우스 & 터치 드래그 + 클릭)
   */
  bindArenaEvents() {
    const arena = document.getElementById('drop-arena');
    if (!arena) return;

    // 포인터 다운 (단어 터치/클릭 시작)
    arena.addEventListener('pointerdown', (e) => {
      const wordEl = e.target.closest('.falling-word-box');
      if (wordEl) {
        const wordId = wordEl.dataset.wordId;
        const targetWord = this.activeWords.find(w => w.id === wordId);
        if (targetWord) {
          e.preventDefault();
          this.draggingWord = targetWord;
          targetWord.isDragging = true;
          this.selectedWord = targetWord;

          const arenaRect = arena.getBoundingClientRect();
          this.arenaRect = arenaRect;
          this.dragOffset = {
            x: e.clientX - arenaRect.left,
            y: e.clientY - arenaRect.top
          };
          targetWord.dragPosX = this.dragOffset.x;
          targetWord.dragPosY = this.dragOffset.y;

          SoundManager.speak(targetWord.wordObj.word, targetWord.wordObj.audioUrl);
          wordEl.classList.add('scale-110', 'ring-4', 'ring-amber-400', 'z-40');
        }
        return;
      }

      // 클릭 방식으로 방패를 탭한 경우 (단어가 선택되어 있을 때)
      const shieldEl = e.target.closest('.shield-target');
      if (shieldEl && this.selectedWord) {
        const shieldWordId = shieldEl.dataset.wordId;
        this.evaluateMatch(this.selectedWord, shieldWordId, shieldEl);
        this.selectedWord = null;
      }
    });

    // 포인터 이동 (드래그)
    window.addEventListener('pointermove', (e) => {
      if (!this.draggingWord || !this.arenaRect) return;
      const arena = document.getElementById('drop-arena');
      if (!arena) return;

      const arenaRect = arena.getBoundingClientRect();
      const currentX = e.clientX - arenaRect.left;
      const currentY = e.clientY - arenaRect.top;

      this.draggingWord.dragPosX = currentX;
      this.draggingWord.dragPosY = currentY;

      // 마우스 오버된 방패 시각 피드백
      document.querySelectorAll('.shield-target').forEach(shieldEl => {
        const sRect = shieldEl.getBoundingClientRect();
        if (e.clientX >= sRect.left && e.clientX <= sRect.right && e.clientY >= sRect.top && e.clientY <= sRect.bottom) {
          shieldEl.classList.add('ring-4', 'ring-amber-300', 'scale-105');
        } else {
          shieldEl.classList.remove('ring-4', 'ring-amber-300', 'scale-105');
        }
      });
    });

    // 포인터 업 (드롭 완료)
    window.addEventListener('pointerup', (e) => {
      if (!this.draggingWord) return;
      const droppedWord = this.draggingWord;
      this.draggingWord = null;
      droppedWord.isDragging = false;

      // 하이라이트 해제
      document.querySelectorAll('.shield-target').forEach(el => el.classList.remove('ring-4', 'ring-amber-300', 'scale-105'));

      // 어떤 방패 위에 드롭되었는지 확인
      let matchedShield = null;
      document.querySelectorAll('.shield-target').forEach(shieldEl => {
        const sRect = shieldEl.getBoundingClientRect();
        if (e.clientX >= sRect.left && e.clientX <= sRect.right && e.clientY >= sRect.top && e.clientY <= sRect.bottom) {
          matchedShield = shieldEl;
        }
      });

      if (matchedShield) {
        const targetWordId = matchedShield.dataset.wordId;
        this.evaluateMatch(droppedWord, targetWordId, matchedShield);
      } else {
        // 방패 밖으로 떨어뜨린 경우 원래 위치로 복귀
        const wordEl = document.querySelector(`[data-word-id="${droppedWord.id}"]`);
        if (wordEl) {
          wordEl.classList.remove('scale-110', 'ring-4', 'ring-amber-400', 'z-40');
        }
      }
    });
  }

  /**
   * 방패 매칭 판정 (정답 vs 오답)
   */
  evaluateMatch(droppedItem, shieldWordId, shieldEl) {
    const isCorrect = droppedItem.wordObj.id === shieldWordId;

    if (isCorrect) {
      // 정답! 방패 수호 성공
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const comboBonus = (this.combo - 1) * 20;
      const points = 100 + comboBonus;
      this.score += points;

      StorageManager.updateWordMastery(droppedItem.wordObj.id, 'game_correct', { combo: this.combo });
      StorageManager.markMemorized(droppedItem.wordObj.id, true);
      SoundManager.playTone('correct');

      // 방패 정답 이펙트
      if (shieldEl) {
        shieldEl.classList.add('bg-emerald-500', 'ring-4', 'ring-emerald-300', 'scale-110');
        setTimeout(() => {
          shieldEl.classList.remove('bg-emerald-500', 'ring-4', 'ring-emerald-300', 'scale-110');
        }, 400);
      }

      // 화면에서 단어 제거
      this.removeWord(droppedItem.id);
    } else {
      // 오답! 잘못된 방패에 투입
      this.combo = 0;
      this.lives--;
      StorageManager.updateWordMastery(droppedItem.wordObj.id, 'game_wrong');
      StorageManager.recordMistake(droppedItem.wordObj.id);
      SoundManager.playTone('wrong');

      // 방패 오답 흔들림 이펙트
      if (shieldEl) {
        shieldEl.classList.add('bg-rose-600', 'animate-shake');
        setTimeout(() => {
          shieldEl.classList.remove('bg-rose-600', 'animate-shake');
        }, 500);
      }

      this.removeWord(droppedItem.id);

      if (this.lives <= 0) {
        this.gameOver();
        return;
      }
    }

    this.updateStatsUI();
  }

  removeWord(itemId) {
    this.activeWords = this.activeWords.filter(w => w.id !== itemId);
    if (this.selectedWord && this.selectedWord.id === itemId) {
      this.selectedWord = null;
    }
    // 남아있는 단어를 커버하도록 방패 갱신
    this.updateShields();
  }

  updateStatsUI() {
    const livesEl = document.getElementById('drop-lives');
    const scoreEl = document.getElementById('drop-score');
    const comboBadge = document.getElementById('drop-combo-badge');
    const comboNum = document.getElementById('drop-combo-num');

    if (livesEl) livesEl.innerText = '❤️'.repeat(this.lives) + '🖤'.repeat(3 - this.lives);
    if (scoreEl) scoreEl.innerText = `${this.score} 점`;

    if (comboBadge && comboNum) {
      if (this.combo > 1) {
        comboBadge.classList.remove('hidden');
        comboNum.innerText = this.combo;
      } else {
        comboBadge.classList.add('hidden');
      }
    }
  }

  /**
   * 메인 게임 루프 (단어 낙하 및 렌더링)
   */
  loop(timestamp) {
    if (!this.isPlaying) return;

    // 최대 2개 동시 낙하 스폰 타이머 체크
    if (this.activeWords.length < 2 && (timestamp - this.lastSpawnTime >= this.spawnInterval)) {
      this.spawnWord();
    } else if (this.activeWords.length === 0) {
      this.spawnWord();
    }

    const arena = document.getElementById('drop-arena');
    const fallingLayer = document.getElementById('drop-falling-layer');

    if (arena && fallingLayer) {
      const arenaH = arena.clientHeight;
      const arenaW = arena.clientWidth;

      // 바닥 충돌 한계선 (방패 바로 위 지점: 약 76%)
      const bottomLimitY = 75;

      for (let i = this.activeWords.length - 1; i >= 0; i--) {
        const item = this.activeWords[i];

        if (!item.isDragging) {
          item.y += item.speed;

          // 바닥 충돌 판정 (방패에 넣지 못하고 지면에 추락)
          if (item.y >= bottomLimitY) {
            this.lives--;
            this.combo = 0;
            StorageManager.updateWordMastery(item.wordObj.id, 'game_wrong');
            StorageManager.recordMistake(item.wordObj.id);
            SoundManager.playTone('wrong');

            arena.classList.add('border-rose-500');
            setTimeout(() => arena.classList.remove('border-rose-500'), 300);

            this.activeWords.splice(i, 1);
            this.updateStatsUI();
            this.updateShields();

            if (this.lives <= 0) {
              this.gameOver();
              return;
            }
            continue;
          }
        }
      }

      // 떨어지는 단어 DOM 렌더링
      this.renderFallingWords(fallingLayer, arenaW, arenaH);
    }

    this.animationFrame = requestAnimationFrame((ts) => this.loop(ts));
  }

  /**
   * 하늘에서 떨어지는 단어 박스들 렌더링
   */
  renderFallingWords(layer, arenaW, arenaH) {
    layer.innerHTML = this.activeWords.map(item => {
      const isSelected = this.selectedWord && this.selectedWord.id === item.id;
      let leftStyle = `${item.x}%`;
      let topStyle = `${item.y}%`;

      if (item.isDragging) {
        // 드래그 중일 때는 마우스/터치 위치를 따라감
        leftStyle = `${item.dragPosX - 60}px`;
        topStyle = `${item.dragPosY - 25}px`;
      }

      return `
        <div data-word-id="${item.id}"
             class="falling-word-box pointer-events-auto absolute flex items-center justify-center px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 text-white font-extrabold text-base sm:text-lg shadow-2xl border-2 cursor-grab active:cursor-grabbing transition-shadow ${isSelected ? 'border-amber-400 ring-4 ring-amber-400/60 scale-105' : 'border-white/40'} ${item.isDragging ? 'opacity-90 scale-110 z-50' : ''}"
             style="left: ${leftStyle}; top: ${topStyle}; touch-action: none;">
          <span class="mr-1.5 text-xs opacity-75">⚔️</span>
          <span>${item.wordObj.word}</span>
        </div>
      `;
    }).join('');
  }

  gameOver() {
    this.isPlaying = false;
    cancelAnimationFrame(this.animationFrame);
    SoundManager.playTone('wrong');

    this.container.innerHTML = `
      <div class="max-w-md mx-auto text-center py-8 px-6 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700">
        <div class="text-6xl mb-3">💥</div>
        <h2 class="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">방패 방어선 붕괴!</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">하트를 모두 소진하였습니다. 다시 방패를 들어 도전해보세요!</p>

        <div class="grid grid-cols-2 gap-3 mb-6">
          <div class="p-4 bg-slate-50 dark:bg-slate-750 rounded-2xl">
            <div class="text-xs text-slate-400 mb-0.5">최종 점수</div>
            <div class="text-3xl font-black text-rose-500 font-mono">${this.score} 점</div>
          </div>
          <div class="p-4 bg-slate-50 dark:bg-slate-750 rounded-2xl">
            <div class="text-xs text-slate-400 mb-0.5">최대 연속 콤보</div>
            <div class="text-3xl font-black text-amber-500 font-mono">${this.maxCombo} 회</div>
          </div>
        </div>

        <div class="flex flex-col gap-2.5">
          <button id="drop-retry-btn" class="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-700 hover:to-rose-700 text-white font-black rounded-xl shadow-lg shadow-indigo-500/30 transition">
            다시 방패 들기 🛡️
          </button>
          <button onclick="window.switchTab('flashcard')" class="w-full py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition">
            플래시카드로 가기
          </button>
        </div>
      </div>
    `;

    const retryBtn = document.getElementById('drop-retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', () => this.startGame());
  }

  stop() {
    this.isPlaying = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.draggingWord = null;
    this.selectedWord = null;
    this.activeWords = [];
  }
}
