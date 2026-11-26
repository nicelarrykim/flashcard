// js/admin.js
// 관리자 인증(암호 2217) 및 다중 학습자 프로필 관리 모듈

import { StorageManager } from './storage.js?v=20261126_01';
import { KingdomManager, KINGDOM_TIERS } from './kingdom.js?v=20261126_01';
import { MasteryManager, RANK_TYPES } from './mastery.js?v=20261126_01';
import { FirebaseSyncManager } from './firebaseSync.js?v=20261126_01';

export const ADMIN_PASSWORD = '2217';

export class AdminManager {
  static container = null;

  static init() {
    this.container = document.getElementById('admin-modal-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'admin-modal-container';
      document.body.appendChild(this.container);
    }
  }

  /**
   * 관리자 접근 암호 프롬프트 모달
   */
  static requestAccess() {
    this.init();

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
          <div class="text-center mb-4">
            <div class="w-14 h-14 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl shadow-inner mb-3">
              👑
            </div>
            <h3 class="text-lg font-black text-slate-900 dark:text-white">관리자 인증</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">학습자 프로필을 관리하려면 암호를 입력하세요.</p>
          </div>

          <form id="admin-auth-form" class="space-y-3">
            <div>
              <input type="password" id="admin-pass-input" placeholder="관리자 암호 4자리" maxlength="10" autocomplete="off" autofocus
                class="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-center text-lg font-mono tracking-widest text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
              <p id="admin-auth-error" class="hidden text-xs text-rose-500 font-bold mt-1.5 text-center">암호가 일치하지 않습니다.</p>
            </div>

            <div class="flex items-center gap-2 pt-2">
              <button type="button" id="admin-auth-cancel" class="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300 text-xs font-bold transition">
                취소
              </button>
              <button type="submit" class="flex-1 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white text-xs font-bold shadow-md transition">
                인증 확인
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    const cancelBtn = document.getElementById('admin-auth-cancel');
    if (cancelBtn) cancelBtn.onclick = () => this.close();

    const form = document.getElementById('admin-auth-form');
    const passInput = document.getElementById('admin-pass-input');
    const errorEl = document.getElementById('admin-auth-error');

    if (passInput) {
      setTimeout(() => passInput.focus(), 30);
      passInput.addEventListener('input', () => {
        if (passInput.value.trim() === ADMIN_PASSWORD) {
          this.openAdminPanel();
        }
      });
    }

    form.onsubmit = (e) => {
      e.preventDefault();
      const val = passInput ? passInput.value.trim() : '';
      if (val === ADMIN_PASSWORD) {
        this.openAdminPanel();
      } else {
        if (errorEl) errorEl.classList.remove('hidden');
        if (passInput) {
          passInput.value = '';
          passInput.focus();
        }
      }
    };
  }

  /**
   * 관리자 프로필 관리 메인 모달
   */
  static openAdminPanel() {
    this.init();
    const profiles = StorageManager.getProfiles();
    const activeProfileId = StorageManager.getActiveProfileId();
    const decks = StorageManager.getDecks();
    const totalWordsCount = decks.reduce((sum, d) => sum + ((d && Array.isArray(d.words)) ? d.words.length : 0), 0) || 2475;

    const rankPoints = {
      [RANK_TYPES.RECRUIT]: 1,
      [RANK_TYPES.INFANTRY]: 2,
      [RANK_TYPES.JUNIOR_KNIGHT]: 4,
      [RANK_TYPES.SENIOR_KNIGHT]: 6,
      [RANK_TYPES.HIGH_KNIGHT]: 8,
      [RANK_TYPES.ROYAL_GUARD]: 11,
      [RANK_TYPES.MASTER]: 14
    };

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/80">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-3xl w-full p-5 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[92vh] flex flex-col">
          
          <!-- 상단 헤더 -->
          <div class="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <div>
              <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 text-xs font-black mb-1">
                <span>👑</span> <span>관리자 모드</span>
              </div>
              <h2 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>학습자 프로필 & 성과 관리</span>
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                단어장은 <strong>모든 학습자가 공통</strong>으로 사용하며, 단어별 숙련도 및 <strong>나의 왕국 발전도는 프로필별로 독립적으로 관리</strong>됩니다.
              </p>
            </div>
            <button id="admin-close-btn" class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold">
              ✕
            </button>
          </div>

          <!-- Firebase 실시간 동기화 상태 배너 -->
          <div class="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full ${FirebaseSyncManager.isConnected ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
              <div>
                <span class="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <span>${FirebaseSyncManager.isConnected ? '🔥 Firebase 클라우드 연동 (로컬 우선 체크포인트)' : '💻 단독 로컬 모드 (Firebase 미연결)'}</span>
                </span>
                <p class="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  Cloud Firestore (vocaquest-web)
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1.5 ml-auto flex-wrap">
              <button id="admin-banner-upload-btn" class="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm" title="로컬의 프로필, 단어장, 성과 전체를 Firebase로 일괄 백업/동기화">
                <span>📦</span> <span>전체 데이터 Firebase 백업</span>
              </button>
              <button id="admin-banner-download-btn" class="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm" title="Firebase 원격 데이터를 이 기기로 전체 동기화">
                <span>📥</span> <span>Firebase 데이터 받기</span>
              </button>
              <button id="admin-server-setup-btn" class="px-2.5 py-1 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1 shadow-sm">
                <span>⚙️</span> <span>클라우드 정보</span>
              </button>
            </div>
          </div>

          <!-- 프로필 추가 버튼 바 -->
          <div class="py-3 flex items-center justify-between gap-2 shrink-0">
            <span class="text-xs font-bold text-slate-600 dark:text-slate-300">
              등록된 학습자: <strong>${profiles.length}명</strong>
            </span>
            <button id="admin-add-profile-btn" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition flex items-center gap-1.5">
              <span>➕</span> <span>새 학습자 프로필 추가</span>
            </button>
          </div>

          <!-- 프로필 카드 리스트 (스크롤) -->
          <div class="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
            ${profiles.map(prof => {
              const isActive = prof.id === activeProfileId;
              // 프로필별 성취도 계산 (객체 복사 없이 0ms 즉각 집계)
              const pData = StorageManager.getProfileData(prof.id) || {};
              let memorizedCount = 0;
              let masterCount = 0;
              let totalPoints = 0;

              for (const item of Object.values(pData)) {
                if (item && item.memorized) memorizedCount++;
                const rank = (item && item.mastery && item.mastery.status) || RANK_TYPES.RECRUIT;
                totalPoints += (rankPoints[rank] || 1);
                if (rank === RANK_TYPES.MASTER) masterCount++;
              }

              // 아직 학습하지 않은 나머지 단어들은 기본 신병(RECRUIT: 1pt)으로 가산
              const studiedCount = Object.keys(pData).length;
              const unstudiedCount = Math.max(0, totalWordsCount - studiedCount);
              totalPoints += unstudiedCount * 1;

              const maxPower = Math.max(1, totalWordsCount * 14);
              const progressPct = Math.min(100, Math.max(0, Math.round((totalPoints / maxPower) * 100)));

              let tier = KINGDOM_TIERS.TIER_1;
              if (progressPct >= 80) tier = KINGDOM_TIERS.TIER_5;
              else if (progressPct >= 60) tier = KINGDOM_TIERS.TIER_4;
              else if (progressPct >= 40) tier = KINGDOM_TIERS.TIER_3;
              else if (progressPct >= 20) tier = KINGDOM_TIERS.TIER_2;

              const pPower = { tier, totalPoints };

              return `
                <div class="p-4 rounded-2xl border-2 transition ${isActive ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/40 shadow-md' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-750/50 hover:border-slate-300'}">
                  <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    
                    <!-- 프로필 기본 정보 -->
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-2xl shadow-inner shrink-0">
                        ${prof.avatar || '🛡️'}
                      </div>
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <h4 class="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                            ${prof.name}
                          </h4>
                          ${isActive ? `
                            <span class="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold shadow-sm">
                              ✓ 현재 학습 중
                            </span>
                          ` : ''}
                        </div>
                        <p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          ${prof.description || '등록된 설명 없음'}
                        </p>
                      </div>
                    </div>

                    <!-- 왕국 & 기사단 성취도 요약 뱃지 -->
                    <div class="flex items-center gap-2 text-xs shrink-0 self-stretch sm:self-auto justify-between sm:justify-start bg-slate-100 dark:bg-slate-700/60 p-2 rounded-xl">
                      <div class="text-center px-1.5">
                        <div class="text-[10px] text-slate-400">영지 등급</div>
                        <div class="font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">T${pPower.tier?.level || 1} ${pPower.tier?.name || ''}</div>
                      </div>
                      <div class="w-px h-6 bg-slate-300 dark:bg-slate-600"></div>
                      <div class="text-center px-1.5">
                        <div class="text-[10px] text-slate-400">기사단 포인트</div>
                        <div class="font-black text-amber-500 font-mono">${(pPower.totalPoints || 0)} pts</div>
                      </div>
                      <div class="w-px h-6 bg-slate-300 dark:bg-slate-600"></div>
                      <div class="text-center px-1.5">
                        <div class="text-[10px] text-slate-400">외움 / 마스터</div>
                        <div class="font-bold text-emerald-600 dark:text-emerald-400 font-mono">${memorizedCount}개 / ${masterCount}개</div>
                      </div>
                    </div>

                  </div>

                  <!-- 하단 관리 버튼 그룹 -->
                  <div class="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                    <div class="text-[11px] text-slate-400">
                      생성일: ${new Date(prof.createdAt || Date.now()).toLocaleDateString('ko-KR')}
                    </div>

                    <div class="flex items-center gap-1.5">
                      ${!isActive ? `
                        <button data-action="switch" data-id="${prof.id}" class="prof-action-btn px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold transition">
                          👉 이 프로필로 전환
                        </button>
                      ` : ''}

                      <button data-action="edit" data-id="${prof.id}" class="prof-action-btn px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold transition">
                        ✏️ 수정
                      </button>

                      <button data-action="reset" data-id="${prof.id}" data-name="${prof.name}" class="prof-action-btn px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 font-semibold transition" title="이 학습자의 단어 숙련도를 0점으로 초기화">
                        🔄 성과 초기화
                      </button>

                      ${profiles.length > 1 ? `
                        <button data-action="delete" data-id="${prof.id}" data-name="${prof.name}" class="prof-action-btn px-2 py-1 rounded-lg hover:bg-rose-100 text-rose-500 font-semibold transition" title="프로필 삭제">
                          🗑️
                        </button>
                      ` : ''}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- 하단 푸터 닫기 -->
          <div class="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end shrink-0">
            <button id="admin-done-btn" class="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition shadow">
              관리자 모드 닫기
            </button>
          </div>

        </div>
      </div>
    `;

    this.bindAdminEvents();
  }

  static bindAdminEvents() {
    const closeBtn = document.getElementById('admin-close-btn');
    const doneBtn = document.getElementById('admin-done-btn');
    if (closeBtn) closeBtn.onclick = () => this.close();
    if (doneBtn) doneBtn.onclick = () => this.close();

    // 배너 1. 전체 로컬 데이터(프로필+단어장+성과) Firebase로 일괄 백업
    const bannerUploadBtn = document.getElementById('admin-banner-upload-btn');
    if (bannerUploadBtn) {
      bannerUploadBtn.onclick = async () => {
        if (!confirm('현재 기기의 모든 프로필, 단어장, 학습 성과를 Firebase Cloud Firestore로 업로드하시겠습니까?')) {
          return;
        }
        bannerUploadBtn.disabled = true;
        bannerUploadBtn.innerText = '업로드 중...';
        const res = await FirebaseSyncManager.uploadAllLocalToFirebase(StorageManager);
        bannerUploadBtn.disabled = false;
        bannerUploadBtn.innerHTML = '<span>📦</span> <span>전체 데이터 Firebase 백업</span>';

        if (res.success) {
          alert(`🎉 Firebase 동기화 완료!\n- 프로필: ${res.profilesCount}개\n- 단어장: ${res.decksCount}개\n\n모든 기기에서 실시간으로 즉시 조회 및 연동됩니다.`);
          this.openAdminPanel();
        } else {
          alert(`❌ Firebase 업로드 실패: ${res.error}\n\nFirebase 콘솔에서 Firestore 데이터베이스가 생성되어 있는지 확인하세요.`);
        }
      };
    }

    // 배너 2. Firebase 원격 데이터 내려받기
    const bannerDownloadBtn = document.getElementById('admin-banner-download-btn');
    if (bannerDownloadBtn) {
      bannerDownloadBtn.onclick = async () => {
        if (!confirm('Firebase의 최신 원격 데이터를 내려받아 현재 기기를 갱신하시겠습니까?')) {
          return;
        }
        bannerDownloadBtn.disabled = true;
        bannerDownloadBtn.innerText = '동기화 중...';
        const res = await FirebaseSyncManager.downloadAllFromFirebase(StorageManager);
        bannerDownloadBtn.disabled = false;
        bannerDownloadBtn.innerHTML = '<span>📥</span> <span>Firebase 데이터 받기</span>';

        if (res.success) {
          alert(`🎉 Firebase 데이터 동기화 완료! (프로필 ${res.profilesCount}개, 단어장 ${res.decksCount}개)`);
          this.openAdminPanel();
          window.location.reload();
        } else {
          alert(`❌ Firebase 다운로드 실패: ${res.error}`);
        }
      };
    }

    // 서버 설정 모달 열기 버튼
    const setupBtn = document.getElementById('admin-server-setup-btn');
    if (setupBtn) {
      setupBtn.onclick = () => {
        this.openServerConfigModal();
      };
    }

    // 새 프로필 추가 버튼
    const addBtn = document.getElementById('admin-add-profile-btn');
    if (addBtn) {
      addBtn.onclick = () => {
        const name = prompt('새 학습자 프로필 이름을 입력하세요 (예: 홍길동, 학생 A):');
        if (name && name.trim()) {
          const desc = prompt('학습자 메모/설명 (선택):') || '';
          const avatars = ['🛡️', '⚔️', '🏹', '🧙‍♂️', '🦁', '🦅', '👑', '⭐'];
          const avatar = avatars[Math.floor(Math.random() * avatars.length)];
          const newProf = StorageManager.createProfile(name.trim(), desc.trim(), avatar);
          alert(`'${newProf.name}' 학습자 프로필이 생성되었습니다!`);
          this.openAdminPanel();
        }
      };
    }

    // 각 프로필 카드 액션 버튼들
    this.container.querySelectorAll('.prof-action-btn').forEach(btn => {
      btn.onclick = () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        const name = btn.dataset.name;

        if (action === 'switch') {
          StorageManager.setActiveProfileId(id);
          this.openAdminPanel();
        } else if (action === 'edit') {
          const prof = StorageManager.getProfiles().find(p => p.id === id);
          if (prof) {
            const newName = prompt('학습자 이름을 수정하세요:', prof.name);
            if (newName && newName.trim()) {
              const newDesc = prompt('학습자 메모/설명을 수정하세요:', prof.description || '') || '';
              StorageManager.updateProfile(id, { name: newName.trim(), description: newDesc.trim() });
              this.openAdminPanel();
            }
          }
        } else if (action === 'reset') {
          if (confirm(`⚠️ '${name}' 학습자의 모든 단어 숙련도, 오답노트, 기사단 및 왕국 발전도를 0점으로 완전히 초기화하시겠습니까?`)) {
            StorageManager.resetProfileData(id);
            alert(`'${name}' 학습자의 성과가 초기화되었습니다.`);
            this.openAdminPanel();
          }
        } else if (action === 'delete') {
          if (confirm(`⚠️ '${name}' 학습자 프로필과 해당 학습자의 모든 성과 데이터를 영구히 삭제하시겠습니까?`)) {
            try {
              StorageManager.deleteProfile(id);
              alert('프로필이 삭제되었습니다.');
              this.openAdminPanel();
            } catch (err) {
              alert(err.message);
            }
          }
        }
      };
    });
  }

  /**
   * Firebase 실시간 클라우드 설정 및 상태 안내 모달
   */
  static openServerConfigModal() {
    this.init();
    const isConnected = FirebaseSyncManager.isConnected;
    const activeProf = StorageManager.getActiveProfile();
    const decks = StorageManager.getDecks();
    const profiles = StorageManager.getProfiles();

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/80">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-700">
          
          <div class="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
            <div>
              <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-xs font-black mb-1">
                <span>🔥</span> <span>Firebase Serverless Cloud</span>
              </div>
              <h3 class="text-lg font-black text-slate-900 dark:text-white">클라우드 실시간 동기화 상태</h3>
            </div>
            <button id="server-cfg-close-btn" class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold">
              ✕
            </button>
          </div>

          <div class="py-4 space-y-4 text-xs">
            <!-- 현재 연결 상태 -->
            <div class="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600">
              <span class="font-bold text-slate-700 dark:text-slate-300">Firestore 연결 상태:</span>
              <span class="font-black px-2.5 py-1 rounded-xl text-xs flex items-center gap-1.5 ${isConnected ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300'}">
                <span class="w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}"></span>
                <span>${isConnected ? '실시간 연동 완료 (온라인)' : '로컬 모드 (Firebase 미연결)'}</span>
              </span>
            </div>

            <!-- Firebase 프로젝트 정보 -->
            <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 space-y-1.5 font-mono text-[11px]">
              <div class="flex justify-between">
                <span class="text-slate-500">Project ID:</span>
                <span class="font-bold text-slate-800 dark:text-slate-200">vocaquest-web</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Region:</span>
                <span class="font-bold text-slate-800 dark:text-slate-200">asia-northeast3 (서울)</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Database:</span>
                <span class="font-bold text-emerald-600 dark:text-emerald-400">Cloud Firestore (Serverless)</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">현재 기기 데이터:</span>
                <span class="font-bold text-slate-800 dark:text-slate-200">프로필 ${profiles.length}명 / 단어장 ${decks.length}개</span>
              </div>
            </div>

            <!-- 데이터 백업 및 마이그레이션 도구 카드 -->
            <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 space-y-2">
              <span class="block font-bold text-slate-800 dark:text-slate-200">
                원클릭 데이터 백업 & 동기화 도구:
              </span>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button type="button" id="server-cfg-upload-btn" class="p-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md transition flex flex-col items-center text-center gap-1">
                  <span class="text-xs sm:text-sm">📦 전체 데이터 ➔ Firebase 백업</span>
                  <span class="text-[10px] font-normal opacity-90">현재 기기의 모든 프로필·단어장·성과 업로드</span>
                </button>
                <button type="button" id="server-cfg-download-btn" class="p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs shadow-md transition flex flex-col items-center text-center gap-1">
                  <span class="text-xs sm:text-sm">📥 Firebase ➔ 현재 기기로 동기화</span>
                  <span class="text-[10px] font-normal opacity-90">Firebase 최신 데이터로 로컬 갱신</span>
                </button>
              </div>
            </div>

            <!-- 로컬 우선 체크포인트 동기화 안내 카드 -->
            <div class="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200 space-y-1.5 leading-relaxed">
              <h4 class="font-black text-xs flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                <span>⚡</span> <span>로컬 우선(0ms 지연 없음) + 스마트 체크포인트 동기화</span>
              </h4>
              <ul class="list-disc list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                <li>학습 중에는 네트워크 지연 없이 <strong>100% 로컬(PC/스마트폰/패드)에서 즉시 반응</strong>합니다.</li>
                <li>학습을 마치고 상단의 <strong>[🏁 학습 끝]</strong> 버튼을 누르면 성과가 Firebase에 안전하게 저장되고 최신 단어장이 동기화됩니다.</li>
                <li><strong>프로필을 변경</strong>하면 변경 전 프로필의 성과가 자동 백업되고, 새 프로필의 최신 성과가 자동 다운로드됩니다.</li>
                <li>단어장 드롭다운 옆 <strong>[🔄 단어장 새로고침]</strong> 버튼을 누르면 서버의 최신 단어장을 언제든 다운로드합니다.</li>
              </ul>
            </div>
          </div>

          <div class="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end">
            <button type="button" id="server-cfg-close-bottom" class="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition">
              닫기
            </button>
          </div>

        </div>
      </div>
    `;

    const close = () => this.close();
    const closeBtn = document.getElementById('server-cfg-close-btn');
    const closeBottom = document.getElementById('server-cfg-close-bottom');
    if (closeBtn) closeBtn.onclick = close;
    if (closeBottom) closeBottom.onclick = close;

    const uploadBtn = document.getElementById('server-cfg-upload-btn');
    const downloadBtn = document.getElementById('server-cfg-download-btn');

    // 1. 전체 데이터 Firebase 백업
    if (uploadBtn) {
      uploadBtn.onclick = async () => {
        if (!confirm('현재 기기의 모든 프로필, 단어장, 학습 성과를 Firebase Cloud Firestore로 업로드하시겠습니까?')) return;
        uploadBtn.disabled = true;
        uploadBtn.innerText = '업로드 중...';
        const res = await FirebaseSyncManager.uploadAllLocalToFirebase(StorageManager);
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = `<span>📦 전체 데이터 ➔ Firebase 백업</span>`;

        if (res.success) {
          alert(`🎉 Firebase 동기화 완료!\n- 프로필: ${res.profilesCount}개\n- 단어장: ${res.decksCount}개\n\n모든 기기에서 즉시 실시간으로 연동됩니다.`);
          this.close();
        } else {
          alert(`❌ Firebase 업로드 실패: ${res.error}`);
        }
      };
    }

    // 2. Firebase 원격 데이터 내려받기
    if (downloadBtn) {
      downloadBtn.onclick = async () => {
        if (!confirm('Firebase의 최신 원격 데이터를 내려받아 현재 기기를 갱신하시겠습니까?')) return;
        downloadBtn.disabled = true;
        downloadBtn.innerText = '동기화 중...';
        const res = await FirebaseSyncManager.downloadAllFromFirebase(StorageManager);
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<span>📥 Firebase ➔ 현재 기기로 동기화</span>';

        if (res.success) {
          alert(`🎉 Firebase 데이터 동기화 완료! (프로필 ${res.profilesCount}개, 단어장 ${res.decksCount}개)`);
          this.close();
          window.location.reload();
        } else {
          alert(`❌ Firebase 다운로드 실패: ${res.error}`);
        }
      };
    }
  }

  /**
   * 서버에 저장된 프로필 중 내려받을 프로필 선택 모달
   */
  static openServerProfilePickerModal(serverProfiles, targetUrl = null) {
    this.init();
    const activeProfId = StorageManager.getActiveProfileId();

    this.container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/80">
        <div class="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[85vh] flex flex-col">
          
          <div class="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <div>
              <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[11px] font-black mb-1">
                <span>📥</span> <span>서버 프로필 선택 받기</span>
              </div>
              <h3 class="text-base sm:text-lg font-black text-slate-900 dark:text-white">내려받을 학습자 프로필 선택</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">서버에 보관된 프로필 중 현재 기기로 가져올 학습자를 선택하세요.</p>
            </div>
            <button id="picker-close-btn" class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold">
              ✕
            </button>
          </div>

          <div class="flex-1 overflow-y-auto py-3 space-y-2.5">
            ${serverProfiles.map(prof => {
              const isCurrentLocal = prof.id === activeProfId;
              return `
                <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 hover:border-indigo-400 transition flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="text-2xl shrink-0 p-1 rounded-xl bg-white dark:bg-slate-800 shadow-sm">${prof.avatar || '🛡️'}</span>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="font-black text-sm text-slate-900 dark:text-white truncate">${prof.name}</span>
                        ${isCurrentLocal ? `<span class="text-[9px] px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded-md font-bold">현재 기기 사용중</span>` : ''}
                      </div>
                      <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate">${prof.description || '서버에 저장된 학습 프로필'}</p>
                    </div>
                  </div>
                  <button data-id="${prof.id}" data-name="${prof.name}" class="picker-download-btn shrink-0 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1">
                    <span>📥</span> <span>가져오기</span>
                  </button>
                </div>
              `;
            }).join('')}
          </div>

          <div class="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-end shrink-0">
            <button id="picker-cancel-btn" class="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold transition">
              닫기
            </button>
          </div>

        </div>
      </div>
    `;

    const closeBtn = document.getElementById('picker-close-btn');
    const cancelBtn = document.getElementById('picker-cancel-btn');
    if (closeBtn) closeBtn.onclick = () => this.openServerConfigModal();
    if (cancelBtn) cancelBtn.onclick = () => this.openServerConfigModal();

    this.container.querySelectorAll('.picker-download-btn').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const name = btn.dataset.name;
        if (!confirm(`서버에서 '${name}' 학습자의 성과(단어 외움, 오답, 기사단 등급)를 내려받아 현재 기기에 적용하시겠습니까?`)) {
          return;
        }

        btn.disabled = true;
        btn.innerText = '가져오는 중...';
        const res = await FirebaseSyncManager.downloadSpecificProfile(StorageManager, id);

        if (res.success) {
          alert(`🎉 '${name}' 학습자의 성과를 성공적으로 가져와 현재 학습자로 설정했습니다!`);
          this.close();
        } else {
          btn.disabled = false;
          btn.innerHTML = '<span>📥</span> <span>가져오기</span>';
          alert(`❌ 프로필 성과 가져오기 실패: ${res.error}`);
        }
      };
    });
  }

  static close() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
