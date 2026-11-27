// js/idbBackup.js
// IndexedDB 이중 백업 및 영구 저장소(Persistent Storage) 보호 모듈
// 태블릿/모바일 브라우저에서 localStorage가 초기화되더라도 프로필과 학습 성과를 자동 복구합니다.

import { AdminLogger } from './adminLogger.js?v=20261127_04';

const DB_NAME = 'vocaquest_backup_db';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

export class IdbBackup {
  static _dbPromise = null;

  static openDB() {
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }
    if (this._dbPromise) return this._dbPromise;

    this._dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return this._dbPromise;
  }

  static async get(key) {
    const db = await this.openDB();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  static async set(key, value) {
    const db = await this.openDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({ value, updatedAt: Date.now() }, key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  static async remove(key) {
    const db = await this.openDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * 브라우저에 영구 저장소 권한 요청 (OS 임의 삭제 방지)
   */
  static async requestPersistentStorage() {
    try {
      if (navigator.storage && typeof navigator.storage.persist === 'function') {
        const persisted = await navigator.storage.persisted();
        if (!persisted) {
          await navigator.storage.persist();
        }
      }
    } catch {
      // 미지원 브라우저 무시
    }
  }

  /**
   * localStorage가 비어 있는 경우 IndexedDB에서 프로필 및 성취도 데이터를 자동 복구
   * 이미 localStorage에 데이터가 있는 경우 IndexedDB로 최신 미러링
   */
  static async syncOrRestore(storageManager) {
    try {
      const rawProfiles = localStorage.getItem('vocaquest_profiles_v1');
      let localProfiles = null;
      try {
        if (rawProfiles) {
          const parsed = JSON.parse(rawProfiles);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localProfiles = parsed;
          }
        }
      } catch {
        localProfiles = null;
      }

      // localStorage가 비어 있거나 '기본 학습자' 1개만 초기 생성된 상태인지 확인
      const idbProfiles = await this.get('profiles');
      const isLocalEmptyOrDefaultOnly =
        !localProfiles ||
        (localProfiles.length === 1 &&
          localProfiles[0].id === 'prof_default' &&
          !localStorage.getItem('vocaquest_prof_data_prof_default'));

      if (isLocalEmptyOrDefaultOnly && Array.isArray(idbProfiles) && idbProfiles.length > 0) {
        // IndexedDB에서 복구 실행
        localStorage.setItem('vocaquest_profiles_v1', JSON.stringify(idbProfiles));

        const idbActiveId = await this.get('activeProfileId');
        if (idbActiveId && idbProfiles.some(p => p.id === idbActiveId)) {
          localStorage.setItem('vocaquest_active_profile_v1', idbActiveId);
        } else {
          localStorage.setItem('vocaquest_active_profile_v1', idbProfiles[0].id);
        }

        for (const p of idbProfiles) {
          if (p && p.id) {
            const pData = await this.get('profileData_' + p.id);
            if (pData && typeof pData === 'object') {
              localStorage.setItem('vocaquest_prof_data_' + p.id, JSON.stringify(pData));
            }
            const cData = await this.get('conquest_' + p.id);
            if (cData && typeof cData === 'object') {
              localStorage.setItem('vocaquest_siege_conquest_' + p.id, JSON.stringify(cData));
            }
          }
        }

        if (storageManager) {
          storageManager._cachedProfileData = {};
          storageManager.invalidateDeckCache();
        }
        AdminLogger.log('IDB', `localStorage 초기화 감지 → IndexedDB 자동 복구 (${idbProfiles.length}개 프로필)`);
        console.log(`[IdbBackup] localStorage 초기화 감지 → IndexedDB에서 프로필 ${idbProfiles.length}개 자동 복구 완료`);
        return { restored: true, count: idbProfiles.length };
      }

      // 정상 상태: 현재 localStorage 데이터를 IndexedDB에 미러링
      if (localProfiles && localProfiles.length > 0) {
        await this.set('profiles', localProfiles);
        const activeId = localStorage.getItem('vocaquest_active_profile_v1') || localProfiles[0].id;
        await this.set('activeProfileId', activeId);

        for (const p of localProfiles) {
          if (p && p.id) {
            const rawData = localStorage.getItem('vocaquest_prof_data_' + p.id);
            if (rawData) {
              try {
                await this.set('profileData_' + p.id, JSON.parse(rawData));
              } catch { /* ignore */ }
            }
            const rawConq = localStorage.getItem('vocaquest_siege_conquest_' + p.id);
            if (rawConq) {
              try {
                await this.set('conquest_' + p.id, JSON.parse(rawConq));
              } catch { /* ignore */ }
            }
          }
        }
        AdminLogger.log('IDB', `IndexedDB 이중 백업 미러링 완료 (${localProfiles.length}개 프로필)`);
      }
      return { restored: false };
    } catch (e) {
      console.warn('[IdbBackup] 동기화/복구 경고:', e);
      return { restored: false };
    }
  }
}
