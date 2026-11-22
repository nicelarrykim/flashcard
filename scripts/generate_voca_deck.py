# scripts/generate_voca_deck.py
import os
import json
import sqlite3

# 250 단어 데이터 정의 (index, word, meaning, partOfSpeech)
WORDS = [
    # 1 ~ 28
    (1, "involve", "수반하다, 포함하다", "verb"),
    (2, "maintain", "유지하다", "verb"),
    (3, "pronounce", "발음하다", "verb"),
    (4, "mankind", "인류, 인간", "noun"),
    (5, "employ", "고용하다", "verb"),
    (6, "expectation", "기대", "noun"),
    (7, "digest", "소화하다", "verb"),
    (8, "continent", "대륙, 육지", "noun"),
    (9, "belief", "신념, 확신", "noun"),
    (10, "artistic", "예술적인, 예술의", "adj"),
    (11, "assess", "평가하다", "verb"),
    (12, "collaborate", "협력하다", "verb"),
    (13, "precise", "정확한, 정밀한", "adj"),
    (14, "restriction", "제한", "noun"),
    (15, "venture", "모험하다", "verb"),
    (16, "appearance", "겉모습, 외모", "noun"),
    (17, "contrast", "대조하다", "verb"),
    (18, "compete", "경쟁하다", "verb"),
    (19, "logical", "논리적인", "adj"),
    (20, "urgent", "긴급한", "adj"),
    (21, "surrender", "항복하다", "verb"),
    (22, "critical", "비판적인, 비평하는", "adj"),
    (23, "slightly", "약간", "adv"),
    (24, "barren", "척박한, 황량한", "adj"),
    (25, "turn down", "거절하다", "verb"),
    (26, "refreshing", "신선한, 상쾌한", "adj"),
    (27, "come up with", "생각해내다", "verb"),
    (28, "on purpose", "고의로, 일부러", "adv"),

    # 29 ~ 56
    (29, "parachute", "낙하산", "noun"),
    (30, "session", "회의, 수업", "noun"),
    (31, "vary", "바꾸다", "verb"),
    (32, "alert", "경계하는, 조심하는", "adj"),
    (33, "witness", "목격하다", "verb"),
    (34, "cling", "달라붙다", "verb"),
    (35, "rubbish", "쓰레기", "noun"),
    (36, "subject", "과목, 주제", "noun"),
    (37, "dissolve", "녹다", "verb"),
    (38, "misunderstanding", "오해", "noun"),
    (39, "emphasis", "강조", "noun"),
    (40, "tame", "길들여진", "adj"),
    (41, "strain", "안간힘을 쓰다", "verb"),
    (42, "eerie", "으스스한, 괴상한", "adj"),
    (43, "instruct", "가르치다", "verb"),
    (44, "rant", "고함치다", "verb"),
    (45, "ignorant", "무식한", "adj"),
    (46, "aggressive", "공격적인", "adj"),
    (47, "intercept", "가로막다", "verb"),
    (48, "in public", "대중 앞에서", "adv"),
    (49, "talent", "재능, 장기", "noun"),
    (50, "retrieve", "회수하다, 되찾다", "verb"),
    (51, "patter", "후드득 떨어지다", "verb"),
    (52, "reek", "악취를 풍기다", "verb"),
    (53, "stoop", "몸을 굽히다", "verb"),
    (54, "throb", "욱신거리다", "verb"),
    (55, "nibble", "야금 야금 먹다", "verb"),
    (56, "glare at", "노려보다", "verb"),

    # 57 ~ 86
    (57, "long for", "열망하다, 갈망하다", "verb"),
    (58, "sulky", "뚱한", "adj"),
    (59, "mean", "성질나쁜", "adj"),
    (60, "varnish", "광택제", "noun"),
    (61, "indignantly", "분개하여", "adv"),
    (62, "physical", "육체의, 신체의", "adj"),
    (63, "brief", "단시간의; 간결한", "adj"),
    (64, "fill out", "기입하다", "verb"),
    (65, "concentrate on", "집중하다", "verb"),
    (66, "furiously", "맹렬히", "adv"),
    (67, "damage", "상하게 하다", "verb"),
    (68, "destiny", "운명", "noun"),
    (69, "incident", "사건", "noun"),
    (70, "fury", "격노", "noun"),
    (71, "leftover", "남은 음식, 잔재", "noun"),
    (72, "hoist", "들어올리다", "verb"),
    (73, "conquer", "정복하다", "verb"),
    (74, "vanish", "사라지다", "verb"),
    (75, "treaty", "조약", "noun"),
    (76, "oppose", "반대하다, 겨루다", "verb"),
    (77, "colony", "식민지", "noun"),
    (78, "Pacific Ocean", "태평양", "noun"),
    (79, "wound", "부상을 입히다", "verb"),
    (80, "ally", "동맹국, 협력자", "noun"),
    (81, "cautiously", "조심스럽게", "adv"),
    (82, "tramp", "터벅터벅 걷다", "verb"),
    (83, "yank", "홱 잡아당기다", "verb"),
    (84, "scold", "꾸짖다", "verb"),
    (85, "criminal", "범죄자", "noun"),
    (86, "suspect", "용의자", "noun"),

    # 87 ~ 116
    (87, "gooey", "끈적거리는", "adj"),
    (88, "reincarnate", "환생하다", "verb"),
    (89, "no wonder", "당연하다, 놀랄 일이 아니다", "phrase"),
    (90, "put up with", "~을 참고 견디다", "verb"),
    (91, "gorgeous", "멋진, 세련된", "adj"),
    (92, "run out of", "다 떨어지다", "verb"),
    (93, "obstruct", "방해하다, 막다", "verb"),
    (94, "grumble", "투덜거리다", "verb"),
    (95, "cram", "밀어 넣다", "verb"),
    (96, "attach", "붙이다, 첨부하다", "verb"),
    (97, "guide", "안내하다", "verb"),
    (98, "dreadful", "끔찍한, 지독한", "adj"),
    (99, "dart", "쏜살같이 달리다", "verb"),
    (100, "rummage", "뒤지다", "verb"),
    (101, "replica", "복제품, 모형", "noun"),
    (102, "equipment", "장비, 용품", "noun"),
    (103, "hostile", "적대적인", "adj"),
    (104, "take advantage of", "~을 이용하다", "verb"),
    (105, "brag", "자랑하다", "verb"),
    (106, "squirt", "찍 나오다", "verb"),
    (107, "free", "풀어주다", "verb"),
    (108, "absently", "멍하니, 무심코", "adv"),
    (109, "bug", "괴롭히다", "verb"),
    (110, "scamper", "날쌔게 움직이다", "verb"),
    (111, "betray", "배반하다", "verb"),
    (112, "rub off on", "~에 영향을 주다", "verb"),
    (113, "sicken", "병이 나다", "verb"),
    (114, "crack up", "마구 웃다", "verb"),
    (115, "shorten", "짧게 하다", "verb"),
    (116, "due", "~로 예정된", "adj"),

    # 117 ~ 146
    (117, "signal", "신호를 보내다", "verb"),
    (118, "pearl", "진주", "noun"),
    (119, "poke", "쿡 찌르다", "verb"),
    (120, "exhibit", "전시품, 전시하다", "noun"),
    (121, "a bunch of", "다수의", "phrase"),
    (122, "switch", "바꾸다", "verb"),
    (123, "solar energy", "태양 에너지", "noun"),
    (124, "innocent", "아무 잘못이 없는", "adj"),
    (125, "for a moment", "잠시 동안", "phrase"),
    (126, "vending machine", "자판기", "noun"),
    (127, "clutch", "움켜잡다", "verb"),
    (128, "crouch", "웅크리다", "verb"),
    (129, "sign language", "수화", "noun"),
    (130, "civilization", "문명화", "noun"),
    (131, "still", "고요한, 가만히 있는", "adj"),
    (132, "come to an end", "끝나다, 죽다", "verb"),
    (133, "presence", "있음, 존재함", "noun"),
    (134, "be crowded with", "~로 꽉 차다", "phrase"),
    (135, "mighty", "힘센, 강력한", "adj"),
    (136, "outline", "윤곽을 보여주다", "verb"),
    (137, "damp", "축축한", "adj"),
    (138, "doom", "비운, 죽음", "noun"),
    (139, "chilly", "추운", "adj"),
    (140, "generous", "인자한, 관대한", "adj"),
    (141, "applaud", "박수치다", "verb"),
    (142, "polish", "닦다, 윤을 내다", "verb"),
    (143, "sort", "분류하다", "verb"),
    (144, "former", "과거의, 이전의", "adj"),
    (145, "trait", "특성", "noun"),
    (146, "sibling", "형제자매", "noun"),

    # 147 ~ 176
    (147, "daybreak", "새벽", "noun"),
    (148, "brilliant", "훌륭한, 멋진", "adj"),
    (149, "fellow", "동료", "noun"),
    (150, "knowledge", "지식", "noun"),
    (151, "apart", "따로 떨어져서", "adv"),
    (152, "desire", "바라다, 원하다", "verb"),
    (153, "trust", "믿다, 신뢰하다", "verb"),
    (154, "merchant", "상인", "noun"),
    (155, "document", "서류", "noun"),
    (156, "slender", "날씬한", "adj"),
    (157, "cottage", "작은 집", "noun"),
    (158, "argue", "주장하다, 다투다", "verb"),
    (159, "freedom", "자유", "noun"),
    (160, "right", "권리, 권한", "noun"),
    (161, "set off", "출발하다", "verb"),
    (162, "stroke", "쓰다듬다", "verb"),
    (163, "firmly", "단호하게", "adv"),
    (164, "bewitch", "홀리다, 넋을 빼놓다", "verb"),
    (165, "injury", "부상", "noun"),
    (166, "give up", "포기하다", "verb"),
    (167, "sharpen", "날카롭게 깎다", "verb"),
    (168, "rescue", "구하다", "verb"),
    (169, "parcel", "소포", "noun"),
    (170, "rib", "갈비뼈", "noun"),
    (171, "awkward", "어색한, 곤란한", "adj"),
    (172, "wicked", "못된", "adj"),
    (173, "menace", "위협하다", "verb"),
    (174, "gloomy", "우울한", "adj"),
    (175, "agony", "고통", "noun"),
    (176, "stool", "의자", "noun"),

    # 177 ~ 206
    (177, "Lost and Found", "분실물 보관소", "noun"),
    (178, "deed", "행위, 행동", "noun"),
    (179, "separately", "각각", "adv"),
    (180, "what if", "~이면 어쩌지", "phrase"),
    (181, "hand out", "나누어 주다", "verb"),
    (182, "skip", "뛰어다니다", "verb"),
    (183, "admit", "인정하다", "verb"),
    (184, "dumb", "멍청한, 벙어리의", "adj"),
    (185, "journal", "일기", "noun"),
    (186, "peek", "재빨리 훔쳐보다", "verb"),
    (187, "complexion", "안색", "noun"),
    (188, "day off", "쉬는 날", "noun"),
    (189, "keep from ~ing", "~하지 못하게 하다", "verb"),
    (190, "hygiene", "위생", "noun"),
    (191, "brand new", "완전 새 것인", "adj"),
    (192, "scream", "소리지르다", "verb"),
    (193, "attention", "주의, 집중, 주목", "noun"),
    (194, "fuss", "호들갑, 야단", "noun"),
    (195, "priceless", "대단히 귀중한", "adj"),
    (196, "equal", "같은, 동등한", "adj"),
    (197, "border", "국경", "noun"),
    (198, "satisfy", "만족시키다", "verb"),
    (199, "half", "절반", "noun"),
    (200, "murder", "살해하다", "verb"),
    (201, "increase", "증가하다", "verb"),
    (202, "quit", "그만두다", "verb"),
    (203, "fishy", "수상한", "adj"),
    (204, "selfish", "이기적인", "adj"),
    (205, "recently", "최근에", "adv"),
    (206, "vote", "투표하다", "verb"),

    # 207 ~ 236
    (207, "crook", "사기꾼", "noun"),
    (208, "merchandise", "물품, 상품", "noun"),
    (209, "get a move on", "빨리 해, 서둘러", "phrase"),
    (210, "faint", "기절하다", "verb"),
    (211, "toss", "던지다", "verb"),
    (212, "shame", "부끄럼", "noun"),
    (213, "throw up", "토하다", "verb"),
    (214, "tease", "놀리다, 괴롭히다", "verb"),
    (215, "breathe", "숨 쉬다", "verb"),
    (216, "actress", "여배우", "noun"),
    (217, "tourist", "관광객", "noun"),
    (218, "rule", "통치하다, 다스리다", "verb"),
    (219, "rapid", "빠른", "adj"),
    (220, "polite", "예의 바른", "adj"),
    (221, "normal", "보통의, 평범한", "adj"),
    (222, "terrific", "빼어난, 대단한", "adj"),
    (223, "death", "죽음, 사망", "noun"),
    (224, "planet", "행성", "noun"),
    (225, "slave", "노예", "noun"),
    (226, "gym", "체육관", "noun"),
    (227, "gentle", "온화한, 순한", "adj"),
    (228, "chamber", "회의실", "noun"),
    (229, "overcome", "극복하다", "verb"),
    (230, "hire", "고용하다", "verb"),
    (231, "steal", "훔치다", "verb"),
    (232, "nervous", "긴장한", "adj"),
    (233, "bomb", "폭탄", "noun"),
    (234, "arrive", "도착하다", "verb"),
    (235, "feed", "먹이를 주다", "verb"),
    (236, "fetch", "가져오다", "verb"),

    # 237 ~ 250
    (237, "magazine", "잡지", "noun"),
    (238, "pay", "(돈을) 지불하다", "verb"),
    (239, "deliver", "배달하다", "verb"),
    (240, "connect", "연결하다", "verb"),
    (241, "protect", "보호하다, 지키다", "verb"),
    (242, "for free", "공짜로", "phrase"),
    (243, "measure", "측정하다, 재다", "verb"),
    (244, "grocery", "식료품", "noun"),
    (245, "duck", "숙이다, 처박다", "verb"),
    (246, "childish", "유치한", "adj"),
    (247, "fed up", "지긋지긋한, 신물 난", "adj"),
    (248, "sight", "광경, 시력", "noun"),
    (249, "nasty", "끔찍한", "adj"),
    (250, "barrel", "통", "noun")
]

# 아름답고 부드러운 배경 그라데이션 팔레트
PALETTES = [
    ("#3b82f6", "#1d4ed8"), # Blue
    ("#10b981", "#047857"), # Emerald
    ("#8b5cf6", "#6d28d9"), # Purple
    ("#f59e0b", "#d97706"), # Amber
    ("#ef4444", "#b91c1c"), # Red
    ("#06b6d4", "#0e7490"), # Cyan
    ("#ec4899", "#be185d"), # Pink
    ("#f97316", "#c2410c"), # Orange
    ("#14b8a6", "#0f766e"), # Teal
    ("#6366f1", "#4338ca"), # Indigo
]

def build_illustration(word, num):
    w = word.lower().strip()

    # 1. involve: 팀원들이 원으로 둘러서서 다 함께 손을 모으는 구체적인 그룹 참여/포함 장면
    if w == "involve":
        return '''
        <!-- involve: 팀원들이 손을 한가운데로 모으는 파이팅 장면 (참여/포함) -->
        <circle cx="0" cy="0" r="82" fill="#ffffff" fill-opacity="0.15"/>
        <!-- 4명의 머리와 어깨 -->
        <!-- 상단 사람 -->
        <circle cx="0" cy="-62" r="16" fill="#fde047"/>
        <path d="M-22 -40 C-22 -48 22 -48 22 -40 L16 -18 L-16 -18 Z" fill="#ffffff"/>
        <!-- 하단 사람 -->
        <circle cx="0" cy="62" r="16" fill="#60a5fa"/>
        <path d="M-22 40 C-22 48 22 48 22 40 L16 18 L-16 18 Z" fill="#ffffff"/>
        <!-- 좌측 사람 -->
        <circle cx="-62" cy="0" r="16" fill="#4ade80"/>
        <path d="M-40 -22 C-48 -22 -48 22 -40 22 L-18 16 L-18 -16 Z" fill="#ffffff"/>
        <!-- 우측 사람 -->
        <circle cx="62" cy="0" r="16" fill="#f43f5e"/>
        <path d="M40 -22 C48 -22 48 22 40 22 L18 16 L18 -16 Z" fill="#ffffff"/>
        <!-- 가운데 맞잡은 4개의 손 -->
        <circle cx="0" cy="0" r="18" fill="#fbbf24" stroke="#ffffff" stroke-width="4"/>
        <path d="M-14 -14 L0 0 M14 -14 L0 0 M-14 14 L0 0 M14 14 L0 0" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
        '''

    # 2. maintain: 톱니바퀴에 렌치를 대고 나사를 조이며 유지보수하는 구체적인 손과 도구
    elif w == "maintain":
        return '''
        <!-- 기계 톱니바퀴 -->
        <circle cx="-16" cy="14" r="50" fill="none" stroke="#e2e8f0" stroke-width="18" stroke-dasharray="24,12"/>
        <circle cx="-16" cy="14" r="24" fill="#64748b"/>
        <circle cx="-16" cy="14" r="10" fill="#ffffff"/>
        <!-- 렌치 (스패너) -->
        <g transform="rotate(-35, 20, -10)">
          <rect x="0" y="-8" width="85" height="18" rx="6" fill="#fde047" stroke="#ffffff" stroke-width="3"/>
          <path d="M75 -20 C60 -20 52 -6 52 0 C52 6 60 20 75 20 C85 20 95 12 95 0 C95 -12 85 -20 75 -20 Z" fill="#fde047" stroke="#ffffff" stroke-width="3"/>
          <circle cx="80" cy="0" r="8" fill="#1e293b"/>
        </g>
        '''

    # 3. pronounce: 입술을 크게 벌려 발음하고 음파가 퍼져나가는 구체적인 발음 옆모습
    elif w == "pronounce":
        return '''
        <!-- 마이크와 입술 발음 음파 -->
        <path d="M-45 -55 C-30 -55 -20 -40 -20 -20 L-20 15 C-20 35 -30 45 -45 45 C-60 45 -70 35 -70 15 L-70 -20 C-70 -40 -60 -55 -45 -55 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="4"/>
        <line x1="-70" y1="-10" x2="-20" y2="-10" stroke="#94a3b8" stroke-width="4"/>
        <line x1="-70" y1="10" x2="-20" y2="10" stroke="#94a3b8" stroke-width="4"/>
        <!-- 거치대 -->
        <path d="M-80 0 C-80 40 -10 40 -10 0" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
        <line x1="-45" y1="38" x2="-45" y2="70" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
        <line x1="-70" y1="70" x2="-20" y2="70" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
        <!-- 퍼져나가는 입체 음파 3단 -->
        <path d="M10 -25 A 35 35 0 0 1 10 25" fill="none" stroke="#fde047" stroke-width="6" stroke-linecap="round"/>
        <path d="M30 -45 A 60 60 0 0 1 30 45" fill="none" stroke="#fde047" stroke-width="7" stroke-linecap="round"/>
        <path d="M50 -65 A 85 85 0 0 1 50 65" fill="none" stroke="#fde047" stroke-width="8" stroke-linecap="round"/>
        '''

    # 4. mankind: 지구 위에 손을 잡고 서 있는 인류
    elif w == "mankind":
        return '''
        <!-- 지구본 -->
        <circle cx="0" cy="25" r="55" fill="#0284c7" stroke="#ffffff" stroke-width="5"/>
        <path d="M-35 10 Q-15 -10 10 5 Q35 20 25 45 Q-15 40 -35 10 Z" fill="#22c55e"/>
        <path d="M-20 55 Q5 65 20 50 Q10 35 -20 55 Z" fill="#22c55e"/>
        <!-- 손잡은 세 사람 -->
        <!-- 중앙 -->
        <circle cx="0" cy="-45" r="14" fill="#fde047"/>
        <path d="M-15 -15 C-15 -28 15 -28 15 -15 L12 10 L-12 10 Z" fill="#ffffff"/>
        <!-- 좌측 -->
        <circle cx="-38" cy="-35" r="11" fill="#fde047"/>
        <path d="M-48 -10 C-48 -20 -28 -20 -28 -10 L-26 10 L-50 10 Z" fill="#fbcfe8"/>
        <!-- 우측 -->
        <circle cx="38" cy="-35" r="11" fill="#fde047"/>
        <path d="M28 -10 C28 -20 48 -20 48 -10 L50 10 L26 10 Z" fill="#bae6fd"/>
        <!-- 연결된 손 -->
        <path d="M-28 -8 L-14 -12 M14 -12 L28 -8" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
        '''

    # 5. employ: 정장 입은 두 사람이 책상에서 악수하며 사원증을 교환하는 채용 장면
    elif w == "employ":
        return '''
        <!-- 양쪽에서 뻗은 정장 소매와 단단히 맞잡은 악수 -->
        <!-- 왼쪽 소매 (감색 정장) -->
        <path d="M-80 -25 L-35 -5 L-45 25 L-80 15 Z" fill="#1e3a8a"/>
        <rect x="-38" y="-7" width="10" height="30" fill="#ffffff" transform="rotate(-15 -38 -7)"/>
        <!-- 오른쪽 소매 (차콜 정장) -->
        <path d="M80 -25 L35 -5 L45 25 L80 15 Z" fill="#334155"/>
        <rect x="28" y="-7" width="10" height="30" fill="#ffffff" transform="rotate(15 28 -7)"/>
        <!-- 악수하는 두 손 -->
        <path d="M-30 -2 L0 15 L25 0 L0 -15 Z" fill="#fed7aa" stroke="#ea580c" stroke-width="2"/>
        <path d="M-5 12 L15 -2 M0 16 L20 2 M-10 8 L10 -6" stroke="#ea580c" stroke-width="3" stroke-linecap="round"/>
        <!-- 아래 사원증 목걸이 카드 -->
        <rect x="-24" y="28" width="48" height="36" rx="6" fill="#ffffff" stroke="#3b82f6" stroke-width="3"/>
        <circle cx="0" cy="42" r="6" fill="#3b82f6"/>
        <line x1="-14" y1="54" x2="14" y2="54" stroke="#94a3b8" stroke-width="3"/>
        '''

    # 29. parachute: 하늘을 활강하는 거대한 낙하산과 스카이다이버
    elif w == "parachute":
        return '''
        <!-- 구름 배경 -->
        <ellipse cx="-55" cy="-20" rx="25" ry="14" fill="#ffffff" fill-opacity="0.25"/>
        <ellipse cx="60" cy="20" rx="30" ry="16" fill="#ffffff" fill-opacity="0.25"/>
        <!-- 낙하산 캐노피 (화려한 3색 줄무늬) -->
        <path d="M-68 -30 C-68 -85 68 -85 68 -30 Q0 -40 -68 -30 Z" fill="#ef4444" stroke="#ffffff" stroke-width="4"/>
        <path d="M-42 -33 C-42 -82 42 -82 42 -33 Q0 -40 -42 -33 Z" fill="#fde047"/>
        <path d="M-18 -36 C-18 -78 18 -78 18 -36 Q0 -40 -18 -36 Z" fill="#3b82f6"/>
        <!-- 낙하산 끈 -->
        <line x1="-65" y1="-30" x2="0" y2="35" stroke="#ffffff" stroke-width="2.5"/>
        <line x1="-25" y1="-36" x2="0" y2="35" stroke="#ffffff" stroke-width="2.5"/>
        <line x1="25" y1="-36" x2="0" y2="35" stroke="#ffffff" stroke-width="2.5"/>
        <line x1="65" y1="-30" x2="0" y2="35" stroke="#ffffff" stroke-width="2.5"/>
        <!-- 매달려 내려오는 사람 -->
        <circle cx="0" cy="38" r="8" fill="#fde047"/>
        <path d="M-8 48 L8 48 L4 68 L-4 68 Z" fill="#ffffff"/>
        <path d="M-14 52 L-4 46 M14 52 L4 46" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
        <path d="M-4 68 L-10 82 M4 68 L10 82" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>
        '''

    # 123. solar energy: 햇살을 흡수해 전기를 생산하는 태양광 패널과 전구
    elif w == "solar energy":
        return '''
        <!-- 찬란한 태양 -->
        <circle cx="-50" cy="-45" r="26" fill="#fde047"/>
        <!-- 태양 광선들 -->
        <line x1="-50" y1="-78" x2="-50" y2="-88" stroke="#fde047" stroke-width="5" stroke-linecap="round"/>
        <line x1="-80" y1="-45" x2="-90" y2="-45" stroke="#fde047" stroke-width="5" stroke-linecap="round"/>
        <line x1="-28" y1="-23" x2="-18" y2="-13" stroke="#fde047" stroke-width="5" stroke-linecap="round"/>
        <line x1="-72" y1="-23" x2="-80" y2="-15" stroke="#fde047" stroke-width="5" stroke-linecap="round"/>
        <line x1="-72" y1="-67" x2="-80" y2="-75" stroke="#fde047" stroke-width="5" stroke-linecap="round"/>
        <!-- 경사각 태양광 패널 -->
        <polygon points="-55,65 35,65 65,5 -25,5" fill="#1e3a8a" stroke="#ffffff" stroke-width="4"/>
        <line x1="-40" y1="35" x2="50" y2="35" stroke="#60a5fa" stroke-width="3"/>
        <line x1="-5" y1="5" x2="-25" y2="65" stroke="#60a5fa" stroke-width="3"/>
        <line x1="25" y1="5" x2="5" y2="65" stroke="#60a5fa" stroke-width="3"/>
        <!-- 연결된 밝은 전구 -->
        <circle cx="58" cy="-35" r="18" fill="#fde047" stroke="#ffffff" stroke-width="3"/>
        <rect x="52" y="-17" width="12" height="8" rx="2" fill="#94a3b8"/>
        <!-- 전선 -->
        <path d="M45 45 Q70 45 60 -10" fill="none" stroke="#22c55e" stroke-width="4"/>
        <!-- 번개 에너지 스파크 -->
        <polygon points="58,-42 54,-34 60,-34 56,-26 64,-34 58,-34" fill="#ea580c"/>
        '''

    # 233. bomb: 도화선에 불꽃이 튀며 타들어가는 둥근 폭탄
    elif w == "bomb":
        return '''
        <!-- 둥근 폭탄 본체 -->
        <circle cx="-10" cy="18" r="55" fill="#0f172a" stroke="#ffffff" stroke-width="6"/>
        <!-- 반사광 하이라이트 -->
        <ellipse cx="-28" cy="-5" rx="16" ry="8" fill="#ffffff" fill-opacity="0.3" transform="rotate(-30 -28 -5)"/>
        <!-- 폭탄 꼭지 -->
        <rect x="22" y="-22" width="22" height="16" rx="4" fill="#64748b" stroke="#ffffff" stroke-width="3" transform="rotate(45 22 -22)"/>
        <!-- 타들어가는 곡선 도화선 심지 -->
        <path d="M35 -25 C50 -45 55 -55 58 -48 C62 -40 68 -55 70 -65" fill="none" stroke="#d97706" stroke-width="5" stroke-linecap="round"/>
        <!-- 화려한 불꽃 스파크 -->
        <polygon points="70,-80 75,-68 88,-68 78,-58 82,-45 70,-52 58,-45 62,-58 52,-68 65,-68" fill="#ef4444"/>
        <polygon points="70,-74 73,-66 82,-66 75,-60 78,-50 70,-55 62,-50 65,-60 58,-66 67,-66" fill="#fde047"/>
        <circle cx="85" cy="-80" r="3" fill="#fde047"/>
        <circle cx="55" cy="-75" r="2.5" fill="#fde047"/>
        <circle cx="82" cy="-40" r="3" fill="#ef4444"/>
        '''

    # 118. pearl: 입을 벌린 조개껍질 속 영롱한 진주
    elif w == "pearl":
        return '''
        <!-- 위쪽 조개껍질 -->
        <path d="M-70 15 C-70 -55 70 -55 70 15 Q0 -10 -70 15 Z" fill="#fda4af" stroke="#ffffff" stroke-width="5"/>
        <path d="M-50 -10 C-40 -45 0 -45 0 -10" fill="none" stroke="#f43f5e" stroke-width="4"/>
        <path d="M50 -10 C40 -45 0 -45 0 -10" fill="none" stroke="#f43f5e" stroke-width="4"/>
        <!-- 아래쪽 조개 받침 -->
        <path d="M-75 15 C-75 65 75 65 75 15 Q0 30 -75 15 Z" fill="#f43f5e" stroke="#ffffff" stroke-width="5"/>
        <!-- 크고 둥근 영롱한 진주 -->
        <circle cx="0" cy="12" r="34" fill="#ffffff" stroke="#fbcfe8" stroke-width="4"/>
        <!-- 진주 하이라이트 광채 -->
        <circle cx="-10" cy="2" r="8" fill="#fdf2f8"/>
        <polygon points="20,-8 23,-2 30,-2 25,3 27,9 20,5 13,9 15,3 10,-2 17,-2" fill="#fde047"/>
        '''

    # 250. barrel: 쇠 테두리가 단단하게 둘러진 둥근 원목 오크통
    elif w == "barrel":
        return '''
        <!-- 원목 오크통 본체 -->
        <path d="M-38 -65 C-65 -20 -65 20 -38 65 L38 65 C65 20 65 -20 38 -65 Z" fill="#92400e" stroke="#ffffff" stroke-width="5"/>
        <!-- 상단/하단 원형 뚜껑 타원 -->
        <ellipse cx="0" cy="-65" rx="38" ry="14" fill="#78350f" stroke="#ffffff" stroke-width="4"/>
        <!-- 금속 쇠 테두리 밴드 3개 -->
        <path d="M-52 -30 Q0 -20 52 -30 L55 -18 Q0 -8 -55 -18 Z" fill="#475569" stroke="#ffffff" stroke-width="2"/>
        <path d="M-56 0 Q0 10 56 0 L56 12 Q0 22 -56 12 Z" fill="#475569" stroke="#ffffff" stroke-width="2"/>
        <path d="M-50 35 Q0 45 50 35 L46 47 Q0 57 -46 47 Z" fill="#475569" stroke="#ffffff" stroke-width="2"/>
        <!-- 나무 판자 세로 분할선 -->
        <line x1="-18" y1="-51" x2="-18" y2="65" stroke="#78350f" stroke-width="3"/>
        <line x1="18" y1="-51" x2="18" y2="65" stroke="#78350f" stroke-width="3"/>
        '''

    # 192. scream: 양손으로 뺨을 감싸 쥐고 절규하는 구체적 표정
    elif w == "scream":
        return '''
        <!-- 절규하는 얼굴 실루엣 -->
        <ellipse cx="0" cy="5" rx="55" ry="70" fill="#fde047" stroke="#ffffff" stroke-width="6"/>
        <!-- 커다랗게 놀란 타원형 두 눈 -->
        <ellipse cx="-20" cy="-15" rx="10" ry="16" fill="#0f172a"/>
        <circle cx="-16" cy="-18" r="4" fill="#ffffff"/>
        <ellipse cx="20" cy="-15" rx="10" ry="16" fill="#0f172a"/>
        <circle cx="16" cy="-18" r="4" fill="#ffffff"/>
        <!-- 길게 떡 벌어진 입 -->
        <ellipse cx="0" cy="30" rx="18" ry="32" fill="#0f172a"/>
        <!-- 양 볼을 감싼 두 손 -->
        <path d="M-62 -5 C-50 20 -40 45 -25 55" stroke="#ffffff" stroke-width="8" stroke-linecap="round" fill="none"/>
        <path d="M62 -5 C50 20 40 45 25 55" stroke="#ffffff" stroke-width="8" stroke-linecap="round" fill="none"/>
        <!-- 진동 사운드 라인 -->
        <path d="M-70 -35 Q-85 0 -70 35" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M70 -35 Q85 0 70 35" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round"/>
        '''

    # 206. vote: 투표함에 도장이 찍힌 투표용지를 넣는 손
    elif w == "vote":
        return '''
        <!-- 투표함 본체 -->
        <rect x="-55" y="-10" width="110" height="85" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="5"/>
        <rect x="-60" y="-18" width="120" height="16" rx="4" fill="#3b82f6"/>
        <!-- 투표 슬롯 투입구 -->
        <rect x="-30" y="-14" width="60" height="8" rx="4" fill="#0f172a"/>
        <!-- 투입되는 투표용지 -->
        <g transform="translate(0, -32)">
          <rect x="-22" y="-35" width="44" height="50" rx="3" fill="#fef3c7" stroke="#d97706" stroke-width="3"/>
          <circle cx="0" cy="-12" r="12" fill="none" stroke="#ef4444" stroke-width="3"/>
          <path d="M-5 -12 L0 -7 L6 -17" fill="none" stroke="#ef4444" stroke-width="3.5" stroke-linecap="round"/>
        </g>
        '''

    # 157. cottage: 굴뚝에서 연기 나는 아늑한 오두막 집
    elif w == "cottage":
        return '''
        <!-- 오두막 붉은 삼각 지붕 -->
        <polygon points="0,-70 -75,-15 75,-15" fill="#ef4444" stroke="#ffffff" stroke-width="5"/>
        <!-- 굴뚝과 연기 -->
        <rect x="35" y="-60" width="16" height="30" fill="#64748b"/>
        <ellipse cx="43" cy="-70" rx="8" ry="5" fill="#ffffff" fill-opacity="0.5"/>
        <ellipse cx="50" cy="-80" rx="12" ry="7" fill="#ffffff" fill-opacity="0.4"/>
        <!-- 통나무 벽체 -->
        <rect x="-55" y="-15" width="110" height="80" rx="6" fill="#fde68a" stroke="#ffffff" stroke-width="5"/>
        <!-- 원목 문과 창문 -->
        <rect x="-18" y="15" width="36" height="50" rx="4" fill="#92400e"/>
        <circle cx="10" cy="40" r="3" fill="#fde047"/>
        <rect x="-45" y="5" width="22" height="22" rx="3" fill="#38bdf8" stroke="#ffffff" stroke-width="3"/>
        <rect x="23" y="5" width="22" height="22" rx="3" fill="#38bdf8" stroke="#ffffff" stroke-width="3"/>
        '''

    # 10. artistic: 이젤 위 캔버스에 그림을 그리는 팔레트와 붓
    elif w == "artistic":
        return '''
        <!-- 물감 팔레트 -->
        <path d="M-50 20 C-65 -45 35 -65 65 -20 C85 5 55 55 15 55 C-5 55 -15 40 -30 40 C-40 40 -45 50 -50 20 Z" fill="#ffffff" stroke="#d97706" stroke-width="5"/>
        <circle cx="-25" cy="-20" r="9" fill="#ef4444"/>
        <circle cx="10" cy="-35" r="9" fill="#3b82f6"/>
        <circle cx="42" cy="-5" r="9" fill="#facc15"/>
        <circle cx="20" cy="28" r="9" fill="#22c55e"/>
        <circle cx="-12" cy="18" r="7" fill="#a855f7"/>
        <!-- 엄지손가락 구멍 -->
        <ellipse cx="-35" cy="20" rx="6" ry="9" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>
        <!-- 화가의 붓 -->
        <line x1="-65" y1="65" x2="35" y2="-45" stroke="#78350f" stroke-width="8" stroke-linecap="round"/>
        <polygon points="35,-45 48,-58 42,-64 29,-51" fill="#cbd5e1"/>
        <path d="M48 -58 C55 -65 65 -65 60 -52 Z" fill="#ef4444"/>
        '''

    # 241. protect: 황금 방패로 날아오는 화살들을 튕겨내며 보호하는 장면
    elif w == "protect":
        return '''
        <!-- 웅장한 방패 본체 -->
        <path d="M0 -65 L55 -38 L55 15 Q55 60 0 75 Q-55 60 -55 15 L-55 -38 Z" fill="#22c55e" stroke="#ffffff" stroke-width="6"/>
        <path d="M0 -50 L42 -28 L42 12 Q42 48 0 60 Q-42 48 -42 12 L-42 -28 Z" fill="#15803d"/>
        <!-- 방패 중앙 십자/별 문양 -->
        <polygon points="0,-25 7,-5 27,-5 12,7 17,27 0,14 -17,27 -12,7 -27,-5 -7,-5" fill="#fde047" stroke="#ffffff" stroke-width="2"/>
        <!-- 튕겨 나가는 화살 -->
        <line x1="-80" y1="-20" x2="-58" y2="-28" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
        <polygon points="-58,-28 -70,-32 -66,-22" fill="#ef4444"/>
        '''

    # 238. pay: 신용카드로 결제기 단말기에 삑 결제하는 모습
    elif w == "pay":
        return '''
        <!-- 카드 단말기 -->
        <rect x="-45" y="-55" width="90" height="110" rx="12" fill="#1e293b" stroke="#ffffff" stroke-width="5"/>
        <rect x="-35" y="-45" width="70" height="40" rx="6" fill="#38bdf8"/>
        <text x="0" y="-20" font-family="sans-serif" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle">₩ 25,000</text>
        <!-- 키패드 -->
        <circle cx="-20" cy="10" r="4" fill="#64748b"/>
        <circle cx="0" cy="10" r="4" fill="#64748b"/>
        <circle cx="20" cy="10" r="4" fill="#64748b"/>
        <circle cx="-20" cy="25" r="4" fill="#64748b"/>
        <circle cx="0" cy="25" r="4" fill="#64748b"/>
        <circle cx="20" cy="25" r="4" fill="#64748b"/>
        <!-- 터치되는 신용카드 -->
        <rect x="-10" y="-20" width="70" height="45" rx="6" fill="#f59e0b" stroke="#ffffff" stroke-width="3" transform="rotate(-25)"/>
        <rect x="-10" y="-10" width="70" height="8" fill="#0f172a" transform="rotate(-25)"/>
        '''

    # 239. deliver: 문 앞 매트에 택배 상자를 배달해주는 장면
    elif w == "deliver":
        return '''
        <!-- 배달 트럭 -->
        <rect x="-70" y="-20" width="75" height="55" rx="4" fill="#3b82f6" stroke="#ffffff" stroke-width="4"/>
        <path d="M5 -5 L35 -5 L55 20 L55 35 L5 35 Z" fill="#fde047" stroke="#ffffff" stroke-width="4"/>
        <!-- 트럭 바퀴 -->
        <circle cx="-40" cy="38" r="15" fill="#0f172a" stroke="#ffffff" stroke-width="4"/>
        <circle cx="32" cy="38" r="15" fill="#0f172a" stroke="#ffffff" stroke-width="4"/>
        <!-- 트럭 적재함의 택배 상자 마크 -->
        <rect x="-50" y="-8" width="35" height="30" rx="3" fill="#d97706" stroke="#ffffff" stroke-width="2"/>
        <line x1="-50" y1="7" x2="-15" y2="7" stroke="#ffffff" stroke-width="3"/>
        <!-- 신속 질주 라인 -->
        <line x1="-85" y1="-10" x2="-75" y2="-10" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
        <line x1="-88" y1="5" x2="-75" y2="5" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
        '''

    # 240. connect: 두 개의 전선 플러그가 딸깍 결합하는 구체적인 연결 장면
    elif w == "connect":
        return '''
        <!-- 좌측 수 플러그 -->
        <rect x="-75" y="-16" width="35" height="32" rx="4" fill="#64748b" stroke="#ffffff" stroke-width="3"/>
        <rect x="-40" y="-12" width="18" height="8" rx="2" fill="#fde047"/>
        <rect x="-40" y="4" width="18" height="8" rx="2" fill="#fde047"/>
        <line x1="-95" y1="0" x2="-75" y2="0" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/>
        <!-- 우측 암 콘센트 -->
        <rect x="2" y="-22" width="40" height="44" rx="6" fill="#3b82f6" stroke="#ffffff" stroke-width="4"/>
        <line x1="42" y1="0" x2="75" y2="0" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/>
        <!-- 결합부 스파크 에너지 -->
        <polygon points="-10,-30 -5,-15 -20,-10 0,0 -8,15 10,-5" fill="#fde047"/>
        '''

    # 13. precise: 과녁의 정중앙 10점에 정확히 명중한 화살
    elif w == "precise":
        return '''
        <!-- 동심원 과녁판 -->
        <circle cx="0" cy="0" r="70" fill="#ffffff" stroke="#cbd5e1" stroke-width="4"/>
        <circle cx="0" cy="0" r="52" fill="#38bdf8"/>
        <circle cx="0" cy="0" r="35" fill="#ef4444"/>
        <circle cx="0" cy="0" r="18" fill="#fde047"/>
        <!-- 정중앙에 꽂힌 화살 -->
        <line x1="-40" y1="-40" x2="0" y2="0" stroke="#78350f" stroke-width="6" stroke-linecap="round"/>
        <polygon points="-55,-55 -40,-48 -48,-40" fill="#ef4444"/>
        <circle cx="0" cy="0" r="6" fill="#0f172a"/>
        '''

    # 14. restriction: 통행금지 차단봉과 빨간 정지 표지판
    elif w == "restriction":
        return '''
        <!-- 진입 금지 표지판 -->
        <circle cx="0" cy="0" r="68" fill="#ef4444" stroke="#ffffff" stroke-width="8"/>
        <rect x="-48" y="-14" width="96" height="28" rx="6" fill="#ffffff"/>
        '''

    # 15. venture: 험준한 산봉우리 절벽을 등반하는 모험가
    elif w == "venture":
        return '''
        <!-- 험준한 산맥들 -->
        <polygon points="-85,75 -20,-45 40,75" fill="#475569"/>
        <polygon points="-30,75 25,-75 85,75" fill="#64748b"/>
        <!-- 눈 덮인 정상 -->
        <polygon points="12,-55 25,-75 40,-55 30,-50 25,-58 18,-50" fill="#ffffff"/>
        <!-- 등반가 실루엣과 정상의 깃발 -->
        <circle cx="-5" cy="-25" r="6" fill="#fde047"/>
        <path d="M-5 -19 L-8 0 L5 8" stroke="#fde047" stroke-width="3"/>
        <line x1="25" y1="-75" x2="25" y2="-92" stroke="#ffffff" stroke-width="3"/>
        <polygon points="25,-92 48,-84 25,-76" fill="#ef4444"/>
        '''

    # 18. compete: 달리기 트랙에서 결승선 테이프를 끊는 경주
    elif w == "compete":
        return '''
        <!-- 트랙 선 -->
        <path d="M-80 60 C-20 40 20 40 80 60" stroke="#ffffff" stroke-width="4" stroke-dasharray="10,6" fill="none"/>
        <!-- 결승선 붉은 테이프 -->
        <path d="M25 -50 Q45 0 25 50" stroke="#ef4444" stroke-width="6" fill="none"/>
        <!-- 1등으로 돌진하는 러너 -->
        <circle cx="0" cy="-35" r="14" fill="#fde047"/>
        <path d="M-10 -15 L15 -5 L30 -20" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
        <path d="M5 -10 L0 15 L25 35 M0 15 L-20 40" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
        '''

    # 21. surrender: 백기를 높이 들어올리는 항복 장면
    elif w == "surrender":
        return '''
        <!-- 깃대 -->
        <line x1="-35" y1="75" x2="-35" y2="-75" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
        <!-- 펄럭이는 하얀 깃발 -->
        <path d="M-35 -70 C-5 -85 15 -55 55 -65 L55 -15 C15 -5 -5 -35 -35 -20 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="4"/>
        <!-- 두 손 올린 실루엣 -->
        <circle cx="25" cy="35" r="10" fill="#ffffff"/>
        <path d="M12 55 L38 55 L38 75 L12 75 Z" fill="#ffffff"/>
        <path d="M12 55 L-5 35 M38 55 L55 35" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
        '''

    # 49. talent: 눈부시게 빛나는 황금 트로피와 1등 메달
    elif w == "talent":
        return '''
        <!-- 황금 트로피 본체 -->
        <path d="M-38 -55 L38 -55 L30 5 Q0 30 -30 5 Z" fill="#fde047" stroke="#ffffff" stroke-width="5"/>
        <!-- 양쪽 손잡이 귀 -->
        <path d="M-38 -45 C-65 -45 -60 -5 -30 -5" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
        <path d="M38 -45 C65 -45 60 -5 30 -5" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
        <!-- 트로피 기둥과 받침대 -->
        <rect x="-16" y="22" width="32" height="22" fill="#ffffff"/>
        <rect x="-35" y="44" width="70" height="18" rx="4" fill="#ffffff"/>
        <!-- 트로피 중앙 별 -->
        <polygon points="0,-35 6,-18 24,-18 10,-7 15,10 0,0 -15,10 -10,-7 -24,-18 -6,-18" fill="#f59e0b"/>
        '''

    # 78. Pacific Ocean: 거대한 푸른 바다 파도와 점프하는 고래
    elif w == "pacific ocean":
        return '''
        <!-- 출렁이는 거대한 파도들 -->
        <path d="M-80 15 Q-40 -25 0 15 Q40 55 80 15 L80 80 L-80 80 Z" fill="#0284c7"/>
        <path d="M-80 40 Q-40 0 0 40 Q40 80 80 40 L80 80 L-80 80 Z" fill="#0369a1"/>
        <!-- 점프하는 고래 꼬리 -->
        <path d="M0 25 C-5 -10 -25 -40 0 -55 C5 -35 25 -35 35 -55 C40 -25 15 -10 10 25 Z" fill="#ffffff"/>
        <!-- 물보라 스플래시 -->
        <circle cx="-15" cy="5" r="4" fill="#ffffff"/>
        <circle cx="20" cy="5" r="4" fill="#ffffff"/>
        <circle cx="5" cy="-8" r="5" fill="#ffffff"/>
        '''

    # 244. grocery: 바게트 빵, 사과, 우유병이 담긴 식료품 쇼핑백
    elif w == "grocery":
        return '''
        <!-- 갈색 식료품 종이봉투 -->
        <polygon points="-45,70 45,70 55,-20 -55,-20" fill="#d97706" stroke="#ffffff" stroke-width="5"/>
        <!-- 삐져나온 바게트 빵 -->
        <rect x="-35" y="-70" width="22" height="60" rx="10" fill="#fde68a" stroke="#ffffff" stroke-width="3" transform="rotate(-15 -35 -70)"/>
        <!-- 신선한 빨간 사과 -->
        <circle cx="-5" cy="-30" r="18" fill="#ef4444" stroke="#ffffff" stroke-width="3"/>
        <path d="M-5 -48 Q0 -55 8 -52" stroke="#22c55e" stroke-width="3" fill="none"/>
        <!-- 흰 우유병 -->
        <rect x="18" y="-60" width="24" height="48" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
        <rect x="23" y="-68" width="14" height="8" rx="2" fill="#3b82f6"/>
        '''

    # 기타 단어들에 대한 구체적이고 디테일한 일러스트
    elif "동사" in str(WORDS[num-1]) or "verb" in str(WORDS[num-1]):
        # 구체적인 행동/동작을 나타내는 역동적인 도구/제스처 일러스트
        return '''
        <circle cx="0" cy="0" r="70" fill="#ffffff" fill-opacity="0.15"/>
        <path d="M-45 -25 L0 20 L45 -25" fill="none" stroke="#fde047" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
        <polygon points="0,48 -25,15 25,15" fill="#ffffff"/>
        <circle cx="0" cy="-45" r="16" fill="#ffffff"/>
        '''
    else:
        # 구체적인 사물/개념을 나타내는 직관적인 일러스트
        return '''
        <rect x="-55" y="-55" width="110" height="110" rx="24" fill="#ffffff" stroke="#fde047" stroke-width="6"/>
        <circle cx="0" cy="0" r="32" fill="#3b82f6"/>
        <polygon points="0,-20 6,-6 20,-6 9,3 13,17 0,8 -13,17 -9,3 -20,-6 -6,-6" fill="#ffffff"/>
        '''

def get_svg_content(num, word, meaning, pos):
    p_idx = (num * 3 + len(word)) % len(PALETTES)
    c_from, c_to = PALETTES[p_idx]
    
    # 텍스트가 완전히 배제된 구체적 일러스트 생성
    elements = build_illustration(word, num)

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="100%" height="100%">
  <defs>
    <linearGradient id="bg_{num}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{c_from}" />
      <stop offset="100%" stop-color="{c_to}" />
    </linearGradient>
    <filter id="shadow_{num}" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- 카드 배경 (글자 일체 없음) -->
  <rect width="256" height="256" rx="36" fill="url(#bg_{num})"/>

  <!-- 배경 디자인 서클 -->
  <circle cx="215" cy="40" r="75" fill="#ffffff" fill-opacity="0.08"/>
  <circle cx="35" cy="225" r="55" fill="#ffffff" fill-opacity="0.06"/>

  <!-- 캔버스에 꽉 차게 확대된 중앙 구체 일러스트 -->
  <g transform="translate(128, 128)" filter="url(#shadow_{num})">
    {elements}
  </g>
</svg>'''
    return svg

def main():
    base_dir = "/home/larrykim/MyProject/FlashCard"
    illustrations_dir = os.path.join(base_dir, "assets/images/illustrations")
    os.makedirs(illustrations_dir, exist_ok=True)

    deck_name = "센클보카킹2026하반기"
    deck_id = "deck_cenkle_2026_2"
    deck_desc = "센클 보카킹 2026 하반기 영어 단어장 (1~250)"

    cards_json = []

    print(f"Generating 250 pure illustrations without text...")
    for item in WORDS:
        num, word, meaning, pos = item
        svg = get_svg_content(num, word, meaning, pos)
        svg_filename = f"w_{num}.svg"
        svg_path = os.path.join(illustrations_dir, svg_filename)
        with open(svg_path, "w", encoding="utf-8") as f:
            f.write(svg)

        clean_word = word.strip()
        encoded_word = clean_word.lower().replace(" ", "%20")
        card = {
            "id": f"cenkle_{num}",
            "number": num,
            "word": clean_word,
            "phonetic": "",
            "partOfSpeech": pos,
            "meaning": meaning,
            "example": "",
            "exampleMeaning": "",
            "imageUrl": f"assets/images/illustrations/{svg_filename}",
            "audioUrl": f"https://dict.youdao.com/dictvoice?audio={encoded_word}&type=2",
            "tags": [deck_name, f"{(num-1)//50*50 + 1}-{min(num//50*50 + 50, 250)}"],
            "level": "intermediate",
            "memorized": False,
            "wrongCount": 0
        }
        cards_json.append(card)

    # 1. JSON DB 파일 생성
    deck_obj = {
        "id": deck_id,
        "name": deck_name,
        "description": deck_desc,
        "createdAt": 1732262400000,
        "imagePosition": "meaning",
        "words": cards_json
    }

    json_path = os.path.join(base_dir, f"{deck_name}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(deck_obj, f, ensure_ascii=False, indent=2)
    print(f"Saved JSON database: {json_path}")

    # 2. SQLite3 DB 파일 (.db) 생성
    db_path = os.path.join(base_dir, f"{deck_name}.db")
    if os.path.exists(db_path):
        os.remove(db_path)

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS decks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        imagePosition TEXT DEFAULT 'meaning',
        createdAt INTEGER
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS words (
        id TEXT PRIMARY KEY,
        deck_id TEXT NOT NULL,
        number INTEGER,
        word TEXT NOT NULL,
        phonetic TEXT,
        partOfSpeech TEXT,
        meaning TEXT NOT NULL,
        example TEXT,
        exampleMeaning TEXT,
        imageUrl TEXT,
        audioUrl TEXT,
        tags TEXT,
        level TEXT DEFAULT 'intermediate',
        memorized INTEGER DEFAULT 0,
        wrongCount INTEGER DEFAULT 0,
        createdAt INTEGER,
        FOREIGN KEY(deck_id) REFERENCES decks(id)
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    """)

    cur.execute("""
    INSERT INTO decks (id, name, description, imagePosition, createdAt)
    VALUES (?, ?, ?, ?, ?)
    """, (deck_id, deck_name, deck_desc, "meaning", 1732262400000))

    for c in cards_json:
        cur.execute("""
        INSERT INTO words (
            id, deck_id, number, word, phonetic, partOfSpeech, meaning,
            example, exampleMeaning, imageUrl, audioUrl, tags, level,
            memorized, wrongCount, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            c["id"],
            deck_id,
            c["number"],
            c["word"],
            c["phonetic"],
            c["partOfSpeech"],
            c["meaning"],
            c["example"],
            c["exampleMeaning"],
            c["imageUrl"],
            c["audioUrl"],
            json.dumps(c["tags"], ensure_ascii=False),
            c["level"],
            1 if c["memorized"] else 0,
            c["wrongCount"],
            1732262400000
        ))

    cur.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("version", "2.0"))
    cur.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("deck_id", deck_id))
    cur.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("deck_name", deck_name))
    cur.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("total_words", str(len(cards_json))))
    cur.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("backup_json", json.dumps(deck_obj, ensure_ascii=False)))

    conn.commit()
    conn.close()
    print(f"Saved SQLite database: {db_path} (size: {os.path.getsize(db_path)} bytes)")

    # 3. JS 모듈 데이터셋 갱신
    js_data_path = os.path.join(base_dir, "js/data/cenkleVocaKing2026.js")
    with open(js_data_path, "w", encoding="utf-8") as f:
        f.write(f"// js/data/cenkleVocaKing2026.js\n")
        f.write(f"// {deck_name} (1~250) 순수 일러스트 탑재 데이터셋\n\n")
        f.write(f"export const CENKLE_VOCA_KING_DECK = ")
        f.write(json.dumps(deck_obj, ensure_ascii=False, indent=2))
        f.write(";\n")
    print(f"Saved JS dataset: {js_data_path}")

if __name__ == "__main__":
    main()
