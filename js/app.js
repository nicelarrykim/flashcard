// js/app.js
// VocaQuest 메인 앱 컨트롤러 및 라우터

import { StorageManager } from './storage.js';
import { SoundManager } from './tts.js';
import { FlashcardGame } from './games/flashcard.js';
import { QuizGame } from './games/quiz.js';
import { MatchGame } from './games/match.js';
import { ScrambleGame } from './games/scramble.js';
import { SpeedDropGame } from './games/speed-drop.js';
import { WordManager } from './wordManager.js';

class App {
  constructor() {
    this.currentTab = 'flashcard';
    this.flashcardGame = new FlashcardGame('tab-flashcard');
    this.quizGame = new QuizGame('tab-quiz');
    this.matchGame = new MatchGame('tab-match');
    this.scrambleGame = new ScrambleGame('tab-scramble');
    this.speedDropGame = new SpeedDropGame('tab-speed-drop');
    this.wordManager = new WordManager('tab-manager');
  }

  init() {
    this.bindHeader();
    this.bindTabs();
    this.updateStats();

    // 초기 탭 렌더링
    this.switchTab('flashcard');

    // 단어 데이터 변경 감지
    window.addEventListener('vocaquest_words_updated', () => {
      this.updateStats();
    });

    // 전역 함수로 탭 전환 등록 (HTML 인라인 버튼에서 호출 가능하도록)
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
    // 이전 게임이 구동 중이면 정리 (특히 애니메이션 루프가 있는 SpeedDrop)
    if (this.currentTab === 'speed-drop' && tabName !== 'speed-drop') {
      this.speedDropGame.stop();
    }

    this.currentTab = tabName;

    // 탭 버튼 스타일 갱신
    document.querySelectorAll('.nav-tab').forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active', 'bg-indigo-600', 'text-white', 'shadow-md', 'shadow-indigo-500/20');
        btn.classList.remove('text-slate-600', 'dark:text-slate-400', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
      } else {
        btn.classList.remove('active', 'bg-indigo-600', 'text-white', 'shadow-md', 'shadow-indigo-500/20');
        btn.classList.add('text-slate-600', 'dark:text-slate-400', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
      }
    });

    // 탭 콘텐츠 영역 표시/숨김
    document.querySelectorAll('.tab-content').forEach(section => {
      section.classList.add('hidden');
    });

    const activeSection = document.getElementById(`tab-${tabName}`);
    if (activeSection) {
      activeSection.classList.remove('hidden');
    }

    // 각 게임/화면 초기화 실행
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
    }
  }

  updateStats() {
    const allWords = StorageManager.getWords();
    const memorized = allWords.filter(w => w.memorized).length;
    const wrong = allWords.filter(w => (w.wrongCount || 0) > 0).length;

    const totalEl = document.getElementById('stat-total-words');
    const memorizedEl = document.getElementById('stat-memorized-words');
    const wrongEl = document.getElementById('stat-wrong-words');

    if (totalEl) totalEl.innerText = allWords.length;
    if (memorizedEl) memorizedEl.innerText = memorized;
    if (wrongEl) wrongEl.innerText = wrong;
  }
}

// DOM 로드 시 앱 기동
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
