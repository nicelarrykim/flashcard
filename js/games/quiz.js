// js/games/quiz.js
// 사지선다 스피드 퀴즈 게임 모듈

import { StorageManager } from '../storage.js';
import { SoundManager } from '../tts.js';

export class QuizGame {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.words = [];
    this.currentIndex = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.totalQuestions = 10;
    this.timer = null;
    this.timeLeft = 10;
    this.maxTime = 10;
    this.isPlaying = false;
    this.wrongAnswers = [];
    this.mode = 'en-to-ko'; // 'en-to-ko' 또는 'ko-to-en'
  }

  init() {
    this.renderStartScreen();
  }

  renderStartScreen() {
    if (!this.container) return;
    const allWords = StorageManager.getWords();
    const canPlay = allWords.length >= 4;

    this.container.innerHTML = `
      <div class="max-w-md mx-auto text-center py-10 px-6 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700">
        <div class="text-6xl mb-4">⚡</div>
        <h2 class="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">사지선다 스피드 퀴즈</h2>
        <p class="text-slate-500 dark:text-slate-400 mb-6 text-sm">
          제한시간 안에 올바른 보기를 골라보세요!<br>
          연속으로 맞추면 <strong>콤보 보너스 점수</strong>가 주어집니다.
        </p>

        ${!canPlay ? `
          <div class="p-4 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-2xl text-sm mb-4">
            퀴즈를 진행하려면 최소 4개 이상의 단어가 필요합니다. 단어장에서 단어를 추가해주세요.
          </div>
        ` : `
          <!-- 모드 선택 -->
          <div class="mb-6 flex justify-center gap-2">
            <button id="quiz-mode-en" class="px-4 py-2 rounded-xl text-sm font-semibold transition ${this.mode === 'en-to-ko' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}">
              영어 ➔ 한국어 뜻
            </button>
            <button id="quiz-mode-ko" class="px-4 py-2 rounded-xl text-sm font-semibold transition ${this.mode === 'ko-to-en' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}">
              한국어 뜻 ➔ 영어
            </button>
          </div>

          <button id="quiz-start-btn" class="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-lg rounded-2xl shadow-lg shadow-indigo-500/30 transition transform hover:-translate-y-0.5 active:translate-y-0">
            게임 시작하기 🚀
          </button>
        `}
      </div>
    `;

    const modeEn = document.getElementById('quiz-mode-en');
    const modeKo = document.getElementById('quiz-mode-ko');
    if (modeEn && modeKo) {
      modeEn.addEventListener('click', () => { this.mode = 'en-to-ko'; this.renderStartScreen(); });
      modeKo.addEventListener('click', () => { this.mode = 'ko-to-en'; this.renderStartScreen(); });
    }

    const startBtn = document.getElementById('quiz-start-btn');
    if (startBtn) startBtn.addEventListener('click', () => this.startGame());
  }

  startGame() {
    const allWords = StorageManager.getWords();
    if (allWords.length < 4) return;

    // 문제 셔플
    this.words = [...allWords].sort(() => Math.random() - 0.5);
    this.totalQuestions = Math.min(10, this.words.length);
    this.currentIndex = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.wrongAnswers = [];
    this.isPlaying = true;

    this.renderQuestion();
  }

  renderQuestion() {
    if (this.currentIndex >= this.totalQuestions) {
      this.endGame();
      return;
    }

    clearInterval(this.timer);
    const currentWord = this.words[this.currentIndex];

    // 오답 보기 3개 무작위 추출
    const otherWords = this.words.filter(w => w.id !== currentWord.id);
    const shuffledOthers = otherWords.sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [currentWord, ...shuffledOthers].sort(() => Math.random() - 0.5);

    this.timeLeft = this.maxTime;

    this.container.innerHTML = `
      <div class="max-w-xl mx-auto flex flex-col items-center">
        <!-- 상단 헤더: 점수, 콤보, 문제 번호 -->
        <div class="w-full flex items-center justify-between mb-3 px-2">
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-slate-700 dark:text-slate-300">
              Q${this.currentIndex + 1} / ${this.totalQuestions}
            </span>
            ${this.combo > 1 ? `
              <span class="px-2.5 py-0.5 text-xs font-extrabold bg-amber-500 text-white rounded-full animate-bounce shadow">
                🔥 ${this.combo} 콤보!
              </span>
            ` : ''}
          </div>
          <div class="text-lg font-black text-indigo-600 dark:text-indigo-400">
            ${this.score} 점
          </div>
        </div>

        <!-- 타이머 게이지 -->
        <div class="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-6">
          <div id="quiz-timer-bar" class="h-full bg-indigo-500 rounded-full transition-all duration-100 ease-linear" style="width: 100%"></div>
        </div>

        <!-- 문제 카드 -->
        <div class="w-full bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 text-white rounded-3xl p-8 mb-6 text-center shadow-xl relative overflow-hidden">
          ${currentWord.imageUrl ? `
            <div class="absolute right-4 top-4 w-14 h-14 rounded-2xl overflow-hidden border border-white/20 shadow opacity-80 hidden sm:block">
              <img src="${currentWord.imageUrl}" alt="" class="w-full h-full object-cover">
            </div>
          ` : ''}
          
          <div class="text-xs uppercase tracking-widest text-indigo-200 mb-1">
            ${this.mode === 'en-to-ko' ? '다음 단어의 올바른 뜻은?' : '다음 뜻에 알맞은 영어 단어는?'}
          </div>

          <h3 class="text-4xl md:text-5xl font-extrabold tracking-tight mb-2">
            ${this.mode === 'en-to-ko' ? currentWord.word : currentWord.meaning}
          </h3>

          ${this.mode === 'en-to-ko' && currentWord.phonetic ? `
            <div class="text-sm text-indigo-200 font-mono mb-2">${currentWord.phonetic}</div>
          ` : ''}

          <button id="quiz-tts-btn" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold backdrop-blur transition mt-1">
            <span>🔊</span> <span>발음 듣기</span>
          </button>
        </div>

        <!-- 보기 4개 버튼 그리드 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full" id="quiz-options-container">
          ${options.map((opt, idx) => `
            <button data-word-id="${opt.id}" class="quiz-option-btn group text-left p-4 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-medium transition transform hover:-translate-y-0.5 active:translate-y-0 shadow-sm flex items-center justify-between">
              <span class="flex items-center gap-3">
                <span class="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-700 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-950 text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 text-xs font-bold flex items-center justify-center transition">
                  ${['A', 'B', 'C', 'D'][idx]}
                </span>
                <span class="text-base font-semibold">
                  ${this.mode === 'en-to-ko' ? opt.meaning : opt.word}
                </span>
              </span>
              <span class="option-indicator text-lg opacity-0 transition"></span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    // TTS 자동 재생
    SoundManager.speak(currentWord.word);

    const ttsBtn = document.getElementById('quiz-tts-btn');
    if (ttsBtn) ttsBtn.addEventListener('click', () => SoundManager.speak(currentWord.word));

    this.bindOptions(currentWord);
    this.startTimer(currentWord);
  }

  startTimer(currentWord) {
    const timerBar = document.getElementById('quiz-timer-bar');
    const interval = 100; // 0.1초마다 갱신
    const step = interval / 1000;

    this.timer = setInterval(() => {
      this.timeLeft -= step;
      if (this.timeLeft <= 0) {
        clearInterval(this.timer);
        this.handleTimeOut(currentWord);
      } else {
        const pct = Math.max(0, (this.timeLeft / this.maxTime) * 100);
        if (timerBar) {
          timerBar.style.width = `${pct}%`;
          if (pct < 30) {
            timerBar.className = 'h-full bg-rose-500 rounded-full transition-all duration-100 ease-linear';
          }
        }
      }
    }, interval);
  }

  bindOptions(currentWord) {
    const container = document.getElementById('quiz-options-container');
    if (!container) return;

    const buttons = container.querySelectorAll('.quiz-option-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        clearInterval(this.timer);
        buttons.forEach(b => b.disabled = true);

        const chosenId = btn.dataset.wordId;
        const isCorrect = chosenId === currentWord.id;

        if (isCorrect) {
          this.combo++;
          this.maxCombo = Math.max(this.maxCombo, this.combo);
          const comboBonus = (this.combo - 1) * 20;
          const timeBonus = Math.round(this.timeLeft * 10);
          const pointsEarned = 100 + comboBonus + timeBonus;
          this.score += pointsEarned;

          btn.classList.remove('border-slate-200', 'dark:border-slate-700');
          btn.classList.add('border-emerald-500', 'bg-emerald-50', 'dark:bg-emerald-950/60');
          btn.querySelector('.option-indicator').innerHTML = '✅';
          btn.querySelector('.option-indicator').classList.remove('opacity-0');

          SoundManager.playTone('correct');
        } else {
          this.combo = 0;
          this.wrongAnswers.push(currentWord);
          StorageManager.recordMistake(currentWord.id);

          btn.classList.remove('border-slate-200', 'dark:border-slate-700');
          btn.classList.add('border-rose-500', 'bg-rose-50', 'dark:bg-rose-950/60');
          btn.querySelector('.option-indicator').innerHTML = '❌';
          btn.querySelector('.option-indicator').classList.remove('opacity-0');

          // 올바른 정답 하이라이트
          const correctBtn = container.querySelector(`[data-word-id="${currentWord.id}"]`);
          if (correctBtn) {
            correctBtn.classList.remove('border-slate-200', 'dark:border-slate-700');
            correctBtn.classList.add('border-emerald-500', 'bg-emerald-50', 'dark:bg-emerald-950/40');
            correctBtn.querySelector('.option-indicator').innerHTML = '👈 정답';
            correctBtn.querySelector('.option-indicator').classList.remove('opacity-0');
          }

          SoundManager.playTone('wrong');
        }

        setTimeout(() => {
          this.currentIndex++;
          this.renderQuestion();
        }, 1200);
      });
    });
  }

  handleTimeOut(currentWord) {
    this.combo = 0;
    this.wrongAnswers.push(currentWord);
    StorageManager.recordMistake(currentWord.id);
    SoundManager.playTone('wrong');

    const container = document.getElementById('quiz-options-container');
    if (container) {
      const buttons = container.querySelectorAll('.quiz-option-btn');
      buttons.forEach(b => b.disabled = true);
      const correctBtn = container.querySelector(`[data-word-id="${currentWord.id}"]`);
      if (correctBtn) {
        correctBtn.classList.add('border-emerald-500', 'bg-emerald-50', 'dark:bg-emerald-950/40');
        correctBtn.querySelector('.option-indicator').innerHTML = '⏰ 시간초과!';
        correctBtn.querySelector('.option-indicator').classList.remove('opacity-0');
      }
    }

    setTimeout(() => {
      this.currentIndex++;
      this.renderQuestion();
    }, 1200);
  }

  endGame() {
    clearInterval(this.timer);
    this.isPlaying = false;
    SoundManager.playTone('fanfare');
    if (typeof window.confetti === 'function') {
      window.confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
    }

    const accuracy = Math.round(((this.totalQuestions - this.wrongAnswers.length) / this.totalQuestions) * 100);

    this.container.innerHTML = `
      <div class="max-w-md mx-auto text-center py-8 px-6 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700">
        <div class="text-6xl mb-3">🏆</div>
        <h2 class="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">퀴즈 완료!</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">훌륭합니다! 오늘의 단어 퀴즈를 모두 풀었습니다.</p>

        <!-- 결과 요약 박스 -->
        <div class="grid grid-cols-3 gap-3 mb-6 bg-slate-50 dark:bg-slate-750 p-4 rounded-2xl">
          <div>
            <div class="text-xs text-slate-400 mb-1">최종 점수</div>
            <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400">${this.score}</div>
          </div>
          <div>
            <div class="text-xs text-slate-400 mb-1">정답률</div>
            <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400">${accuracy}%</div>
          </div>
          <div>
            <div class="text-xs text-slate-400 mb-1">최대 콤보</div>
            <div class="text-2xl font-black text-amber-500">${this.maxCombo}</div>
          </div>
        </div>

        ${this.wrongAnswers.length > 0 ? `
          <div class="text-left mb-6">
            <h4 class="text-xs font-bold text-rose-500 uppercase tracking-wider mb-2">틀린 단어 오답노트 (${this.wrongAnswers.length})</h4>
            <div class="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              ${this.wrongAnswers.map(w => `
                <div class="flex items-center justify-between text-xs p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 border border-rose-100 dark:border-rose-900/40">
                  <span class="font-bold">${w.word}</span>
                  <span>${w.meaning}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="flex flex-col gap-2.5">
          <button id="quiz-retry-btn" class="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition">
            다시 도전하기 🔄
          </button>
          <button onclick="window.switchTab('flashcard')" class="w-full py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition">
            플래시카드로 복습하기
          </button>
        </div>
      </div>
    `;

    const retryBtn = document.getElementById('quiz-retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', () => this.startGame());
  }
}
