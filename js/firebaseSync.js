// js/firebaseSync.js
// VocaQuest Firebase Firestore 실시간 동기화 모듈
// 프로필, 단어장(Decks), 학습 성취도를 Firestore와 양방향 실시간(onSnapshot) 연동

import { db, isFirebaseConfigured } from './firebaseConfig.js?v=20261123_10';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  writeBatch 
} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

export class FirebaseSyncManager {
  static isConnected = false;
  static isInitialized = false;
  static unsubscribers = [];
  static activeProgressUnsub = null;
  static storageManager = null;
  static isSyncingFromRemote = false; // 원격 업데이트 수신 중 로컬 재업로드 방지 플래그

  /**
   * Firebase 실시간 동기화 초기화
   * @param {Object} storageManager - StorageManager 인스턴스/클래스
   */
  static async initSync(storageManager) {
    this.storageManager = storageManager;

    if (!isFirebaseConfigured() || !db) {
      console.warn('[FirebaseSync] Firebase 설정이 누락되었거나 초기화되지 않았습니다. 단독 로컬 모드로 동작합니다.');
      this.dispatchStatus(false, '설정 누락');
      return { success: false, reason: 'unconfigured' };
    }

    if (this.isInitialized) {
      return { success: true };
    }

    try {
      console.log('[FirebaseSync] Firestore 실시간 리스너 연결 중...');
      this.isConnected = true;
      this.isInitialized = true;
      this.dispatchStatus(true, '연결됨');

      // 1. 프로필 컬렉션 실시간 구독
      this.listenProfiles();

      // 2. 단어장 컬렉션 실시간 구독
      this.listenDecks();

      // 3. 현재 활성 프로필의 학습 성과 실시간 구독
      this.switchActiveProfileListener(this.storageManager.getActiveProfileId());

      // 활성 프로필 변경 이벤트 감지
      window.addEventListener('vocaquest_profile_switched', (e) => {
        const newProfileId = e.detail?.profileId || this.storageManager.getActiveProfileId();
        this.switchActiveProfileListener(newProfileId);
      });

      // 최초 실행 시 원격에 데이터가 전혀 없는데 로컬에 데이터가 있다면 초기 마이그레이션 제안/자동 동기화
      this.checkAndInitialBootstrap();

      return { success: true };
    } catch (e) {
      console.error('[FirebaseSync] Firestore 초기화 실패:', e);
      this.isConnected = false;
      this.dispatchStatus(false, e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * 상태 변경 알림 이벤트 발생
   */
  static dispatchStatus(connected, message = '') {
    this.isConnected = connected;
    window.dispatchEvent(new CustomEvent('vocaquest_server_status_changed', {
      detail: {
        connected: this.isConnected,
        isFirebase: true,
        serverUrl: 'Firebase Cloud Firestore',
        message
      }
    }));
  }

  /**
   * ==========================================
   * 1. 프로필(Profiles) 실시간 리스너 및 저장
   * ==========================================
   */
  static listenProfiles() {
    if (!db) return;
    const colRef = collection(db, 'profiles');
    const unsub = onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty && snapshot.metadata.fromCache) return;

      const remoteProfiles = [];
      snapshot.forEach(docSnap => {
        remoteProfiles.push(docSnap.data());
      });

      if (remoteProfiles.length > 0) {
        this.isSyncingFromRemote = true;
        try {
          const localProfiles = this.storageManager.getProfiles();
          // 원격 데이터와 로컬 데이터 병합 (최신순 또는 ID 기준)
          const profileMap = new Map();
          localProfiles.forEach(p => profileMap.set(p.id, p));
          remoteProfiles.forEach(p => profileMap.set(p.id, { ...profileMap.get(p.id), ...p }));

          const merged = Array.from(profileMap.values());
          // 로컬 스토리지에 원격 변경사항 반영 (Firebase 재업로드 트리거 방지)
          localStorage.setItem('vocaquest_profiles_v1', JSON.stringify(merged));
          window.dispatchEvent(new CustomEvent('vocaquest_profiles_updated', { detail: merged }));
        } finally {
          this.isSyncingFromRemote = false;
        }
      }
    }, (err) => {
      console.error('[FirebaseSync] 프로필 리스너 오류:', err);
    });

    this.unsubscribers.push(unsub);
  }

  /**
   * 프로필 저장 (즉시 Firestore 반영)
   */
  static async saveProfile(profile) {
    if (!db || !profile || !profile.id || this.isSyncingFromRemote) return;
    try {
      const docRef = doc(db, 'profiles', profile.id);
      const payload = {
        ...profile,
        updatedAt: Date.now()
      };
      await setDoc(docRef, payload, { merge: true });
    } catch (e) {
      console.error('[FirebaseSync] 프로필 저장 실패:', e);
    }
  }

  /**
   * 전체 프로필 목록 일괄 저장
   */
  static async saveProfiles(profiles) {
    if (!db || !Array.isArray(profiles) || this.isSyncingFromRemote) return;
    try {
      const batch = writeBatch(db);
      profiles.forEach(p => {
        if (p && p.id) {
          const docRef = doc(db, 'profiles', p.id);
          batch.set(docRef, { ...p, updatedAt: Date.now() }, { merge: true });
        }
      });
      await batch.commit();
    } catch (e) {
      console.error('[FirebaseSync] 프로필 일괄 저장 실패:', e);
    }
  }

  /**
   * 프로필 삭제
   */
  static async deleteProfile(profileId) {
    if (!db || !profileId) return;
    try {
      await deleteDoc(doc(db, 'profiles', profileId));
      await deleteDoc(doc(db, 'profileData', profileId));
      console.log(`[FirebaseSync] 프로필(${profileId}) 및 성과 삭제 완료`);
    } catch (e) {
      console.error(`[FirebaseSync] 프로필(${profileId}) 삭제 실패:`, e);
    }
  }

  /**
   * ==========================================
   * 2. 단어장(Decks) 실시간 리스너 및 저장
   * ==========================================
   */
  static listenDecks() {
    if (!db) return;
    const colRef = collection(db, 'decks');
    const unsub = onSnapshot(colRef, (snapshot) => {
      if (snapshot.empty && snapshot.metadata.fromCache) return;

      const remoteDecks = [];
      snapshot.forEach(docSnap => {
        remoteDecks.push(docSnap.data());
      });

      if (remoteDecks.length > 0) {
        this.isSyncingFromRemote = true;
        try {
          // 로컬 단어장 저장소 갱신
          localStorage.setItem('vocaquest_decks_v2', JSON.stringify(remoteDecks));
          window.dispatchEvent(new CustomEvent('vocaquest_decks_updated', { detail: remoteDecks }));
        } finally {
          this.isSyncingFromRemote = false;
        }
      }
    }, (err) => {
      console.error('[FirebaseSync] 단어장 리스너 오류:', err);
    });

    this.unsubscribers.push(unsub);
  }

  /**
   * 단어장 1개 저장 (즉시 Firestore 반영)
   */
  static async saveDeck(deck) {
    if (!db || !deck || !deck.id || this.isSyncingFromRemote) return;
    try {
      const docRef = doc(db, 'decks', deck.id);
      const payload = {
        ...deck,
        updatedAt: Date.now()
      };
      await setDoc(docRef, payload, { merge: true });
    } catch (e) {
      console.error('[FirebaseSync] 단어장 저장 실패:', e);
    }
  }

  /**
   * 전체 단어장 목록 저장
   */
  static async saveDecks(decks) {
    if (!db || !Array.isArray(decks) || this.isSyncingFromRemote) return;
    try {
      const batch = writeBatch(db);
      decks.forEach(d => {
        if (d && d.id) {
          const docRef = doc(db, 'decks', d.id);
          batch.set(docRef, { ...d, updatedAt: Date.now() }, { merge: true });
        }
      });
      await batch.commit();
    } catch (e) {
      console.error('[FirebaseSync] 단어장 일괄 저장 실패:', e);
    }
  }

  /**
   * 단어장 삭제
   */
  static async deleteDeck(deckId) {
    if (!db || !deckId) return;
    try {
      await deleteDoc(doc(db, 'decks', deckId));
      console.log(`[FirebaseSync] 단어장(${deckId}) 삭제 완료`);
    } catch (e) {
      console.error(`[FirebaseSync] 단어장(${deckId}) 삭제 실패:`, e);
    }
  }

  /**
   * ==========================================
   * 3. 프로필별 학습 성취도(Progress) 실시간 리스너 및 즉시 반영
   * ==========================================
   */
  static switchActiveProfileListener(profileId) {
    if (!db || !profileId) return;

    if (this.activeProgressUnsub) {
      this.activeProgressUnsub();
      this.activeProgressUnsub = null;
    }

    const docRef = doc(db, 'profileData', profileId);
    this.activeProgressUnsub = onSnapshot(docRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const remoteData = docSnap.data() || {};

      this.isSyncingFromRemote = true;
      try {
        const localKey = `vocaquest_prof_data_${profileId}`;
        const localData = this.storageManager.getProfileData(profileId) || {};

        // 원격 데이터와 로컬 데이터 병합
        const mergedData = { ...localData, ...remoteData };
        localStorage.setItem(localKey, JSON.stringify(mergedData));
        window.dispatchEvent(new CustomEvent('vocaquest_progress_updated', {
          detail: { profileId, data: mergedData }
        }));
      } finally {
        this.isSyncingFromRemote = false;
      }
    }, (err) => {
      console.error(`[FirebaseSync] 프로필(${profileId}) 성취도 리스너 오류:`, err);
    });
  }

  /**
   * 특정 단어 학습 성과 즉시 저장 (단어 카드 클릭, 퀴즈 정답/오답 즉시 호출)
   */
  static async saveWordProgress(profileId, wordId, wordData) {
    if (!db || !profileId || !wordId || this.isSyncingFromRemote) return;
    try {
      const docRef = doc(db, 'profileData', profileId);
      // Firestore의 점 표기법(dot notation)으로 해당 wordId 키만 부분 즉시 업데이트
      await setDoc(docRef, {
        [wordId]: {
          ...wordData,
          updatedAt: Date.now()
        }
      }, { merge: true });
    } catch (e) {
      console.error(`[FirebaseSync] 단어(${wordId}) 성과 저장 실패:`, e);
    }
  }

  /**
   * 프로필 전체 성과 저장
   */
  static async saveProfileData(profileId, data) {
    if (!db || !profileId || this.isSyncingFromRemote) return;
    try {
      const docRef = doc(db, 'profileData', profileId);
      await setDoc(docRef, data || {}, { merge: true });
    } catch (e) {
      console.error(`[FirebaseSync] 프로필(${profileId}) 전체 성과 저장 실패:`, e);
    }
  }

  /**
   * ==========================================
   * 4. 데이터 초기 부트스트랩 및 마이그레이션 도구
   * ==========================================
   */

  /**
   * Firestore에 아무 데이터도 없을 경우, 로컬 데이터를 원격으로 부트스트랩
   */
  static async checkAndInitialBootstrap() {
    if (!db) return;
    try {
      const profsSnap = await getDocs(collection(db, 'profiles'));
      if (profsSnap.empty) {
        console.log('[FirebaseSync] Firestore가 비어있습니다. 로컬 기본 데이터를 Firebase로 초기 전송합니다...');
        await this.uploadAllLocalToFirebase(this.storageManager);
      }
    } catch (e) {
      console.warn('[FirebaseSync] 부트스트랩 체크 실패:', e);
    }
  }

  /**
   * 로컬의 모든 데이터(프로필, 단어장, 프로필별 성취도)를 Firebase로 일괄 업로드
   */
  static async uploadAllLocalToFirebase(storageManager) {
    if (!db) return { success: false, error: 'Firebase 미연결' };

    try {
      console.log('[FirebaseSync] 로컬 전체 데이터 Firebase 업로드 시작...');

      // 1. 프로필 업로드
      const profiles = storageManager.getProfiles();
      const profBatch = writeBatch(db);
      profiles.forEach(p => {
        if (p && p.id) {
          profBatch.set(doc(db, 'profiles', p.id), { ...p, updatedAt: Date.now() }, { merge: true });
        }
      });
      await profBatch.commit();

      // 2. 단어장(Decks) 업로드
      const decks = storageManager.getDecks();
      const deckBatch = writeBatch(db);
      decks.forEach(d => {
        if (d && d.id) {
          deckBatch.set(doc(db, 'decks', d.id), { ...d, updatedAt: Date.now() }, { merge: true });
        }
      });
      await deckBatch.commit();

      // 3. 프로필별 성취도 업로드
      for (const p of profiles) {
        const pData = storageManager.getProfileData(p.id) || {};
        if (Object.keys(pData).length > 0) {
          await setDoc(doc(db, 'profileData', p.id), pData, { merge: true });
        }
      }

      console.log('[FirebaseSync] 전체 데이터 Firebase 업로드 완료!');
      return { 
        success: true, 
        profilesCount: profiles.length, 
        decksCount: decks.length 
      };
    } catch (e) {
      console.error('[FirebaseSync] 로컬 데이터 전체 업로드 실패:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * Firebase 원격의 모든 데이터를 강제로 내려받아 로컬 덮어쓰기
   */
  static async downloadAllFromFirebase(storageManager) {
    if (!db) return { success: false, error: 'Firebase 미연결' };

    try {
      // 1. 프로필 다운로드
      const profSnap = await getDocs(collection(db, 'profiles'));
      const remoteProfiles = [];
      profSnap.forEach(d => remoteProfiles.push(d.data()));
      if (remoteProfiles.length > 0) {
        storageManager.saveProfiles(remoteProfiles);
      }

      // 2. 단어장 다운로드
      const deckSnap = await getDocs(collection(db, 'decks'));
      const remoteDecks = [];
      deckSnap.forEach(d => remoteDecks.push(d.data()));
      if (remoteDecks.length > 0) {
        storageManager.saveDecks(remoteDecks);
      }

      // 3. 각 프로필의 성취도 다운로드
      for (const p of remoteProfiles) {
        const pSnap = await getDoc(doc(db, 'profileData', p.id));
        if (pSnap.exists()) {
          storageManager.saveProfileData(pSnap.data(), p.id);
        }
      }

      return {
        success: true,
        profilesCount: remoteProfiles.length,
        decksCount: remoteDecks.length
      };
    } catch (e) {
      console.error('[FirebaseSync] Firebase 전체 다운로드 실패:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * 특정 프로필의 최신 성취도를 Firestore에서 가져와 로컬에 반영하고 활성화
   */
  static async downloadSpecificProfile(storageManager, profileId) {
    if (!db || !profileId) return { success: false, error: 'Firebase 미연결 또는 프로필 ID 누락' };
    try {
      const pSnap = await getDoc(doc(db, 'profileData', profileId));
      if (pSnap.exists()) {
        const data = pSnap.data() || {};
        storageManager.saveProfileData(data, profileId);
      }
      storageManager.setActiveProfileId(profileId);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}
