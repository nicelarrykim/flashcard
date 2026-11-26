// js/app.js
// VocaQuest 메인 앱 컨트롤러, 라우터 및 전역 단어장(Deck) 선택 관리

import { StorageManager } from './storage.js?v=20261126_01';
import { FirebaseSyncManager } from './firebaseSync.js?v=20261126_01';
import { IdbBackup } from './idbBackup.js?v=20261126_01';
import { AdminLogger } from './adminLogger.js?v=20261126_01';
import { SoundManager } from './tts.js?v=20261126_01';
import { FlashcardGame } from './games/flashcard.js?v=20261126_01';
import { QuizGame } from './games/quiz.js?v=20261126_01';
import { MatchGame } from './games/match.js?v=20261126_01';
import { ScrambleGame } from './games/scramble.js?v=20261126_01';
import { SpeedDropGame } from './games/speed-drop.js?v=20261126_01';
import { RoyalExamGame } from './games/royal-exam.js?v=20261126_01';
import { WordManager } from './wordManager.js?v=20261126_01';
import { PerformanceView } from './performance.js?v=20261126_01';
import { AdminManager } from './admin.js?v=20261126_01';
import { SiegeGame } from './games/siege.js?v=20261126_01';

class App {
  constructor() {
    this.currentTab = 'flashcard';
    this.flashcardGame = new FlashcardGame('tab-flashcard');
    this.quizGame = new QuizGame('tab-quiz');
    this.matchGame = new MatchGame('tab-match');
    this.scrambleGame = new ScrambleGame('tab-scramble');
    this.speedDropGame = new SpeedDropGame('tab-speed-drop');
    this.royalExamGame = new RoyalExamGame('tab-royal-exam');
    this.wordManager = new WordManager('tab-manager');
    this.performanceView = new PerformanceView('tab-performance');
  }

  init() {
    // ADMIN 프로필 자동 확보 및 활성 상태 반영
    StorageManager.ensureAdminProfile();
    AdminLogger.updateAdminState(StorageManager.getActiveProfile());

    // 왕실근위대 2일 초과 자동 강등 확인
    StorageManager.checkRoyalGuardDemotions();

    this.bindHeader();
    this.bindAdmin();
    this.bindGlobalDeckSelector();
    this.bindStudyControls();
    this.bindTabs();
    this.updateStats();
    this.updateActiveProfileBadge();

    // 1. 첫 화면(플래시카드) 즉시 렌더링
    this.switchTab('flashcard');

    // 2. 화면이 뜬 직후 백그라운드에서 영구 저장소 요청, IndexedDB 복구 및 Firebase 자동 백업 가동
    setTimeout(async () => {
      IdbBackup.requestPersistentStorage();
      const backupRes = await IdbBackup.syncOrRestore(StorageManager);
      if (backupRes && backupRes.restored) {
        StorageManager.ensureAdminProfile();
        AdminLogger.updateAdminState(StorageManager.getActiveProfile());
        this.updateStats();
        this.updateActiveProfileBadge();
        this.reloadCurrentTab();
      }
      if (typeof FirebaseSyncManager !== 'undefined' && typeof FirebaseSyncManager.initSync === 'function') {
        FirebaseSyncManager.initSync(StorageManager).catch(err => {
          AdminLogger.log('ERROR', 'Firebase 초기 동기화 경고', err.message);
          console.warn('[VocaQuest] Firebase 동기화 초기화 경고:', err);
        });
      }
    }, 50);

    // 브라우저 탭/화면 전환(백그라운드 진입) 감지 시 게임 정지 + 로컬/Firebase 즉시 백업
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        AdminLogger.log('EVENT', '앱 백그라운드 진입(visibilitychange) → 즉시 백업 실행');
        StorageManager.flushPendingProfileSaves();
        FirebaseSyncManager.flushDirtySync(StorageManager);
        this.stopAllGames();
        // 퀴즈나 배틀 중 백그라운드로 전환되었다가 돌아올 때를 대비해 상태를 대기 화면으로 정리
        if (this.currentTab === 'quiz') {
          this.quizGame.init();
        } else if (this.currentTab === 'speed-drop') {
          this.speedDropGame.init();
        } else if (this.currentTab === 'match') {
          this.matchGame.init();
        } else if (this.currentTab === 'scramble') {
          this.scrambleGame.init();
        }
      }
    });

    // 디바운스된 탭 리로드 헬퍼
    let reloadDebounceTimer = null;
    const debouncedReload = () => {
      if (reloadDebounceTimer) clearTimeout(reloadDebounceTimer);
      reloadDebounceTimer = setTimeout(() => {
        this.reloadCurrentTab();
      }, 60);
    };

    // 단어 또는 단어장 데이터 변경 감지 (통계 & 셀렉터 UI만 가볍게 갱신)
    window.addEventListener('vocaquest_words_updated', () => {
      this.updateStats();
      this.renderDeckSelector();
      this.syncStudyControlsUI();
    });

    // 단어 숙련도 변경 감지 (상단 통계 pill만 0ms 즉시 갱신)
    window.addEventListener('vocaquest_mastery_changed', (e) => {
      this.updateStats();
      if (e.detail && e.detail.action) {
        AdminLogger.log('MASTERY', `단어 학습 반영 (${e.detail.action})`, {
          wordId: e.detail.wordId,
          score: `${e.detail.oldScore}→${e.detail.newScore}`,
          rank: `${e.detail.oldRank}→${e.detail.newRank}`
        });
      }
    });

    window.addEventListener('vocaquest_rank_promoted', (e) => {
      if (e.detail && e.detail.word) {
        AdminLogger.log('MASTERY', `등급 승급! '${e.detail.word.word}' → ${e.detail.toRank}`);
      }
    });

    // 단어장 목록 변경 감지 (진행 중인 게임 리로드 금지 - 셀렉터 목록만 갱신)
    window.addEventListener('vocaquest_decks_updated', () => {
      this.updateStats();
      this.renderDeckSelector();
    });

    // Firebase 원격 학습 성취도 실시간 업데이트 감지 (초기 로드에서 원격 갱신이 있으면 현재 탭도 즉시 반영)
    window.addEventListener('vocaquest_progress_updated', (e) => {
      this.updateStats();
      if (e.detail && e.detail.fromInit && e.detail.hasRemoteUpdates) {
        this.reloadCurrentTab();
      }
    });

    // 프로필 업데이트 감지
    window.addEventListener('vocaquest_profiles_updated', () => {
      this.updateActiveProfileBadge();
    });

    // 서버/Firebase 전체 동기화 완료 시에만 전체 상태 반영
    window.addEventListener('vocaquest_sync_completed', () => {
      this.updateActiveProfileBadge();
      this.updateStats();
      this.renderDeckSelector();
      this.reloadCurrentTab();
    });

    // 단어장이 바뀌면 현재 열려있는 게임/화면 즉시 재초기화
    window.addEventListener('vocaquest_deck_changed', () => {
      this.updateStats();
      this.renderDeckSelector();
      this.syncStudyControlsUI();
      this.reloadCurrentTab();
    });

    // 단어장별 그림 위치 변경 감지
    window.addEventListener('vocaquest_deck_image_pos_changed', () => {
      this.syncStudyControlsUI();
      this.reloadCurrentTab();
    });

    // 프로필 변경 감지 (학습자가 바뀌면 해당 학습자 성취도로 전체 화면 즉시 갱신)
    window.addEventListener('vocaquest_profile_changed', () => {
      AdminLogger.updateAdminState(StorageManager.getActiveProfile());
      this.updateActiveProfileBadge();
      this.updateStats();
      this.renderDeckSelector();
      this.reloadCurrentTab();
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
      dot.className = 'w-2 h-2 rounded-full bg-emerald-500';
      text.innerText = detail.isFirebase ? '🔥 Firebase 연동' : '동기화 연결됨';
      text.className = 'hidden xs:inline text-emerald-700 dark:text-emerald-300 font-bold';
      badge.title = `Firebase Firestore 연동 중 (로컬 우선 체크포인트 모드 - 클릭 시 설정)`;
    } else {
      dot.className = 'w-2 h-2 rounded-full bg-slate-400';
      text.innerText = '로컬 모드';
      text.className = 'hidden xs:inline text-slate-500 dark:text-slate-400 font-bold';
      badge.title = 'Firebase 미연결 (로컬 저장소 모드 - 클릭 시 설정)';
    }
  }

  bindHeader() {
    // 🏁 [학습 끝] 버튼 클릭 이벤트
    const finishBtn = document.getElementById('header-finish-study-btn');
    if (finishBtn) {
      finishBtn.addEventListener('click', async () => {
        const activeProf = StorageManager.getActiveProfile();
        const profName = activeProf?.name || '학습자';
        if (!confirm(`'${profName}' 님의 오늘 학습 성과를 서버(Firebase)에 저장하고 학습을 마치시겠습니까?`)) {
          return;
        }

        const origHtml = finishBtn.innerHTML;
        finishBtn.disabled = true;
        finishBtn.innerHTML = '<span>⏳ 저장중...</span>';

        const res = await FirebaseSyncManager.finishStudySession(StorageManager);

        finishBtn.disabled = false;
        finishBtn.innerHTML = origHtml;

        if (res.success) {
          alert(`🎉 [학습 완료]\n'${res.profileName}' 님의 학습 성과(단어 ${res.wordCount}개)가 서버에 안전하게 저장되었습니다!\n최신 단어장 ${res.decksCount}개도 동기화되었습니다.`);
        } else {
          alert(`❌ 성과 저장 실패: ${res.error}\n(네트워크 또는 서버 설정을 확인해주세요)`);
        }
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

    const refreshDecksBtn = document.getElementById('global-refresh-decks-btn');
    const refreshIcon = document.getElementById('refresh-decks-icon');
    if (refreshDecksBtn) {
      refreshDecksBtn.addEventListener('click', async () => {
        if (refreshIcon) refreshIcon.classList.add('animate-spin');
        refreshDecksBtn.disabled = true;

        const res = await FirebaseSyncManager.downloadLatestDecks(StorageManager);

        if (refreshIcon) refreshIcon.classList.remove('animate-spin');
        refreshDecksBtn.disabled = false;

        if (res.success) {
          this.renderDeckSelector();
          this.reloadCurrentTab();
          alert(`🔄 서버의 최신 단어장(${res.count}개)을 로컬로 새로고침했습니다!`);
        } else {
          alert(`❌ 단어장 새로고침 실패: ${res.error}`);
        }
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
    const activeProf = StorageManager.getActiveProfile();
    const activeId = StorageManager.getActiveDeckId();
    const activeDeck = StorageManager.getActiveDeck();

    const publicDecks = decks.filter(d => d.isPublic === true || !d.profileId);
    const privateDecks = decks.filter(d => d.isPublic !== true && d.profileId);

    let html = '';
    if (publicDecks.length > 0) {
      html += `<optgroup label="🌐 공용 단어장 (공통)">`;
      publicDecks.forEach(d => {
        html += `<option value="${d.id}" ${d.id === activeId ? 'selected' : ''}>
          🌐 ${d.name || '단어장'} (${(d.words || []).length}단어)
        </option>`;
      });
      html += `</optgroup>`;
    }

    if (privateDecks.length > 0) {
      const profName = activeProf ? activeProf.name : '학습자';
      html += `<optgroup label="👤 ${profName}의 개인 단어장">`;
      privateDecks.forEach(d => {
        html += `<option value="${d.id}" ${d.id === activeId ? 'selected' : ''}>
          ⭐ ${d.name || '단어장'} (${(d.words || []).length}단어)
        </option>`;
      });
      html += `</optgroup>`;
    }

    html += `<option value="all" ${activeId === 'all' ? 'selected' : ''}>
      ✨ 전체 단어장 통합 (${decks.reduce((sum, d) => sum + ((d && d.words) ? d.words.length : 0), 0)}단어)
    </option>`;

    selectEl.innerHTML = html;

    if (descEl && activeDeck) {
      const isPublic = StorageManager.isDeckPublic(activeDeck.id);
      const badge = isPublic ? '🌐 공용' : '👤 개인';
      descEl.innerHTML = `<span class="px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 mr-1">${badge}</span><span>${activeDeck.description || activeDeck.name || '단어장'}</span>`;
    }
  }

  openCreateDeckPrompt() {
    const name = prompt('새로 만들 단어장 이름을 입력해주세요 (예: Day 2 필수 단어장):');
    if (!name || !name.trim()) return;

    const desc = prompt('단어장 간단 설명을 입력해주세요 (선택):') || '';
    const activeProf = StorageManager.getActiveProfile();
    const profName = activeProf ? activeProf.name : '현재 학습자';

    let isPublic = false;
    const makePublic = confirm(`이 단어장을 모든 학습자가 함께 보는 [🌐 공용 단어장]으로 생성하시겠습니까?\n\n- [확인]: 관리자 공용 단어장 (암호 2217 필요)\n- [취소]: [${profName}] 전용 개인 단어장`);
    if (makePublic) {
      const pw = prompt('공용 단어장 생성을 위해 관리자 암호를 입력하세요:');
      if (pw === '2217') {
        isPublic = true;
      } else {
        alert('암호가 올바르지 않습니다. [개인 단어장]으로 생성됩니다.');
      }
    }

    const newDeck = StorageManager.createDeck(name.trim(), desc.trim(), [], 'meaning', isPublic);
    const typeLabel = isPublic ? '🌐 공용 단어장' : `👤 [${profName}] 개인 단어장`;
    alert(`🎉 '${newDeck.name}' (${typeLabel})이(가) 생성되었습니다!\n이제 이 단어장에 단어를 추가하거나 사진을 스캔해보세요.`);
    this.switchTab('manager');
  }

  bindTabs() {
    const tabButtons = document.querySelectorAll('.nav-tab');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    // 상단 네비게이션 공성전 버튼
    const navSiegeBtn = document.getElementById('nav-siege-btn');
    if (navSiegeBtn) {
      navSiegeBtn.addEventListener('click', () => {
        const siege = new SiegeGame();
        siege.open();
      });
    }

    // 전역 바로가기 함수
    window.openSiegeGame = () => {
      const siege = new SiegeGame();
      siege.open();
    };
  }

  /**
   * 진행 중인 모든 게임의 타이머, 애니메이션 루프 및 효과음 완전 종료
   */
  stopAllGames() {
    // 1. 사지선다 스피드 퀴즈 카운트다운 타이머 정지
    if (this.quizGame && typeof this.quizGame.stop === 'function') {
      this.quizGame.stop();
    }
    // 2. 짝맞추기 게임 타이머 및 상태 완전 정지
    if (this.matchGame && typeof this.matchGame.stop === 'function') {
      this.matchGame.stop();
    }
    // 3. 단어 낙하 방패 애니메이션 및 드래그 완전 정지
    if (this.speedDropGame && typeof this.speedDropGame.stop === 'function') {
      this.speedDropGame.stop();
    }
    // 4. 스펠링 맞추기(스크램블) 상태 및 타이머 정지
    if (this.scrambleGame && typeof this.scrambleGame.stop === 'function') {
      this.scrambleGame.stop();
    }
    // 4-1. 근위대 승급 심사 소리 및 상태 정지
    if (this.royalExamGame && typeof this.royalExamGame.stop === 'function') {
      this.royalExamGame.stop();
    }
    // 5. 공성전 배틀 루프 정지 및 모달 닫기
    if (typeof SiegeGame !== 'undefined' && typeof SiegeGame.closeActiveGame === 'function') {
      SiegeGame.closeActiveGame();
    }
    // 6. 현재 재생 중인 TTS 및 오디오 정지
    if (typeof SoundManager !== 'undefined' && typeof SoundManager.stop === 'function') {
      SoundManager.stop();
    }
  }

  switchTab(tabName) {
    // 다른 탭으로 이동 시 이전 탭에서 진행 중이던 모든 게임/타이머를 완전히 종료
    if (this.currentTab !== tabName) {
      this.stopAllGames();
      StorageManager.flushPendingProfileSaves();
      if (FirebaseSyncManager._dirtyProfileIds && FirebaseSyncManager._dirtyProfileIds.size > 0) {
        AdminLogger.log('EVENT', `탭 전환(${this.currentTab} → ${tabName}) → 변경사항 자동 백업 실행`);
      }
      FirebaseSyncManager.flushDirtySync(StorageManager);
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
    } else if (tabName === 'royal-exam') {
      this.royalExamGame.init();
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

    // 근위대 승급 심사 대기 단어 수 뱃지 갱신
    const royalExamCountEl = document.getElementById('nav-royal-exam-count');
    if (royalExamCountEl) {
      const royalCount = activeWords.filter(w => {
        return w && w.mastery && w.mastery.status === 'royal_guard';
      }).length;

      if (royalCount > 0) {
        royalExamCountEl.innerText = royalCount;
        royalExamCountEl.classList.remove('hidden');
      } else {
        royalExamCountEl.classList.add('hidden');
      }
    }
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
