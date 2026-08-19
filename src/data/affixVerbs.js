/**
 * 대분류 3: 어근(Kata Dasar) 접사 파생 동사 (Affix Verbs)
 * me-N- 능동사, di-/ter- 피동 및 무의식사, ber- 자동사/상호사, -kan/-i 사동/처소사
 */

export const affixVerbs = [
  // --- [소분류 3-1: me-N- 계열 능동 타동사] ---
  {
    id: 'aff_001',
    category_id: 'affix_verbs',
    subcategory_id: 'me_active_verbs',
    word: 'mengambil [[멍암빌]]',
    meaning: '가지고 가다, 챙기다, 취하다',
    pos: '동사',
    root: 'ambil',
    affix_logic: '접두사 me- + 어근 ambil(모음 a로 시작) ➔ meng-ambil로 결합',
    grammar_rule: '타동사로 뒤에 직접 목적어가 바로 따라옵니다. 일상 구어에서는 접두사를 생략하고 ambil로 쓰기도 합니다.',
    synonym: 'meraih (손에 쥐다), memungut (줍다)',
    antonym: 'memberi (주다), menaruh (놓다/두다)',
    context: '물건을 집어가거나, 수업을 수강(mengambil kelas)하거나, 휴가를 낼 때(mengambil cuti) 널리 씁니다.',
    caution: 'ambil 앞에 접두사 meng-이 붙을 때 철자 탈락 없이 그대로 meng- + ambil이 됩니다.',
    related: '어근 ambil(취하다)에 meng-이 붙은 표준 능동형! 일상 회화 최다 빈출 동사.',
    example_formal: 'Perusahaan harus mengambil langkah tegas untuk mengatasi krisis finansial ini.',
    example_formal_kr: '회사는 이 재정 위기를 극복하기 위해 단호한 조치를 취해야 합니다.',
    example_casual: 'Tolong ambilin dompet gue yang ketinggalan di meja dong.',
    example_casual_kr: '테이블에 두고 온 내 지갑 좀 챙겨서 갖다줘 제발.',
    word_breakdown: [
      { word: 'Perusahaan', meaning: '회사' },
      { word: 'harus', meaning: '해야 한다' },
      { word: 'mengambil langkah tegas', meaning: '단호한 조치를 취하다' },
      { word: 'untuk', meaning: '~하기 위해' },
      { word: 'mengatasi', meaning: '극복하다/해결하다' },
      { word: 'krisis finansial ini', meaning: '이 재정 위기' }
    ]
  },
  {
    id: 'aff_002',
    category_id: 'affix_verbs',
    subcategory_id: 'me_active_verbs',
    word: 'memperbaiki [[멈뻐르바이끼]]',
    meaning: '수리하다, 고치다, 개선하다',
    pos: '동사',
    root: 'baik',
    affix_logic: '접두사 mem- + per- + 어근 baik(좋은) + 접미사 -i ➔ mem-per-baik-i',
    grammar_rule: '복합 접사 memper-...-i는 어떤 상태를 "더 좋게 만들다/수선하다"라는 의미를 지닙니다.',
    synonym: 'membetulkan (바로잡다), merenovasi (보수하다)',
    antonym: 'merusak (망가뜨리다/훼손하다)',
    context: '고장 난 기계를 수리하거나, 나쁜 시스템이나 관계를 개선하고 바로잡을 때 씁니다.',
    caution: '어근 baik(좋은)에 접사가 3개나 붙은 구조이므로 어근 추출 연습에 매우 좋은 단어입니다.',
    related: 'baik(좋다) ➔ perbaiki(고쳐라) ➔ memperbaiki(더 좋게 고치다)!',
    example_formal: 'Pemerintah daerah sedang memperbaiki jembatan yang rusak akibat banjir.',
    example_formal_kr: '지방 정부는 홍수로 파손된 다리를 현재 보수(수리)하고 있습니다.',
    example_casual: 'HP gue rusak nih, lu tau tempat servis yang bagus buat benerin ini nggak?',
    example_casual_kr: '나 핸드폰 고장 났는데, 이거 고칠 만한 괜찮은 서비스센터 알아?',
    word_breakdown: [
      { word: 'Pemerintah daerah', meaning: '지방 정부' },
      { word: 'sedang', meaning: '~하는 중이다' },
      { word: 'memperbaiki', meaning: '수리하다/보수하다' },
      { word: 'jembatan yang rusak', meaning: '파손된 다리' },
      { word: 'akibat banjir', meaning: '홍수로 인한' }
    ]
  },

  // --- [소분류 3-2: di- / ter- 계열 피동 & 무의식 동사] ---
  {
    id: 'aff_003',
    category_id: 'affix_verbs',
    subcategory_id: 'di_ter_passive_verbs',
    word: 'terbawa [[뜨르바와]]',
    meaning: '나도 모르게 휩쓸리다, 엉겁결에 가져가 버리다',
    pos: '동사',
    root: 'bawa',
    affix_logic: '무의식/우발적 접두사 ter- + 어근 bawa(가져오다/나르다)',
    grammar_rule: '고의가 아니라 실수나 감정에 휘말려 무의식중에 행동이 일어났음을 나타냅니다.',
    synonym: 'terhanyut (분위기에 휩쓸리다), terseret (끌려가다)',
    antonym: 'sengaja membawa (일부러 가져가다)',
    context: '"분위기에 휩쓸리다(terbawa suasana)", "남의 우산을 실수로 들고 오다(payung terbawa)" 등.',
    caution: 'ter- 접두사는 최상급(terbaik)의 뜻도 있지만 동사에 붙으면 90% "무의식/우발적 실수"를 뜻합니다!',
    related: 'bawa(가져오다) + ter-(나도 모르게) ➔ terbawa suasana (분위기에 홀려버림)!',
    example_formal: 'Kita tidak boleh terbawa emosi saat mengambil keputusan strategis.',
    example_formal_kr: '우리는 전략적 결정을 내릴 때 감정에 휩쓸려서는 안 됩니다.',
    example_casual: 'Aduh maaf, pulpen lu tadi kebawa sama gue pulang!',
    example_casual_kr: '어머 미안, 아까 네 볼펜 내가 깜빡하고 집에 들고 와버렸어!',
    word_breakdown: [
      { word: 'Kita', meaning: '우리는' },
      { word: 'tidak boleh', meaning: '~해서는 안 된다' },
      { word: 'terbawa emosi', meaning: '감정에 휩쓸리다' },
      { word: 'saat', meaning: '~할 때' },
      { word: 'mengambil keputusan strategis', meaning: '전략적 결정을 내리다' }
    ]
  },
  {
    id: 'aff_004',
    category_id: 'affix_verbs',
    subcategory_id: 'di_ter_passive_verbs',
    word: 'terkejut [[뜨르끄줏]]',
    meaning: '깜짝 놀라다, 화들짝 놀라다',
    pos: '동사, 형용사',
    root: 'kejut',
    affix_logic: '순간적/피동 접두사 ter- + 어근 kejut(놀람)',
    grammar_rule: '불의의 자극에 반사적으로 깜짝 놀란 심리적 상태를 표현합니다.',
    synonym: 'kaget (놀라다 - 구어), terperanjat (소스라치게 놀라다)',
    antonym: 'tenang (차분한), santai (태연한)',
    context: '갑작스러운 굉음이나 뉴스, 예상 밖의 일에 크게 놀랐을 때 쓰는 표준어.',
    caution: '구어체에서는 kaget을 압도적으로 많이 쓰며, 뉴스나 문서에서는 terkejut을 씁니다.',
    related: 'kaget(놀라다)의 우아한 격식 표준어 버전 = Terkejut!',
    example_formal: 'Publik terkejut mendengar pengumuman kenaikan harga bahan bakar minyak.',
    example_formal_kr: '대중들은 유류비 인상 발표를 듣고 깜짝 놀랐습니다.',
    example_casual: 'Gue kaget banget pas lu tiba-tiba nepuk bahu gue dari belakang.',
    example_casual_kr: '네가 갑자기 뒤에서 내 어깨 쳤을 때 나 진짜 간 떨어질 뻔했잖아(놀랐잖아).',
    word_breakdown: [
      { word: 'Publik', meaning: '대중들' },
      { word: 'terkejut', meaning: '깜짝 놀라다' },
      { word: 'mendengar', meaning: '듣고' },
      { word: 'pengumuman', meaning: '공표/발표' },
      { word: 'kenaikan harga', meaning: '가격 인상' },
      { word: 'bahan bakar minyak', meaning: '석유 연료' }
    ]
  },

  // --- [소분류 3-3: ber- 계열 자동사 & 상호 동사] ---
  {
    id: 'aff_005',
    category_id: 'affix_verbs',
    subcategory_id: 'ber_intransitive_verbs',
    word: 'berdiskusi [[버르디스꾸시]]',
    meaning: '토론하다, 상의하다, 논의하다',
    pos: '동사',
    root: 'diskusi',
    affix_logic: '자동사/행위 주체 접두사 ber- + 명사 어근 diskusi(토론)',
    grammar_rule: '목적어 없이 쓰이는 자동사이며, 대상을 지정할 때는 전치사 dengan(~와) 또는 tentang(~에 대해)과 함께 씁니다.',
    synonym: 'bermusyawarah (협의하다), membicarakan (논의하다)',
    antonym: 'berdebat keras (언쟁하다/말다툼하다)',
    context: '팀원들과 업무 방향을 상의하거나 다 함께 건설적인 의견을 나눌 때.',
    caution: '뒤에 바로 명사가 오지 못하고 반드시 berdiskusi tentang ~ 형태로 전치사가 와야 합니다.',
    related: 'diskusi(토론)라는 명사에 ber-를 붙여 동사화! "상호 협의"의 뉘앙스.',
    example_formal: 'Tim pengembang sedang berdiskusi mengenai arsitektur sistem yang baru.',
    example_formal_kr: '개발팀은 현재 새로운 시스템 아키텍처에 관하여 심도 있게 논의하고 있습니다.',
    example_casual: 'Yuk kita diskusi bentar soal rencana liburan minggu depan.',
    example_casual_kr: '우리 다음 주 휴가 계획에 대해 잠깐 얘기 좀 나누자.',
    word_breakdown: [
      { word: 'Tim pengembang', meaning: '개발팀' },
      { word: 'sedang berdiskusi', meaning: '논의하는 중이다' },
      { word: 'mengenai', meaning: '~에 관하여' },
      { word: 'arsitektur sistem', meaning: '시스템 아키텍처' },
      { word: 'yang baru', meaning: '새로운' }
    ]
  },

  // --- [소분류 3-4: me-kan / me-i 계열 사동 및 처소 동사] ---
  {
    id: 'aff_006',
    category_id: 'affix_verbs',
    subcategory_id: 'causative_locative_verbs',
    word: 'memastikan [[머마스띠깐]]',
    meaning: '확인하다, 확실하게 만들다, 보장하다',
    pos: '동사',
    root: 'pasti',
    affix_logic: '접두사 mem- + 어근 pasti(확실한: p탈락) + 사동 접미사 -kan',
    grammar_rule: '어근 pasti의 첫 글자 p가 탈락하여 mem-asti-kan이 되며, 뒤에 절(bahwa~)이나 명사를 취합니다.',
    synonym: 'mengecek (확인하다), menjamin (보증하다)',
    antonym: 'meragukan (의심하다)',
    context: '일정 확인, 안전 점검, 비즈니스 계약 조건의 확약 등 실무에서 하루 10번 이상 쓰는 단어.',
    caution: 'pasti의 p가 탈락하는 인도네시아 접사 규칙(K, T, S, P 탈락 법칙)의 대표 예시입니다!',
    related: 'pasti(확실하다) ➔ memastikan(확실하게 확인하다)! KTSP 탈락 법칙 암기!',
    example_formal: 'Manajer memastikan bahwa seluruh dokumen telah ditandatangani dengan benar.',
    example_formal_kr: '매니저는 모든 서류가 올바르게 서명되었음을 확실하게 확인했습니다.',
    example_casual: 'Tolong pastiin pintu udah dikunci sebelum lu tidur ya.',
    example_casual_kr: '너 자기 전에 문 잠겼는지 확실히 꼭 확인해 줘.',
    word_breakdown: [
      { word: 'Manajer', meaning: '관리자/매니저' },
      { word: 'memastikan', meaning: '확인하다/확실히 하다' },
      { word: 'bahwa', meaning: '~라는 점을' },
      { word: 'seluruh dokumen', meaning: '모든 서류가' },
      { word: 'telah ditandatangani', meaning: '이미 서명되었다' },
      { word: 'dengan benar', meaning: '올바르게' }
    ]
  }
];
