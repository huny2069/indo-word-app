/**
 * 애플리케이션 버전 정보 및 패치 내역 (업데이트 히스토리)
 * GitHub에 푸시(업데이트)할 때마다 반드시 CURRENT_VERSION 숫자를 올리고
 * PATCH_NOTES 배열 최상단에 최신 수정 내역을 추가합니다.
 */

export const CURRENT_VERSION = 'v20.25';
export const CURRENT_VERSION_DATE = '2026-11-01';
export const CURRENT_VERSION_SUMMARY = "단어생성 프롬프트 및 엔진을 1만단어 AI 정밀 재생성 품질 기준으로 전면 통일 및 최적화";

export const getVersionSummary = (lang = 'ko') => {
  if (lang === 'id') return 'Penyelarasan Prompt Pembuatan Kata Sesuai Standar Regenerasi Presisi AI Kamus 10K';
  if (lang === 'en') return 'Word Generation Prompt & Engine Standardized to 10K Dictionary Precision Quality';
  return CURRENT_VERSION_SUMMARY;
};

export const PATCH_NOTES = [
  {
    version: 'v20.25',
    date: '2026-11-01',
    badge: 'UPDATE',
    title: "단어생성 프롬프트 및 엔진을 1만단어 AI 정밀 재생성 품질 기준으로 전면 통일 및 최적화",
    title_id: "Penyelarasan Prompt Pembuatan Kata Sesuai Standar Regenerasi Presisi AI Kamus 10K",
    title_en: "Word Generation Prompt & Engine Standardized to 10K Dictionary Precision Quality",
    highlights: [
      "🔥 [단어생성 프롬프트 100% 품질 격상] 1만단어 사전의 [AI 정밀 재생성]과 완벽히 동일한 '1타 스타 강사 심층 분석' 가이드를 단어생성 프롬프트에 이식하여, 어근(Kata Dasar)·문법 접사 파생 메커니즘·실전 상황·주의점·연상 암기 비법이 동일한 깊이로 생성되도록 개선",
      "⚡ [5단어 정밀 분할 배치 생성(Micro-Batching)] 단어 개수(10~30개)를 많이 요청할 때 LLM 응답 길이 한계로 인해 문법이나 팁 설명이 한 줄로 압축·요약되던 문제를 방지하기 위해, 최대 5단어 단위 정밀 분할 배치 및 2회 자동 재시도 로직 구축",
      "🧹 [Supabase 캐시 엄격 필터링] 단어생성 메뉴에서 구버전의 부실한 캐시 단어가 섞여 나오던 문제를 방지하도록 필수 13개 필드가 온전히 갖춰진 고품질 데이터만 캐시로 인정하고, 미달 데이터는 최신 AI로 실시간 신규 생성하도록 로직 강화"
    ],
    highlights_id: [
      "🔥 [Standar Prompt Pembuatan Kata Disetarakan] Mengadopsi standar regenerasi presisi AI Kamus 10K ke dalam menu pembuatan kata untuk hasil analisis kata yang jauh lebih mendalam",
      "⚡ [Micro-Batching 5 Kata] Mencegah peringkasan teks oleh LLM dengan membagi permintaan pembuatan kata per 5 kata secara presisi",
      "🧹 [Penyaringan Cache Ketat] Hanya menerima kata cache yang memiliki 13 atribut lengkap, data lama yang kurang lengkap akan diganti dengan pembuatan AI langsung"
    ],
    highlights_en: [
      "🔥 [Word Generation Prompt Standardized] Upgraded word generation prompt to match the exact top-tier standards of the 10K dictionary AI precision regeneration",
      "⚡ [5-Word Micro-Batching] Eliminated token compression and field abbreviation by chunking multi-word generation into 5-word batches with automatic retries",
      "🧹 [Strict Cache Quality Filter] Filtered out shallow legacy cached entries so that only full-featured entries with complete grammar rules and breakdowns are accepted"
    ]
  },
  {
    version: 'v20.24',
    date: '2026-11-01',
    badge: 'UPDATE',
    title: "다국어 UI 버튼 번역 및 토큰 대시보드 완벽 연동, Vercel 프리뷰 빌드 및 봇 방문 필터링 최적화",
    title_id: "Lokalisasi Tombol UI & Dashboard Token Lengkap, Perbaikan Build Vercel & Filter Bot Otomatis",
    title_en: "Full UI Button Localization & Token Dashboard Sync, Vercel Preview Build Fix & Bot Traffic Filtering",
    highlights: [
      "🌐 [버튼 및 사전 컴포넌트 100% 다국어 완벽 지원] CSV 백업/불러오기(set_csv_export/import), AI 재생성 배지 및 버튼, 사전 일괄 추가 및 시크릿 노트 등 UI 키값이 그대로 노출되던 문제를 전면 정비하여 한국어·인도네시아어·영어 사용자 언어에 맞춰 정확하게 번역 및 출력되도록 개선",
      "🪙 [설정 탭 토큰 및 요금 대시보드 동기화] 언어 변경 시 토큰 카드(예상 견적, 단위 표기)와 누적 사용량 대시보드(단가표, 총 소모 토큰, 작업별 상세 내역)가 사용자 선택 언어(KO/ID/EN)에 맞춰 실시간으로 자연스럽게 표시되도록 개선",
      "🛡️ [Vercel 자동 빌드 실패 방지 및 PC 로그 서버 개선] PC 로그 서버의 불필요한 원격 브랜치 자동 푸시 로직을 로컬 안전 저장 방식으로 전환하여 Vercel 프리뷰 배포 빌드 오류(vite build 127) 근본적 차단",
      "🤖 [자동화 크롤러 및 AWS 봇 방문 필터링] Vercel 배포 후 상태 확인을 위해 자동으로 접속하는 HeadlessChrome 및 클라우드 검사 봇을 실시간 활동 로그에서 자동 제외하여 오직 실제 사용자 접속 통계만 정확히 집계되도록 필터링 시스템 구축"
    ],
    highlights_id: [
      "🌐 [Lokalisasi Tombol & Kamus 100%] Memperbaiki tombol cadangan CSV, lencana AI regenerasi, dan catatan rahasia guru agar diterjemahkan sempurna ke dalam ID/KO/EN",
      "🪙 [Sinkronisasi Dashboard Biaya & Token] Kartu estimasi token dan dashboard pemakaian kini responsif mengikuti bahasa yang dipilih pengguna",
      "🛡️ [Perbaikan Build Vercel] Menghilangkan push otomatis cabang yang memicu error build vite pada Vercel",
      "🤖 [Penyaringan Bot Otomatis] Mengabaikan crawler dan bot HeadlessChrome dari pencatatan log statistik"
    ],
    highlights_en: [
      "🌐 [100% UI Button & Dictionary Localization] Fully translated CSV backup/import buttons, AI regenerated badges, and teacher secret notes into KO/ID/EN without raw key exposure",
      "🪙 [Token & Cost Dashboard Real-time Sync] Localized token estimation cards and cumulative usage metrics to reactively reflect the user-selected language",
      "🛡️ [Vercel Preview Build Failure Prevention] Refactored PC log server to store endpoints locally, eliminating unwanted git pushes that triggered Vercel build errors",
      "🤖 [Automated Crawler & Bot Filtering] Excluded headless browsers and Vercel health-check bots from visitor statistics to ensure only real human traffic is recorded"
    ]
  },
  {
    version: 'v20.23',
    date: '2026-11-01',
    badge: 'HOTFIX',
    title: "중앙 통계 페이지 초기 렌더링 참조 오류(ReferenceError) 긴급 수정",
    title_id: "Perbaikan Cepat Kesalahan Referensi (ReferenceError) pada Statistik Pusat",
    title_en: "Hotfix for Central Analytics ReferenceError on Initial Render",
    highlights: [
      "🐛 [중앙 통계 렌더링 런타임 오류 수정] 중앙 통계 컴포넌트 마운트 시 발생하던 ReferenceError: setAuthorized is not defined 오류를 완전히 제거하여 대시보드가 정상 렌더링되도록 수정",
      "⚡ [권한 판별 반응성 최적화] 로그인 계정 상태 변화에 즉시 동기화되도록 반응형 상태 구조 정돈"
    ],
    highlights_id: [
      "🐛 [Perbaikan Bug Runtime Statistik Pusat] Memperbaiki ReferenceError: setAuthorized is not defined agar dashboard dapat dimuat tanpa error",
      "⚡ [Optimalisasi Responsivitas] Menyelaraskan sinkronisasi status login akun admin"
    ],
    highlights_en: [
      "🐛 [Fixed Central Analytics Runtime Crash] Resolved ReferenceError: setAuthorized is not defined on component initialization",
      "⚡ [Reactivity Optimization] Streamlined immediate state synchronization based on authenticated admin session"
    ]
  },
  {
    version: 'v20.22',
    date: '2026-11-01',
    badge: 'UPDATE',
    title: "관리자 권한 계정 식별자 정밀 동기화 및 관리자 보안 시스템 최적화",
    title_id: "Sinkronisasi Presisi Akun Administrator & Optimalisasi Sistem Keamanan Admin",
    title_en: "Precision Admin Account Identifier Synchronization & Security System Optimization",
    highlights: [
      "🔑 [관리자 인증 계정 정밀 동기화] 중앙 통계 및 보안 관리 권한 대상 구글 계정 식별자 정밀 교정 및 동기화 완료",
      "🛡️ [개인정보 마스킹 유지] 공개 패치 내역 및 릴리즈 노트에서 관리자 개인정보가 노출되지 않도록 보안 정화 원칙 지속 적용",
      "🔒 [관리자 전용 대시보드 무중단 보호] 권한 검증 및 세션 유지 로직 안정화"
    ],
    highlights_id: [
      "🔑 [Sinkronisasi Akun Admin Presisi] Menyelaraskan pengenal akun Google administrator untuk akses analitik dan kontrol keamanan",
      "🛡️ [Perlindungan Privasi] Mempertahankan sanitasi informasi sensitif agar tidak muncul di catatan publik",
      "🔒 [Perlindungan Berkelanjutan Dashboard Admin] Menstabilkan verifikasi hak akses dan sesi"
    ],
    highlights_en: [
      "🔑 [Precision Admin Account Sync] Accurately synchronized verified Google account identifiers for analytics and security management",
      "🛡️ [Privacy Protection Preserved] Continued strict sanitization of personal identifiers across release notes",
      "🔒 [Continuous Dashboard Protection] Stabilized administrative permission checks and session states"
    ]
  },
  {
    version: 'v20.21',
    date: '2026-11-01',
    badge: 'UPDATE',
    title: "보안 및 개인정보 보호 강화: 관리자 전용 정보 보호 및 패치 내역 관리자 단독 열람 모드 적용",
    title_id: "Peningkatan Keamanan & Privasi: Perlindungan Informasi Sensitif & Akses Catatan Patch Khusus Admin",
    title_en: "Enhanced Security & Privacy: Sensitive Information Masking & Exclusive Admin Patch Notes Access",
    highlights: [
      "🛡️ [패치 내역 개인정보 및 민감정보 전면 마스킹] 패치 내역 및 버전 정보에서 특정 개인 계정 아이디, 이메일, 민감한 관리자 식별 정보 일체 영구 제거",
      "🔒 [패치 내역 관리자 전용 보호] 상세 업데이트 및 패치 내역(Release Notes) 조회 기능을 관리자 전용으로 전환하여 비인가 사용자로부터 내부 변경 내역 열람 차단",
      "🧭 [중앙 통계 권한 일관성 유지] 중앙 통계 및 보안 제어 기능의 관리자 단독 접근 통제 시스템 완성"
    ],
    highlights_id: [
      "🛡️ [Pembersihan Informasi Sensitif] Menghapus seluruh akun pribadi, ID, dan email dari ringkasan pembaruan dan catatan patch",
      "🔒 [Akses Khusus Admin untuk Catatan Patch] Mengubah tombol dan tampilan Catatan Patch (Release Notes) agar hanya dapat dibuka oleh akun admin",
      "🧭 [Konsistensi Keamanan] Menyelaraskan akses keamanan dashboard pusat dan informasi sistem"
    ],
    highlights_en: [
      "🛡️ [Sensitive Data Sanitization] Completely removed all personal emails, usernames, and sensitive identifiers from public patch notes",
      "🔒 [Admin-Only Patch Notes Access] Restricted detailed patch notes and changelog visibility exclusively to verified administrators",
      "🧭 [Consistent Security Boundary] Maintained strict access boundaries for system analytics and sensitive updates"
    ]
  },
  {
    version: 'v20.20',
    date: '2026-11-01',
    badge: 'UPDATE',
    title: "중앙 통계 보안 강화: 관리자 인증 전용 접근 제어",
    title_id: "Peningkatan Keamanan Statistik Pusat: Kontrol Akses Khusus Admin",
    title_en: "Central Analytics Security Hardening: Exclusive Admin Access Control",
    highlights: [
      "🔒 [중앙 통계 접근 통제 강화] 중앙 통계 페이지 및 메뉴를 등록된 관리자 인증 계정만 조회할 수 있도록 접근 제어 로직 강화",
      "🛡️ [외부 비인가자 접근 차단] 비인가 사용자 접속 시 접근 권한 없음 안내 화면 표시 및 비정상 접근 원천 차단",
      "🧭 [UI 일관성 유지] 상단 내비게이션 바 및 설정 화면의 중앙 통계 메뉴를 관리자 인증 상태에 맞춰 동적 제어"
    ],
    highlights_id: [
      "🔒 [Kontrol Akses Statistik Pusat] Memperketat verifikasi agar dashboard pusat hanya dapat diakses oleh akun admin terverifikasi",
      "🛡️ [Blokir Akses Tidak Sah] Menampilkan layar peringatan dan memblokir upaya akses pengguna umum ke menu statistik",
      "🧭 [Konsistensi UI] Menyesuaikan visibilitas menu statistik pada bilah navigasi sesuai status admin"
    ],
    highlights_en: [
      "🔒 [Analytics Access Control] Enforced strict access verification so only authenticated administrator accounts can view central analytics",
      "🛡️ [Unauthorized Access Rejection] Blocked unauthorized visits with access-denied safeguards",
      "🧭 [UI Consistency] Dynamically toggled central statistics menu items based on verified admin state"
    ]
  },
  {
    version: 'v20.19',
    date: '2026-11-01',
    badge: 'UPDATE',
    title: "100% 무료 중앙 통계 복구 & 접속 IP·국가·로그인 시간·전체 활동 로그 추적 및 내 PC 서버 자동 백업 구축",
    title_id: "Pemulihan Statistik Pusat 100% Gratis & Pelacakan IP, Negara, Waktu Login, Semua Aktivitas + Server Cadangan PC",
    title_en: "100% Free Central Analytics Overhaul & Real-Time IP, Country, Login Time, Full Activity Logging + PC Backup Server",
    highlights: [
      "🛡️ [중앙 통계 완벽 복구 및 고도화] 유료 Supabase 설정 없이도 100% 무료로 즉시 작동하는 통합 중앙 통계(/statistics) 대시보드 전면 재구축 및 관리자 인증 정상화",
      "🌍 [정밀 접속 IP · 국가 · 도시 · 로그인 시각 추적] Vercel Edge Geo-IP(/api/geo) 및 4중 무료 Geo-IP 엔진을 결합해 접속자의 국가(국기), 도시, 통신사(ISP), IP 주소, 정확한 한국시간(KST) 로그인/방문 시각 자동 기록",
      "📋 [사용자 전 행동 실시간 로깅] 로그인/로그아웃, 메뉴 이동, AI 단어 생성/재생성, 사전 단어 담기, 플래시카드/객관식 퀴즈/스펠링 점수·정답률, AI 번역, 스타강사 특강, 백업/복원, 언어 변경 등 모든 활동 추적",
      "🖥️ [내 컴퓨터(PC) 원클릭 무료 로그 서버 탑재] pc-log-server 폴더의 원클릭 배치파일 실행만으로 내 PC가 무료 Cloudflare HTTPS 터널을 통해 전 세계 접속 로그를 실시간 수신하고 하드디스크(JSONL + 날짜별 엑셀 CSV)에 자동 이중 백업",
      "☁️ [24시간 무료 구글 시트 연동 & 다중 백업 센터] 내 PC가 꺼져 있을 때도 24시간 기록되는 Google 스프레드시트 무료 웹훅 연동(PC 가동 시 자동 다운로드 병합) 및 엑셀(CSV)·JSON·Google Drive 클라우드 백업/복원 지원"
    ],
    highlights_id: [
      "🛡️ [Pemulihan Penuh Statistik Pusat] Membangun ulang dashboard Statistik Pusat (/statistics) agar berjalan 100% gratis tanpa ketergantungan Supabase berbayar",
      "🌍 [Pelacakan IP, Negara, Kota & Waktu Login] Mencatat IP pengunjung, negara, kota, ISP, dan waktu login/kunjungan secara akurat menggunakan Vercel Edge Geo-IP + 4 mesin fallback gratis",
      "📋 [Pencatatan Semua Aktivitas Pengguna] Melacak login/logout, perpindahan menu, pembuatan kata AI, kamus, skor kuis/kartu/ejaan, terjemahan AI, kuliah AI, dan pencadangan",
      "🖥️ [Server Cadangan PC Gratis 1-Klik] Menjalankan PC sendiri sebagai server log HTTPS melalui Cloudflare Tunnel gratis dengan pencadangan otomatis ke hard disk (JSONL + CSV Excel harian)",
      "☁️ [Server Google Sheets 24 Jam & Pusat Cadangan] Mendukung webhook Google Sheets gratis saat PC mati serta ekspor/pemulihan Excel (CSV), JSON, dan Google Drive"
    ],
    highlights_en: [
      "🛡️ [Central Statistics Overhaul] Rebuilt Central Statistics (/statistics) to work 100% free out-of-the-box without requiring paid Supabase plans",
      "🌍 [Real-Time IP, Country, City & Login Time Tracking] Captures visitor IP, country flag, city, ISP, and exact login/session timestamps via Vercel Edge Geo-IP + 4-tier free fallback",
      "📋 [Full User Activity Timeline] Tracks logins/logouts, page views, AI word generation/regeneration, dictionary additions, flashcard/quiz/spelling scores, AI translation, lectures, and backups",
      "🖥️ [1-Click Self-Hosted PC Log Server] Turn your Windows PC into a global HTTPS log server via free Cloudflare Tunnel with automatic disk backups (JSONL + daily Excel CSV)",
      "☁️ [24/7 Free Google Sheets Relay & Multi-Backup] Supports 24/7 free Google Sheets webhook logging when PC is off (auto-synced to PC on boot) plus CSV, JSON, and Google Drive backup/restore"
    ]
  },
  {
    version: 'v20.18',
    date: '2026-10-30',
    badge: 'UPDATE',
    title: "다국어 번역 키 누락 해결 (사전·설정 버튼 정상화) & 토큰/비용 대시보드 3개 국어(KO/ID/EN) 완벽 분기",
    title_id: "Perbaikan Kunci Terjemahan (Tombol Kamus & Pengaturan) & Lokalisasi Penuh Dashboard Token/Biaya",
    title_en: "Fixed Translation Key Mismatches (Dict/Settings Buttons) & Full Token/Cost Dashboard Localization",
    highlights: [
      "🧩 [한국어 UI 영문 키 노출 버그 수정] 사전 페이지(재생성 버튼, 내 단어장에 있음 뱃지, 랜덤 자동추출 라벨/버튼, AI 시크릿 노트 뱃지, 원본 복원 등)와 설정 페이지(CSV 백업/복원)에서 번역 키 문자열이 그대로 노출되던 현상 전면 해결",
      "🌐 [설정 탭 토큰 및 요금 대시보드 다국어화] 인도네시아어 및 영어 사용자일 때도 한국어로 하드코딩되어 나오던 공식 단가표, 구글 요금 문서 링크, 입출력 토큰 라벨, 총 소모 토큰 및 작업별 상세 내역(단어생성, 재생성, 특강, TTS 등)을 3개 국어로 완벽 분기 처리",
      "✅ [전체 페이지 번역 키 전수 검증] 앱 내 모든 페이지의 313개 번역 키에 대해 한국어, 인도네시아어, 영어 누락 항목 0개 검증 완료"
    ],
    highlights_id: [
      "🧩 [Perbaikan Bug Tampilan Kunci Terjemahan] Memperbaiki masalah di mana kunci terjemahan bahasa Inggris muncul mentah pada tombol dan lencana halaman Kamus dan Pengaturan",
      "🌐 [Lokalisasi Penuh Dashboard Token & Biaya] Mengubah teks harga resmi, tautan dokumen, token input/output, dan rincian penggunaan aktivitas yang sebelumnya tertulis dalam bahasa Korea menjadi bahasa Indonesia dan Inggris sesuai pilihan pengguna",
      "✅ [Verifikasi Penuh Semua Kunci] Memverifikasi 313 kunci terjemahan di seluruh halaman aplikasi dengan 0 kunci yang hilang di KO, ID, dan EN"
    ],
    highlights_en: [
      "🧩 [Fixed Raw Key Display Bug] Fixed issues where translation key identifiers were displayed as raw text on buttons and badges in the Dictionary and Settings pages",
      "🌐 [Full Token & Cost Dashboard Localization] Localized all official rate labels, pricing document links, input/output token labels, and activity breakdowns in Settings for Indonesian and English users",
      "✅ [Complete Key Verification] Verified all 313 translation keys across every page with 0 missing entries across KO, ID, and EN"
    ]
  },
  {
    version: 'v20.17',
    date: '2026-10-30',
    badge: 'UPDATE',
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
