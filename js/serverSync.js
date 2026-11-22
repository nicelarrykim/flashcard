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

    // 2. 현재 웹페이지가 http:// 또는 https:// 로 제공 중인 경우
    if (window.location.protocol.startsWith('http')) {
      if (window.location.port === '8080') {
        return window.location.origin;
      }
      // 로컬 웹 게임 포트(8000 등)와 동기화 전용 포트(8080) 분리 자동 감지
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.')) {
        return `http://${window.location.hostname}:8080`;
      }
      return 'http://192.168.0.110:8080';
    }

    // 3. 로컬 파일(file:///) 등으로 열었을 경우 기본 localhost:8080 사용
    return 'http://localhost:8080';
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
   * ⭐ 현재 활성 프로필로 선택된 사용자의 성과만 서버로 올리기
   */
  static async uploadActiveProfileToServer(storageManager, targetUrl = null) {
    const url = (targetUrl && targetUrl.trim()) ? targetUrl.trim().replace(/\/+$/, '') : this.getServerUrl();
    const activeProf = storageManager.getActiveProfile();
    if (!activeProf) {
      return { success: false, error: '현재 선택된 활성 프로필이 없습니다.' };
    }

    const profileData = storageManager.getProfileData(activeProf.id) || {};
    const wordCount = Object.keys(profileData).length;

    console.log(`[ServerSync] 현재 활성 프로필 (${activeProf.name}) 성과 서버 업로드 시작: ${url}`, activeProf, wordCount);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      // 1. 프로필 정보 서버 업로드 (POST /api/profiles)
      const profRes = await fetch(`${url}/api/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([activeProf]),
        signal: controller.signal
      });

      if (!profRes.ok) {
        throw new Error(`프로필 저장 실패: HTTP ${profRes.status}`);
      }

      // 2. 해당 프로필의 단어별 성취도 업로드 (POST /api/profiles/<id>/data)
      const dataRes = await fetch(`${url}/api/profiles/${encodeURIComponent(activeProf.id)}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!dataRes.ok) {
        throw new Error(`성취도 저장 실패: HTTP ${dataRes.status}`);
      }

      this.isServerConnected = true;
      this.serverUrl = url;
      localStorage.setItem(SERVER_URL_KEY, url);
      this.dispatchStatus({ status: 'online' });

      return {
        success: true,
        profile: activeProf,
        wordCount
      };
    } catch (e) {
      console.warn('[ServerSync] 활성 프로필 업로드 실패:', e);
      return { success: false, error: e.message || '네트워크 연결 실패' };
    }
  }

  /**
   * ⭐ 서버에 저장되어 있는 모든 프로필 목록 조회
   */
  static async fetchServerProfiles(targetUrl = null) {
    const url = (targetUrl && targetUrl.trim()) ? targetUrl.trim().replace(/\/+$/, '') : this.getServerUrl();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${url}/api/profiles`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = await res.json();
      return { success: true, profiles: Array.isArray(list) ? list : [] };
    } catch (e) {
      console.warn('[ServerSync] 서버 프로필 목록 조회 실패:', e);
      return { success: false, error: e.message || '서버 응답 없음', profiles: [] };
    }
  }

  /**
   * ⭐ 서버에서 특정 선택된 프로필의 성과를 내려받아 로컬에 반영 및 활성화
   */
  static async downloadSpecificProfileFromServer(storageManager, profileId, targetUrl = null) {
    if (!profileId) {
      return { success: false, error: '가져올 프로필 ID가 지정되지 않았습니다.' };
    }

    const url = (targetUrl && targetUrl.trim()) ? targetUrl.trim().replace(/\/+$/, '') : this.getServerUrl();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      // 1. 서버 프로필 목록 조회하여 대상 프로필 정보 확인
      const profsRes = await fetch(`${url}/api/profiles`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      if (!profsRes.ok) throw new Error(`프로필 조회 실패: HTTP ${profsRes.status}`);
      const serverProfiles = await profsRes.json();
      const targetProf = (serverProfiles || []).find(p => p.id === profileId);

      if (!targetProf) {
        throw new Error('서버에서 해당 프로필 정보를 찾을 수 없습니다.');
      }

      // 2. 대상 프로필의 단어별 성취도 데이터 조회 (GET /api/profiles/<id>/data)
      const dataRes = await fetch(`${url}/api/profiles/${encodeURIComponent(profileId)}/data`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!dataRes.ok) throw new Error(`성취도 조회 실패: HTTP ${dataRes.status}`);
      const serverData = await dataRes.json();

      // 3. 로컬 프로필 목록에 추가 또는 갱신
      const localProfiles = storageManager.getProfiles();
      const existingIdx = localProfiles.findIndex(p => p.id === profileId);
      if (existingIdx >= 0) {
        localProfiles[existingIdx] = { ...localProfiles[existingIdx], ...targetProf };
      } else {
        localProfiles.push(targetProf);
      }
      storageManager.saveProfiles(localProfiles);

      // 4. 로컬 성취도 데이터 갱신
      storageManager.saveProfileData(serverData || {}, profileId);

      // 5. 해당 프로필을 활성 프로필로 즉시 전환!
      storageManager.setActiveProfileId(profileId);

      this.isServerConnected = true;
      this.serverUrl = url;
      localStorage.setItem(SERVER_URL_KEY, url);
      this.dispatchStatus({ status: 'online' });
      window.dispatchEvent(new CustomEvent('vocaquest_sync_completed'));

      return {
        success: true,
        profile: targetProf,
        wordCount: Object.keys(serverData || {}).length
      };
    } catch (e) {
      console.warn('[ServerSync] 프로필 개별 다운로드 실패:', e);
      return { success: false, error: e.message || '네트워크 연결 실패' };
    }
  }

  /**
   * 로컬의 모든 학습 데이터(프로필 + 모든 단어 성취도)를 서버로 강제 업로드
   */
  static async uploadAllLocalToServer(storageManager, targetUrl = null) {
    const url = (targetUrl && targetUrl.trim()) ? targetUrl.trim().replace(/\/+$/, '') : this.getServerUrl();
    const profiles = storageManager.getProfiles();
    const profileData = {};

    for (const p of profiles) {
      profileData[p.id] = storageManager.getProfileData(p.id);
    }

    const payload = {
      timestamp: Date.now(),
      profiles,
      profileData
    };

    console.log(`[ServerSync] 로컬 데이터 서버 업로드 시도: ${url}/api/sync`, payload);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${url}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        this.isServerConnected = true;
        this.serverUrl = url;
        localStorage.setItem(SERVER_URL_KEY, url);
        this.dispatchStatus({ status: 'online' });
        return { success: true, count: profiles.length };
      } else {
        const errJson = await res.json().catch(() => ({}));
        return { success: false, error: errJson.error || `HTTP ${res.status}` };
      }
    } catch (e) {
      console.warn('[ServerSync] 서버 업로드 실패:', e);
      return { success: false, error: e.message || '네트워크 연결 실패' };
    }
  }

  /**
   * 서버의 데이터를 이 기기(로컬)로 강제 내려받기
   */
  static async downloadFromServerToLocal(storageManager, targetUrl = null) {
    const url = (targetUrl && targetUrl.trim()) ? targetUrl.trim().replace(/\/+$/, '') : this.getServerUrl();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${url}/api/sync`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const bundle = await res.json();
      const serverProfiles = bundle.profiles || [];
      const serverProfileData = bundle.profileData || {};

      if (serverProfiles.length === 0) {
        return { success: false, error: '서버에 저장된 프로필 데이터가 없습니다.' };
      }

      // 서버 데이터로 로컬 덮어쓰기
      storageManager.saveProfiles(serverProfiles);
      for (const [pid, pData] of Object.entries(serverProfileData)) {
        storageManager.saveProfileData(pData, pid);
      }

      this.isServerConnected = true;
      this.serverUrl = url;
      localStorage.setItem(SERVER_URL_KEY, url);
      this.dispatchStatus({ status: 'online' });
      window.dispatchEvent(new CustomEvent('vocaquest_sync_completed'));

      return { success: true, count: serverProfiles.length };
    } catch (e) {
      console.warn('[ServerSync] 서버 다운로드 실패:', e);
      return { success: false, error: e.message || '네트워크 연결 실패' };
    }
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

      // 서버가 완전히 비어있고 로컬에 성취도 데이터가 있는 경우, 로컬 데이터를 서버로 자동 업로드 (로컬 성과 보존)
      let totalLocalRecords = 0;
      for (const p of localProfiles) {
        totalLocalRecords += Object.keys(storageManager.getProfileData(p.id) || {}).length;
      }
      let totalServerRecords = 0;
      for (const p of Object.values(serverProfileData)) {
        totalServerRecords += Object.keys(p || {}).length;
      }

      if (totalLocalRecords > 0 && totalServerRecords === 0) {
        console.log('[ServerSync] 서버가 비어있어 로컬 성과를 서버로 자동 승격 업로드합니다.');
        await this.uploadAllLocalToServer(storageManager);
        localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
        window.dispatchEvent(new CustomEvent('vocaquest_sync_completed'));
        return;
      }

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
