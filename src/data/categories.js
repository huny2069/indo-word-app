/**
 * 인코(Inko) 인도네시아어 오프라인 사전 카테고리 체계
 * 한국어(ko), 인도네시아어(id), 영어(en) 3개 국어 완벽 지원
 */

export const OFFLINE_CATEGORIES = [
  {
    id: 'discourse',
    name: '문장 연결 & 담화 표지',
    name_id: 'Kata Penghubung & Penanda Wacana',
    name_en: 'Sentence Connectors & Discourse Markers',
    icon: '🔗',
    description: '말문이 트이고 문장을 자연스럽게 이어주는 접속사, 부사, 전치사, 추임새',
    description_id: 'Konjungsi, adverbia, preposisi, dan partikel untuk menghubungkan kalimat secara alami',
    description_en: 'Conjunctions, adverbs, prepositions, and discourse particles for natural conversation',
    subcategories: [
      {
        id: 'logic_connectors',
        name: '논리 & 인과 접속사 (하지만, 그러므로, 반면에 등)',
        name_id: 'Konjungsi Logika & Sebab-Akibat (tetapi, oleh karena itu, dll.)',
        name_en: 'Logical & Causal Conjunctions (however, therefore, whereas, etc.)',
        tag: '접속사'
      },
      {
        id: 'time_trigger_adverbs',
        name: '시간, 전환 & 계기 부사 (갑자기, 어쩌다, 원래, 결국 등)',
        name_id: 'Adverbia Waktu & Transisi (tiba-tiba, kebetulan, awalnya, akhirnya)',
        name_en: 'Time & Transition Adverbs (suddenly, by chance, originally, eventually)',
        tag: '부사'
      },
      {
        id: 'frequency_degree_adverbs',
        name: '빈도, 정도 & 시점 부사 (가끔, 자주, 여전히, 앞으로 등)',
        name_id: 'Adverbia Frekuensi & Tingkat (kadang, sering, masih, ke depannya)',
        name_en: 'Frequency & Degree Adverbs (sometimes, often, still, from now on)',
        tag: '부사'
      },
      {
        id: 'modal_speculation_adverbs',
        name: '추측, 가정 & 양태 부사 (혹시나, 아마도, 차라리 등)',
        name_id: 'Adverbia Dugaan & Pengandaian (jangan-jangan, mungkin, lebih baik)',
        name_en: 'Modal & Speculative Adverbs (perhaps, maybe, rather, etc.)',
        tag: '부사'
      },
      {
        id: 'prepositions_directions',
        name: '전치사 & 관계 연결어 (~에 관하여, ~을 통하여 등)',
        name_id: 'Preposisi & Kata Hubung Relasi (tentang, melalui, terhadap, dll.)',
        name_en: 'Prepositions & Relational Links (regarding, through, toward, etc.)',
        tag: '전치사'
      },
      {
        id: 'particles_discourse_markers',
        name: '인도네시아 만능 추임새 & 조동사 (dong, sih, kok, deh, lho 등)',
        name_id: 'Partikel & Kata Bantu Percakapan (dong, sih, kok, deh, lho, dll.)',
        name_en: 'Indonesian Discourse Particles & Auxiliaries (dong, sih, kok, deh, lho)',
        tag: '감탄사/조동사'
      }
    ]
  },
  {
    id: 'emotions_nuances',
    name: '심리, 감정 & 미세 뉘앙스',
    name_id: 'Psikologi, Emosi & Nuansa Halus',
    name_en: 'Psychology, Emotions & Subtle Nuances',
    icon: '💖',
    description: '마음의 상태, 미세한 기분, 성격 및 섬세한 뉘앙스를 표현하는 필수 어휘',
    description_id: 'Kosakata penting untuk mengekspresikan perasaan, suasana hati, dan karakter',
    description_en: 'Essential vocabulary for states of mind, feelings, personality, and subtle nuances',
    subcategories: [
      {
        id: 'deep_emotions',
        name: '깊은 심리 & 감정 (사무치다, 아련하다, 서운하다, 뿌듯하다 등)',
        name_id: 'Psikologi & Emosi Mendalam (terharu, kecewa, bangga, rindu, dll.)',
        name_en: 'Deep Psychology & Emotions (touched, wistful, hurt, proud, etc.)',
        tag: '형용사'
      },
      {
        id: 'personality_attitude',
        name: '성격, 태도 & 인간성 (느긋하다, 꼼꼼하다, 뻔뻔하다, 겸손하다 등)',
        name_id: 'Kepribadian & Sikap (santai, teliti, rendah hati, dll.)',
        name_en: 'Personality & Attitude (easygoing, meticulous, humble, etc.)',
        tag: '형용사'
      },
      {
        id: 'senses_and_states',
        name: '감각, 맛 & 분위기 (얼큰하다, 쌉싸름하다, 눅눅하다, 쾌적하다 등)',
        name_id: 'Indra, Rasa & Suasana (pedas segar, pahit, lembap, nyaman, dll.)',
        name_en: 'Senses, Taste & Atmosphere (spicy-rich, bitter, humid, pleasant, etc.)',
        tag: '형용사'
      }
    ]
  },
  {
    id: 'affix_verbs',
    name: '어근(Kata Dasar) 접사 파생 동사',
    name_id: 'Kata Kerja Turunan Berimbuhan (Kata Dasar)',
    name_en: 'Root (Kata Dasar) & Affix Derived Verbs',
    icon: '🌳',
    description: '인도네시아어의 심장인 어근과 접사(me-, di-, ter-, ber-, -kan, -i) 체계',
    description_id: 'Sistem kata dasar dan imbuhan (me-, di-, ter-, ber-, -kan, -i) Bahasa Indonesia',
    description_en: 'Core Indonesian root words and affixation system (me-, di-, ter-, ber-, -kan, -i)',
    subcategories: [
      {
        id: 'me_active_verbs',
        name: 'me-N- 계열 능동 타동사 (행동 주체)',
        name_id: 'Kata Kerja Aktif Transitif me-N- (Pelaku Tindakan)',
        name_en: 'me-N- Active Transitive Verbs (Agent of Action)',
        tag: '동사'
      },
      {
        id: 'di_ter_passive_verbs',
        name: 'di- / ter- 계열 피동 & 무의식 동사 (나도 모르게 ~되다)',
        name_id: 'Kata Kerja Pasif & Tak Sengaja di- / ter-',
        name_en: 'di- / ter- Passive & Accidental Verbs',
        tag: '동사'
      },
      {
        id: 'ber_intransitive_verbs',
        name: 'ber- 계열 자동사 & 상호 동사 (서로 ~하다)',
        name_id: 'Kata Kerja Intransitif & Resiprokal ber-',
        name_en: 'ber- Intransitive & Reciprocal Verbs',
        tag: '동사'
      },
      {
        id: 'causative_locative_verbs',
        name: 'me-kan / me-i 계열 사동 및 처소 동사 (~하게 만들다)',
        name_id: 'Kata Kerja Kausatif & Lokatif me-kan / me-i',
        name_en: 'me-kan / me-i Causative & Locative Verbs',
        tag: '동사'
      }
    ]
  },
  {
    id: 'slang_daily_spoken',
    name: '실전 구어, 슬랭 & 생활 회화',
    name_id: 'Bahasa Lisan, Gaul (Slang) & Percakapan Harian',
    name_en: 'Colloquialisms, Slang & Daily Conversation',
    icon: '🗣️',
    description: '현지 인도네시아인들이 일상과 메신저에서 매일 쓰는 실전 표현',
    description_id: 'Ekspresi nyata yang digunakan penutur asli setiap hari dan di chat',
    description_en: 'Real-world expressions used daily by locals in speech and messaging',
    subcategories: [
      {
        id: 'slang_abbreviations',
        name: '자카르타 슬랭(Bahasa Gaul) & 채팅 줄임말 (gpp, mager, baper 등)',
        name_id: 'Bahasa Gaul Jakarta & Singkatan Chat (gpp, mager, baper, dll.)',
        name_en: 'Jakarta Slang (Bahasa Gaul) & Chat Abbreviations (gpp, mager, baper)',
        tag: '구어'
      },
      {
        id: 'daily_life_survival',
        name: '식당, 쇼핑, 흥정 & 그랩/고젝 만능 어휘',
        name_id: 'Kosakata Restoran, Belanja, Tawar-menawar & Grab/Gojek',
        name_en: 'Dining, Shopping, Bargaining & Grab/Gojek Survival Vocab',
        tag: '회화'
      },
      {
        id: 'business_office_korea_indo',
        name: '직장/비즈니스 실무 회화 & 업무 이메일 어휘',
        name_id: 'Percakapan Bisnis/Kantor & Kosakata Email Kerja',
        name_en: 'Business/Office Conversation & Work Email Vocabulary',
        tag: '비즈니스'
      }
    ]
  },
  {
    id: 'bipa_levels',
    name: 'BIPA 공인 등급 & 필수 주제',
    name_id: 'Tingkatan Resmi BIPA & Topik Esensial',
    name_en: 'Official BIPA Levels & Essential Topics',
    icon: '🎓',
    description: '인도네시아 정부 공인 교육 과정(BIPA 1~6) 및 주제별 핵심 어휘',
    description_id: 'Kurikulum resmi pemerintah Indonesia (BIPA 1~6) & kosakata inti per topik',
    description_en: 'Official Indonesian curriculum (BIPA 1–6) & core vocabulary by topic',
    subcategories: [
      {
        id: 'bipa_beginner',
        name: 'BIPA 1~2 (기초/초급 필수 뼈대 어휘)',
        name_id: 'BIPA 1~2 (Kosakata Dasar & Pemula)',
        name_en: 'BIPA 1–2 (Beginner Core Vocabulary)',
        tag: 'BIPA 초급'
      },
      {
        id: 'bipa_intermediate',
        name: 'BIPA 3~4 (중급 실전 회화 & 논리 어휘)',
        name_id: 'BIPA 3~4 (Kosakata Menengah & Percakapan Praktis)',
        name_en: 'BIPA 3–4 (Intermediate Conversation & Logic Vocab)',
        tag: 'BIPA 중급'
      },
      {
        id: 'bipa_advanced',
        name: 'BIPA 5~6 (고급 시사, 학술 & 미디어 어휘)',
        name_id: 'BIPA 5~6 (Kosakata Lanjutan, Akademik & Media)',
        name_en: 'BIPA 5–6 (Advanced Current Affairs, Academic & Media)',
        tag: 'BIPA 고급'
      }
    ]
  }
];

export const getCategoryDisplayName = (cat, userLang = 'ko') => {
  if (!cat) return '';
  if (userLang === 'id') return cat.name_id || cat.name;
  if (userLang === 'en') return cat.name_en || cat.name;
  return cat.name;
};

export const getCategoryDisplayDesc = (cat, userLang = 'ko') => {
  if (!cat) return '';
  if (userLang === 'id') return cat.description_id || cat.description;
  if (userLang === 'en') return cat.description_en || cat.description;
  return cat.description;
};

export const getSubcategoryDisplayName = (sub, userLang = 'ko') => {
  if (!sub) return '';
  if (userLang === 'id') return sub.name_id || sub.name;
  if (userLang === 'en') return sub.name_en || sub.name;
  return sub.name;
};
