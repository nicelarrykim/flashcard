// js/performance.js
// 단어별 학습 성과 대시보드 및 나의 왕국(영지 발전 & 기사단 승급) 모듈

import { StorageManager } from './storage.js?v=20261122_12';
import { SoundManager } from './tts.js?v=20261122_12';
import { MasteryManager, RANK_TYPES, RANK_CONFIG } from './mastery.js?v=20261122_12';
import { KingdomManager, KINGDOM_TIERS } from './kingdom.js?v=20261122_12';

export class PerformanceView {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.selectedDeckId = 'all'; // 'all' 또는 특정 단어장 ID
    this.selectedRankFilter = 'all'; // 'all' 또는 RANK_TYPES 값
    this.sortBy = 'rank_desc'; // 'rank_desc', 'rank_asc', 'score_desc', 'score_asc', 'number_asc', 'alphabet_asc'
    this.searchQuery = '';
  }

  init() {
    this.container = this.container || document.getElementById(this.containerId);
    if (!this.container) return;

    // 만료된 왕실근위대 자동 강등 검사
    StorageManager.checkRoyalGuardDemotions();

    // 전역 단어장 선택 동기화
    const globalDeckId = StorageManager.getActiveDeckId();
    if (globalDeckId && this.selectedDeckId === 'all') {
      this.selectedDeckId = globalDeckId;
    }

    this.render();
    this.bindEvents();
  }

  render() {
    if (!this.container) return;

    const decks = StorageManager.getDecks();
    const allWords = decks.flatMap(d => (d && Array.isArray(d.words)) ? d.words : []).filter(Boolean);
    allWords.forEach(w => MasteryManager.ensureMastery(w));

    // 선택된 단어장에 해당하는 단어 목록
    let currentDeckWords = [];
    let currentDeckName = '전체 단어장 (통합)';
    if (this.selectedDeckId === 'all') {
      currentDeckWords = allWords;
    } else {
      const targetDeck = decks.find(d => d.id === this.selectedDeckId) || decks[0];
      if (targetDeck) {
        currentDeckWords = (targetDeck.words || []).filter(Boolean);
        currentDeckWords.forEach(w => MasteryManager.ensureMastery(w));
        currentDeckName = targetDeck.name || '단어장';
      }
    }

    // 통계 계산: 전체 기준 vs 현재 단어장 기준
    const overallStats = this.calculateStats(allWords);
    const deckStats = this.calculateStats(currentDeckWords);

    // 왕국 발전도 계산 (선택 단어장 기준)
    const kingdomPower = KingdomManager.calculateKingdomPower(currentDeckWords);

    // 필터링 및 정렬된 단어 목록
    const filteredWords = this.getFilteredAndSortedWords(currentDeckWords);

    this.container.innerHTML = `
      <div class="max-w-5xl mx-auto space-y-6 pb-12">
        
        <!-- 페이지 헤더: 나의 왕국 대시보드 -->
        <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-indigo-900/50">
          <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-400/30 mb-3">
                <span>🏰</span> <span>나의 왕국 & 기사단 영지 발전 시스템</span>
              </div>
              <h2 class="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                <span>🏰 나의 왕국 대시보드</span>
              </h2>
              <p class="text-slate-300 text-xs sm:text-sm mt-1.5 max-w-xl leading-relaxed">
                단어 숙련도를 높여 기사들을 육성하고, 기사들의 수와 충성도에 비례해 <strong>왕국의 성채를 업그레이드</strong>하세요!<br class="hidden sm:inline">
                훈련병부터 전설의 마스터까지, 획득한 기사단이 영지를 위대한 제국으로 발전시킵니다.
              </p>
            </div>

            <!-- 전투력 & 마스터 달성 요약 배지 -->
            <div class="grid grid-cols-2 gap-3 shrink-0">
              <div class="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center">
                <div class="text-[11px] text-slate-300 font-semibold mb-0.5">평균 숙련도</div>
                <div class="text-2xl font-black text-amber-300 font-mono">${deckStats.avgScore} <span class="text-xs text-slate-300">점</span></div>
                <div class="text-[10px] text-slate-400 mt-0.5">총 ${currentDeckWords.length}단어</div>
              </div>
              <div class="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center">
                <div class="text-[11px] text-slate-300 font-semibold mb-0.5">수호 & 마스터</div>
                <div class="text-2xl font-black text-emerald-300 font-mono">${deckStats.counts[RANK_TYPES.ROYAL_GUARD] + deckStats.counts[RANK_TYPES.MASTER]} <span class="text-xs text-slate-300">개</span></div>
                <div class="text-[10px] text-emerald-200/80 mt-0.5">근위대 ${deckStats.counts[RANK_TYPES.ROYAL_GUARD]} / 마스터 ${deckStats.counts[RANK_TYPES.MASTER]}</div>
              </div>
            </div>
          </div>

          <!-- 배경 장식용 은은한 오라 -->
          <div class="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        </div>

        <!-- 🏰 현재 영지 발전도 카드 (성채 일러스트 & 발전 게이지) -->
        <div class="bg-gradient-to-br from-white via-indigo-50/30 to-purple-50/20 dark:from-slate-800 dark:via-slate-800/80 dark:to-indigo-950/30 rounded-3xl p-6 sm:p-7 shadow-lg border-2 border-indigo-200/60 dark:border-indigo-800/60">
          <div class="flex flex-col md:flex-row items-center gap-6">
            
            <!-- 좌측: 왕국 성채 SVG 일러스트 -->
            <div class="w-full md:w-64 shrink-0 flex flex-col items-center">
              <div class="w-48 h-36 rounded-2xl overflow-hidden shadow-md border border-indigo-100 dark:border-indigo-900 bg-slate-900/10 dark:bg-slate-900/60 flex items-center justify-center p-1">
                ${KingdomManager.getKingdomIllustrationSVG(kingdomPower.tier.level)}
              </div>
              <div class="mt-2 text-center">
                <span class="inline-block px-3 py-1 rounded-full text-xs font-black ${kingdomPower.tier.badgeColor}">
                  ${kingdomPower.tier.badge}
                </span>
              </div>
            </div>

            <!-- 우측: 왕국 상태 설명 및 발전도 진행률 -->
            <div class="flex-1 w-full space-y-3.5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div class="text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">
                    영지: ${currentDeckName}
                  </div>
                  <h3 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>${kingdomPower.tier.name}</span>
                    <span class="text-sm font-semibold text-slate-500 dark:text-slate-400">(Tier ${kingdomPower.tier.level})</span>
                  </h3>
                </div>
                <div class="text-right">
                  <div class="text-xs text-slate-400">기사단 총 전투력</div>
                  <div class="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                    ${kingdomPower.totalPoints.toLocaleString()} <span class="text-xs font-normal">pts</span>
                  </div>
                </div>
              </div>

              <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                ${kingdomPower.tier.description}
              </p>

              <!-- 발전도 프로그레스 바 -->
              <div class="space-y-1.5 pt-1">
                <div class="flex items-center justify-between text-xs font-bold">
                  <span class="text-slate-700 dark:text-slate-300">다음 영지 승급 진행도</span>
                  <span class="text-indigo-600 dark:text-indigo-400 font-mono">${kingdomPower.progressPercent}%</span>
                </div>
                <div class="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shadow-inner">
                  <div class="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-400 rounded-full transition-all duration-500" style="width: ${kingdomPower.progressPercent}%"></div>
                </div>
                <div class="flex justify-between text-[11px] text-slate-400">
                  <span>현 등급: ${kingdomPower.tier.name}</span>
                  <span>다음 등급: ${kingdomPower.nextTier ? kingdomPower.nextTier.name : '최고 등급 도달!'}</span>
                </div>
              </div>

              <!-- 요약 기사단 수 -->
              <div class="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-700/60">
                <span>⚔️ 총 기사 단원: <strong class="text-slate-800 dark:text-slate-200">${kingdomPower.totalWords}명</strong></span>
                <span>•</span>
                <span>🛡️ 고위 기사(중급 이상): <strong class="text-indigo-600 dark:text-indigo-400">${kingdomPower.advancedKnightCount}명</strong></span>
                <span>•</span>
                <span>👑 수호 기사(근위대/마스터): <strong class="text-amber-500 dark:text-amber-400">${kingdomPower.royalGuardCount + kingdomPower.masterCount}명</strong></span>
              </div>
            </div>

          </div>
        </div>

        <!-- 🗺️ 단어장별 왕국 발전도 한눈에 보기 (갤러리 그리드) -->
        <div class="space-y-3">
          <div class="flex items-center justify-between px-1">
            <h3 class="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <span>🗺️</span> <span>단어장별 영지 발전 현황 비교</span>
            </h3>
            <span class="text-xs text-slate-400">카드를 클릭하여 해당 단어장 선택</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            ${decks.map(deck => {
              const dWords = (deck.words || []).filter(Boolean);
              dWords.forEach(w => MasteryManager.ensureMastery(w));
              const dPower = KingdomManager.calculateKingdomPower(dWords);
              const isSelected = this.selectedDeckId === deck.id;

              return `
                <div data-deck-id="${deck.id}" class="deck-filter-btn cursor-pointer p-4 rounded-2xl border-2 transition-all transform hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between ${isSelected ? 'border-indigo-600 ring-2 ring-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-950/40 shadow-md' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300'}">
                  <div class="flex items-center gap-3 mb-2.5">
                    <div class="w-16 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-900/10 dark:bg-slate-900/60 flex items-center justify-center">
                      ${KingdomManager.getKingdomIllustrationSVG(dPower.tier.level)}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between gap-1 mb-0.5">
                        <span class="text-xs font-black text-slate-900 dark:text-white truncate">${deck.name}</span>
                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${dPower.tier.badgeColor}">T${dPower.tier.level}</span>
                      </div>
                      <div class="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold truncate">
                        ${dPower.tier.name}
                      </div>
                    </div>
                  </div>

                  <!-- 단어수 및 기사단 포인트 -->
                  <div class="space-y-1 mt-auto">
                    <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>단어 ${dPower.totalWords}개 / 기사단</span>
                      <span class="font-bold text-slate-700 dark:text-slate-300 font-mono">${dPower.totalPoints} pts</span>
                    </div>
                    <div class="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div class="h-full bg-indigo-500 rounded-full" style="width: ${dPower.progressPercent}%"></div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 단어장 선택 네비게이션 탭 & 일괄 초기화 버튼 -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div class="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar py-0.5">
            <span class="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">단어장 선택:</span>
            <button data-deck-id="all" class="deck-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition whitespace-nowrap ${this.selectedDeckId === 'all' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'}">
              🌐 전체 통합 (${allWords.length})
            </button>
            ${decks.map(d => `
              <button data-deck-id="${d.id}" class="deck-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition whitespace-nowrap ${this.selectedDeckId === d.id ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'}">
                📁 ${d.name} (${(d.words || []).length})
              </button>
            `).join('')}
          </div>

          <div class="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button id="perf-reset-deck-btn" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 transition flex items-center gap-1.5" title="현재 선택된 단어장의 모든 단어 숙련도를 0점으로 초기화합니다">
              <span>🔄</span> <span>선택 단어장 일괄 초기화</span>
            </button>
          </div>
        </div>

        <!-- 7단계 기사 등급별 확보 현황 카드 (전체 & 단어장별 표시) -->
        <div class="space-y-3">
          <div class="flex items-center justify-between px-1">
            <h3 class="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <span>⚔️</span> <span>기사단 등급별 단어 확보 현황</span>
              <span class="text-xs font-medium text-slate-500 dark:text-slate-400">(${currentDeckName})</span>
            </h3>
            <span class="text-xs text-slate-400">카드를 클릭하여 해당 등급만 필터링</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
            ${Object.values(RANK_TYPES).map(rank => {
              const cfg = RANK_CONFIG[rank];
              const deckCount = deckStats.counts[rank] || 0;
              const totalCount = overallStats.counts[rank] || 0;
              const deckPct = currentDeckWords.length > 0 ? Math.round((deckCount / currentDeckWords.length) * 100) : 0;
              const isSelected = this.selectedRankFilter === rank;

              return `
                <div data-rank="${rank}" class="rank-card cursor-pointer p-3 rounded-2xl border-2 transition-all transform hover:-translate-y-1 hover:shadow-lg flex flex-col items-center text-center ${isSelected ? 'border-indigo-600 ring-2 ring-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-md' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'}">
                  <!-- 걷는 기사 애니메이션 아이콘 -->
                  <div class="w-14 h-14 flex items-center justify-center mb-1">
                    ${MasteryManager.getWalkingKnightIcon(rank, 52)}
                  </div>

                  <div class="text-xs font-black text-slate-900 dark:text-white mb-0.5">
                    ${cfg.name}
                  </div>

                  <div class="text-[10px] text-slate-400 mb-1.5 font-medium">
                    ${cfg.scoreRange}
                  </div>

                  <!-- 단어 수 및 비율 -->
                  <div class="w-full bg-slate-100 dark:bg-slate-700/60 rounded-xl py-1.5 px-2 mt-auto">
                    <div class="text-base font-black text-slate-800 dark:text-white leading-none">
                      ${deckCount}<span class="text-[10px] font-normal text-slate-500 dark:text-slate-400">개</span>
                    </div>
                    <div class="text-[10px] text-slate-400 font-mono mt-0.5">
                      ${deckPct}% ${this.selectedDeckId !== 'all' ? `<span class="opacity-70">(전체 ${totalCount})</span>` : ''}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 단어 목록 필터 & 정렬 컨트롤 바 -->
        <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div class="flex items-center gap-2 flex-1">
            <!-- 검색창 -->
            <div class="relative flex-1 max-w-sm">
              <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs">🔍</span>
              <input type="text" id="perf-search-input" value="${this.searchQuery}" placeholder="단어 또는 뜻 검색..." class="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:outline-none focus:border-indigo-500">
            </div>

            <!-- 등급 필터 셀렉트 -->
            <select id="perf-rank-select" class="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
              <option value="all" ${this.selectedRankFilter === 'all' ? 'selected' : ''}>모든 등급 보기</option>
              ${Object.values(RANK_TYPES).map(r => `
                <option value="${r}" ${this.selectedRankFilter === r ? 'selected' : ''}>${RANK_CONFIG[r].name} (${deckStats.counts[r] || 0}개)</option>
              `).join('')}
            </select>
          </div>

          <!-- 정렬 셀렉트 -->
          <div class="flex items-center gap-2 self-end md:self-auto">
            <span class="text-xs text-slate-400 shrink-0">정렬:</span>
            <select id="perf-sort-select" class="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
              <option value="rank_desc" ${this.sortBy === 'rank_desc' ? 'selected' : ''}>기사 등급 높은 순 👑</option>
              <option value="rank_asc" ${this.sortBy === 'rank_asc' ? 'selected' : ''}>기사 등급 낮은 순</option>
              <option value="score_desc" ${this.sortBy === 'score_desc' ? 'selected' : ''}>숙련도 점수 높은 순 (100 ➔ 0)</option>
              <option value="score_asc" ${this.sortBy === 'score_asc' ? 'selected' : ''}>숙련도 점수 낮은 순 (0 ➔ 100)</option>
              <option value="number_asc" ${this.sortBy === 'number_asc' ? 'selected' : ''}>단어 번호 순 (No. 1 ➔)</option>
              <option value="alphabet_asc" ${this.sortBy === 'alphabet_asc' ? 'selected' : ''}>알파벳 순 (A ➔ Z)</option>
            </select>
          </div>
        </div>

        <!-- 단어 목록 테이블 / 카드 뷰 -->
        <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div class="p-4 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
            <div class="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <span>📋</span> <span>단어별 숙련도 및 상태</span>
              <span class="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-mono">
                ${filteredWords.length}개 표시 중
              </span>
            </div>
            ${this.selectedRankFilter !== 'all' ? `
              <button id="perf-clear-filter-btn" class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold">
                ✕ 등급 필터 해제
              </button>
            ` : ''}
          </div>

          ${filteredWords.length === 0 ? `
            <div class="text-center py-16 px-4">
              <div class="text-5xl mb-3">🛡️</div>
              <h4 class="text-base font-bold text-slate-800 dark:text-white mb-1">조건에 맞는 단어가 없습니다</h4>
              <p class="text-xs text-slate-400">검색어나 등급 필터를 조정하거나 플래시카드 & 퀴즈를 플레이해보세요.</p>
            </div>
          ` : `
            <div class="divide-y divide-slate-100 dark:divide-slate-700/60">
              ${filteredWords.map(word => {
                const rank = MasteryManager.getWordRank(word);
                const cfg = RANK_CONFIG[rank];
                const score = word.mastery.score || 0;
                const knightIconSvg = MasteryManager.getWalkingKnightIcon(rank, 44);
                const remainMs = MasteryManager.getRoyalGuardRemainingTime(word);
                const remainTimeStr = MasteryManager.formatRemainingTime(remainMs);

                // 게이지 바 색상
                let barColor = 'bg-slate-400';
                if (score >= 80) barColor = 'bg-gradient-to-r from-purple-500 to-rose-500';
                else if (score >= 60) barColor = 'bg-indigo-500';
                else if (score >= 40) barColor = 'bg-sky-500';
                else if (score >= 20) barColor = 'bg-amber-500';

                return `
                  <div class="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-750/50 transition">
                    <!-- 좌측: 걷는 기사 캐릭터 아이콘 + 단어 정보 -->
                    <div class="flex items-center gap-3.5 flex-1 min-w-0">
                      <!-- 걷는 아이콘 -->
                      <div class="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                        ${knightIconSvg}
                      </div>

                      <!-- 단어 본문 -->
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap mb-1">
                          ${word.number ? `
                            <span class="px-2 py-0.5 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-mono text-[10px] font-black">
                              #${word.number}
                            </span>
                          ` : ''}
                          <h4 class="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
                            ${word.word}
                          </h4>
                          ${word.phonetic ? `
                            <span class="text-xs font-mono text-slate-400 hidden sm:inline">${word.phonetic}</span>
                          ` : ''}
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            ${word.partOfSpeech || 'word'}
                          </span>
                          <!-- 등급 배지 -->
                          ${MasteryManager.getRankBadgeHTML(rank)}
                        </div>

                        <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium truncate">
                          ${word.meaning}
                        </p>
                      </div>
                    </div>

                    <!-- 중앙: 숙련도 게이지 바 & 상세 조건 현황 -->
                    <div class="w-full md:w-64 flex flex-col justify-center">
                      <div class="flex items-center justify-between text-xs font-bold mb-1">
                        <span class="text-slate-500 dark:text-slate-400">숙련도</span>
                        <span class="font-mono text-indigo-600 dark:text-indigo-400">${score} / 100점</span>
                      </div>
                      
                      <!-- 프로그레스 게이지 바 -->
                      <div class="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-1.5 shadow-inner">
                        <div class="h-full rounded-full transition-all duration-300 ${barColor}" style="width: ${score}%"></div>
                      </div>

                      <!-- 상태별 상세 안내 텍스트 -->
                      <div class="text-[11px] font-medium">
                        ${rank === RANK_TYPES.MASTER ? `
                          <span class="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <span>🌟</span> <span>완전 정복 (영구 마스터)</span>
                          </span>
                        ` : rank === RANK_TYPES.ROYAL_GUARD ? `
                          <span class="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                            <span>👑</span> <span>강등까지 ${remainTimeStr} (승급 ${word.mastery.promotionsToRoyalGuard || 1}/3회)</span>
                          </span>
                        ` : rank === RANK_TYPES.HIGH_KNIGHT ? `
                          <span class="text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1">
                            <span>⚔️</span> <span>근위대 도전 (퀴즈 연속정답: ${word.mastery.consecutiveQuizCorrectInKnight || 0}/2회)</span>
                          </span>
                        ` : score >= 70 ? `
                          <span class="text-indigo-500 dark:text-indigo-400 text-[10px]">
                            💡 플래시카드 한도 도달! 퀴즈/게임에서 100점에 도전하세요
                          </span>
                        ` : `
                          <span class="text-slate-400 text-[10px]">
                            다음 등급까지 ${(Math.floor(score / 20) + 1) * 20 - score}점 필요
                          </span>
                        `}
                      </div>
                    </div>

                    <!-- 우측: 컨트롤 버튼 (TTS 발음 듣기 & 상태 초기화) -->
                    <div class="flex items-center gap-2 self-end md:self-auto shrink-0">
                      <button data-tts="${word.word}" data-audio="${word.audioUrl || ''}" class="perf-tts-btn p-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 text-slate-600 dark:text-slate-300 transition" title="발음 듣기">
                        🔊
                      </button>

                      <button data-reset-id="${word.id}" data-reset-word="${word.word}" class="perf-reset-word-btn px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 dark:bg-slate-700 dark:hover:bg-rose-950/60 dark:text-slate-300 dark:hover:text-rose-300 text-xs font-bold transition flex items-center gap-1" title="이 단어의 숙련도와 등급을 초기화합니다">
                        <span>🔄</span> <span>초기화</span>
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

      </div>
    `;

    this.bindDynamicEvents();
  }

  /**
   * 단어 목록 통계 계산
   */
  calculateStats(words) {
    const list = words || [];
    const counts = {
      [RANK_TYPES.RECRUIT]: 0,
      [RANK_TYPES.INFANTRY]: 0,
      [RANK_TYPES.JUNIOR_KNIGHT]: 0,
      [RANK_TYPES.SENIOR_KNIGHT]: 0,
      [RANK_TYPES.HIGH_KNIGHT]: 0,
      [RANK_TYPES.ROYAL_GUARD]: 0,
      [RANK_TYPES.MASTER]: 0
    };

    let totalScore = 0;
    list.forEach(w => {
      const rank = MasteryManager.getWordRank(w);
      if (counts[rank] !== undefined) {
        counts[rank]++;
      }
      totalScore += (w.mastery && typeof w.mastery.score === 'number') ? w.mastery.score : 0;
    });

    const avgScore = list.length > 0 ? Math.round(totalScore / list.length) : 0;

    return { counts, avgScore, total: list.length };
  }

  /**
   * 필터링 및 정렬 적용
   */
  getFilteredAndSortedWords(words) {
    let list = [...(words || [])];

    // 1. 등급 필터
    if (this.selectedRankFilter !== 'all') {
      list = list.filter(w => MasteryManager.getWordRank(w) === this.selectedRankFilter);
    }

    // 2. 검색어 필터
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      list = list.filter(w => 
        (w.word && w.word.toLowerCase().includes(q)) ||
        (w.meaning && w.meaning.toLowerCase().includes(q)) ||
        (w.number && String(w.number).includes(q))
      );
    }

    // 3. 정렬
    const rankWeight = {
      [RANK_TYPES.MASTER]: 7,
      [RANK_TYPES.ROYAL_GUARD]: 6,
      [RANK_TYPES.HIGH_KNIGHT]: 5,
      [RANK_TYPES.SENIOR_KNIGHT]: 4,
      [RANK_TYPES.JUNIOR_KNIGHT]: 3,
      [RANK_TYPES.INFANTRY]: 2,
      [RANK_TYPES.RECRUIT]: 1
    };

    list.sort((a, b) => {
      const scoreA = a.mastery?.score || 0;
      const scoreB = b.mastery?.score || 0;
      const rankA = rankWeight[MasteryManager.getWordRank(a)] || 0;
      const rankB = rankWeight[MasteryManager.getWordRank(b)] || 0;

      switch (this.sortBy) {
        case 'rank_desc':
          if (rankB !== rankA) return rankB - rankA;
          return scoreB - scoreA;
        case 'rank_asc':
          if (rankA !== rankB) return rankA - rankB;
          return scoreA - scoreB;
        case 'score_desc':
          return scoreB - scoreA;
        case 'score_asc':
          return scoreA - scoreB;
        case 'number_asc':
          return (a.number || 999999) - (b.number || 999999);
        case 'alphabet_asc':
          return (a.word || '').localeCompare(b.word || '');
        default:
          return 0;
      }
    });

    return list;
  }

  bindEvents() {
    // 단어 숙련도 업데이트 시 자동 다시 렌더링
    window.addEventListener('vocaquest_mastery_changed', () => {
      this.render();
    });
    window.addEventListener('vocaquest_words_updated', () => {
      this.render();
    });
  }

  bindDynamicEvents() {
    if (!this.container) return;

    // 단어장 탭 버튼
    this.container.querySelectorAll('.deck-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedDeckId = btn.dataset.deckId;
        this.render();
      });
    });

    // 등급 카드 클릭 필터 토글
    this.container.querySelectorAll('.rank-card').forEach(card => {
      card.addEventListener('click', () => {
        const rank = card.dataset.rank;
        if (this.selectedRankFilter === rank) {
          this.selectedRankFilter = 'all'; // 토글 해제
        } else {
          this.selectedRankFilter = rank;
        }
        this.render();
      });
    });

    // 검색 인풋
    const searchInput = document.getElementById('perf-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.render();
        // 포커스 유지
        const reInput = document.getElementById('perf-search-input');
        if (reInput) {
          reInput.focus();
          reInput.setSelectionRange(reInput.value.length, reInput.value.length);
        }
      });
    }

    // 등급 셀렉트
    const rankSelect = document.getElementById('perf-rank-select');
    if (rankSelect) {
      rankSelect.addEventListener('change', (e) => {
        this.selectedRankFilter = e.target.value;
        this.render();
      });
    }

    // 정렬 셀렉트
    const sortSelect = document.getElementById('perf-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.render();
      });
    }

    // 필터 해제 버튼
    const clearFilterBtn = document.getElementById('perf-clear-filter-btn');
    if (clearFilterBtn) {
      clearFilterBtn.addEventListener('click', () => {
        this.selectedRankFilter = 'all';
        this.render();
      });
    }

    // 발음 듣기 버튼
    this.container.querySelectorAll('.perf-tts-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const word = btn.dataset.tts;
        const audio = btn.dataset.audio;
        SoundManager.speak(word, audio);
      });
    });

    // 개별 단어 초기화 버튼
    this.container.querySelectorAll('.perf-reset-word-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const wordId = btn.dataset.resetId;
        const wordText = btn.dataset.resetWord;
        if (confirm(`'${wordText}' 단어의 숙련도 점수와 등급 상태를 훈련병(0점)으로 초기화하시겠습니까?`)) {
          StorageManager.resetWordMastery(wordId);
          SoundManager.playTone('flip');
          this.render();
        }
      });
    });

    // 선택 단어장 일괄 초기화 버튼
    const resetDeckBtn = document.getElementById('perf-reset-deck-btn');
    if (resetDeckBtn) {
      resetDeckBtn.addEventListener('click', () => {
        const targetName = this.selectedDeckId === 'all' ? '전체 단어장' : '현재 선택된 단어장';
        if (confirm(`⚠️ [${targetName}]의 모든 단어 숙련도를 0점(훈련병)으로 초기화하시겠습니까?\n이 작업은 취소할 수 없습니다.`)) {
          const count = StorageManager.resetAllWordsMastery(this.selectedDeckId);
          alert(`${count}개 단어의 상태가 초기화되었습니다.`);
          SoundManager.playTone('flip');
          this.render();
        }
      });
    }
  }
}
