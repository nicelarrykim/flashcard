// js/games/speed-drop.js
// 단어 낙하 디펜스 (Speed Drop) 아케이드 게임 모듈

import { StorageManager } from '../storage.js?v=20261122_05';
import { SoundManager } from '../tts.js?v=20261122_05';

export class SpeedDropGame {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.words = [];
    this.fallingWord = null;
    this.lives = 3;
    this.score = 0;
    this.dropY = 0; // %
    this.dropSpeed = 0.4; // 프레임당 %
    this.animationFrame = null;
    this.isPlaying = false;
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
    const allWords = mgr?.getWords?.() || [];
    const activeDeck = mgr?.getActiveDeck?.() || { name: '기본 단어장' };
    const canPlay = allWords.length >= 3;

    this.container.innerHTML = `
      <div class="max-w-md mx-auto text-center py-10 px-6 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700">
        <div class="text-6xl mb-4">☄️</div>
        <div class="inline-block px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-black mb-3">
          📖 단어장: ${activeDeck?.name || '기본 단어장'} (${allWords.length}단어)
        </div>
        <h2 class="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">단어 낙하 디펜스</h2>
        <p class="text-slate-500 dark:text-slate-400 mb-6 text-sm">
          하늘에서 떨어지는 단어가 바닥에 닿기 전에 영단어를 정확하게 타이핑하여 격추하세요!
          실수하거나 놓치면 하트가 감소합니다.
        </p>

        ${!canPlay ? `
          <div class="p-4 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-2xl text-sm mb-4">
            단어장에 최소 3개 이상의 단어가 필요합니다.
          </div>
        ` : `
          <button id="drop-start-btn" class="w-full py-4 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white font-bold text-lg rounded-2xl shadow-lg shadow-rose-500/30 transition transform hover:-translate-y-0.5 active:translate-y-0">
            게임 시작하기 🎮
          </button>
        `}
      </div>
    `;

    const startBtn = document.getElementById('drop-start-btn');
    if (startBtn) startBtn.addEventListener('click', () => this.startGame());
  }

  startGame() {
    const allWords = StorageManager.getWords();
    if (allWords.length < 3) return;

    this.words = [...allWords].sort(() => Math.random() - 0.5);
    this.lives = 3;
    this.score = 0;
    this.dropSpeed = 0.35;
    this.isPlaying = true;

    this.spawnNextWord();
    this.renderGameField();
    this.loop();
  }

  spawnNextWord() {
    if (this.words.length === 0) {
      this.words = [...StorageManager.getWords()].sort(() => Math.random() - 0.5);
    }
    this.fallingWord = this.words.pop();
    this.dropY = 5; // 상단 5%에서 시작
    this.dropSpeed = Math.min(0.9, 0.35 + (this.score / 1500) * 0.2); // 점수가 오를수록 가속
    SoundManager.speak(this.fallingWord.word, this.fallingWord.audioUrl);
  }

  renderGameField() {
    this.container.innerHTML = `
      <div class="max-w-xl mx-auto flex flex-col items-center">
        <!-- 상단 헤더: 하트 및 점수 -->
        <div class="w-full flex items-center justify-between mb-3 px-3 py-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div class="flex items-center gap-1.5 text-lg" id="drop-lives">
            ${'❤️'.repeat(this.lives)}${'🖤'.repeat(3 - this.lives)}
          </div>
          <div class="text-lg font-black text-rose-500" id="drop-score">
            ${this.score} 점
          </div>
        </div>

        <!-- 게임 경기장 (Game Arena) -->
        <div id="drop-arena" class="relative w-full h-[380px] bg-slate-900 rounded-3xl overflow-hidden border-2 border-slate-700 shadow-2xl">
          <!-- 격자 배경 그리드 -->
          <div class="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>

          <!-- 위험 바닥 라인 (Danger line) -->
          <div class="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-rose-600/60 to-transparent border-t border-rose-500/50"></div>

          <!-- 떨어지는 단어 객체 -->
          <div id="drop-word-box" class="absolute left-1/2 -translate-x-1/2 flex flex-col items-center text-center px-4 py-2 rounded-2xl bg-gradient-to-b from-indigo-500 to-purple-600 text-white shadow-xl border border-white/30 transition-transform" style="top: ${this.dropY}%">
            <span class="text-xs uppercase font-extrabold tracking-wider text-indigo-200 mb-0.5">${this.fallingWord.meaning}</span>
            <span class="text-xl sm:text-2xl font-black">${this.fallingWord.word}</span>
          </div>
        </div>

        <!-- 하단 입력 폼 -->
        <div class="w-full mt-4 flex items-center gap-2">
          <input type="text" id="drop-input" autofocus autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
            placeholder="화면의 단어를 타이핑하고 Enter를 누르세요"
            class="flex-1 px-5 py-3.5 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-lg font-bold focus:outline-none focus:border-rose-500 shadow-sm">
          <button id="drop-tts-btn" class="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition" title="발음 다시 듣기">
            🔊
          </button>
        </div>
      </div>
    `;

    const input = document.getElementById('drop-input');
    if (input) {
      input.focus();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.handleInputSubmit(input.value.trim());
          input.value = '';
        }
      });
    }

    const ttsBtn = document.getElementById('drop-tts-btn');
    if (ttsBtn) {
      ttsBtn.addEventListener('click', () => {
        if (this.fallingWord) SoundManager.speak(this.fallingWord.word, this.fallingWord.audioUrl);
      });
    }
  }

  handleInputSubmit(typedText) {
    if (!this.isPlaying || !this.fallingWord) return;

    if (typedText.toLowerCase() === this.fallingWord.word.toLowerCase()) {
      // 정답! 격추
      this.score += 100 + Math.round((100 - this.dropY) * 1.5);
      StorageManager.markMemorized(this.fallingWord.id, true);
      SoundManager.playTone('correct');

      const wordBox = document.getElementById('drop-word-box');
      if (wordBox) {
        wordBox.classList.add('scale-125', 'opacity-0');
      }

      this.spawnNextWord();
    } else {
      SoundManager.playTone('wrong');
      const input = document.getElementById('drop-input');
      if (input) {
        input.classList.add('border-rose-500');
        setTimeout(() => input.classList.remove('border-rose-500'), 400);
      }
    }
  }

  loop() {
    if (!this.isPlaying) return;

    this.dropY += this.dropSpeed;
    const wordBox = document.getElementById('drop-word-box');
    const scoreEl = document.getElementById('drop-score');

    if (scoreEl) scoreEl.innerText = `${this.score} 점`;

    if (wordBox) {
      wordBox.style.top = `${this.dropY}%`;
      wordBox.querySelector('.font-black').innerText = this.fallingWord.word;
      wordBox.querySelector('.text-indigo-200').innerText = this.fallingWord.meaning;
    }

    // 바닥 충돌 판정 (85% 도달 시 라이프 감소)
    if (this.dropY >= 82) {
      this.lives--;
      StorageManager.recordMistake(this.fallingWord.id);
      SoundManager.playTone('wrong');

      const livesEl = document.getElementById('drop-lives');
      if (livesEl) {
        livesEl.innerText = '❤️'.repeat(this.lives) + '🖤'.repeat(3 - this.lives);
      }

      const arena = document.getElementById('drop-arena');
      if (arena) {
        arena.classList.add('border-rose-500');
        setTimeout(() => arena.classList.remove('border-rose-500'), 300);
      }

      if (this.lives <= 0) {
        this.gameOver();
        return;
      } else {
        this.spawnNextWord();
      }
    }

    this.animationFrame = requestAnimationFrame(() => this.loop());
  }

  gameOver() {
    this.isPlaying = false;
    cancelAnimationFrame(this.animationFrame);
    SoundManager.playTone('wrong');

    this.container.innerHTML = `
      <div class="max-w-md mx-auto text-center py-8 px-6 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700">
        <div class="text-6xl mb-3">💥</div>
        <h2 class="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">게임 오버!</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">하트를 모두 소진하였습니다. 다시 도전해보세요!</p>

        <div class="p-6 bg-slate-50 dark:bg-slate-750 rounded-2xl mb-6">
          <div class="text-xs text-slate-400 mb-1">최종 획득 점수</div>
          <div class="text-4xl font-black text-rose-500">${this.score} 점</div>
        </div>

        <div class="flex flex-col gap-2.5">
          <button id="drop-retry-btn" class="w-full py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-500/30 transition">
            다시 플레이 🔄
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
    cancelAnimationFrame(this.animationFrame);
  }
}
