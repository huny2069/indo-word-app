/**
 * 대분류 5: BIPA 공인 등급 & 필수 주제 (BIPA Levels & Essential Topics)
 * BIPA 초/중/고급 핵심 문법 및 어휘군
 */

export const bipaTopics = [
  // --- [소분류 5-1: BIPA 초급 필수 기초] ---
  {
    id: 'bipa_001',
    category_id: 'bipa_levels',
    subcategory_id: 'bipa_beginner',
    word: 'kebanyakan [[끄바냑깐]]',
    meaning: '대부분, 너무 많은(과도한)',
    pos: '명사, 형용사',
    root: 'banyak',
    affix_logic: '어근 banyak(많다)에 과도/상태 접사 ke-...-an이 결합',
    grammar_rule: "주로 명사 앞에 위치하여 'kebanyakan + 명사' 형태로 사용되거나, 동사/형용사 앞에 쓰여 정도가 지나침을 나타냅니다.",
    synonym: 'sebagian besar (대다수), mayoritas (과반수)',
    antonym: 'sedikit (조금/적은), minoritas (소수)',
    context: "어떤 집단의 주된 부분이나 과도한 양을 나타낼 때 사용합니다. 문맥에 따라 '대부분'이라는 뜻과 '너무 많은(과도한)'이라는 부정적인 의미로도 쓰입니다.",
    caution: "형용사로 쓰일 때 명사 앞에 오면 '대부분의'라는 의미지만, 단독으로 쓰이면 '너무 지나치다'는 의미가 되므로 문맥 파악이 중요합니다.",
    related: "어근 'banyak(많다)'에 접사 'ke-an'이 붙어 '많음의 상태'에서 확장되어 '대부분'이 되었다고 기억하세요!",
    example_formal: 'Kebanyakan orang setuju dengan usulan tersebut.',
    example_formal_kr: '대부분의 사람들은 그 제안에 동의합니다.',
    example_casual: 'Kebanyakan sih dia cuma main game di rumah.',
    example_casual_kr: '대부분 그냥 집에서 게임만 해.',
    word_breakdown: [
      { word: 'Kebanyakan', meaning: '대부분' },
      { word: 'orang', meaning: '사람들' },
      { word: 'setuju', meaning: '동의하다' },
      { word: 'dengan usulan tersebut', meaning: '그 제안에' }
    ]
  },
  {
    id: 'bipa_002',
    category_id: 'bipa_levels',
    subcategory_id: 'bipa_beginner',
    word: 'membutuhkan [[멈부뚜깐]]',
    meaning: '필요로 하다, 요구하다',
    pos: '동사',
    root: 'butuh',
    affix_logic: '접두사 mem- + 어근 butuh(필요: b유지) + 사동/타동사 접미사 -kan',
    grammar_rule: '타동사로서 뒤에 반드시 필요한 대상인 직접 목적어(명사)가 위치합니다.',
    synonym: 'memerlukan (필요로 하다), mendambakan (갈망하다)',
    antonym: 'menolak (거절하다/마다하다)',
    context: '도움이 필요할 때(membutuhkan bantuan), 시간이 걸릴 때(membutuhkan waktu) 등 일상과 업무의 핵심 어휘.',
    caution: 'b로 시작하는 어근은 접두사 mem-이 붙을 때 철자 탈락 없이 mem-butuhkan이 됩니다.',
    related: 'butuh(필요하다)의 표준 타동사 형태! "Saya butuh..."의 격식체 버전입니다.',
    example_formal: 'Pasien dalam kondisi kritis ini sangat membutuhkan transfusi darah segera.',
    example_formal_kr: '위독한 상태의 이 환자는 즉각적인 수혈을 절실히 필요로 하고 있습니다.',
    example_casual: 'Kalau lu butuh bantuan apa-apa, langsung telepon gue aja ya.',
    example_casual_kr: '너 무슨 도움이든 필요하면 그냥 바로 나한테 전화해.',
    word_breakdown: [
      { word: 'Pasien', meaning: '환자' },
      { word: 'dalam kondisi kritis ini', meaning: '이 위독한 상태 속의' },
      { word: 'sangat membutuhkan', meaning: '절실히 필요로 하다' },
      { word: 'transfusi darah', meaning: '수혈' },
      { word: 'segera', meaning: '즉시/곧바로' }
    ]
  },
  {
    id: 'bipa_003',
    category_id: 'bipa_levels',
    subcategory_id: 'bipa_intermediate',
    word: 'mengembangkan [[멍엠방깐]]',
    meaning: '발전시키다, 개발하다, 확장하다',
    pos: '동사',
    root: 'kembang',
    affix_logic: '접두사 meng- + 어근 kembang(피어나다: k탈락) + 사동 접미사 -kan',
    grammar_rule: 'K로 시작하는 어근 kembang에서 k가 탈락하여 meng-embang-kan이 됩니다.',
    synonym: 'memajukan (진흥시키다), meningkatkan (향상시키다)',
    antonym: 'menurunkan (떨어뜨리다), menghambat (가로막다)',
    context: '기술 개발, 비즈니스 사업 확장, 개인의 역량 계발 등에 사용되는 고급 동사.',
    caution: '어근 kembang(꽃이 피다/번창하다)의 K탈락 규칙을 꼭 기억하세요.',
    related: 'Develop = Mengembangkan! 이력서나 회사 소개서에 무조건 들어가는 필수 동사.',
    example_formal: 'Perusahaan rintisan ini berfokus mengembangkan teknologi kecerdasan buatan.',
    example_formal_kr: '이 스타트업은 인공지능 기술을 개발하는 데 집중하고 있습니다.',
    example_casual: 'Gue lagi coba ngembangin hobi masak gue jadi bisnis beneran nih.',
    example_casual_kr: '나 요리 취미를 진짜 사업으로 한번 발전시켜 보려고 하는 중이야.',
    word_breakdown: [
      { word: 'Perusahaan rintisan ini', meaning: '이 스타트업은' },
      { word: 'berfokus', meaning: '집중하다' },
      { word: 'mengembangkan', meaning: '개발하다/발전시키다' },
      { word: 'teknologi kecerdasan buatan', meaning: '인공지능 기술' }
    ]
  }
];
