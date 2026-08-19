/**
 * 대분류 4: 실전 구어, 슬랭 & 생활 회화 (Slang & Daily Spoken)
 * 자카르타 슬랭(Bahasa Gaul), 채팅 줄임말, 흥정/그랩/식당 만능 표현, 비즈니스 실무
 */

export const slangDailySpoken = [
  // --- [소분류 4-1: 자카르타 슬랭 & 채팅 줄임말] ---
  {
    id: 'slang_001',
    category_id: 'slang_daily_spoken',
    subcategory_id: 'slang_abbreviations',
    word: 'mager [[마게르]]',
    meaning: '귀찮다, 움직이기 싫다 (귀차니즘)',
    pos: '형용사, 슬랭',
    root: 'gerak',
    affix_logic: 'malas(게으르다) + gerak(움직이다)의 축약 합성 신조어',
    grammar_rule: '주어 뒤에 형용사처럼 쓰여 아무것도 하기 싫고 누워만 있고 싶은 상태를 표현합니다.',
    synonym: 'malas bergerak (움직이기 귀찮은), rebahan (누워 뒹굴거리는)',
    antonym: 'rajin (부지런한), semangat (의욕 넘치는)',
    context: '주말에 침대에 누워 친구의 약속 제안을 거절하거나, 밥 먹으러 나가기 귀찮을 때.',
    caution: '젊은 층의 일상 신조어이므로 어르신이나 공식 비즈니스 미팅에서는 malas를 쓰세요.',
    related: 'Malas(귀찮다) + Gerak(움직이다) = Mager! 현대 인도네시아인들의 최애 슬랭.',
    example_formal: 'Rasa enggan bergerak dapat menurunkan produktivitas kerja sehari-hari.',
    example_formal_kr: '움직이기 싫어하는 나태함은 일상 업무 생산성을 저하시킬 수 있습니다.',
    example_casual: 'Aduh mager banget mau keluar, gofood-in makanan aja yuk!',
    example_casual_kr: '아 진짜 나가기 너무 귀찮다(마게르), 그냥 고푸드로 음식 시켜 먹자!',
    word_breakdown: [
      { word: 'Aduh', meaning: '아이고/어머' },
      { word: 'mager banget', meaning: '진짜 너무 귀찮다' },
      { word: 'mau keluar', meaning: '나가기(외출하기)' },
      { word: 'gofood-in makanan', meaning: '고푸드로 음식을 배달시키다' },
      { word: 'aja yuk', meaning: '그냥 ~하자' }
    ]
  },
  {
    id: 'slang_002',
    category_id: 'slang_daily_spoken',
    subcategory_id: 'slang_abbreviations',
    word: 'baper [[바뻬르]]',
    meaning: '마음 상하다, 과민반응하다 (진지충 되다)',
    pos: '형용사, 슬랭',
    root: 'rasa',
    affix_logic: 'bawa(가져오다) + perasaan(감정/기분)의 합성 줄임말',
    grammar_rule: '농담을 진지하게 받아들여 서운해하거나 과하게 감정적으로 대할 때 씁니다.',
    synonym: 'tersinggung (기분 상하다), sensitif (예민한)',
    antonym: 'cuek (쿨한/무심한), santai (태연한)',
    context: '"농담인데 왜 삐지고 그래~" 할 때 "Jangan baper dong!"으로 매일 쓰입니다.',
    caution: '상대방의 기분을 풀어줄 때 장난스럽게 쓰며, 진지한 사과 자리에서는 쓰지 않습니다.',
    related: 'Bawa(가져오다) + Perasaan(마음) = 감정을 너무 깊이 실어 상처받음!',
    example_formal: 'Kita sebaiknya bersikap profesional dan tidak mudah tersinggung oleh kritik.',
    example_formal_kr: '우리는 비판에 쉽게 기분 상하지 말고 전문적인 태도를 견지하는 것이 바람직합니다.',
    example_casual: 'Bercanda doang kali bro, jangan baper gitu dong!',
    example_casual_kr: '그냥 장난친 거잖아 형씨, 그렇게 마음 상해서(바뻬르) 삐지지 마!',
    word_breakdown: [
      { word: 'Bercanda doang', meaning: '단지 농담일 뿐이다' },
      { word: 'kali', meaning: '~잖아/아마도' },
      { word: 'bro', meaning: '형씨/친구야' },
      { word: 'jangan baper gitu', meaning: '그렇게 마음 상하지 마라' },
      { word: 'dong', meaning: '제발/좀' }
    ]
  },
  {
    id: 'slang_003',
    category_id: 'slang_daily_spoken',
    subcategory_id: 'slang_abbreviations',
    word: 'gpp [[게페페]]',
    meaning: '괜찮아, 별일 아니야 (tidak apa-apa의 채팅 약어)',
    pos: '관용구, 약어',
    root: 'apa',
    affix_logic: 'gak apa-apa ➔ gpp (메신저/SNS 전용 초단축어)',
    grammar_rule: '왓츠앱(WhatsApp) 채팅 시 상대방에게 괜찮다고 답장할 때 가장 많이 쓰는 축약어.',
    synonym: 'tidak apa-apa (괜찮습니다), rapopo (자바어식 괜찮아)',
    antonym: 'gawat (큰일이다), masalah besar (큰 문제)',
    context: '미안하다는 사과나 감사 인사에 대해 "별거 아냐~ 괜찮아" 하고 쿨하게 답할 때.',
    caution: '공식 이메일이나 문서에는 절대로 축약하지 말고 tidak apa-apa로 온전히 적어야 합니다.',
    related: 'WhatsApp 채팅할 때 없으면 대화가 안 통하는 0순위 약어: gpp, otw, ywdh!',
    example_formal: 'Tidak ada masalah, semua berjalan sesuai dengan rencana.',
    example_formal_kr: '아무런 문제 없습니다, 모든 것이 계획대로 잘 진행되고 있습니다.',
    example_casual: 'Gpp kok santai aja, gue udah biasa nungguin lu.',
    example_casual_kr: '진짜 괜찮아 천천히 해, 나 너 기다리는 거 이미 익숙해.',
    word_breakdown: [
      { word: 'Gpp kok', meaning: '괜찮아 진짜로' },
      { word: 'santai aja', meaning: '느긋하게 해' },
      { word: 'gue udah biasa', meaning: '나는 이미 익숙하다' },
      { word: 'nungguin lu', meaning: '너를 기다리는 것' }
    ]
  },

  // --- [소분류 4-2: 식당, 쇼핑, 흥정 & 그랩 만능 어휘] ---
  {
    id: 'slang_004',
    category_id: 'slang_daily_spoken',
    subcategory_id: 'daily_life_survival',
    word: 'bungkus [[붕꾸스]]',
    meaning: '포장하다, 테이크아웃하다, 싸가다',
    pos: '동사, 명사',
    root: 'bungkus',
    affix_logic: '단일 기본 명사/동사',
    grammar_rule: '식당에서 남은 음식을 포장하거나 테이크아웃 주문을 할 때 핵심 키워드로 쓰입니다.',
    synonym: 'take away (테이크아웃), dibungkus (포장되다)',
    antonym: 'makan di sini (여기서 먹다 / dine-in)',
    context: '와룽(Warung)이나 식당에서 "Makan di sini atau bungkus? (먹고 가세요, 포장이세요?)"로 매일 듣는 질문.',
    caution: '인도네시아 전통 포장 밥인 "Nasi Bungkus(나시 붕꾸스)"도 여기서 유래했습니다.',
    related: '식당 주문 만능 공식: "Mas, satu porsi bungkus ya! (형씨, 1인분 포장이요!)"',
    example_formal: 'Makanan sisa pertemuan ini sebaiknya dibungkus agar tidak terbuang sia-sia.',
    example_formal_kr: '이번 회의의 남은 음식은 낭비되지 않도록 포장하는 것이 바람직합니다.',
    example_casual: 'Mbak, nasi goreng spesialnya satu makan di sini, satu lagi dibungkus ya.',
    example_casual_kr: '언니, 스페셜 나시고랭 하나는 여기서 먹고, 하나는 포장해 주세요.',
    word_breakdown: [
      { word: 'Mbak', meaning: '언니/아가씨' },
      { word: 'nasi goreng spesialnya', meaning: '스페셜 나시고랭은' },
      { word: 'satu makan di sini', meaning: '하나는 여기서 먹고' },
      { word: 'satu lagi', meaning: '또 다른 하나는' },
      { word: 'dibungkus ya', meaning: '포장해 주세요' }
    ]
  },
  {
    id: 'slang_005',
    category_id: 'slang_daily_spoken',
    subcategory_id: 'daily_life_survival',
    word: 'pas [[빠스]]',
    meaning: '딱 맞다, 정확하다, 잔돈 없이 딱 떨어지다',
    pos: '형용사, 부사',
    root: 'pas',
    affix_logic: '네덜란드어 pas에서 유래한 생활 밀착 어휘',
    grammar_rule: '치수가 꼭 맞거나, 타이밍이 절묘하거나, 지불할 돈이 정확히 거스름돈 없이 딱 떨어질 때 씁니다.',
    synonym: 'cocok (어울리는/맞는), tepat (정확한)',
    antonym: 'kurang (부족한), kebesaran (너무 큰)',
    context: '택시비 낼 때 "Uang pas (딱 맞는 돈)", 옷 입어볼 때 "Ukurannya pas (사이즈가 딱 맞아)".',
    caution: '시간을 말할 때 "Pas jam 12 (딱 12시 정각에)"처럼 부사로도 아주 많이 씁니다.',
    related: 'Fit / Exact = Pas! "Uang pas ya Pak (기사님 거스름돈 없는 딱 맞춘 돈이에요)"',
    example_formal: 'Waktu pengiriman barang sangat pas dengan jadwal operasional pabrik.',
    example_formal_kr: '물품 배송 시점이 공장 가동 일정과 아주 정확하게 딱 맞아떨어졌습니다.',
    example_casual: 'Ini uangnya pas sepuluh ribu ya mas, nggak usah kembalian.',
    example_casual_kr: '여기 딱 만 루피아예요 형씨, 거스름돈은 안 주셔도 돼요.',
    word_breakdown: [
      { word: 'Ini uangnya', meaning: '여기 돈이' },
      { word: 'pas', meaning: '딱 맞게' },
      { word: 'sepuluh ribu', meaning: '만 루피아' },
      { word: 'ya mas', meaning: '형씨' },
      { word: 'nggak usah', meaning: '~할 필요 없다' },
      { word: 'kembalian', meaning: '거스름돈' }
    ]
  }
];
