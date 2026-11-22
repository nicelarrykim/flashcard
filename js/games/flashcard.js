// js/games/flashcard.js
// 3D 플립 플래시카드 & 라이트너 암기 시스템 모듈

import { StorageManager } from '../storage.js?v=20261122_36';
import { SoundManager } from '../tts.js?v=20261122_36';
import { MasteryManager, RANK_CONFIG, RANK_TYPES } from '../mastery.js?v=20261122_36';

export class FlashcardGame {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.words = [];
    this.currentIndex = 0;
    this.isFlipped = false;
    this.filterOnlyWrong = false;
    this.isShuffled = false;
  }

  init() {
    this.container = this.container || document.getElementById(this.containerId);
    this.loadWords();
    this.render();
    this.bindGlobalKeyboard();
  }

  loadWords() {
    const studyWords = (typeof StorageManager !== 'undefined' && typeof StorageManager?.getStudyWords === 'function')
      ? StorageManager.getStudyWords()
      : ((typeof StorageManager !== 'undefined' && typeof StorageManager?.getWords === 'function') ? StorageManager.getWords() : []);

    if (this.filterOnlyWrong) {
      this.words = studyWords.filter(w => (w.wrongCount || 0) > 0);
    } else {
      this.words = [...studyWords];
    }

    if (this.isShuffled) {
      this.words.sort(() => Math.random() - 0.5);
    }

    this.currentIndex = 0;
    this.isFlipped = false;
  }

  render() {
    this.container = this.container || document.getElementById(this.containerId);
    if (!this.container) return;

    this.words = (this.words || []).filter(Boolean);

    if (this.words.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state text-center py-16 px-4 bg-white/70 dark:bg-slate-800/70 backdrop-blur rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 max-w-lg mx-auto">
          <div class="text-6xl mb-4">🎉</div>
          <h3 class="text-2xl font-bold text-slate-800 dark:text-white mb-2">학습할 단어가 없습니다</h3>
          <p class="text-slate-500 dark:text-slate-400 mb-6">
            ${this.filterOnlyWrong ? '오답노트에 기록된 단어가 모두 마스터되었습니다!' : '단어장에서 새로운 단어를 추가하거나 이미지를 불러와보세요.'}
          </p>
          ${this.filterOnlyWrong ? `
            <button id="fc-show-all-btn" class="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/30 transition transform hover:-translate-y-0.5">
              전체 단어로 학습하기
            </button>
          ` : `
            <button onclick="window.switchTab('manager')" class="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/30 transition">
              단어 관리 바로가기
            </button>
          `}
        </div>
      `;

      const showAllBtn = document.getElementById('fc-show-all-btn');
      if (showAllBtn) {
        showAllBtn.addEventListener('click', () => {
          this.filterOnlyWrong = false;
          this.loadWords();
          this.render();
        });
      }
      return;
    }

    if (this.currentIndex < 0 || this.currentIndex >= this.words.length) {
      this.currentIndex = 0;
    }

    const word = this.words[this.currentIndex] || this.words[0];
    if (!word) return;

    // 플래시카드에서 처음 본 단어: 기본 20점 시작 (노출만 됨)
    StorageManager.updateWordMastery(word.id, 'fc_seen');

    const total = this.words.length;
    const progressPercent = Math.round(((this.currentIndex + 1) / total) * 100);
    const mgr = (typeof StorageManager !== 'undefined' && typeof StorageManager?.getActiveDeck === 'function')
      ? StorageManager
      : (window.StorageManager || null);
    const activeDeck = mgr?.getActiveDeck?.() || { name: '단어장' };

    const wordRank = MasteryManager.getWordRank(word);
    const rankCfg = RANK_CONFIG[wordRank] || RANK_CONFIG[RANK_TYPES.RECRUIT];
    const knightSvg = MasteryManager.getWalkingKnightIcon(wordRank, 36);
    const scoreVal = word.mastery ? word.mastery.score : 0;

    // 사진 표시 옵션 판정:
    // 1. auto: 왕실근위대부터는 사진 숨김, always_on: 항상 켬, always_off: 항상 끔
    const allowPhoto = StorageManager.shouldShowPhoto ? StorageManager.shouldShowPhoto(word) : !!(word.imageUrl && word.imageUrl.trim());

    // 2. 단어장별 그림 위치 옵션 ('meaning' | 'word', 기본값: 'meaning')
    const imagePos = (activeDeck && activeDeck.imagePosition) ? activeDeck.imagePosition : 'meaning';
    const showPhotoOnWord = allowPhoto && (imagePos === 'word');
    const showPhotoOnMeaning = allowPhoto && (imagePos === 'meaning');

    this.container.innerHTML = `
      <div class="max-w-xl mx-auto flex flex-col items-center">
        <!-- 상단 컨트롤 & 상태 바 -->
        <div class="w-full flex items-center justify-between mb-4 px-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="px-2.5 py-0.5 text-xs font-black bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-full">
              📖 ${activeDeck?.name || '단어장'}
            </span>
            <span class="text-sm font-semibold text-slate-700 dark:text-slate-300">
              ${this.currentIndex + 1} / ${total}
            </span>
            <!-- 기사 등급 미니 뱃지 -->
            <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border ${rankCfg.badgeBg}">
              <div class="w-5 h-5 flex items-center justify-center shrink-0">
                ${MasteryManager.getWalkingKnightIcon(wordRank, 20)}
              </div>
              <span>${rankCfg.name}</span>
              <span class="font-mono text-[11px] opacity-80">(${scoreVal}점)</span>
            </div>
            ${word.wrongCount > 0 ? `
              <span class="px-2 py-0.5 text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300 rounded-full">
                오답 ${word.wrongCount}회
              </span>
            ` : ''}
          </div>

          <div class="flex items-center gap-2">
            <button id="fc-filter-wrong-btn" class="px-3 py-1.5 text-xs font-medium rounded-lg transition border ${this.filterOnlyWrong ? 'bg-rose-500 text-white border-rose-600 shadow' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'}">
              ${this.filterOnlyWrong ? '오답만 보는 중' : '오답 단어만'}
            </button>
            <button id="fc-shuffle-btn" class="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition" title="단어 섞기">
              🔀
            </button>
          </div>
        </div>

        <!-- 프로그레스 바 -->
        <div class="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-6">
          <div class="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-300" style="width: ${progressPercent}%"></div>
        </div>

        <!-- 3D 플립 카드 컨테이너 (고정 높이로 카드 크기 유지) -->
        <div class="w-full h-[400px] perspective-1000 cursor-pointer select-none group" id="flashcard-card-wrapper">
          <div class="relative w-full h-full duration-500 transform-style-preserve-3d rounded-3xl shadow-2xl transition-transform ${this.isFlipped ? 'rotate-y-180' : ''}" id="flashcard-inner">
            
            <!-- 앞면 (Front: 영단어 + 발음기호 + TTS 버튼 + 사진) -->
            <div class="absolute inset-0 w-full h-full backface-hidden bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-3xl p-6 sm:p-8 flex flex-col justify-between items-center text-center border-2 border-indigo-100 dark:border-indigo-900/50 shadow-xl overflow-hidden">
              <div class="w-full flex justify-between items-center">
                <div class="flex items-center gap-2">
                  ${word.number ? `
                    <span class="px-2.5 py-1 text-xs font-black font-mono rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm">
                      No. ${word.number}
                    </span>
                  ` : ''}
                  <span class="px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
                    ${word.partOfSpeech || 'word'}
                  </span>
                </div>
                <div class="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300">
                  <div class="w-5 h-5 flex items-center justify-center">${knightSvg}</div>
                  <span>${rankCfg.name}</span>
                </div>
              </div>

              <div class="my-auto flex flex-col items-center max-w-full">
                ${showPhotoOnWord ? `
                  <div class="mb-2 shrink-0">
                    <img src="${word.imageUrl}" alt="${word.word}" onerror="this.parentElement.style.display='none'" class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-indigo-100 dark:border-indigo-800 shadow-md">
                  </div>
                ` : ''}

                <h2 class="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
                  ${word.word}
                </h2>
                ${word.phonetic ? `
                  <p class="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-mono mb-3">
                    ${word.phonetic}
                  </p>
                ` : ''}

                <!-- 발음 재생 버튼 바 -->
                <div class="flex items-center gap-2 mt-1">
                  <button id="fc-tts-btn" class="flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 font-bold transition transform hover:scale-105 active:scale-95 shadow-sm text-sm">
                    <span class="text-lg">🔊</span>
                    <span>발음 듣기</span>
                  </button>
                </div>
              </div>

              <div class="text-xs text-slate-400">
                스페이스바(Space) 또는 카드를 눌러 뜻 확인
              </div>
            </div>

            <!-- 뒷면 (Back: 한국어 뜻 + 예문 + 사진) -->
            <div class="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 flex flex-col justify-between items-center text-center border-2 border-purple-500/40 shadow-2xl overflow-hidden">
              <div class="relative z-10 w-full flex justify-between items-center">
                <div class="flex items-center gap-2">
                  ${word.number ? `
                    <span class="px-2.5 py-1 text-xs font-black font-mono rounded-lg bg-white/20 text-white">
                      #${word.number}
                    </span>
                  ` : ''}
                  <span class="px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    ${word.word}
                  </span>
                </div>
                <button id="fc-tts-back-btn" class="p-2 rounded-full hover:bg-white/10 text-slate-300 transition" title="발음 다시 듣기">
                  🔊
                </button>
              </div>

              <div class="relative z-10 my-auto flex flex-col items-center max-w-lg w-full">
                ${showPhotoOnMeaning ? `
                  <div class="mb-2 shrink-0">
                    <img src="${word.imageUrl}" alt="${word.word}" onerror="this.parentElement.style.display='none'" class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-purple-400/50 shadow-md opacity-90">
                  </div>
                ` : ''}

                <h3 class="text-3xl sm:text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-purple-200 to-indigo-200 mb-4 tracking-tight">
                  ${word.meaning}
                </h3>

                ${word.example ? `
                  <div class="bg-black/30 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-white/10 text-left w-full my-1 shadow-inner">
                    <p class="text-xs sm:text-sm font-medium text-slate-200 mb-0.5 leading-relaxed">
                      "${word.example}"
                    </p>
                    ${word.exampleMeaning ? `
                      <p class="text-[11px] sm:text-xs text-slate-400">
                        ${word.exampleMeaning}
                      </p>
                    ` : ''}
                  </div>
                ` : ''}
              </div>

              <div class="relative z-10 text-xs text-slate-400">
                아래 버튼을 눌러 암기 상태를 기록하세요
              </div>
            </div>

          </div>
        </div>

        <!-- 하단 평가 & 네비게이션 컨트롤 -->
        <div class="w-full mt-6 flex flex-col gap-3">
          <div class="grid grid-cols-3 gap-3 w-full">
            <button id="fc-hard-btn" class="py-3 px-2 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 font-semibold transition transform hover:-translate-y-0.5 active:translate-y-0 flex flex-col items-center justify-center gap-1">
              <span class="text-lg">❌</span>
              <span class="text-sm font-bold">모르겠어요 (-5)</span>
            </button>

            <button id="fc-good-btn" class="py-3 px-2 rounded-2xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300 font-semibold transition transform hover:-translate-y-0.5 active:translate-y-0 flex flex-col items-center justify-center gap-1">
              <span class="text-lg">🤔</span>
              <span class="text-sm font-bold">헷갈려요 (유지)</span>
            </button>

            <button id="fc-easy-btn" class="py-3 px-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold transition transform hover:-translate-y-0.5 active:translate-y-0 flex flex-col items-center justify-center gap-1">
              <span class="text-lg">✅</span>
              <span class="text-sm font-bold">잘 알아요 (+15)</span>
            </button>
          </div>

          <div class="flex items-center justify-between w-full pt-2">
            <button id="fc-prev-btn" class="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1 ${this.currentIndex === 0 ? 'opacity-40 cursor-not-allowed' : ''}">
              <span>←</span>
              <span>이전 단어</span>
            </button>
            <button id="fc-flip-btn" class="px-5 py-2 rounded-xl text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 transition">
              카드 뒤집기 (Space)
            </button>
            <button id="fc-next-btn" class="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1 ${this.currentIndex >= total - 1 ? 'opacity-40 cursor-not-allowed' : ''}">
              <span>다음 단어</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(word);
  }

  flipCard() {
    this.isFlipped = !this.isFlipped;
    SoundManager.playTone('flip');
    const inner = document.getElementById('flashcard-inner');
    if (inner) {
      if (this.isFlipped) {
        inner.classList.add('rotate-y-180');
      } else {
        inner.classList.remove('rotate-y-180');
      }
    }
  }

  nextWord() {
    if (this.currentIndex < this.words.length - 1) {
      this.currentIndex++;
      this.isFlipped = false;
      this.render();
      // 단어 변경 시 자동 발음 (설정에 따라)
      const currentWord = this.words[this.currentIndex];
      SoundManager.speak(currentWord.word, currentWord.audioUrl);
    }
  }

  prevWord() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.isFlipped = false;
      this.render();
    }
  }

  markStatus(type) {
    const word = this.words[this.currentIndex];
    if (!word) return;

    if (type === 'easy') {
      // 플래시카드에서 "잘 알아요" 선택: +15점 (단, 플래시카드만으로는 최대 70점까지만 상승)
      StorageManager.updateWordMastery(word.id, 'fc_know');
      StorageManager.markMemorized(word.id, true);
      SoundManager.playTone('correct');
    } else if (type === 'hard') {
      // 플래시카드에서 "모르겠어요" 선택: -5점 (최소 0점 유지)
      StorageManager.updateWordMastery(word.id, 'fc_unknown');
      StorageManager.recordMistake(word.id);
      SoundManager.playTone('wrong');
    } else {
      // good: "헷갈려요" 선택: 점수 유지
      StorageManager.updateWordMastery(word.id, 'fc_confused');
      SoundManager.playTone('flip');
    }

    if (this.currentIndex < this.words.length - 1) {
      this.nextWord();
    } else {
      // 마지막 카드 완료 시
      SoundManager.playTone('fanfare');
      if (typeof window.confetti === 'function') {
        window.confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      }
      this.render();
    }
  }

  bindEvents(word) {
    const cardWrapper = document.getElementById('flashcard-card-wrapper');
    if (cardWrapper) {
      cardWrapper.addEventListener('click', (e) => {
        // 내부 버튼 클릭 시 뒤집기 방지
        if (e.target.closest('button')) return;
        this.flipCard();
      });
    }

    const ttsBtn = document.getElementById('fc-tts-btn');
    if (ttsBtn) {
      ttsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        SoundManager.speak(word.word, word.audioUrl);
      });
    }

    const ttsBackBtn = document.getElementById('fc-tts-back-btn');
    if (ttsBackBtn) {
      ttsBackBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        SoundManager.speak(word.word, word.audioUrl);
      });
    }

    const flipBtn = document.getElementById('fc-flip-btn');
    if (flipBtn) flipBtn.addEventListener('click', () => this.flipCard());

    const prevBtn = document.getElementById('fc-prev-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => this.prevWord());

    const nextBtn = document.getElementById('fc-next-btn');
    if (nextBtn) nextBtn.addEventListener('click', () => this.nextWord());

    const hardBtn = document.getElementById('fc-hard-btn');
    if (hardBtn) hardBtn.addEventListener('click', () => this.markStatus('hard'));

    const goodBtn = document.getElementById('fc-good-btn');
    if (goodBtn) goodBtn.addEventListener('click', () => this.markStatus('good'));

    const easyBtn = document.getElementById('fc-easy-btn');
    if (easyBtn) easyBtn.addEventListener('click', () => this.markStatus('easy'));

    const filterWrongBtn = document.getElementById('fc-filter-wrong-btn');
    if (filterWrongBtn) {
      filterWrongBtn.addEventListener('click', () => {
        this.filterOnlyWrong = !this.filterOnlyWrong;
        this.loadWords();
        this.render();
      });
    }

    const shuffleBtn = document.getElementById('fc-shuffle-btn');
    if (shuffleBtn) {
      shuffleBtn.addEventListener('click', () => {
        this.isShuffled = !this.isShuffled;
        this.loadWords();
        this.render();
      });
    }
  }

  bindGlobalKeyboard() {
    if (this._keyboardBound) return;
    this._keyboardBound = true;

    window.addEventListener('keydown', (e) => {
      // 플래시카드 탭이 활성화되어 있고 입력창에 포커스가 없을 때만 반응
      const activeTab = document.querySelector('.nav-tab.active')?.dataset?.tab;
      if (activeTab !== 'flashcard') return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.flipCard();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        this.nextWord();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        this.prevWord();
      } else if (e.key === '1') {
        this.markStatus('hard');
      } else if (e.key === '2') {
        this.markStatus('good');
      } else if (e.key === '3') {
        this.markStatus('easy');
      }
    });
  }
}
