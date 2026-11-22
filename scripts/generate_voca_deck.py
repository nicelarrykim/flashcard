# scripts/generate_voca_deck.py
import os
import json
import sqlite3
import html

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

# SVG 디자인 테마 색상 (gradient from, to, accent)
PALETTES = [
    ("#4f46e5", "#7c3aed", "#e0e7ff"), # Indigo-Purple
    ("#0284c7", "#2563eb", "#e0f2fe"), # Sky-Blue
    ("#059669", "#10b981", "#d1fae5"), # Emerald
    ("#d97706", "#f59e0b", "#fef3c7"), # Amber
    ("#dc2626", "#ef4444", "#fee2e2"), # Red
    ("#7c2d12", "#c2410c", "#ffedd5"), # Orange-Brown
    ("#4c1d95", "#9333ea", "#f3e8ff"), # Violet
    ("#0f766e", "#14b8a6", "#ccfbf1"), # Teal
    ("#be185d", "#ec4899", "#fce7f3"), # Pink
    ("#374151", "#4b5563", "#f3f4f6"), # Slate
]

def generate_illustration_elements(num, word, meaning):
    w = word.lower().strip()
    
    # 특정 단어별 상징 일러스트
    if w == "involve":
        return '<circle cx="-18" cy="0" r="32" fill="none" stroke="#ffffff" stroke-width="8"/><circle cx="18" cy="0" r="32" fill="none" stroke="#fde047" stroke-width="8"/>'
    elif w == "maintain":
        return '<path d="M0 -38 L32 -22 L32 10 Q32 38 0 46 Q-32 38 -32 10 L-32 -22 Z" fill="#ffffff" fill-opacity="0.25" stroke="#ffffff" stroke-width="5"/><path d="M-12 2 L-2 12 L16 -8" fill="none" stroke="#4ade80" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'
    elif w == "pronounce":
        return '<rect x="-14" y="-28" width="28" height="42" rx="14" fill="#ffffff"/><path d="M-24 -6 C-24 16 24 16 24 -6" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/><line x1="0" y1="16" x2="0" y2="34" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/><line x1="-16" y1="34" x2="16" y2="34" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/><path d="M34 -16 A 26 26 0 0 1 34 16" fill="none" stroke="#fde047" stroke-width="4" stroke-linecap="round"/>'
    elif w == "mankind":
        return '<circle cx="0" cy="-22" r="14" fill="#fde047"/><path d="M-22 28 C-22 6 -6 4 0 4 C6 4 22 6 22 28" fill="#ffffff"/><circle cx="-34" cy="-12" r="10" fill="#ffffff" fill-opacity="0.8"/><path d="M-48 28 C-48 12 -36 10 -32 10 C-30 14 -30 20 -30 28" fill="#ffffff" fill-opacity="0.8"/><circle cx="34" cy="-12" r="10" fill="#ffffff" fill-opacity="0.8"/><path d="M48 28 C48 12 36 10 32 10 C30 14 30 20 30 28" fill="#ffffff" fill-opacity="0.8"/>'
    elif w == "employ":
        return '<path d="M-44 -12 L-20 6 L-6 -6 L-18 -22 Z" fill="#ffffff"/><path d="M44 -12 L20 6 L6 -6 L18 -22 Z" fill="#fde047"/><rect x="-18" y="-4" width="36" height="24" rx="8" fill="#ffffff"/><line x1="-8" y1="2" x2="8" y2="2" stroke="#3b82f6" stroke-width="3"/><line x1="-8" y1="10" x2="8" y2="10" stroke="#3b82f6" stroke-width="3"/>'
    elif w == "expectation":
        return '<rect x="-28" y="-10" width="56" height="44" rx="6" fill="#fde047"/><rect x="-32" y="-20" width="64" height="12" rx="4" fill="#fbbf24"/><line x1="0" y1="-20" x2="0" y2="34" stroke="#ffffff" stroke-width="6"/><path d="M0 -20 C-14 -36 -28 -20 0 -20 C28 -20 14 -36 0 -20" fill="#ef4444"/>'
    elif w == "digest":
        return '<path d="M-6 -36 C18 -36 34 -18 32 8 C30 34 2 40 -16 26 C-30 14 -28 -14 -6 -36 Z" fill="#fda4af" stroke="#ffffff" stroke-width="5"/><circle cx="2" cy="0" r="5" fill="#ffffff"/><circle cx="-8" cy="14" r="4" fill="#fde047"/><circle cx="12" cy="16" r="4" fill="#6ee7b7"/>'
    elif w == "continent":
        return '<circle cx="0" cy="0" r="38" fill="#0284c7" stroke="#ffffff" stroke-width="5"/><path d="M-24 -14 Q-12 -28 6 -20 Q22 -14 18 2 Q14 18 -4 24 Q-22 20 -24 -14 Z" fill="#22c55e"/><path d="M12 -8 Q26 2 20 18 Q6 10 12 -8 Z" fill="#22c55e"/>'
    elif w == "belief":
        return '<path d="M0 28 C-36 6 -36 -22 0 -22 C36 -22 36 6 0 28 Z" fill="#ef4444" stroke="#ffffff" stroke-width="4"/><line x1="0" y1="-14" x2="0" y2="4" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/><line x1="-8" y1="-6" x2="8" y2="-6" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>'
    elif w == "artistic":
        return '<path d="M-30 10 C-36 -24 16 -38 34 -14 C44 0 28 32 6 32 C-4 32 -10 24 -18 24 C-24 24 -26 28 -30 10 Z" fill="#ffffff"/><circle cx="-14" cy="-14" r="5" fill="#ef4444"/><circle cx="8" cy="-18" r="5" fill="#3b82f6"/><circle cx="22" cy="-2" r="5" fill="#eab308"/><circle cx="12" cy="16" r="5" fill="#22c55e"/><line x1="-36" y1="36" x2="16" y2="-32" stroke="#78350f" stroke-width="5" stroke-linecap="round"/>'
    elif w == "assess":
        return '<rect x="-24" y="-32" width="48" height="60" rx="6" fill="#ffffff"/><line x1="-16" y1="-16" x2="4" y2="-16" stroke="#64748b" stroke-width="4" stroke-linecap="round"/><line x1="-16" y1="-4" x2="16" y2="-4" stroke="#64748b" stroke-width="4" stroke-linecap="round"/><line x1="-16" y1="8" x2="8" y2="8" stroke="#64748b" stroke-width="4" stroke-linecap="round"/><circle cx="16" cy="16" r="14" fill="#38bdf8" stroke="#ffffff" stroke-width="3"/><line x1="26" y1="26" x2="36" y2="36" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>'
    elif w == "collaborate":
        return '<rect x="-30" y="-30" width="28" height="28" rx="4" fill="#38bdf8"/><rect x="2" y="-30" width="28" height="28" rx="4" fill="#fde047"/><rect x="-30" y="2" width="28" height="28" rx="4" fill="#4ade80"/><rect x="2" y="2" width="28" height="28" rx="4" fill="#f43f5e"/><circle cx="0" cy="0" r="10" fill="#ffffff"/>'
    elif w == "precise":
        return '<circle cx="0" cy="0" r="36" fill="none" stroke="#ffffff" stroke-width="4"/><circle cx="0" cy="0" r="24" fill="none" stroke="#fde047" stroke-width="4"/><circle cx="0" cy="0" r="10" fill="#ef4444"/><line x1="-44" y1="0" x2="44" y2="0" stroke="#ffffff" stroke-width="3"/><line x1="0" y1="-44" x2="0" y2="44" stroke="#ffffff" stroke-width="3"/>'
    elif w == "restriction":
        return '<circle cx="0" cy="0" r="36" fill="#ef4444" stroke="#ffffff" stroke-width="6"/><rect x="-24" y="-7" width="48" height="14" rx="4" fill="#ffffff"/>'
    elif w == "venture":
        return '<polygon points="-42,32 0,-30 42,32" fill="#ffffff" fill-opacity="0.3"/><polygon points="-12,32 18,-10 48,32" fill="#ffffff" fill-opacity="0.5"/><polygon points="-14,-10 0,-30 14,-10 6,-8 0,-14 -6,-8" fill="#ffffff"/><line x1="0" y1="-30" x2="0" y2="-44" stroke="#ffffff" stroke-width="3"/><polygon points="0,-44 20,-38 0,-32" fill="#fde047"/>'
    elif w == "appearance":
        return '<rect x="-22" y="-34" width="44" height="68" rx="14" fill="#ffffff" stroke="#cbd5e1" stroke-width="4"/><circle cx="0" cy="-10" r="12" fill="#38bdf8"/><path d="M-14 18 C-14 8 14 8 14 18 Z" fill="#38bdf8"/>'
    elif w == "contrast":
        return '<circle cx="0" cy="0" r="34" fill="#ffffff" stroke="#ffffff" stroke-width="4"/><path d="M0 -34 A 34 34 0 0 1 0 34 Z" fill="#0f172a"/><line x1="0" y1="-34" x2="0" y2="34" stroke="#ffffff" stroke-width="3"/>'
    elif w == "compete":
        return '<circle cx="-16" cy="-20" r="8" fill="#ffffff"/><path d="M-22 -8 L-14 -4 L-8 -14 L4 -8" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/><path d="M-16 0 L-26 18 M-12 0 L-2 16" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/><line x1="28" y1="-36" x2="28" y2="36" stroke="#fde047" stroke-width="4" stroke-dasharray="6,4"/>'
    elif w == "logical":
        return '<circle cx="-16" cy="-16" r="10" fill="#fde047"/><circle cx="16" cy="-16" r="10" fill="#38bdf8"/><circle cx="0" cy="18" r="10" fill="#4ade80"/><line x1="-10" y1="-12" x2="10" y2="-12" stroke="#ffffff" stroke-width="4"/><line x1="-12" y1="-8" x2="-3" y2="10" stroke="#ffffff" stroke-width="4"/><line x1="12" y1="-8" x2="3" y2="10" stroke="#ffffff" stroke-width="4"/>'
    elif w == "urgent":
        return '<path d="M-20 22 L20 22 L16 -12 Q0 -34 -16 -12 Z" fill="#ef4444" stroke="#ffffff" stroke-width="5"/><rect x="-24" y="22" width="48" height="12" rx="4" fill="#64748b"/><text x="0" y="8" font-family="sans-serif" font-size="28" font-weight="900" fill="#ffffff" text-anchor="middle">!</text>'
    elif w == "surrender":
        return '<line x1="-24" y1="36" x2="-24" y2="-38" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/><path d="M-24 -36 C-4 -42 6 -26 26 -32 L26 -6 C6 0 -4 -16 -24 -10 Z" fill="#ffffff"/>'
    elif w == "critical":
        return '<circle cx="-8" cy="-8" r="22" fill="none" stroke="#ffffff" stroke-width="6"/><line x1="8" y1="8" x2="32" y2="32" stroke="#fde047" stroke-width="8" stroke-linecap="round"/><polygon points="-12,-8 -4,-16 4,-8 -4,0" fill="#ef4444"/>'
    elif w == "barren":
        return '<path d="M-44 32 Q-10 14 44 26" stroke="#fde047" stroke-width="6" stroke-linecap="round"/><rect x="-6" y="-18" width="12" height="42" rx="6" fill="#22c55e"/><path d="M-6 -2 L-18 -2 L-18 -12" fill="none" stroke="#22c55e" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 6 L18 6 L18 -4" fill="none" stroke="#22c55e" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="26" cy="-26" r="12" fill="#fde047"/>'
    elif w == "turn down":
        return '<circle cx="0" cy="0" r="36" fill="#ef4444" stroke="#ffffff" stroke-width="5"/><line x1="-16" y1="-16" x2="16" y2="16" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/><line x1="16" y1="-16" x2="-16" y2="16" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>'
    elif w == "refreshing":
        return '<path d="M-18 -24 L18 -24 L12 28 L-12 28 Z" fill="#ffffff" fill-opacity="0.3" stroke="#ffffff" stroke-width="4"/><path d="M-15 -10 L15 -10 L11 26 L-11 26 Z" fill="#38bdf8"/><line x1="-4" y1="-34" x2="14" y2="16" stroke="#fde047" stroke-width="4" stroke-linecap="round"/><circle cx="-2" cy="4" r="3" fill="#ffffff"/>'
    elif w == "come up with":
        return '<path d="M-20 -12 C-20 -28 20 -28 20 -12 C20 -2 10 4 10 14 L-10 14 C-10 4 -20 -2 -20 -12 Z" fill="#fde047" stroke="#ffffff" stroke-width="4"/><rect x="-8" y="16" width="16" height="8" rx="2" fill="#ffffff"/><line x1="0" y1="-38" x2="0" y2="-46" stroke="#fde047" stroke-width="4" stroke-linecap="round"/>'
    elif w == "parachute":
        return '<path d="M-36 0 C-36 -34 36 -34 36 0 Z" fill="#fde047" stroke="#ffffff" stroke-width="4"/><path d="M-12 -2 C-12 -24 12 -24 12 -2 Z" fill="#ef4444"/><line x1="-34" y1="0" x2="0" y2="30" stroke="#ffffff" stroke-width="2.5"/><line x1="34" y1="0" x2="0" y2="30" stroke="#ffffff" stroke-width="2.5"/><rect x="-6" y="28" width="12" height="12" rx="2" fill="#ffffff"/>'
    elif w == "session":
        return '<ellipse cx="0" cy="8" rx="36" ry="18" fill="#ffffff" fill-opacity="0.3" stroke="#ffffff" stroke-width="4"/><circle cx="0" cy="-22" r="8" fill="#fde047"/><circle cx="-32" cy="-6" r="8" fill="#ffffff"/><circle cx="32" cy="-6" r="8" fill="#ffffff"/><circle cx="0" cy="30" r="8" fill="#ffffff"/>'
    elif w == "alert":
        return '<polygon points="0,-36 -38,28 38,28" fill="#fbbf24" stroke="#ffffff" stroke-width="6" stroke-linejoin="round"/><line x1="0" y1="-14" x2="0" y2="6" stroke="#000000" stroke-width="6" stroke-linecap="round"/><circle cx="0" cy="18" r="3.5" fill="#000000"/>'
    elif w == "witness":
        return '<path d="M-42 0 Q0 -28 42 0 Q0 28 -42 0 Z" fill="#ffffff" stroke="#ffffff" stroke-width="4"/><circle cx="0" cy="0" r="16" fill="#0284c7"/><circle cx="0" cy="0" r="8" fill="#0f172a"/><circle cx="-4" cy="-4" r="3" fill="#ffffff"/>'
    elif w == "rubbish":
        return '<path d="M-18 -10 L18 -10 L14 32 L-14 32 Z" fill="#94a3b8" stroke="#ffffff" stroke-width="4"/><line x1="-8" y1="-2" x2="-6" y2="24" stroke="#ffffff" stroke-width="3"/><line x1="8" y1="-2" x2="6" y2="24" stroke="#ffffff" stroke-width="3"/><path d="M-24 -16 L24 -24 L22 -14 L-22 -8 Z" fill="#ffffff"/>'
    elif w == "dissolve":
        return '<path d="M-24 -20 L24 -20 L18 28 L-18 28 Z" fill="none" stroke="#ffffff" stroke-width="4"/><rect x="-8" y="0" width="16" height="16" rx="2" fill="#ffffff" fill-opacity="0.8"/><circle cx="10" cy="12" r="2" fill="#ffffff"/><circle cx="-10" cy="8" r="2.5" fill="#ffffff"/>'
    elif w == "tame":
        return '<circle cx="0" cy="-6" r="22" fill="#ffffff"/><ellipse cx="-20" cy="-6" rx="8" ry="16" fill="#fde047"/><ellipse cx="20" cy="-6" rx="8" ry="16" fill="#fde047"/><circle cx="-7" cy="-8" r="3" fill="#0f172a"/><circle cx="7" cy="-8" r="3" fill="#0f172a"/><polygon points="-4,0 4,0 0,5" fill="#0f172a"/>'
    elif w == "eerie":
        return '<path d="M-22 28 L-22 -6 C-22 -28 22 -28 22 -6 L22 28 Q11 20 0 28 Q-11 20 -22 28 Z" fill="#ffffff"/><ellipse cx="-8" cy="-8" rx="3.5" ry="5.5" fill="#0f172a"/><ellipse cx="8" cy="-8" rx="3.5" ry="5.5" fill="#0f172a"/><ellipse cx="0" cy="4" rx="4" ry="7" fill="#0f172a"/>'
    elif w == "instruct":
        return '<rect x="-34" y="-28" width="68" height="44" rx="4" fill="#065f46" stroke="#ffffff" stroke-width="4"/><line x1="-24" y1="-14" x2="8" y2="-14" stroke="#ffffff" stroke-width="3"/><line x1="-24" y1="-4" x2="16" y2="-4" stroke="#ffffff" stroke-width="3"/><line x1="28" y1="28" x2="-2" y2="-2" stroke="#fde047" stroke-width="4" stroke-linecap="round"/>'
    elif w == "aggressive":
        return '<circle cx="0" cy="2" r="26" fill="#ef4444" stroke="#ffffff" stroke-width="4"/><path d="M-20 -10 Q-34 -30 -16 -28 Q-18 -18 -12 -12 Z" fill="#fde047"/><path d="M20 -10 Q34 -30 16 -28 Q18 -18 12 -12 Z" fill="#fde047"/><line x1="-16" y1="-2" x2="-6" y2="4" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/><line x1="16" y1="-2" x2="6" y2="4" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>'
    elif w == "talent":
        return '<path d="M-18 -26 L18 -26 L14 4 Q0 18 -14 4 Z" fill="#fde047" stroke="#ffffff" stroke-width="4"/><path d="M-18 -20 C-32 -20 -28 0 -14 0" fill="none" stroke="#ffffff" stroke-width="4"/><path d="M18 -20 C32 -20 28 0 14 0" fill="none" stroke="#ffffff" stroke-width="4"/><rect x="-10" y="14" width="20" height="10" fill="#ffffff"/><rect x="-18" y="24" width="36" height="8" rx="2" fill="#ffffff"/>'
    elif w == "patter":
        return '<path d="M-28 -8 C-28 -24 0 -26 8 -16 C16 -22 34 -14 32 4 C32 14 18 16 0 16 C-18 16 -28 8 -28 -8 Z" fill="#ffffff"/><line x1="-16" y1="24" x2="-22" y2="38" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/><line x1="0" y1="22" x2="-6" y2="36" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/><line x1="16" y1="24" x2="10" y2="38" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>'
    elif w == "reek":
        return '<path d="M-14 28 C-24 16 -4 8 -14 -8 C-24 -24 -4 -32 -10 -42" fill="none" stroke="#a3e635" stroke-width="5" stroke-linecap="round"/><path d="M4 28 C14 16 -6 8 4 -8 C14 -24 -6 -32 0 -42" fill="none" stroke="#a3e635" stroke-width="5" stroke-linecap="round"/><path d="M22 28 C12 16 32 8 22 -8 C12 -24 32 -32 26 -42" fill="none" stroke="#a3e635" stroke-width="5" stroke-linecap="round"/>'
    elif w == "glare at":
        return '<path d="M-36 -12 Q-20 -2 0 -12" stroke="#ffffff" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M36 -12 Q20 -2 0 -12" stroke="#ffffff" stroke-width="5" stroke-linecap="round" fill="none"/><ellipse cx="-16" cy="4" rx="14" ry="8" fill="#ffffff"/><ellipse cx="16" cy="4" rx="14" ry="8" fill="#ffffff"/><circle cx="-14" cy="4" r="5" fill="#ef4444"/><circle cx="14" cy="4" r="5" fill="#ef4444"/>'
    elif w == "pacific ocean":
        return '<circle cx="0" cy="0" r="38" fill="#0284c7" stroke="#ffffff" stroke-width="4"/><path d="M-36 6 Q-18 -10 0 6 Q18 22 36 6" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/><path d="M-36 -10 Q-18 -26 0 -10 Q18 6 36 -10" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/><path d="M-36 22 Q-18 6 0 22 Q18 38 36 22" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>'
    elif w == "wound":
        return '<rect x="-32" y="-12" width="64" height="24" rx="8" fill="#fed7aa" stroke="#ffffff" stroke-width="4" transform="rotate(-25)"/><rect x="-10" y="-12" width="20" height="24" fill="#ffffff" fill-opacity="0.8" transform="rotate(-25)"/><line x1="-3" y1="-3" x2="3" y2="3" stroke="#ef4444" stroke-width="3" transform="rotate(-25)"/>'
    elif w == "ally":
        return '<circle cx="-16" cy="0" r="28" fill="none" stroke="#38bdf8" stroke-width="6"/><circle cx="16" cy="0" r="28" fill="none" stroke="#fde047" stroke-width="6"/><path d="M-10 -12 L10 12 M-10 12 L10 -12" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>'
    elif w == "scold":
        return '<line x1="-34" y1="0" x2="16" y2="0" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/><polygon points="12,-12 34,0 12,12" fill="#fde047"/><circle cx="-24" cy="0" r="14" fill="#ef4444"/>'
    elif w == "criminal":
        return '<rect x="-24" y="-30" width="48" height="60" rx="8" fill="#ffffff" stroke="#000000" stroke-width="4"/><line x1="-24" y1="-14" x2="24" y2="-14" stroke="#000000" stroke-width="6"/><line x1="-24" y1="2" x2="24" y2="2" stroke="#000000" stroke-width="6"/><line x1="-24" y1="18" x2="24" y2="18" stroke="#000000" stroke-width="6"/>'
    elif w == "pearl":
        return '<path d="M-36 10 C-36 -24 36 -24 36 10 Z" fill="#fda4af" stroke="#ffffff" stroke-width="4"/><path d="M-38 10 C-38 34 38 34 38 10 Z" fill="#f43f5e" stroke="#ffffff" stroke-width="4"/><circle cx="0" cy="8" r="16" fill="#ffffff" stroke="#fbcfe8" stroke-width="2"/><circle cx="-4" cy="4" r="4" fill="#ffffff"/>'
    elif w == "solar energy":
        return '<circle cx="0" cy="-18" r="18" fill="#fde047"/><polygon points="-30,32 30,32 20,4 -20,4" fill="#0284c7" stroke="#ffffff" stroke-width="3"/><line x1="0" y1="4" x2="0" y2="32" stroke="#ffffff" stroke-width="2.5"/><line x1="-25" y1="18" x2="25" y2="18" stroke="#ffffff" stroke-width="2.5"/>'
    elif w == "vending machine":
        return '<rect x="-24" y="-36" width="48" height="72" rx="6" fill="#ef4444" stroke="#ffffff" stroke-width="4"/><rect x="-16" y="-28" width="32" height="28" rx="3" fill="#ffffff" fill-opacity="0.9"/><circle cx="-8" cy="-14" r="4" fill="#38bdf8"/><circle cx="8" cy="-14" r="4" fill="#22c55e"/><rect x="-16" y="16" width="32" height="12" rx="2" fill="#0f172a"/>'
    elif w == "sign language":
        return '<path d="M-18 20 L-18 -12 L-8 -12 L-8 -22 L0 -22 L0 6 L12 6 L12 20 Z" fill="#ffffff" stroke="#fde047" stroke-width="3"/><path d="M18 -8 Q28 4 18 16" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>'
    elif w == "applaud":
        return '<path d="M-22 18 L-8 -4 L2 4 L-12 26 Z" fill="#ffffff"/><path d="M22 18 L8 -4 L-2 4 L12 26 Z" fill="#ffffff"/><polygon points="0,-24 3,-16 11,-16 5,-10 7,-2 0,-7 -7,-2 -5,-10 -11,-16 -3,-16" fill="#fde047"/>'
    elif w == "cottage":
        return '<polygon points="0,-32 -32,-4 32,-4" fill="#ef4444" stroke="#ffffff" stroke-width="4"/><rect x="-24" y="-4" width="48" height="36" fill="#ffffff"/><rect x="-8" y="10" width="16" height="22" fill="#78350f"/><rect x="8" y="-26" width="8" height="14" fill="#64748b"/>'
    elif w == "document":
        return '<path d="M-22 -32 L10 -32 L26 -16 L26 32 L-22 32 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/><polygon points="10,-32 10,-16 26,-16" fill="#94a3b8"/><line x1="-14" y1="-12" x2="16" y2="-12" stroke="#64748b" stroke-width="3" stroke-linecap="round"/><line x1="-14" y1="-2" x2="16" y2="-2" stroke="#64748b" stroke-width="3" stroke-linecap="round"/><circle cx="12" cy="20" r="5" fill="#ef4444"/>'
    elif w == "freedom":
        return '<path d="M-36 6 Q-18 -18 0 0 Q18 -18 36 6 Q18 -4 0 12 Q-18 -4 -36 6 Z" fill="#ffffff"/><line x1="-30" y1="28" x2="-10" y2="28" stroke="#fde047" stroke-width="4"/><line x1="10" y1="28" x2="30" y2="28" stroke="#fde047" stroke-width="4"/>'
    elif w == "parcel":
        return '<rect x="-28" y="-20" width="56" height="48" rx="4" fill="#d97706" stroke="#ffffff" stroke-width="4"/><line x1="-28" y1="4" x2="28" y2="4" stroke="#ffffff" stroke-width="5"/><line x1="0" y1="-20" x2="0" y2="28" stroke="#ffffff" stroke-width="5"/>'
    elif w == "scream":
        return '<circle cx="0" cy="0" r="32" fill="#fde047" stroke="#ffffff" stroke-width="4"/><ellipse cx="-10" cy="-8" rx="4" ry="7" fill="#0f172a"/><ellipse cx="10" cy="-8" rx="4" ry="7" fill="#0f172a"/><ellipse cx="0" cy="12" rx="8" ry="14" fill="#0f172a"/>'
    elif w == "vote":
        return '<rect x="-26" y="-6" width="52" height="40" rx="4" fill="#ffffff"/><line x1="-12" y1="-6" x2="12" y2="-6" stroke="#0f172a" stroke-width="3"/><rect x="-14" y="-28" width="28" height="26" rx="2" fill="#fde047" stroke="#ffffff" stroke-width="2"/><path d="M-6 -16 L-2 -12 L6 -20" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>'
    elif w == "crook":
        return '<circle cx="0" cy="0" r="28" fill="#ffffff"/><rect x="-26" y="-12" width="52" height="16" rx="8" fill="#0f172a"/><circle cx="-10" cy="-4" r="3" fill="#ffffff"/><circle cx="10" cy="-4" r="3" fill="#ffffff"/>'
    elif w == "faint":
        return '<circle cx="0" cy="4" r="26" fill="#ffffff"/><text x="-10" y="2" font-family="sans-serif" font-size="14" font-weight="900" fill="#0f172a">X</text><text x="10" y="2" font-family="sans-serif" font-size="14" font-weight="900" fill="#0f172a">X</text><ellipse cx="0" cy="16" rx="6" ry="4" fill="#0f172a"/>'
    elif w == "planet":
        return '<circle cx="0" cy="0" r="24" fill="#f59e0b" stroke="#ffffff" stroke-width="3"/><ellipse cx="0" cy="0" rx="44" ry="12" fill="none" stroke="#ffffff" stroke-width="5" transform="rotate(-20)"/>'
    elif w == "gym":
        return '<rect x="-6" y="-3" width="12" height="6" fill="#cbd5e1"/><rect x="-28" y="-18" width="8" height="36" rx="3" fill="#ffffff"/><rect x="20" y="-18" width="8" height="36" rx="3" fill="#ffffff"/><line x1="-14" y1="0" x2="14" y2="0" stroke="#ffffff" stroke-width="6"/>'
    elif w == "bomb":
        return '<circle cx="-4" cy="8" r="28" fill="#0f172a" stroke="#ffffff" stroke-width="4"/><rect x="12" y="-14" width="10" height="8" rx="2" fill="#94a3b8" transform="rotate(45 12 -14)"/><polygon points="32,-28 36,-20 44,-20 38,-14 40,-6 32,-10 24,-6 26,-14 20,-20 28,-20" fill="#ef4444"/>'
    elif w == "magazine":
        return '<rect x="-26" y="-32" width="52" height="64" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/><rect x="-20" y="-24" width="40" height="20" fill="#ec4899"/><line x1="-20" y1="4" x2="20" y2="4" stroke="#64748b" stroke-width="3"/><line x1="-20" y1="12" x2="20" y2="12" stroke="#64748b" stroke-width="3"/>'
    elif w == "pay":
        return '<rect x="-30" y="-18" width="60" height="38" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/><rect x="-30" y="-8" width="60" height="8" fill="#0f172a"/><circle cx="16" cy="10" r="4" fill="#ef4444"/><circle cx="8" cy="10" r="4" fill="#f59e0b" fill-opacity="0.8"/>'
    elif w == "deliver":
        return '<rect x="-34" y="-8" width="42" height="30" rx="3" fill="#ffffff"/><path d="M8 2 L24 2 L30 14 L30 22 L8 22 Z" fill="#fde047"/><circle cx="-16" cy="24" r="8" fill="#0f172a" stroke="#ffffff" stroke-width="3"/><circle cx="18" cy="24" r="8" fill="#0f172a" stroke="#ffffff" stroke-width="3"/>'
    elif w == "connect":
        return '<path d="M-30 0 L-10 0 M-10 -8 L-10 8" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/><line x1="-4" y1="-4" x2="4" y2="-4" stroke="#fde047" stroke-width="4"/><line x1="-4" y1="4" x2="4" y2="4" stroke="#fde047" stroke-width="4"/><path d="M30 0 L10 0 M10 -8 L10 8" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>'
    elif w == "protect":
        return '<path d="M0 -34 L30 -20 L30 8 Q30 34 0 42 Q-30 34 -30 8 L-30 -20 Z" fill="#22c55e" stroke="#ffffff" stroke-width="5"/><path d="M-10 4 L-2 12 L14 -6" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
    elif w == "measure":
        return '<circle cx="0" cy="0" r="28" fill="#fbbf24" stroke="#ffffff" stroke-width="4"/><circle cx="0" cy="0" r="10" fill="#475569"/><path d="M18 20 L38 20" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>'
    elif w == "barrel":
        return '<path d="M-18 -28 C-30 -10 -30 10 -18 28 L18 28 C30 10 30 -10 18 -28 Z" fill="#92400e" stroke="#ffffff" stroke-width="4"/><line x1="-24" y1="-10" x2="24" y2="-10" stroke="#ffffff" stroke-width="3"/><line x1="-24" y1="10" x2="24" y2="10" stroke="#ffffff" stroke-width="3"/>'
    elif w == "grocery":
        return '<polygon points="-20,28 20,28 24,-14 -24,-14" fill="#d97706" stroke="#ffffff" stroke-width="3"/><circle cx="-6" cy="-20" r="10" fill="#ef4444"/><rect x="4" y="-30" width="10" height="24" rx="2" fill="#fde047"/>'
    elif w == "duck":
        return '<circle cx="-14" cy="6" r="14" fill="#ffffff"/><path d="M-28 28 Q-10 14 18 24" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/><path d="M-8 -26 L16 -6" stroke="#ef4444" stroke-width="5" stroke-linecap="round"/><polygon points="12,-16 24,-4 10,-2" fill="#ef4444"/>'
    elif w == "childish":
        return '<circle cx="0" cy="-12" r="18" fill="#f43f5e" stroke="#ffffff" stroke-width="4"/><line x1="0" y1="6" x2="0" y2="34" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/><circle cx="0" cy="34" r="6" fill="#fde047"/><circle cx="0" cy="-12" r="6" fill="#ffffff"/>'
    elif w == "fed up":
        return '<circle cx="0" cy="0" r="28" fill="#ffffff"/><line x1="-14" y1="-6" x2="-4" y2="-6" stroke="#0f172a" stroke-width="3"/><line x1="4" y1="-6" x2="14" y2="-6" stroke="#0f172a" stroke-width="3"/><line x1="-10" y1="14" x2="10" y2="14" stroke="#0f172a" stroke-width="3"/>'

    # 일반/품사별 심볼
    elif "동사" in meaning or "verb" in str(meaning) or "하다" in meaning:
        return '<circle cx="0" cy="0" r="32" fill="none" stroke="#ffffff" stroke-width="5" stroke-dasharray="8,6"/><polygon points="-8,-18 16,0 -8,18" fill="#fde047"/><line x1="-20" y1="0" x2="12" y2="0" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>'
    elif "형용사" in meaning or "한" in meaning or "적" in meaning:
        return '<polygon points="0,-36 9,-12 34,-9 14,9 20,34 0,18 -20,34 -14,9 -34,-9 -9,-12" fill="#fde047" stroke="#ffffff" stroke-width="3"/><circle cx="0" cy="0" r="8" fill="#ffffff"/>'
    else:
        return '<rect x="-24" y="-24" width="48" height="48" rx="12" fill="#ffffff" fill-opacity="0.9"/><circle cx="0" cy="0" r="14" fill="#3b82f6"/><circle cx="0" cy="0" r="6" fill="#ffffff"/>'

def get_svg_content(num, word, meaning, pos):
    p_idx = (num * 7 + len(word)) % len(PALETTES)
    c_from, c_to, c_light = PALETTES[p_idx]
    elements = generate_illustration_elements(num, word, meaning)

    safe_word = html.escape(word)
    safe_meaning = html.escape(meaning[:14] + '..' if len(meaning) > 15 else meaning)

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="100%" height="100%">
  <defs>
    <linearGradient id="bg_{num}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{c_from}" />
      <stop offset="100%" stop-color="{c_to}" />
    </linearGradient>
    <filter id="shadow_{num}" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.25"/>
    </filter>
  </defs>

  <rect width="256" height="256" rx="32" fill="url(#bg_{num})"/>
  <circle cx="210" cy="46" r="64" fill="#ffffff" fill-opacity="0.08"/>
  <circle cx="30" cy="226" r="48" fill="#ffffff" fill-opacity="0.06"/>

  <rect x="20" y="18" width="46" height="24" rx="12" fill="#ffffff" fill-opacity="0.2"/>
  <text x="43" y="34" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" fill="#ffffff" text-anchor="middle">#{num}</text>

  <g transform="translate(128, 115)" filter="url(#shadow_{num})">
    {elements}
  </g>

  <g transform="translate(128, 206)">
    <rect x="-104" y="-2" width="208" height="38" rx="12" fill="#000000" fill-opacity="0.25"/>
    <text x="0" y="16" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle">{safe_word}</text>
    <text x="0" y="30" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="500" fill="#f1f5f9" fill-opacity="0.9" text-anchor="middle">{safe_meaning}</text>
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

    print(f"Generating {len(WORDS)} illustrations...")
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

    # 1. 배포 가능한 단어장 JSON 파일 생성
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

    # 2. 배포 가능한 SQLite3 DB 파일 (.db) 생성
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

    cur.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("version", "1.0"))
    cur.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("deck_id", deck_id))
    cur.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("deck_name", deck_name))
    cur.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("total_words", str(len(cards_json))))
    cur.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("backup_json", json.dumps(deck_obj, ensure_ascii=False)))

    conn.commit()
    conn.close()
    print(f"Saved SQLite database: {db_path} (size: {os.path.getsize(db_path)} bytes)")

    # 3. 웹앱 내장용 JS 데이터셋 (js/data/cenkleVocaKing2026.js) 생성
    js_data_path = os.path.join(base_dir, "js/data/cenkleVocaKing2026.js")
    with open(js_data_path, "w", encoding="utf-8") as f:
        f.write(f"// js/data/cenkleVocaKing2026.js\n")
        f.write(f"// {deck_name} (1~250) 직접 제작 심플 일러스트 탑재 데이터셋\n\n")
        f.write(f"export const CENKLE_VOCA_KING_DECK = ")
        f.write(json.dumps(deck_obj, ensure_ascii=False, indent=2))
        f.write(";\n")
    print(f"Saved JS dataset: {js_data_path}")

if __name__ == "__main__":
    main()
