// js/games/scramble.js
// 스펠링 스크램블 (Word Scramble) 게임 모듈

import { StorageManager } from '../storage.js?v=20261123_01';
import { SoundManager } from '../tts.js?v=20261123_01';

export class ScrambleGame {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.words = [];
    this.currentIndex = 0;
    this.score = 0;
    this.streak = 0;
    this.currentWord = null;
    this.scrambledLetters = [];
    this.userLetters = [];
    this.hintUsed = false;
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
    const allWords = StorageManager.getStudyWords ? StorageManager.getStudyWords() : (mgr?.getWords?.() || []);
    const activeDeck = mgr?.getActiveDeck?.() || { name: '기본 단어장' };
    const canPlay = allWords.length >= 1;

    this.container.innerHTML = `
      <div class="max-w-md mx-auto text-center py-10 px-6 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700">
        <div class="text-6xl mb-4">🔤</div>
        <div class="inline-block px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 text-xs font-black mb-3">
          📖 단어장: ${activeDeck?.name || '기본 단어장'} (${allWords.length}단어)
        </div>
        <h2 class="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">스펠링 맞추기 (Scramble)</h2>
        <p class="text-slate-500 dark:text-slate-400 mb-6 text-sm">
          한국어 뜻과 힌트 이미지를 보고 뒤섞인 알파벳 글자 블록을 순서대로 조합하여 단어를 완성하세요!
        </p>

        ${!canPlay ? `
          <div class="p-4 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-2xl text-sm mb-4">
            단어장에 단어가 없습니다. 단어를 먼저 등록해주세요.
          </div>
        ` : `
          <button id="scramble-start-btn" class="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-lg rounded-2xl shadow-lg shadow-violet-500/30 transition transform hover:-translate-y-0.5 active:translate-y-0">
            게임 시작하기 🧩
          </button>
        `}
      </div>
    `;

    const startBtn = document.getElementById('scramble-start-btn');
    if (startBtn) startBtn.addEventListener('click', () => this.startGame());
  }

  startGame() {
    let allWords = StorageManager.getStudyWords ? StorageManager.getStudyWords() : StorageManager.getWords();
    if (allWords.length === 0) {
      allWords = StorageManager.getActiveWords ? StorageManager.getActiveWords() : StorageManager.getWords();
    }
    if (allWords.length === 0) return;

    this.words = [...allWords].sort(() => Math.random() - 0.5);
    this.currentIndex = 0;
    this.score = 0;
    this.streak = 0;

    this.loadQuestion();
  }

  loadQuestion() {
    if (this.currentIndex >= this.words.length) {
      this.endGame();
      return;
    }

    this.currentWord = this.words[this.currentIndex];
    this.hintUsed = false;
    this.userLetters = [];

    // 알파벳 분리 및 셔플 (원래 단어와 같지 않도록 보장)
    const originalLetters = this.currentWord.word.toUpperCase().split('');
    let shuffled = [...originalLetters].sort(() => Math.random() - 0.5);
    if (shuffled.join('') === originalLetters.join('') && originalLetters.length > 1) {
      shuffled.reverse();
    }

    this.scrambledLetters = shuffled.map((char, index) => ({
      id: index,
      char: char,
      isUsed: false
    }));

    this.renderQuestion();
  }

  renderQuestion() {
    const word = this.currentWord;
    const targetLength = word.word.length;

    this.container.innerHTML = `
      <div class="max-w-xl mx-auto flex flex-col items-center">
        <!-- 상단 상태 -->
        <div class="w-full flex items-center justify-between mb-4 px-2">
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-slate-700 dark:text-slate-300">
              문제 ${this.currentIndex + 1} / ${this.words.length}
            </span>
            ${this.streak > 1 ? `
              <span class="px-2 py-0.5 text-xs font-bold bg-amber-500 text-white rounded-full">
                🔥 ${this.streak} 연속 정답!
              </span>
            ` : ''}
          </div>
          <div class="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
            점수: ${this.score}
          </div>
        </div>

        <!-- 문제 카드 (뜻 + 연상 이미지) -->
        <div class="w-full bg-white dark:bg-slate-800 rounded-3xl p-6 mb-6 shadow-lg border border-slate-200 dark:border-slate-700 text-center flex flex-col items-center relative">
          <span class="px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 mb-2">
            ${word.partOfSpeech || '단어'}
          </span>

          <!-- 뜻 표시와 함께 연상 일러스트 항시 노출 -->
          ${StorageManager.shouldShowPhoto(word) ? `
            <div class="mb-3 w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden shadow-md border-2 border-indigo-100 dark:border-indigo-900 bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-1">
              <img src="${word.imageUrl}" alt="${word.meaning}" onerror="this.parentElement.style.display='none'" class="w-full h-full object-contain">
            </div>
          ` : ''}

          <h3 class="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">
            ${word.meaning}
          </h3>
          ${word.example ? `
            <p class="text-xs text-slate-400 dark:text-slate-400 italic mb-2">"${word.example}"</p>
          ` : ''}

          <!-- 힌트 & 발음 버튼 -->
          <div class="flex items-center gap-2 mt-4">
            <button id="scramble-tts-btn" class="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-300 text-xs font-semibold transition flex items-center gap-1">
              <span>🔊</span> <span>발음 힌트</span>
            </button>
            <button id="scramble-hint-btn" class="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-700 dark:text-amber-300 text-xs font-semibold transition flex items-center gap-1" ${this.hintUsed ? 'disabled opacity-50' : ''}>
              <span>💡</span> <span>첫 글자 힌트</span>
            </button>
          </div>
        </div>

        <!-- 입력 슬롯 (조합 중인 단어 표시) -->
        <div class="flex flex-wrap items-center justify-center gap-2 mb-6 min-h-[56px] w-full p-2" id="scramble-slots">
          ${Array.from({ length: targetLength }).map((_, i) => {
            const placed = this.userLetters[i];
            return `
              <div data-slot-index="${i}" class="scramble-slot w-11 h-13 sm:w-12 sm:h-14 rounded-2xl border-2 ${placed ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-200 shadow-sm cursor-pointer' : 'border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-750'} flex items-center justify-center font-extrabold text-xl transition transform ${placed ? 'scale-100' : 'scale-95'}">
                ${placed ? placed.char : ''}
              </div>
            `;
          }).join('')}
        </div>

        <!-- 섞여 있는 알파벳 블록 버튼들 -->
        <div class="flex flex-wrap items-center justify-center gap-2.5 mb-6 w-full" id="scramble-letter-pool">
          ${this.scrambledLetters.map((item) => `
            <button data-letter-id="${item.id}" class="scramble-letter-btn w-11 h-13 sm:w-12 sm:h-14 rounded-2xl bg-white dark:bg-slate-750 hover:bg-indigo-50 dark:hover:bg-indigo-950 border-2 ${item.isUsed ? 'opacity-20 border-slate-200 dark:border-slate-800 pointer-events-none' : 'border-slate-250 dark:border-slate-600 text-slate-800 dark:text-white shadow hover:-translate-y-0.5 active:translate-y-0'} font-black text-xl transition flex items-center justify-center">
              ${item.char}
            </button>
          `).join('')}
        </div>

        <!-- 컨트롤 버튼 (지우기 / 초기화 / 넘기기) -->
        <div class="flex items-center gap-2">
          <button id="scramble-backspace-btn" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-sm font-semibold transition">
            지우기 (←)
          </button>
          <button id="scramble-reset-btn" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-sm font-semibold transition">
            전체 비우기
          </button>
          <button id="scramble-skip-btn" class="px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 text-sm font-semibold transition">
            단어 넘기기
          </button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const pool = document.getElementById('scramble-letter-pool');
    if (pool) {
      pool.querySelectorAll('.scramble-letter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = parseInt(btn.dataset.letterId, 10);
          this.handleLetterClick(id);
        });
      });
    }

    const slots = document.getElementById('scramble-slots');
    if (slots) {
      slots.querySelectorAll('.scramble-slot').forEach(slot => {
        slot.addEventListener('click', () => {
          const idx = parseInt(slot.dataset.slotIndex, 10);
          this.handleSlotClick(idx);
        });
      });
    }

    const backspaceBtn = document.getElementById('scramble-backspace-btn');
    if (backspaceBtn) backspaceBtn.addEventListener('click', () => this.handleBackspace());

    const resetBtn = document.getElementById('scramble-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', () => this.handleResetLetters());

    const skipBtn = document.getElementById('scramble-skip-btn');
    if (skipBtn) skipBtn.addEventListener('click', () => {
      StorageManager.updateWordMastery(this.currentWord.id, 'game_wrong');
      StorageManager.recordMistake(this.currentWord.id);
      this.streak = 0;
      this.currentIndex++;
      this.loadQuestion();
    });

    const ttsBtn = document.getElementById('scramble-tts-btn');
    if (ttsBtn) ttsBtn.addEventListener('click', () => SoundManager.speak(this.currentWord.word, this.currentWord.audioUrl));

    const hintBtn = document.getElementById('scramble-hint-btn');
    if (hintBtn) hintBtn.addEventListener('click', () => this.useHint());
  }

  handleLetterClick(letterId) {
    const item = this.scrambledLetters.find(l => l.id === letterId);
    if (!item || item.isUsed) return;

    if (this.userLetters.length < this.currentWord.word.length) {
      item.isUsed = true;
      this.userLetters.push(item);
      SoundManager.playTone('flip');
      this.renderQuestion();
      this.checkAnswer();
    }
  }

  handleSlotClick(slotIndex) {
    if (slotIndex < this.userLetters.length) {
      const removed = this.userLetters.splice(slotIndex, 1)[0];
      const poolItem = this.scrambledLetters.find(l => l.id === removed.id);
      if (poolItem) poolItem.isUsed = false;
      this.renderQuestion();
    }
  }

  handleBackspace() {
    if (this.userLetters.length > 0) {
      const removed = this.userLetters.pop();
      const poolItem = this.scrambledLetters.find(l => l.id === removed.id);
      if (poolItem) poolItem.isUsed = false;
      this.renderQuestion();
    }
  }

  handleResetLetters() {
    this.userLetters = [];
    this.scrambledLetters.forEach(l => l.isUsed = false);
    this.renderQuestion();
  }

  useHint() {
    if (this.hintUsed) return;
    this.hintUsed = true;

    const firstChar = this.currentWord.word[0].toUpperCase();
    this.handleResetLetters();

    const targetItem = this.scrambledLetters.find(l => l.char === firstChar && !l.isUsed);
    if (targetItem) {
      targetItem.isUsed = true;
      this.userLetters.push(targetItem);
      SoundManager.speak(firstChar);
      this.renderQuestion();
    }
  }

  checkAnswer() {
    if (this.userLetters.length === this.currentWord.word.length) {
      const spelled = this.userLetters.map(l => l.char).join('');
      const answer = this.currentWord.word.toUpperCase();

      if (spelled === answer) {
        // 정답!
        this.streak++;
        const points = this.hintUsed ? 50 : (100 + (this.streak - 1) * 20);
        this.score += points;
        StorageManager.updateWordMastery(this.currentWord.id, 'game_correct', { combo: this.streak });
        StorageManager.markMemorized(this.currentWord.id, true);
        SoundManager.playTone('correct');
        SoundManager.speak(this.currentWord.word, this.currentWord.audioUrl);

        if (typeof window.confetti === 'function') {
          window.confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
        }

        setTimeout(() => {
          this.currentIndex++;
          this.loadQuestion();
        }, 1000);
      } else {
        // 오답
        SoundManager.playTone('wrong');
        const slotsEl = document.getElementById('scramble-slots');
        if (slotsEl) {
          slotsEl.classList.add('animate-shake');
          setTimeout(() => slotsEl.classList.remove('animate-shake'), 500);
        }
      }
    }
  }

  endGame() {
    SoundManager.playTone('fanfare');
    this.container.innerHTML = `
      <div class="max-w-md mx-auto text-center py-8 px-6 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700">
        <div class="text-6xl mb-3">🎓</div>
        <h2 class="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">스펠링 챌린지 완료!</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">모든 영단어의 철자를 성공적으로 완성했습니다.</p>

        <div class="p-6 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl mb-6">
          <div class="text-xs text-indigo-500 font-semibold mb-1">최종 획득 점수</div>
          <div class="text-4xl font-black text-indigo-700 dark:text-indigo-300">${this.score} 점</div>
        </div>

        <div class="flex flex-col gap-2.5">
          <button id="scramble-retry-btn" class="w-full py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-lg shadow-violet-500/30 transition">
            다시 도전하기 🔄
          </button>
          <button onclick="window.switchTab('flashcard')" class="w-full py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition">
            플래시카드로 가기
          </button>
        </div>
      </div>
    `;

    const retryBtn = document.getElementById('scramble-retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', () => this.startGame());
  }
}
