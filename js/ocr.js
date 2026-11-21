// js/ocr.js
// 단어장 이미지 OCR 인식 및 스마트 텍스트 파서 모듈

export class OCRParser {
  /**
   * 이미지 파일로부터 텍스트를 추출하고 단어/뜻 목록으로 변환
   * @param {File|Blob|string} imageSource 이미지 파일 또는 이미지 URL
   * @param {Function} onProgress 진행률 콜백 (0~100)
   * @returns {Promise<Array>} 추출된 단어 목록
   */
  static async extractFromImage(imageSource, onProgress = () => {}) {
    if (typeof window.Tesseract === 'undefined') {
      throw new Error(
        'Tesseract OCR 엔진이 로드되지 않았습니다. 인터넷 연결을 확인하거나 아래의 "텍스트 직접 붙여넣기" 기능을 이용해 주세요.'
      );
    }

    onProgress(10, 'OCR 엔진 초기화 중...');

    try {
      // 한국어와 영어를 동시에 인식하도록 설정
      const result = await window.Tesseract.recognize(imageSource, 'eng+kor', {
        logger: (m) => {
          if (m.status === 'recognizing text' && m.progress) {
            const pct = Math.round(10 + m.progress * 80);
            onProgress(pct, `텍스트 인식 중... (${Math.round(m.progress * 100)}%)`);
          }
        }
      });

      onProgress(95, '단어 목록 정제 및 파싱 중...');
      const text = result.data.text;
      const parsedWords = this.parseTextToWordList(text);
      onProgress(100, '완료!');
      return parsedWords;
    } catch (err) {
      console.error('OCR 실패:', err);
      throw new Error('이미지에서 글자를 읽는 데 실패했습니다: ' + (err.message || err));
    }
  }

  /**
   * 텍스트(OCR 결과 또는 사용자가 복사해 넣은 텍스트)를 단어/뜻 구조로 파싱
   * @param {string} rawText 
   * @returns {Array} [{word, meaning, partOfSpeech, imageUrl, example}]
   */
  static parseTextToWordList(rawText) {
    if (!rawText || typeof rawText !== 'string') return [];

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const results = [];

    // 흔히 단어장에 등장하는 품사 매핑
    const posPatterns = [
      { regex: /\[?(명|명사|n\.|noun)\]?/i, pos: 'noun' },
      { regex: /\[?(동|동사|v\.|verb)\]?/i, pos: 'verb' },
      { regex: /\[?(형|형용사|a\.|adj\.|adjective)\]?/i, pos: 'adjective' },
      { regex: /\[?(부|부사|ad\.|adv\.|adverb)\]?/i, pos: 'adverb' }
    ];

    for (let line of lines) {
      // 번호 접두사 제거 (예: "1. ", "01) ", "[1] ")
      line = line.replace(/^\s*(\d+[\.\)\:\-\]]|\(\d+\))\s*/, '');

      let word = '';
      let meaning = '';
      let partOfSpeech = 'noun';

      // 1. 구분자 분리 시도 (: , - , = , 탭)
      const delimiterMatch = line.match(/\s*(?:[:=\-–—\t]|\s{2,})\s*/);
      if (delimiterMatch) {
        const parts = line.split(delimiterMatch[0]);
        if (parts.length >= 2) {
          const partA = parts[0].trim();
          const partB = parts.slice(1).join(' ').trim();

          // 영어와 한글 판별
          if (/^[a-zA-Z\s\-\'\.]+$/.test(partA) && /[가-힣]/.test(partB)) {
            word = partA;
            meaning = partB;
          } else if (/[가-힣]/.test(partA) && /^[a-zA-Z\s\-\'\.]+$/.test(partB)) {
            meaning = partA;
            word = partB;
          }
        }
      }

      // 2. 구분자가 명확하지 않은 경우: 정규식으로 영단어 부분과 한글 부분 추출
      if (!word || !meaning) {
        // 영단어(알파벳)로 시작하고 뒤이어 한글이 나오는 패턴
        const regexEnKo = /^([a-zA-Z\s\-\'\.]+?)\s+([가-힣\s\(\)\[\],\.\~\/]+)$/;
        const matchEnKo = line.match(regexEnKo);
        if (matchEnKo) {
          word = matchEnKo[1].trim();
          meaning = matchEnKo[2].trim();
        }
      }

      // 3. 여전히 매칭되지 않은 경우 유효 단어 추출
      if (!word && !meaning) {
        const wordsInLine = line.split(/\s+/);
        const enWords = wordsInLine.filter(w => /^[a-zA-Z\-\'\.]+$/.test(w));
        const koWords = wordsInLine.filter(w => /[가-힣]/.test(w));

        if (enWords.length > 0 && koWords.length > 0) {
          word = enWords.join(' ');
          meaning = koWords.join(' ');
        }
      }

      // 품사 검출 및 뜻에서 품사 표기 정제
      if (word && meaning) {
        for (const p of posPatterns) {
          if (p.regex.test(meaning)) {
            partOfSpeech = p.pos;
            meaning = meaning.replace(p.regex, '').trim();
            break;
          }
        }

        // 특수문자 정리
        word = word.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '');
        meaning = meaning.replace(/^[\s,:\-\.]+|[\s,:\-\.]+$/g, '');

        if (word.length >= 2 && meaning.length >= 1) {
          results.push({
            word: word.toLowerCase(),
            meaning: meaning,
            partOfSpeech: partOfSpeech,
            phonetic: '',
            imageUrl: this.generateAutoImageUrl(word),
            example: '',
            exampleMeaning: '',
            tags: ['image-imported']
          });
        }
      }
    }

    return results;
  }

  /**
   * 단어 키워드를 기반으로 적절한 무료 고품질 연상 이미지 URL 생성
   */
  static generateAutoImageUrl(word) {
    if (!word) return '';
    const cleanWord = encodeURIComponent(word.toLowerCase().trim());
    // 고화질 Unsplash Source 또는 무료 일러스트/사진 플레이스홀더
    return `https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=600&q=80&sig=${cleanWord}`;
  }
}
