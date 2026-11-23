// js/firebaseSync.js
// VocaQuest 로컬 우선 체크포인트 동기화 모듈 (Local-First Checkpoint Sync)
// 실시간 리스너(onSnapshot)를 배제하고, 명시적 시점([학습 끝], 프로필 변경, 수동 새로고침)에만 단발성으로 안전하게 통신합니다.

import { db, isFirebaseConfigured } from './firebaseConfig.js?v=20261124_01';
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

  static get isConnected() {
    return Boolean(db && isFirebaseConfigured());
  }

  /**
   * Firebase 초기화 확인 (리스너 없음)
   */
  static async initSync(storageManager) {
    if (!isFirebaseConfigured() || !db) {
      console.info('[FirebaseSync] Firebase 설정 없음 - 단독 로컬 모드로 동작합니다.');
      this.dispatchStatus(false, '설정 누락');
      return { success: false, reason: 'unconfigured' };
    }

    console.log('[FirebaseSync] 로컬 우선 체크포인트 동기화 모드 준비 완료 (실시간 리스너 없음)');
    this.dispatchStatus(true, '동기화 대기');
    return { success: true };
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
   * 특정 프로필의 최신 성과를 Firestore에 1회 업로드
   */
  static async uploadProfileProgress(profileId, data) {
    if (!db || !profileId) return { success: false, error: 'DB 미연결' };
    try {
      const docRef = doc(db, 'profileData', profileId);
      await setDoc(docRef, data || {}, { merge: true });
      console.log(`[FirebaseSync] 프로필(${profileId}) 성과 Firebase 저장 완료`);
      return { success: true };
    } catch (e) {
      console.error(`[FirebaseSync] 프로필(${profileId}) 성과 저장 실패:`, e);
      return { success: false, error: e.message };
    }
  }

  /**
   * 특정 프로필의 서버 성과를 Firestore에서 1회 다운로드하여 로컬에 반영
   */
  static async downloadProfileProgress(profileId, storageManager) {
    if (!db || !profileId) return { success: false, error: 'DB 미연결' };
    try {
      const docRef = doc(db, 'profileData', profileId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const remoteData = snap.data() || {};
        const localKey = `vocaquest_prof_data_${profileId}`;
        const localData = storageManager.getProfileData(profileId) || {};

        // 서버 데이터와 로컬 데이터 병합
        const mergedData = { ...localData, ...remoteData };
        localStorage.setItem(localKey, JSON.stringify(mergedData));
        window.dispatchEvent(new CustomEvent('vocaquest_progress_updated', {
          detail: { profileId, data: mergedData }
        }));
        console.log(`[FirebaseSync] 프로필(${profileId}) 서버 성과 다운로드 완료 (단어 ${Object.keys(mergedData).length}개)`);
        return { success: true, count: Object.keys(mergedData).length };
      }
      return { success: true, count: 0 };
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
      
      // 1. 현재 프로필 성과 서버 저장
      await this.uploadProfileProgress(activeProf.id, progressData);

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
