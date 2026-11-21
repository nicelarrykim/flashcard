// js/tts.js
// 고품질 원어민 오디오 스트리밍 및 브라우저 Web Speech API 하이브리드 발음 모듈

export class SoundManager {
  static synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  static selectedVoice = null;
  static soundEnabled = true;
  static currentAudio = null;
  static audioCache = new Map();

  static init() {
    if (!this.synth) return;

    const loadVoices = () => {
      const voices = this.synth.getVoices();
      // 영어 네이티브 음성 우선 선택 (Google US English, Samantha, Microsoft Zira, en-US)
      this.selectedVoice = voices.find(v => (v.name.includes('Google') || v.name.includes('Natural')) && v.lang.startsWith('en'))
        || voices.find(v => v.lang.startsWith('en-US') && !v.localService)
        || voices.find(v => v.lang.startsWith('en-US'))
        || voices.find(v => v.lang.startsWith('en'))
        || null;
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  /**
   * 고품질 원어민 발음 재생
   * 1순위: Google 번역 고품질 신경망 원어민 오디오 (MP3 스트림)
   * 2순위: Free Dictionary 원어민 녹음 오디오
   * 3순위 (Fallback): 브라우저 Web Speech API
   */
  static async speak(text, rate = 0.9) {
    if (!this.soundEnabled || !text) return;
    const cleanText = text.trim();
    if (!cleanText) return;

    // 현재 재생 중인 오디오가 있다면 중지
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
    }
    if (this.synth) {
      this.synth.cancel();
    }

    // 1. 단어 단위인 경우 캐시된 원어민 오디오 URL 확인
    if (this.audioCache.has(cleanText.toLowerCase())) {
      const cachedUrl = this.audioCache.get(cleanText.toLowerCase());
      if (cachedUrl) {
        this.playAudioUrl(cachedUrl, () => this.speakWithGoogleTTS(cleanText));
        return;
      }
    }

    // 2. 단일 단어인 경우 Free Dictionary API 원어민 녹음 오디오 검색 시도
    if (!cleanText.includes(' ') && cleanText.length < 25) {
      try {
        const audioUrl = await this.fetchDictionaryAudio(cleanText.toLowerCase());
        if (audioUrl) {
          this.audioCache.set(cleanText.toLowerCase(), audioUrl);
          this.playAudioUrl(audioUrl, () => this.speakWithGoogleTTS(cleanText));
          return;
        }
      } catch (e) {
        // 계속 진행
      }
    }

    // 3. 구글 고품질 원어민 오디오 재생
    this.speakWithGoogleTTS(cleanText);
  }

  /**
   * Google 고품질 TTS 오디오 스트림 재생
   */
  static speakWithGoogleTTS(text) {
    try {
      const encoded = encodeURIComponent(text);
      const googleTTSUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encoded}`;
      this.playAudioUrl(googleTTSUrl, () => {
        // 구글 오디오 차단 또는 네트워크 실패 시 Web Speech API로 폴백
        this.speakWithWebSpeech(text);
      });
    } catch (err) {
      this.speakWithWebSpeech(text);
    }
  }

  /**
   * HTML5 Audio 재생
   */
  static playAudioUrl(url, onErrorFallback) {
    try {
      const audio = new Audio(url);
      this.currentAudio = audio;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Audio stream play failed, falling back:', err);
          if (onErrorFallback) onErrorFallback();
        });
      }
    } catch (err) {
      if (onErrorFallback) onErrorFallback();
    }
  }

  /**
   * Free Dictionary API에서 실제 사람이 녹음한 미국/영국식 원어민 오디오 URL 탐색
   */
  static async fetchDictionaryAudio(word) {
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.phonetics) {
        // 미국식(-us) 또는 유효한 mp3 오디오 찾기
        const usAudio = data[0].phonetics.find(p => p.audio && p.audio.includes('-us.mp3'));
        if (usAudio?.audio) return usAudio.audio;

        const anyAudio = data[0].phonetics.find(p => p.audio && p.audio.length > 5);
        if (anyAudio?.audio) return anyAudio.audio;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  /**
   * 브라우저 내장 Web Speech API (Fallback)
   */
  static speakWithWebSpeech(text, rate = 0.9) {
    if (!this.synth || !this.soundEnabled || !text) return;

    try {
      this.synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = rate;
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      this.synth.speak(utterance);
    } catch (e) {
      console.warn('Web Speech API failed:', e);
    }
  }

  // 간단한 효과음 (정답/오답/카드 뒤집기/팡파르) - AudioContext 활용
  static playTone(type = 'correct') {
    if (!this.soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(160, now + 0.1);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'flip') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'fanfare') {
        osc.type = 'sine';
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        });
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.start(now);
        osc.stop(now + 0.55);
      }
    } catch (e) {
      console.warn('Tone play error:', e);
    }
  }
}

SoundManager.init();
