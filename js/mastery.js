// js/mastery.js
// 단어 숙련도(0~100점) 계산, 기사 7단계 등급 시스템 및 걷는 기사 캐릭터 SVG 아이콘 모듈

export const RANK_TYPES = {
  RECRUIT: 'recruit',             // 1단계: 훈련병 (0~19점)
  INFANTRY: 'infantry',           // 2단계: 보병 (20~39점)
  JUNIOR_KNIGHT: 'junior_knight', // 3단계: 초급기사 (40~59점)
  SENIOR_KNIGHT: 'senior_knight', // 4단계: 중급기사 (60~79점)
  HIGH_KNIGHT: 'high_knight',     // 5단계: 고급기사 (80~100점)
  ROYAL_GUARD: 'royal_guard',     // 특수 6단계: 왕실근위대 (고급기사에서 퀴즈 2연속 정답 시)
  MASTER: 'master'                // 최종 7단계: 마스터 (왕실근위대 3회 승급 시)
};

export const RANK_CONFIG = {
  [RANK_TYPES.RECRUIT]: {
    name: '훈련병',
    title: 'Recruit',
    scoreRange: '0~19점',
    color: 'slate',
    badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    accentColor: '#64748b',
    description: '기초 훈련 중인 신병. 나무 막대기를 쥐고 기본을 배우고 있습니다.'
  },
  [RANK_TYPES.INFANTRY]: {
    name: '보병',
    title: 'Infantry',
    scoreRange: '20~39점',
    color: 'amber',
    badgeBg: 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    accentColor: '#d97706',
    description: '가죽 갑옷과 짧은 철검을 갖춘 든든한 일선 보병입니다.'
  },
  [RANK_TYPES.JUNIOR_KNIGHT]: {
    name: '초급기사',
    title: 'Junior Knight',
    scoreRange: '40~59점',
    color: 'sky',
    badgeBg: 'bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800',
    accentColor: '#0284c7',
    description: '사슬 갑옷과 롱소드를 장비하고 정식 기사의 길에 들어섰습니다.'
  },
  [RANK_TYPES.SENIOR_KNIGHT]: {
    name: '중급기사',
    title: 'Senior Knight',
    scoreRange: '60~79점',
    color: 'indigo',
    badgeBg: 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
    accentColor: '#6366f1',
    description: '강철 판금 갑옷과 푸른 망토를 두르고 전장을 지휘하는 베테랑 기사입니다.'
  },
  [RANK_TYPES.HIGH_KNIGHT]: {
    name: '고급기사',
    title: 'High Knight',
    scoreRange: '80~100점',
    color: 'purple',
    badgeBg: 'bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800',
    accentColor: '#9333ea',
    description: '황금빛 문양의 갑옷과 대검을 갖춘 최고 기사입니다. 퀴즈 2회 연속 정답 시 왕실근위대로 승급합니다.'
  },
  [RANK_TYPES.ROYAL_GUARD]: {
    name: '왕실근위대',
    title: 'Royal Guard',
    scoreRange: '100점 (수호)',
    color: 'rose',
    badgeBg: 'bg-gradient-to-r from-rose-500 to-amber-500 text-white border-rose-400 shadow-sm',
    accentColor: '#e11d48',
    description: '국왕을 호위하는 최정예 근위대! 2일간 퀴즈/플래시카드에서 제외되며, 3번 승급하면 전설의 마스터가 됩니다.'
  },
  [RANK_TYPES.MASTER]: {
    name: '마스터',
    title: 'Grand Master',
    scoreRange: '영구 마스터',
    color: 'emerald',
    badgeBg: 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white border-emerald-400 shadow-md animate-pulse',
    accentColor: '#059669',
    description: '완전 정복 달성! 성스러운 빛의 날개와 성검을 부여받아 영구 마스터로 등극했습니다.'
  }
};

export class MasteryManager {
  // 왕실근위대 유지 기간: 2일 (48시간)
  static ROYAL_GUARD_DURATION_MS = 2 * 24 * 60 * 60 * 1000;

  /**
   * 단어 객체에 mastery 필드가 온전한지 검증 및 보정
   */
  static ensureMastery(word) {
    if (!word) return word;
    if (!word.mastery || typeof word.mastery !== 'object') {
      word.mastery = {
        score: 0,
        firstSeen: false,
        streak: 0,
        consecutiveQuizCorrectInKnight: 0,
        promotionsToRoyalGuard: 0,
        royalGuardDate: null,
        status: RANK_TYPES.RECRUIT,
        updatedAt: Date.now()
      };
    } else {
      // 누락된 속성 보정
      if (typeof word.mastery.score !== 'number') word.mastery.score = 0;
      if (typeof word.mastery.firstSeen !== 'boolean') word.mastery.firstSeen = false;
      if (typeof word.mastery.streak !== 'number') word.mastery.streak = 0;
      if (typeof word.mastery.consecutiveQuizCorrectInKnight !== 'number') word.mastery.consecutiveQuizCorrectInKnight = 0;
      if (typeof word.mastery.promotionsToRoyalGuard !== 'number') word.mastery.promotionsToRoyalGuard = 0;
      if (word.mastery.royalGuardDate === undefined) word.mastery.royalGuardDate = null;
      if (!word.mastery.status) word.mastery.status = this.calculateRankFromScore(word.mastery.score);
    }
    return word;
  }

  /**
   * 점수(0~100)로부터 기본 5단계 등급 계산
   */
  static calculateRankFromScore(score) {
    if (score >= 80) return RANK_TYPES.HIGH_KNIGHT;
    if (score >= 60) return RANK_TYPES.SENIOR_KNIGHT;
    if (score >= 40) return RANK_TYPES.JUNIOR_KNIGHT;
    if (score >= 20) return RANK_TYPES.INFANTRY;
    return RANK_TYPES.RECRUIT;
  }

  /**
   * 현재 단어의 실제 등급 반환 (특수 등급 왕실근위대, 마스터 포함)
   */
  static getWordRank(word) {
    this.ensureMastery(word);
    const m = word.mastery;

    if (m.promotionsToRoyalGuard >= 3 || m.status === RANK_TYPES.MASTER) {
      return RANK_TYPES.MASTER;
    }

    if (m.status === RANK_TYPES.ROYAL_GUARD) {
      // 2일 경과 확인
      if (m.royalGuardDate && (Date.now() - m.royalGuardDate >= this.ROYAL_GUARD_DURATION_MS)) {
        // 강등 대상
        return RANK_TYPES.HIGH_KNIGHT;
      }
      return RANK_TYPES.ROYAL_GUARD;
    }

    return this.calculateRankFromScore(m.score);
  }

  /**
   * 왕실근위대 남은 시간(ms) 계산 (만료되었거나 아니면 0)
   */
  static getRoyalGuardRemainingTime(word) {
    this.ensureMastery(word);
    const m = word.mastery;
    if (m.status !== RANK_TYPES.ROYAL_GUARD || !m.royalGuardDate) return 0;
    const elapsed = Date.now() - m.royalGuardDate;
    const remain = this.ROYAL_GUARD_DURATION_MS - elapsed;
    return Math.max(0, remain);
  }

  /**
   * 남은 시간을 포맷팅된 문자열로 반환 (예: "1일 14시간", "8시간 25분", "만료됨")
   */
  static formatRemainingTime(ms) {
    if (ms <= 0) return '기한 만료';
    const hoursTotal = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(hoursTotal / 24);
    const hours = hoursTotal % 24;
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}일 ${hours}시간`;
    }
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분 남음`;
  }

  /**
   * 왕실근위대 2일 초과 시 고급기사로 자동 강등 검사
   * @param {Array} decks 
   * @returns {number} 강등된 단어 수
   */
  static checkAndApplyDemotions(decks) {
    let demotedCount = 0;
    const now = Date.now();

    decks.forEach(deck => {
      if (!deck || !Array.isArray(deck.words)) return;
      deck.words.forEach(word => {
        if (!word) return;
        this.ensureMastery(word);
        const m = word.mastery;
        if (m.status === RANK_TYPES.ROYAL_GUARD && m.royalGuardDate) {
          if (now - m.royalGuardDate >= this.ROYAL_GUARD_DURATION_MS) {
            // 강등 처리: 점수는 100점 고급기사로 복귀, 승급 카운트는 유지
            m.status = RANK_TYPES.HIGH_KNIGHT;
            m.score = 100;
            m.royalGuardDate = null;
            m.consecutiveQuizCorrectInKnight = 0;
            m.updatedAt = now;
            demotedCount++;
          }
        }
      });
    });

    return demotedCount;
  }

  /**
   * 플래시카드 & 게임 등에서 제외할 단어인지 판별
   * (유효한 왕실근위대이거나 영구 마스터인 경우 true)
   */
  static isExcludedFromStudy(word) {
    if (!word) return false;
    this.ensureMastery(word);
    const rank = this.getWordRank(word);
    return rank === RANK_TYPES.ROYAL_GUARD || rank === RANK_TYPES.MASTER;
  }

  /**
   * 단어 상태 초기화
   */
  static resetMastery(word) {
    if (!word) return;
    word.mastery = {
      score: 0,
      firstSeen: false,
      streak: 0,
      consecutiveQuizCorrectInKnight: 0,
      promotionsToRoyalGuard: 0,
      royalGuardDate: null,
      status: RANK_TYPES.RECRUIT,
      updatedAt: Date.now()
    };
  }

  /**
   * 다양한 활동에 따른 숙련도 점수 및 등급 업데이트
   * @param {Object} word 단어 객체
   * @param {string} action 'fc_seen' | 'fc_know' | 'fc_confused' | 'fc_unknown' | 'quiz_correct' | 'quiz_wrong' | 'game_correct' | 'game_wrong'
   * @param {Object} meta { isQuick: boolean, combo: number }
   * @returns {Object} { oldScore, newScore, oldRank, newRank, promotedToRoyalGuard, promotedToMaster }
   */
  static applyAction(word, action, meta = {}) {
    this.ensureMastery(word);
    const m = word.mastery;
    const oldScore = m.score;
    const oldRank = this.getWordRank(word);

    let promotedToRoyalGuard = false;
    let promotedToMaster = false;

    // 이미 마스터인 경우 변화 없음 (단 초기화 액션 제외)
    if (oldRank === RANK_TYPES.MASTER && action !== 'reset') {
      return { oldScore, newScore: oldScore, oldRank, newRank: oldRank, promotedToRoyalGuard, promotedToMaster };
    }

    switch (action) {
      case 'fc_seen':
        // 처음 본 단어: 기본 20점 시작 (노출만 됨)
        if (!m.firstSeen) {
          m.firstSeen = true;
          if (m.score < 20) {
            m.score = 20;
          }
        }
        break;

      case 'fc_know': // 플래시카드에서 "잘 알아요" (+15점, 단 최대 70점까지만)
        m.firstSeen = true;
        if (m.score < 70) {
          m.score = Math.min(70, m.score + 15);
        }
        break;

      case 'fc_confused': // 플래시카드에서 "헷갈려요" (점수 유지)
        m.firstSeen = true;
        break;

      case 'fc_unknown': // 플래시카드에서 "모르겠어요" (-5점, 최소 0점 유지)
        m.firstSeen = true;
        m.score = Math.max(0, m.score - 5);
        break;

      case 'quiz_correct': // 퀴즈에서 정답 (+10점, 빠른 정답/연속 보너스 +5점)
        m.firstSeen = true;
        m.streak = (m.streak || 0) + 1;
        {
          let bonus = 0;
          if (meta.isQuick || (meta.combo && meta.combo >= 2) || m.streak >= 2) {
            bonus = 5;
          }
          m.score = Math.min(100, m.score + 10 + bonus);
        }

        // 고급기사 상태에서 퀴즈 문제를 2번 연속 맞추면 왕실근위대 표시
        if (m.score >= 80 && m.status !== RANK_TYPES.ROYAL_GUARD && m.status !== RANK_TYPES.MASTER) {
          m.consecutiveQuizCorrectInKnight = (m.consecutiveQuizCorrectInKnight || 0) + 1;
          if (m.consecutiveQuizCorrectInKnight >= 2) {
            // 왕실근위대 승급!
            m.promotionsToRoyalGuard = (m.promotionsToRoyalGuard || 0) + 1;
            m.consecutiveQuizCorrectInKnight = 0;
            m.score = 100;

            if (m.promotionsToRoyalGuard >= 3) {
              // 왕실근위대로 3번 승급 시 -> 마스터 등급!
              m.status = RANK_TYPES.MASTER;
              m.royalGuardDate = null;
              promotedToMaster = true;
            } else {
              m.status = RANK_TYPES.ROYAL_GUARD;
              m.royalGuardDate = Date.now();
              promotedToRoyalGuard = true;
            }
          }
        }
        break;

      case 'quiz_wrong': // 퀴즈에서 오답 (-10점, 최소 0점)
        m.firstSeen = true;
        m.streak = 0;
        m.consecutiveQuizCorrectInKnight = 0;
        m.score = Math.max(0, m.score - 10);
        break;

      case 'game_correct': // 타 게임 정답 (+10점, 보너스 가능)
        m.firstSeen = true;
        m.streak = (m.streak || 0) + 1;
        {
          let bonus = 0;
          if (meta.isQuick || (meta.combo && meta.combo >= 2) || m.streak >= 2) {
            bonus = 5;
          }
          m.score = Math.min(100, m.score + 10 + bonus);
        }
        break;

      case 'game_wrong': // 타 게임 오답 (-10점, 최소 0점)
        m.firstSeen = true;
        m.streak = 0;
        m.score = Math.max(0, m.score - 10);
        break;

      case 'reset':
        this.resetMastery(word);
        break;
    }

    // 기본 등급 상태 업데이트 (왕실근위대나 마스터가 아닌 경우)
    if (m.status !== RANK_TYPES.ROYAL_GUARD && m.status !== RANK_TYPES.MASTER) {
      m.status = this.calculateRankFromScore(m.score);
    }

    m.updatedAt = Date.now();
    const newRank = this.getWordRank(word);

    return {
      oldScore,
      newScore: m.score,
      oldRank,
      newRank,
      promotedToRoyalGuard,
      promotedToMaster
    };
  }

  /**
   * 각 등급별 '사람이 걷는 모습' & '무장 상태 차이'를 정밀하게 표현한 SVG 생성
   * @param {string} rank 등급명 (recruit, infantry, junior_knight, senior_knight, high_knight, royal_guard, master)
   * @param {number} size 픽셀 크기 (기본값 64)
   * @returns {string} SVG HTML 문자열
   */
  static getWalkingKnightIcon(rank, size = 64) {
    const r = rank || RANK_TYPES.RECRUIT;

    switch (r) {
      case RANK_TYPES.RECRUIT:
        // 1. 훈련병: 소박한 천 튜닉, 맨머리, 투박한 신발, 나무 목봉/목검을 쥐고 씩씩하게 걸어가는 모습
        return `
          <svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="walking-hero rank-recruit drop-shadow-sm">
            <!-- 그림자 -->
            <ellipse cx="50" cy="94" rx="22" ry="5" fill="#000" fill-opacity="0.15" />
            <!-- 뒷다리 (뒤로 뻗음) -->
            <path d="M46 62 L40 78 L33 90" stroke="#78716c" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M33 90 L26 92" stroke="#57534e" stroke-width="6" stroke-linecap="round"/>
            <!-- 앞다리 (앞으로 전진) -->
            <path d="M54 62 L60 76 L66 89" stroke="#78716c" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M66 89 L74 91" stroke="#57534e" stroke-width="6" stroke-linecap="round"/>
            <!-- 몸통 (소박한 면 튜닉) -->
            <path d="M43 36 C43 36 39 52 41 64 C41 64 59 64 59 64 C61 52 57 36 57 36 Z" fill="#a8a29e" />
            <rect x="42" y="52" width="16" height="4" rx="1" fill="#78350f" />
            <!-- 뒷팔 & 훈련용 목검 -->
            <path d="M44 40 L34 50 L28 44" stroke="#a8a29e" stroke-width="5" stroke-linecap="round"/>
            <!-- 나무 몽둥이/목검 -->
            <path d="M24 38 L14 26" stroke="#b45309" stroke-width="5" stroke-linecap="round"/>
            <circle cx="25" cy="40" r="3" fill="#d97706" />
            <!-- 머리 & 맨머리 갈색 헤어 -->
            <circle cx="50" cy="24" r="11" fill="#fed7aa" />
            <path d="M40 22 C40 14 60 14 60 22 C60 19 56 16 50 16 C44 16 40 19 40 22 Z" fill="#78350f" />
            <!-- 눈과 입 -->
            <circle cx="54" cy="23" r="1.5" fill="#451a03" />
            <path d="M52 28 Q55 30 57 28" stroke="#451a03" stroke-width="1.2" stroke-linecap="round" fill="none" />
            <!-- 앞팔 (앞으로 흔들며 걸음) -->
            <path d="M55 40 L64 50 L60 58" stroke="#a8a29e" stroke-width="5" stroke-linecap="round"/>
            <circle cx="60" cy="58" r="3.5" fill="#fed7aa" />
          </svg>
        `;

      case RANK_TYPES.INFANTRY:
        // 2. 보병: 놋쇠 투구, 가죽 흉갑, 둥근 나무/구리 방패, 짧은 철검을 들고 진군하는 병사
        return `
          <svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="walking-hero rank-infantry drop-shadow-md">
            <!-- 그림자 -->
            <ellipse cx="50" cy="94" rx="24" ry="5" fill="#000" fill-opacity="0.2" />
            <!-- 뒷다리 (가죽 경갑) -->
            <path d="M46 62 L39 77 L31 90" stroke="#92400e" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M31 90 L24 92" stroke="#451a03" stroke-width="7" stroke-linecap="round"/>
            <!-- 앞다리 -->
            <path d="M54 62 L62 76 L69 89" stroke="#92400e" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M69 89 L77 91" stroke="#451a03" stroke-width="7" stroke-linecap="round"/>
            <!-- 가죽 흉갑 및 징 벨트 -->
            <path d="M42 36 L39 64 L61 64 L58 36 Z" fill="#b45309" stroke="#78350f" stroke-width="1.5" />
            <rect x="40" y="52" width="20" height="5" rx="1" fill="#451a03" />
            <circle cx="50" cy="54.5" r="2" fill="#fbbf24" />
            <!-- 뒷팔 & 둥근 보병 방패 -->
            <path d="M43 40 L32 48" stroke="#b45309" stroke-width="6" stroke-linecap="round"/>
            <circle cx="28" cy="48" r="14" fill="#78350f" stroke="#d97706" stroke-width="3" />
            <circle cx="28" cy="48" r="4" fill="#fbbf24" />
            <!-- 머리 & 놋쇠 투구 -->
            <circle cx="50" cy="24" r="10" fill="#fed7aa" />
            <!-- 놋쇠 투구 덮개 -->
            <path d="M38 23 C38 12 62 12 62 23 C62 25 38 25 38 23 Z" fill="#d97706" stroke="#b45309" stroke-width="1.5" />
            <path d="M48 11 L52 11 L50 7 Z" fill="#dc2626" />
            <circle cx="53" cy="23" r="1.5" fill="#1e293b" />
            <!-- 앞팔 & 짧은 철검(글라디우스) -->
            <path d="M56 40 L68 50" stroke="#b45309" stroke-width="6" stroke-linecap="round"/>
            <!-- 검 -->
            <path d="M68 50 L84 42" stroke="#94a3b8" stroke-width="4.5" stroke-linecap="round" />
            <path d="M66 52 L70 48" stroke="#d97706" stroke-width="4" stroke-linecap="round" />
          </svg>
        `;

      case RANK_TYPES.JUNIOR_KNIGHT:
        // 3. 초급기사: 은빛 사슬갑옷(체인메일), 날렵한 은빛 롱소드, 푸른 카이트 실드, 오픈 바이저 강철 투구
        return `
          <svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="walking-hero rank-junior drop-shadow-md">
            <!-- 그림자 -->
            <ellipse cx="50" cy="94" rx="25" ry="5.5" fill="#000" fill-opacity="0.22" />
            <!-- 뒷다리 (강철 무릎받이 & 정강이받이) -->
            <path d="M46 62 L38 77 L30 90" stroke="#64748b" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="38" cy="77" r="3.5" fill="#94a3b8" />
            <path d="M30 90 L22 92" stroke="#334155" stroke-width="7" stroke-linecap="round"/>
            <!-- 앞다리 -->
            <path d="M54 62 L63 76 L70 89" stroke="#64748b" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="63" cy="76" r="3.5" fill="#94a3b8" />
            <path d="M70 89 L79 91" stroke="#334155" stroke-width="7" stroke-linecap="round"/>
            <!-- 사슬갑옷 & 푸른 서코트 튜닉 -->
            <path d="M41 35 L38 65 L62 65 L59 35 Z" fill="#0284c7" stroke="#0369a1" stroke-width="1.5" />
            <!-- 가슴 십자 기사 문양 -->
            <path d="M50 40 L50 56 M44 46 L56 46" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
            <rect x="39" y="56" width="22" height="4" fill="#334155" />
            <!-- 뒷팔 & 푸른 카이트 실드 -->
            <path d="M42 38 L30 46" stroke="#64748b" stroke-width="6" stroke-linecap="round"/>
            <!-- 카이트 실드 (눈물방울 형태) -->
            <path d="M14 36 Q32 36 32 36 L30 58 Q23 68 14 74 Q5 68 8 58 Z" fill="#0284c7" stroke="#e2e8f0" stroke-width="2" />
            <path d="M19 42 L19 62 M11 50 L27 50" stroke="#f8fafc" stroke-width="2" stroke-linecap="round"/>
            <!-- 머리 & 강철 투구 -->
            <circle cx="50" cy="23" r="10.5" fill="#94a3b8" stroke="#475569" stroke-width="2" />
            <!-- 투구 안면 슬릿(T자형 바이저) -->
            <path d="M46 22 L56 22 M52 22 L52 27" stroke="#0f172a" stroke-width="2" stroke-linecap="round" />
            <path d="M48 11 Q50 6 54 11" stroke="#0284c7" stroke-width="3" stroke-linecap="round" fill="none" />
            <!-- 앞팔 & 은빛 롱소드 -->
            <path d="M57 38 L68 47" stroke="#64748b" stroke-width="6" stroke-linecap="round"/>
            <path d="M68 47 L87 36" stroke="#f1f5f9" stroke-width="4.5" stroke-linecap="round" />
            <path d="M65 49 L70 43" stroke="#e2e8f0" stroke-width="4" stroke-linecap="round" />
          </svg>
        `;

      case RANK_TYPES.SENIOR_KNIGHT:
        // 4. 중급기사: 풀 플레이트 아머, 펄럭이는 푸른/보라 망토, 대검, 화려한 사자 문장 방패와 깃털 투구
        return `
          <svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="walking-hero rank-senior drop-shadow-lg">
            <!-- 그림자 -->
            <ellipse cx="50" cy="94" rx="27" ry="6" fill="#000" fill-opacity="0.25" />
            <!-- 휘날리는 망토 (뒤쪽) -->
            <path d="M42 34 Q20 50 18 78 Q30 76 40 68 Z" fill="#4338ca" opacity="0.9" />
            <!-- 뒷다리 (풀 플레이트 강철 각갑) -->
            <path d="M46 62 L37 77 L28 90" stroke="#475569" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="37" cy="77" r="4" fill="#94a3b8" />
            <path d="M28 90 L19 92" stroke="#1e293b" stroke-width="8" stroke-linecap="round"/>
            <!-- 앞다리 -->
            <path d="M54 62 L64 76 L72 89" stroke="#475569" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="64" cy="76" r="4" fill="#94a3b8" />
            <path d="M72 89 L82 91" stroke="#1e293b" stroke-width="8" stroke-linecap="round"/>
            <!-- 강철 흉갑 & 어깨 견갑(스폴더) -->
            <path d="M40 34 L37 64 L63 64 L60 34 Z" fill="#64748b" stroke="#334155" stroke-width="2" />
            <path d="M44 38 L50 56 L56 38 Z" fill="#94a3b8" opacity="0.6" />
            <!-- 어깨 견갑 -->
            <circle cx="39" cy="36" r="5.5" fill="#94a3b8" stroke="#334155" stroke-width="1.5" />
            <circle cx="61" cy="36" r="5.5" fill="#94a3b8" stroke="#334155" stroke-width="1.5" />
            <!-- 금빛 벨트 -->
            <rect x="38" y="55" width="24" height="4.5" fill="#f59e0b" rx="1" />
            <!-- 머리 & 화려한 투구 (깃털 플룸) -->
            <circle cx="50" cy="22" r="11" fill="#94a3b8" stroke="#334155" stroke-width="2" />
            <path d="M45 22 L57 22" stroke="#090d16" stroke-width="2.5" stroke-linecap="round" />
            <!-- 붉은 깃털 장식 -->
            <path d="M49 11 Q42 2 46 0 Q54 2 51 11" fill="#ef4444" stroke="#b91c1c" stroke-width="1" />
            <!-- 뒷팔 & 사자 문장 대형 방패 -->
            <path d="M38 38 L26 48" stroke="#475569" stroke-width="7" stroke-linecap="round"/>
            <!-- 방패 -->
            <path d="M12 36 L34 36 L32 64 Q23 76 12 64 Z" fill="#312e81" stroke="#fbbf24" stroke-width="2" />
            <circle cx="23" cy="50" r="4.5" fill="#fbbf24" />
            <!-- 앞팔 & 빛나는 강철 대검 -->
            <path d="M60 38 L72 48" stroke="#475569" stroke-width="7" stroke-linecap="round"/>
            <path d="M72 48 L93 32" stroke="#f8fafc" stroke-width="5.5" stroke-linecap="round" />
            <path d="M68 51 L75 44" stroke="#fbbf24" stroke-width="4.5" stroke-linecap="round" />
          </svg>
        `;

      case RANK_TYPES.HIGH_KNIGHT:
        // 5. 고급기사: 황금 테두리의 은백색 풀플레이트 갑옷, 진홍빛 벨벳 망토, 양손 성검(그레이트소드), 성스러운 아우라
        return `
          <svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="walking-hero rank-high drop-shadow-xl">
            <!-- 성스러운 오라 -->
            <circle cx="50" cy="48" r="42" fill="url(#holyAura)" opacity="0.3" />
            <!-- 그림자 -->
            <ellipse cx="50" cy="94" rx="28" ry="6" fill="#000" fill-opacity="0.3" />
            <!-- 휘날리는 진홍빛 망토 -->
            <path d="M41 33 Q16 48 12 79 Q28 78 39 67 Z" fill="#be123c" />
            <path d="M41 33 Q20 54 18 78" stroke="#f43f5e" stroke-width="2" fill="none" />
            <!-- 뒷다리 (황금 장식 판금 갑옷) -->
            <path d="M46 62 L36 77 L27 90" stroke="#cbd5e1" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="36" cy="77" r="4.5" fill="#fbbf24" stroke="#d97706" stroke-width="1" />
            <path d="M27 90 L17 92" stroke="#475569" stroke-width="8.5" stroke-linecap="round"/>
            <!-- 앞다리 -->
            <path d="M54 62 L65 76 L73 89" stroke="#cbd5e1" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="65" cy="76" r="4.5" fill="#fbbf24" stroke="#d97706" stroke-width="1" />
            <path d="M73 89 L84 91" stroke="#475569" stroke-width="8.5" stroke-linecap="round"/>
            <!-- 은백색 흉갑 & 황금 날개 문양 -->
            <path d="M40 33 L36 64 L64 64 L60 33 Z" fill="#f8fafc" stroke="#d97706" stroke-width="2.5" />
            <path d="M44 42 Q50 36 56 42 Q50 54 44 42 Z" fill="#fbbf24" stroke="#b45309" stroke-width="1" />
            <!-- 황금 어깨 견갑 -->
            <path d="M33 34 Q39 28 44 35 Z" fill="#fbbf24" stroke="#d97706" stroke-width="1.5" />
            <path d="M56 35 Q61 28 67 34 Z" fill="#fbbf24" stroke="#d97706" stroke-width="1.5" />
            <!-- 황금 허리띠 -->
            <rect x="37" y="55" width="26" height="5" fill="#f59e0b" rx="1.5" />
            <!-- 머리 & 팔라딘 황금 투구 -->
            <circle cx="50" cy="21" r="11.5" fill="#f1f5f9" stroke="#d97706" stroke-width="2.5" />
            <path d="M43 21 L57 21" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round" />
            <!-- 황금 왕관형 투구 뿔 & 붉은 깃털 -->
            <path d="M43 12 L50 7 L57 12 Z" fill="#fbbf24" stroke="#b45309" stroke-width="1" />
            <path d="M50 7 Q45 -1 48 -3 Q55 -1 52 7" fill="#e11d48" />
            <!-- 앞팔 & 성스러운 대검 -->
            <path d="M59 36 L72 47" stroke="#cbd5e1" stroke-width="7.5" stroke-linecap="round"/>
            <!-- 빛나는 대검 -->
            <path d="M72 47 L95 27" stroke="#38bdf8" stroke-width="6" stroke-linecap="round" />
            <path d="M74 45 L94 28" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
            <path d="M68 50 L76 43" stroke="#fbbf24" stroke-width="5" stroke-linecap="round" />
            <!-- 정의 그라디언트 정의 -->
            <defs>
              <radialGradient id="holyAura" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#fde047" stop-opacity="0.8"/>
                <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
              </radialGradient>
            </defs>
          </svg>
        `;

      case RANK_TYPES.ROYAL_GUARD:
        // 6. 왕실근위대: 황실 흑금 예복 갑옷, 풍성한 깃털 장식 황금 투구, 황금 장창(할버드) & 타워 실드, 호위 행진
        return `
          <svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="walking-hero rank-royal drop-shadow-2xl">
            <!-- 반짝이는 황실 별빛 이펙트 -->
            <path d="M82 14 L84 19 L89 21 L84 23 L82 28 L80 23 L75 21 L80 19 Z" fill="#fbbf24" opacity="0.9" />
            <path d="M16 26 L17.5 30 L21.5 31.5 L17.5 33 L16 37 L14.5 33 L10.5 31.5 L14.5 30 Z" fill="#fbbf24" opacity="0.8" />
            <!-- 그림자 -->
            <ellipse cx="50" cy="94" rx="30" ry="6.5" fill="#000" fill-opacity="0.35" />
            <!-- 황실 비단 망토 (보라&골드) -->
            <path d="M42 32 Q14 46 8 80 Q26 79 38 66 Z" fill="#581c87" stroke="#fbbf24" stroke-width="1.5" />
            <!-- 뒷다리 (흑금 풀 아머) -->
            <path d="M46 62 L35 77 L26 90" stroke="#1e1b4b" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="35" cy="77" r="5" fill="#f59e0b" stroke="#78350f" stroke-width="1" />
            <path d="M26 90 L15 92" stroke="#09090b" stroke-width="9" stroke-linecap="round"/>
            <!-- 앞다리 -->
            <path d="M54 62 L66 76 L75 89" stroke="#1e1b4b" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="66" cy="76" r="5" fill="#f59e0b" stroke="#78350f" stroke-width="1" />
            <path d="M75 89 L86 91" stroke="#09090b" stroke-width="9" stroke-linecap="round"/>
            <!-- 흑금 흉갑 & 황실 문장 -->
            <path d="M39 32 L35 64 L65 64 L61 32 Z" fill="#18181b" stroke="#fbbf24" stroke-width="2.5" />
            <path d="M50 36 L55 46 L45 46 Z" fill="#fbbf24" />
            <path d="M50 48 L46 58 L54 58 Z" fill="#f59e0b" />
            <!-- 황금 어깨 갑옷 -->
            <path d="M31 33 Q38 25 45 34 Z" fill="#f59e0b" stroke="#78350f" stroke-width="1.5" />
            <path d="M55 34 Q62 25 69 33 Z" fill="#f59e0b" stroke="#78350f" stroke-width="1.5" />
            <!-- 머리 & 화려한 황금 근위대 투구 -->
            <circle cx="50" cy="20" r="11.5" fill="#f59e0b" stroke="#78350f" stroke-width="2" />
            <path d="M43 20 L57 20" stroke="#09090b" stroke-width="3" stroke-linecap="round" />
            <!-- 투구 위 거대한 황실 깃털 장식 -->
            <path d="M50 8 Q40 -6 48 -8 Q58 -6 53 8" fill="#e11d48" stroke="#be123c" stroke-width="1.5" />
            <path d="M52 8 Q60 -4 68 -2 Q65 6 54 8" fill="#a855f7" />
            <!-- 뒷팔 & 황실 타워 실드 -->
            <path d="M36 36 L24 46" stroke="#1e1b4b" stroke-width="7" stroke-linecap="round"/>
            <path d="M8 32 L30 32 L28 72 Q19 82 8 72 Z" fill="#701a75" stroke="#fbbf24" stroke-width="2.5" />
            <!-- 방패 문양 황금 독수리/사자 -->
            <path d="M19 44 L15 54 L23 54 Z" fill="#fbbf24" />
            <circle cx="19" cy="42" r="3" fill="#fbbf24" />
            <!-- 앞팔 & 황금 장창(할버드) -->
            <path d="M60 36 L72 46" stroke="#1e1b4b" stroke-width="7" stroke-linecap="round"/>
            <!-- 장창 자루 (수직으로 위엄있게 세움) -->
            <path d="M72 92 L72 8" stroke="#78350f" stroke-width="3.5" stroke-linecap="round" />
            <!-- 할버드 날 (황금 도끼날 & 창끝) -->
            <path d="M72 8 L72 2 L75 5 Z" fill="#f8fafc" stroke="#38bdf8" stroke-width="1.5" />
            <path d="M72 10 Q84 12 80 20 Q72 18 72 14 Z" fill="#fbbf24" stroke="#d97706" stroke-width="1.5" />
          </svg>
        `;

      case RANK_TYPES.MASTER:
        // 7. 마스터: 전설의 그랜드마스터! 찬란한 빛의 날개, 후광 왕관, 전설의 엑스칼리버, 신화적 위용
        return `
          <svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="walking-hero rank-master drop-shadow-2xl">
            <!-- 신화의 찬란한 빛의 날개 (좌/우) -->
            <path d="M38 36 Q10 16 2 34 Q16 48 36 46 Z" fill="url(#wingGradLeft)" opacity="0.85" />
            <path d="M62 36 Q90 16 98 34 Q84 48 64 46 Z" fill="url(#wingGradRight)" opacity="0.85" />
            <!-- 신의 후광 (Halo) -->
            <circle cx="50" cy="18" r="17" stroke="url(#haloGrad)" stroke-width="2.5" stroke-dasharray="4 2" fill="none" opacity="0.9" />
            <!-- 그림자 -->
            <ellipse cx="50" cy="94" rx="32" ry="7" fill="#000" fill-opacity="0.4" />
            <!-- 영웅의 무지개빛 망토 -->
            <path d="M42 32 Q10 46 4 82 Q25 80 37 66 Z" fill="url(#capeGrad)" />
            <!-- 뒷다리 (신화의 에메랄드/플래티넘 아머) -->
            <path d="M46 62 L34 77 L24 90" stroke="#0f766e" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="34" cy="77" r="5.5" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5" />
            <path d="M24 90 L12 92" stroke="#042f2e" stroke-width="9.5" stroke-linecap="round"/>
            <!-- 앞다리 -->
            <path d="M54 62 L67 76 L77 89" stroke="#0f766e" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="67" cy="76" r="5.5" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5" />
            <path d="M77 89 L89 91" stroke="#042f2e" stroke-width="9.5" stroke-linecap="round"/>
            <!-- 플래티넘 흉갑 & 신의 보석 코어 -->
            <path d="M38 31 L34 64 L66 64 L62 31 Z" fill="#f8fafc" stroke="#0284c7" stroke-width="3" />
            <!-- 가슴 중앙 발광 젬(룬 스톤) -->
            <circle cx="50" cy="46" r="6" fill="#06b6d4" stroke="#ffffff" stroke-width="1.5" />
            <circle cx="50" cy="46" r="2.5" fill="#ffffff" />
            <!-- 찬란한 견갑 -->
            <path d="M29 32 Q37 22 45 33 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="2" />
            <path d="M55 33 Q63 22 71 32 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="2" />
            <!-- 머리 & 그랜드마스터 관형 투구 -->
            <circle cx="50" cy="19" r="12" fill="#f1f5f9" stroke="#0284c7" stroke-width="2.5" />
            <!-- 빛나는 푸른 안광 -->
            <path d="M43 19 L57 19" stroke="#06b6d4" stroke-width="3" stroke-linecap="round" />
            <!-- 신의 왕관 뿔 -->
            <path d="M40 10 L50 2 L60 10 L55 12 L50 7 L45 12 Z" fill="#fbbf24" stroke="#d97706" stroke-width="1.5" />
            <!-- 앞팔 & 전설의 성검(엑스칼리버) -->
            <path d="M60 34 L74 45" stroke="#0f766e" stroke-width="8" stroke-linecap="round"/>
            <!-- 엑스칼리버 (찬란한 빛 발산) -->
            <path d="M74 45 L98 22" stroke="#38bdf8" stroke-width="7" stroke-linecap="round" />
            <path d="M76 43 L97 23" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" />
            <path d="M70 48 L78 40" stroke="#fbbf24" stroke-width="6" stroke-linecap="round" />
            <circle cx="74" cy="44" r="3.5" fill="#06b6d4" />

            <defs>
              <linearGradient id="wingGradLeft" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#38bdf8"/>
                <stop offset="100%" stop-color="#10b981"/>
              </linearGradient>
              <linearGradient id="wingGradRight" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#38bdf8"/>
                <stop offset="100%" stop-color="#10b981"/>
              </linearGradient>
              <linearGradient id="haloGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#fbbf24"/>
                <stop offset="50%" stop-color="#38bdf8"/>
                <stop offset="100%" stop-color="#34d399"/>
              </linearGradient>
              <linearGradient id="capeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#0284c7"/>
                <stop offset="100%" stop-color="#059669"/>
              </linearGradient>
            </defs>
          </svg>
        `;

      default:
        return '';
    }
  }

  /**
   * 등급 뱃지 HTML 생성
   */
  static getRankBadgeHTML(rank) {
    const config = RANK_CONFIG[rank] || RANK_CONFIG[RANK_TYPES.RECRUIT];
    return `
      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black border ${config.badgeBg}">
        <span>${config.name}</span>
      </span>
    `;
  }
}
