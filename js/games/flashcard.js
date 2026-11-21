// js/games/flashcard.js
// 3D 플립 플래시카드 & 라이트너 암기 시스템 모듈

import { StorageManager } from '../storage.js';
import { SoundManager } from '../tts.js';

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
    const allWords = StorageManager.getWords();
    if (this.filterOnlyWrong) {
      this.words = allWords.filter(w => (w.wrongCount || 0) > 0);
    } else {
      this.words = [...allWords];
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
    const total = this.words.length;
    const progressPercent = Math.round(((this.currentIndex + 1) / total) * 100);
    const activeDeck = StorageManager.getActiveDeck();

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
            ${word.wrongCount > 0 ? `
              <span class="px-2 py-0.5 text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300 rounded-full">
                오답 ${word.wrongCount}회
              </span>
            ` : ''}
            ${word.memorized ? `
              <span class="px-2 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 rounded-full">
                암기완료 ✓
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

        <!-- 3D 플립 카드 컨테이너 -->
        <div class="w-full h-[400px] perspective-1000 cursor-pointer select-none group" id="flashcard-card-wrapper">
          <div class="relative w-full h-full duration-500 transform-style-preserve-3d rounded-3xl shadow-2xl transition-transform ${this.isFlipped ? 'rotate-y-180' : ''}" id="flashcard-inner">
            
            <!-- 앞면 (Front: 영단어 + 발음기호 + TTS 버튼) -->
            <div class="absolute inset-0 w-full h-full backface-hidden bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-3xl p-8 flex flex-col justify-between items-center text-center border-2 border-indigo-100 dark:border-indigo-900/50 shadow-xl">
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
                <span class="text-xs text-slate-400 flex items-center gap-1">
                  <span>💡 클릭하여 뒤집기</span>
                </span>
              </div>

              <div class="my-auto flex flex-col items-center">
                <h2 class="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
                  ${word.word}
                </h2>
                ${word.phonetic ? `
                  <p class="text-lg text-slate-500 dark:text-slate-400 font-mono mb-4">
                    ${word.phonetic}
                  </p>
                ` : ''}

                <!-- 발음 재생 및 그림 힌트 버튼 바 -->
                <div class="flex items-center gap-2 mt-2">
                  <button id="fc-tts-btn" class="flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 font-medium transition transform hover:scale-105 active:scale-95 shadow-sm">
                    <span class="text-lg">🔊</span>
                    <span>발음 듣기</span>
                  </button>
                  ${word.imageUrl ? `
                    <button id="fc-hint-btn" type="button" class="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-bold transition transform hover:scale-105 active:scale-95 shadow-sm border border-amber-200 dark:border-amber-800 text-xs" title="카드를 뒤집기 전 연상 그림 힌트 확인">
                      <span>🖼️ 그림 힌트</span>
                    </button>
                  ` : ''}
                </div>

                <!-- 그림 힌트 팝오버 박스 -->
                ${word.imageUrl ? `
                  <div id="fc-hint-preview" class="hidden mt-3 p-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl shadow-xl border border-amber-300 dark:border-amber-700 max-w-[220px]">
                    <img src="${word.imageUrl}" alt="" class="w-full h-28 object-cover rounded-xl mb-1" onerror="window.handleImageFallback && window.handleImageFallback(this)">
                    <p class="text-[10px] font-bold text-amber-600 dark:text-amber-400 text-center">💡 시각적 연상 힌트</p>
                  </div>
                ` : ''}
              </div>

              <div class="text-xs text-slate-400">
                스페이스바(Space) 또는 카드를 눌러 뜻 확인
              </div>
            </div>

            <!-- 뒷면 (Back: 한국어 뜻 + 예문 + 연상 이미지) -->
            <div class="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 flex flex-col justify-between items-center text-center border-2 border-purple-500/40 shadow-2xl overflow-hidden">
              <!-- 배경 은은한 연상 이미지 (있을 경우) -->
              ${word.imageUrl ? `
                <div class="absolute inset-0 w-full h-full opacity-15 pointer-events-none">
                  <img src="${word.imageUrl}" alt="" class="w-full h-full object-cover" onerror="this.remove()">
                </div>
              ` : ''}

              <div class="relative z-10 w-full flex justify-between items-center">
                <div class="flex items-center gap-2">
                  ${word.number ? `
                    <span class="px-2 py-0.5 text-xs font-black font-mono rounded-lg bg-white/20 text-white">
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

              <div class="relative z-10 my-auto flex flex-col items-center max-w-md w-full">
                <h3 class="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-purple-200 to-indigo-200 mb-2">
                  ${word.meaning}
                </h3>

                ${word.imageUrl ? `
                  <div class="w-48 sm:w-56 h-32 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/30 relative group bg-black/40 my-1.5">
                    <img src="${word.imageUrl}" alt="${word.meaning}" class="w-full h-full object-cover transition transform duration-300 group-hover:scale-105" loading="lazy" onerror="window.handleImageFallback && window.handleImageFallback(this)">
                    <div class="absolute bottom-1 right-2 px-2 py-0.5 rounded-md bg-black/70 text-[10px] text-white/90 backdrop-blur font-bold flex items-center gap-1">
                      <span>🎨</span> <span>연상 그림</span>
                    </div>
                  </div>
                ` : ''}

                ${word.example ? `
                  <div class="bg-black/30 backdrop-blur-md rounded-2xl p-3 border border-white/10 text-left w-full my-1">
                    <p class="text-xs sm:text-sm font-medium text-slate-200 mb-0.5 leading-relaxed">
                      "${word.example}"
                    </p>
                    ${word.exampleMeaning ? `
                      <p class="text-[11px] text-slate-400">
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
              <span class="text-sm">모름 (1)</span>
            </button>

            <button id="fc-good-btn" class="py-3 px-2 rounded-2xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300 font-semibold transition transform hover:-translate-y-0.5 active:translate-y-0 flex flex-col items-center justify-center gap-1">
              <span class="text-lg">🤔</span>
              <span class="text-sm">헷갈림 (2)</span>
            </button>

            <button id="fc-easy-btn" class="py-3 px-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-semibold transition transform hover:-translate-y-0.5 active:translate-y-0 flex flex-col items-center justify-center gap-1">
              <span class="text-lg">✅</span>
              <span class="text-sm">외움 (3)</span>
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
      StorageManager.markMemorized(word.id, true);
      SoundManager.playTone('correct');
    } else if (type === 'hard') {
      StorageManager.recordMistake(word.id);
      SoundManager.playTone('wrong');
    } else {
      // good: 헷갈림
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

    const hintBtn = document.getElementById('fc-hint-btn');
    const hintPreview = document.getElementById('fc-hint-preview');
    if (hintBtn && hintPreview) {
      hintBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hintPreview.classList.toggle('hidden');
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
