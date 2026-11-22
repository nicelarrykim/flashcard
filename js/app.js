// js/app.js
// VocaQuest 메인 앱 컨트롤러, 라우터 및 전역 단어장(Deck) 선택 관리

import { StorageManager } from './storage.js?v=20261122_09';
import { SoundManager } from './tts.js?v=20261122_09';
import { FlashcardGame } from './games/flashcard.js?v=20261122_09';
import { QuizGame } from './games/quiz.js?v=20261122_09';
import { MatchGame } from './games/match.js?v=20261122_09';
import { ScrambleGame } from './games/scramble.js?v=20261122_09';
import { SpeedDropGame } from './games/speed-drop.js?v=20261122_09';
import { WordManager } from './wordManager.js?v=20261122_09';
import { PerformanceView } from './performance.js?v=20261122_09';

class App {
  constructor() {
    this.currentTab = 'flashcard';
    this.flashcardGame = new FlashcardGame('tab-flashcard');
    this.quizGame = new QuizGame('tab-quiz');
    this.matchGame = new MatchGame('tab-match');
    this.scrambleGame = new ScrambleGame('tab-scramble');
    this.speedDropGame = new SpeedDropGame('tab-speed-drop');
    this.wordManager = new WordManager('tab-manager');
    this.performanceView = new PerformanceView('tab-performance');
  }

  init() {
    // 왕실근위대 2일 초과 자동 강등 확인
    StorageManager.checkRoyalGuardDemotions();

    this.bindHeader();
    this.bindGlobalDeckSelector();
    this.bindTabs();
    this.updateStats();

    // 초기 탭 렌더링
    this.switchTab('flashcard');

    // 단어 또는 단어장 데이터 변경 감지
    window.addEventListener('vocaquest_words_updated', () => {
      this.updateStats();
      this.renderDeckSelector();
    });

    window.addEventListener('vocaquest_decks_updated', () => {
      this.updateStats();
      this.renderDeckSelector();
    });

    window.addEventListener('vocaquest_deck_changed', () => {
      this.updateStats();
      this.renderDeckSelector();
      // 단어장이 바뀌면 현재 열려있는 게임/화면 즉시 재초기화
      this.reloadCurrentTab();
    });

    // 전역 함수로 탭 전환 등록
    window.switchTab = (tabName) => this.switchTab(tabName);
  }

  bindHeader() {
    // 음소거 토글
    const soundBtn = document.getElementById('header-sound-btn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        SoundManager.soundEnabled = !SoundManager.soundEnabled;
        soundBtn.innerHTML = SoundManager.soundEnabled ? '🔊' : '🔇';
        soundBtn.title = SoundManager.soundEnabled ? '효과음 켜짐' : '효과음 꺼짐';
      });
    }

    // 다크 모드 토글
    const themeBtn = document.getElementById('header-theme-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        themeBtn.innerHTML = isDark ? '☀️' : '🌙';
        const settings = StorageManager.getSettings();
        settings.darkMode = isDark;
        StorageManager.saveSettings(settings);
      });
    }

    // 저장된 다크 모드 복원
    const savedSettings = StorageManager.getSettings();
    if (savedSettings.darkMode) {
      document.documentElement.classList.add('dark');
      if (themeBtn) themeBtn.innerHTML = '☀️';
    }
  }

  /**
   * 전역 단어장(Deck) 선택 드롭다운 및 새 단어장 생성
   */
  bindGlobalDeckSelector() {
    this.renderDeckSelector();

    const selectEl = document.getElementById('global-deck-select');
    if (selectEl) {
      selectEl.addEventListener('change', (e) => {
        StorageManager.setActiveDeckId(e.target.value);
      });
    }

    const createBtn = document.getElementById('global-create-deck-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        this.openCreateDeckPrompt();
      });
    }
  }

  renderDeckSelector() {
    const selectEl = document.getElementById('global-deck-select');
    const descEl = document.getElementById('global-deck-desc');
    if (!selectEl) return;

    const decks = StorageManager.getDecks();
    const activeId = StorageManager.getActiveDeckId();
    const activeDeck = StorageManager.getActiveDeck();

    selectEl.innerHTML = `
      ${decks.map(d => `
        <option value="${d.id}" ${d.id === activeId ? 'selected' : ''}>
          📁 ${d.name || '단어장'} (${(d.words || []).length}단어)
        </option>
      `).join('')}
      <option value="all" ${activeId === 'all' ? 'selected' : ''}>
        🌐 전체 단어장 통합 (${decks.reduce((sum, d) => sum + ((d && d.words) ? d.words.length : 0), 0)}단어)
      </option>
    `;

    if (descEl && activeDeck) {
      descEl.innerHTML = `<span>ℹ️</span> <span>${activeDeck.description || activeDeck.name || '단어장'}</span>`;
    }
  }

  openCreateDeckPrompt() {
    const name = prompt('새로 만들 단어장 이름을 입력해주세요 (예: Day 2 필수 단어장):');
    if (name && name.trim()) {
      const desc = prompt('단어장 간단 설명을 입력해주세요 (선택):') || '';
      const newDeck = StorageManager.createDeck(name.trim(), desc.trim());
      alert(`'${newDeck.name}' 단어장이 생성되었습니다! 이제 이 단어장에 단어를 추가하거나 사진을 스캔해보세요.`);
      this.switchTab('manager');
    }
  }

  bindTabs() {
    const tabButtons = document.querySelectorAll('.nav-tab');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });
  }

  switchTab(tabName) {
    if (this.currentTab === 'speed-drop' && tabName !== 'speed-drop') {
      this.speedDropGame.stop();
    }

    this.currentTab = tabName;

    document.querySelectorAll('.nav-tab').forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active', 'bg-indigo-600', 'text-white', 'shadow-md', 'shadow-indigo-500/20');
        btn.classList.remove('text-slate-600', 'dark:text-slate-400', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
      } else {
        btn.classList.remove('active', 'bg-indigo-600', 'text-white', 'shadow-md', 'shadow-indigo-500/20');
        btn.classList.add('text-slate-600', 'dark:text-slate-400', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
      }
    });

    document.querySelectorAll('.tab-content').forEach(section => {
      section.classList.add('hidden');
    });

    const activeSection = document.getElementById(`tab-${tabName}`);
    if (activeSection) {
      activeSection.classList.remove('hidden');
    }

    this.reloadCurrentTab();
  }

  reloadCurrentTab() {
    const tabName = this.currentTab;
    if (tabName === 'flashcard') {
      this.flashcardGame.init();
    } else if (tabName === 'quiz') {
      this.quizGame.init();
    } else if (tabName === 'match') {
      this.matchGame.init();
    } else if (tabName === 'scramble') {
      this.scrambleGame.init();
    } else if (tabName === 'speed-drop') {
      this.speedDropGame.init();
    } else if (tabName === 'manager') {
      this.wordManager.init();
    } else if (tabName === 'performance') {
      this.performanceView.init();
    }
  }

  updateStats() {
    const activeWords = (StorageManager.getActiveWords() || []).filter(Boolean);
    const memorized = activeWords.filter(w => w && w.memorized).length;
    const wrong = activeWords.filter(w => w && (w.wrongCount || 0) > 0).length;

    const totalEl = document.getElementById('stat-total-words');
    const memorizedEl = document.getElementById('stat-memorized-words');
    const wrongEl = document.getElementById('stat-wrong-words');

    if (totalEl) totalEl.innerText = activeWords.length;
    if (memorizedEl) memorizedEl.innerText = memorized;
    if (wrongEl) wrongEl.innerText = wrong;
  }
}

function startApp() {
  try {
    const app = new App();
    app.init();
    window.vocaQuestApp = app;
  } catch (err) {
    console.error('VocaQuest App initialization error:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  // DOMContentLoaded가 이미 발생한 경우 (ES Module 지연 로딩 특성) 즉시 실행
  startApp();
}
