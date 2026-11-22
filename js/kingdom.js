// js/kingdom.js
// 단어장별 왕국 발전도(Kingdom Evolution) 계산 및 성채 SVG 일러스트 모듈

import { RANK_TYPES } from './mastery.js?v=20261123_01';

export const KINGDOM_TIERS = {
  TIER_1: {
    level: 1,
    name: '개척 야영지',
    title: 'Frontier Camp',
    badge: 'Tier 1 야영지',
    badgeColor: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
    minProgress: 0,
    maxProgress: 19,
    description: '황무지에 세워진 기사단의 첫 주둔지입니다. 텐트와 모닥불 주위로 신병들이 모여들고 있습니다.',
    accentColor: '#78716c'
  },
  TIER_2: {
    level: 2,
    name: '목조 요새 마을',
    title: 'Wooden Fortress',
    badge: 'Tier 2 목조요새',
    badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
    minProgress: 20,
    maxProgress: 39,
    description: '통나무 망루와 목책 방벽을 갖춘 요새 마을입니다. 보병들이 방어선을 순찰하고 있습니다.',
    accentColor: '#d97706'
  },
  TIER_3: {
    level: 3,
    name: '석조 기사단 성채',
    title: 'Stone Citadel',
    badge: 'Tier 3 석조성채',
    badgeColor: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
    minProgress: 40,
    maxProgress: 59,
    description: '견고한 화강암 성벽과 감시탑이 솟아오른 기사단의 본부입니다. 정규 기사들이 훈련 중입니다.',
    accentColor: '#0284c7'
  },
  TIER_4: {
    level: 4,
    name: '왕립 대성채',
    title: 'Royal High Castle',
    badge: 'Tier 4 왕립대성채',
    badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300',
    minProgress: 60,
    maxProgress: 79,
    description: '웅장한 성탑과 붉은 삼각 지붕, 해자를 갖춘 왕국의 심장부입니다. 고급 기사와 근위대가 상주합니다.',
    accentColor: '#9333ea'
  },
  TIER_5: {
    level: 5,
    name: '찬란한 황금 제국',
    title: 'Imperial Golden Palace',
    badge: 'Tier 5 황금제국',
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    minProgress: 80,
    maxProgress: 100,
    description: '전설의 마스터 기사들이 수호하는 천공의 황금 제국입니다. 성스러운 빛이 영지를 가득 채웁니다.',
    accentColor: '#059669'
  }
};

export class KingdomManager {
  /**
   * 단어 목록의 기사 수와 숙련도에 비례하여 왕국의 발전도와 티어 계산
   * @param {Array} words 단어 객체 배열
   * @returns {Object} { totalPower, totalPoints, maxPower, progressPct, progressPercent, tier, nextTier, knightCounts, advancedKnightCount, royalGuardCount, masterCount }
   */
  static calculateKingdomPower(words) {
    const list = (words || []).filter(Boolean);
    const knightCounts = {
      [RANK_TYPES.RECRUIT]: 0,
      [RANK_TYPES.INFANTRY]: 0,
      [RANK_TYPES.JUNIOR_KNIGHT]: 0,
      [RANK_TYPES.SENIOR_KNIGHT]: 0,
      [RANK_TYPES.HIGH_KNIGHT]: 0,
      [RANK_TYPES.ROYAL_GUARD]: 0,
      [RANK_TYPES.MASTER]: 0
    };

    // 기사 등급별 영지 발전 기여 포인트
    const rankPoints = {
      [RANK_TYPES.RECRUIT]: 1,
      [RANK_TYPES.INFANTRY]: 2,
      [RANK_TYPES.JUNIOR_KNIGHT]: 4,
      [RANK_TYPES.SENIOR_KNIGHT]: 6,
      [RANK_TYPES.HIGH_KNIGHT]: 8,
      [RANK_TYPES.ROYAL_GUARD]: 11,
      [RANK_TYPES.MASTER]: 14
    };

    let totalPower = 0;

    list.forEach(w => {
      const rank = (w.mastery && w.mastery.status) || RANK_TYPES.RECRUIT;
      if (knightCounts[rank] !== undefined) {
        knightCounts[rank]++;
      }
      totalPower += (rankPoints[rank] || 1);
    });

    const totalWords = list.length;
    // 최대 도달 가능 포인트 (전체 단어가 마스터 등급일 때)
    const maxPower = Math.max(1, totalWords * rankPoints[RANK_TYPES.MASTER]);
    // 발전도 (0 ~ 100%)
    let progressPct = totalWords > 0 ? Math.round((totalPower / maxPower) * 100) : 0;
    progressPct = Math.min(100, Math.max(0, progressPct));

    // 발전도에 따른 티어 결정
    let tier = KINGDOM_TIERS.TIER_1;
    let nextTier = KINGDOM_TIERS.TIER_2;

    if (progressPct >= 80) {
      tier = KINGDOM_TIERS.TIER_5;
      nextTier = null;
    } else if (progressPct >= 60) {
      tier = KINGDOM_TIERS.TIER_4;
      nextTier = KINGDOM_TIERS.TIER_5;
    } else if (progressPct >= 40) {
      tier = KINGDOM_TIERS.TIER_3;
      nextTier = KINGDOM_TIERS.TIER_4;
    } else if (progressPct >= 20) {
      tier = KINGDOM_TIERS.TIER_2;
      nextTier = KINGDOM_TIERS.TIER_3;
    }

    const advancedKnightCount = (knightCounts[RANK_TYPES.SENIOR_KNIGHT] || 0) + 
                                (knightCounts[RANK_TYPES.HIGH_KNIGHT] || 0) + 
                                (knightCounts[RANK_TYPES.ROYAL_GUARD] || 0) + 
                                (knightCounts[RANK_TYPES.MASTER] || 0);
    const royalGuardCount = knightCounts[RANK_TYPES.ROYAL_GUARD] || 0;
    const masterCount = knightCounts[RANK_TYPES.MASTER] || 0;

    return {
      totalWords,
      totalPower,
      totalPoints: totalPower,
      maxPower,
      progressPct,
      progressPercent: progressPct,
      tier,
      nextTier,
      knightCounts,
      advancedKnightCount,
      royalGuardCount,
      masterCount
    };
  }

  /**
   * 왕국 발전 단계(Tier 1~5)별 세밀한 고품질 성/요새 벡터 SVG 일러스트 생성
   * @param {number} level 1 ~ 5
   * @param {number} width 픽셀 너비
   * @param {number} height 픽셀 높이
   */
  static getKingdomIllustrationSVG(level = 1, width = 240, height = 160) {
    switch (level) {
      case 1:
        // Tier 1: 개척 야영지 (Frontier Camp) - 삼각 텐트, 모닥불, 나무 울타리, 거친 언덕
        return `
          <svg width="${width}" height="${height}" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg" class="kingdom-svg drop-shadow-md">
            <!-- 하늘 배경 -->
            <rect width="240" height="160" rx="16" fill="url(#skyTier1)" />
            <!-- 먼 산 -->
            <path d="M0 120 L40 90 L85 125 L140 85 L200 128 L240 100 L240 160 L0 160 Z" fill="#78716c" opacity="0.4" />
            <!-- 푸른 흙 언덕 -->
            <path d="M0 128 Q120 115 240 128 L240 160 L0 160 Z" fill="#57534e" />
            <path d="M0 138 Q120 125 240 138 L240 160 L0 160 Z" fill="#44403c" />
            <!-- 나무 통나무 울타리 -->
            <g stroke="#78350f" stroke-width="3" stroke-linecap="round">
              <line x1="20" y1="124" x2="20" y2="140" />
              <line x1="30" y1="122" x2="30" y2="140" />
              <line x1="40" y1="125" x2="40" y2="140" />
              <line x1="200" y1="124" x2="200" y2="140" />
              <line x1="210" y1="122" x2="210" y2="140" />
              <line x1="220" y1="125" x2="220" y2="140" />
              <line x1="16" y1="130" x2="44" y2="130" stroke-width="2" />
              <line x1="196" y1="130" x2="224" y2="130" stroke-width="2" />
            </g>
            <!-- 주 텐트 (대형) -->
            <path d="M85 138 L125 78 L165 138 Z" fill="#d6d3d1" stroke="#a8a29e" stroke-width="2" />
            <path d="M125 78 L125 138" stroke="#78716c" stroke-width="2" />
            <!-- 텐트 입구 -->
            <path d="M115 138 L125 105 L135 138 Z" fill="#44403c" />
            <!-- 작은 보조 텐트 -->
            <path d="M50 140 L75 95 L100 140 Z" fill="#a8a29e" />
            <path d="M75 95 L75 140" stroke="#57534e" stroke-width="1.5" />
            <!-- 모닥불 -->
            <ellipse cx="185" cy="138" rx="8" ry="3" fill="#292524" />
            <path d="M182 136 L185 122 L188 136 Z" fill="#f97316" />
            <path d="M184 136 L185 126 L187 136 Z" fill="#fde047" />
            <line x1="178" y1="139" x2="192" y2="135" stroke="#78350f" stroke-width="2" stroke-linecap="round" />
            <!-- 깃발 막대와 신병 삼각 깃발 -->
            <line x1="165" y1="78" x2="165" y2="52" stroke="#78350f" stroke-width="2" />
            <path d="M165 54 L185 62 L165 70 Z" fill="#94a3b8" />
            <defs>
              <linearGradient id="skyTier1" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#fdba74" stop-opacity="0.7"/>
                <stop offset="100%" stop-color="#fed7aa" stop-opacity="0.3"/>
              </linearGradient>
            </defs>
          </svg>
        `;

      case 2:
        // Tier 2: 목조 요새 마을 (Wooden Fortress) - 망루, 목책 성벽, 대장간, 주황 깃발
        return `
          <svg width="${width}" height="${height}" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg" class="kingdom-svg drop-shadow-md">
            <!-- 하늘 -->
            <rect width="240" height="160" rx="16" fill="url(#skyTier2)" />
            <!-- 산과 구릉 -->
            <path d="M0 115 Q60 85 120 115 Q180 85 240 115 L240 160 L0 160 Z" fill="#b45309" opacity="0.3" />
            <path d="M0 130 Q120 120 240 130 L240 160 L0 160 Z" fill="#78350f" />
            <!-- 목책 성벽 -->
            <rect x="35" y="112" width="170" height="30" fill="#92400e" stroke="#451a03" stroke-width="2" />
            <path d="M35 112 L45 102 L55 112 L65 102 L75 112 L85 102 L95 112 L105 102 L115 112 L125 102 L135 112 L145 102 L155 112 L165 102 L175 112 L185 102 L195 112 L205 102" stroke="#451a03" stroke-width="2" fill="none" />
            <!-- 중앙 목조 정문 타워 -->
            <rect x="100" y="80" width="40" height="62" fill="#78350f" stroke="#451a03" stroke-width="2" />
            <!-- 지붕 -->
            <path d="M95 80 L120 54 L145 80 Z" fill="#b45309" stroke="#451a03" stroke-width="2" />
            <!-- 성문 아치 -->
            <path d="M110 142 L110 118 Q120 110 130 118 L130 142 Z" fill="#292524" />
            <!-- 좌우 목조 망루 타워 -->
            <rect x="25" y="70" width="25" height="72" fill="#78350f" stroke="#451a03" stroke-width="2" />
            <path d="M20 70 L37.5 48 L55 70 Z" fill="#b45309" stroke="#451a03" stroke-width="1.5" />
            <rect x="190" y="70" width="25" height="72" fill="#78350f" stroke="#451a03" stroke-width="2" />
            <path d="M185 70 L202.5 48 L220 70 Z" fill="#b45309" stroke="#451a03" stroke-width="1.5" />
            <!-- 펄럭이는 호박색 깃발 -->
            <line x1="120" y1="54" x2="120" y2="34" stroke="#451a03" stroke-width="2" />
            <path d="M120 36 Q135 42 148 36 L120 48 Z" fill="#f59e0b" />
            <defs>
              <linearGradient id="skyTier2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#bae6fd" stop-opacity="0.8"/>
                <stop offset="100%" stop-color="#e0f2fe" stop-opacity="0.3"/>
              </linearGradient>
            </defs>
          </svg>
        `;

      case 3:
        // Tier 3: 석조 기사단 성채 (Stone Citadel) - 화강암 성벽, 2개 감시탑, 푸른 깃발, 철창문
        return `
          <svg width="${width}" height="${height}" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg" class="kingdom-svg drop-shadow-lg">
            <!-- 하늘 -->
            <rect width="240" height="160" rx="16" fill="url(#skyTier3)" />
            <!-- 배경 구름 및 언덕 -->
            <path d="M0 120 Q120 100 240 120 L240 160 L0 160 Z" fill="#334155" />
            <!-- 석조 주성벽 (크레넬레이션) -->
            <rect x="45" y="85" width="150" height="55" fill="#64748b" stroke="#334155" stroke-width="2" />
            <!-- 성벽 총안(Crenels) -->
            <path d="M45 85 L45 78 L55 78 L55 85 L65 85 L65 78 L75 78 L75 85 L165 85 L165 78 L175 78 L175 85 L185 85 L185 78 L195 78 L195 85" stroke="#334155" stroke-width="2" fill="#64748b" />
            <!-- 중앙 석조 주탑(Keep) -->
            <rect x="95" y="58" width="50" height="82" fill="#475569" stroke="#1e293b" stroke-width="2" />
            <path d="M92 58 L120 32 L148 58 Z" fill="#0284c7" stroke="#0369a1" stroke-width="2" />
            <!-- 아치형 성문과 쇠창살 -->
            <path d="M105 140 L105 110 Q120 98 135 110 L135 140 Z" fill="#0f172a" />
            <line x1="112" y1="104" x2="112" y2="140" stroke="#94a3b8" stroke-width="1.5" />
            <line x1="120" y1="100" x2="120" y2="140" stroke="#94a3b8" stroke-width="1.5" />
            <line x1="128" y1="104" x2="128" y2="140" stroke="#94a3b8" stroke-width="1.5" />
            <!-- 좌측 원형 석탑 -->
            <rect x="25" y="52" width="30" height="90" fill="#64748b" stroke="#334155" stroke-width="2" />
            <path d="M22 52 L40 28 L58 52 Z" fill="#0284c7" stroke="#0369a1" stroke-width="2" />
            <!-- 우측 원형 석탑 -->
            <rect x="185" y="52" width="30" height="90" fill="#64748b" stroke="#334155" stroke-width="2" />
            <path d="M182 52 L200 28 L218 52 Z" fill="#0284c7" stroke="#0369a1" stroke-width="2" />
            <!-- 푸른 기사단 깃발 (나부낌) -->
            <line x1="120" y1="32" x2="120" y2="12" stroke="#e2e8f0" stroke-width="2" />
            <path d="M120 14 Q142 20 156 12 L120 28 Z" fill="#0284c7" stroke="#38bdf8" stroke-width="1" />
            <circle cx="132" cy="20" r="2.5" fill="#ffffff" />
            <defs>
              <linearGradient id="skyTier3" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#7dd3fc"/>
                <stop offset="100%" stop-color="#e0f2fe"/>
              </linearGradient>
            </defs>
          </svg>
        `;

      case 4:
        // Tier 4: 왕립 대성채 (Royal High Castle) - 웅장한 주탑, 붉은 삼각 지붕, 해자, 황금 사자 문장
        return `
          <svg width="${width}" height="${height}" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg" class="kingdom-svg drop-shadow-xl">
            <!-- 하늘 (석양 골드 & 인디고) -->
            <rect width="240" height="160" rx="16" fill="url(#skyTier4)" />
            <!-- 해자 수면 -->
            <rect x="0" y="142" width="240" height="18" fill="#0369a1" opacity="0.8" />
            <!-- 석조 기단 및 해자 다리 -->
            <path d="M100 142 L100 132 L140 132 L140 142 Z" fill="#78350f" stroke="#451a03" stroke-width="1.5" />
            <!-- 외성벽 -->
            <rect x="35" y="80" width="170" height="58" fill="#94a3b8" stroke="#475569" stroke-width="2" />
            <!-- 성탑 4개 (원근감) -->
            <rect x="18" y="44" width="32" height="96" fill="#cbd5e1" stroke="#475569" stroke-width="2" />
            <path d="M14 44 L34 16 L54 44 Z" fill="#e11d48" stroke="#be123c" stroke-width="2" />
            <rect x="190" y="44" width="32" height="96" fill="#cbd5e1" stroke="#475569" stroke-width="2" />
            <path d="M186 44 L206 16 L226 44 Z" fill="#e11d48" stroke="#be123c" stroke-width="2" />
            <!-- 중앙 그랜드 팰리스 주탑 -->
            <rect x="85" y="40" width="70" height="98" fill="#e2e8f0" stroke="#334155" stroke-width="2.5" />
            <path d="M80 40 L120 8 L160 40 Z" fill="#e11d48" stroke="#be123c" stroke-width="2.5" />
            <!-- 황금 장식 아치 창문들 -->
            <path d="M100 60 Q105 52 110 60 L110 75 L100 75 Z" fill="#fbbf24" stroke="#d97706" stroke-width="1" />
            <path d="M130 60 Q135 52 140 60 L140 75 L130 75 Z" fill="#fbbf24" stroke="#d97706" stroke-width="1" />
            <!-- 성문 및 황금 사자 문장 -->
            <path d="M106 132 L106 102 Q120 92 134 102 L134 132 Z" fill="#1e1b4b" />
            <circle cx="120" cy="74" r="7" fill="#fbbf24" stroke="#b45309" stroke-width="1.5" />
            <!-- 황실 붉은 깃발 -->
            <line x1="120" y1="8" x2="120" y2="-6" stroke="#fbbf24" stroke-width="2" />
            <path d="M120 -4 Q146 2 160 -8 L120 12 Z" fill="#be123c" stroke="#fbbf24" stroke-width="1.5" />
            <defs>
              <linearGradient id="skyTier4" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#c084fc"/>
                <stop offset="60%" stop-color="#fed7aa"/>
                <stop offset="100%" stop-color="#e0e7ff"/>
              </linearGradient>
            </defs>
          </svg>
        `;

      case 5:
        // Tier 5: 찬란한 황금 제국 (Imperial Golden Palace) - 황금 돔, 첨탑, 성스러운 빛, 천사 날개 오라
        return `
          <svg width="${width}" height="${height}" viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg" class="kingdom-svg drop-shadow-2xl rank-master">
            <!-- 천공의 오로라 배경 -->
            <rect width="240" height="160" rx="16" fill="url(#skyTier5)" />
            <!-- 신성한 빛의 오라 (방사형 광채) -->
            <circle cx="120" cy="50" r="95" fill="url(#holyGlow)" opacity="0.65" />
            <!-- 천상의 구름 대지 -->
            <path d="M0 135 C30 120 60 145 90 130 C120 115 150 145 180 125 C210 110 240 135 240 160 L0 160 Z" fill="#f8fafc" opacity="0.9" />
            <!-- 황금 제국 외성채 -->
            <rect x="30" y="75" width="180" height="65" fill="#fef08a" stroke="#ca8a04" stroke-width="2" />
            <!-- 좌측 황금 첨탑 타워 -->
            <rect x="18" y="38" width="28" height="102" fill="#fef9c3" stroke="#ca8a04" stroke-width="2" />
            <path d="M14 38 L32 4 L50 38 Z" fill="#f59e0b" stroke="#b45309" stroke-width="2" />
            <circle cx="32" cy="4" r="3" fill="#38bdf8" />
            <!-- 우측 황금 첨탑 타워 -->
            <rect x="194" y="38" width="28" height="102" fill="#fef9c3" stroke="#ca8a04" stroke-width="2" />
            <path d="M190 38 L208 4 L226 38 Z" fill="#f59e0b" stroke="#b45309" stroke-width="2" />
            <circle cx="208" cy="4" r="3" fill="#38bdf8" />
            <!-- 중앙 그랜드 황금 돔 & 대성전 -->
            <rect x="75" y="48" width="90" height="92" fill="#ffffff" stroke="#ca8a04" stroke-width="2.5" />
            <!-- 찬란한 황금 돔 (Dome) -->
            <path d="M70 48 Q120 -15 170 48 Z" fill="url(#goldDome)" stroke="#ca8a04" stroke-width="2.5" />
            <!-- 돔 꼭대기 신성한 십자/왕관 스파이어 -->
            <line x1="120" y1="2" x2="120" y2="-12" stroke="#ca8a04" stroke-width="3" />
            <circle cx="120" cy="-12" r="4.5" fill="#06b6d4" stroke="#ffffff" stroke-width="1.5" />
            <!-- 신비로운 에메랄드 보석 아치 문 -->
            <path d="M104 140 L104 98 Q120 84 136 98 L136 140 Z" fill="#065f46" stroke="#fbbf24" stroke-width="2" />
            <circle cx="120" cy="74" r="6" fill="#06b6d4" stroke="#ffffff" stroke-width="2" />
            <!-- 제국의 황금 날개 문양 (상단) -->
            <path d="M96 28 Q75 14 62 26 Q80 34 94 32 Z" fill="#38bdf8" opacity="0.8" />
            <path d="M144 28 Q165 14 178 26 Q160 34 146 32 Z" fill="#38bdf8" opacity="0.8" />
            <defs>
              <linearGradient id="skyTier5" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#0284c7"/>
                <stop offset="50%" stop-color="#6366f1"/>
                <stop offset="100%" stop-color="#059669"/>
              </linearGradient>
              <radialGradient id="holyGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#fef08a" stop-opacity="0.9"/>
                <stop offset="60%" stop-color="#38bdf8" stop-opacity="0.4"/>
                <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
              </radialGradient>
              <linearGradient id="goldDome" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#fde047"/>
                <stop offset="50%" stop-color="#f59e0b"/>
                <stop offset="100%" stop-color="#d97706"/>
              </linearGradient>
            </defs>
          </svg>
        `;

      default:
        return '';
    }
  }

  /**
   * 티어 뱃지 HTML 생성
   */
  static getTierBadgeHTML(tier, progressPct) {
    const t = tier || KINGDOM_TIERS.TIER_1;
    let badgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300';
    if (t.level === 5) badgeClass = 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-400 animate-pulse';
    else if (t.level === 4) badgeClass = 'bg-gradient-to-r from-rose-500 to-amber-500 text-white border-rose-400';
    else if (t.level === 3) badgeClass = 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border-sky-300';
    else if (t.level === 2) badgeClass = 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300';

    return `
      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border shadow-sm ${badgeClass}">
        <span>🏰 Tier ${t.level}</span>
        <span>${t.name}</span>
        <span class="font-mono text-[11px] opacity-90">(${progressPct}%)</span>
      </span>
    `;
  }
}
