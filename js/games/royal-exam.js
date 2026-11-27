// js/games/royal-exam.js
// 왕실근위대 -> 마스터 승급 심사 시험 모듈
// 1. 발음만 들림 (TTS 자동 재생, 스펠링 미노출)
// 2. 단어 길이와 일치하는 빈칸 슬롯
// 3. 단어 철자 + 5개의 더미 알파벳이 섞인 선택 버튼
// 4. 스펠링 조합 완료 후 하단에 4지선다형 뜻 선택지 등장
// 5. 정답 선택 시 마스터로 승급 (별 1~5개, 6회째 영구 마스터 큰별)

import { StorageManager } from '../storage.js?v=20261127_04';
import { SoundManager } from '../tts.js?v=20261127_04';
import { MasteryManager, RANK_CONFIG, RANK_TYPES } from '../mastery.js?v=20261127_04';

export class RoyalExamGame {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.examPool = [];
    this.currentIndex = 0;
    this.currentWord = null;

    // 스펠링 단계 상태
    this.userLetters = [];
    this.availableLetters = [];
    this.spellingCompleted = false;

    // 뜻 4지선다 단계 상태
    this.meaningOptions = [];
    this.selectedOption = null;
    this.examPassed = false;
  }

  init() {
    this.container = this.container || document.getElementById(this.containerId);
    this.loadExamWords();
    this.render();
  }

  loadExamWords() {
    const activeWords = StorageManager.getActiveWords();
    // 현재 왕실근위대인 단어들을 심사 대상 단어로 추출
    this.examPool = activeWords.filter(w => {
      if (!w) return false;
      const rank = MasteryManager.getWordRank(w);
      return rank === RANK_TYPES.ROYAL_GUARD;
    });

    this.currentIndex = 0;
    this.currentWord = null;
    this.spellingCompleted = false;
    this.examPassed = false;
  }

  stop() {
    if (typeof SoundManager !== 'undefined' && typeof SoundManager.stop === 'function') {
      SoundManager.stop();
    }
  }

  render() {
    if (!this.container) return;

    if (!this.examPool || this.examPool.length === 0) {
      this.renderEmptyState();
      return;
    }

    if (this.currentIndex >= this.examPool.length) {
      this.renderAllPassedState();
      return;
    }

    this.currentWord = this.examPool[this.currentIndex];
    this.prepareWordQuestion();
  }

  renderEmptyState() {
    this.container.innerHTML = `
      <div class="max-w-xl mx-auto text-center py-14 px-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-3xl shadow-xl border border-amber-200 dark:border-amber-900/60 animate-in fade-in">
        <div class="w-20 h-20 mx-auto mb-4 bg-gradient-to-tr from-rose-500 to-amber-500 rounded-3xl p-3 shadow-lg flex items-center justify-center text-white text-4xl">
          👑
        </div>
        <h3 class="text-2xl font-black text-slate-800 dark:text-white mb-2">
          심사 대기 중인 왕실근위대가 없습니다!
        </h3>
        <p class="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto leading-relaxed">
          고급기사(80점 이상) 상태의 단어로 <strong>스피드 퀴즈에서 2회 연속 정답</strong>을 맞추면 왕실근위대로 승급하여 이곳 승급 시험에 출전할 수 있습니다.
        </p>
        <div class="flex items-center justify-center gap-3">
          <button onclick="window.switchTab('quiz')" class="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-md transition transform hover:-translate-y-0.5">
            ⚡ 퀴즈 풀러 가기
          </button>
          <button onclick="window.switchTab('flashcard')" class="px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-sm transition">
            🗂️ 플래시카드 복습
          </button>
        </div>
      </div>
    `;
  }

  renderAllPassedState() {
    this.container.innerHTML = `
      <div class="max-w-xl mx-auto text-center py-14 px-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-3xl shadow-2xl border-2 border-emerald-400 dark:border-emerald-600 animate-in zoom-in-95">
        <div class="w-24 h-24 mx-auto mb-4 bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 rounded-3xl p-4 shadow-xl flex items-center justify-center text-white text-5xl animate-bounce">
          🏆
        </div>
        <h3 class="text-3xl font-black text-slate-900 dark:text-white mb-2">
          모든 왕실근위대 심사 완료!
        </h3>
        <p class="text-sm text-slate-600 dark:text-slate-300 mb-6 max-w-md mx-auto leading-relaxed">
          오늘 준비된 모든 근위대의 승급 심사를 마쳤습니다.<br>
          승급된 마스터 단어들의 명예로운 별을 확인해보세요!
        </p>
        <div class="flex items-center justify-center gap-3">
          <button onclick="window.switchTab('performance')" class="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-sm shadow-lg shadow-teal-500/25 transition transform hover:-translate-y-0.5">
            🏰 나의 왕국에서 확인하기
          </button>
          <button id="royal-exam-reload-btn" class="px-5 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-sm transition">
            🔄 다시 확인하기
          </button>
        </div>
      </div>
    `;

    const reloadBtn = document.getElementById('royal-exam-reload-btn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => {
        this.loadExamWords();
        this.render();
      });
    }
  }

  prepareWordQuestion() {
    const word = this.currentWord;
    const target = word.word.toUpperCase();
    const cleanTarget = target.replace(/[^A-Z]/g, '');
    const targetLength = cleanTarget.length;

    this.spellingCompleted = false;
    this.userLetters = new Array(targetLength).fill(null);

    // 1. 단어 알파벳들
    const letters = cleanTarget.split('').map((char, index) => ({
      id: `real_${index}_${char}`,
      char,
      isUsed: false,
      isDummy: false
    }));

    // 2. 단어에 없는 5개의 더미 알파벳 추가
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const unusedAlphabet = alphabet.split('').filter(c => !cleanTarget.includes(c));
    const shuffledUnused = unusedAlphabet.sort(() => Math.random() - 0.5);
    const dummyChars = shuffledUnused.slice(0, 5);

    // 더미 알파벳이 5개 미만인 경우(모든 알파벳을 거의 다 쓰는 단어) 임의의 알파벳 추가
    while (dummyChars.length < 5) {
      dummyChars.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
    }

    dummyChars.forEach((char, index) => {
      letters.push({
        id: `dummy_${index}_${char}`,
        char,
        isUsed: false,
        isDummy: true
      });
    });

    // 셔플
    this.availableLetters = letters.sort(() => Math.random() - 0.5);

    // 3. 4지선다 뜻 선택지 구성 (정답 1개 + 다른 단어 뜻 3개)
    const activeWords = StorageManager.getActiveWords();
    const otherWords = activeWords.filter(w => w.id !== word.id && w.meaning !== word.meaning);
    const shuffledOthers = otherWords.sort(() => Math.random() - 0.5).slice(0, 3);
    
    const options = [
      { text: word.meaning, isCorrect: true, wordId: word.id },
      ...shuffledOthers.map(ow => ({ text: ow.meaning, isCorrect: false, wordId: ow.id }))
    ];

    // 만약 단어 수가 부족해 4개가 안 채워지면 더미 보기 채우기
    while (options.length < 4) {
      options.push({ text: `보조 뜻 ${options.length}`, isCorrect: false, wordId: 'dummy' });
    }

    this.meaningOptions = options.sort(() => Math.random() - 0.5);
    this.selectedOption = null;

    this.renderQuestionScreen();

    // 단어 발음 자동 1회 들려줌 (청각 힌트)
    setTimeout(() => {
      SoundManager.speak(word.word, word.audioUrl);
    }, 200);
  }

  renderQuestionScreen() {
    const word = this.currentWord;
    const cleanTarget = word.word.toUpperCase().replace(/[^A-Z]/g, '');
    const targetLength = cleanTarget.length;
    const currentTier = word.mastery?.masterTier || 0;
    const nextTier = Math.min(6, currentTier + 1);

    this.container.innerHTML = `
      <div class="max-w-xl mx-auto flex flex-col items-center">
        <!-- 상단 헤더 & 심사 정보 -->
        <div class="w-full flex items-center justify-between mb-4 px-2">
          <div class="flex items-center gap-2">
            <span class="px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-sm flex items-center gap-1">
              <span>👑</span>
              <span>근위대 승급 심사</span>
            </span>
            <span class="text-xs font-bold text-slate-600 dark:text-slate-400">
              ${this.currentIndex + 1} / ${this.examPool.length}
            </span>
          </div>

          <div class="flex items-center gap-1.5">
            <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">도전 등급:</span>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1">
              <span>마스터</span>
              <span class="text-amber-500">${nextTier === 6 ? '👑 큰별(영구)' : '★'.repeat(nextTier)}</span>
            </span>
          </div>
        </div>

        <!-- 1. 리스닝 카드 (소리만 들림) -->
        <div class="w-full bg-white dark:bg-slate-800 rounded-3xl p-6 mb-5 shadow-xl border-2 border-rose-200 dark:border-rose-900/60 text-center flex flex-col items-center relative">
          <div class="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-300 dark:border-rose-700 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-3 animate-pulse">
            <span class="text-3xl">🎧</span>
          </div>

          <h3 class="text-xl font-black text-slate-800 dark:text-white mb-1">
            소리를 듣고 스펠링을 완성하세요!
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mb-2">
            단어 철자 외에 <strong>5개의 함정 알파벳</strong>이 섞여 있습니다.
          </p>
          <div class="mb-4">
            ${nextTier <= 3 ? `
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                <span>💡</span> <span>1~3성 혜택: 틀린 글자만 빠져나가고 맞은 글자는 유지됩니다</span>
              </span>
            ` : `
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                <span>⚡</span> <span>4성 이상 고급 시험: 철자가 틀리면 전체 초기화됩니다</span>
              </span>
            `}
          </div>

          <button id="royal-exam-speak-btn" class="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white font-black text-xs shadow-md transition flex items-center gap-2 transform active:scale-95">
            <span>🔊</span>
            <span>단어 소리 다시 듣기</span>
          </button>
        </div>

        <!-- 2. 스펠링 입력 슬롯 -->
        <div class="flex flex-wrap items-center justify-center gap-2 mb-4 min-h-[56px] w-full p-2" id="royal-slots">
          ${Array.from({ length: targetLength }).map((_, i) => {
            const placed = this.userLetters[i];
            return `
              <div data-slot-index="${i}" class="royal-slot w-11 h-13 sm:w-12 sm:h-14 rounded-2xl border-2 ${placed ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-200 shadow-sm cursor-pointer' : 'border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800'} flex items-center justify-center font-black text-xl transition transform ${placed ? 'scale-100' : 'scale-95'}">
                ${placed ? placed.char : ''}
              </div>
            `;
          }).join('')}
        </div>

        <!-- 3. 선택 가능한 알파벳 블록 (정답 철자 + 5개 더미) -->
        <div class="flex flex-wrap items-center justify-center gap-2 mb-6 max-w-lg ${this.spellingCompleted ? 'opacity-40 pointer-events-none' : ''}">
          ${this.availableLetters.map(item => `
            <button data-letter-id="${item.id}" class="royal-letter-btn w-10 h-12 sm:w-11 sm:h-13 rounded-2xl border-2 font-black text-lg transition transform ${item.isUsed ? 'opacity-20 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 cursor-not-allowed scale-90' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-md hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 hover:scale-105 active:scale-95'}">
              ${item.char}
            </button>
          `).join('')}
        </div>

        <!-- 4. 스펠링 조합 완료 시 나타나는 4지선다 뜻 선택지 -->
        <div id="royal-meaning-step" class="w-full transition-all duration-300 ${this.spellingCompleted ? 'opacity-100 block' : 'opacity-0 hidden'}">
          <div class="w-full bg-emerald-50/90 dark:bg-emerald-950/50 rounded-3xl p-5 border-2 border-emerald-400 dark:border-emerald-700 text-center shadow-lg mb-6">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-200/80 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 text-xs font-black mb-3">
              <span>✨</span>
              <span>스펠링 성공! 올바른 한국어 뜻을 선택하세요</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" id="royal-meaning-options">
              ${this.meaningOptions.map((opt, idx) => `
                <button data-option-idx="${idx}" class="royal-option-btn p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold text-sm sm:text-base shadow-sm hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition text-center flex items-center justify-center min-h-[56px]">
                  <span>${opt.text}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- 하단 컨트롤 버튼 (지우기 / 전체 비우기 / 건너뛰기) -->
        <div class="flex items-center justify-center flex-wrap gap-2.5">
          <button id="royal-clear-btn" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5">
            <span>⌫</span>
            <span>한 글자 지우기</span>
          </button>
          <button id="royal-reset-btn" class="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs font-bold transition">
            전체 비우기
          </button>
          <button id="royal-skip-btn" class="px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold transition flex items-center gap-1.5">
            <span>⏭️</span>
            <span>모르는 단어 건너뛰기</span>
          </button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // 발음 듣기 버튼
    const speakBtn = document.getElementById('royal-exam-speak-btn');
    if (speakBtn) {
      speakBtn.addEventListener('click', () => {
        SoundManager.speak(this.currentWord.word, this.currentWord.audioUrl);
      });
    }

    // 알파벳 선택 버튼들
    const letterBtns = this.container.querySelectorAll('.royal-letter-btn');
    letterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.spellingCompleted) return;
        const letterId = btn.dataset.letterId;
        this.selectLetter(letterId);
      });
    });

    // 슬롯 클릭 시 취소
    const slotEls = this.container.querySelectorAll('.royal-slot');
    slotEls.forEach(slot => {
      slot.addEventListener('click', () => {
        if (this.spellingCompleted) return;
        const index = parseInt(slot.dataset.slotIndex, 10);
        this.removeLetterAt(index);
      });
    });

    // 한 글자 지우기 (가장 마지막에 채워진 슬롯 비우기)
    const clearBtn = document.getElementById('royal-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (this.spellingCompleted) return;
        for (let i = this.userLetters.length - 1; i >= 0; i--) {
          if (this.userLetters[i]) {
            this.removeLetterAt(i);
            break;
          }
        }
      });
    }

    // 전체 비우기
    const resetBtn = document.getElementById('royal-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (this.spellingCompleted) return;
        this.userLetters.forEach(item => {
          if (item) item.isUsed = false;
        });
        const cleanTarget = this.currentWord.word.toUpperCase().replace(/[^A-Z]/g, '');
        this.userLetters = new Array(cleanTarget.length).fill(null);
        this.renderQuestionScreen();
      });
    }

    // 모르는 단어 건너뛰기
    const skipBtn = document.getElementById('royal-skip-btn');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        this.skipWord();
      });
    }

    // 뜻 4지선다 버튼 클릭
    const optionBtns = this.container.querySelectorAll('.royal-option-btn');
    optionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.optionIdx, 10);
        this.handleMeaningSelect(idx, btn);
      });
    });
  }

  skipWord() {
    this.stop();
    this.selectedOption = null;
    this.spellingCompleted = false;
    this.currentIndex++;
    this.render();
  }

  selectLetter(letterId) {
    const item = this.availableLetters.find(l => l.id === letterId);
    if (!item || item.isUsed) return;

    // 빈 첫 번째 슬롯 찾기
    const emptyIndex = this.userLetters.findIndex(l => l === null);
    if (emptyIndex === -1) return;

    item.isUsed = true;
    this.userLetters[emptyIndex] = item;
    SoundManager.playTone('flip');

    // 모든 슬롯이 채워졌는지 확인
    const isAllFilled = this.userLetters.every(l => l !== null);
    if (isAllFilled) {
      this.checkSpelling();
    } else {
      this.renderQuestionScreen();
    }
  }

  removeLetterAt(index) {
    if (index < 0 || index >= this.userLetters.length) return;
    const item = this.userLetters[index];
    if (item) {
      item.isUsed = false;
      this.userLetters[index] = null;
      SoundManager.playTone('flip');
      this.renderQuestionScreen();
    }
  }

  checkSpelling() {
    const cleanTarget = this.currentWord.word.toUpperCase().replace(/[^A-Z]/g, '');
    const userString = this.userLetters.map(l => l ? l.char : '').join('');

    if (userString === cleanTarget) {
      // 스펠링 완전 정답!
      this.spellingCompleted = true;
      SoundManager.playTone('correct');
      this.renderQuestionScreen();
    } else {
      // 스펠링 오답!
      SoundManager.playTone('wrong');
      const slotsContainer = document.getElementById('royal-slots');
      if (slotsContainer) {
        slotsContainer.classList.add('animate-shake');
      }

      // 현재 도전 중인 마스터 목표 단계 (1~6)
      const currentTier = this.currentWord.mastery?.masterTier || 0;
      const targetTier = Math.min(6, currentTier + 1);

      setTimeout(() => {
        if (targetTier <= 3) {
          // [별 1~3개 승급 시험]: 맞은 스펠링은 그대로 유지하고, 틀린 스펠링만 제거!
          this.userLetters.forEach((letterObj, idx) => {
            if (letterObj) {
              const correctChar = cleanTarget[idx];
              if (letterObj.char !== correctChar) {
                // 틀린 스펠링: 선택 해제 및 슬롯 비우기
                letterObj.isUsed = false;
                this.userLetters[idx] = null;
              }
            }
          });
        } else {
          // [별 4개 이상 ~ 6성 영구 마스터 시험]: 엄격한 기준 적용 (전체 슬롯 초기화)
          this.userLetters.forEach(l => {
            if (l) l.isUsed = false;
          });
          this.userLetters = new Array(cleanTarget.length).fill(null);
        }

        this.renderQuestionScreen();
      }, 700);
    }
  }

  handleMeaningSelect(optionIdx, btnElement) {
    if (this.selectedOption !== null) return;
    this.selectedOption = optionIdx;

    const chosen = this.meaningOptions[optionIdx];
    if (chosen.isCorrect) {
      // 심사 완전 통과 (마스터 승급!)
      btnElement.classList.remove('border-slate-200', 'bg-white', 'dark:bg-slate-800');
      btnElement.classList.add('border-emerald-500', 'bg-emerald-500', 'text-white', 'scale-105');
      SoundManager.playTone('fanfare');

      if (typeof window.confetti === 'function') {
        window.confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      }

      // 마스터 승급 액션 반영
      StorageManager.updateWordMastery(this.currentWord.id, 'promote_to_master');

      const word = this.currentWord;
      const newTier = word.mastery?.masterTier || 1;
      const tierBadge = newTier >= 6 ? '👑 6성 영구 마스터' : `${newTier}성 마스터 (★${newTier})`;

      // 팝업 confirm/alert 없이 세련된 토스트 배너를 살짝 띄웠다 사라지게 처리
      this.showPromotionToast(word.word, tierBadge);

      setTimeout(() => {
        this.currentIndex++;
        this.render();
      }, 1400);

    } else {
      // 뜻 오답: 오답 처리
      btnElement.classList.remove('border-slate-200', 'bg-white', 'dark:bg-slate-800');
      btnElement.classList.add('border-rose-500', 'bg-rose-500', 'text-white');
      SoundManager.playTone('wrong');

      this.showWrongToast();

      setTimeout(() => {
        this.selectedOption = null;
        this.spellingCompleted = false;
        this.userLetters.forEach(l => {
          if (l) l.isUsed = false;
        });
        const cleanTarget = this.currentWord.word.toUpperCase().replace(/[^A-Z]/g, '');
        this.userLetters = new Array(cleanTarget.length).fill(null);
        this.renderQuestionScreen();
      }, 900);
    }
  }

  /**
   * 승급 성공 토스트 (OK 누를 필요 없이 화면 상단/중앙에 1.2초간 살짝 떴다가 사라짐)
   */
  showPromotionToast(wordText, tierBadge) {
    const existing = document.getElementById('royal-exam-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'royal-exam-toast';
    toast.className = 'fixed top-12 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3.5 bg-slate-900/95 dark:bg-slate-800/95 text-white rounded-2xl shadow-2xl border border-amber-400/60 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-none';
    toast.innerHTML = `
      <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-400 flex items-center justify-center text-xl shrink-0 shadow-md">
        ⭐
      </div>
      <div>
        <div class="text-xs font-semibold text-amber-300">승급 심사 통과!</div>
        <div class="text-sm font-black text-white">
          '${wordText}' <span class="text-amber-400">${tierBadge}</span> 획득!
        </div>
      </div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('transition-all', 'duration-300', 'opacity-0', '-translate-y-2');
      setTimeout(() => toast.remove(), 350);
    }, 1200);
  }

  /**
   * 오답 토스트
   */
  showWrongToast() {
    const existing = document.getElementById('royal-exam-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'royal-exam-toast';
    toast.className = 'fixed top-12 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 bg-rose-600/95 text-white rounded-2xl shadow-xl border border-rose-400/50 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-none';
    toast.innerHTML = `
      <span class="text-lg">❌</span>
      <span class="text-sm font-bold">뜻이 일치하지 않습니다. 다시 시도해보세요!</span>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('transition-all', 'duration-200', 'opacity-0');
      setTimeout(() => toast.remove(), 250);
    }, 850);
  }
}
