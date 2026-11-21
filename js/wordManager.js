// js/wordManager.js
// 다중 단어장(Deck) CRUD 관리 및 다중 사진 일괄 OCR 스캐너 모듈

import { StorageManager } from './storage.js';
import { SoundManager } from './tts.js';
import { OCRParser } from './ocr.js';

export class WordManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.filterSearch = '';
    this.filterCategory = 'all'; // 'all', 'wrong', 'memorized'
    this.uploadQueue = [];
    this.extractedWords = [];
    this.columnMode = '2col';
    this.targetDeckMode = 'current'; // 'current' or 'new'
    this.newDeckNameInput = '';
  }

  init() {
    this.render();
  }

  render() {
    if (!this.container) return;

    const decks = StorageManager.getDecks();
    const activeDeck = StorageManager.getActiveDeck();
    const activeDeckId = StorageManager.getActiveDeckId();
    const activeWords = StorageManager.getActiveWords();

    let filtered = [...activeWords];

    if (this.filterCategory === 'wrong') {
      filtered = filtered.filter(w => (w.wrongCount || 0) > 0);
    } else if (this.filterCategory === 'memorized') {
      filtered = filtered.filter(w => w.memorized);
    }

    if (this.filterSearch.trim()) {
      const q = this.filterSearch.toLowerCase().trim();
      filtered = filtered.filter(w => 
        w.word.toLowerCase().includes(q) || 
        w.meaning.includes(q) ||
        (w.example && w.example.toLowerCase().includes(q))
      );
    }

    this.container.innerHTML = `
      <div class="max-w-4xl mx-auto flex flex-col gap-6">
        
        <!-- 1. 단어장(Deck) 목록 관리 섹션 -->
        <div class="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 class="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>🗂️</span> <span>내 단어장 목록 (${decks.length}개)</span>
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                원하는 단어장을 클릭하여 플래시카드 및 맞추기 게임을 단어장별로 즐기세요.
              </p>
            </div>

            <button id="mgr-create-new-deck-btn" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition flex items-center gap-1.5 shrink-0">
              <span>➕</span> <span>새 단어장 만들기</span>
            </button>
          </div>

          <!-- 단어장 카드 그리드 -->
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5" id="deck-cards-grid">
            ${decks.map(deck => {
              const isSelected = deck.id === activeDeckId;
              const memorizedCount = deck.words.filter(w => w.memorized).length;
              const wrongCount = deck.words.filter(w => (w.wrongCount || 0) > 0).length;

              return `
                <div class="relative p-4 rounded-2xl border-2 transition ${isSelected ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/40 shadow-md' : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-750/50 hover:border-indigo-300'} flex flex-col justify-between">
                  <div>
                    <div class="flex items-center justify-between mb-1.5">
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}">
                        ${isSelected ? '현재 학습 중 ✓' : `${deck.words.length}단어`}
                      </span>
                      <div class="flex items-center gap-1">
                        <button type="button" class="deck-edit-btn p-1 text-slate-400 hover:text-indigo-600 text-xs" data-id="${deck.id}" title="단어장 이름 수정">
                          ✏️
                        </button>
                        ${decks.length > 1 ? `
                          <button type="button" class="deck-del-btn p-1 text-slate-400 hover:text-rose-600 text-xs" data-id="${deck.id}" title="단어장 삭제">
                            🗑️
                          </button>
                        ` : ''}
                      </div>
                    </div>

                    <h4 class="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white line-clamp-1 mb-1">
                      ${deck.name}
                    </h4>
                    <p class="text-[11px] text-slate-400 line-clamp-1 mb-3">
                      ${deck.description || '설명 없음'}
                    </p>
                  </div>

                  <div class="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
                    <span class="text-slate-400">
                      암기: <strong class="text-emerald-600">${memorizedCount}</strong> / 오답: <strong class="text-rose-500">${wrongCount}</strong>
                    </span>
                    <button type="button" class="select-deck-btn px-2.5 py-1 rounded-lg font-bold text-xs transition ${isSelected ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 border border-indigo-200 hover:bg-indigo-50'}" data-id="${deck.id}">
                      ${isSelected ? '학습 중' : '선택'}
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 2. 선택된 단어장 내부 단어 관리 헤더 & 액션 바 -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-black">
                선택된 단어장
              </span>
              <h3 class="text-xl font-black text-slate-900 dark:text-white">
                ${activeDeck.name}
              </h3>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              이 단어장에 속한 총 <strong>${activeWords.length}</strong>개 단어 (외움: ${activeWords.filter(w => w.memorized).length} / 오답: ${activeWords.filter(w => (w.wrongCount || 0) > 0).length})
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <!-- 사진 OCR 스캐너 버튼 -->
            <button id="mgr-open-ocr-btn" class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-indigo-500/25 transition flex items-center gap-1.5 transform hover:-translate-y-0.5 active:translate-y-0">
              <span class="text-base">📸</span> <span>단어장 사진 스캔 (다중 지원)</span>
            </button>

            <!-- 텍스트 일괄 붙여넣기 -->
            <button id="mgr-open-batch-btn" class="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold transition flex items-center gap-1">
              <span>📋</span> <span>텍스트 대량 입력</span>
            </button>

            <!-- 단어 직접 추가 -->
            <button id="mgr-open-add-btn" class="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow transition flex items-center gap-1">
              <span>➕</span> <span>단어 직접 추가</span>
            </button>
          </div>
        </div>

        <!-- 검색 & 필터 바 -->
        <div class="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div class="relative w-full sm:w-80">
            <input type="text" id="mgr-search-input" value="${this.filterSearch}" placeholder="이 단어장 내 단어 또는 뜻 검색..."
              class="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
            <span class="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
          </div>

          <div class="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button data-cat="all" class="mgr-cat-filter px-3 py-1.5 rounded-lg text-xs font-semibold transition ${this.filterCategory === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}">
              전체 (${activeWords.length})
            </button>
            <button data-cat="wrong" class="mgr-cat-filter px-3 py-1.5 rounded-lg text-xs font-semibold transition ${this.filterCategory === 'wrong' ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}">
              오답노트 (${activeWords.filter(w => (w.wrongCount || 0) > 0).length})
            </button>
            <button data-cat="memorized" class="mgr-cat-filter px-3 py-1.5 rounded-lg text-xs font-semibold transition ${this.filterCategory === 'memorized' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}">
              외움 (${activeWords.filter(w => w.memorized).length})
            </button>
          </div>
        </div>

        <!-- 단어 리스트 테이블 -->
        <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          ${filtered.length === 0 ? `
            <div class="text-center py-12 px-4 text-slate-400">
              <span class="text-4xl block mb-2">🍃</span>
              <p class="text-sm">이 단어장에 조건에 맞는 단어가 없습니다.</p>
              <p class="text-xs text-slate-400 mt-1">상단의 <strong>[단어장 사진 스캔]</strong> 버튼을 눌러 사진 속 단어들을 한 번에 추가해보세요!</p>
            </div>
          ` : `
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead class="bg-slate-50 dark:bg-slate-750 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th class="py-3.5 px-4 w-16 text-center">번호 (No.)</th>
                    <th class="py-3.5 px-4">단어 / 표현</th>
                    <th class="py-3.5 px-4">한국어 뜻</th>
                    <th class="py-3.5 px-4 text-center">원어민 발음</th>
                    <th class="py-3.5 px-4 text-center">학습 상태</th>
                    <th class="py-3.5 px-4 text-right">관리</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-200">
                  ${filtered.map((w, idx) => `
                    <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-750/50 transition">
                      <td class="py-3.5 px-4 text-center">
                        <span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-xs font-bold">
                          ${w.number ? `#${w.number}` : idx + 1}
                        </span>
                      </td>
                      <td class="py-3.5 px-4">
                        <div class="flex items-center gap-2">
                          <button class="mgr-tts-btn text-slate-400 hover:text-indigo-600 transition" data-word="${w.word}" data-audio="${w.audioUrl || ''}" title="원어민 발음 듣기">
                            🔊
                          </button>
                          <div>
                            <span class="font-bold text-slate-900 dark:text-white">${w.word}</span>
                            <span class="ml-1 text-[11px] text-indigo-500 font-semibold">[${w.partOfSpeech || 'word'}]</span>
                          </div>
                        </div>
                      </td>

                      <td class="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-100">
                        ${w.meaning}
                      </td>

                      <td class="py-3.5 px-4 text-center">
                        <button class="mgr-tts-btn px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-300 text-xs font-semibold transition" data-word="${w.word}" data-audio="${w.audioUrl || ''}">
                          ▶ 재생
                        </button>
                      </td>

                      <td class="py-3.5 px-4 text-center">
                        ${w.memorized ? `
                          <span class="px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full">
                            외움 ✓
                          </span>
                        ` : w.wrongCount > 0 ? `
                          <span class="px-2 py-0.5 text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 rounded-full">
                            오답 ${w.wrongCount}회
                          </span>
                        ` : `
                          <span class="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 rounded-full">
                            학습중
                          </span>
                        `}
                      </td>

                      <td class="py-3.5 px-4 text-right">
                        <div class="flex items-center justify-end gap-1">
                          <button class="mgr-edit-btn p-1.5 text-slate-400 hover:text-indigo-600 rounded transition" data-id="${w.id}" title="수정">
                            ✏️
                          </button>
                          <button class="mgr-del-btn p-1.5 text-slate-400 hover:text-rose-600 rounded transition" data-id="${w.id}" title="삭제">
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- 하단 백업 및 초기화 영역 -->
        <div class="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pt-2 px-2">
          <div class="flex items-center gap-2">
            <button id="mgr-export-btn" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-semibold transition">
              💾 현재 단어장 백업 (JSON)
            </button>
            <label class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer transition">
              📂 단어장 가져오기 (JSON)
              <input type="file" id="mgr-import-file" accept=".json" class="hidden">
            </label>
          </div>

          <button id="mgr-reset-btn" class="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 font-semibold transition">
            기본 단어장 세트로 초기화
          </button>
        </div>

      </div>

      <!-- 모달 컨테이너 -->
      <div id="mgr-modal-container"></div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    // 단어장 선택 버튼
    document.querySelectorAll('.select-deck-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        StorageManager.setActiveDeckId(btn.dataset.id);
      });
    });

    // 단어장 이름 수정
    document.querySelectorAll('.deck-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const deckId = btn.dataset.id;
        const deck = StorageManager.getDecks().find(d => d.id === deckId);
        if (deck) {
          const newName = prompt('단어장 이름을 수정하세요:', deck.name);
          if (newName && newName.trim()) {
            StorageManager.updateDeck(deckId, { name: newName.trim() });
            this.render();
          }
        }
      });
    });

    // 단어장 삭제
    document.querySelectorAll('.deck-del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const deckId = btn.dataset.id;
        if (confirm('이 단어장과 포함된 모든 단어를 완전히 삭제하시겠습니까?')) {
          try {
            StorageManager.deleteDeck(deckId);
            this.render();
          } catch (err) {
            alert(err.message);
          }
        }
      });
    });

    // 새 단어장 만들기 버튼
    const createDeckBtn = document.getElementById('mgr-create-new-deck-btn');
    if (createDeckBtn) {
      createDeckBtn.addEventListener('click', () => {
        const name = prompt('새 단어장 이름을 입력해주세요 (예: 수능 필수 Day 3):');
        if (name && name.trim()) {
          const desc = prompt('단어장 간단 설명을 입력해주세요 (선택):') || '';
          StorageManager.createDeck(name.trim(), desc.trim());
          this.render();
        }
      });
    }

    // 검색
    const searchInput = document.getElementById('mgr-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterSearch = e.target.value;
        this.render();
      });
    }

    // 카테고리 필터
    document.querySelectorAll('.mgr-cat-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        this.filterCategory = btn.dataset.cat;
        this.render();
      });
    });

    // TTS 발음 (원어민 MP3)
    document.querySelectorAll('.mgr-tts-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        SoundManager.speak(btn.dataset.word, btn.dataset.audio);
      });
    });

    // 단어 삭제
    document.querySelectorAll('.mgr-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (confirm('이 단어를 단어장에서 삭제하시겠습니까?')) {
          StorageManager.deleteWord(id);
          this.render();
        }
      });
    });

    // 단어 수정
    document.querySelectorAll('.mgr-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const word = StorageManager.getActiveWords().find(w => w.id === id);
        if (word) this.openEditModal(word);
      });
    });

    // 새 단어 직접 추가 모달
    const addBtn = document.getElementById('mgr-open-add-btn');
    if (addBtn) addBtn.addEventListener('click', () => this.openAddModal());

    // 대량 텍스트 입력 모달
    const batchBtn = document.getElementById('mgr-open-batch-btn');
    if (batchBtn) batchBtn.addEventListener('click', () => this.openBatchModal());

    // 다중 사진 OCR 스캐너 모달 열기
    const ocrBtn = document.getElementById('mgr-open-ocr-btn');
    if (ocrBtn) ocrBtn.addEventListener('click', () => this.openMultiOCRModal());

    // JSON 내보내기 & 가져오기
    const exportBtn = document.getElementById('mgr-export-btn');
    if (exportBtn) exportBtn.addEventListener('click', () => StorageManager.exportJSON());

    const importFile = document.getElementById('mgr-import-file');
    if (importFile) {
      importFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            await StorageManager.importJSON(file);
            alert('단어장 데이터를 성공적으로 불러왔습니다!');
            this.render();
          } catch (err) {
            alert('파일 불러오기 실패: ' + err.message);
          }
        }
      });
    }

    // 기본 단어 세트 복원
    const resetBtn = document.getElementById('mgr-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('모든 단어장을 기본 추천 단어장(기본+교재 사진 단어장)으로 초기화하시겠습니까?')) {
          StorageManager.resetToDefaultDecks();
          this.render();
        }
      });
    }
  }

  /**
   * 다중 단어장 사진 일괄 OCR 스캐너 모달 열기 (대상 단어장 선택 기능 탑재)
   */
  openMultiOCRModal() {
    this.uploadQueue = [];
    this.extractedWords = [];
    this.targetDeckMode = 'current';
    this.renderMultiOCRModal();
  }

  renderMultiOCRModal() {
    const modalContainer = document.getElementById('mgr-modal-container');
    if (!modalContainer) return;

    const decks = StorageManager.getDecks();
    const activeDeck = StorageManager.getActiveDeck();

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
          
          <!-- 모달 상단 헤더 -->
          <div class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 class="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>📸</span> <span>단어장 다중 사진 일괄 스캐너</span>
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                여러 장의 단어장 사진을 스캔하여 기존 단어장에 추가하거나 새 단어장으로 저장합니다.
              </p>
            </div>
            <button id="multi-ocr-close-btn" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold">✕</button>
          </div>

          <!-- 스크롤 가능한 본문 영역 -->
          <div class="flex-1 overflow-y-auto py-4 space-y-5 pr-1">

            <!-- 저장할 대상 단어장 선택 바 -->
            <div class="bg-indigo-50/50 dark:bg-indigo-950/30 p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <span class="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1">
                <span>📥</span> <span>스캔한 단어 저장 위치:</span>
              </span>

              <div class="flex flex-wrap items-center gap-2">
                <select id="ocr-target-deck-select" class="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 border border-indigo-200 dark:border-indigo-800 font-bold text-slate-800 dark:text-white text-xs">
                  <option value="current">현재 단어장: [${activeDeck.name}] 에 추가</option>
                  <option value="new">+ 새 단어장으로 생성하여 저장</option>
                  ${decks.filter(d => d.id !== activeDeck.id).map(d => `
                    <option value="${d.id}">${d.name} 에 추가</option>
                  `).join('')}
                </select>

                <input type="text" id="ocr-new-deck-input" placeholder="새 단어장 이름 입력..." value="스캔 단어장 (${new Date().toLocaleDateString()})"
                  class="hidden px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 border border-indigo-300 dark:border-indigo-600 font-bold text-xs text-slate-900 dark:text-white">
              </div>
            </div>

            <!-- 표 분할 옵션 바 -->
            <div class="bg-slate-50 dark:bg-slate-750 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <span class="font-bold text-slate-800 dark:text-slate-200">📐 단어장 표 레이아웃:</span>
                <span class="text-slate-500 dark:text-slate-400 block sm:inline sm:ml-1">교재 사진의 열(Column) 개수를 선택하세요</span>
              </div>
              <div class="flex items-center gap-1.5">
                <button type="button" data-mode="2col" class="layout-mode-btn px-3 py-1.5 rounded-xl font-bold transition ${this.columnMode === '2col' ? 'bg-indigo-600 text-white shadow' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200'}">
                  2단 표 (좌/우 2열 - 교재 표준)
                </button>
                <button type="button" data-mode="1col" class="layout-mode-btn px-3 py-1.5 rounded-xl font-semibold transition ${this.columnMode === '1col' ? 'bg-indigo-600 text-white shadow' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200'}">
                  1단 (단일 열)
                </button>
                <button type="button" data-mode="3col" class="layout-mode-btn px-3 py-1.5 rounded-xl font-semibold transition ${this.columnMode === '3col' ? 'bg-indigo-600 text-white shadow' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200'}">
                  3단 표
                </button>
              </div>
            </div>

            <!-- 대형 드래그 앤 드롭 업로드 존 -->
            <div id="multi-ocr-dropzone" class="border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-500 rounded-3xl p-6 sm:p-8 text-center cursor-pointer bg-indigo-50/20 dark:bg-indigo-950/20 transition group">
              <div class="text-4xl sm:text-5xl mb-2 group-hover:scale-110 transition-transform">📂</div>
              <div class="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
                여러 장의 단어장 사진을 여기에 끌어다 놓거나 클릭하세요
              </div>
              <p class="text-xs text-slate-400 mb-3">
                JPG, PNG 사진을 한 번에 여러 장(1장, 3장, 10장 등) 선택 가능
              </p>
              
              <div class="inline-flex items-center gap-2">
                <span class="px-4 py-2 rounded-xl bg-indigo-600 group-hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition">
                  사진 파일 선택하기 (여러 장 가능)
                </span>
                
                <button type="button" id="multi-ocr-sample-btn" class="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow transition flex items-center gap-1" title="방금 업로드하신 교재 사진으로 바로 테스트합니다">
                  <span>⚡</span> <span>첨부된 예시 사진으로 테스트</span>
                </button>
              </div>

              <input type="file" id="multi-ocr-file-input" multiple accept="image/*" class="hidden">
            </div>

            <!-- 업로드 큐 썸네일 리스트 -->
            ${this.uploadQueue.length > 0 ? `
              <div class="space-y-2">
                <div class="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 px-1">
                  <span>선택된 사진 목록 (${this.uploadQueue.length}장)</span>
                  <button type="button" id="queue-clear-btn" class="text-rose-500 hover:underline">전체 비우기</button>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-48 overflow-y-auto p-1">
                  ${this.uploadQueue.map(item => `
                    <div class="relative bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 rounded-2xl p-2 flex flex-col items-center group">
                      <div class="w-full h-24 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-700 mb-2 relative">
                        <img src="${item.url}" alt="${item.name}" class="w-full h-full object-cover">
                        <span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.status === 'done' ? 'bg-emerald-500 text-white' :
                          item.status === 'processing' ? 'bg-indigo-600 text-white animate-pulse' :
                          item.status === 'error' ? 'bg-rose-500 text-white' :
                          'bg-black/60 text-white'
                        }">
                          ${item.status === 'done' ? `완료 (${item.words.length}개)` :
                            item.status === 'processing' ? `${item.progress}%` :
                            item.status === 'error' ? '오류' : '대기중'}
                        </span>
                      </div>

                      <div class="w-full text-left">
                        <p class="text-[11px] font-semibold text-slate-800 dark:text-white truncate" title="${item.name}">${item.name}</p>
                        <p class="text-[10px] text-slate-400">${item.sizeFormatted}</p>
                      </div>

                      <button type="button" data-queue-id="${item.id}" class="queue-del-btn absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        ✕
                      </button>
                    </div>
                  `).join('')}
                </div>

                <!-- 전체 진행률 바 -->
                <div id="ocr-overall-progress" class="hidden pt-2">
                  <div class="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    <span id="ocr-overall-status-text">준비 중...</span>
                    <span id="ocr-overall-percent" class="font-bold text-indigo-600">0%</span>
                  </div>
                  <div class="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div id="ocr-overall-progress-bar" class="h-full bg-gradient-to-r from-indigo-500 to-pink-500 rounded-full transition-all duration-200" style="width: 0%"></div>
                  </div>
                </div>

                <!-- 분석 시작 버튼 -->
                <button type="button" id="start-batch-ocr-btn" class="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/25 transition flex items-center justify-center gap-2">
                  <span>🚀</span> <span>선택한 ${this.uploadQueue.length}장의 사진 일괄 분석 시작</span>
                </button>
              </div>
            ` : ''}

            <!-- 추출된 단어 목록 검수 및 인라인 편집 테이블 -->
            ${this.extractedWords.length > 0 ? `
              <div class="border-t border-slate-200 dark:border-slate-700 pt-4">
                <div class="flex items-center justify-between mb-3">
                  <div>
                    <h4 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>✅</span> <span>인식된 단어 목록</span>
                      <span class="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs font-extrabold">
                        총 ${this.extractedWords.length}개
                      </span>
                    </h4>
                    <p class="text-[11px] text-slate-400">오인식된 단어나 뜻이 있다면 아래 테이블에서 직접 클릭하여 수정할 수 있습니다.</p>
                  </div>

                  <button type="button" id="add-manual-row-btn" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 transition">
                    + 직접 행 추가
                  </button>
                </div>

                <!-- 검수 테이블 -->
                <div class="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                  <table class="w-full text-left text-xs">
                    <thead class="bg-slate-50 dark:bg-slate-750 text-slate-500 font-bold sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th class="py-2.5 px-2 w-20 text-center">번호(인덱스)</th>
                        <th class="py-2.5 px-3 w-48">영어 단어/표현 (수정가능)</th>
                        <th class="py-2.5 px-3">한국어 뜻 (수정가능)</th>
                        <th class="py-2.5 px-2 w-16 text-center">발음</th>
                        <th class="py-2.5 px-2 w-12 text-center">삭제</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-750 bg-white dark:bg-slate-800" id="extracted-words-tbody">
                      ${this.extractedWords.map((w, idx) => `
                        <tr class="hover:bg-indigo-50/40 dark:hover:bg-slate-750/50 transition">
                          <td class="py-2 px-2 text-center">
                            <input type="number" value="${w.number || ''}" placeholder="번호" data-idx="${idx}" data-field="number"
                              class="w-16 px-1.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 font-mono text-center font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none focus:border-indigo-500">
                          </td>
                          <td class="py-2 px-3">
                            <input type="text" value="${w.word}" data-idx="${idx}" data-field="word"
                              class="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
                          </td>
                          <td class="py-2 px-3">
                            <input type="text" value="${w.meaning}" data-idx="${idx}" data-field="meaning"
                              class="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500">
                          </td>
                          <td class="py-2 px-2 text-center">
                            <button type="button" class="preview-tts-btn p-1 text-slate-400 hover:text-indigo-600 transition" data-word="${w.word}" data-audio="${w.audioUrl || ''}" title="원어민 발음 미리듣기">
                              🔊
                            </button>
                          </td>
                          <td class="py-2 px-2 text-center">
                            <button type="button" class="del-extracted-row-btn text-rose-400 hover:text-rose-600 font-bold" data-idx="${idx}">
                              ✕
                            </button>
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>

                <!-- 최종 등록 버튼 -->
                <div class="mt-4 pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-700">
                  <div class="text-xs text-slate-500">
                    검수를 마친 후 저장 버튼을 누르면 지정한 단어장으로 안전하게 등록됩니다.
                  </div>

                  <button type="button" id="confirm-save-words-btn" class="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-1.5">
                    <span>✨</span> <span>${this.extractedWords.length}개 단어 단어장에 저장하기</span>
                  </button>
                </div>
              </div>
            ` : ''}

          </div>
        </div>
      </div>
    `;

    this.bindMultiOCREvents();
  }

  bindMultiOCREvents() {
    const modalContainer = document.getElementById('mgr-modal-container');

    const closeBtn = document.getElementById('multi-ocr-close-btn');
    if (closeBtn) closeBtn.onclick = () => { modalContainer.innerHTML = ''; };

    // 대상 단어장 선택 핸들러
    const targetSelect = document.getElementById('ocr-target-deck-select');
    const newDeckInput = document.getElementById('ocr-new-deck-input');
    if (targetSelect && newDeckInput) {
      targetSelect.onchange = () => {
        if (targetSelect.value === 'new') {
          newDeckInput.classList.remove('hidden');
        } else {
          newDeckInput.classList.add('hidden');
        }
      };
    }

    // 표 레이아웃 모드
    document.querySelectorAll('.layout-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.columnMode = btn.dataset.mode;
        this.renderMultiOCRModal();
      });
    });

    // 드래그 앤 드롭
    const dropzone = document.getElementById('multi-ocr-dropzone');
    const fileInput = document.getElementById('multi-ocr-file-input');

    if (dropzone && fileInput) {
      dropzone.onclick = (e) => {
        if (e.target.closest('button')) return;
        fileInput.click();
      };

      dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('border-indigo-500', 'bg-indigo-50/50'); };
      dropzone.ondragleave = () => { dropzone.classList.remove('border-indigo-500', 'bg-indigo-50/50'); };
      dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-indigo-500', 'bg-indigo-50/50');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.addFilesToQueue(Array.from(e.dataTransfer.files));
        }
      };

      fileInput.onchange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.addFilesToQueue(Array.from(e.target.files));
        }
      };
    }

    // 예시 샘플 사진 버튼
    const sampleBtn = document.getElementById('multi-ocr-sample-btn');
    if (sampleBtn) {
      sampleBtn.onclick = async (e) => {
        e.stopPropagation();
        try {
          const res = await fetch('assets/images/sample_vocab_book.jpg');
          const blob = await res.blob();
          const sampleFile = new File([blob], '단어장_교재_177-236.jpg', { type: 'image/jpeg' });
          this.addFilesToQueue([sampleFile]);
        } catch (err) {
          alert('샘플 사진 로드 실패: ' + err.message);
        }
      };
    }

    // 큐 전체 비우기
    const clearBtn = document.getElementById('queue-clear-btn');
    if (clearBtn) {
      clearBtn.onclick = () => {
        this.uploadQueue = [];
        this.extractedWords = [];
        this.renderMultiOCRModal();
      };
    }

    // 큐 개별 삭제
    document.querySelectorAll('.queue-del-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.queueId;
        this.uploadQueue = this.uploadQueue.filter(item => item.id !== id);
        this.renderMultiOCRModal();
      };
    });

    // 일괄 분석 시작
    const startBatchBtn = document.getElementById('start-batch-ocr-btn');
    if (startBatchBtn) {
      startBatchBtn.onclick = () => this.runBatchOCR();
    }

    // 인라인 편집 바인딩
    document.querySelectorAll('#extracted-words-tbody input').forEach(input => {
      input.oninput = (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        const field = e.target.dataset.field;
        if (this.extractedWords[idx]) {
          if (field === 'number') {
            this.extractedWords[idx].number = e.target.value ? parseInt(e.target.value, 10) : null;
          } else {
            this.extractedWords[idx][field] = e.target.value.trim();
            if (field === 'word') {
              this.extractedWords[idx].audioUrl = OCRParser.generateAudioUrl(e.target.value.trim());
            }
          }
        }
      };
    });

    // 행 삭제
    document.querySelectorAll('.del-extracted-row-btn').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.idx, 10);
        this.extractedWords.splice(idx, 1);
        this.renderMultiOCRModal();
      };
    });

    // 행 추가
    const addManualRowBtn = document.getElementById('add-manual-row-btn');
    if (addManualRowBtn) {
      addManualRowBtn.onclick = () => {
        this.extractedWords.unshift({
          word: 'new word',
          meaning: '새 뜻',
          partOfSpeech: 'noun',
          phonetic: '',
          imageUrl: '',
          audioUrl: OCRParser.generateAudioUrl('new word'),
          tags: ['photo-scan']
        });
        this.renderMultiOCRModal();
      };
    }

    // 발음 미리듣기
    document.querySelectorAll('.preview-tts-btn').forEach(btn => {
      btn.onclick = () => {
        SoundManager.speak(btn.dataset.word, btn.dataset.audio);
      };
    });

    // 단어장에 최종 등록
    const confirmSaveBtn = document.getElementById('confirm-save-words-btn');
    if (confirmSaveBtn) {
      confirmSaveBtn.onclick = () => {
        if (this.extractedWords.length === 0) return;

        const targetSelectVal = document.getElementById('ocr-target-deck-select').value;
        let targetDeckId = null;

        if (targetSelectVal === 'new') {
          const newName = document.getElementById('ocr-new-deck-input').value.trim() || '새 사진 단어장';
          const newDeck = StorageManager.createDeck(newName, '사진 스캔으로 생성된 단어장');
          targetDeckId = newDeck.id;
        } else if (targetSelectVal === 'current') {
          targetDeckId = StorageManager.getActiveDeckId();
        } else {
          targetDeckId = targetSelectVal;
        }

        StorageManager.addWordsBatch(this.extractedWords, targetDeckId);
        SoundManager.playTone('fanfare');

        if (typeof window.confetti === 'function') {
          window.confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
        }

        alert(`총 ${this.extractedWords.length}개의 단어가 지정한 단어장에 성공적으로 저장되었습니다!`);
        modalContainer.innerHTML = '';
        this.render();
      };
    }
  }

  addFilesToQueue(files) {
    const validImages = files.filter(f => f.type.startsWith('image/'));
    if (validImages.length === 0) {
      alert('이미지 파일(JPG, PNG 등)만 선택할 수 있습니다.');
      return;
    }

    validImages.forEach(f => {
      this.uploadQueue.push({
        id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        file: f,
        url: URL.createObjectURL(f),
        name: f.name,
        sizeFormatted: (f.size / 1024 / 1024).toFixed(1) + ' MB',
        status: 'ready',
        progress: 0,
        words: []
      });
    });

    this.renderMultiOCRModal();
  }

  async runBatchOCR() {
    const startBtn = document.getElementById('start-batch-ocr-btn');
    const progressContainer = document.getElementById('ocr-overall-progress');
    const statusText = document.getElementById('ocr-overall-status-text');
    const percentEl = document.getElementById('ocr-overall-percent');
    const progressBar = document.getElementById('ocr-overall-progress-bar');

    if (startBtn) startBtn.disabled = true;
    if (progressContainer) progressContainer.classList.remove('hidden');

    let allExtracted = [];

    for (let i = 0; i < this.uploadQueue.length; i++) {
      const item = this.uploadQueue[i];
      item.status = 'processing';
      this.renderMultiOCRModal();

      try {
        const words = await OCRParser.extractFromSingleImage(item.file, { columnMode: this.columnMode }, (pct, msg) => {
          item.progress = pct;
          const overall = Math.round(((i + pct / 100) / this.uploadQueue.length) * 100);
          if (percentEl) percentEl.innerText = `${overall}%`;
          if (progressBar) progressBar.style.width = `${overall}%`;
          if (statusText) statusText.innerText = `[${i + 1}/${this.uploadQueue.length} ${item.name}] ${msg}`;
        });

        item.status = 'done';
        item.words = words;
        allExtracted = allExtracted.concat(words);
      } catch (err) {
        item.status = 'error';
        console.error(err);
      }
    }

    this.extractedWords = OCRParser.deduplicateWords(allExtracted);
    this.renderMultiOCRModal();
  }

  openAddModal() {
    const modalContainer = document.getElementById('mgr-modal-container');
    if (!modalContainer) return;

    const activeDeck = StorageManager.getActiveDeck();

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-150">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-xl font-bold text-slate-900 dark:text-white">➕ 새 단어 직접 추가</h3>
              <p class="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">단어장: [${activeDeck.name}]</p>
            </div>
            <button id="modal-close-btn" class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg">✕</button>
          </div>

          <form id="word-add-form" class="flex flex-col gap-3.5">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">영어 단어/숙어 *</label>
              <input type="text" id="modal-word-input" required placeholder="예: Lost and Found"
                class="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">한국어 뜻 *</label>
                <input type="text" id="modal-meaning-input" required placeholder="예: 분실물 보관소"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">품사</label>
                <select id="modal-pos-select" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 text-sm text-slate-900 dark:text-white">
                  <option value="word">일반 (word)</option>
                  <option value="noun">명사 (noun)</option>
                  <option value="verb">동사 (verb)</option>
                  <option value="adjective">형용사 (adjective)</option>
                  <option value="adverb">부사 (adverb)</option>
                </select>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2.5 mt-4 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button type="button" id="modal-cancel-btn" class="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600">
                취소
              </button>
              <button type="submit" class="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/30 transition">
                저장하기
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('modal-close-btn').onclick = () => modalContainer.innerHTML = '';
    document.getElementById('modal-cancel-btn').onclick = () => modalContainer.innerHTML = '';

    const form = document.getElementById('word-add-form');
    form.onsubmit = (e) => {
      e.preventDefault();
      const word = document.getElementById('modal-word-input').value.trim();
      const meaning = document.getElementById('modal-meaning-input').value.trim();
      const partOfSpeech = document.getElementById('modal-pos-select').value;

      StorageManager.addWord({
        word,
        meaning,
        partOfSpeech,
        audioUrl: OCRParser.generateAudioUrl(word)
      });
      modalContainer.innerHTML = '';
      this.render();
    };
  }

  openEditModal(word) {
    const modalContainer = document.getElementById('mgr-modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-xl font-bold text-slate-900 dark:text-white">✏️ 단어 수정</h3>
            <button id="modal-close-btn" class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg">✕</button>
          </div>

          <form id="word-edit-form" class="flex flex-col gap-3.5">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">영어 단어/표현 *</label>
              <input type="text" id="edit-word-input" required value="${word.word}"
                class="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 text-sm text-slate-900 dark:text-white font-semibold">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">한국어 뜻 *</label>
                <input type="text" id="edit-meaning-input" required value="${word.meaning}"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 text-sm text-slate-900 dark:text-white font-semibold">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">품사</label>
                <select id="edit-pos-select" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 text-sm text-slate-900 dark:text-white">
                  <option value="word" ${word.partOfSpeech === 'word' ? 'selected' : ''}>일반 (word)</option>
                  <option value="noun" ${word.partOfSpeech === 'noun' ? 'selected' : ''}>명사 (noun)</option>
                  <option value="verb" ${word.partOfSpeech === 'verb' ? 'selected' : ''}>동사 (verb)</option>
                  <option value="adjective" ${word.partOfSpeech === 'adjective' ? 'selected' : ''}>형용사 (adjective)</option>
                  <option value="adverb" ${word.partOfSpeech === 'adverb' ? 'selected' : ''}>부사 (adverb)</option>
                </select>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2.5 mt-4 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button type="button" id="modal-cancel-btn" class="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600">
                취소
              </button>
              <button type="submit" class="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow">
                수정 완료
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('modal-close-btn').onclick = () => modalContainer.innerHTML = '';
    document.getElementById('modal-cancel-btn').onclick = () => modalContainer.innerHTML = '';

    const form = document.getElementById('word-edit-form');
    form.onsubmit = (e) => {
      e.preventDefault();
      const updatedWord = document.getElementById('edit-word-input').value.trim();
      StorageManager.updateWord(word.id, {
        word: updatedWord,
        meaning: document.getElementById('edit-meaning-input').value.trim(),
        partOfSpeech: document.getElementById('edit-pos-select').value,
        audioUrl: OCRParser.generateAudioUrl(updatedWord)
      });
      modalContainer.innerHTML = '';
      this.render();
    };
  }

  openBatchModal() {
    const modalContainer = document.getElementById('mgr-modal-container');
    if (!modalContainer) return;

    const activeDeck = StorageManager.getActiveDeck();

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="text-xl font-bold text-slate-900 dark:text-white">📋 텍스트로 대량 단어 추가</h3>
              <p class="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">단어장: [${activeDeck.name}]</p>
            </div>
            <button id="modal-close-btn" class="p-1.5 text-slate-400 hover:text-slate-600 text-lg">✕</button>
          </div>

          <p class="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
            한 줄에 하나씩 영단어와 한국어 뜻을 입력해주세요.<br>
            예시:<br>
            <code>177 Lost and Found 분실물 보관소</code><br>
            <code>180 what if ~이면 어쩌지</code><br>
            <code>189 keep from ~ing ~하지 못하게 하다</code>
          </p>

          <textarea id="batch-textarea" rows="8" placeholder="177 Lost and Found 분실물 보관소&#10;178 deed 행위, 행동&#10;180 what if ~이면 어쩌지"
            class="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 mb-4"></textarea>

          <div class="flex items-center justify-between">
            <span class="text-xs text-indigo-500 font-semibold" id="batch-preview-count">0개 단어 감지됨</span>
            <div class="flex items-center gap-2">
              <button type="button" id="modal-cancel-btn" class="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600">
                취소
              </button>
              <button type="button" id="batch-submit-btn" class="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow">
                이 단어장에 일괄 등록
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-close-btn').onclick = () => modalContainer.innerHTML = '';
    document.getElementById('modal-cancel-btn').onclick = () => modalContainer.innerHTML = '';

    const textarea = document.getElementById('batch-textarea');
    const previewCount = document.getElementById('batch-preview-count');

    textarea.addEventListener('input', () => {
      const parsed = OCRParser.parseTextToWordList(textarea.value);
      previewCount.innerText = `${parsed.length}개 단어 감지됨`;
    });

    const submitBtn = document.getElementById('batch-submit-btn');
    submitBtn.onclick = () => {
      const parsed = OCRParser.parseTextToWordList(textarea.value);
      if (parsed.length === 0) {
        alert('인식 가능한 단어 쌍을 찾을 수 없습니다.');
        return;
      }
      StorageManager.addWordsBatch(parsed);
      alert(`${parsed.length}개의 단어가 단어장에 추가되었습니다!`);
      modalContainer.innerHTML = '';
      this.render();
    };
  }
}
