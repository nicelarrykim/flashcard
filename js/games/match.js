// js/games/match.js
// 카드 짝맞추기 게임 (Memory Tile Match) 모듈

import { StorageManager } from '../storage.js';
import { SoundManager } from '../tts.js';

export class MatchGame {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.cards = [];
    this.flippedCards = [];
    this.matchedCount = 0;
    this.moves = 0;
    this.timer = null;
    this.seconds = 0;
    this.isPlaying = false;
    this.pairCount = 6; // 한 게임당 6쌍 (총 12장 타일)
  }

  init() {
    this.container = this.container || document.getElementById(this.containerId);
    this.renderStartScreen();
  }

  renderStartScreen() {
    this.container = this.container || document.getElementById(this.containerId);
    if (!this.container) return;
    const allWords = StorageManager.getWords();
    const activeDeck = StorageManager.getActiveDeck();
    const canPlay = allWords.length >= this.pairCount;

    this.container.innerHTML = `
      <div class="max-w-md mx-auto text-center py-10 px-6 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700">
        <div class="text-6xl mb-4">🧩</div>
        <div class="inline-block px-3 py-1 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 text-xs font-black mb-3">
          📖 단어장: ${activeDeck?.name || '기본 단어장'} (${allWords.length}단어)
        </div>
        <h2 class="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">카드 짝맞추기</h2>
        <p class="text-slate-500 dark:text-slate-400 mb-6 text-sm">
          뒤집힌 카드를 클릭하여 <strong>[영어 단어]</strong>와 <strong>[한국어 뜻]</strong> 짝을 찾아보세요!
          최소한의 이동 횟수로 모든 짝을 맞추는 것이 목표입니다.
        </p>

        ${!canPlay ? `
          <div class="p-4 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-2xl text-sm mb-4">
            최소 ${this.pairCount}개 이상의 단어가 필요합니다. 단어장에서 단어를 추가해주세요.
          </div>
        ` : `
          <button id="match-start-btn" class="w-full py-4 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-bold text-lg rounded-2xl shadow-lg shadow-teal-500/30 transition transform hover:-translate-y-0.5 active:translate-y-0">
            게임 시작하기 🃏
          </button>
        `}
      </div>
    `;

    const startBtn = document.getElementById('match-start-btn');
    if (startBtn) startBtn.addEventListener('click', () => this.startGame());
  }

  startGame() {
    const allWords = StorageManager.getWords();
    if (allWords.length < this.pairCount) return;

    // 무작위로 pairCount개의 단어 선정
    const selectedWords = [...allWords].sort(() => Math.random() - 0.5).slice(0, this.pairCount);

    // 각 단어마다 2장의 카드 생성 (영어 카드 1장, 뜻 카드 1장)
    const cardDeck = [];
    selectedWords.forEach((word) => {
      cardDeck.push({
        id: `word_${word.id}`,
        wordId: word.id,
        type: 'word',
        text: word.word,
        subtext: word.phonetic || '',
        imageUrl: word.imageUrl,
        audioUrl: word.audioUrl,
        isFlipped: false,
        isMatched: false
      });
      cardDeck.push({
        id: `meaning_${word.id}`,
        wordId: word.id,
        type: 'meaning',
        text: word.meaning,
        subtext: word.partOfSpeech || '',
        imageUrl: '',
        isFlipped: false,
        isMatched: false
      });
    });

    // 카드 덱 셔플
    this.cards = cardDeck.sort(() => Math.random() - 0.5);
    this.flippedCards = [];
    this.matchedCount = 0;
    this.moves = 0;
    this.seconds = 0;
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

  renderBoard() {
    this.container.innerHTML = `
      <div class="max-w-2xl mx-auto flex flex-col items-center">
        <!-- 상단 대시보드 -->
        <div class="w-full flex items-center justify-between mb-5 px-3 py-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div class="flex items-center gap-4 text-sm font-semibold">
            <span class="text-slate-600 dark:text-slate-300">
              이동: <strong id="match-moves" class="text-indigo-600 dark:text-indigo-400 font-black">${this.moves}</strong>회
            </span>
            <span class="text-slate-600 dark:text-slate-300">
              매칭: <strong class="text-emerald-600 font-black">${this.matchedCount} / ${this.pairCount}</strong>
            </span>
          </div>

          <div class="flex items-center gap-3">
            <span class="text-sm font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <span>⏱️</span> <span id="match-timer">00:00</span>
            </span>
            <button id="match-restart-btn" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition" title="다시 시작">
              🔄
            </button>
          </div>
        </div>

        <!-- 3x4 카드 격자판 -->
        <div class="grid grid-cols-3 sm:grid-cols-4 gap-3 w-full" id="match-grid">
          ${this.cards.map((card, idx) => `
            <div data-index="${idx}" class="match-card h-28 sm:h-32 perspective-1000 cursor-pointer select-none">
              <div class="match-card-inner relative w-full h-full duration-300 transform-style-preserve-3d rounded-2xl shadow-md transition-transform ${card.isFlipped || card.isMatched ? 'rotate-y-180' : ''}">
                
                <!-- 카드 뒷면 (가려진 상태) -->
                <div class="absolute inset-0 w-full h-full backface-hidden bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white border-2 border-indigo-400 shadow hover:opacity-95 transition">
                  <span class="text-2xl font-black opacity-70">?</span>
                </div>

                <!-- 카드 앞면 (열린 상태) -->
                <div class="absolute inset-0 w-full h-full backface-hidden rotate-y-180 rounded-2xl p-2.5 flex flex-col items-center justify-center text-center border-2 transition ${card.isMatched ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-400 text-emerald-800 dark:text-emerald-200 opacity-80' : 'bg-white dark:bg-slate-800 border-indigo-300 dark:border-indigo-700 text-slate-800 dark:text-white'}">
                  ${card.type === 'word' ? `
                    <span class="text-xs uppercase tracking-wider text-indigo-500 font-bold mb-1">EN</span>
                    <span class="font-extrabold text-sm sm:text-base leading-tight">${card.text}</span>
                    ${card.subtext ? `<span class="text-[10px] text-slate-400 font-mono mt-0.5">${card.subtext}</span>` : ''}
                  ` : `
                    <span class="text-xs uppercase tracking-wider text-purple-500 font-bold mb-1">뜻</span>
                    <span class="font-bold text-sm sm:text-base leading-tight">${card.text}</span>
                  `}
                </div>

              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.bindCardEvents();
  }

  bindCardEvents() {
    const grid = document.getElementById('match-grid');
    if (!grid) return;

    const restartBtn = document.getElementById('match-restart-btn');
    if (restartBtn) restartBtn.addEventListener('click', () => this.startGame());

    const cardElements = grid.querySelectorAll('.match-card');
    cardElements.forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt(el.dataset.index, 10);
        this.handleCardClick(index);
      });
    });
  }

  handleCardClick(index) {
    const card = this.cards[index];
    if (card.isFlipped || card.isMatched || this.flippedCards.length >= 2) return;

    // 카드 뒤집기
    card.isFlipped = true;
    this.flippedCards.push({ card, index });
    SoundManager.playTone('flip');

    if (card.type === 'word') {
      SoundManager.speak(card.text, card.audioUrl);
    }

    this.updateCardUI(index);

    if (this.flippedCards.length === 2) {
      this.moves++;
      const movesEl = document.getElementById('match-moves');
      if (movesEl) movesEl.innerText = this.moves;

      const [first, second] = this.flippedCards;

      if (first.card.wordId === second.card.wordId && first.card.type !== second.card.type) {
        // 매칭 성공!
        setTimeout(() => {
          first.card.isMatched = true;
          second.card.isMatched = true;
          this.matchedCount++;
          SoundManager.playTone('correct');

          this.updateCardUI(first.index);
          this.updateCardUI(second.index);
          this.flippedCards = [];

          if (this.matchedCount === this.pairCount) {
            this.endGame();
          }
        }, 400);
      } else {
        // 매칭 실패 - 잠시 후 다시 뒤집기
        setTimeout(() => {
          SoundManager.playTone('wrong');
          first.card.isFlipped = false;
          second.card.isFlipped = false;
          this.updateCardUI(first.index);
          this.updateCardUI(second.index);
          this.flippedCards = [];
        }, 900);
      }
    }
  }

  updateCardUI(index) {
    const card = this.cards[index];
    const el = document.querySelector(`.match-card[data-index="${index}"] .match-card-inner`);
    if (el) {
      if (card.isFlipped || card.isMatched) {
        el.classList.add('rotate-y-180');
      } else {
        el.classList.remove('rotate-y-180');
      }
    }
  }

  endGame() {
    clearInterval(this.timer);
    this.isPlaying = false;
    SoundManager.playTone('fanfare');

    if (typeof window.confetti === 'function') {
      window.confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
    }

    const mins = Math.floor(this.seconds / 60);
    const secs = this.seconds % 60;
    const timeFormatted = mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`;

    setTimeout(() => {
      this.container.innerHTML = `
        <div class="max-w-md mx-auto text-center py-8 px-6 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700">
          <div class="text-6xl mb-3">🎉</div>
          <h2 class="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">모든 짝 맞추기 성공!</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">모든 단어 카드를 완벽하게 기억해냈습니다!</p>

          <div class="grid grid-cols-2 gap-4 mb-6 bg-slate-50 dark:bg-slate-750 p-4 rounded-2xl">
            <div>
              <div class="text-xs text-slate-400 mb-1">소요 시간</div>
              <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400">${timeFormatted}</div>
            </div>
            <div>
              <div class="text-xs text-slate-400 mb-1">총 시도 횟수</div>
              <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400">${this.moves}회</div>
            </div>
          </div>

          <div class="flex flex-col gap-2.5">
            <button id="match-retry-btn" class="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-lg shadow-teal-500/30 transition">
              새로운 카드 짝 맞추기 🔀
            </button>
            <button onclick="window.switchTab('flashcard')" class="w-full py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition">
              플래시카드로 가기
            </button>
          </div>
        </div>
      `;

      const retryBtn = document.getElementById('match-retry-btn');
      if (retryBtn) retryBtn.addEventListener('click', () => this.startGame());
    }, 600);
  }
}
