/**
 * 애플리케이션 버전 정보 및 패치 내역 (업데이트 히스토리)
 * GitHub에 푸시(업데이트)할 때마다 반드시 CURRENT_VERSION 숫자를 올리고
 * PATCH_NOTES 배열 최상단에 최신 수정 내역을 추가합니다.
 */

export const CURRENT_VERSION = 'v20.17';
export const CURRENT_VERSION_DATE = '2026-10-30';
export const CURRENT_VERSION_SUMMARY = "3개 국어(한국어/인니어/영어) 전면 번역 완성 & 학습 3종 모드(카드·객관식·스펠링) 버그 수정 및 고도화";

export const getVersionSummary = (lang = 'ko') => {
  if (lang === 'id') return 'Terjemahan 3 Bahasa (KO/ID/EN) Lengkap & Perbaikan 3 Mode Belajar (Kartu·Pilihan Ganda·Ejaan)';
  if (lang === 'en') return 'Full 3-Language (KO/ID/EN) Localization & 3 Study Modes (Flashcard·Quiz·Spelling) Overhaul';
  return CURRENT_VERSION_SUMMARY;
};

export const PATCH_NOTES = [
  {
    version: 'v20.17',
    date: '2026-10-30',
    badge: 'LATEST',
    title: "3개 국어(한국어·인도네시아어·영어) 전면 현지화 완성 & 학습하기 3대 모드 완벽 버그 수정 및 개선",
    title_id: "Lokalisasi 3 Bahasa (KO/ID/EN) Lengkap & Perbaikan Total 3 Mode Belajar",
    title_en: "Complete 3-Language (KO/ID/EN) Localization & Overhaul of All 3 Study Modes",
    highlights: [
      "🌐 한국어(ko), 인도네시아어(id), 영어(en) 3개 국어 미번역 항목(메뉴, 1만단어 사전, 카테고리/소분류, AI 생성, 토큰 계산기, 로그인, 번역, 알림창 등) 100% 번역 완료",
      "🎯 [객관식 퀴즈 버그 수정] 퀴즈 진행 중 타이머 중첩 및 클로저 참조 문제로 선택지가 4개 이상 늘어나거나 중복되던 치명적 버그 완벽 해결 (항상 중복 없는 정확한 4지선다 보장)",
      "🔄 [객관식 퀴즈 개선] 문제 출제 방향 선택 기능(단어➔뜻 / 뜻➔단어 / 랜덤 혼합) 추가 및 내 단어장이 적을 때도 오프라인 사전과 연동해 4지선다 오답 보기 자동 구성",
      "🃏 [플래시카드 개선] 단어 뒤의 [[발음기호]] 태그 노출 제거, 카드 전환 시 자동 발음 재생(On/Off 토글 지원), 예문 단어 클릭 시 카드가 뒤집히지 않고 단어 뜻 툴팁이 정상 표시되도록 수정, 이전 카드 돌아가기 버튼 추가",
      "✍️ [주관식 스펠링 개선] 모바일 키보드 완벽 호환 입력창 제공, '💡 1글자 힌트' 버튼 추가, 발음기호 태그 자동 제거 및 인라인 정오답 피드백 적용",
      "🏆 학습 세션 완료 시 최종 점수·정답률 요약 리포트 및 즉시 재학습 화면 추가"
    ],
    highlights_id: [
      "🌐 Terjemahan 100% lengkap untuk Bahasa Indonesia, Inggris, dan Korea di seluruh menu, Kamus 10K, kategori, pembuatan AI, kalkulator token, dan peringatan",
      "🎯 [Perbaikan Kuis Pilihan Ganda] Memperbaiki bug di mana pilihan jawaban bertambah lebih dari 4 atau duplikat (sekarang dijamin selalu 4 pilihan unik)",
      "🔄 [Peningkatan Kuis] Menambahkan opsi arah kuis (Kata➔Arti / Arti➔Kata / Campuran Acak)",
      "🃏 [Peningkatan Kartu Kata] Menghapus tag [[pelafalan]], menambahkan putar suara otomatis (On/Off), memperbaiki klik kata pada kalimat contoh, dan tombol kembali ke kartu sebelumnya",
      "✍️ [Peningkatan Tes Ejaan] Input ramah keyboard ponsel, tombol '💡 Petunjuk 1 Huruf', dan umpan balik visual langsung",
      "🏆 Menambahkan layar ringkasan skor & akurasi saat sesi belajar selesai"
    ],
    highlights_en: [
      "🌐 Completed 100% localization across Korean, Indonesian, and English for all menus, 10K Dictionary, categories, AI generator, token calculator, and alerts",
      "🎯 [Multiple Choice Quiz Fix] Fixed bug where options exceeded 4 or duplicated due to overlapping timers and stale closures (strictly 4 unique options guaranteed)",
      "🔄 [Quiz Improvement] Added quiz direction selector (Word➔Meaning / Meaning➔Word / Random Mix)",
      "🃏 [Flashcard Improvement] Stripped [[pronunciation]] tags, added auto-audio playback toggle, fixed example sentence word tooltip click propagation, and added Previous Card button",
      "✍️ [Spelling Improvement] Added mobile-friendly input box, '💡 1-Letter Hint' button, and inline visual feedback",
      "🏆 Added session completion summary screen with score and accuracy stats"
    ]
  },
  {
    version: 'v20.16',
    date: '2026-10-30',
    badge: 'UPDATE',
    title: "단어장 '주제별/문법별' 분류 조회 완벽 복원 & 패치 내역 시스템 신설",
    title_id: "Pemulihan Kategori 'Per Topik/Kelas Kata' & Sistem Catatan Pembaruan",
    title_en: "Restored 'By Topic / By Grammar' Wordbook Views & Added Patch Notes System",
    highlights: [
      "📚 단어장 '문법별(품사별)' 폴더 그리드 화면이 표시되지 않던 렌더링 누락 버그 완벽 수정",
      "🧠 동사/타동사/자동사/verb 등 다양한 형태의 품사 데이터를 표준 품사(명사, 동사, 형용사, 부사 등)로 자동 정규화하여 문법별 분류 정확도 향상",
      "🏷️ AI 단어 생성 및 캐시 로드 시 '주제(topic)'와 '품사(pos)' 메타데이터가 누락 없이 100% 저장되도록 생성 파이프라인 강화",
      "✍️ 단어 '수동 입력' 모드에 주제(카테고리) 입력란 및 문법(품사) 선택 드롭다운 추가",
      "🧭 단어장 폴더 진입 시 상단에 현재 보고 있는 분류(생성일/주제/문법)와 단어 개수를 보여주는 위치 표시 바(Breadcrumb) 및 각 단어 카드의 주제 뱃지(🏷️) 추가",
      "📋 설정 탭 내 실시간 버전 숫자 표시 및 업데이트별 상세 수정 사항을 한눈에 확인할 수 있는 '패치 내역(업데이트 기록)' 조회 시스템 탑재"
    ]
  },
  {
    version: 'v20.15',
    date: '2026-09-22',
    badge: 'CLOUD',
    title: "1만 단어장 카테고리별 선택 백업 & 구글 클라우드 동기화 탑재",
    highlights: [
      "☁️ 1만 단어 사전의 '문장 연결 & 담화 표지' 등 원하는 카테고리만 선택하여 CSV 또는 구글 드라이브로 개별 백업/복원하는 기능 구현",
      "🔄 1만 단어 사전 전용 구글 드라이브 클라우드 백업 및 불러오기 동기화 안정화"
    ]
  },
  {
    version: 'v20.13 ~ v20.14',
    date: '2026-09-22',
    badge: 'FIX',
    title: "단어 일괄 생성 토큰 누적 합산 및 요금 통계 정확도 개선",
    highlights: [
      "🪙 단어 일괄 생성 시 입출력 토큰 누적 합산이 누락되던 현상 해결",
      "📊 실제 발생 요금 안내 팝업 및 설정 탭 내 누적 사용량 통계 저장 정상화"
    ]
  },
  {
    version: 'v20.12',
    date: '2026-09-22',
    badge: 'COST',
    title: "AI 모델별 실시간 토큰/요금 계산기 및 누적 사용량 대시보드",
    highlights: [
      "💰 실행 전 예상 토큰/요금 사전 확인 팝업 및 완료 후 실제 발생 요금 안내 팝업 구현",
      "📈 설정 탭 내 작업별(단어생성/재생성/특강/TTS) 누적 토큰 사용량 및 한화(₩)/루피아(Rp) 환산 대시보드 및 초기화 기능 추가",
      "📋 구글 공식 가격표 및 모델 설명 탑재, 비용 안내 On/Off 토글 스위치 제공"
    ]
  },
  {
    version: 'v20.10 ~ v20.11',
    date: '2026-09-22',
    badge: 'LECTURE',
    title: "스타강사 AI 특강 무중단 연속 재생 & 현지 구어체 회화 팁 강화",
    highlights: [
      "🎓 선택한 여러 단어의 스타강사 특강을 끊김 없이 차례대로 청취하는 '특강 연속 듣기' 기능 탑재",
      "🗣️ 현지 원어민 구어체 회화 팁 강의 슬라이드 프롬프트 강화 및 기본 TTS 엔진 완벽 호환"
    ]
  },
  {
    version: 'v20.08 ~ v20.09',
    date: '2026-09-22',
    badge: 'TTS & AI',
    title: "TTS 발음 기호 정제 필터 및 AI 재생성 JSON 자동 복구 파서",
    highlights: [
      "🔊 단어 뒤의 한글 발음 표기([[...]])를 TTS가 읽지 않도록 사전 정제 필터 적용 및 숙어 전체 발음 보장",
      "🛠️ AI 단어 재생성 시 JSON 따옴표 누락 오류 자동 복구 파서 및 2단계 자동 재시도 로직 적용"
    ]
  }
];
