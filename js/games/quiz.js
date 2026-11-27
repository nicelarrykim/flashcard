// js/games/quiz.js
// 사지선다 스피드 퀴즈 게임 모듈

import { StorageManager } from '../storage.js?v=20261127_04';
import { SoundManager } from '../tts.js?v=20261127_04';
import { MasteryManager, RANK_CONFIG, RANK_TYPES } from '../mastery.js?v=20261127_04';

export class QuizGame {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.words = [];
    this.currentIndex = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.totalQuestions = 10;
    this.timer = null;
    this.nextQuestionTimer = null;
    this.timeLeft = 10;
    this.maxTime = 10;
    this.isPlaying = false;
    this.wrongAnswers = [];
    this.mode = 'en-to-ko'; // 'en-to-ko' 또는 'ko-to-en'
  }

  clearAllTimers() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.nextQuestionTimer) {
      clearTimeout(this.nextQuestionTimer);
      this.nextQuestionTimer = null;
    }
  }

  stop() {
    this.isPlaying = false;
    this.clearAllTimers();
  }

  init() {
    this.container = this.container || document.getElementById(this.containerId);
    this.renderStartScreen();
  }

  renderStartScreen() {
    this.container = this.container || document.getElementById(this.containerId);
    if (!this.container) return;
    const studyWords = StorageManager.getStudyWords ? StorageManager.getStudyWords() : StorageManager.getWords();
    const allWords = StorageManager.getActiveWords ? StorageManager.getActiveWords() : StorageManager.getWords();
    const mgr = (typeof StorageManager !== 'undefined' && typeof StorageManager?.getActiveDeck === 'function')
      ? StorageManager
      : (window.StorageManager || null);
    const activeDeck = mgr?.getActiveDeck?.() || { name: '기본 단어장' };
    const canPlay = studyWords.length >= 4 || allWords.length >= 4;

    this.container.innerHTML = `
      <div class="max-w-md mx-auto text-center py-10 px-6 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700">
        <div class="text-6xl mb-4">⚡</div>
        <div class="inline-block px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-black mb-3">
          📖 단어장: ${activeDeck?.name || '기본 단어장'} (도전 가능: ${studyWords.length}단어 / 전체: ${allWords.length}단어)
        </div>
        <h2 class="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">사지선다 스피드 퀴즈</h2>
        <p class="text-slate-500 dark:text-slate-400 mb-6 text-sm">
          제한시간 안에 올바른 보기를 골라보세요!<br>
          빠르게 맞추거나 연속 정답 시 <strong>숙련도 보너스 (+15점)</strong>가 부여됩니다.<br>
          <span class="text-xs text-indigo-500 dark:text-indigo-400 font-semibold">고급기사 상태에서 2연속 정답 시 왕실근위대로 승급합니다! 👑</span>
        </p>

        ${!canPlay ? `
          <div class="p-4 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-2xl text-sm mb-4">
            퀴즈를 진행하려면 최소 4개 이상의 단어가 필요합니다. 단어장에서 단어를 추가해주세요.
          </div>
        ` : (studyWords.length < 4 && allWords.length >= 4) ? `
          <div class="p-4 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-2xl text-sm mb-4">
            🎉 현재 단어장의 거의 모든 단어가 왕실근위대 또는 마스터 등급을 획득했습니다!<br>
            전체 단어로 복습 퀴즈를 진행합니다.
          </div>
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
            복습 퀴즈 시작하기 🚀
          </button>
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
    let pool = StorageManager.getStudyWords ? StorageManager.getStudyWords() : StorageManager.getWords();
    if (pool.length < 4) {
      // 4개 미만인 경우 전체 단어로 폴백
      pool = StorageManager.getActiveWords ? StorageManager.getActiveWords() : StorageManager.getWords();
    }
    if (pool.length < 4) return;

    // 문제 셔플
    this.words = [...pool].sort(() => Math.random() - 0.5);
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
    if (!this.isPlaying) return;

    if (this.currentIndex >= this.totalQuestions) {
      this.endGame();
      return;
    }

    this.clearAllTimers();
    const currentWord = this.words[this.currentIndex];

    // 오답 보기 3개 무작위 추출
    const otherWords = this.words.filter(w => w.id !== currentWord.id);
    const shuffledOthers = otherWords.sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [currentWord, ...shuffledOthers].sort(() => Math.random() - 0.5);

    this.timeLeft = this.maxTime;

    const wordRank = MasteryManager.getWordRank(currentWord);
    const rankCfg = RANK_CONFIG[wordRank] || RANK_CONFIG[RANK_TYPES.RECRUIT];
    const knightSvg = MasteryManager.getWalkingKnightIcon(wordRank, 24, currentWord);
    const scoreVal = currentWord.mastery ? currentWord.mastery.score : 0;

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
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${rankCfg.badgeBg}">
              <div class="w-5 h-5 flex items-center justify-center">${knightSvg}</div>
              <span>${rankCfg.name}</span>
              <span class="font-mono text-[11px]">(${scoreVal}점)</span>
            </div>
            <div class="text-lg font-black text-indigo-600 dark:text-indigo-400">
              ${this.score} 점
            </div>
          </div>
        </div>

        <!-- 타이머 게이지 -->
        <div class="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-6">
          <div id="quiz-timer-bar" class="h-full bg-indigo-500 rounded-full transition-all duration-100 ease-linear" style="width: 100%"></div>
        </div>

        <!-- 승급 토스트 알림 컨테이너 -->
        <div id="quiz-promotion-banner" class="hidden w-full mb-4 p-3 rounded-2xl text-center shadow-lg transform transition-all"></div>

        <!-- 문제 카드 -->
        <div class="w-full bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 text-white rounded-3xl p-6 sm:p-8 mb-6 text-center shadow-xl relative overflow-hidden flex flex-col items-center">
          <div class="text-xs uppercase tracking-widest text-indigo-200 mb-2 flex items-center justify-center gap-2">
            ${currentWord.number ? `<span class="px-2 py-0.5 rounded-md bg-white/20 font-mono font-bold">No. ${currentWord.number}</span>` : ''}
            <span>${this.mode === 'en-to-ko' ? '다음 단어의 올바른 뜻은?' : '다음 뜻에 알맞은 영어 단어는?'}</span>
          </div>

          <!-- 한국어 뜻 ➔ 영어 모드에서 뜻과 함께 그림 표시 -->
          ${(this.mode === 'ko-to-en' && StorageManager.shouldShowPhoto(currentWord)) ? `
            <div class="mb-3 w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden shadow-md border-2 border-white/30 bg-white/10 flex items-center justify-center p-1">
              <img src="${currentWord.imageUrl}" alt="${currentWord.meaning}" onerror="this.parentElement.style.display='none'" class="w-full h-full object-contain">
            </div>
          ` : ''}

          <h3 class="text-3xl md:text-5xl font-extrabold tracking-tight mb-2">
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
          ${options.map((opt, idx) => {
            const showOptPhoto = (this.mode === 'en-to-ko' && StorageManager.shouldShowPhoto(opt));
            return `
            <button data-word-id="${opt.id}" class="quiz-option-btn group text-left p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-medium transition transform hover:-translate-y-0.5 active:translate-y-0 shadow-sm flex items-center justify-between gap-2">
              <span class="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                <span class="w-7 h-7 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-700 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-950 text-slate-600 dark:text-slate-300 group-hover:text-indigo-600 text-xs font-bold flex items-center justify-center transition">
                  ${['A', 'B', 'C', 'D'][idx]}
                </span>
                ${showOptPhoto ? `
                  <div class="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-0.5">
                    <img src="${opt.imageUrl}" alt="${opt.meaning}" onerror="this.parentElement.style.display='none'" class="w-full h-full object-contain">
                  </div>
                ` : ''}
                <span class="text-sm sm:text-base font-semibold truncate">
                  ${this.mode === 'en-to-ko' ? opt.meaning : opt.word}
                </span>
              </span>
              <span class="option-indicator text-lg opacity-0 transition shrink-0"></span>
            </button>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // TTS 자동 재생 (원어민 MP3)
    SoundManager.speak(currentWord.word, currentWord.audioUrl);

    const ttsBtn = document.getElementById('quiz-tts-btn');
    if (ttsBtn) ttsBtn.addEventListener('click', () => SoundManager.speak(currentWord.word, currentWord.audioUrl));

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

          // 게임에서 정답: +10점 (빠르게 맞추거나 연속 정답이면 보너스 +5점 -> 총 15점)
          const isQuick = this.timeLeft >= 5;
          const masteryResult = StorageManager.updateWordMastery(currentWord.id, 'quiz_correct', {
            isQuick,
            combo: this.combo
          });

          btn.classList.remove('border-slate-200', 'dark:border-slate-700');
          btn.classList.add('border-emerald-500', 'bg-emerald-50', 'dark:bg-emerald-950/60');
          btn.querySelector('.option-indicator').innerHTML = '✅';
          btn.querySelector('.option-indicator').classList.remove('opacity-0');

          SoundManager.playTone('correct');

          let delay = 1200;
          if (masteryResult && (masteryResult.promotedToMaster || masteryResult.promotedToRoyalGuard)) {
            this.showPromotionToast(currentWord, masteryResult);
            delay = 2000;
          }

          this.nextQuestionTimer = setTimeout(() => {
            if (!this.isPlaying) return;
            this.currentIndex++;
            this.renderQuestion();
          }, delay);
        } else {
          this.combo = 0;
          this.wrongAnswers.push(currentWord);

          // 게임에서 오답: -10점 (최소 0점 유지)
          StorageManager.updateWordMastery(currentWord.id, 'quiz_wrong');
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

          this.nextQuestionTimer = setTimeout(() => {
            if (!this.isPlaying) return;
            this.currentIndex++;
            this.renderQuestion();
          }, 1200);
        }
      });
    });
  }

  showPromotionToast(word, result) {
    const banner = document.getElementById('quiz-promotion-banner');
    if (!banner) return;

    if (result.promotedToMaster) {
      banner.className = 'w-full mb-4 p-4 rounded-2xl text-center shadow-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white font-extrabold flex items-center justify-center gap-3 animate-bounce';
      banner.innerHTML = `
        <span class="text-3xl">🌟</span>
        <div>
          <div class="text-sm uppercase tracking-wider text-emerald-100">최종 마스터 등극!</div>
          <div class="text-base font-black">'${word.word}' 단어가 전설의 마스터 등급으로 승급했습니다!</div>
          <div class="text-xs text-teal-100 font-normal">앞으로 플래시카드와 퀴즈를 졸업하여 등장하지 않습니다.</div>
        </div>
      `;
      SoundManager.playTone('fanfare');
      if (typeof window.confetti === 'function') {
        window.confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
      }
    } else if (result.promotedToRoyalGuard) {
      banner.className = 'w-full mb-4 p-4 rounded-2xl text-center shadow-xl bg-gradient-to-r from-rose-500 via-amber-500 to-yellow-500 text-white font-extrabold flex items-center justify-center gap-3 animate-pulse';
      banner.innerHTML = `
        <span class="text-3xl">👑</span>
        <div>
          <div class="text-sm uppercase tracking-wider text-amber-100">왕실근위대 승급 (2연속 정답 달성!)</div>
          <div class="text-base font-black">'${word.word}' 단어가 왕실근위대로 임명되었습니다!</div>
          <div class="text-xs text-amber-100 font-normal">앞으로 2일간 퀴즈/플래시카드에서 제외되며, 3번 승급 시 마스터가 됩니다 (${word.mastery.promotionsToRoyalGuard}/3).</div>
        </div>
      `;
      SoundManager.playTone('fanfare');
      if (typeof window.confetti === 'function') {
        window.confetti({ particleCount: 80, spread: 60, origin: { y: 0.5 } });
      }
    }
  }

  handleTimeOut(currentWord) {
    this.combo = 0;
    this.wrongAnswers.push(currentWord);
    StorageManager.updateWordMastery(currentWord.id, 'quiz_wrong');
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

    this.nextQuestionTimer = setTimeout(() => {
      if (!this.isPlaying) return;
      this.currentIndex++;
      this.renderQuestion();
    }, 1200);
  }

  endGame() {
    this.clearAllTimers();
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
