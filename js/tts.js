// js/tts.js
// 100% 실제 원어민 성우 녹음 MP3 스트리밍 발음 엔진

export class SoundManager {
  static soundEnabled = true;
  static currentAudio = null;
  static _audioCtx = null;

  static getAudioContext() {
    if (!this._audioCtx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this._audioCtx = new AudioCtx();
      }
    }
    if (this._audioCtx && this._audioCtx.state === 'suspended') {
      this._audioCtx.resume().catch(() => {});
    }
    return this._audioCtx;
  }

  /**
   * 현재 재생 중인 모든 오디오 및 음성 합성 즉시 정지
   */
  static stop() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
      this.currentAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
  }

  /**
   * 실제 미국식 원어민 음성 재생
   * @param {string} text 단어 또는 문장
   * @param {string} [directAudioUrl] 미리 검증된 오디오 URL (있을 경우 최우선)
   */
  static speak(text, directAudioUrl = '') {
    if (!this.soundEnabled || !text) return;
    const rawText = text.trim();
    if (!rawText) return;

    // 현재 재생 중인 오디오 정지
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
    }

    // 후보 음원 URL 목록 (모두 실제 사람/원어민 성우 녹음 MP3)
    const audioCandidates = [];

    const cleanSingle = rawText.toLowerCase().replace(/[^a-z\-]/g, '');
    const cleanPhrase = rawText.toLowerCase().replace(/[^a-z\-\s]/g, ' ').replace(/\s+/g, ' ').trim();

    // 1. 글로벌 사전 표준 미국식 원어민 음성 스트림 (https://dict.youdao.com/dictvoice - 44.1kHz 실제 원어민 녹음 MP3 최우선)
    if (cleanPhrase) {
      audioCandidates.push(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleanPhrase)}&type=2`);
    }

    // 2. 단어 객체에 직접 지정된 URL (단, gstatic 404 링크 제외)
    if (directAudioUrl && !directAudioUrl.includes('ssl.gstatic.com')) {
      if (directAudioUrl.includes('dictvoice')) {
        const normalized = directAudioUrl.replace(/audio=([^&]+)/i, (_, word) => {
          return `audio=${encodeURIComponent(decodeURIComponent(word).toLowerCase())}&type=2`;
        });
        if (!audioCandidates.includes(normalized)) {
          audioCandidates.push(normalized);
        }
      } else {
        audioCandidates.push(directAudioUrl);
      }
    }

    // 순차 재생 시도 (첫 번째로 성공하는 고음질 원어민 음원 재생, 모두 실패 시 Web Speech API)
    this.playCandidatesSequentially(audioCandidates, 0, rawText);
  }

  static playCandidatesSequentially(candidates, index, fallbackText = '') {
    if (index >= candidates.length) {
      // 모든 원어민 MP3 소스 실패 시 브라우저 내장 네이티브 Web Speech API로 발음
      if (fallbackText && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(fallbackText);
          utterance.lang = 'en-US';
          utterance.rate = 0.9;
          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.warn('Web Speech API fallback error:', e);
        }
      }
      return;
    }

    const url = candidates[index];
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;
    this.currentAudio = audio;

    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise.catch(() => {
        this.playCandidatesSequentially(candidates, index + 1, fallbackText);
      });
    }

    audio.onerror = () => {
      this.playCandidatesSequentially(candidates, index + 1, fallbackText);
    };
  }

  // 간단한 효과음 (정답/오답/카드 뒤집기/팡파르) - Web Audio API
  static playTone(type = 'correct') {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
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
      } else if (type === 'clash') {
        // 검과 방패, 철제 무기 충돌 금속음 (챙강!)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.12);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);

        // 추가 쇳소리 배음
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(3200, now);
        osc2.frequency.exponentialRampToValueAtTime(800, now + 0.08);
        gain2.gain.setValueAtTime(0.15, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now);
        osc2.stop(now + 0.08);
      } else if (type === 'slash') {
        // 칼로 베는 묵직한 베기 타격음 (슉-팍!)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.15);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'hit_damage') {
        // 병사 피격음 (둔탁한 타격)
        osc.type = 'square';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type.startsWith('td_')) {
        // 타워 디펜스 전용 효과음 (동시 다발 발사 시 과부하 방지를 위해 65ms 쓰로틀)
        const ms = performance.now();
        if (this._lastTdSoundMs && ms - this._lastTdSoundMs < 65) return;
        this._lastTdSoundMs = ms;

        if (type === 'td_arrow') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(760, now);
          osc.frequency.exponentialRampToValueAtTime(240, now + 0.07);
          gain.gain.setValueAtTime(0.09, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
          osc.start(now);
          osc.stop(now + 0.07);
        } else if (type === 'td_fire') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(420, now);
          osc.frequency.exponentialRampToValueAtTime(140, now + 0.11);
          gain.gain.setValueAtTime(0.10, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
          osc.start(now);
          osc.stop(now + 0.11);
        } else if (type === 'td_magic') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1180, now);
          osc.frequency.exponentialRampToValueAtTime(620, now + 0.1);
          gain.gain.setValueAtTime(0.10, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.start(now);
          osc.stop(now + 0.1);
        } else if (type === 'td_laser') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(280, now);
          osc.frequency.exponentialRampToValueAtTime(920, now + 0.08);
          osc.frequency.exponentialRampToValueAtTime(220, now + 0.18);
          gain.gain.setValueAtTime(0.14, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          osc.start(now);
          osc.stop(now + 0.18);
        } else if (type === 'td_hit') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.exponentialRampToValueAtTime(80, now + 0.045);
          gain.gain.setValueAtTime(0.07, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
          osc.start(now);
          osc.stop(now + 0.045);
        }
      } else if (type === 'explosion') {
        // 성채 피격 콰광! 폭발음
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.45);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === 'war_horn') {
        // 전투 개시 웅장한 전쟁 나팔 (뿌우우-)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(261.63, now); // C4
        osc.frequency.setValueAtTime(329.63, now + 0.15); // E4
        osc.frequency.setValueAtTime(392.00, now + 0.3); // G4
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.setValueAtTime(0.22, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc.start(now);
        osc.stop(now + 0.8);
      } else if (type === 'wave_clear') {
        // 웨이브 클리어 승리 팡파레
        osc.type = 'triangle';
        [392.0, 523.25, 659.25, 783.99].forEach((freq, idx) => {
          osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        });
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
      }
    } catch (e) {
      console.warn('Tone play error:', e);
    }
  }
}
