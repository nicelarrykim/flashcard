// js/serverSync.js
// VocaQuest 서버 동기화 클라이언트 모듈
// 사용자 프로필 및 성취도 데이터를 서버(SQLite)와 실시간 동기화하여 서로 다른 기기에서 연동

const SERVER_URL_KEY = 'vocaquest_server_custom_url_v1';
const LAST_SYNC_KEY = 'vocaquest_last_sync_time_v1';

export class ServerSyncManager {
  static isServerConnected = false;
  static serverUrl = '';
  static syncQueue = new Map(); // profileId -> timerId (디바운스 저장 큐)
  static pollingTimer = null;

  /**
   * 서버 베이스 URL 확인
   */
  static getServerUrl() {
    // 1. 사용자가 명시적으로 입력한 커스텀 서버 주소 우선 확인
    try {
      const customUrl = localStorage.getItem(SERVER_URL_KEY);
      if (customUrl && customUrl.trim()) {
        return customUrl.trim().replace(/\/+$/, '');
      }
    } catch (e) {}

    // 2. 현재 웹페이지가 http:// 또는 https:// 로 제공 중인 경우 현재 origin 사용
    if (window.location.protocol.startsWith('http')) {
      return window.location.origin;
    }

    // 3. 로컬 파일(file:///) 등으로 열었을 경우 기본 localhost:8000 사용
    return 'http://localhost:8000';
  }

  static setCustomServerUrl(url) {
    if (url && url.trim()) {
      localStorage.setItem(SERVER_URL_KEY, url.trim().replace(/\/+$/, ''));
    } else {
      localStorage.removeItem(SERVER_URL_KEY);
    }
    this.serverUrl = this.getServerUrl();
    return this.checkConnection(true);
  }

  /**
   * 서버 연결 상태 확인
   */
  static async checkConnection(notify = false) {
    this.serverUrl = this.getServerUrl();
    const endpoint = `${this.serverUrl}/api/status`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const info = await res.json();
        this.isServerConnected = true;
        this.dispatchStatus(info);
        return { connected: true, info };
      }
    } catch (e) {
      // 서버 미응답 또는 오프라인
    }

    this.isServerConnected = false;
    this.dispatchStatus(null);
    return { connected: false, info: null };
  }

  static dispatchStatus(serverInfo = null) {
    window.dispatchEvent(new CustomEvent('vocaquest_server_status_changed', {
      detail: {
        connected: this.isServerConnected,
        serverUrl: this.serverUrl,
        serverInfo
      }
    }));
  }

  /**
   * 초기 전체 동기화 실행 (앱 구동 시 호출)
   */
  static async initSync(storageManager) {
    const { connected } = await this.checkConnection();
    if (!connected) {
      console.log('[ServerSync] 서버 오프라인 또는 단독 로컬 모드로 동작합니다.');
      return;
    }

    try {
      console.log('[ServerSync] 서버와 양방향 프로필 및 성취도 동기화 시작...');
      
      // 1. 서버의 전체 프로필 및 성취도 번들 가져오기
      const res = await fetch(`${this.serverUrl}/api/sync`);
      if (!res.ok) return;

      const serverBundle = await res.json();
      const serverProfiles = serverBundle.profiles || [];
      const serverProfileData = serverBundle.profileData || {};

      // 로컬 프로필 조회
      const localProfiles = storageManager.getProfiles();
      const mergedProfiles = [...localProfiles];

      // 서버 프로필을 로컬에 병합
      for (const sp of serverProfiles) {
        const idx = mergedProfiles.findIndex(lp => lp.id === sp.id);
        if (idx >= 0) {
          // 최신 생성/업데이트 정보로 병합
          mergedProfiles[idx] = { ...mergedProfiles[idx], ...sp };
        } else {
          mergedProfiles.push(sp);
        }
      }

      // 서버에 없는 로컬 프로필이 있다면 서버로 업로드
      const missingOnServer = localProfiles.filter(lp => !serverProfiles.some(sp => sp.id === lp.id));
      if (missingOnServer.length > 0) {
        await this.uploadProfiles(localProfiles);
      }

      // 로컬 저장소 갱신
      storageManager.saveProfiles(mergedProfiles);

      // 2. 프로필별 성취도 데이터 병합
      for (const prof of mergedProfiles) {
        const localData = storageManager.getProfileData(prof.id) || {};
        const remoteData = serverProfileData[prof.id] || {};

        // 서버 성취도와 로컬 성취도 병합 (서버의 숙련도가 더 최신이거나 존재하면 병합)
        const mergedData = { ...localData };
        let hasLocalNewData = false;

        for (const [wordId, rItem] of Object.entries(remoteData)) {
          const lItem = mergedData[wordId];
          if (!lItem) {
            mergedData[wordId] = rItem;
          } else {
            // 더 높은 스코어나 외움 상태 우선 보존
            const rScore = rItem.mastery ? (rItem.mastery.score || 0) : 0;
            const lScore = lItem.mastery ? (lItem.mastery.score || 0) : 0;
            if (rScore >= lScore) {
              mergedData[wordId] = rItem;
            } else {
              hasLocalNewData = true;
            }
          }
        }

        // 로컬에만 있는 데이터가 있다면 서버로 푸시 필요
        for (const [wordId, lItem] of Object.entries(localData)) {
          if (!remoteData[wordId]) {
            hasLocalNewData = true;
          }
        }

        storageManager.saveProfileData(mergedData, prof.id);

        if (hasLocalNewData) {
          this.scheduleProfileDataSave(prof.id, mergedData);
        }
      }

      localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
      console.log('[ServerSync] 서버 동기화 완료! 프로필:', mergedProfiles.length);

      // UI 갱신 이벤트 트리거
      window.dispatchEvent(new CustomEvent('vocaquest_sync_completed'));
    } catch (e) {
      console.error('[ServerSync] 초기 동기화 실패:', e);
    }

    // 3. 45초마다 백그라운드 주기적 연결 확인
    if (!this.pollingTimer) {
      this.pollingTimer = setInterval(() => {
        this.checkConnection();
      }, 45000);
    }
  }

  /**
   * 프로필 목록을 서버에 업로드
   */
  static async uploadProfiles(profiles) {
    if (!this.isServerConnected) return;
    try {
      await fetch(`${this.serverUrl}/api/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profiles)
      });
    } catch (e) {
      console.warn('[ServerSync] 프로필 업로드 실패:', e);
    }
  }

  /**
   * 특정 프로필 삭제를 서버에 반영
   */
  static async deleteProfile(profileId) {
    if (!this.isServerConnected) return;
    try {
      await fetch(`${this.serverUrl}/api/profiles/${encodeURIComponent(profileId)}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.warn('[ServerSync] 프로필 삭제 서버 반영 실패:', e);
    }
  }

  /**
   * 프로필 성취도 데이터를 디바운스하여 서버에 저장
   * (학습 카드를 빠르게 넘기거나 퀴즈를 풀 때 서버 요청 과부하 방지)
   */
  static scheduleProfileDataSave(profileId, data) {
    if (!profileId) return;

    if (this.syncQueue.has(profileId)) {
      clearTimeout(this.syncQueue.get(profileId));
    }

    const timerId = setTimeout(async () => {
      this.syncQueue.delete(profileId);
      if (!this.isServerConnected) {
        // 서버 연결 재확인
        const { connected } = await this.checkConnection();
        if (!connected) return;
      }

      try {
        await fetch(`${this.serverUrl}/api/profiles/${encodeURIComponent(profileId)}/data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data || {})
        });
        // console.log(`[ServerSync] 프로필(${profileId}) 성취도 서버 저장 완료`);
      } catch (e) {
        console.warn(`[ServerSync] 프로필(${profileId}) 성취도 서버 저장 실패:`, e);
      }
    }, 600); // 600ms 디바운스

    this.syncQueue.set(profileId, timerId);
  }
}
