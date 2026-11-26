// js/firebaseSync.js
// VocaQuest 로컬 우선 체크포인트 동기화 모듈 (Local-First Checkpoint Sync)
// 실시간 리스너(onSnapshot)를 배제하고, 명시적 시점([학습 끝], 프로필 변경, 수동 새로고침)에만 단발성으로 안전하게 통신합니다.

import { db, isFirebaseConfigured } from './firebaseConfig.js?v=20261126_01';
import { AdminLogger } from './adminLogger.js?v=20261126_01';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc 
} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

export class FirebaseSyncManager {
  static isSyncing = false;
  static _storageManager = null;
  static _dirtyProfileIds = new Set();
  static _dirtyWordIdsByProfile = new Map();

  static get isConnected() {
    return Boolean(db && isFirebaseConfigured());
  }

  /**
   * 단어 성취도 엔트리의 최종 수정 시각(ms) 추출
   */
  static getEntryTimestamp(entry) {
    if (!entry || typeof entry !== 'object') return 0;
    if (entry.mastery && typeof entry.mastery.updatedAt === 'number') {
      return entry.mastery.updatedAt;
    }
    if (typeof entry.updatedAt === 'number') {
      return entry.updatedAt;
    }
    return 0;
  }

  /**
   * 두 성취도 맵(local, remote)을 단어별 최신 updatedAt 기준으로 안전하게 병합
   * 구버전 기기의 옛날 데이터가 최신 기기의 높은 등급/점수를 덮어쓰는 것을 방지합니다.
   */
  static mergeProfileProgressData(localData = {}, remoteData = {}) {
    const merged = {};
    const allKeys = new Set([
      ...Object.keys(localData || {}),
      ...Object.keys(remoteData || {})
    ]);

    for (const wordId of allKeys) {
      const l = localData ? localData[wordId] : undefined;
      const r = remoteData ? remoteData[wordId] : undefined;

      if (l && !r) {
        merged[wordId] = l;
      } else if (!l && r) {
        merged[wordId] = r;
      } else if (l && r) {
        const lTs = this.getEntryTimestamp(l);
        const rTs = this.getEntryTimestamp(r);
        if (rTs > lTs) {
          merged[wordId] = r;
        } else if (lTs > rTs) {
          merged[wordId] = l;
        } else {
          // 타임스탬프가 동일하면 더 높은 마스터 티어 / 점수 우선
          const lTier = l.mastery?.masterTier || 0;
          const rTier = r.mastery?.masterTier || 0;
          const lScore = l.mastery?.score || 0;
          const rScore = r.mastery?.score || 0;
          if (rTier > lTier || (rTier === lTier && rScore > lScore)) {
            merged[wordId] = r;
          } else {
            merged[wordId] = l;
          }
        }
      }
    }
    return merged;
  }

  /**
   * Firebase 초기화 확인 + 시작 시 백그라운드 최신 데이터 자동 병합
   */
  static async initSync(storageManager) {
    if (storageManager) {
      this._storageManager = storageManager;
    }
    if (!isFirebaseConfigured() || !db) {
      console.info('[FirebaseSync] Firebase 설정 없음 - 단독 로컬 모드로 동작합니다.');
      this.dispatchStatus(false, '설정 누락');
      return { success: false, reason: 'unconfigured' };
    }

    console.log('[FirebaseSync] 로컬 우선 스마트 자동 백업 모드 준비 완료');
    AdminLogger.log('SYNC', 'Firebase 초기 자동 동기화 시작');
    this.dispatchStatus(true, '동기화 중...');

    // 시작 시 서버의 최신 프로필 및 활성 프로필 성취도를 백그라운드로 안전 병합
    if (this._storageManager) {
      try {
        await this.syncProfilesFromServer(this._storageManager);
        const activeId = this._storageManager.getActiveProfileId();
        if (activeId) {
          await this.downloadProfileProgress(activeId, this._storageManager, { fromInit: true });
        }
      } catch (e) {
        AdminLogger.log('ERROR', '초기 자동 병합 실패', e.message);
        console.warn('[FirebaseSync] 초기 자동 병합 경고:', e);
      }
    }

    AdminLogger.log('SYNC', 'Firebase 초기 동기화 완료 (자동 백업 대기)');
    this.dispatchStatus(true, '자동 백업 대기');

    // 대기 중인 변경사항이 있으면 즉시 플러시
    if (this._dirtyProfileIds.size > 0) {
      this.flushDirtySync(this._storageManager);
    }
    return { success: true };
  }

  /**
   * 서버의 프로필 목록을 로컬과 병합 (다른 기기에서 만든 프로필 누락 방지)
   */
  static async syncProfilesFromServer(storageManager) {
    if (!db || !storageManager) return;
    try {
      const snap = await getDocs(collection(db, 'profiles'));
      const remoteProfiles = [];
      snap.forEach(d => remoteProfiles.push(d.data()));
      if (remoteProfiles.length === 0) return;

      const localProfiles = storageManager.getProfiles();
      const map = new Map();
      localProfiles.forEach(p => { if (p && p.id) map.set(p.id, p); });

      let changed = false;
      remoteProfiles.forEach(rp => {
        if (!rp || !rp.id) return;
        const lp = map.get(rp.id);
        if (!lp) {
          map.set(rp.id, rp);
          changed = true;
        } else if ((rp.updatedAt || 0) > (lp.updatedAt || 0)) {
          map.set(rp.id, { ...lp, ...rp });
          changed = true;
        }
      });

      if (changed) {
        const mergedProfiles = Array.from(map.values());
        localStorage.setItem('vocaquest_profiles_v1', JSON.stringify(mergedProfiles));
        window.dispatchEvent(new CustomEvent('vocaquest_profiles_updated', { detail: mergedProfiles }));
      }
    } catch (e) {
      console.warn('[FirebaseSync] 서버 프로필 목록 병합 경고:', e);
    }
  }

  /**
   * 학습 데이터 변경 기록 (메모리에 변경된 단어 ID만 표시, 실제 업로드는 탭 전환/백그라운드/종료 시 실행)
   */
  static markDirty(profileId, storageManager = null, wordId = null) {
    if (!profileId) return;
    if (storageManager) this._storageManager = storageManager;
    this._dirtyProfileIds.add(profileId);

    if (wordId) {
      if (!this._dirtyWordIdsByProfile.has(profileId)) {
        this._dirtyWordIdsByProfile.set(profileId, new Set());
      }
      this._dirtyWordIdsByProfile.get(profileId).add(wordId);
    }
  }

  /**
   * 변경된 프로필 데이터를 즉시 Firebase에 백그라운드 업로드 (단어별 updatedAt 안전 병합)
   */
  static async flushDirtySync(storageManager = null) {
    const mgr = storageManager || this._storageManager;
    if (!db || !mgr || this._dirtyProfileIds.size === 0 || this.isSyncing) return;

    const targetIds = Array.from(this._dirtyProfileIds);
    const wordIdMap = new Map();
    for (const pid of targetIds) {
      const set = this._dirtyWordIdsByProfile.get(pid);
      if (set && set.size > 0) {
        wordIdMap.set(pid, Array.from(set));
      }
      this._dirtyWordIdsByProfile.delete(pid);
    }
    this._dirtyProfileIds.clear();

    try {
      this.isSyncing = true;
      AdminLogger.log('SYNC', '백그라운드 자동 백업 실행 중...', { profiles: targetIds });
      for (const pid of targetIds) {
        const data = mgr.getProfileData(pid);
        const onlyWordIds = wordIdMap.get(pid) || null;
        const res = await this.uploadProfileProgress(pid, data, onlyWordIds, mgr);
        if (!res.success) {
          this._dirtyProfileIds.add(pid);
          if (onlyWordIds) {
            this._dirtyWordIdsByProfile.set(pid, new Set(onlyWordIds));
          }
        }
      }
      this.dispatchStatus(true, '자동 백업 완료');
    } catch (e) {
      targetIds.forEach(pid => this._dirtyProfileIds.add(pid));
      AdminLogger.log('ERROR', '백그라운드 자동 백업 오류', e.message);
      console.warn('[FirebaseSync] 자동 백업 경고:', e);
    } finally {
      this.isSyncing = false;
    }
  }

  static dispatchStatus(connected, message = '') {
    window.dispatchEvent(new CustomEvent('vocaquest_server_status_changed', {
      detail: {
        connected,
        isFirebase: true,
        serverUrl: 'Firebase Cloud Firestore (체크포인트 모드)',
        message
      }
    }));
  }

  /**
   * ==========================================
   * 1. 학습 성과(Progress) 단발성 저장 및 조회
   * ==========================================
   */

  /**
   * 특정 프로필의 최신 성과를 Firestore에 1회 업로드 (Read-Merge-Write로 구버전 덮어쓰기 방지)
   * onlyWordIds가 지정되면 해당 단어들만 서버와 타임스탬프 비교 후 업로드합니다.
   */
  static async uploadProfileProgress(profileId, data, onlyWordIds = null, storageManager = null) {
    if (!db || !profileId) return { success: false, error: 'DB 미연결' };
    try {
      const docRef = doc(db, 'profileData', profileId);
      const snap = await getDoc(docRef);
      const remoteData = snap.exists() ? (snap.data() || {}) : {};

      if (Array.isArray(onlyWordIds) && onlyWordIds.length > 0) {
        const subsetLocal = {};
        const subsetRemote = {};
        onlyWordIds.forEach(wid => {
          if (data && data[wid]) subsetLocal[wid] = data[wid];
          if (remoteData[wid]) subsetRemote[wid] = remoteData[wid];
        });
        const mergedSubset = this.mergeProfileProgressData(subsetLocal, subsetRemote);
        const payload = {};
        for (const wid of Object.keys(mergedSubset)) {
          if (subsetLocal[wid] && mergedSubset[wid] === subsetLocal[wid]) {
            payload[wid] = mergedSubset[wid];
          }
        }
        if (Object.keys(payload).length > 0) {
          await setDoc(docRef, payload, { merge: true });
        }
        AdminLogger.log('SYNC', `변경 단어 ${Object.keys(payload).length}개 Firebase 업로드 완료`, { profileId });
        console.log(`[FirebaseSync] 프로필(${profileId}) 변경 단어 ${Object.keys(payload).length}개 안전 병합 업로드 완료`);
      } else {
        const mergedData = this.mergeProfileProgressData(data || {}, remoteData);
        if (Object.keys(mergedData).length > 0) {
          await setDoc(docRef, mergedData, { merge: true });
        }
        if (storageManager) {
          localStorage.setItem(`vocaquest_prof_data_${profileId}`, JSON.stringify(mergedData));
          if (storageManager._cachedProfileData) {
            storageManager._cachedProfileData[profileId] = mergedData;
          }
          storageManager.invalidateDeckCache();
        }
        AdminLogger.log('SYNC', `전체 성과 안전 병합 업로드 완료 (총 ${Object.keys(mergedData).length}개)`, { profileId });
        console.log(`[FirebaseSync] 프로필(${profileId}) 성과 안전 병합 업로드 완료`);
      }
      return { success: true };
    } catch (e) {
      AdminLogger.log('ERROR', `프로필(${profileId}) 성과 업로드 실패`, e.message);
      console.error(`[FirebaseSync] 프로필(${profileId}) 성과 저장 실패:`, e);
      return { success: false, error: e.message };
    }
  }

  /**
   * 특정 프로필의 서버 성과를 Firestore에서 1회 다운로드하여 단어별 최신 시간 기준으로 병합 반영
   */
  static async downloadProfileProgress(profileId, storageManager, options = {}) {
    if (!db || !profileId) return { success: false, error: 'DB 미연결' };
    try {
      const docRef = doc(db, 'profileData', profileId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const remoteData = snap.data() || {};
        const localKey = `vocaquest_prof_data_${profileId}`;
        const localData = storageManager.getProfileData(profileId) || {};

        // 서버 데이터와 로컬 데이터를 단어별 최신 updatedAt 기준으로 안전하게 병합
        const mergedData = this.mergeProfileProgressData(localData, remoteData);

        let hasRemoteUpdates = false;
        for (const wid of Object.keys(mergedData)) {
          if (mergedData[wid] !== localData[wid]) {
            hasRemoteUpdates = true;
            break;
          }
        }

        localStorage.setItem(localKey, JSON.stringify(mergedData));
        if (storageManager._cachedProfileData) {
          storageManager._cachedProfileData[profileId] = mergedData;
        }
        storageManager.invalidateDeckCache();

        window.dispatchEvent(new CustomEvent('vocaquest_progress_updated', {
          detail: {
            profileId,
            data: mergedData,
            fromInit: !!options.fromInit,
            hasRemoteUpdates
          }
        }));
        AdminLogger.log('SYNC', `서버 성과 병합 완료 (총 ${Object.keys(mergedData).length}개, 원격 갱신: ${hasRemoteUpdates})`, { profileId });
        console.log(`[FirebaseSync] 프로필(${profileId}) 서버 성과 병합 완료 (총 ${Object.keys(mergedData).length}개, 원격 갱신: ${hasRemoteUpdates})`);
        return { success: true, count: Object.keys(mergedData).length, hasRemoteUpdates };
      }
      return { success: true, count: 0, hasRemoteUpdates: false };
    } catch (e) {
      console.error(`[FirebaseSync] 프로필(${profileId}) 성과 다운로드 실패:`, e);
      return { success: false, error: e.message };
    }
  }

  /**
   * ==========================================
   * 2. 프로필(Profiles) 단발성 저장 및 관리
   * ==========================================
   */

  static async saveProfiles(profiles) {
    if (!db || !Array.isArray(profiles)) return;
    try {
      for (const p of profiles) {
        if (p && p.id) {
          await setDoc(doc(db, 'profiles', p.id), { ...p, updatedAt: Date.now() }, { merge: true });
        }
      }
    } catch (e) {
      console.warn('[FirebaseSync] 프로필 업로드 실패:', e);
    }
  }

  static async deleteProfile(profileId) {
    if (!db || !profileId) return;
    try {
      await deleteDoc(doc(db, 'profiles', profileId));
      await deleteDoc(doc(db, 'profileData', profileId));
      console.log(`[FirebaseSync] 프로필(${profileId}) Firebase 삭제 완료`);
    } catch (e) {
      console.warn('[FirebaseSync] 프로필 삭제 실패:', e);
    }
  }

  /**
   * 특정 프로필 1개와 해당 성과를 다운로드하여 로컬에 추가 및 활성화
   */
  static async downloadSpecificProfile(storageManager, profileId) {
    if (!db || !profileId) return { success: false, error: 'DB 미연결' };
    try {
      const pDoc = await getDoc(doc(db, 'profiles', profileId));
      if (pDoc.exists()) {
        const pData = pDoc.data();
        const profiles = storageManager.getProfiles();
        const existingIdx = profiles.findIndex(p => p.id === profileId);
        if (existingIdx >= 0) {
          profiles[existingIdx] = { ...profiles[existingIdx], ...pData };
        } else {
          profiles.push(pData);
        }
        localStorage.setItem('vocaquest_profiles_v1', JSON.stringify(profiles));
        window.dispatchEvent(new CustomEvent('vocaquest_profiles_updated', { detail: profiles }));
      }

      await this.downloadProfileProgress(profileId, storageManager);
      storageManager.setActiveProfileId(profileId);
      return { success: true };
    } catch (e) {
      console.error('[FirebaseSync] 특정 프로필 다운로드 실패:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * ==========================================
   * 3. 단어장(Decks) 단발성 다운로드 및 관리
   * ==========================================
   */

  static saveDecks(decks) {
    // 체크포인트 동기화 모드: 매 로컬 변경마다 네트워크 통신하지 않고 0ms 로컬 속도 보장
  }

  /**
   * 서버의 최신 단어장 목록 전체를 1회 다운로드하여 로컬에 반영 (단어장 새로고침)
   */
  static async downloadLatestDecks(storageManager) {
    if (!db) return { success: false, error: 'DB 미연결' };
    try {
      console.log('[FirebaseSync] 서버의 최신 단어장 목록 다운로드 중...');
      const snap = await getDocs(collection(db, 'decks'));
      const serverDecks = [];
      snap.forEach(d => serverDecks.push(d.data()));

      if (serverDecks.length > 0) {
        // 로컬 단어장과 병합 (서버 단어장을 최신으로 반영)
        const localAll = storageManager.getAllDecks();
        const deckMap = new Map();
        localAll.forEach(d => deckMap.set(d.id, d));
        serverDecks.forEach(d => deckMap.set(d.id, { ...deckMap.get(d.id), ...d }));

        const mergedDecks = Array.from(deckMap.values());
        localStorage.setItem('vocaquest_decks_v2', JSON.stringify(mergedDecks));

        // storageManager를 통해 단어 숙련도/성과 매핑 재적용
        const refreshed = storageManager.getAllDecks();
        window.dispatchEvent(new CustomEvent('vocaquest_decks_updated', { detail: refreshed }));
        console.log(`[FirebaseSync] 최신 단어장 ${serverDecks.length}개 로컬 동기화 완료!`);
        return { success: true, count: serverDecks.length };
      }
      return { success: true, count: 0 };
    } catch (e) {
      console.error('[FirebaseSync] 단어장 다운로드 실패:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * 새 단어장 또는 수정된 단어장을 Firestore에 1회 업로드
   */
  static async uploadDeck(deck) {
    if (!db || !deck || !deck.id) return;
    try {
      const docRef = doc(db, 'decks', deck.id);
      await setDoc(docRef, { ...deck, updatedAt: Date.now() }, { merge: true });
      console.log(`[FirebaseSync] 단어장 '${deck.name}' (${deck.id}) Firebase 업로드 완료`);
    } catch (e) {
      console.error('[FirebaseSync] 단어장 업로드 실패:', e);
    }
  }

  /**
   * 삭제된 단어장을 Firestore에서도 삭제
   */
  static async deleteDeck(deckId) {
    if (!db || !deckId) return;
    try {
      await deleteDoc(doc(db, 'decks', deckId));
      console.log(`[FirebaseSync] 단어장(${deckId}) Firebase 삭제 완료`);
    } catch (e) {
      console.error(`[FirebaseSync] 단어장(${deckId}) 삭제 실패:`, e);
    }
  }

  /**
   * ==========================================
   * 4. 프로필 전환 및 [학습 끝] 핵심 체크포인트
   * ==========================================
   */

  /**
   * 🏁 [학습 끝] 버튼 클릭 시 동작:
   * 1) 현재 학습자의 오늘 성과를 서버에 저장
   * 2) 서버의 최신 단어장도 로컬로 동기화
   */
  static async finishStudySession(storageManager) {
    if (!db) return { success: false, error: 'Firebase 미연결' };
    const activeProf = storageManager.getActiveProfile();
    if (!activeProf) return { success: false, error: '활성 프로필 없음' };

    try {
      this.isSyncing = true;
      const progressData = storageManager.getProfileData(activeProf.id);
      
      // 1. 현재 프로필 성과 서버 안전 병합 저장
      await this.uploadProfileProgress(activeProf.id, progressData, null, storageManager);
      this._dirtyProfileIds.delete(activeProf.id);
      this._dirtyWordIdsByProfile.delete(activeProf.id);

      // 2. 서버의 최신 단어장 다운로드 동기화
      const deckResult = await this.downloadLatestDecks(storageManager);

      return {
        success: true,
        profileName: activeProf.name,
        wordCount: Object.keys(progressData || {}).length,
        decksCount: deckResult.count || 0
      };
    } catch (e) {
      console.error('[FirebaseSync] 학습 완료 동기화 실패:', e);
      return { success: false, error: e.message };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 🔄 프로필 변경 시 안전 전환:
   * 1) 변경 전 프로필의 최신 성과를 서버로 자동 업로드
   * 2) 새로 선택된 프로필의 최신 성과를 서버에서 자동 다운로드
   */
  static async switchProfileSafely(storageManager, oldProfileId, newProfileId) {
    if (!db) return;

    // 1. 이전 프로필 성과 서버로 비동기 업로드
    if (oldProfileId) {
      const oldData = storageManager.getProfileData(oldProfileId);
      this.uploadProfileProgress(oldProfileId, oldData).catch(err => {
        console.warn(`[FirebaseSync] 이전 프로필(${oldProfileId}) 백업 경고:`, err);
      });
    }

    // 2. 새 프로필의 최신 성과 서버에서 다운로드
    if (newProfileId) {
      this.downloadProfileProgress(newProfileId, storageManager).catch(err => {
        console.warn(`[FirebaseSync] 새 프로필(${newProfileId}) 다운로드 경고:`, err);
      });
    }
  }

  /**
   * ==========================================
   * 5. 관리자용 일괄 백업 / 복원 도구
   * ==========================================
   */
  static async uploadAllLocalToFirebase(storageManager) {
    if (!db) return { success: false, error: 'Firebase 미연결' };
    try {
      const profiles = storageManager.getProfiles();
      for (const p of profiles) {
        if (p && p.id) {
          await setDoc(doc(db, 'profiles', p.id), { ...p, updatedAt: Date.now() }, { merge: true });
          const pData = storageManager.getProfileData(p.id) || {};
          if (Object.keys(pData).length > 0) {
            await setDoc(doc(db, 'profileData', p.id), pData, { merge: true });
          }
        }
      }

      const decks = storageManager.getAllDecks();
      for (const d of decks) {
        if (d && d.id) {
          await setDoc(doc(db, 'decks', d.id), { ...d, updatedAt: Date.now() }, { merge: true });
        }
      }

      return { success: true, profilesCount: profiles.length, decksCount: decks.length };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  static async downloadAllFromFirebase(storageManager) {
    if (!db) return { success: false, error: 'Firebase 미연결' };
    try {
      // 프로필 다운로드
      const profSnap = await getDocs(collection(db, 'profiles'));
      const remoteProfiles = [];
      profSnap.forEach(d => remoteProfiles.push(d.data()));
      if (remoteProfiles.length > 0) {
        storageManager.saveProfiles(remoteProfiles);
        for (const p of remoteProfiles) {
          await this.downloadProfileProgress(p.id, storageManager);
        }
      }

      // 단어장 다운로드
      const deckResult = await this.downloadLatestDecks(storageManager);

      return {
        success: true,
        profilesCount: remoteProfiles.length,
        decksCount: deckResult.count || 0
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}
