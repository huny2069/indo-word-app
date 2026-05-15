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
    const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
    const [model, setModel] = useState(localStorage.getItem('gemini_model') || 'gemini-1.5-flash');

    const timeoutRef = useRef(null);

    // 언어 전환 기능
    const handleSwap = () => {
        const tempLang = fromLang;
        setFromLang(toLang);
        setToLang(tempLang);
        
        const tempText = sourceText;
        setSourceText(targetText);
        setTargetText(tempText);
    };

    // 실시간 번역 로직 (디바운싱 적용)
    useEffect(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        
        if (!sourceText.trim()) {
            setTargetText('');
            return;
        }

        timeoutRef.current = setTimeout(() => {
            performTranslate();
        }, 800);

        return () => clearTimeout(timeoutRef.current);
    }, [sourceText, fromLang, toLang]);

    const performTranslate = async () => {
        if (!sourceText.trim() || !apiKey) return;
        setIsTranslating(true);
        try {
            const result = await translateText(sourceText, fromLang, toLang, apiKey, model);
            setTargetText(result);
        } catch (error) {
            console.error("Translation failed:", error);
        } finally {
            setIsTranslating(false);
        }
    };

    // 단어장에 추가 (AI 고도화)
    const handleAddWord = async () => {
        if (!sourceText || !targetText || isSaving) return;
        
        // 너무 긴 문장은 단어장 추가 부적합
        if (sourceText.length > 50) {
            alert('단어장에 추가하기에는 너무 깁니다. 짧은 단어나 구절만 가능합니다.');
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
            alert('정보 생성 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('복사되었습니다.');
    };

    return (
        <div className="page" style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.8rem', background: 'rgba(29, 209, 161, 0.1)', padding: '0.8rem 1.5rem', borderRadius: '50px', marginBottom: '1rem' }}>
                    <Languages size={24} color="var(--primary-color)" />
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '900', color: 'var(--primary-color)' }}>{t('nav_translate')}</h2>
                </div>
                <p style={{ color: '#888', fontWeight: '700' }}>Gemini AI가 제공하는 고품질 실시간 번역 서비스</p>
            </div>

            <div className="translate-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem', position: 'relative' }}>
                
                {/* Source Panel */}
                <div style={{ background: '#fff', borderRadius: '30px', padding: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontWeight: '900', fontSize: '0.8rem', color: '#999', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('trans_source_lang')}</span>
                        <div style={{ background: 'var(--primary-color)', color: '#fff', padding: '4px 12px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '800' }}>
                            {fromLang === 'id' ? 'Bahasa Indonesia' : fromLang === 'ko' ? '한국어' : 'English'}
                        </div>
                    </div>
                    <textarea 
                        value={sourceText}
                        onChange={(e) => setSourceText(e.target.value)}
                        placeholder={t('trans_source_ph')}
                        style={{ width: '100%', height: '180px', border: 'none', resize: 'none', fontSize: '1.2rem', fontWeight: '700', color: '#333', outline: 'none', lineHeight: '1.6', background: 'transparent' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid #f9f9f9' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => playAudio(sourceText, fromLang)} className="icon-btn-circle" style={{ background: '#f8f9fa' }}>
                                <Volume2 size={20} color="#666" />
                            </button>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: '#ccc', fontWeight: '700' }}>{sourceText.length} / 500</span>
                    </div>
                </div>

                {/* Swap Button Area */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                    <button 
                        onClick={handleSwap}
                        style={{ background: '#fff', border: '2px solid #eee', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', transition: '0.3s' }}
                        className="swap-btn-hover"
                    >
                        <ArrowRightLeft size={20} color="var(--primary-color)" />
                    </button>
                </div>

                {/* Target Panel */}
                <div style={{ background: 'linear-gradient(135deg, #fff, #f9fffb)', borderRadius: '30px', padding: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '2.5px solid var(--primary-color)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontWeight: '900', fontSize: '0.8rem', color: '#999', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('trans_target_lang')}</span>
                        <div style={{ background: 'var(--nana-dark)', color: '#fff', padding: '4px 12px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '800' }}>
                            {toLang === 'id' ? 'Bahasa Indonesia' : toLang === 'ko' ? '한국어' : 'English'}
                        </div>
                    </div>
                    
                    <div style={{ width: '100%', height: '180px', fontSize: '1.2rem', fontWeight: '700', color: 'var(--primary-color)', overflowY: 'auto', lineHeight: '1.6', position: 'relative' }}>
                        {isTranslating ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#ccc' }}>
                                <Loader2 size={24} className="spin" />
                                <span>번역 중...</span>
                            </div>
                        ) : (
                            targetText || <span style={{ color: '#eee' }}>{t('trans_target_ph')}</span>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid rgba(29, 209, 161, 0.1)' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => playAudio(targetText, toLang)} className="icon-btn-circle" style={{ background: 'rgba(29, 209, 161, 0.05)' }}>
                                <Volume2 size={20} color="var(--primary-color)" />
                            </button>
                            <button onClick={() => copyToClipboard(targetText)} className="icon-btn-circle" style={{ background: 'rgba(29, 209, 161, 0.05)' }}>
                                <Copy size={20} color="var(--primary-color)" />
                            </button>
                        </div>
                        
                        {targetText && (
                            <button 
                                onClick={handleAddWord}
                                disabled={isSaving}
                                style={{ 
                                    background: 'var(--primary-color)', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '15px', fontWeight: '900', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', boxShadow: '0 4px 0 #10ac84', transition: '0.2s'
                                }}
                            >
                                {isSaving ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
                                {isSaving ? t('trans_msg_enriching') : t('trans_btn_add_word')}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Features Info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '25px', display: 'flex', alignItems: 'flex-start', gap: '1rem', border: '1px solid #f0f0f0', boxShadow: '0 5px 15px rgba(0,0,0,0.02)' }}>
                    <div style={{ background: '#f0f4ff', padding: '12px', borderRadius: '15px' }}><Sparkles size={24} color="#4facfe" /></div>
                    <div>
                        <h4 style={{ margin: '0 0 5px 0', fontSize: '1rem', fontWeight: '900' }}>AI 고도화 저장</h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#888', lineHeight: '1.5' }}>단순 번역을 넘어 품사, 예문, 어근 등 모든 학습 정보를 AI가 자동으로 생성해 단어장에 넣어줍니다.</p>
                    </div>
                </div>
                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '25px', display: 'flex', alignItems: 'flex-start', gap: '1rem', border: '1px solid #f0f0f0', boxShadow: '0 5px 15px rgba(0,0,0,0.02)' }}>
                    <div style={{ background: '#fff9db', padding: '12px', borderRadius: '15px' }}><Volume2 size={24} color="#feca57" /></div>
                    <div>
                        <h4 style={{ margin: '0 0 5px 0', fontSize: '1rem', fontWeight: '900' }}>정확한 발음 가이드</h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#888', lineHeight: '1.5' }}>인코의 고품질 TTS 엔진을 통해 번역 결과의 정확한 발음을 듣고 따라하며 학습할 수 있습니다.</p>
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
