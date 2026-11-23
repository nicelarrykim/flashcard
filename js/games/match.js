// js/games/match.js
// 칼(공격/영단어 8개) vs 방패(방어/한글뜻 8개) 실시간 배틀 짝맞추기 게임 모듈
// 카드는 모두 오픈 상태이며, 정답 매칭 시 방어 효과와 함께 새 단어가 보충되어 8:8 랜덤 재배치됨

import { StorageManager } from '../storage.js?v=20261123_19';
import { SoundManager } from '../tts.js?v=20261123_19';

export class MatchGame {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.allPool = [];           // 전체 학습 단어 풀
    this.remainingPool = [];      // 아직 등장하지 않은 대기 단어 풀
    this.activeWords = [];       // 현재 필드에 활성화된 단어 8개
    this.leftDeck = [];          // 좌측 영어단어 카드 (칼 ⚔️) 8개
    this.rightDeck = [];         // 우측 한국어뜻 카드 (방패 🛡️) 8개
    this.selectedLeft = null;    // 선택된 좌측 카드
    this.selectedRight = null;   // 선택된 우측 카드
    this.lives = 3;              // 하트 3개
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.matchedCount = 0;
    this.isMobile = this.checkIsMobile();
    this.targetCount = this.isMobile ? 6 : 8;        // 모바일은 6:6, PC는 8:8
    this.isProcessing = false;   // 판정 중 클릭 방지
    this.timer = null;
    this.pendingTimers = [];
    this.seconds = 0;
    this.isPlaying = false;
  }

  checkIsMobile() {
    return window.innerWidth < 640 || /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  init() {
    this.isMobile = this.checkIsMobile();
    this.targetCount = this.isMobile ? 6 : 8;
    this.container = this.container || document.getElementById(this.containerId);
    this.renderStartScreen();
  }

  renderStartScreen() {
    this.isMobile = this.checkIsMobile();
    this.targetCount = this.isMobile ? 6 : 8;
    this.container = this.container || document.getElementById(this.containerId);
    if (!this.container) return;

    const mgr = (typeof StorageManager !== 'undefined' && typeof StorageManager?.getActiveDeck === 'function')
      ? StorageManager
      : (window.StorageManager || null);
    const studyWords = StorageManager.getStudyWords ? StorageManager.getStudyWords() : (mgr?.getWords?.() || []);
    const activeDeck = mgr?.getActiveDeck?.() || { name: '기본 단어장' };
    const canPlay = studyWords.length >= this.targetCount || (mgr?.getWords?.() || []).length >= this.targetCount;
    const modeTitle = `${this.targetCount}:${this.targetCount}`;

    this.container.innerHTML = `
      <div class="max-w-md mx-auto text-center py-8 sm:py-10 px-4 sm:px-6 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700">
        <div class="text-5xl sm:text-6xl mb-3 sm:mb-4">⚔️🛡️</div>
        <div class="inline-block px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-black mb-3">
          📖 단어장: ${activeDeck?.name || '기본 단어장'} (${studyWords.length}단어)
        </div>
        <h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-2">칼 & 방패 짝맞추기</h2>
        <div class="inline-block px-2.5 py-0.5 rounded-full ${this.isMobile ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300' : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300'} text-[11px] font-bold mb-3">
          ${this.isMobile ? '📱 모바일 최적화 6:6 모드' : '💻 PC 와이드 8:8 모드'}
        </div>
        <p class="text-slate-500 dark:text-slate-400 mb-6 text-xs sm:text-sm leading-relaxed">
          카드는 <strong>모두 오픈</strong>되어 있습니다!<br>
          <strong>좌측 칼(영단어) ${this.targetCount}개</strong>와 <strong>우측 방패(뜻) ${this.targetCount}개</strong>를 매칭하세요.<br>
          맞추면 방어 효과와 함께 새 단어가 보충되며 <strong>랜덤 재배치</strong>됩니다.<br>
          <span class="text-rose-500 font-bold">오답 시 하트가 1개씩 줄어듭니다!</span>
        </p>

        ${!canPlay ? `
          <div class="p-4 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-2xl text-xs sm:text-sm mb-4">
            ${modeTitle} 배틀을 진행하려면 최소 ${this.targetCount}개 이상의 단어가 필요합니다. 단어장에서 단어를 추가해주세요.
          </div>
        ` : `
          <button id="match-start-btn" class="w-full py-3.5 sm:py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-600 hover:from-indigo-700 hover:to-rose-700 text-white font-black text-base sm:text-lg rounded-2xl shadow-lg shadow-indigo-500/30 transition transform hover:-translate-y-0.5 active:translate-y-0">
            ${modeTitle} 짝맞추기 시작 ⚔️🛡️
          </button>
        `}
      </div>
    `;

    const startBtn = document.getElementById('match-start-btn');
    if (startBtn) startBtn.addEventListener('click', () => this.startGame());
  }

  startGame() {
    this.isMobile = this.checkIsMobile();
    this.targetCount = this.isMobile ? 6 : 8;

    let pool = StorageManager.getStudyWords ? StorageManager.getStudyWords() : StorageManager.getWords();
    if (pool.length < this.targetCount) {
      pool = StorageManager.getActiveWords ? StorageManager.getActiveWords() : StorageManager.getWords();
    }
    if (pool.length < this.targetCount) return;

    this.allPool = [...pool].sort(() => Math.random() - 0.5);
    this.remainingPool = [...this.allPool];

    // 초기 targetCount개 단어 추출
    this.activeWords = this.remainingPool.splice(0, this.targetCount);
    this.buildDecks();

    this.lives = 3;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.matchedCount = 0;
    this.seconds = 0;
    this.selectedLeft = null;
    this.selectedRight = null;
    this.isProcessing = false;
    this.isPlaying = true;

    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.seconds++;
      const timerEl = document.getElementById('match-timer');
      if (timerEl) {
        const mins = String(Math.floor(this.seconds / 60)).padStart(2, '0');
        const secs = String(this.seconds % 60).padStart(2, '0');
        timerEl.innerText = `${mins}:${secs}`;
      }
    }, 1000);

    this.renderBoard();
  }

  /**
   * activeWords로부터 좌측(칼) 8개와 우측(방패) 8개를 각각 독립적으로 랜덤 셔플
   */
  buildDecks() {
    // 좌측: 영단어 카드 (칼 ⚔️)
    this.leftDeck = [...this.activeWords].sort(() => Math.random() - 0.5).map(w => ({
      id: `word_${w.id}`,
      wordId: w.id,
      text: w.word,
      subtext: w.partOfSpeech || 'word',
      phonetic: w.phonetic || '',
      audioUrl: w.audioUrl,
      wordObj: w
    }));

    // 우측: 한국어 뜻 카드 (방패 🛡️)
    this.rightDeck = [...this.activeWords].sort(() => Math.random() - 0.5).map(w => ({
      id: `meaning_${w.id}`,
      wordId: w.id,
      text: w.meaning,
      subtext: w.partOfSpeech || '뜻',
      wordObj: w
    }));
  }

  renderBoard() {
    this.container.innerHTML = `
      <div class="max-w-4xl mx-auto flex flex-col items-center select-none w-full px-0.5 sm:px-0">
        
        <!-- 상단 헤더: 하트, 점수, 콤보, 타이머 (모바일에서 줄바꿈 대응 및 가로스크롤 방지) -->
        <div class="w-full flex flex-wrap items-center justify-between gap-2 mb-3 sm:mb-4 px-3 sm:px-4 py-2 sm:py-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-xs sm:text-sm">
          <div class="flex items-center gap-2 sm:gap-3">
            <div class="flex items-center gap-0.5 sm:gap-1 text-base sm:text-xl" id="match-lives">
              ${'❤️'.repeat(this.lives)}${'🖤'.repeat(3 - this.lives)}
            </div>
            <div id="match-combo-badge" class="${this.combo > 1 ? '' : 'hidden'} px-2 py-0.5 rounded-full bg-amber-500 text-white font-black text-[10px] sm:text-xs animate-bounce shadow">
              🔥 <span id="match-combo-num">${this.combo}</span> 콤보!
            </div>
          </div>

          <div class="flex items-center gap-2.5 sm:gap-4">
            <div class="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400">
              격파: <strong class="text-emerald-600 font-mono text-xs sm:text-sm" id="match-count">${this.matchedCount}</strong>개
              <span class="text-slate-400 font-normal">/ 대기 ${this.remainingPool.length}</span>
            </div>
            <div class="text-sm sm:text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono" id="match-score">
              ${this.score} 점
            </div>
            <span class="text-[11px] sm:text-xs font-mono font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
              <span>⏱️</span> <span id="match-timer">00:00</span>
            </span>
            <button id="match-restart-btn" class="p-1 sm:p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition" title="다시 시작">
              🔄
            </button>
          </div>
        </div>

        <!-- ${this.targetCount}:${this.targetCount} 배틀 필드 (좌측 칼 ⚔️ vs 우측 방패 🛡️) -->
        <div class="w-full grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4 relative" id="match-battlefield">
          
          <!-- 좌측 컬럼: 공격측 칼 (영단어 ${this.targetCount}개) -->
          <div class="bg-gradient-to-b from-rose-50/50 to-orange-50/30 dark:from-rose-950/20 dark:to-slate-900/40 p-2 sm:p-4 rounded-2xl sm:rounded-3xl border-2 border-rose-200 dark:border-rose-900/40 shadow-sm sm:shadow-md">
            <div class="flex items-center justify-between mb-2 sm:mb-3 px-1">
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 sm:py-1 rounded-full bg-rose-500 text-white text-[11px] sm:text-xs font-black shadow-sm">
                <span>⚔️</span> <span>공격측 (영어 단어)</span>
              </span>
              <span class="text-[11px] sm:text-xs text-rose-600 dark:text-rose-400 font-bold">${this.leftDeck.length} / ${this.targetCount}</span>
            </div>

            <!-- 좌측 2x${this.targetCount/2} 카드 그리드 -->
            <div class="grid grid-cols-2 gap-1.5 sm:gap-2.5" id="match-left-grid">
              ${this.leftDeck.map((card, idx) => {
                const isSelected = this.selectedLeft && this.selectedLeft.id === card.id;
                return `
                  <button data-card-id="${card.id}" data-type="word" data-idx="${idx}" class="match-card-btn group relative w-full h-16 sm:h-24 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-left border-2 transition-all transform hover:-translate-y-0.5 active:scale-95 shadow-sm flex flex-col justify-between overflow-hidden ${isSelected ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/70 ring-4 ring-rose-400/50 scale-105 z-20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-rose-300 dark:hover:border-rose-700'}">
                    
                    <div class="flex items-center justify-between w-full">
                      <span class="text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                        ⚔️ 칼
                      </span>
                      <span class="text-[9px] sm:text-[10px] font-mono text-slate-400">${card.subtext}</span>
                    </div>

                    <div class="my-auto w-full">
                      <div class="font-black text-xs sm:text-base text-slate-900 dark:text-white truncate">
                        ${card.text}
                      </div>
                      ${card.phonetic ? `<div class="text-[9px] font-mono text-slate-400 truncate hidden sm:block">${card.phonetic}</div>` : ''}
                    </div>

                    <!-- 밑줄 포인트 -->
                    <div class="w-full h-0.5 sm:h-1 bg-gradient-to-r from-rose-500 to-amber-500 rounded-full opacity-60"></div>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- 우측 컬럼: 방어측 방패 (한국어 뜻 ${this.targetCount}개) -->
          <div class="bg-gradient-to-b from-sky-50/50 to-indigo-50/30 dark:from-sky-950/20 dark:to-slate-900/40 p-2 sm:p-4 rounded-2xl sm:rounded-3xl border-2 border-sky-200 dark:border-sky-900/40 shadow-sm sm:shadow-md">
            <div class="flex items-center justify-between mb-2 sm:mb-3 px-1">
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 sm:py-1 rounded-full bg-sky-600 text-white text-[11px] sm:text-xs font-black shadow-sm">
                <span>🛡️</span> <span>방어측 (단어 뜻)</span>
              </span>
              <span class="text-[11px] sm:text-xs text-sky-600 dark:text-sky-400 font-bold">${this.rightDeck.length} / ${this.targetCount}</span>
            </div>

            <!-- 우측 2x${this.targetCount/2} 카드 그리드 -->
            <div class="grid grid-cols-2 gap-1.5 sm:gap-2.5" id="match-right-grid">
              ${this.rightDeck.map((card, idx) => {
                const isSelected = this.selectedRight && this.selectedRight.id === card.id;
                return `
                  <button data-card-id="${card.id}" data-type="meaning" data-idx="${idx}" class="match-card-btn group relative w-full h-16 sm:h-24 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-left border-2 transition-all transform hover:-translate-y-0.5 active:scale-95 shadow-sm flex flex-col justify-between overflow-hidden ${isSelected ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/70 ring-4 ring-sky-400/50 scale-105 z-20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-sky-300 dark:hover:border-sky-700'}">
                    
                    <div class="flex items-center justify-between w-full">
                      <span class="text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-1 py-0.2 sm:px-1.5 sm:py-0.5 rounded bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300">
                        🛡️ 방패
                      </span>
                      <span class="text-[9px] sm:text-[10px] font-semibold text-slate-400">의미</span>
                    </div>

                    ${StorageManager.shouldShowPhoto(card.wordObj) ? `
                      <div class="flex items-center gap-1.5 sm:gap-2 my-auto w-full">
                        <div class="w-7 h-7 sm:w-9 sm:h-9 shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-0.5">
                          <img src="${card.wordObj.imageUrl}" alt="${card.text}" onerror="this.parentElement.style.display='none'" class="w-full h-full object-contain">
                        </div>
                        <div class="font-extrabold text-[10px] sm:text-xs text-slate-800 dark:text-slate-100 line-clamp-2 break-keep leading-tight flex-1">
                          ${card.text}
                        </div>
                      </div>
                    ` : `
                      <div class="my-auto w-full">
                        <div class="font-extrabold text-[11px] sm:text-sm text-slate-800 dark:text-slate-100 line-clamp-2 break-keep leading-tight sm:leading-snug">
                          ${card.text}
                        </div>
                      </div>
                    `}

                    <!-- 밑줄 포인트 -->
                    <div class="w-full h-0.5 sm:h-1 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full opacity-60"></div>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- 중앙 격돌/방어 효과 오버레이 레이어 -->
          <div id="match-clash-overlay" class="pointer-events-none absolute inset-0 flex items-center justify-center z-50 hidden">
            <!-- 팝업 방어 이펙트 -->
            <div id="match-clash-banner" class="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-emerald-500 text-white font-black text-xl shadow-2xl flex items-center gap-3 transform scale-90 transition-transform">
              <span>💥</span>
              <span>방어 성공! (SHIELD BLOCKED!)</span>
              <span>🛡️</span>
            </div>
          </div>

        </div>

      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const restartBtn = document.getElementById('match-restart-btn');
    if (restartBtn) restartBtn.addEventListener('click', () => this.startGame());

    // 카드 버튼 클릭 이벤트 바인딩
    this.container.querySelectorAll('.match-card-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.isProcessing || !this.isPlaying) return;
        const type = btn.dataset.type;
        const cardId = btn.dataset.cardId;

        if (type === 'word') {
          // 좌측 카드 선택
          const targetCard = this.leftDeck.find(c => c.id === cardId);
          if (this.selectedLeft && this.selectedLeft.id === cardId) {
            this.selectedLeft = null; // 선택 취소
          } else {
            this.selectedLeft = targetCard;
            SoundManager.speak(targetCard.text, targetCard.audioUrl);
          }
        } else if (type === 'meaning') {
          // 우측 카드 선택
          const targetCard = this.rightDeck.find(c => c.id === cardId);
          if (this.selectedRight && this.selectedRight.id === cardId) {
            this.selectedRight = null; // 선택 취소
          } else {
            this.selectedRight = targetCard;
            SoundManager.playTone('flip');
          }
        }

        // 양쪽 모두 선택되었으면 매칭 판정 실행
        if (this.selectedLeft && this.selectedRight) {
          this.evaluateMatch();
        } else {
          this.renderBoard();
        }
      });
    });
  }

  /**
   * 매칭 판정 (정답 vs 오답)
   */
  evaluateMatch() {
    this.isProcessing = true;
    const left = this.selectedLeft;
    const right = this.selectedRight;
    const isCorrect = left.wordId === right.wordId;

    const leftBtn = document.querySelector(`[data-card-id="${left.id}"]`);
    const rightBtn = document.querySelector(`[data-card-id="${right.id}"]`);

    if (isCorrect) {
      // 1. 방어 효과 발생! (칼을 방패로 막아내며 수호 성공)
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.matchedCount++;
      const points = 100 + (this.combo - 1) * 20;
      this.score += points;

      StorageManager.updateWordMastery(left.wordId, 'game_correct', { combo: this.combo });
      StorageManager.markMemorized(left.wordId, true);
      SoundManager.playTone('correct');

      // 방어 이펙트 시각화
      if (leftBtn) leftBtn.classList.add('bg-emerald-500', 'border-emerald-400', 'text-white', 'scale-105');
      if (rightBtn) rightBtn.classList.add('bg-emerald-500', 'border-emerald-400', 'text-white', 'scale-105');

      this.showClashEffect(true, left.text, right.text);

      const t1 = setTimeout(() => {
        if (!this.isPlaying) return;
        // 맞춘 단어 제거
        this.activeWords = this.activeWords.filter(w => w.id !== left.wordId);

        // 새 단어가 대기 풀에 있다면 보충하여 8개 유지
        if (this.remainingPool.length > 0) {
          const newWord = this.remainingPool.shift();
          this.activeWords.push(newWord);
        }

        // 게임 종료 체크 (남은 활성 단어가 0개일 때)
        if (this.activeWords.length === 0) {
          this.endGame();
          return;
        }

        // 단어와 뜻이 각 영역 내에서 위치가 랜덤으로 다시 조절됨!
        this.buildDecks();
        this.selectedLeft = null;
        this.selectedRight = null;
        this.isProcessing = false;
        this.renderBoard();
      }, 550);
      this.pendingTimers.push(t1);

    } else {
      // 2. 오답! 방어 실패 (하트 감소)
      this.combo = 0;
      this.lives--;
      StorageManager.updateWordMastery(left.wordId, 'game_wrong');
      StorageManager.recordMistake(left.wordId);
      SoundManager.playTone('wrong');

      if (leftBtn) leftBtn.classList.add('border-rose-500', 'bg-rose-100', 'dark:bg-rose-950', 'animate-shake');
      if (rightBtn) rightBtn.classList.add('border-rose-500', 'bg-rose-100', 'dark:bg-rose-950', 'animate-shake');

      this.showClashEffect(false);

      const t2 = setTimeout(() => {
        if (!this.isPlaying) return;
        this.selectedLeft = null;
        this.selectedRight = null;
        this.isProcessing = false;

        if (this.lives <= 0) {
          this.gameOver();
        } else {
          this.renderBoard();
        }
      }, 650);
      this.pendingTimers.push(t2);
    }
  }

  /**
   * 중앙 방어 이펙트 (칼과 방패의 격돌)
   */
  showClashEffect(isSuccess, word = '', meaning = '') {
    const overlay = document.getElementById('match-clash-overlay');
    const banner = document.getElementById('match-clash-banner');
    if (!overlay || !banner) return;

    if (isSuccess) {
      banner.className = 'px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 text-white font-black text-lg shadow-2xl flex items-center gap-2.5 animate-bounce';
      banner.innerHTML = `
        <span class="text-2xl">🛡️⚡</span>
        <div>
          <div class="text-xs uppercase tracking-wider text-emerald-100 font-bold">방어 성공!</div>
          <div class="text-base font-black">${word} = ${meaning}</div>
        </div>
        <span class="text-2xl">⚔️</span>
      `;
    } else {
      banner.className = 'px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 text-white font-black text-base shadow-2xl flex items-center gap-2 animate-shake';
      banner.innerHTML = `
        <span class="text-2xl">💔</span>
        <div>
          <div class="text-xs text-rose-100 font-bold">방어 실패! 불일치</div>
          <div class="text-sm font-black">하트가 1개 감소했습니다</div>
        </div>
      `;
    }

    overlay.classList.remove('hidden');
    const t3 = setTimeout(() => {
      overlay.classList.add('hidden');
    }, 500);
    this.pendingTimers.push(t3);
  }

  gameOver() {
    clearInterval(this.timer);
    this.isPlaying = false;
    SoundManager.playTone('wrong');

    this.container.innerHTML = `
      <div class="max-w-md mx-auto text-center py-8 px-6 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700">
        <div class="text-6xl mb-3">💔</div>
        <h2 class="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">방어선 돌파! 게임 오버</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">하트를 모두 소진했습니다. 다시 칼과 방패를 들어 도전해보세요!</p>

        <div class="grid grid-cols-2 gap-3 mb-6 bg-slate-50 dark:bg-slate-750 p-4 rounded-2xl">
          <div>
            <div class="text-xs text-slate-400 mb-1">최종 점수</div>
            <div class="text-2xl font-black text-rose-500 font-mono">${this.score} 점</div>
          </div>
          <div>
            <div class="text-xs text-slate-400 mb-1">맞춘 단어 수</div>
            <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">${this.matchedCount} 개</div>
          </div>
        </div>

        <div class="flex flex-col gap-2.5">
          <button id="match-retry-btn" class="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-rose-600 hover:from-indigo-700 hover:to-rose-700 text-white font-black rounded-xl shadow-lg shadow-indigo-500/30 transition">
            다시 도전하기 ⚔️🛡️
          </button>
          <button onclick="window.switchTab('flashcard')" class="w-full py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition">
            플래시카드로 가기
          </button>
        </div>
      </div>
    `;

    const retryBtn = document.getElementById('match-retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', () => this.startGame());
  }

  endGame() {
    clearInterval(this.timer);
    this.isPlaying = false;
    SoundManager.playTone('fanfare');

    if (typeof window.confetti === 'function') {
      window.confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
    }

    const mins = Math.floor(this.seconds / 60);
    const secs = this.seconds % 60;
    const timeFormatted = mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`;

    this.container.innerHTML = `
      <div class="max-w-md mx-auto text-center py-8 px-6 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700">
        <div class="text-6xl mb-3">🏆</div>
        <h2 class="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">완벽한 방어 성공!</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">모든 단어의 칼을 방패로 완벽하게 막아내어 격파했습니다!</p>

        <div class="grid grid-cols-3 gap-2 mb-6 bg-slate-50 dark:bg-slate-750 p-4 rounded-2xl">
          <div>
            <div class="text-[10px] text-slate-400 mb-1">최종 점수</div>
            <div class="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">${this.score}</div>
          </div>
          <div>
            <div class="text-[10px] text-slate-400 mb-1">소요 시간</div>
            <div class="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">${timeFormatted}</div>
          </div>
          <div>
            <div class="text-[10px] text-slate-400 mb-1">격파 단어</div>
            <div class="text-xl font-black text-amber-500 font-mono">${this.matchedCount}개</div>
          </div>
        </div>

        <div class="flex flex-col gap-2.5">
          <button id="match-retry-btn" class="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-xl shadow-lg shadow-emerald-500/30 transition">
            다음 배틀 플레이 🔀
          </button>
          <button onclick="window.switchTab('performance')" class="w-full py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition">
            개인 성과 확인하기 🛡️
          </button>
        </div>
      </div>
    `;

    const retryBtn = document.getElementById('match-retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', () => this.startGame());
  }

  stop() {
    this.isPlaying = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.pendingTimers && this.pendingTimers.length > 0) {
      this.pendingTimers.forEach(t => clearTimeout(t));
      this.pendingTimers = [];
    }
    this.selectedLeft = null;
    this.selectedRight = null;
    this.isProcessing = false;
  }
}
