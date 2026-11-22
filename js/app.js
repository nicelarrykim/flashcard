// js/app.js
// VocaQuest 메인 앱 컨트롤러, 라우터 및 전역 단어장(Deck) 선택 관리

import { StorageManager } from './storage.js?v=20261122_26';
import { SoundManager } from './tts.js?v=20261122_26';
import { FlashcardGame } from './games/flashcard.js?v=20261122_26';
import { QuizGame } from './games/quiz.js?v=20261122_26';
import { MatchGame } from './games/match.js?v=20261122_26';
import { ScrambleGame } from './games/scramble.js?v=20261122_26';
import { SpeedDropGame } from './games/speed-drop.js?v=20261122_26';
import { WordManager } from './wordManager.js?v=20261122_26';
import { PerformanceView } from './performance.js?v=20261122_26';
import { AdminManager } from './admin.js?v=20261122_26';

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
    this.bindAdmin();
    this.bindGlobalDeckSelector();
    this.bindStudyControls();
    this.bindTabs();
    this.updateStats();
    this.updateActiveProfileBadge();

    // 초기 탭 렌더링
    this.switchTab('flashcard');

    // 서버 동기화 초기화 (비동기)
    StorageManager.initServerSync();

    // 단어 또는 단어장 데이터 변경 감지
    window.addEventListener('vocaquest_words_updated', () => {
      this.updateStats();
      this.renderDeckSelector();
      this.syncStudyControlsUI();
    });

    // 서버 동기화 완료 시 전체 상태 반영
    window.addEventListener('vocaquest_sync_completed', () => {
      this.updateActiveProfileBadge();
      this.updateStats();
      this.renderDeckSelector();
      this.reloadCurrentTab();
    });

    // 서버 연결 상태 변경 감지
    window.addEventListener('vocaquest_server_status_changed', (e) => {
      this.updateServerBadge(e.detail);
    });

    window.addEventListener('vocaquest_decks_updated', () => {
      this.updateStats();
      this.renderDeckSelector();
      this.syncStudyControlsUI();
    });

    window.addEventListener('vocaquest_deck_changed', () => {
      this.updateStats();
      this.renderDeckSelector();
      this.syncStudyControlsUI();
      // 단어장이 바뀌면 현재 열려있는 게임/화면 즉시 재초기화
      this.reloadCurrentTab();
    });

    // 단어장별 그림 위치 변경 감지
    window.addEventListener('vocaquest_deck_image_pos_changed', () => {
      this.syncStudyControlsUI();
      this.reloadCurrentTab();
    });

    // 프로필 변경 감지 (학습자가 바뀌면 해당 학습자 성취도로 전체 화면 즉시 갱신)
    window.addEventListener('vocaquest_profile_changed', () => {
      this.updateActiveProfileBadge();
      this.updateStats();
      this.renderDeckSelector();
      this.reloadCurrentTab();
    });

    window.addEventListener('vocaquest_profiles_updated', () => {
      this.updateActiveProfileBadge();
    });

    // 전역 함수로 탭 전환 등록
    window.switchTab = (tabName) => this.switchTab(tabName);
  }

  bindAdmin() {
    // 헤더 프로필 뱃지 및 네비게이션 관리자 버튼 클릭 시 인증 프롬프트
    const profileBadge = document.getElementById('header-profile-badge');
    const navAdminBtn = document.getElementById('nav-admin-btn');

    if (profileBadge) {
      profileBadge.addEventListener('click', () => {
        AdminManager.requestAccess();
      });
    }

    if (navAdminBtn) {
      navAdminBtn.addEventListener('click', () => {
        AdminManager.requestAccess();
      });
    }
  }

  updateActiveProfileBadge() {
    const prof = StorageManager.getActiveProfile();
    const nameEl = document.getElementById('active-profile-name');
    const avatarEl = document.getElementById('active-profile-avatar');
    if (nameEl && prof) nameEl.innerText = prof.name || '기본 학습자';
    if (avatarEl && prof) avatarEl.innerText = prof.avatar || '🛡️';
  }

  updateServerBadge(detail) {
    const badge = document.getElementById('header-server-badge');
    const dot = document.getElementById('server-status-dot');
    const text = document.getElementById('server-status-text');
    if (!badge || !dot || !text) return;

    if (detail && detail.connected) {
      dot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
      text.innerText = '서버 연동';
      text.className = 'hidden xs:inline text-emerald-700 dark:text-emerald-300 font-bold';
      badge.title = `서버(${detail.serverUrl})와 실시간 동기화 중 (클릭 시 설정)`;
    } else {
      dot.className = 'w-2 h-2 rounded-full bg-slate-400';
      text.innerText = '로컬';
      text.className = 'hidden xs:inline text-slate-500 dark:text-slate-400';
      badge.title = '단독 로컬 모드 (클릭하여 서버 주소 연결)';
    }
  }

  bindHeader() {
    // 서버 연동 뱃지 클릭 시 서버 설정 모달
    const serverBadge = document.getElementById('header-server-badge');
    if (serverBadge) {
      serverBadge.addEventListener('click', () => {
        AdminManager.openServerConfigModal();
      });
    }

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

  /**
   * 번호 범위 학습 & 사진 표시 옵션 바인딩 (기본 접힘, 옵션 선택 후 자동 접기)
   */
  bindStudyControls() {
    this.syncStudyControlsUI();

    const optToggleBtn = document.getElementById('global-study-opt-toggle');
    const optPanel = document.getElementById('global-study-opt-panel');
    const optArrow = document.getElementById('global-opt-arrow');

    if (optToggleBtn && optPanel) {
      optToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = optPanel.classList.contains('hidden');
        if (isHidden) {
          optPanel.classList.remove('hidden');
          if (optArrow) optArrow.innerText = '▴';
        } else {
          optPanel.classList.add('hidden');
          if (optArrow) optArrow.innerText = '▾';
        }
      });

      optPanel.addEventListener('click', (e) => e.stopPropagation());
      document.addEventListener('click', () => {
        if (!optPanel.classList.contains('hidden')) {
          this.closeOptionPanel();
        }
      });
    }

    const rangeToggle = document.getElementById('global-range-toggle');
    const rangeInputs = document.getElementById('global-range-inputs');
    const rangeStart = document.getElementById('global-range-start');
    const rangeEnd = document.getElementById('global-range-end');
    const rangeApplyBtn = document.getElementById('global-range-apply-btn');
    const photoSelect = document.getElementById('global-photo-mode-select');

    if (rangeToggle) {
      rangeToggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        if (rangeInputs) {
          if (enabled) {
            rangeInputs.classList.remove('opacity-50', 'pointer-events-none');
          } else {
            rangeInputs.classList.add('opacity-50', 'pointer-events-none');
          }
        }
        const s = parseInt(rangeStart ? rangeStart.value : 1, 10) || 1;
        const ee = parseInt(rangeEnd ? rangeEnd.value : 50, 10) || 50;
        StorageManager.setStudyRange(enabled, s, ee);
        
        // 체크를 끈 경우 즉시 패널 접기
        if (!enabled) {
          this.closeOptionPanel();
        }
        this.reloadCurrentTab();
      });
    }

    if (rangeApplyBtn) {
      rangeApplyBtn.addEventListener('click', () => {
        const s = parseInt(rangeStart ? rangeStart.value : 1, 10) || 1;
        const ee = parseInt(rangeEnd ? rangeEnd.value : 50, 10) || 50;
        if (s > ee) {
          alert('시작 번호는 끝 번호보다 작거나 같아야 합니다.');
          return;
        }
        StorageManager.setStudyRange(true, s, ee);
        if (rangeToggle) rangeToggle.checked = true;
        if (rangeInputs) rangeInputs.classList.remove('opacity-50', 'pointer-events-none');
        
        // 옵션 선택 후 즉시 접기
        this.closeOptionPanel();
        this.reloadCurrentTab();
      });
    }

    if (photoSelect) {
      photoSelect.addEventListener('change', (e) => {
        StorageManager.setPhotoDisplayMode(e.target.value);
        // 옵션 선택 후 즉시 접기
        this.closeOptionPanel();
        this.reloadCurrentTab();
      });
    }

    const imagePosSelect = document.getElementById('global-deck-image-pos-select');
    if (imagePosSelect) {
      imagePosSelect.addEventListener('change', (e) => {
        const activeId = StorageManager.getActiveDeckId();
        StorageManager.setDeckImagePosition(activeId, e.target.value);
        // 옵션 선택 후 즉시 접기
        this.closeOptionPanel();
        this.reloadCurrentTab();
      });
    }
  }

  closeOptionPanel() {
    const optPanel = document.getElementById('global-study-opt-panel');
    const optArrow = document.getElementById('global-opt-arrow');
    if (optPanel) {
      optPanel.classList.add('hidden');
    }
    if (optArrow) {
      optArrow.innerText = '▾';
    }
    this.syncStudyControlsUI();
  }

  syncStudyControlsUI() {
    const range = StorageManager.getStudyRange();
    const photoMode = StorageManager.getPhotoDisplayMode();
    const activeDeckId = StorageManager.getActiveDeckId();
    const imagePos = StorageManager.getDeckImagePosition(activeDeckId);

    const rangeToggle = document.getElementById('global-range-toggle');
    const rangeInputs = document.getElementById('global-range-inputs');
    const rangeStart = document.getElementById('global-range-start');
    const rangeEnd = document.getElementById('global-range-end');
    const photoSelect = document.getElementById('global-photo-mode-select');
    const imagePosSelect = document.getElementById('global-deck-image-pos-select');
    const summaryBadge = document.getElementById('global-study-opt-summary');

    if (rangeToggle) {
      rangeToggle.checked = !!range.enabled;
    }
    if (rangeInputs) {
      if (range.enabled) {
        rangeInputs.classList.remove('opacity-50', 'pointer-events-none');
      } else {
        rangeInputs.classList.add('opacity-50', 'pointer-events-none');
      }
    }
    if (rangeStart) rangeStart.value = range.start || 1;
    if (rangeEnd) rangeEnd.value = range.end || 50;
    if (photoSelect) photoSelect.value = photoMode || 'auto';
    if (imagePosSelect) imagePosSelect.value = imagePos || 'meaning';

    // 옵션 요약 배지 업데이트
    if (summaryBadge) {
      const parts = [];
      if (range.enabled) {
        parts.push(`${range.start}~${range.end}번`);
      }
      if (photoMode === 'always_on') {
        parts.push('사진ON');
      } else if (photoMode === 'always_off') {
        parts.push('사진OFF');
      }
      if (imagePos === 'word') {
        parts.push('그림:단어');
      }
      summaryBadge.innerText = parts.length > 0 ? parts.join('·') : '기본';
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
