import React, { useState, useEffect, useRef } from 'react';
import { Languages, Volume2, ArrowRightLeft, Copy, Trash2, Plus, Sparkles, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { translateText, enrichWordFromTranslation } from '../api/geminiApi';
import { playAudio } from '../api/ttsApi';
import { addWord } from '../db/database';

const Translate = () => {
    const { userLang, studyLang, t } = useLanguage();
    const [sourceText, setSourceText] = useState('');
    const [targetText, setTargetText] = useState('');
    const [fromLang, setFromLang] = useState(studyLang); // 기본은 공부하는 언어 -> 내 언어
    const [toLang, setToLang] = useState(userLang);
    const [isTranslating, setIsTranslating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [apiKey, setApiKey] = useState(localStorage.getItem('geminiApiKey') || '');
    const [model, setModel] = useState(localStorage.getItem('selectedGeminiModel') || 'gemini-1.5-flash');
    const [transStyle, setTransStyle] = useState('formal'); // 'formal' or 'casual'

    const timeoutRef = useRef(null);
    const abortControllerRef = useRef(null); // [v19.21] 이전 번역 네트워크 요청을 하드웨어적으로 취소할 수 있는 AbortController 레퍼런스

    // 언어 전환 기능
    const handleSwap = () => {
        const tempLang = fromLang;
        setFromLang(toLang);
        setToLang(tempLang);
        
        const tempText = sourceText;
        setSourceText(targetText);
        setTargetText(tempText);
    };

    // 실시간 번역 로직 (디바운싱 300ms 최적화 및 이전 요청 자동 취소 적용)
    useEffect(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        
        if (!sourceText.trim()) {
            setTargetText('');
            // 입력창이 비어있으면 진행 중인 번역 요청도 중단
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            return;
        }

        timeoutRef.current = setTimeout(() => {
            performTranslate();
        }, 300); // 디바운스 대기시간을 300ms로 단축하여 실시간성 극대화!

        return () => clearTimeout(timeoutRef.current);
    }, [sourceText, fromLang, toLang, transStyle]);

    const performTranslate = async () => {
        if (!sourceText.trim()) return;
        if (!apiKey) {
            alert(t('msg_api_key_empty') || 'API 키가 설정되지 않았습니다. 설정 탭에서 API 키를 입력해주세요.');
            return;
        }

        // ⚡ [v19.21] 이전 요청이 아직 처리 중이라면 즉시 중단(Abort)시켜 네트워크 부하 및 화면 버벅임을 원천 제거!
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        setIsTranslating(true);
        try {
            const result = await translateText(
                sourceText, 
                fromLang, 
                toLang, 
                apiKey, 
                model, 
                transStyle,
                abortControllerRef.current.signal
            );
            
            // 중단(Abort)된 비동기 요청이 아닐 때만 결과값을 화면에 렌더링
            if (result !== null) {
                setTargetText(result);
            }
        } catch (error) {
            // AbortController에 의한 인위적 취소(AbortError)나 런타임 Abort 시그널은 사용자 얼럿을 띄우지 않고 묵인
            if (error.name !== 'AbortError' && error.message !== 'The user aborted a request.') {
                console.error("Translation failed:", error);
                alert((t('msg_trans_fail') || '번역 중 오류가 발생했습니다: ') + error.message);
            }
        } finally {
            // UI의 부드러운 상태 전환을 위해, 에러나 정상 완료 상관없이 무조건 로딩 바를 해제!
            setIsTranslating(false);
        }
    };

    // 단어장에 추가 (AI 고도화)
    const handleAddWord = async () => {
        if (!sourceText || !targetText || isSaving) return;
        
        // 너무 긴 문장은 단어장 추가 부적합
        if (sourceText.length > 50) {
            alert(t('msg_word_too_long') || '단어장에 추가하기에는 너무 깁니다. 짧은 단어나 구절만 가능합니다.');
            return;
        }

        setIsSaving(true);
        try {
            // AI를 통해 품사, 어근, 예문 등 상세 정보 생성
            const enriched = await enrichWordFromTranslation(
                sourceText, 
                targetText, 
                userLang, 
                studyLang, 
                apiKey, 
                model
            );
            
            // 공통 데이터 추가
            const wordToSave = {
                ...enriched,
                topic: t('trans_user_added') || '사용자추가',
                created_at: new Date().toISOString(),
                study_lang: fromLang === studyLang ? fromLang : toLang, // 학습 중인 언어를 체크
                user_id: localStorage.getItem('user_device_id')
            };

            await addWord(wordToSave);
            alert(t('trans_msg_added') || '단어장에 추가되었습니다! 🍌');
        } catch (error) {
            console.error("Enrichment failed:", error);
            alert(t('msg_enrich_fail') || '정보 생성 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert(t('trans_msg_copied') || '복사되었습니다.');
    };

    const languages = [
        { code: 'ko', name: '한국어', flag: '🇰🇷' },
        { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
        { code: 'en', name: 'English', flag: '🇺🇸' }
    ];

    return (
        <div className="page" style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem', paddingBottom: '5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.8rem', background: 'rgba(29, 209, 161, 0.1)', padding: '0.8rem 1.5rem', borderRadius: '50px', marginBottom: '1rem' }}>
                    <Languages size={24} color="var(--primary-color)" />
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900', color: 'var(--primary-color)' }}>{t('nav_translate')}</h2>
                </div>
                <p style={{ color: '#888', fontWeight: '700' }}>{t('trans_title') || 'AI 실시간 번역'}</p>
            </div>

            {/* Language Selection Header */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem', flexWrap: 'nowrap' }}>
                <select 
                    value={fromLang} 
                    onChange={(e) => setFromLang(e.target.value)}
                    style={{ flex: 1, maxWidth: '180px', padding: '0.8rem', borderRadius: '15px', border: '2px solid #eee', fontWeight: '800', background: '#fff', cursor: 'pointer', outline: 'none', fontSize: '0.9rem' }}
                >
                    {languages.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name.split(' ')[0]}</option>)}
                </select>

                <button 
                    onClick={handleSwap}
                    style={{ background: '#f8f9fa', border: '1px solid #eee', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}
                >
                    <ArrowRightLeft size={16} color="var(--primary-color)" />
                </button>

                <select 
                    value={toLang} 
                    onChange={(e) => setToLang(e.target.value)}
                    style={{ flex: 1, maxWidth: '180px', padding: '0.8rem', borderRadius: '15px', border: '2px solid var(--primary-color)', fontWeight: '800', background: '#fff', cursor: 'pointer', outline: 'none', fontSize: '0.9rem' }}
                >
                    {languages.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name.split(' ')[0]}</option>)}
                </select>
            </div>

            {/* Translation Style Toggle */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', background: '#f1f3f5', padding: '5px', borderRadius: '15px', gap: '5px' }}>
                    <button 
                        onClick={() => setTransStyle('formal')}
                        style={{ 
                            padding: '8px 20px', border: 'none', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer', transition: '0.2s',
                            background: transStyle === 'formal' ? '#fff' : 'transparent',
                            color: transStyle === 'formal' ? 'var(--primary-color)' : '#999',
                            boxShadow: transStyle === 'formal' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                        }}
                    >
                        {t('trans_style_formal') || '👔 격식체 (존댓말)'}
                    </button>
                    <button 
                        onClick={() => setTransStyle('casual')}
                        style={{ 
                            padding: '8px 20px', border: 'none', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer', transition: '0.2s',
                            background: transStyle === 'casual' ? '#fff' : 'transparent',
                            color: transStyle === 'casual' ? 'var(--primary-color)' : '#999',
                            boxShadow: transStyle === 'casual' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                        }}
                    >
                        {t('trans_style_casual') || '💬 구어체 (반말)'}
                    </button>
                </div>
            </div>

            <div className="translate-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                
                {/* Source Panel */}
                <div style={{ background: '#fff', borderRadius: '25px', padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <textarea 
                        value={sourceText}
                        onChange={(e) => setSourceText(e.target.value)}
                        placeholder={t('trans_source_ph')}
                        style={{ width: '100%', height: '160px', border: 'none', resize: 'none', fontSize: '1.15rem', fontWeight: '700', color: '#333', outline: 'none', lineHeight: '1.6', background: 'transparent' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid #f5f5f5', marginTop: 'auto' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => playAudio(sourceText, fromLang)} className="icon-btn-circle" style={{ background: '#f8f9fa' }}>
                                <Volume2 size={18} color="#666" />
                            </button>
                            <button onClick={() => setSourceText('')} className="icon-btn-circle" style={{ background: '#f8f9fa' }}>
                                <Trash2 size={18} color="#666" />
                            </button>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#ccc', fontWeight: '700' }}>{sourceText.length} / 500</span>
                    </div>
                </div>

                {/* Target Panel */}
                <div style={{ background: '#fff', borderRadius: '25px', padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.06)', border: '2px solid rgba(29, 209, 161, 0.3)', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ width: '100%', height: '160px', fontSize: '1.15rem', fontWeight: '700', color: 'var(--primary-color)', overflowY: 'auto', lineHeight: '1.6', position: 'relative' }}>
                        {isTranslating ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#ccc', padding: '0.5rem' }}>
                                <Loader2 size={24} className="spin" />
                                <span style={{ fontWeight: '800' }}>{t('trans_msg_translating') || '번역 중...'}</span>
                            </div>
                        ) : (
                            targetText || <span style={{ color: '#eee' }}>{t('trans_target_ph')}</span>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid rgba(29, 209, 161, 0.1)', marginTop: 'auto' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => playAudio(targetText, toLang)} className="icon-btn-circle" style={{ background: 'rgba(29, 209, 161, 0.05)' }}>
                                <Volume2 size={18} color="var(--primary-color)" />
                            </button>
                            <button onClick={() => copyToClipboard(targetText)} className="icon-btn-circle" style={{ background: 'rgba(29, 209, 161, 0.05)' }}>
                                <Copy size={18} color="var(--primary-color)" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Manual Action Buttons */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
                <button 
                    onClick={performTranslate}
                    disabled={isTranslating || !sourceText}
                    style={{ 
                        flex: 2, padding: '1.1rem', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '18px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: '900', boxShadow: '0 4px 15px rgba(29, 209, 161, 0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.8rem', transition: 'all 0.2s', minWidth: '200px'
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    {isTranslating ? <Loader2 size={20} className="spin" /> : <Languages size={20} />}
                    {t('trans_btn_translate') || '번역하기'}
                </button>

                {targetText && (
                    <button 
                        onClick={handleAddWord}
                        disabled={isSaving}
                        style={{ 
                            flex: 1, padding: '1.1rem', background: '#fff', color: '#feca57', border: '2px solid #feca57', borderRadius: '18px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: '900', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.8rem', transition: '0.2s', minWidth: '200px'
                        }}
                    >
                        {isSaving ? <Loader2 size={20} className="spin" /> : <Plus size={20} />}
                        {isSaving ? t('trans_msg_enriching') : t('trans_btn_add_word')}
                    </button>
                )}
            </div>

            {/* Features Info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '25px', display: 'flex', alignItems: 'flex-start', gap: '1rem', border: '1px solid #f0f0f0', boxShadow: '0 5px 15px rgba(0,0,0,0.02)' }}>
                    <div style={{ background: '#f0f4ff', padding: '12px', borderRadius: '15px' }}><Sparkles size={24} color="#4facfe" /></div>
                    <div>
                        <h4 style={{ margin: '0 0 5px 0', fontSize: '1rem', fontWeight: '900' }}>{t('trans_info_ai_title') || 'AI 고도화 저장'}</h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#888', lineHeight: '1.5' }}>{t('trans_info_ai_desc') || '단순 번역을 넘어 품사, 예문, 어근 등 모든 학습 정보를 AI가 자동으로 생성해 단어장에 넣어줍니다.'}</p>
                    </div>
                </div>
                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '25px', display: 'flex', alignItems: 'flex-start', gap: '1rem', border: '1px solid #f0f0f0', boxShadow: '0 5px 15px rgba(0,0,0,0.02)' }}>
                    <div style={{ background: '#fff9db', padding: '12px', borderRadius: '15px' }}><Volume2 size={24} color="#feca57" /></div>
                    <div>
                        <h4 style={{ margin: '0 0 5px 0', fontSize: '1rem', fontWeight: '900' }}>{t('trans_info_tts_title') || '정확한 발음 가이드'}</h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#888', lineHeight: '1.5' }}>{t('trans_info_tts_desc') || '인코의 고품질 TTS 엔진을 통해 번역 결과의 정확한 발음을 듣고 따라하며 학습할 수 있습니다.'}</p>
                    </div>
                </div>
            </div>

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .icon-btn-circle { width: 42px; height: 42px; border-radius: 50%; border: none; cursor: pointer; display: flex; justify-content: center; align-items: center; transition: 0.2s; }
                .icon-btn-circle:hover { background: #eee !important; transform: translateY(-2px); }
                .swap-btn-hover:hover { transform: rotate(180deg) scale(1.1); border-color: var(--primary-color) !important; }
                @media (max-width: 768px) {
                    .translate-container { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default Translate;
