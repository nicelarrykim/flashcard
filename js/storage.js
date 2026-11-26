// js/storage.js
// 단어장(Deck) 다중 생성 및 단어장별 학습 관리 저장소 모듈

import { DEFAULT_WORDS } from './data/defaultWords.js?v=20261126_02';
import { TEXTBOOK_WORDS } from './data/textbookWords.js?v=20261126_02';
import { CENKLE_VOCA_KING_DECK } from './data/cenkleVocaKing2026.js?v=20261126_02';
import { ELEMENTARY_WORDS_50_DECK } from './data/elementaryWords50.js?v=20261126_02';
import { MasteryManager, RANK_TYPES } from './mastery.js?v=20261126_02';
import { FirebaseSyncManager } from './firebaseSync.js?v=20261126_02';
import { IdbBackup } from './idbBackup.js?v=20261126_02';
import { AdminLogger } from './adminLogger.js?v=20261126_02';

const DECKS_KEY = 'vocaquest_decks_v2';
const ACTIVE_DECK_KEY = 'vocaquest_active_deck_v2';
const SETTINGS_KEY = 'vocaquest_settings_v1';
const STUDY_RANGE_KEY = 'vocaquest_study_range_v1';
const PHOTO_MODE_KEY = 'vocaquest_photo_mode_v1';

// 프로필 및 프로필별 성취도 관리 키
const PROFILES_KEY = 'vocaquest_profiles_v1';
const ACTIVE_PROFILE_KEY = 'vocaquest_active_profile_v1';
const PROFILE_DATA_PREFIX = 'vocaquest_prof_data_';

export class StorageManager {
  /**
   * ==========================================
   * 1. 프로필 관리 시스템 (학습자별 분리)
   * ==========================================
   */
  static _cachedProfileData = {};
  static _profileSaveTimer = null;
  static _pendingSaveProfileIds = new Set();
  static _unloadListenerRegistered = false;

  /**
   * 보류 중인 프로필 데이터 저장 작업을 즉시 localStorage에 플러시
   */
  static flushPendingProfileSaves() {
    if (this._profileSaveTimer) {
      clearTimeout(this._profileSaveTimer);
      this._profileSaveTimer = null;
    }
    if (this._pendingSaveProfileIds.size === 0) return;

    for (const pid of this._pendingSaveProfileIds) {
      const data = this._cachedProfileData[pid];
      if (data) {
        try {
          localStorage.setItem(PROFILE_DATA_PREFIX + pid, JSON.stringify(data));
          IdbBackup.set('profileData_' + pid, data);
        } catch (e) {
          console.error(`Failed to flush profile data for ${pid}:`, e);
        }
      }
    }
    this._pendingSaveProfileIds.clear();
  }

  /**
   * 모든 학습자 프로필 목록 조회
   */
  static getProfiles() {
    try {
      const data = localStorage.getItem(PROFILES_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load profiles:', e);
    }

    // 기본 프로필 로컬 생성 (초기화 시 Firebase를 덮어쓰지 않도록 로컬에만 저장)
    const defaultProfile = {
      id: 'prof_default',
      name: '기본 학습자',
      description: '메인 학습 프로필',
      createdAt: Date.now(),
      avatar: '🛡️'
    };
    const list = [defaultProfile];
    try {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
    } catch (e) {
      console.error(e);
    }
    return list;
  }

  static saveProfiles(profiles) {
    try {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
      IdbBackup.set('profiles', profiles);
      window.dispatchEvent(new CustomEvent('vocaquest_profiles_updated', { detail: profiles }));
      FirebaseSyncManager.saveProfiles(profiles);
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * 현재 활성 프로필 ID
   */
  static getActiveProfileId() {
    try {
      const id = localStorage.getItem(ACTIVE_PROFILE_KEY);
      const profiles = this.getProfiles();
      if (id && profiles.some(p => p.id === id)) {
        return id;
      }
      return profiles[0]?.id || 'prof_default';
    } catch {
      return 'prof_default';
    }
  }

  /**
   * 활성 프로필 전환
   * - 전환 전 프로필 성과를 서버로 자동 업로드 (유실 방지)
   * - 새로 선택된 프로필의 최신 성과를 서버에서 다운로드
   */
  static setActiveProfileId(profileId) {
    try {
      this.flushPendingProfileSaves();
      const oldProfileId = localStorage.getItem(ACTIVE_PROFILE_KEY);
      localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
      IdbBackup.set('activeProfileId', profileId);
      this.invalidateDeckCache();
      window.dispatchEvent(new CustomEvent('vocaquest_profile_changed', { detail: { profileId } }));
      window.dispatchEvent(new CustomEvent('vocaquest_words_updated', { detail: this.getActiveWords() }));
      window.dispatchEvent(new CustomEvent('vocaquest_mastery_changed', { detail: { profileId } }));

      if (oldProfileId && oldProfileId !== profileId) {
        FirebaseSyncManager.switchProfileSafely(this, oldProfileId, profileId);
      }
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * ADMIN 프로필이 목록에 없으면 로컬에 추가 (개발/모니터링용)
   */
  static ensureAdminProfile() {
    const profiles = this.getProfiles();
    const hasAdmin = profiles.some(
      p => p && (p.id === 'prof_admin' || (p.name || '').trim().toUpperCase() === 'ADMIN')
    );
    if (!hasAdmin) {
      profiles.push({
        id: 'prof_admin',
        name: 'ADMIN',
        description: '실시간 로그 및 동기화 모니터링 전용 프로필',
        createdAt: Date.now(),
        avatar: '🛠️'
      });
      try {
        localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
        IdbBackup.set('profiles', profiles);
        window.dispatchEvent(new CustomEvent('vocaquest_profiles_updated', { detail: profiles }));
      } catch (e) {
        console.error(e);
      }
    }
    return profiles;
  }

  /**
   * 현재 활성 프로필 객체
   */
  static getActiveProfile() {
    const id = this.getActiveProfileId();
    const profiles = this.getProfiles();
    return profiles.find(p => p.id === id) || profiles[0];
  }

  /**
   * 새 프로필 추가
   */
  static createProfile(name, description = '', avatar = '⚔️') {
    const profiles = this.getProfiles();
    const newProfile = {
      id: 'prof_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: (name || '새 학습자').trim(),
      description: (description || '').trim(),
      createdAt: Date.now(),
      avatar: avatar || '⚔️'
    };
    profiles.push(newProfile);
    this.saveProfiles(profiles);
    this.setActiveProfileId(newProfile.id);
    return newProfile;
  }

  /**
   * 프로필 수정
   */
  static updateProfile(profileId, { name, description, avatar }) {
    const profiles = this.getProfiles();
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      if (name !== undefined) profile.name = name.trim();
      if (description !== undefined) profile.description = description.trim();
      if (avatar !== undefined) profile.avatar = avatar;
      this.saveProfiles(profiles);
      return profile;
    }
    return null;
  }

  /**
   * 프로필 삭제 (최소 1개 유지)
   */
  static deleteProfile(profileId) {
    let profiles = this.getProfiles();
    if (profiles.length <= 1) {
      throw new Error('최소 1개 이상의 학습자 프로필이 유지되어야 합니다.');
    }
    profiles = profiles.filter(p => p.id !== profileId);
    this.saveProfiles(profiles);
    FirebaseSyncManager.deleteProfile(profileId);

    // 해당 프로필 성취도 데이터 삭제
    try {
      delete this._cachedProfileData[profileId];
      this._pendingSaveProfileIds.delete(profileId);
      localStorage.removeItem(PROFILE_DATA_PREFIX + profileId);
      IdbBackup.remove('profileData_' + profileId);
    } catch (e) {}

    if (this.getActiveProfileId() === profileId) {
      this.setActiveProfileId(profiles[0].id);
    }
    return profiles;
  }

  /**
   * 특정 프로필의 단어 성취도 맵 { [wordId]: { memorized, wrongCount, mastery } }
   * 인메모리 캐싱 지원으로 불필요한 JSON.parse 및 localStorage 읽기를 차단합니다.
   */
  static getProfileData(profileId = null) {
    const targetId = profileId || this.getActiveProfileId();
    if (this._cachedProfileData[targetId]) {
      return this._cachedProfileData[targetId];
    }
    try {
      const data = localStorage.getItem(PROFILE_DATA_PREFIX + targetId);
      if (data) {
        const parsed = JSON.parse(data) || {};
        this._cachedProfileData[targetId] = parsed;
        return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    const empty = {};
    this._cachedProfileData[targetId] = empty;
    return empty;
  }

  /**
   * 프로필 데이터 저장
   * - 인메모리 캐시는 즉시 갱신 (0ms 지연)
   * - localStorage 쓰기는 디바운스(200ms) 및 배치 처리하여 연속 학습 시 프레임 드랍을 원천 차단합니다.
   */
  static saveProfileData(data, profileId = null, immediate = false, changedWordId = null) {
    const targetId = profileId || this.getActiveProfileId();
    this._cachedProfileData[targetId] = data || {};
    this._pendingSaveProfileIds.add(targetId);
    FirebaseSyncManager.markDirty(targetId, this, changedWordId);

    // beforeunload/pagehide 리스너 등록 (새로고침/창 닫기 시 로컬 플러시 + Firebase 자동 백업)
    if (!this._unloadListenerRegistered && typeof window !== 'undefined') {
      this._unloadListenerRegistered = true;
      window.addEventListener('beforeunload', () => {
        this.flushPendingProfileSaves();
        FirebaseSyncManager.flushDirtySync(this);
      });
      window.addEventListener('pagehide', () => {
        this.flushPendingProfileSaves();
        FirebaseSyncManager.flushDirtySync(this);
      });
    }

    if (immediate) {
      this.flushPendingProfileSaves();
      return;
    }

    if (this._profileSaveTimer) {
      clearTimeout(this._profileSaveTimer);
    }
    this._profileSaveTimer = setTimeout(() => {
      this.flushPendingProfileSaves();
    }, 200);
  }

  /**
   * Firebase 체크포인트 동기화 매니저 연결
   */
  static async initServerSync() {
    return await FirebaseSyncManager.initSync(this);
  }

  /**
   * 특정 프로필의 성취도 데이터 초기화
   */
  static resetProfileData(profileId = null) {
    const targetId = profileId || this.getActiveProfileId();
    this.saveProfileData({}, targetId, true);
    window.dispatchEvent(new CustomEvent('vocaquest_mastery_changed', { detail: { profileId: targetId } }));
    window.dispatchEvent(new CustomEvent('vocaquest_words_updated', { detail: this.getActiveWords() }));
  }

  /**
   * 단어의 성취도 상태를 현재 활성 프로필에 동기화 저장 (0ms 메모리 캐시 + 디바운스 I/O)
   */
  static syncWordToProfile(word, profileId = null) {
    if (!word || !word.id) return;
    const targetId = profileId || this.getActiveProfileId();
    const profData = this.getProfileData(targetId);
    const now = Date.now();
    if (word.mastery && !word.mastery.updatedAt) {
      word.mastery.updatedAt = now;
    }
    const wordData = {
      memorized: !!word.memorized,
      wrongCount: typeof word.wrongCount === 'number' ? word.wrongCount : 0,
      mastery: word.mastery ? { ...word.mastery } : null,
      updatedAt: now
    };
    profData[word.id] = wordData;
    this.saveProfileData(profData, targetId, false, word.id);
  }

  /**
   * ==========================================
   * 2. 공통 단어장(Decks) 및 단어 관리 시스템
   * (단어장은 모든 프로필 공통, 성취도는 프로필별 분리 머지)
   * ==========================================
   */
  static _cachedDecks = null;
  static _lastDemotionCheck = 0;

  static invalidateDeckCache() {
    this._cachedDecks = null;
  }

  /**
   * 로컬에 저장된 모든 단어장(공용 + 모든 프로필의 개인 단어장) 원본 목록 조회 (메모리 캐싱 지원)
   */
  static getAllDecks() {
    if (this._cachedDecks) {
      return this._cachedDecks;
    }
    try {
      const data = localStorage.getItem(DECKS_KEY);
      let decks = null;

      if (!data) {
        // 초기 기본 단어장 생성
        decks = [
          { ...JSON.parse(JSON.stringify(CENKLE_VOCA_KING_DECK)), isPublic: true, profileId: null },
          { ...JSON.parse(JSON.stringify(ELEMENTARY_WORDS_50_DECK)), isPublic: true, profileId: null },
          {
            id: 'deck_default',
            name: '기본 추천 단어장',
            description: '필수 기초 및 중급 영단어 15개',
            createdAt: Date.now() - 10000,
            isPublic: true,
            profileId: null,
            words: DEFAULT_WORDS
          },
          {
            id: 'deck_textbook',
            name: '교재 사진 단어장 (177~236)',
            description: '첨부된 책 사진에서 추출한 60개 단어 및 숙어',
            createdAt: Date.now() - 5000,
            isPublic: true,
            profileId: null,
            words: TEXTBOOK_WORDS
          }
        ];
        this.saveDecks(decks);
      } else {
        decks = JSON.parse(data);
        if (Array.isArray(decks) && !decks.some(d => d.id === CENKLE_VOCA_KING_DECK.id || d.name === CENKLE_VOCA_KING_DECK.name)) {
          decks.unshift({ ...JSON.parse(JSON.stringify(CENKLE_VOCA_KING_DECK)), isPublic: true, profileId: null });
          this.saveDecks(decks);
        }
        if (Array.isArray(decks) && !decks.some(d => d.id === ELEMENTARY_WORDS_50_DECK.id || d.name === ELEMENTARY_WORDS_50_DECK.name)) {
          const cenkleIdx = decks.findIndex(d => d.id === CENKLE_VOCA_KING_DECK.id || d.name === CENKLE_VOCA_KING_DECK.name);
          const elemDeck = { ...JSON.parse(JSON.stringify(ELEMENTARY_WORDS_50_DECK)), isPublic: true, profileId: null };
          if (cenkleIdx >= 0) {
            decks.splice(cenkleIdx + 1, 0, elemDeck);
          } else {
            decks.unshift(elemDeck);
          }
          this.saveDecks(decks);
        } else if (Array.isArray(decks)) {
          const elemDeck = decks.find(d => d.id === ELEMENTARY_WORDS_50_DECK.id || d.name === ELEMENTARY_WORDS_50_DECK.name);
          if (elemDeck && Array.isArray(elemDeck.words) && elemDeck.words.length < ELEMENTARY_WORDS_50_DECK.words.length) {
            const existingIds = new Set(elemDeck.words.map(w => w.id || w.word));
            let added = false;
            ELEMENTARY_WORDS_50_DECK.words.forEach(w => {
              if (!existingIds.has(w.id) && !existingIds.has(w.word)) {
                elemDeck.words.push(JSON.parse(JSON.stringify(w)));
                existingIds.add(w.id);
                added = true;
              }
            });
            if (added) {
              this.saveDecks(decks);
            }
          }
        }
      }

      if (Array.isArray(decks) && decks.length > 0) {
        let upgraded = false;
        const profData = this.getProfileData();

        decks.forEach(deck => {
          if (!deck) return;
          if (deck.isPublic === undefined && !deck.profileId) {
            deck.isPublic = true;
            deck.profileId = null;
            upgraded = true;
          }
          if (!Array.isArray(deck.words)) {
            deck.words = [];
            upgraded = true;
          }
          if (!deck.imagePosition) {
            deck.imagePosition = 'meaning';
            upgraded = true;
          }
          deck.words = deck.words.filter(Boolean);
          deck.words.forEach(word => {
            if (word && typeof word.imageUrl !== 'string') {
              word.imageUrl = '';
              upgraded = true;
            }
            if (word && word.word) {
              const cleanWord = word.word.toLowerCase().trim();
              const standardAudio = 'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(cleanWord) + '&type=2';
              if (!word.audioUrl || word.audioUrl.includes('gstatic.com') || word.audioUrl.includes('Spring') || word.audioUrl !== standardAudio) {
                if (word.audioUrl !== standardAudio) {
                  word.audioUrl = standardAudio;
                  upgraded = true;
                }
              }
            }

            const pData = profData[word.id];
            if (pData) {
              word.memorized = !!pData.memorized;
              word.wrongCount = typeof pData.wrongCount === 'number' ? word.wrongCount : 0;
              word.mastery = pData.mastery ? { ...pData.mastery } : null;
            } else if (word.mastery) {
              profData[word.id] = {
                memorized: !!word.memorized,
                wrongCount: typeof word.wrongCount === 'number' ? word.wrongCount : 0,
                mastery: { ...word.mastery }
              };
            } else {
              word.memorized = false;
              word.wrongCount = 0;
              word.mastery = null;
            }

            MasteryManager.ensureMastery(word);
          });
        });

        if (upgraded) {
          localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
          localStorage.setItem(PROFILE_DATA_PREFIX + this.getActiveProfileId(), JSON.stringify(profData));
        }
        this._cachedDecks = decks;
        return decks;
      }
      return this.resetToDefaultDecks();
    } catch (e) {
      console.error('Failed to load decks:', e);
      return this.resetToDefaultDecks();
    }
  }

  /**
   * 단어장 목록 조회
   * @param {boolean} filterByProfile - true면 공용 단어장 + 현재 활성 프로필의 개인 단어장만 반환, false면 전체 반환
   */
  static getDecks(filterByProfile = true) {
    const all = this.getAllDecks();
    if (!filterByProfile) return all;
    const currentPid = this.getActiveProfileId();
    return all.filter(d => d.isPublic === true || !d.profileId || d.profileId === currentPid);
  }

  /**
   * 특정 단어장이 공용 단어장인지 확인
   */
  static isDeckPublic(deckId) {
    const deck = this.getAllDecks().find(d => d.id === deckId);
    return !deck || deck.isPublic === true || !deck.profileId;
  }

  /**
   * 특정 단어장을 현재 사용자가 수정/삭제할 수 있는지 여부
   */
  static isDeckEditable(deckId, isAdmin = false) {
    const deck = this.getAllDecks().find(d => d.id === deckId);
    if (!deck) return false;
    if (deck.isPublic === true || !deck.profileId) {
      return isAdmin; // 공용 단어장은 관리자만 수정 가능
    }
    return deck.profileId === this.getActiveProfileId(); // 개인 단어장은 본인 프로필만 수정 가능
  }

  static saveDecks(decks) {
    try {
      if (!Array.isArray(decks)) return;
      this._cachedDecks = decks;
      localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
      window.dispatchEvent(new CustomEvent('vocaquest_decks_updated', { detail: decks }));
      FirebaseSyncManager.saveDecks(decks);
    } catch (e) {
      console.error('Failed to save decks:', e);
    }
  }

  static getActiveDeckId() {
    try {
      const activeId = localStorage.getItem(ACTIVE_DECK_KEY);
      const decks = this.getDecks();
      if (activeId === 'all') return 'all';
      if (activeId && decks.some(d => d.id === activeId)) {
        return activeId;
      }
      return decks[0]?.id || 'deck_default';
    } catch {
      return 'deck_default';
    }
  }

  static setActiveDeckId(deckId) {
    try {
      localStorage.setItem(ACTIVE_DECK_KEY, deckId);
      window.dispatchEvent(new CustomEvent('vocaquest_deck_changed', { detail: { deckId } }));
      window.dispatchEvent(new CustomEvent('vocaquest_words_updated', { detail: this.getActiveWords() }));
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * 현재 활성 단어장 객체
   */
  static getActiveDeck() {
    const activeId = this.getActiveDeckId();
    const decks = this.getDecks();
    if (activeId === 'all') {
      const allWords = decks.flatMap(d => (d && Array.isArray(d.words)) ? d.words : []);
      return {
        id: 'all',
        name: '전체 단어장 (통합)',
        description: `총 ${decks.length}개 단어장의 모든 단어`,
        words: allWords
      };
    }
    return decks.find(d => d.id === activeId) || decks[0] || { id: 'deck_default', name: '기본 단어장', words: [] };
  }

  /**
   * 현재 활성 단어장의 단어 목록 (전체 단어 반환 - 관리/성과용)
   */
  static getActiveWords() {
    const deck = this.getActiveDeck();
    if (!deck || !Array.isArray(deck.words)) return [];
    const list = [...deck.words].filter(Boolean);
    list.forEach(w => MasteryManager.ensureMastery(w));
    list.sort((a, b) => {
      const numA = (a && typeof a.number === 'number') ? a.number : 999999;
      const numB = (b && typeof b.number === 'number') ? b.number : 999999;
      return numA - numB;
    });
    return list;
  }

  /**
   * 플래시카드 전용 학습 단어 목록 조회
   * 1. 지정된 번호 범위 필터 적용
   * 2. 플래시카드에서 '외움(memorized: true)'으로 체크된 단어는 제외!
   *    (단, 다른 게임에서 오답 시 다시 memorized: false가 되어 플래시카드에 복귀함)
   * 3. 6성 영구 마스터는 제외
   */
  static getFlashcardStudyWords(includeMemorized = false) {
    this.checkRoyalGuardDemotions();
    let words = this.getStudyWords(false);
    if (!includeMemorized) {
      words = words.filter(w => !w.memorized);
    }
    return words;
  }

  /**
   * 플래시카드 & 퀴즈/게임용 단어 목록 조회
   * 1. 지정된 번호 범위 필터 (예: 1~50번) 적용
   * 2. 왕실근위대도 모든 게임에 포함됨! (영구 마스터만 제외)
   * @param {boolean} [includeGraduated=false] 졸업 단어 포함 여부
   */
  static getStudyWords(includeGraduated = false) {
    // 마스터 기간 만료 및 왕실근위대 복귀 확인
    this.checkRoyalGuardDemotions();
    const activeWords = this.getActiveWords();

    // 학습 범위 필터 적용 (예: 1~50번)
    let filtered = activeWords;
    const range = this.getStudyRange();
    if (range && range.enabled) {
      const start = parseInt(range.start, 10);
      const end = parseInt(range.end, 10);
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        filtered = filtered.filter((w, idx) => {
          const num = (w && typeof w.number === 'number' && !isNaN(w.number)) ? w.number : (idx + 1);
          return num >= start && num <= end;
        });
      }
    }

    if (includeGraduated) {
      return filtered;
    }
    return filtered.filter(w => !MasteryManager.isExcludedFromStudy(w));
  }

  /**
   * 학습할 번호 범위 조회 (미설정 시 기본 전체: enabled: false)
   */
  static getStudyRange() {
    try {
      const saved = sessionStorage.getItem(STUDY_RANGE_KEY) || localStorage.getItem(STUDY_RANGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return { enabled: false, start: 1, end: 50 };
  }

  /**
   * 학습할 번호 범위 저장 (다음번 접속 전까지 유지)
   */
  static setStudyRange(enabledOrObj, startNum = 1, endNum = 50) {
    try {
      let range = {};
      if (typeof enabledOrObj === 'object' && enabledOrObj !== null) {
        range = {
          enabled: !!enabledOrObj.enabled,
          start: parseInt(enabledOrObj.start, 10) || 1,
          end: parseInt(enabledOrObj.end, 10) || 50
        };
      } else {
        range = {
          enabled: !!enabledOrObj,
          start: parseInt(startNum, 10) || 1,
          end: parseInt(endNum, 10) || 50
        };
      }
      const data = JSON.stringify(range);
      sessionStorage.setItem(STUDY_RANGE_KEY, data);
      localStorage.setItem(STUDY_RANGE_KEY, data);
      window.dispatchEvent(new CustomEvent('vocaquest_range_changed', { detail: range }));
      window.dispatchEvent(new CustomEvent('vocaquest_words_updated', { detail: this.getActiveWords() }));
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * 사진 표시 옵션 조회 ('auto' | 'always_on' | 'always_off')
   * 기본: auto (왕실근위대부터는 사진 안 나옴)
   */
  static getPhotoDisplayMode() {
    try {
      const mode = localStorage.getItem(PHOTO_MODE_KEY);
      if (mode && ['auto', 'always_on', 'always_off'].includes(mode)) {
        return mode;
      }
    } catch (e) {}
    return 'auto';
  }

  /**
   * 단어의 연상 그림(일러스트)을 현재 옵션/숙련도에 따라 표시해야 하는지 판정
   */
  static shouldShowPhoto(word) {
    if (!word || !word.imageUrl || !word.imageUrl.trim()) return false;
    const mode = this.getPhotoDisplayMode();
    if (mode === 'always_off') return false;
    if (mode === 'always_on') return true;
    // auto: 왕실근위대나 마스터 등급이 아니면 항상 표시!
    try {
      const rank = MasteryManager.getWordRank(word);
      return (rank !== RANK_TYPES.ROYAL_GUARD && rank !== RANK_TYPES.MASTER);
    } catch {
      return true;
    }
  }

  /**
   * 사진 표시 옵션 저장
   */
  static setPhotoDisplayMode(mode) {
    try {
      localStorage.setItem(PHOTO_MODE_KEY, mode);
      window.dispatchEvent(new CustomEvent('vocaquest_photo_mode_changed', { detail: { mode } }));
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * 단어장별 그림 위치 조회 ('meaning' | 'word')
   * 기본설정: 'meaning' (뜻에 그림이 붙어서 보임)
   */
  static getDeckImagePosition(deckId = null) {
    const targetId = deckId || this.getActiveDeckId();
    if (targetId === 'all') return 'meaning';
    const decks = this.getDecks();
    const deck = decks.find(d => d.id === targetId);
    return (deck && deck.imagePosition) ? deck.imagePosition : 'meaning';
  }

  /**
   * 단어장별 그림 위치 저장
   */
  static setDeckImagePosition(deckId, position) {
    const validPos = position === 'word' ? 'word' : 'meaning';
    const targetId = deckId || this.getActiveDeckId();
    const decks = this.getDecks();
    const deck = decks.find(d => d.id === targetId);
    if (deck) {
      deck.imagePosition = validPos;
      this.saveDecks(decks);
      window.dispatchEvent(new CustomEvent('vocaquest_deck_image_pos_changed', {
        detail: { deckId: targetId, imagePosition: validPos }
      }));
    }
  }

  /**
   * 새 단어장 생성
   */
  static createDeck(name, description = '', initialWords = [], imagePosition = 'meaning', isPublic = false, profileId = null) {
    const all = this.getAllDecks();
    const activePid = this.getActiveProfileId();
    const newDeck = {
      id: 'deck_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: name.trim() || '새 단어장',
      description: description.trim() || '',
      createdAt: Date.now(),
      isPublic: Boolean(isPublic),
      profileId: isPublic ? null : (profileId || activePid),
      imagePosition: imagePosition === 'word' ? 'word' : 'meaning',
      words: initialWords
    };
    all.push(newDeck);
    this.saveDecks(all);
    FirebaseSyncManager.uploadDeck(newDeck);
    this.setActiveDeckId(newDeck.id);
    return newDeck;
  }

  /**
   * 단어장 이름, 설명 및 그림 위치 수정
   */
  static updateDeck(deckId, { name, description, imagePosition }) {
    const decks = this.getAllDecks();
    const deck = decks.find(d => d.id === deckId);
    if (deck) {
      if (name !== undefined) deck.name = name.trim();
      if (description !== undefined) deck.description = description.trim();
      if (imagePosition !== undefined) deck.imagePosition = (imagePosition === 'word' ? 'word' : 'meaning');
      this.saveDecks(decks);
      FirebaseSyncManager.uploadDeck(deck);
      return deck;
    }
    return null;
  }

  /**
   * 단어장 삭제
   */
  static deleteDeck(deckId) {
    let decks = this.getAllDecks();
    if (decks.length <= 1) {
      throw new Error('최소 한 개 이상의 단어장이 유지되어야 합니다.');
    }
    decks = decks.filter(d => d.id !== deckId);
    this.saveDecks(decks);
    FirebaseSyncManager.deleteDeck(deckId);

    if (this.getActiveDeckId() === deckId) {
      this.setActiveDeckId(decks[0].id);
    }
    return decks;
  }

  /**
   * 단어 추가 (deckId 생략 시 현재 활성 단어장에 추가)
   */
  static addWord(wordData, targetDeckId = null) {
    const decks = this.getAllDecks();
    const deckId = targetDeckId || (this.getActiveDeckId() === 'all' ? decks[0].id : this.getActiveDeckId());
    const deck = decks.find(d => d.id === deckId) || decks[0];

    const cleanWord = wordData.word.trim();
    const newWord = {
      id: 'w_' + (wordData.number || Date.now()) + '_' + Math.random().toString(36).substr(2, 5),
      number: wordData.number ? parseInt(wordData.number, 10) : null,
      word: cleanWord,
      phonetic: wordData.phonetic?.trim() || '',
      partOfSpeech: wordData.partOfSpeech?.trim() || 'word',
      meaning: wordData.meaning.trim(),
      example: wordData.example?.trim() || '',
      exampleMeaning: wordData.exampleMeaning?.trim() || '',
      imageUrl: wordData.imageUrl?.trim() || '',
      audioUrl: wordData.audioUrl?.trim() || `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleanWord.toLowerCase())}&type=2`,
      tags: wordData.tags || ['custom'],
      level: wordData.level || 'intermediate',
      memorized: false,
      wrongCount: 0,
      createdAt: Date.now()
    };

    deck.words.unshift(newWord);
    MasteryManager.ensureMastery(newWord);
    // 번호가 있다면 번호순 정렬
    deck.words.sort((a, b) => {
      if (a.number && b.number) return a.number - b.number;
      return 0;
    });
    this.saveDecks(decks);
    return newWord;
  }

  /**
   * 단어 대량 추가
   */
  static addWordsBatch(wordsArray, targetDeckId = null) {
    const decks = this.getDecks();
    const deckId = targetDeckId || (this.getActiveDeckId() === 'all' ? decks[0].id : this.getActiveDeckId());
    const deck = decks.find(d => d.id === deckId) || decks[0];
    if (!deck) return [];
    if (!Array.isArray(deck.words)) deck.words = [];

    const createdList = (wordsArray || []).filter(Boolean).map((w, index) => {
      const cleanWord = (w && w.word) ? String(w.word).trim() : 'word';
      const cleanMeaning = (w && w.meaning) ? String(w.meaning).trim() : '';
      const item = {
        id: 'w_' + (w.number || (Date.now() + index)) + '_' + Math.random().toString(36).substr(2, 5),
        number: w.number ? parseInt(w.number, 10) : null,
        word: cleanWord,
        phonetic: w.phonetic?.trim() || '',
        partOfSpeech: w.partOfSpeech?.trim() || 'word',
        meaning: cleanMeaning,
        example: w.example?.trim() || '',
        exampleMeaning: w.exampleMeaning?.trim() || '',
        imageUrl: w.imageUrl?.trim() || '',
        audioUrl: w.audioUrl?.trim() || `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleanWord.toLowerCase())}&type=2`,
        tags: w.tags || ['imported'],
        level: w.level || 'intermediate',
        memorized: false,
        wrongCount: 0,
        createdAt: Date.now()
      };
      MasteryManager.ensureMastery(item);
      return item;
    });

    deck.words = [...createdList, ...deck.words];

    // 번호(number) 기준 정렬
    deck.words.sort((a, b) => {
      if (a.number && b.number) return a.number - b.number;
      if (a.number) return -1;
      if (b.number) return 1;
      return 0;
    });

    this.saveDecks(decks);
    return createdList;
  }

  /**
   * 단어 수정
   */
  static updateWord(wordId, updatedFields) {
    const decks = this.getAllDecks();
    for (const deck of decks) {
      const w = deck.words.find(item => item.id === wordId);
      if (w) {
        Object.assign(w, updatedFields);
        this.saveDecks(decks);
        return w;
      }
    }
    return null;
  }

  /**
   * 단어 삭제
   */
  static deleteWord(wordId) {
    const decks = this.getAllDecks();
    for (const deck of decks) {
      const idx = deck.words.findIndex(item => item.id === wordId);
      if (idx !== -1) {
        deck.words.splice(idx, 1);
        this.saveDecks(decks);
        return true;
      }
    }
    return false;
  }

  /**
   * 암기 완료 상태 표시
   */
  static markMemorized(wordId, memorized = true) {
    const decks = this.getAllDecks();
    for (const deck of decks) {
      const w = deck.words.find(item => item.id === wordId);
      if (w) {
        w.memorized = memorized;
        if (memorized && w.wrongCount > 0) {
          w.wrongCount = Math.max(0, w.wrongCount - 1);
        }
        // 프로필별 성취도 저장소에 동기화 (0ms 로컬 저장)
        this.syncWordToProfile(w);
        return;
      }
    }
  }

  /**
   * 오답 기록
   */
  static recordMistake(wordId) {
    const decks = this.getAllDecks();
    for (const deck of decks) {
      const w = deck.words.find(item => item.id === wordId);
      if (w) {
        w.wrongCount = (w.wrongCount || 0) + 1;
        w.memorized = false;
        // 프로필별 성취도 저장소에 동기화 (0ms 로컬 저장)
        this.syncWordToProfile(w);
        return;
      }
    }
  }

  /**
   * 단어 숙련도 활동 반영
   * @param {string} wordId 단어 ID
   * @param {string} action 'fc_seen' | 'fc_know' | 'fc_confused' | 'fc_unknown' | 'quiz_correct' | 'quiz_wrong' | 'game_correct' | 'game_wrong' | 'promote_to_master' | 'reset'
   * @param {Object} meta 부가 정보
   */
  static updateWordMastery(wordId, action, meta = {}) {
    const decks = this.getAllDecks();
    for (const deck of decks) {
      const w = deck.words.find(item => item.id === wordId);
      if (w) {
        const result = MasteryManager.applyAction(w, action, meta);
        // memorized 상태 동기화
        if (action === 'fc_know') {
          w.memorized = true;
        } else if (action === 'fc_unknown' || action === 'quiz_wrong' || action === 'game_wrong') {
          // 게임이나 플래시카드에서 오답 시 memorized 해제 -> 플래시카드에 다시 등장!
          w.memorized = false;
        }
        // 프로필별 성취도 저장소에 동기화 (0ms 로컬 저장)
        this.syncWordToProfile(w);

        // 승급 이벤트 발송
        if (result.promotedToMaster || result.promotedToRoyalGuard) {
          window.dispatchEvent(new CustomEvent('vocaquest_rank_promoted', {
            detail: {
              word: w,
              toRank: result.newRank,
              isMaster: result.promotedToMaster,
              isRoyalGuard: result.promotedToRoyalGuard
            }
          }));
        }

        window.dispatchEvent(new CustomEvent('vocaquest_mastery_changed', {
          detail: { wordId, action, ...result }
        }));
        return result;
      }
    }
    return null;
  }

  /**
   * 특정 단어 숙련도 0점/초기 상태로 리셋
   */
  static resetWordMastery(wordId) {
    const decks = this.getAllDecks();
    for (const deck of decks) {
      const w = deck.words.find(item => item.id === wordId);
      if (w) {
        MasteryManager.resetMastery(w);
        w.memorized = false;
        w.wrongCount = 0;
        this.syncWordToProfile(w);
        this.saveDecks(decks);
        window.dispatchEvent(new CustomEvent('vocaquest_mastery_changed', {
          detail: { wordId, action: 'reset' }
        }));
        return true;
      }
    }
    return false;
  }

  /**
   * 특정 단어장 (또는 전체)의 모든 단어 숙련도 일괄 리셋
   */
  static resetAllWordsMastery(deckId = 'all') {
    const decks = this.getDecks();
    let count = 0;
    decks.forEach(deck => {
      if (deckId === 'all' || deck.id === deckId) {
        if (Array.isArray(deck.words)) {
          deck.words.forEach(w => {
            MasteryManager.resetMastery(w);
            w.memorized = false;
            w.wrongCount = 0;
            this.syncWordToProfile(w);
            count++;
          });
        }
      }
    });
    this.saveDecks(decks);
    window.dispatchEvent(new CustomEvent('vocaquest_mastery_changed', {
      detail: { deckId, action: 'reset_all', count }
    }));
    return count;
  }

  /**
   * 2일 이상 경과된 왕실근위대를 고급기사로 자동 강등 검사 (10분 주기 쓰로틀)
   * -> 이제 마스터 기간 만료 시 왕실근위대로 복귀 검사로 동작함
   */
  static checkRoyalGuardDemotions() {
    const now = Date.now();
    if (now - this._lastDemotionCheck < 600000) {
      return 0;
    }
    this._lastDemotionCheck = now;

    try {
      const decks = this.getDecks();
      const demotedCount = MasteryManager.checkAndApplyDemotions(decks);
      if (demotedCount > 0) {
        decks.forEach(d => {
          (d.words || []).forEach(w => this.syncWordToProfile(w));
        });
        this.saveDecks(decks);
        console.log(`[VocaQuest] 마스터 기간 만료로 ${demotedCount}개 단어가 왕실근위대로 복귀되었습니다.`);
      }
      return demotedCount;
    } catch (e) {
      console.error('Demotion check error:', e);
      return 0;
    }
  }

  // 호환성을 위한 getWords alias
  static getWords() {
    return this.getActiveWords();
  }

  static resetToDefaultDecks() {
    localStorage.removeItem(DECKS_KEY);
    localStorage.removeItem(ACTIVE_DECK_KEY);
    return this.getDecks();
  }

  static getSettings() {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      return data ? JSON.parse(data) : { soundEnabled: true, ttsRate: 0.9, darkMode: false };
    } catch {
      return { soundEnabled: true, ttsRate: 0.9, darkMode: false };
    }
  }

  static saveSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error(e);
    }
  }

  static exportJSON() {
    const activeDeck = this.getActiveDeck();
    const jsonString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeDeck, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", `${activeDeck.name}_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  /**
   * SQLite3 데이터베이스 파일 (.db)로 현재 활성 단어장 내보내기
   */
  static async exportDB() {
    const activeDeck = this.getActiveDeck();
    if (!window.initSqlJs) {
      alert('SQLite 엔진(sql.js)이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      const SQL = await window.initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
      });
      const db = new SQL.Database();

      // 테이블 생성
      db.run(`
        CREATE TABLE decks (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          imagePosition TEXT DEFAULT 'meaning',
          createdAt INTEGER
        );
        CREATE TABLE words (
          id TEXT PRIMARY KEY,
          deck_id TEXT NOT NULL,
          number INTEGER,
          word TEXT NOT NULL,
          phonetic TEXT,
          partOfSpeech TEXT,
          meaning TEXT NOT NULL,
          example TEXT,
          exampleMeaning TEXT,
          imageUrl TEXT,
          audioUrl TEXT,
          tags TEXT,
          level TEXT DEFAULT 'intermediate',
          memorized INTEGER DEFAULT 0,
          wrongCount INTEGER DEFAULT 0,
          createdAt INTEGER
        );
        CREATE TABLE metadata (
          key TEXT PRIMARY KEY,
          value TEXT
        );
      `);

      // 단어장 삽입
      db.run("INSERT INTO decks VALUES (?, ?, ?, ?, ?)", [
        activeDeck.id,
        activeDeck.name,
        activeDeck.description || '',
        activeDeck.imagePosition || 'meaning',
        activeDeck.createdAt || Date.now()
      ]);

      // 단어 목록 삽입
      const words = activeDeck.words || [];
      words.forEach(w => {
        db.run("INSERT INTO words VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
          w.id,
          activeDeck.id,
          w.number || null,
          w.word,
          w.phonetic || '',
          w.partOfSpeech || 'word',
          w.meaning,
          w.example || '',
          w.exampleMeaning || '',
          w.imageUrl || '',
          w.audioUrl || '',
          JSON.stringify(w.tags || []),
          w.level || 'intermediate',
          w.memorized ? 1 : 0,
          w.wrongCount || 0,
          w.createdAt || Date.now()
        ]);
      });

      // 메타데이터 백업 삽입
      db.run("INSERT INTO metadata VALUES (?, ?)", ["deck_name", activeDeck.name]);
      db.run("INSERT INTO metadata VALUES (?, ?)", ["total_words", String(words.length)]);
      db.run("INSERT INTO metadata VALUES (?, ?)", ["backup_json", JSON.stringify(activeDeck)]);

      const binaryArray = db.export();
      const blob = new Blob([binaryArray], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", url);
      downloadAnchor.setAttribute("download", `${activeDeck.name}_${new Date().toISOString().slice(0, 10)}.db`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export DB:', e);
      alert('DB 내보내기 중 오류가 발생했습니다: ' + e.message);
    }
  }

  /**
   * DB 파일 (.db, .sqlite, .sqlite3) 또는 JSON 파일 단어장 가져오기
   */
  static async importDatabaseFile(file) {
    if (!file) throw new Error('파일이 선택되지 않았습니다.');
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // 1. SQLite 헤더 검사 ("SQLite format 3\000")
    const headerStr = String.fromCharCode(...uint8.slice(0, 16));
    const isSQLite = headerStr.startsWith("SQLite format 3");

    if (isSQLite) {
      return this.parseAndImportSQLite(uint8, file.name);
    }

    // 2. 일반 텍스트(JSON)로 시도
    const text = new TextDecoder('utf-8').decode(uint8);
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return this.createDeck(file.name.replace(/\.[^/.]+$/, ''), '가져온 단어장', parsed);
      } else if (parsed && Array.isArray(parsed.words)) {
        return this.createDeck(parsed.name || file.name.replace(/\.[^/.]+$/, ''), parsed.description || '', parsed.words);
      } else {
        throw new Error('올바른 단어장 형식이 아닙니다.');
      }
    } catch (err) {
      throw new Error(`파일 파싱 실패: ${err.message}`);
    }
  }

  /**
   * SQLite 바이트 배열 파싱 및 단어장 생성
   */
  static async parseAndImportSQLite(uint8, fileName) {
    let deckObj = null;

    // 방법 A: sql.js 사용 (브라우저 WASM)
    if (window.initSqlJs) {
      try {
        const SQL = await window.initSqlJs({
          locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        const db = new SQL.Database(uint8);

        // 1) metadata 테이블에 backup_json이 있는지 확인
        try {
          const metaRes = db.exec("SELECT value FROM metadata WHERE key='backup_json'");
          if (metaRes.length > 0 && metaRes[0].values.length > 0) {
            const rawJson = metaRes[0].values[0][0];
            deckObj = JSON.parse(rawJson);
          }
        } catch (e) {
          // metadata 테이블이 없을 수 있음
        }

        // 2) backup_json이 없으면 직접 decks / words 테이블 쿼리
        if (!deckObj) {
          let deckName = fileName.replace(/\.[^/.]+$/, '');
          let deckDesc = '가져온 DB 단어장';
          let imagePosition = 'meaning';

          try {
            const dRes = db.exec("SELECT name, description, imagePosition FROM decks LIMIT 1");
            if (dRes.length > 0 && dRes[0].values.length > 0) {
              const row = dRes[0].values[0];
              deckName = row[0] || deckName;
              deckDesc = row[1] || deckDesc;
              imagePosition = row[2] || imagePosition;
            }
          } catch (e) {}

          const wRes = db.exec("SELECT number, word, meaning, partOfSpeech, phonetic, example, exampleMeaning, imageUrl, audioUrl, tags, level FROM words ORDER BY number ASC, id ASC");
          if (wRes.length > 0 && wRes[0].values.length > 0) {
            const cols = wRes[0].columns;
            const words = wRes[0].values.map(row => {
              const item = {};
              cols.forEach((col, idx) => { item[col] = row[idx]; });
              let tags = [deckName];
              try { if (item.tags) tags = JSON.parse(item.tags); } catch {}
              return {
                id: 'w_' + (item.number || Date.now()) + '_' + Math.random().toString(36).substr(2, 5),
                number: item.number ? parseInt(item.number, 10) : null,
                word: String(item.word || '').trim(),
                meaning: String(item.meaning || '').trim(),
                partOfSpeech: item.partOfSpeech || 'word',
                phonetic: item.phonetic || '',
                example: item.example || '',
                exampleMeaning: item.exampleMeaning || '',
                imageUrl: item.imageUrl || '',
                audioUrl: item.audioUrl || `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(String(item.word || '').trim().toLowerCase())}&type=2`,
                tags: tags,
                level: item.level || 'intermediate',
                memorized: false,
                wrongCount: 0
              };
            });

            deckObj = {
              name: deckName,
              description: deckDesc,
              imagePosition: imagePosition,
              words: words
            };
          }
        }
      } catch (err) {
        console.warn('sql.js execution failed, trying binary fallback:', err);
      }
    }

    // 방법 B: sql.js 로드 실패 시 순수 바이너리 텍스트 스캔 폴백
    if (!deckObj) {
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(uint8);
      // "backup_json" 뒤의 JSON 검색
      const backupIdx = decoded.indexOf('"backup_json"');
      if (backupIdx !== -1) {
        const startBrace = decoded.indexOf('{', backupIdx);
        if (startBrace !== -1) {
          // 브라켓 매칭으로 올바른 JSON 추출
          let depth = 0;
          let endBrace = -1;
          for (let i = startBrace; i < decoded.length; i++) {
            if (decoded[i] === '{') depth++;
            else if (decoded[i] === '}') {
              depth--;
              if (depth === 0) {
                endBrace = i;
                break;
              }
            }
          }
          if (endBrace !== -1) {
            try {
              const jsonSlice = decoded.substring(startBrace, endBrace + 1);
              deckObj = JSON.parse(jsonSlice);
            } catch (e) {
              console.error('Fallback JSON parse error:', e);
            }
          }
        }
      }
    }

    if (deckObj && Array.isArray(deckObj.words) && deckObj.words.length > 0) {
      return this.createDeck(deckObj.name || fileName.replace(/\.[^/.]+$/, ''), deckObj.description || '', deckObj.words, deckObj.imagePosition || 'meaning');
    } else {
      throw new Error('SQLite DB 파일에서 유효한 단어 데이터를 추출하지 못했습니다.');
    }
  }

  static importJSON(file) {
    return this.importDatabaseFile(file);
  }
}

// 브라우저 전역 안전 접근 바인딩 (구버전 캐시 또는 모듈 분리 시 안전성 보장)
StorageManager.initServerSync = async function() {
  return await FirebaseSyncManager.initSync(StorageManager);
};

if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}
