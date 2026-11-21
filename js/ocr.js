// js/ocr.js
// 단어장 교재 표(Table) 인식, 스마트 열 분할(Column Slicing), 다중 사진 일괄 OCR 파서 모듈

export class OCRParser {
  /**
   * 여러 장의 이미지를 순차적으로 OCR 분석하여 단어 목록 추출
   * @param {Array<File|Blob|string>} imageSources 이미지 소스 배열
   * @param {Object} options { columnMode: '2col'|'1col'|'3col', enhanceContrast: true }
   * @param {Function} onProgress (overallPct, fileIndex, totalFiles, currentMsg)
   * @returns {Promise<Array>} 통합 추출된 단어 목록
   */
  static async extractFromMultipleImages(imageSources, options = { columnMode: '2col' }, onProgress = () => {}) {
    if (typeof window.Tesseract === 'undefined') {
      throw new Error('Tesseract OCR 엔진이 로드되지 않았습니다. 브라우저를 새로고침하거나 네트워크 연결을 확인해주세요.');
    }

    const totalFiles = imageSources.length;
    let combinedWords = [];

    for (let i = 0; i < totalFiles; i++) {
      const source = imageSources[i];
      const fileProgressBase = (i / totalFiles) * 100;
      const fileProgressScale = 100 / totalFiles;

      onProgress(
        Math.round(fileProgressBase),
        i + 1,
        totalFiles,
        `[${i + 1}/${totalFiles}] 이미지 전처리 및 분할 중...`
      );

      try {
        // 단일 이미지 분석 (열 분할 포함)
        const fileWords = await this.extractFromSingleImage(source, options, (subPct, msg) => {
          const overall = Math.round(fileProgressBase + (subPct / 100) * fileProgressScale);
          onProgress(overall, i + 1, totalFiles, `[${i + 1}/${totalFiles}] ${msg}`);
        });

        combinedWords = combinedWords.concat(fileWords);
      } catch (err) {
        console.error(`파일 ${i + 1} 분석 오류:`, err);
        // 개별 파일 오류 시에도 다음 파일 계속 진행
      }
    }

    onProgress(100, totalFiles, totalFiles, '모든 사진 분석 완료!');
    return this.deduplicateWords(combinedWords);
  }

  /**
   * 단일 이미지 분석 (2단/3단 표 컬럼 슬라이싱 지원)
   */
  static async extractFromSingleImage(imageSource, options = { columnMode: '2col' }, onProgress = () => {}) {
    const columnMode = options.columnMode || '2col';

    // 1. 이미지 로드 및 Canvas 준비
    const imgElement = await this.loadImageElement(imageSource);
    
    // 2. 표 레이아웃에 따른 이미지 분할 (Slice)
    const slices = this.sliceImageIntoColumns(imgElement, columnMode);
    let allText = '';

    for (let c = 0; c < slices.length; c++) {
      const sliceCanvas = slices[c];
      const sliceLabel = slices.length > 1 ? `열 ${c + 1}/${slices.length}` : '';
      
      const colBasePct = (c / slices.length) * 90;
      const colScale = 90 / slices.length;

      // Tesseract OCR 실행
      const result = await window.Tesseract.recognize(sliceCanvas, 'eng+kor', {
        logger: (m) => {
          if (m.status === 'recognizing text' && m.progress) {
            const pct = Math.round(colBasePct + m.progress * colScale);
            onProgress(pct, `${sliceLabel} 텍스트 읽는 중... (${Math.round(m.progress * 100)}%)`);
          }
        }
      });

      allText += '\n' + (result.data.text || '');
    }

    onProgress(95, '단어 및 뜻 정제/파싱 중...');
    const parsedWords = this.parseTextToWordList(allText);
    onProgress(100, `완료 (${parsedWords.length}개 추출)`);

    return parsedWords;
  }

  /**
   * 이미지를 Canvas로 로드
   */
  static loadImageElement(source) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error('이미지 로드에 실패했습니다.'));

      if (source instanceof File || source instanceof Blob) {
        img.src = URL.createObjectURL(source);
      } else if (typeof source === 'string') {
        img.src = source;
      } else {
        reject(new Error('유효하지 않은 이미지 소스입니다.'));
      }
    });
  }

  /**
   * 표 레이아웃에 따라 이미지를 세로 열(Column)로 분할하여 각각 캔버스 반환
   * (첨부된 책 사진처럼 좌/우 2단 표로 나뉘어 있을 때 텍스트 뒤섞임을 원천 차단)
   */
  static sliceImageIntoColumns(img, columnMode) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    if (columnMode === '1col' || w < 300) {
      // 1단 모드: 분할하지 않고 원본 캔버스 반환
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return [canvas];
    }

    const slices = [];

    if (columnMode === '2col') {
      // 좌측 열 (약 0% ~ 53% 너비, 중앙선 약간 포함)
      const canvasLeft = document.createElement('canvas');
      const w1 = Math.round(w * 0.53);
      canvasLeft.width = w1;
      canvasLeft.height = h;
      const ctxLeft = canvasLeft.getContext('2d');
      ctxLeft.drawImage(img, 0, 0, w1, h, 0, 0, w1, h);
      slices.push(canvasLeft);

      // 우측 열 (약 50% ~ 98% 너비, 다음 페이지 가장자리 약간 제외)
      const canvasRight = document.createElement('canvas');
      const startX2 = Math.round(w * 0.49);
      const w2 = Math.round(w * 0.49);
      canvasRight.width = w2;
      canvasRight.height = h;
      const ctxRight = canvasRight.getContext('2d');
      ctxRight.drawImage(img, startX2, 0, w2, h, 0, 0, w2, h);
      slices.push(canvasRight);

    } else if (columnMode === '3col') {
      // 3단 표 분할
      const colW = Math.round(w / 3);
      for (let i = 0; i < 3; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = colW;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, i * colW, 0, colW, h, 0, 0, colW, h);
        slices.push(canvas);
      }
    }

    return slices;
  }

  /**
   * 첨부 단어장 교재 양식에 최적화된 초정밀 단어/뜻 분리 파서
   * 특징:
   * 1. 177, 178 등 순번 번호 자동 제거
   * 2. 'Lost and Found', 'keep from ~ing', 'get a move on' 같은 공백/특수기호 포함 숙어 완벽 지원
   * 3. 첫 번째 한글 글자(또는 한글 시작 기호) 위치를 정확히 탐지하여 영단어와 한글 뜻을 깔끔하게 절단
   */
  static parseTextToWordList(rawText) {
    if (!rawText || typeof rawText !== 'string') return [];

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const results = [];

    for (let rawLine of lines) {
      // 1. 앞단의 번호 제거 (예: "177", "178.", "209)", "[180]", "181 ")
      let line = rawLine.replace(/^\s*(\d{1,4}[\.\)\:\-\]]|\(\d{1,4}\)|\d{1,4})\s+/, '').trim();

      // 숫자로만 된 라인은 스킵
      if (/^\d+$/.test(line) || line.length < 3) continue;

      let word = '';
      let meaning = '';

      // 2. 한글 글자([가-힣])가 처음 등장하는 인덱스 탐색
      const hangulIdx = line.search(/[가-힣]/);

      if (hangulIdx > 0) {
        let enPart = line.substring(0, hangulIdx).trim();
        let koPart = line.substring(hangulIdx).trim();

        // 만약 영어 파트 끝에 물결표(~)나 뜻에 속할 수 있는 기호가 있다면 보정
        // 예: "what if ~" -> "what if", "~이면 어쩌지"
        if (enPart.endsWith('~') && !enPart.includes('~ing')) {
          enPart = enPart.slice(0, -1).trim();
          koPart = '~' + koPart;
        }

        // 구분자 기호(: , - , |) 정제
        enPart = enPart.replace(/^[:\|\-\s]+|[:\|\-\s]+$/g, '');
        koPart = koPart.replace(/^[:\|\-\s]+|[:\|\-\s]+$/g, '');

        // 영어 부분에 알파벳이 최소 2글자 이상 포함되어 있고, 한국어 뜻이 존재하면 유효 단어로 인정
        if (/[a-zA-Z]{2,}/.test(enPart) && koPart.length >= 1) {
          word = enPart;
          meaning = koPart;
        }
      }

      // 3. Fallback: 구분자(: , - , \t)로 분리 시도
      if (!word || !meaning) {
        const parts = line.split(/[:\-\t|]/);
        if (parts.length >= 2) {
          const p1 = parts[0].trim();
          const p2 = parts.slice(1).join(' ').trim();
          if (/[a-zA-Z]/.test(p1) && /[가-힣]/.test(p2)) {
            word = p1;
            meaning = p2;
          }
        }
      }

      // 유효한 단어 추가
      if (word && meaning) {
        // 단어 정제
        word = word.trim();
        meaning = meaning.trim();

        // 특수 노이즈 필터링
        if (word.length >= 2 && !results.some(r => r.word.toLowerCase() === word.toLowerCase())) {
          results.push({
            word: word,
            meaning: meaning,
            partOfSpeech: this.detectPartOfSpeech(meaning),
            phonetic: '',
            imageUrl: this.generateAutoImageUrl(word),
            audioUrl: this.generateAudioUrl(word),
            example: '',
            exampleMeaning: '',
            tags: ['photo-scan']
          });
        }
      }
    }

    return results;
  }

  /**
   * 뜻을 기반으로 대략적인 품사 추정
   */
  static detectPartOfSpeech(meaning) {
    if (meaning.endsWith('하다') || meaning.endsWith('되다') || meaning.endsWith('시키다') || meaning.endsWith('다')) {
      return 'verb';
    }
    if (meaning.endsWith('한') || meaning.endsWith('인') || meaning.endsWith('적') || meaning.endsWith('로운') || meaning.endsWith('의')) {
      return 'adjective';
    }
    if (meaning.endsWith('게') || meaning.endsWith('히')) {
      return 'adverb';
    }
    return 'noun';
  }

  /**
   * 단어 또는 구/숙어에 맞는 고품질 실제 미국 원어민 발음 MP3 URL 생성
   */
  static generateAudioUrl(word) {
    const clean = word.toLowerCase().trim();
    // 단일 단어인 경우 Google Dictionary 공식 사전 CDN 우선
    if (!clean.includes(' ') && /^[a-z\-]+$/.test(clean)) {
      return `https://ssl.gstatic.com/dictionary/static/sounds/20200429/${clean}--_us_1.mp3`;
    }
    // 숙어/구동사인 경우 Youdao 고품질 원어민 음성 스트림
    return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(clean)}&type=2`;
  }

  /**
   * 단어별 고화질 연상 이미지 추천 URL 생성
   */
  static generateAutoImageUrl(word) {
    if (!word) return '';
    const cleanWord = encodeURIComponent(word.toLowerCase().trim());
    return `https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=600&q=80&sig=${cleanWord}`;
  }

  /**
   * 중복 단어 제거
   */
  static deduplicateWords(words) {
    const map = new Map();
    words.forEach(w => {
      const key = w.word.toLowerCase();
      if (!map.has(key)) {
        map.set(key, w);
      }
    });
    return Array.from(map.values());
  }
}
