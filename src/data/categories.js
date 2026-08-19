/**
 * 인코(Inko) 인도네시아어 오프라인 사전 카테고리 체계
 * 실생활 회화에 직결되는 연결어, 부사, 전치사, 감정 뉘앙스 등을 최우선으로 세분화
 */

export const OFFLINE_CATEGORIES = [
  {
    id: 'discourse',
    name: '문장 연결 & 담화 표지',
    icon: '🔗',
    description: '말문이 트이고 문장을 자연스럽게 이어주는 접속사, 부사, 전치사, 추임새',
    subcategories: [
      { id: 'logic_connectors', name: '논리 & 인과 접속사 (하지만, 그러므로, 반면에 등)', tag: '접속사' },
      { id: 'time_trigger_adverbs', name: '시간, 전환 & 계기 부사 (갑자기, 어쩌다, 원래, 결국 등)', tag: '부사' },
      { id: 'frequency_degree_adverbs', name: '빈도, 정도 & 시점 부사 (가끔, 자주, 여전히, 앞으로 등)', tag: '부사' },
      { id: 'modal_speculation_adverbs', name: '추측, 가정 & 양태 부사 (혹시나, 아마도, 차라리 등)', tag: '부사' },
      { id: 'prepositions_directions', name: '전치사 & 관계 연결어 (~에 관하여, ~을 통하여 등)', tag: '전치사' },
      { id: 'particles_discourse_markers', name: '인도네시아 만능 추임새 & 조동사 (dong, sih, kok, deh, lho 등)', tag: '감탄사/조동사' }
    ]
  },
  {
    id: 'emotions_nuances',
    name: '심리, 감정 & 미세 뉘앙스',
    icon: '💖',
    description: '마음의 상태, 미세한 기분, 성격 및 섬세한 뉘앙스를 표현하는 필수 어휘',
    subcategories: [
      { id: 'deep_emotions', name: '깊은 심리 & 감정 (사무치다, 아련하다, 서운하다, 뿌듯하다 등)', tag: '형용사' },
      { id: 'personality_attitude', name: '성격, 태도 & 인간성 (느긋하다, 꼼꼼하다, 뻔뻔하다, 겸손하다 등)', tag: '형용사' },
      { id: 'senses_and_states', name: '감각, 맛 & 분위기 (얼큰하다, 쌉싸름하다, 눅눅하다, 쾌적하다 등)', tag: '형용사' }
    ]
  },
  {
    id: 'affix_verbs',
    name: '어근(Kata Dasar) 접사 파생 동사',
    icon: '🌳',
    description: '인도네시아어의 심장인 어근과 접사(me-, di-, ter-, ber-, -kan, -i) 체계',
    subcategories: [
      { id: 'me_active_verbs', name: 'me-N- 계열 능동 타동사 (행동 주체)', tag: '동사' },
      { id: 'di_ter_passive_verbs', name: 'di- / ter- 계열 피동 & 무의식 동사 (나도 모르게 ~되다)', tag: '동사' },
      { id: 'ber_intransitive_verbs', name: 'ber- 계열 자동사 & 상호 동사 (서로 ~하다)', tag: '동사' },
      { id: 'causative_locative_verbs', name: 'me-kan / me-i 계열 사동 및 처소 동사 (~하게 만들다)', tag: '동사' }
    ]
  },
  {
    id: 'slang_daily_spoken',
    name: '실전 구어, 슬랭 & 생활 회화',
    icon: '🗣️',
    description: '현지 인도네시아인들이 일상과 메신저에서 매일 쓰는 실전 표현',
    subcategories: [
      { id: 'slang_abbreviations', name: '자카르타 슬랭(Bahasa Gaul) & 채팅 줄임말 (gpp, mager, baper 등)', tag: '구어' },
      { id: 'daily_life_survival', name: '식당, 쇼핑, 흥정 & 그랩/고젝 만능 어휘', tag: '회화' },
      { id: 'business_office_korea_indo', name: '직장/비즈니스 실무 회화 & 업무 이메일 어휘', tag: '비즈니스' }
    ]
  },
  {
    id: 'bipa_levels',
    name: 'BIPA 공인 등급 & 필수 주제',
    icon: '🎓',
    description: '인도네시아 정부 공인 교육 과정(BIPA 1~6) 및 주제별 핵심 어휘',
    subcategories: [
      { id: 'bipa_beginner', name: 'BIPA 1~2 (기초/초급 필수 뼈대 어휘)', tag: 'BIPA 초급' },
      { id: 'bipa_intermediate', name: 'BIPA 3~4 (중급 실전 회화 & 논리 어휘)', tag: 'BIPA 중급' },
      { id: 'bipa_advanced', name: 'BIPA 5~6 (고급 시사, 학술 & 미디어 어휘)', tag: 'BIPA 고급' }
    ]
  }
];
