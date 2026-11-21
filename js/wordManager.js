// js/wordManager.js
// 단어장 관리 (CRUD, 이미지 OCR 파일 파서, 텍스트 일괄 등록, 데이터 백업) 모듈

import { StorageManager } from './storage.js';
import { SoundManager } from './tts.js';
import { OCRParser } from './ocr.js';

export class WordManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.filterSearch = '';
    this.filterCategory = 'all'; // 'all', 'wrong', 'memorized'
  }

  init() {
    this.render();
  }

  render() {
    if (!this.container) return;

    const allWords = StorageManager.getWords();
    let filtered = [...allWords];

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
        
        <!-- 상단 헤더 & 액션 버튼들 -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div>
            <h2 class="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>📚</span> <span>단어장 관리</span>
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              총 <strong>${allWords.length}</strong>개 단어 (암기: ${allWords.filter(w => w.memorized).length} / 오답: ${allWords.filter(w => (w.wrongCount || 0) > 0).length})
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <!-- 이미지 OCR 업로드 버튼 -->
            <button id="mgr-open-ocr-btn" class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition flex items-center gap-1.5">
              <span>📷</span> <span>이미지로 단어 추가 (OCR)</span>
            </button>

            <!-- 텍스트 일괄 붙여넣기 버튼 -->
            <button id="mgr-open-batch-btn" class="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold transition flex items-center gap-1">
              <span>📋</span> <span>텍스트 대량 입력</span>
            </button>

            <!-- 단어 직접 추가 버튼 -->
            <button id="mgr-open-add-btn" class="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow transition flex items-center gap-1">
              <span>➕</span> <span>단어 추가</span>
            </button>
          </div>
        </div>

        <!-- 검색 & 필터 바 -->
        <div class="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div class="relative w-full sm:w-80">
            <input type="text" id="mgr-search-input" value="${this.filterSearch}" placeholder="단어 또는 뜻 검색..."
              class="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
            <span class="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
          </div>

          <div class="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button data-cat="all" class="mgr-cat-filter px-3 py-1.5 rounded-lg text-xs font-semibold transition ${this.filterCategory === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}">
              전체 (${allWords.length})
            </button>
            <button data-cat="wrong" class="mgr-cat-filter px-3 py-1.5 rounded-lg text-xs font-semibold transition ${this.filterCategory === 'wrong' ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}">
              오답노트 (${allWords.filter(w => (w.wrongCount || 0) > 0).length})
            </button>
            <button data-cat="memorized" class="mgr-cat-filter px-3 py-1.5 rounded-lg text-xs font-semibold transition ${this.filterCategory === 'memorized' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}">
              암기완료 (${allWords.filter(w => w.memorized).length})
            </button>
          </div>
        </div>

        <!-- 단어 리스트 테이블/카드 -->
        <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          ${filtered.length === 0 ? `
            <div class="text-center py-12 px-4 text-slate-400">
              <span class="text-4xl block mb-2">🍃</span>
              <p class="text-sm">조건에 맞는 단어가 없습니다.</p>
            </div>
          ` : `
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead class="bg-slate-50 dark:bg-slate-750 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th class="py-3.5 px-4">단어 / 발음</th>
                    <th class="py-3.5 px-4">한국어 뜻</th>
                    <th class="py-3.5 px-4 hidden md:table-cell">예문</th>
                    <th class="py-3.5 px-4 text-center">연상 이미지</th>
                    <th class="py-3.5 px-4 text-center">학습 상태</th>
                    <th class="py-3.5 px-4 text-right">관리</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-200">
                  ${filtered.map(w => `
                    <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-750/50 transition">
                      <!-- 단어 & 발음 -->
                      <td class="py-3.5 px-4">
                        <div class="flex items-center gap-2">
                          <button class="mgr-tts-btn text-slate-400 hover:text-indigo-600 transition" data-word="${w.word}" title="발음 듣기">
                            🔊
                          </button>
                          <div>
                            <span class="font-bold text-slate-900 dark:text-white">${w.word}</span>
                            <span class="ml-1 text-[11px] text-indigo-500 font-semibold">[${w.partOfSpeech || 'n'}]</span>
                            ${w.phonetic ? `<div class="text-[11px] text-slate-400 font-mono">${w.phonetic}</div>` : ''}
                          </div>
                        </div>
                      </td>

                      <!-- 한국어 뜻 -->
                      <td class="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-100">
                        ${w.meaning}
                      </td>

                      <!-- 예문 -->
                      <td class="py-3.5 px-4 hidden md:table-cell text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate" title="${w.example || ''}">
                        ${w.example || '-'}
                      </td>

                      <!-- 연상 이미지 -->
                      <td class="py-3.5 px-4 text-center">
                        ${w.imageUrl ? `
                          <div class="w-10 h-10 rounded-lg overflow-hidden mx-auto border border-slate-200 dark:border-slate-700 shadow-sm">
                            <img src="${w.imageUrl}" alt="${w.word}" class="w-full h-full object-cover">
                          </div>
                        ` : `
                          <span class="text-xs text-slate-300 dark:text-slate-600">-</span>
                        `}
                      </td>

                      <!-- 학습 상태 -->
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

                      <!-- 액션 -->
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
              💾 JSON 내보내기 (백업)
            </button>
            <label class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer transition">
              📂 JSON 가져오기
              <input type="file" id="mgr-import-file" accept=".json" class="hidden">
            </label>
          </div>

          <button id="mgr-reset-btn" class="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 font-semibold transition">
            기본 샘플 단어로 초기화
          </button>
        </div>

      </div>

      <!-- 모달 컨테이너 (단어 추가, 수정, OCR 업로드, 대량 입력) -->
      <div id="mgr-modal-container"></div>
    `;

    this.bindEvents();
  }

  bindEvents() {
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

    // TTS 발음
    document.querySelectorAll('.mgr-tts-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        SoundManager.speak(btn.dataset.word);
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
        const word = StorageManager.getWords().find(w => w.id === id);
        if (word) this.openEditModal(word);
      });
    });

    // 새 단어 추가 모달 열기
    const addBtn = document.getElementById('mgr-open-add-btn');
    if (addBtn) addBtn.addEventListener('click', () => this.openAddModal());

    // 대량 텍스트 입력 모달 열기
    const batchBtn = document.getElementById('mgr-open-batch-btn');
    if (batchBtn) batchBtn.addEventListener('click', () => this.openBatchModal());

    // 이미지 OCR 모달 열기
    const ocrBtn = document.getElementById('mgr-open-ocr-btn');
    if (ocrBtn) ocrBtn.addEventListener('click', () => this.openOCRModal());

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

    // 기본 단어로 초기화
    const resetBtn = document.getElementById('mgr-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('모든 단어를 기본 추천 단어로 되돌리시겠습니까? 기존 수정 내역은 사라집니다.')) {
          StorageManager.resetToDefault();
          this.render();
        }
      });
    }
  }

  openAddModal(initialData = {}) {
    const modalContainer = document.getElementById('mgr-modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-150">
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-xl font-bold text-slate-900 dark:text-white">➕ 새 단어 추가</h3>
            <button id="modal-close-btn" class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg">✕</button>
          </div>

          <form id="word-add-form" class="flex flex-col gap-3.5">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">영어 단어 *</label>
              <input type="text" id="modal-word-input" required value="${initialData.word || ''}" placeholder="예: serendipity"
                class="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">한국어 뜻 *</label>
                <input type="text" id="modal-meaning-input" required value="${initialData.meaning || ''}" placeholder="예: 우연한 행운"
                  class="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">품사</label>
                <select id="modal-pos-select" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
                  <option value="noun" ${initialData.partOfSpeech === 'noun' ? 'selected' : ''}>명사 (noun)</option>
                  <option value="verb" ${initialData.partOfSpeech === 'verb' ? 'selected' : ''}>동사 (verb)</option>
                  <option value="adjective" ${initialData.partOfSpeech === 'adjective' ? 'selected' : ''}>형용사 (adjective)</option>
                  <option value="adverb" ${initialData.partOfSpeech === 'adverb' ? 'selected' : ''}>부사 (adverb)</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">발음 기호 (선택)</label>
              <input type="text" id="modal-phonetic-input" value="${initialData.phonetic || ''}" placeholder="예: /ˌser.ənˈdɪp.ə.t̬i/"
                class="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-mono">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">연상 이미지 URL (선택)</label>
              <input type="url" id="modal-image-input" value="${initialData.imageUrl || ''}" placeholder="https://..."
                class="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">예문 (선택)</label>
              <input type="text" id="modal-example-input" value="${initialData.example || ''}" placeholder="예: It was pure serendipity."
                class="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
            </div>

            <div class="flex items-center justify-end gap-2.5 mt-4 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button type="button" id="modal-cancel-btn" class="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition">
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
      const word = document.getElementById('modal-word-input').value;
      const meaning = document.getElementById('modal-meaning-input').value;
      const partOfSpeech = document.getElementById('modal-pos-select').value;
      const phonetic = document.getElementById('modal-phonetic-input').value;
      const imageUrl = document.getElementById('modal-image-input').value;
      const example = document.getElementById('modal-example-input').value;

      StorageManager.addWord({ word, meaning, partOfSpeech, phonetic, imageUrl, example });
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
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">영어 단어 *</label>
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
                  <option value="noun" ${word.partOfSpeech === 'noun' ? 'selected' : ''}>명사 (noun)</option>
                  <option value="verb" ${word.partOfSpeech === 'verb' ? 'selected' : ''}>동사 (verb)</option>
                  <option value="adjective" ${word.partOfSpeech === 'adjective' ? 'selected' : ''}>형용사 (adjective)</option>
                  <option value="adverb" ${word.partOfSpeech === 'adverb' ? 'selected' : ''}>부사 (adverb)</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">연상 이미지 URL</label>
              <input type="url" id="edit-image-input" value="${word.imageUrl || ''}"
                class="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 text-xs text-slate-900 dark:text-white">
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">예문</label>
              <input type="text" id="edit-example-input" value="${word.example || ''}"
                class="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 text-xs text-slate-900 dark:text-white">
            </div>

            <div class="flex items-center justify-end gap-2.5 mt-4 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button type="button" id="modal-cancel-btn" class="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
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
      StorageManager.updateWord(word.id, {
        word: document.getElementById('edit-word-input').value,
        meaning: document.getElementById('edit-meaning-input').value,
        partOfSpeech: document.getElementById('edit-pos-select').value,
        imageUrl: document.getElementById('edit-image-input').value,
        example: document.getElementById('edit-example-input').value
      });
      modalContainer.innerHTML = '';
      this.render();
    };
  }

  openBatchModal() {
    const modalContainer = document.getElementById('mgr-modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-xl font-bold text-slate-900 dark:text-white">📋 텍스트로 대량 단어 추가</h3>
            <button id="modal-close-btn" class="p-1.5 text-slate-400 hover:text-slate-600 text-lg">✕</button>
          </div>

          <p class="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
            한 줄에 하나씩 영단어와 한국어 뜻을 입력해주세요.<br>
            예시:<br>
            <code>apple : 사과</code><br>
            <code>banana - 바나나</code><br>
            <code>serendipity 뜻밖의 행운</code>
          </p>

          <textarea id="batch-textarea" rows="8" placeholder="apple : 사과&#10;banana : 바나나&#10;cat : 고양이"
            class="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-600 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 mb-4"></textarea>

          <div class="flex items-center justify-between">
            <span class="text-xs text-indigo-500 font-semibold" id="batch-preview-count">0개 단어 감지됨</span>
            <div class="flex items-center gap-2">
              <button type="button" id="modal-cancel-btn" class="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600">
                취소
              </button>
              <button type="button" id="batch-submit-btn" class="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow">
                단어장에 일괄 등록
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
        alert('인식 가능한 단어 쌍을 찾을 수 없습니다. 형식을 확인해주세요.');
        return;
      }
      StorageManager.addWordsBatch(parsed);
      alert(`${parsed.length}개의 단어가 단어장에 추가되었습니다!`);
      modalContainer.innerHTML = '';
      this.render();
    };
  }

  openOCRModal() {
    const modalContainer = document.getElementById('mgr-modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>📷</span> <span>단어장 이미지 읽기 (OCR)</span>
            </h3>
            <button id="modal-close-btn" class="p-1.5 text-slate-400 hover:text-slate-600 text-lg">✕</button>
          </div>

          <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">
            단어장 책, 유인물, 캡처 사진을 업로드하면 영단어와 한글 뜻을 자동으로 추출합니다.
          </p>

          <!-- 드래그 앤 드롭 영역 -->
          <div id="ocr-dropzone" class="border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 hover:border-indigo-500 rounded-2xl p-8 text-center cursor-pointer bg-indigo-50/30 dark:bg-indigo-950/20 transition mb-4">
            <div class="text-4xl mb-2">📸</div>
            <div class="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
              이미지 파일을 여기로 끌어다 놓거나 클릭하세요
            </div>
            <div class="text-xs text-slate-400">PNG, JPG, JPEG 이미지 지원</div>
            <input type="file" id="ocr-file-input" accept="image/*" class="hidden">
          </div>

          <!-- 미리보기 및 진행률 바 -->
          <div id="ocr-status-box" class="hidden mb-4">
            <div class="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              <span id="ocr-status-text">이미지 분석 준비 중...</span>
              <span id="ocr-status-percent">0%</span>
            </div>
            <div class="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div id="ocr-progress-bar" class="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-200" style="width: 0%"></div>
            </div>
          </div>

          <!-- 추출된 결과 미리보기 영역 -->
          <div id="ocr-result-area" class="hidden">
            <h4 class="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>인식된 단어 목록</span>
              <span id="ocr-extracted-count" class="text-indigo-600 font-black">0개</span>
            </h4>
            <div id="ocr-words-list" class="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-slate-50 dark:bg-slate-750 rounded-xl mb-4 border border-slate-200 dark:border-slate-700 text-xs">
            </div>

            <div class="flex items-center justify-end gap-2">
              <button id="ocr-cancel-btn" class="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600">
                취소
              </button>
              <button id="ocr-confirm-add-btn" class="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow">
                단어장에 등록하기
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    document.getElementById('modal-close-btn').onclick = () => modalContainer.innerHTML = '';

    const dropzone = document.getElementById('ocr-dropzone');
    const fileInput = document.getElementById('ocr-file-input');

    dropzone.onclick = () => fileInput.click();

    dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('border-indigo-500'); };
    dropzone.ondragleave = () => { dropzone.classList.remove('border-indigo-500'); };
    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-indigo-500');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.processOCRImage(e.dataTransfer.files[0]);
      }
    };

    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        this.processOCRImage(e.target.files[0]);
      }
    };
  }

  async processOCRImage(file) {
    const statusBox = document.getElementById('ocr-status-box');
    const statusText = document.getElementById('ocr-status-text');
    const statusPercent = document.getElementById('ocr-status-percent');
    const progressBar = document.getElementById('ocr-progress-bar');
    const resultArea = document.getElementById('ocr-result-area');
    const wordsList = document.getElementById('ocr-words-list');
    const countEl = document.getElementById('ocr-extracted-count');

    statusBox.classList.remove('hidden');

    try {
      const words = await OCRParser.extractFromImage(file, (percent, msg) => {
        statusPercent.innerText = `${percent}%`;
        statusText.innerText = msg;
        progressBar.style.width = `${percent}%`;
      });

      if (words.length === 0) {
        alert('이미지에서 영단어와 한글 뜻을 명확히 추출하지 못했습니다. 단어장 텍스트 직접 입력을 이용해 보세요.');
        return;
      }

      resultArea.classList.remove('hidden');
      countEl.innerText = `${words.length}개`;
      wordsList.innerHTML = words.map(w => `
        <div class="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <span class="font-bold text-slate-800 dark:text-white">${w.word}</span>
          <span class="text-slate-600 dark:text-slate-300">${w.meaning}</span>
        </div>
      `).join('');

      document.getElementById('ocr-confirm-add-btn').onclick = () => {
        StorageManager.addWordsBatch(words);
        alert(`${words.length}개의 단어가 단어장에 성공적으로 추가되었습니다!`);
        document.getElementById('mgr-modal-container').innerHTML = '';
        this.render();
      };

      document.getElementById('ocr-cancel-btn').onclick = () => {
        document.getElementById('mgr-modal-container').innerHTML = '';
      };

    } catch (err) {
      alert(err.message);
      statusBox.classList.add('hidden');
    }
  }
}
