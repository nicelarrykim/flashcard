// js/imageFinder.js
// 영어 및 영영사전(Wikipedia/Wikimedia) 공식 이미지 및 맞춤형 교육 연상 일러스트 자동 검색 엔진

export class ImageFinder {
  static wikiCache = new Map();

  // 60개 교재 단어에 대한 정밀 맞춤형 시각 일러스트 프롬프트 사전
  static CURATED_PROMPTS = {
    177: 'Lost and Found sign with unclaimed bags and umbrellas at counter, friendly vector art',
    178: 'person doing a good deed helping an elder cross the street, heartwarming illustration',
    179: 'items sorted separately into neat organized colored boxes, clear illustration',
    180: 'person with curious thoughtful expression with what if question mark thought bubble',
    181: 'teacher handing out worksheets and gifts to cheerful students, vector art',
    182: 'happy child skipping along a sunny park pathway, dynamic motion vector',
    183: 'person admitting and confessing truth with honest open hands gesture',
    184: 'silent person communicating with gestures, speechless dumbfounded face',
    185: 'open leather journal diary notebook with handwritten notes and pen',
    186: 'child playfully peeking around a door corner with smiling eyes',
    187: 'radiant healthy facial complexion with glowing smiling face',
    188: 'person relaxing in a hammock with calendar showing day off vacation',
    189: 'hand gently stopping and keeping child from touching hot stove',
    190: 'clean hygiene concept with washing hands with soap and water bubbles',
    191: 'sparkling shiny brand new unboxed smartphone gadget with sparkle stars',
    192: 'cartoon character screaming in excitement with wide open mouth',
    193: 'spotlight shining on stage getting everyones full attention focus',
    194: 'person making a big fuss over a tiny spilled cup of tea, funny illustration',
    195: 'precious sparkling priceless diamond treasure chest with golden light',
    196: 'golden balance scale in perfect equal balance and harmony',
    197: 'border crossing sign between two friendly green country territories',
    198: 'satisfied smiling customer giving two thumbs up of high satisfaction',
    199: 'fresh red apple sliced exactly in half showing symmetrical halves',
    200: 'detective looking through magnifying glass at mystery crime scene clue',
    201: 'green upward arrow graph showing dramatic increase and financial growth',
    202: 'person leaving office with cardboard box deciding to quit and start fresh',
    203: 'suspicious detective squinting eyes smelling something fishy and odd',
    204: 'selfish boy hugging all toys and not sharing with anyone',
    205: 'calendar showing recent yesterday and today days on modern desk',
    206: 'hand casting a vote ballot paper into a white voting ballot box',
    207: 'sneaky cartoon crook thief with mask running away tip-toeing',
    208: 'store shelf filled with neat retail merchandise products and packages',
    209: 'person in hurry running with ticking clock showing get a move on',
    210: 'cartoon character feeling dizzy with swirling stars fainting gently',
    211: 'hand tossing flipping a shiny gold coin up into the air',
    212: 'shy blushing girl covering cheeks feeling blush of shame',
    213: 'sick person holding green stomach feeling nausea vomiting throw up',
    214: 'friendly playful boy sticking tongue out teasing smiling sister',
    215: 'person standing on mountain top taking deep fresh breath of clean air',
    216: 'glamorous actress on red carpet under flashing camera spotlights',
    217: 'tourist wearing straw hat and backpack taking photo with camera in city',
    218: 'wise monarch king with golden crown ruling kingdom from throne',
    219: 'fast cheetah running at rapid speed with motion blur wind lines',
    220: 'polite student bowing respectfully with warm gentle smile',
    221: 'peaceful normal average everyday life street scene',
    222: 'terrific celebration with colorful fireworks and huge thumbs up',
    223: 'peaceful white candle with white flower memorial of quiet peace',
    224: 'colorful solar system planet with rings floating in starry space',
    225: 'broken heavy iron chains breaking free into freedom and liberty',
    226: 'modern fitness gym with dumbbells barbells and workout equipment',
    227: 'gentle hands caressing a soft white fluffy cute baby lamb',
    228: 'grand council conference meeting chamber room with long mahogany table',
    229: 'climber overcoming steep mountain peak planting victory flag at summit',
    230: 'business manager giving warm handshake to hire new employee',
    231: 'sneaky raccoon or thief quietly stealing a cookie from jar',
    232: 'nervous student sweating slightly with butterflies before big exam',
    233: 'classic round cartoon bomb with glowing burning lit fuse spark',
    234: 'airplane arriving and landing smoothly on airport runway sunset',
    235: 'child gently feeding bird seeds from open hand to cute little sparrow',
    236: 'playful golden retriever dog fetching tennis ball running happily'
  };

  /**
   * 단어와 뜻에 매핑되는 최적의 그림 URL을 자동으로 찾아 반환
   * 1순위: 교재 특화 고품질 비주얼 프롬프트
   * 2순위: 영영사전(Wikipedia/Wikimedia) 공식 이미지 (구체 명사/사물)
   * 3순위: 단어와 한국어 뜻을 시각화한 맞춤형 교육 일러스트 (동사, 숙어, 추상어)
   */
  static async getBestImageUrl(word, meaning = '', number = null) {
    if (!word) return '';
    const cleanWord = word.trim();
    const cacheKey = (cleanWord + '_' + (meaning || '')).toLowerCase();

    if (this.wikiCache.has(cacheKey)) {
      return this.wikiCache.get(cacheKey);
    }

    // 1. 교재 번호 기반 특화 일러스트 확인
    if (number && this.CURATED_PROMPTS[number]) {
      const url = this.generateIllustrationFromPrompt(this.CURATED_PROMPTS[number]);
      this.wikiCache.set(cacheKey, url);
      return url;
    }

    // 2. 단일 단어 명사일 경우 Wikipedia 공식 영영 백과사전 이미지 탐색
    if (!cleanWord.includes(' ') && cleanWord.length >= 3) {
      try {
        const wikiImg = await this.fetchWikipediaThumbnail(cleanWord);
        if (wikiImg) {
          this.wikiCache.set(cacheKey, wikiImg);
          return wikiImg;
        }
      } catch (e) {
        // 계속 진행
      }
    }

    // 3. 동사, 숙어, 추상어 또는 위키 이미지가 없는 경우:
    // 단어와 한국어 뜻을 시각적으로 설명하는 고품질 교육용 일러스트레이션 자동 생성
    const illustrationUrl = this.generateIllustrationUrl(cleanWord, meaning);
    this.wikiCache.set(cacheKey, illustrationUrl);
    return illustrationUrl;
  }

  /**
   * Wikipedia API로부터 공식 영영사전/백과사전 썸네일 검색
   */
  static async fetchWikipediaThumbnail(word) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(word.toLowerCase())}`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) return null;
      const data = await res.json();
      const src = data.thumbnail?.source;

      // 유효한 교육용 이미지인지 필터링 (아이콘, 깃발, 지도 등 제외)
      if (src && (src.endsWith('.jpg') || src.endsWith('.png') || src.endsWith('.jpeg')) &&
          !src.includes('Flag_of') && !src.includes('Map_of') && !src.includes('Symbol_')) {
        return src;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  /**
   * 단어와 뜻에 맞춘 직관적인 교육용 연상 일러스트 URL 생성 (Pollinations AI Visual Engine)
   */
  static generateIllustrationUrl(word, meaning = '') {
    const cleanWord = word.trim();
    const cleanMeaning = (meaning || '').trim();
    const prompt = `clear friendly educational illustration for english vocabulary learning: "${cleanWord}" meaning "${cleanMeaning}", vibrant colors, clean white background, high quality vector art`;
    return this.generateIllustrationFromPrompt(prompt);
  }

  static generateIllustrationFromPrompt(prompt) {
    const encoded = encodeURIComponent(prompt.trim());
    return `https://image.pollinations.ai/prompt/${encoded}?width=400&height=300&nologo=true`;
  }

  /**
   * Unsplash 실물 스톡 사진 URL 생성
   */
  static generateUnsplashUrl(word) {
    const clean = encodeURIComponent(word.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim());
    return `https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=600&q=80&sig=${clean}`;
  }

  /**
   * 사용자가 마음에 드는 스타일의 그림을 직접 고를 수 있는 3가지 후보 이미지 반환
   */
  static async getImageAlternatives(word, meaning = '', number = null) {
    const clean = word.trim();
    const wiki = await this.fetchWikipediaThumbnail(clean);

    let illustration;
    if (number && this.CURATED_PROMPTS[number]) {
      illustration = this.generateIllustrationFromPrompt(this.CURATED_PROMPTS[number]);
    } else {
      illustration = this.generateIllustrationUrl(clean, meaning);
    }

    const photo = `https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80&sig=${encodeURIComponent(clean)}`;

    return [
      { type: 'illustration', label: '🎨 교육용 연상 일러스트 (추천)', url: illustration },
      ...(wiki ? [{ type: 'wiki', label: '📖 영영사전/위키백과 공식 사진', url: wiki }] : []),
      { type: 'photo', label: '📷 고화질 실물 사진', url: photo }
    ];
  }
}
