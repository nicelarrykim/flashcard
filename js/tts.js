// js/tts.js
// 100% 실제 원어민 성우 녹음 MP3 스트리밍 발음 엔진

export class SoundManager {
  static soundEnabled = true;
  static currentAudio = null;

  /**
   * 실제 미국식 원어민 음성 재생
   * @param {string} text 단어 또는 문장
   * @param {string} [directAudioUrl] 미리 검증된 오디오 URL (있을 경우 최우선)
   */
  static speak(text, directAudioUrl = '') {
    if (!this.soundEnabled || !text) return;
    const cleanWord = text.trim().toLowerCase().replace(/[^a-z\-]/g, '');
    if (!cleanWord) return;

    // 현재 재생 중인 오디오 정지
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
    }

    // 후보 음원 URL 목록 (모두 실제 사람/원어민 성우 녹음 MP3)
    const audioCandidates = [];

    // 1. 단어 객체에 직접 지정된 URL (가장 확실함)
    if (directAudioUrl) {
      audioCandidates.push(directAudioUrl);
    }

    // 2. Google 공식 사전 미국식 원어민 녹음 MP3 (Google Dictionary US)
    audioCandidates.push(`https://ssl.gstatic.com/dictionary/static/sounds/20200429/${cleanWord}--_us_1.mp3`);
    audioCandidates.push(`https://ssl.gstatic.com/dictionary/static/sounds/20200429/${cleanWord}--_us_2.mp3`);

    // 3. 글로벌 사전 표준 미국식 원어민 음성 스트림 (Youdao US Pronunciation)
    audioCandidates.push(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleanWord)}&type=2`);

    // 4. Free Dictionary API US 녹음
    audioCandidates.push(`https://api.dictionaryapi.dev/media/pronunciations/en/${cleanWord}-us.mp3`);

    // 순차 재생 시도 (첫 번째로 성공하는 고음질 원어민 음원 재생)
    this.playCandidatesSequentially(audioCandidates, 0);
  }

  static playCandidatesSequentially(candidates, index) {
    if (index >= candidates.length) {
      console.warn('모든 원어민 오디오 소스 재생 실패');
      return;
    }

    const url = candidates[index];
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;
    this.currentAudio = audio;

    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        // 현재 음원이 로드 실패하면 즉시 다음 후보 음원 시도
        this.playCandidatesSequentially(candidates, index + 1);
      });
    }

    audio.onerror = () => {
      this.playCandidatesSequentially(candidates, index + 1);
    };
  }

  // 간단한 효과음 (정답/오답/카드 뒤집기/팡파르) - Web Audio API
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
