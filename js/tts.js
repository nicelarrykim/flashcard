// js/tts.js
// 브라우저 Web Speech API를 활용한 원어민 발음 재생 모듈

export class SoundManager {
  static synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  static selectedVoice = null;
  static soundEnabled = true;

  static init() {
    if (!this.synth) return;

    const loadVoices = () => {
      const voices = this.synth.getVoices();
      // 영어 목소리 우선 선택 (Google US English, Samantha, 또는 en-US)
      this.selectedVoice = voices.find(v => v.lang.startsWith('en-US') && !v.localService) 
        || voices.find(v => v.lang.startsWith('en-US'))
        || voices.find(v => v.lang.startsWith('en'))
        || null;
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  static speak(text, rate = 0.9) {
    if (!this.synth || !this.soundEnabled || !text) return;

    try {
      this.synth.cancel(); // 이전 발음 즉시 중지
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = rate; // 0.8 ~ 1.0 (적절한 학습용 속도)
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      this.synth.speak(utterance);
    } catch (e) {
      console.warn('TTS Speech failed:', e);
    }
  }

  // 간단한 효과음 (정답/오답/카드 뒤집기) - AudioContext 활용
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
        // 도-미-솔 기분 좋은 상승 코드
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'wrong') {
        // 삐- 하강 불협화음
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(160, now + 0.1);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'flip') {
        // 부드러운 카드 찰칵음
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'fanfare') {
        // 게임 완료 축하 팡파르
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
