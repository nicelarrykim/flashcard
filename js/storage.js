// js/storage.js
// 단어장(Deck) 다중 생성 및 단어장별 학습 관리 저장소 모듈

import { DEFAULT_WORDS } from './data/defaultWords.js?v=20261122_01';
import { TEXTBOOK_WORDS } from './data/textbookWords.js?v=20261122_01';

const DECKS_KEY = 'vocaquest_decks_v2';
const ACTIVE_DECK_KEY = 'vocaquest_active_deck_v2';
const SETTINGS_KEY = 'vocaquest_settings_v1';

export class StorageManager {
  /**
   * 모든 단어장 목록 조회
   */
  static getDecks() {
    try {
      const data = localStorage.getItem(DECKS_KEY);
      if (!data) {
        // 초기 기본 단어장 2개 생성
        const initialDecks = [
          {
            id: 'deck_default',
            name: '기본 추천 단어장',
            description: '필수 기초 및 중급 영단어 15개',
            createdAt: Date.now() - 10000,
            words: DEFAULT_WORDS
          },
          {
            id: 'deck_textbook',
            name: '교재 사진 단어장 (177~236)',
            description: '첨부된 책 사진에서 추출한 60개 단어 및 숙어',
            createdAt: Date.now(),
            words: TEXTBOOK_WORDS
          }
        ];
        this.saveDecks(initialDecks);
        return initialDecks;
      }

      const decks = JSON.parse(data);
      if (Array.isArray(decks) && decks.length > 0) {
        // 단어장 객체 검증 및 보정 (words 배열 보장)
        let upgraded = false;
        decks.forEach(deck => {
          if (!deck) return;
          if (!Array.isArray(deck.words)) {
            deck.words = [];
            upgraded = true;
          }
          deck.words = deck.words.filter(Boolean);
          deck.words.forEach(word => {
            if (word) {
              // 교재 단어라면 엄선된 직관적인 연상 일러스트/사진으로 자동 동기화
              const match = TEXTBOOK_WORDS.find(t => 
                (t.number && word.number && t.number === word.number) ||
                (t.word && word.word && String(t.word).toLowerCase().trim() === String(word.word).toLowerCase().trim())
              );
              if (match && match.imageUrl && (word.imageUrl !== match.imageUrl)) {
                word.imageUrl = match.imageUrl;
                upgraded = true;
              }
            }
          });
        });
        if (upgraded) {
          localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
        }
        return decks;
      }
      return this.resetToDefaultDecks();
    } catch (e) {
      console.error('Failed to load decks:', e);
      return this.resetToDefaultDecks();
    }
  }

  static saveDecks(decks) {
    try {
      localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
      window.dispatchEvent(new CustomEvent('vocaquest_decks_updated', { detail: decks }));
      window.dispatchEvent(new CustomEvent('vocaquest_words_updated', { detail: this.getActiveWords() }));
    } catch (e) {
      console.error('Failed to save decks:', e);
    }
  }

  /**
   * 현재 선택된 활성 단어장 ID (전체 단어장 보기: 'all')
   */
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
   * 현재 활성 단어장의 단어 목록 (플래시카드 및 게임에서 사용)
   */
  static getActiveWords() {
    const deck = this.getActiveDeck();
    if (!deck || !Array.isArray(deck.words)) return [];
    const list = [...deck.words].filter(Boolean);
    list.sort((a, b) => {
      const numA = (a && typeof a.number === 'number') ? a.number : 999999;
      const numB = (b && typeof b.number === 'number') ? b.number : 999999;
      return numA - numB;
    });
    return list;
  }

  /**
   * 새 단어장 생성
   */
  static createDeck(name, description = '', initialWords = []) {
    const decks = this.getDecks();
    const newDeck = {
      id: 'deck_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: name.trim() || '새 단어장',
      description: description.trim() || '',
      createdAt: Date.now(),
      words: initialWords
    };
    decks.push(newDeck);
    this.saveDecks(decks);
    this.setActiveDeckId(newDeck.id);
    return newDeck;
  }

  /**
   * 단어장 이름 및 설명 수정
   */
  static updateDeck(deckId, { name, description }) {
    const decks = this.getDecks();
    const deck = decks.find(d => d.id === deckId);
    if (deck) {
      if (name !== undefined) deck.name = name.trim();
      if (description !== undefined) deck.description = description.trim();
      this.saveDecks(decks);
      return deck;
    }
    return null;
  }

  /**
   * 단어장 삭제
   */
  static deleteDeck(deckId) {
    let decks = this.getDecks();
    if (decks.length <= 1) {
      throw new Error('최소 한 개 이상의 단어장이 유지되어야 합니다.');
    }
    decks = decks.filter(d => d.id !== deckId);
    this.saveDecks(decks);

    if (this.getActiveDeckId() === deckId) {
      this.setActiveDeckId(decks[0].id);
    }
    return decks;
  }

  /**
   * 단어 추가 (deckId 생략 시 현재 활성 단어장에 추가)
   */
  static addWord(wordData, targetDeckId = null) {
    const decks = this.getDecks();
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
      audioUrl: wordData.audioUrl?.trim() || `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleanWord)}&type=2`,
      tags: wordData.tags || ['custom'],
      level: wordData.level || 'intermediate',
      memorized: false,
      wrongCount: 0,
      createdAt: Date.now()
    };

    deck.words.unshift(newWord);
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
      return {
        id: 'w_' + (w.number || (Date.now() + index)) + '_' + Math.random().toString(36).substr(2, 5),
        number: w.number ? parseInt(w.number, 10) : null,
        word: cleanWord,
        phonetic: w.phonetic?.trim() || '',
        partOfSpeech: w.partOfSpeech?.trim() || 'word',
        meaning: cleanMeaning,
        example: w.example?.trim() || '',
        exampleMeaning: w.exampleMeaning?.trim() || '',
        imageUrl: w.imageUrl?.trim() || '',
        audioUrl: w.audioUrl?.trim() || `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleanWord)}&type=2`,
        tags: w.tags || ['imported'],
        level: w.level || 'intermediate',
        memorized: false,
        wrongCount: 0,
        createdAt: Date.now()
      };
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
    const decks = this.getDecks();
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
    const decks = this.getDecks();
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
    const decks = this.getDecks();
    for (const deck of decks) {
      const w = deck.words.find(item => item.id === wordId);
      if (w) {
        w.memorized = memorized;
        if (memorized && w.wrongCount > 0) {
          w.wrongCount = Math.max(0, w.wrongCount - 1);
        }
        this.saveDecks(decks);
        return;
      }
    }
  }

  /**
   * 오답 기록
   */
  static recordMistake(wordId) {
    const decks = this.getDecks();
    for (const deck of decks) {
      const w = deck.words.find(item => item.id === wordId);
      if (w) {
        w.wrongCount = (w.wrongCount || 0) + 1;
        w.memorized = false;
        this.saveDecks(decks);
        return;
      }
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

  static importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          if (Array.isArray(parsed)) {
            // 단어 배열인 경우 새 단어장으로 임포트
            this.createDeck(file.name.replace('.json', ''), '가져온 단어장', parsed);
            resolve();
          } else if (parsed && Array.isArray(parsed.words)) {
            // 단어장 객체인 경우
            this.createDeck(parsed.name || file.name.replace('.json', ''), parsed.description || '', parsed.words);
            resolve();
          } else {
            reject(new Error('올바른 단어장 JSON 형식이 아닙니다.'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsText(file);
    });
  }
}
