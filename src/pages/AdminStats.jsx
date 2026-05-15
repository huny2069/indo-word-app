import React, { useState, useEffect } from 'react';
import { supabase, deleteLogs } from '../api/supabase';
import { TrendingUp, Users, DollarSign, Activity, Calendar, Hash, Download, Trash2, RefreshCw, Mail, Shield, ShieldAlert, Clock } from 'lucide-react';

const AdminStats = () => {
    // 관리자 확인 (환경 변수에 등록된 관리자 이메일과 대조)
    const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || '').toLowerCase().trim();
    const userEmail = (localStorage.getItem('user_email') || '').toLowerCase().trim();
    const isAdmin = adminEmail && userEmail === adminEmail;

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
            // 1. 사용량 로그 가져오기 (Gemini API 호출 기록)
            const { data: usage, error: uErr } = await supabase
                .from('usage_logs')
                .select('*')
                .order('created_at', { ascending: false });
            
            // 2. 접속 로그 가져오기 (사용자 방문 기록)
            const { data: access, error: aErr } = await supabase
                .from('access_logs')
                .select('*')
                .order('created_at', { ascending: false });

            if (uErr || aErr) throw new Error('데이터를 불러오지 못했습니다.');

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

    // CSV 다운로드 기능
    const downloadCSV = (data, filename) => {
        if (!data || data.length === 0) return;
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row => 
            Object.values(row).map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')
        );
        const csvContent = "\uFEFF" + [headers, ...rows].join('\n'); // UTF-8 BOM 추가
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // 로그 전체 삭제 기능
    const handleDelete = async (tableName) => {
        const confirmMsg = `${tableName === 'usage_logs' ? '사용량' : '접속'} 로그의 모든 데이터를 영구히 삭제하시겠습니까?`;
            
        if (window.confirm(confirmMsg)) {
            const res = await deleteLogs(tableName);
            if (res.success) {
                alert('성공적으로 삭제되었습니다.');
                fetchData();
            } else {
                alert('삭제 중 오류 발생: ' + res.error);
            }
        }
    };

    if (!supabase) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <h2 style={{ color: '#e74c3c' }}>Supabase가 연결되지 않았습니다</h2>
                <p>Vercel 환경 변수에 Supabase URL과 KEY를 등록해주세요.</p>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div style={{ padding: '5rem 2rem', textAlign: 'center', background: '#f8fafc', minHeight: '100vh' }}>
                <div style={{ background: '#fff', maxWidth: '500px', margin: '0 auto', padding: '3rem', borderRadius: '40px', boxShadow: '0 20px 50px rgba(0,0,0,0.05)' }}>
                    <div style={{ background: '#fff1f2', width: '80px', height: '80px', borderRadius: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
                        <ShieldAlert size={40} color="#e11d48" />
                    </div>
                    <h2 style={{ color: '#1e293b', fontSize: '1.8rem', fontWeight: '900', marginBottom: '1rem' }}>접근 권한 없음</h2>
                    <p style={{ color: '#64748b', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '2.5rem' }}>
                        이 페이지는 관리자 전용입니다.<br/>
                        등록된 관리자 이메일로 로그인 후 이용해주세요.
                    </p>
                    <button 
                        onClick={() => window.location.href = '/settings'}
                        style={{ width: '100%', padding: '1.2rem', background: 'var(--nana-dark)', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: '900', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 4px 0 #000' }}
                    >
                        로그인하러 가기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', paddingBottom: '6rem', fontFamily: "'Pretendard', sans-serif" }}>
            <div style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', background: '#fff', padding: '2.5rem', borderRadius: '35px', boxShadow: '0 10px 40px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.8rem' }}>
                        <div style={{ background: '#fef9e7', padding: '8px', borderRadius: '12px' }}><Shield size={24} color="#feca57" /></div>
                        <h2 style={{ fontSize: '2.2rem', fontWeight: '900', color: '#1e293b', margin: 0, letterSpacing: '-1px' }}>
                            중앙 관리 대시보드
                        </h2>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '1.1rem', margin: 0, fontWeight: '500' }}>
                        인코 나나 프로 서비스의 모든 지표를 한눈에 관리합니다.
                    </p>
                </div>
                <button onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '1rem 1.8rem', background: '#fff', border: '2px solid #e2e8f0', borderRadius: '20px', color: '#64748b', fontWeight: '800', cursor: 'pointer', transition: '0.2s', fontSize: '1rem' }}>
                    {isLoading ? <RefreshCw className="spin" size={20} /> : <RefreshCw size={20} />} 데이터 새로고침
                </button>
            </div>

            {/* 요약 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                <SummaryCard 
                    icon={<Hash color="#3b82f6" />} 
                    title="전체 누적 토큰" 
                    value={summary.totalTokens.toLocaleString()} 
                    unit="Tokens" 
                    bg="#eff6ff"
                />
                <SummaryCard 
                    icon={<DollarSign color="#f59e0b" />} 
                    title="누적 예상 요금" 
                    value={`$${summary.totalCost.toFixed(4)}`} 
                    unit={`(약 ${(summary.totalCost * 1400).toLocaleString()}원)`} 
                    bg="#fffbeb"
                />
                <SummaryCard 
                    icon={<Users color="#10b981" />} 
                    title="활성 사용자 수" 
                    value={summary.totalUsers.toLocaleString()} 
                    unit="Device / Emails" 
                    bg="#ecfdf5"
                />
                <SummaryCard 
                    icon={<Activity color="#8b5cf6" />} 
                    title="전체 API 호출" 
                    value={summary.totalEvents.toLocaleString()} 
                    unit="Requests" 
                    bg="#f5f3ff"
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '3rem' }}>
                {/* 최근 생성 로그 */}
                <div style={{ background: '#fff', borderRadius: '35px', padding: '2.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                            <TrendingUp size={24} color="#3b82f6" />
                            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '900' }}>AI 서비스 사용량 로그 (usage_logs)</h3>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => downloadCSV(usageData, 'usage_logs')} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #e2e8f0', padding: '0.8rem 1.2rem', borderRadius: '15px', background: '#fff', fontSize: '0.9rem', fontWeight: '800', color: '#64748b', cursor: 'pointer' }}>
                                <Download size={16} /> 엑셀 다운로드
                            </button>
                            <button onClick={() => handleDelete('usage_logs')} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #fee2e2', padding: '0.8rem 1.2rem', borderRadius: '15px', background: '#fef2f2', color: '#ef4444', fontSize: '0.9rem', fontWeight: '800', cursor: 'pointer' }}>
                                <Trash2 size={16} /> 로그 비우기
                            </button>
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '1rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#94a3b8' }}>
                                    <th style={{ padding: '1.2rem 1rem', fontWeight: '800' }}>생성 시간</th>
                                    <th style={{ padding: '1.2rem 1rem', fontWeight: '800' }}>사용자 이메일 / ID</th>
                                    <th style={{ padding: '1.2rem 1rem', fontWeight: '800' }}>접속 IP</th>
                                    <th style={{ padding: '1.2rem 1rem', fontWeight: '800' }}>주제</th>
                                    <th style={{ padding: '1.2rem 1rem', fontWeight: '800' }}>사용 토큰</th>
                                    <th style={{ padding: '1.2rem 1rem', fontWeight: '800' }}>예상 비용</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usageData.map((log, i) => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', transition: '0.1s', cursor: 'default' }}>
                                        <td style={{ padding: '1.2rem 1rem', whiteSpace: 'nowrap', color: '#64748b', fontSize: '0.95rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> {new Date(log.created_at).toLocaleString()}</div>
                                        </td>
                                        <td style={{ padding: '1.2rem 1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Mail size={16} color="#94a3b8" />
                                                <div style={{ fontWeight: '800', color: '#1e293b' }}>{log.email || '익명 사용자'}</div>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '4px', marginLeft: '24px' }}>UUID: {log.user_id}</div>
                                        </td>
                                        <td style={{ padding: '1.2rem 1rem' }}><code style={{fontSize: '0.9rem', color: '#3b82f6', background: '#eff6ff', padding: '4px 8px', borderRadius: '6px'}}>{log.ip || '0.0.0.0'}</code></td>
                                        <td style={{ padding: '1.2rem 1rem' }}><span style={{ background: '#fef9e7', padding: '4px 12px', borderRadius: '10px', fontWeight: '900', color: '#856404', fontSize: '0.9rem' }}>{log.topic}</span></td>
                                        <td style={{ padding: '1.2rem 1rem', fontWeight: '800' }}>{log.tokens_used.toLocaleString()} <span style={{fontSize: '0.75rem', color: '#cbd5e1'}}>T</span></td>
                                        <td style={{ padding: '1.2rem 1rem', color: '#f59e0b', fontWeight: '900' }}>${Number(log.cost_usd).toFixed(6)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 접속 로그 */}
                <div style={{ background: '#fff', borderRadius: '35px', padding: '2.5rem', boxShadow: '0 20px 60px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                            <Users size={24} color="#10b981" />
                            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '900' }}>실시간 로그인 및 접속 로그 (access_logs)</h3>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => downloadCSV(accessData, 'access_logs')} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #e2e8f0', padding: '0.8rem 1.2rem', borderRadius: '15px', background: '#fff', fontSize: '0.9rem', fontWeight: '800', color: '#64748b', cursor: 'pointer' }}>
                                <Download size={16} /> 엑셀 다운로드
                            </button>
                            <button onClick={() => handleDelete('access_logs')} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #fee2e2', padding: '0.8rem 1.2rem', borderRadius: '15px', background: '#fef2f2', color: '#ef4444', fontSize: '0.9rem', fontWeight: '800', cursor: 'pointer' }}>
                                <Trash2 size={16} /> 로그 비우기
                            </button>
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#94a3b8' }}>
                                    <th style={{ padding: '1.2rem 1rem', fontWeight: '800' }}>접속 시간</th>
                                    <th style={{ padding: '1.2rem 1rem', fontWeight: '800' }}>사용자 이메일</th>
                                    <th style={{ padding: '1.2rem 1rem', fontWeight: '800' }}>접속 IP</th>
                                    <th style={{ padding: '1.2rem 1rem', fontWeight: '800' }}>환경 (User-Agent)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {accessData.map((log, i) => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '1.2rem 1rem', whiteSpace: 'nowrap', color: '#64748b' }}>{new Date(log.created_at).toLocaleString()}</td>
                                        <td style={{ padding: '1.2rem 1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Mail size={16} color="#94a3b8" />
                                                <div style={{ fontWeight: '800' }}>{log.email || '익명 사용자'}</div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.2rem 1rem' }}><code style={{ color: '#10b981', background: '#f0fdf4', padding: '4px 8px', borderRadius: '6px' }}>{log.ip || '0.0.0.0'}</code></td>
                                        <td style={{ padding: '1.2rem 1rem', color: '#94a3b8', fontSize: '0.85rem', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.user_agent}</td>
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
    <div style={{ background: '#fff', padding: '2rem', borderRadius: '35px', boxShadow: '0 10px 30px rgba(0,0,0,0.02)', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ background: bg, width: '60px', height: '60px', borderRadius: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
        </div>
        <div>
            <div style={{ fontSize: '0.95rem', color: '#64748b', marginBottom: '0.4rem', fontWeight: '700' }}>{title}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '950', color: '#1e293b', letterSpacing: '-0.5px' }}>{value}</div>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem', fontWeight: '500' }}>{unit}</div>
        </div>
    </div>
);

export default AdminStats;
