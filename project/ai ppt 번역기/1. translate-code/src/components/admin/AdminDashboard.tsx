import React, { useEffect, useState } from 'react';
import { adminService, AdminStats } from '../../services/admin/AdminService';
import { authService } from '../../services/auth/AuthService';
import { User } from '../../types';

interface AdminDashboardProps {
    currentUser: User;
    onLogout: () => void;
    onBack?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, onLogout, onBack }) => {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [statsData, usersData] = await Promise.all([
                    adminService.getSystemStats(),
                    adminService.getAllUsers()
                ]);
                setStats(statsData);
                setUsers(usersData);
            } catch (err) {
                console.error(err);
                setError('데이터를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [refreshKey]);

    const handleApprove = async (userId: string) => {
        try {
            if (!confirm('이 사용자를 승인하시겠습니까?')) return;
            await adminService.approveUser(userId);
            setRefreshKey(prev => prev + 1);
        } catch (err) {
            alert('승인 처리에 실패했습니다.');
        }
    };

    const handleLogout = async () => {
        try {
            await authService.logout();
            onLogout();
        } catch (err) {
            console.error('Logout failed:', err);
            onLogout(); // 에러가 나도 일단 로그아웃 처리
        }
    };

    if (!currentUser.isAdmin) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center text-red-600 font-bold">
                접근 권한이 없습니다.
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-black font-display p-8">
            <div className="max-w-7xl mx-auto">
                <header className="flex justify-between items-center mb-12 border-b-2 border-black pb-6">
                    <div className="flex items-center gap-4">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-black rounded-lg text-sm font-bold transition-colors"
                            >
                                <span className="material-symbols-outlined text-lg">arrow_back</span>
                                돌아가기
                            </button>
                        )}
                        <div>
                            <h1 className="text-3xl font-black text-black">
                                관리자 대시보드
                            </h1>
                            <p className="text-gray-600 mt-1 font-medium">시스템 현황 및 사용자 관리</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-gray-700 font-bold">{currentUser.name} (관리자)</span>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-lg text-sm font-bold transition-colors"
                        >
                            로그아웃
                        </button>
                    </div>
                </header>

                {loading && !stats ? (
                    <div className="text-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
                        <p className="text-gray-600 font-medium">데이터 로딩 중...</p>
                    </div>
                ) : (
                    <>
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                            <StatCard
                                title="총 사용자"
                                value={stats?.totalUsers || 0}
                                icon="group"
                                color="primary"
                            />
                            <StatCard
                                title="승인 대기"
                                value={stats?.pendingUsers || 0}
                                icon="hourglass_empty"
                                color="yellow"
                            />
                            <StatCard
                                title="오늘의 토큰 사용량"
                                value={stats?.todayTokens.toLocaleString() || 0}
                                icon="token"
                                color="green"
                            />
                            <StatCard
                                title="오류 발생"
                                value={stats?.totalErrors || 0}
                                icon="warning"
                                color="red"
                            />
                        </div>

                        {/* User Management */}
                        <div className="bg-white rounded-xl shadow-float overflow-hidden border-2 border-black">
                            <div className="p-6 border-b-2 border-gray-200 flex justify-between items-center">
                                <h2 className="text-xl font-black">사용자 목록</h2>
                                <button
                                    onClick={() => setRefreshKey(p => p + 1)}
                                    className="text-sm text-primary hover:text-primary-hover font-bold"
                                >
                                    새로고침
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-100 text-gray-700 text-sm uppercase font-bold">
                                        <tr>
                                            <th className="px-6 py-4">사용자 정보</th>
                                            <th className="px-6 py-4">가입일</th>
                                            <th className="px-6 py-4">최근 접속</th>
                                            <th className="px-6 py-4">상태</th>
                                            <th className="px-6 py-4">관리</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {users.map((user) => (
                                            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-black">{user.name}</div>
                                                    <div className="text-sm text-gray-500">{user.email}</div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    {user.createdAt.toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    {user.lastLoginAt.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {user.isApproved ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-300">
                                                            승인됨
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-300">
                                                            대기 중
                                                        </span>
                                                    )}
                                                    {user.isAdmin && (
                                                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/30">
                                                            관리자
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {!user.isApproved && (
                                                        <button
                                                            onClick={() => handleApprove(user.id)}
                                                            className="px-3 py-1 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded shadow transition-colors"
                                                        >
                                                            승인하기
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const StatCard: React.FC<{ title: string; value: number | string; icon: string; color: string }> = ({ title, value, icon, color }) => {
    const colorClasses: Record<string, string> = {
        primary: 'bg-primary/10 text-primary border-primary/30',
        yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
        green: 'bg-green-100 text-green-700 border-green-300',
        red: 'bg-red-100 text-red-700 border-red-300',
    };

    const classes = colorClasses[color] || colorClasses.primary;

    return (
        <div className={`p-6 rounded-xl border-2 border-black bg-white shadow-card`}>
            <div className="flex items-center justify-between mb-4">
                <span className="text-gray-600 text-sm font-bold uppercase">{title}</span>
                <span className={`material-symbols-outlined text-2xl p-2 rounded-lg ${classes}`}>
                    {icon}
                </span>
            </div>
            <div className="text-4xl font-black text-black">{value}</div>
        </div>
    );
};
