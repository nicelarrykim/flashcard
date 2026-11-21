// js/storage.js
// LocalStorage 기반 단어 데이터 관리 및 영구 저장소 모듈

import { DEFAULT_WORDS } from './data/defaultWords.js';

const STORAGE_KEY = 'vocaquest_words_v1';
const SETTINGS_KEY = 'vocaquest_settings_v1';

export class StorageManager {
  static getWords() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        this.saveWords(DEFAULT_WORDS);
        return DEFAULT_WORDS;
      }
      const words = JSON.parse(data);
      return Array.isArray(words) && words.length > 0 ? words : DEFAULT_WORDS;
    } catch (e) {
      console.error('Failed to load words from localStorage:', e);
      return DEFAULT_WORDS;
    }
  }

  static saveWords(words) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
      // 저장 이벤트 디스패치
      window.dispatchEvent(new CustomEvent('vocaquest_words_updated', { detail: words }));
    } catch (e) {
      console.error('Failed to save words to localStorage:', e);
    }
  }

  static addWord(wordData) {
    const words = this.getWords();
    const newWord = {
      id: 'w_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      word: wordData.word.trim(),
      phonetic: wordData.phonetic?.trim() || '',
      partOfSpeech: wordData.partOfSpeech?.trim() || 'noun',
      meaning: wordData.meaning.trim(),
      example: wordData.example?.trim() || '',
      exampleMeaning: wordData.exampleMeaning?.trim() || '',
      imageUrl: wordData.imageUrl?.trim() || '',
      tags: wordData.tags || ['custom'],
      level: wordData.level || 'beginner',
      memorized: false,
      wrongCount: 0,
      createdAt: Date.now()
    };
    words.unshift(newWord);
    this.saveWords(words);
    return newWord;
  }

  static addWordsBatch(wordsArray) {
    const currentWords = this.getWords();
    const createdList = wordsArray.map((w, index) => ({
      id: 'w_' + (Date.now() + index) + '_' + Math.random().toString(36).substr(2, 5),
      word: w.word.trim(),
      phonetic: w.phonetic?.trim() || '',
      partOfSpeech: w.partOfSpeech?.trim() || 'noun',
      meaning: w.meaning.trim(),
      example: w.example?.trim() || '',
      exampleMeaning: w.exampleMeaning?.trim() || '',
      imageUrl: w.imageUrl?.trim() || '',
      tags: w.tags || ['imported'],
      level: w.level || 'intermediate',
      memorized: false,
      wrongCount: 0,
      createdAt: Date.now()
    }));
    const updated = [...createdList, ...currentWords];
    this.saveWords(updated);
    return createdList;
  }

  static updateWord(id, updatedFields) {
    const words = this.getWords();
    const index = words.findIndex(w => w.id === id);
    if (index !== -1) {
      words[index] = { ...words[index], ...updatedFields };
      this.saveWords(words);
      return words[index];
    }
    return null;
  }

  static deleteWord(id) {
    const words = this.getWords();
    const filtered = words.filter(w => w.id !== id);
    this.saveWords(filtered);
    return filtered;
  }

  static markMemorized(id, memorized = true) {
    const words = this.getWords();
    const word = words.find(w => w.id === id);
    if (word) {
      word.memorized = memorized;
      if (memorized && word.wrongCount > 0) {
        word.wrongCount = Math.max(0, word.wrongCount - 1);
      }
      this.saveWords(words);
    }
  }

  static recordMistake(id) {
    const words = this.getWords();
    const word = words.find(w => w.id === id);
    if (word) {
      word.wrongCount = (word.wrongCount || 0) + 1;
      word.memorized = false;
      this.saveWords(words);
    }
  }

  static getWrongWords() {
    return this.getWords().filter(w => (w.wrongCount || 0) > 0);
  }

  static resetToDefault() {
    this.saveWords(DEFAULT_WORDS);
    return DEFAULT_WORDS;
  }

  static clearAll() {
    this.saveWords([]);
  }

  static exportJSON() {
    const words = this.getWords();
    const jsonString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(words, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", `vocaquest_words_${new Date().toISOString().slice(0, 10)}.json`);
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
            this.saveWords(parsed);
            resolve(parsed);
          } else {
            reject(new Error('올바른 단어 배열(JSON) 형식이 아닙니다.'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsText(file);
    });
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
}
