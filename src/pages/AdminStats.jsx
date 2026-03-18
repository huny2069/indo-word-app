import React, { useState, useEffect } from 'react';
import { supabase } from '../api/supabase';
import { TrendingUp, Users, DollarSign, Activity, Calendar, Hash } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const AdminStats = () => {
    const { isIndoMode } = useLanguage();
    const [usageData, setUsageData] = useState([]);
    const [accessData, setAccessData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [summary, setSummary] = useState({
        totalTokens: 0,
        totalCost: 0,
        totalUsers: 0,
        totalEvents: 0
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        if (!supabase) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            // 1. 사용량 로그 가져오기
            const { data: usage, error: uErr } = await supabase
                .from('usage_logs')
                .select('*')
                .order('created_at', { ascending: false });
            
            // 2. 접속 로그 가져오기
            const { data: access, error: aErr } = await supabase
                .from('access_logs')
                .select('*')
                .order('created_at', { ascending: false });

            if (uErr || aErr) throw new Error('Data fetch failed');

            setUsageData(usage || []);
            setAccessData(access || []);

            // 요약 데이터 계산
            const tokens = usage?.reduce((sum, item) => sum + (item.tokens_used || 0), 0) || 0;
            const cost = usage?.reduce((sum, item) => sum + (Number(item.cost_usd) || 0), 0) || 0;
            const users = new Set([...(usage?.map(u => u.user_id) || []), ...(access?.map(a => a.user_id) || [])]).size;

            setSummary({
                totalTokens: tokens,
                totalCost: cost,
                totalUsers: users,
                totalEvents: usage?.length || 0
            });

        } catch (err) {
            console.error('Fetch Stats Error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    if (!supabase) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <h2 style={{ color: '#e74c3c' }}>{isIndoMode ? 'Supabase Tidak Terhubung' : 'Supabase가 연결되지 않았습니다'}</h2>
                <p>{isIndoMode ? 'Silakan tambahkan VITE_SUPABASE_URL & KEY di Vercel.' : 'Vercel 환경 변수에 Supabase URL과 KEY를 등록해주세요.'}</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto', paddingBottom: '5rem' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--primary-color)', margin: 0 }}>
                        {isIndoMode ? 'Statistik Admin Central' : '중앙 관리자 통계 대시보드'} 🍌
                    </h2>
                    <p style={{ color: '#666', marginTop: '0.4rem' }}>
                        {isIndoMode ? 'Memantau aktivitas seluruh pengguna secara real-time.' : '모든 사용자의 이용 현황을 실시간으로 모니터링합니다.'}
                    </p>
                </div>
                <button onClick={fetchData} style={{ padding: '0.6rem 1.2rem', background: '#fff', border: '2px solid var(--primary-color)', borderRadius: '12px', color: 'var(--primary-color)', fontWeight: 'bold', cursor: 'pointer' }}>
                    {isIndoMode ? 'Segarkan' : '새로고침'}
                </button>
            </div>

            {/* 요약 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.2rem', marginBottom: '2.5rem' }}>
                <SummaryCard 
                    icon={<Hash color="#3498db" />} 
                    title={isIndoMode ? "Total Token" : "전체 누적 토큰"} 
                    value={summary.totalTokens.toLocaleString()} 
                    unit="Tokens" 
                    bg="#ebf5fb"
                />
                <SummaryCard 
                    icon={<DollarSign color="#e67e22" />} 
                    title={isIndoMode ? "Estimasi Biaya" : "누적 예상 요금"} 
                    value={`$ ${summary.totalCost.toFixed(4)}`} 
                    unit={!isIndoMode && `(약 ${(summary.totalCost * 1500).toLocaleString()}원)`} 
                    bg="#fef5e7"
                />
                <SummaryCard 
                    icon={<Users color="#2ecc71" />} 
                    title={isIndoMode ? "Total Pengguna" : "활성 사용자 수"} 
                    value={summary.totalUsers.toLocaleString()} 
                    unit="Devices" 
                    bg="#eafaf1"
                />
                <SummaryCard 
                    icon={<Activity color="#9b59b6" />} 
                    title={isIndoMode ? "Total Request" : "전체 생성 횟수"} 
                    value={summary.totalEvents.toLocaleString()} 
                    unit="Calls" 
                    bg="#f5eef8"
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                {/* 최근 생성 로그 */}
                <div style={{ background: '#fff', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 8px 30px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
                        <TrendingUp size={20} color="var(--primary-color)" />
                        <h3 style={{ margin: 0 }}>{isIndoMode ? 'Log Aktivitas Terbaru' : '최근 단어 생성 로그'}</h3>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #f8f9fa', color: '#888' }}>
                                    <th style={{ padding: '1rem 0.5rem' }}>{isIndoMode ? 'Waktu' : '시간'}</th>
                                    <th style={{ padding: '1rem 0.5rem' }}>{isIndoMode ? 'ID Pengguna' : '사용자'}</th>
                                    <th style={{ padding: '1rem 0.5rem' }}>{isIndoMode ? 'Topik' : '주제'}</th>
                                    <th style={{ padding: '1rem 0.5rem' }}>{isIndoMode ? 'Token' : '토큰'}</th>
                                    <th style={{ padding: '1rem 0.5rem' }}>{isIndoMode ? 'Biaya' : '비용'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usageData.map((log, i) => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid #f8f9fa', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                        <td style={{ padding: '0.8rem 0.5rem', whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                                        <td style={{ padding: '0.8rem 0.5rem' }}><code style={{fontSize: '0.75rem', background: '#eee', padding: '2px 4px', borderRadius: '4px'}}>{log.user_id.substring(0, 10)}...</code></td>
                                        <td style={{ padding: '0.8rem 0.5rem', fontWeight: 'bold' }}>{log.topic}</td>
                                        <td style={{ padding: '0.8rem 0.5rem' }}>{log.tokens_used.toLocaleString()}</td>
                                        <td style={{ padding: '0.8rem 0.5rem', color: '#e67e22' }}>$ {Number(log.cost_usd).toFixed(5)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 접속 로그 */}
                <div style={{ background: '#fff', borderRadius: '20px', padding: '1.5rem', boxShadow: '0 8px 30px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
                        <Users size={20} color="#2ecc71" />
                        <h3 style={{ margin: 0 }}>{isIndoMode ? 'Log Akses Real-time' : '실시간 접속 기록'}</h3>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #f8f9fa', color: '#888' }}>
                                    <th style={{ padding: '1rem 0.5rem' }}>{isIndoMode ? 'Waktu' : '접속 시간'}</th>
                                    <th style={{ padding: '1rem 0.5rem' }}>{isIndoMode ? 'ID Pengguna' : 'ID'}</th>
                                    <th style={{ padding: '1rem 0.5rem' }}>{isIndoMode ? 'Info Perangkat' : '기기 정보'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {accessData.map((log, i) => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid #f8f9fa' }}>
                                        <td style={{ padding: '0.8rem 0.5rem', whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                                        <td style={{ padding: '0.8rem 0.5rem' }}><code>{log.user_id.substring(0, 15)}...</code></td>
                                        <td style={{ padding: '0.8rem 0.5rem', color: '#666', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.user_agent}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SummaryCard = ({ icon, title, value, unit, bg }) => (
    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '25px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ background: bg, padding: '1rem', borderRadius: '20px' }}>
            {icon}
        </div>
        <div>
            <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.4rem', fontWeight: 'bold' }}>{title}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#2c3e50' }}>{value}</div>
            <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.2rem' }}>{unit}</div>
        </div>
    </div>
);

export default AdminStats;
