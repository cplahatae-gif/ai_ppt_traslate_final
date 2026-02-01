import React, { useEffect, useState } from 'react';
import { adminService, AdminStats } from '../../services/admin/AdminService';
import { authService } from '../../services/auth/AuthService';
import { User } from '../../types';

interface AdminDashboardProps {
    currentUser: User;
    onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, onLogout }) => {
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
            setRefreshKey(prev => prev + 1); // 리프레시
        } catch (err) {
            alert('승인 처리에 실패했습니다.');
        }
    };

    if (!currentUser.isAdmin) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center text-red-500">
                접근 권한이 없습니다.
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="flex justify-between items-center mb-12 border-b border-gray-800 pb-6">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                            Admin Dashboard
                        </h1>
                        <p className="text-gray-500 mt-2">시스템 현황 및 사용자 관리</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-gray-400">{currentUser.name} (관리자)</span>
                        <button
                            onClick={onLogout}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
                        >
                            로그아웃
                        </button>
                    </div>
                </header>

                {loading && !stats ? (
                    <div className="text-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p className="text-gray-400">데이터 로딩 중...</p>
                    </div>
                ) : (
                    <>
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                            <StatCard
                                title="총 사용자"
                                value={stats?.totalUsers || 0}
                                icon="👥"
                                color="blue"
                            />
                            <StatCard
                                title="승인 대기"
                                value={stats?.pendingUsers || 0}
                                icon="⏳"
                                color="yellow"
                            />
                            <StatCard
                                title="오늘의 토큰 사용량"
                                value={stats?.todayTokens.toLocaleString() || 0}
                                icon="💎"
                                color="purple"
                            />
                            <StatCard
                                title="오류 발생"
                                value={stats?.totalErrors || 0}
                                icon="⚠️"
                                color="red"
                            />
                        </div>

                        {/* User Management */}
                        <div className="bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-700">
                            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                                <h2 className="text-xl font-bold">사용자 목록</h2>
                                <button
                                    onClick={() => setRefreshKey(p => p + 1)}
                                    className="text-sm text-blue-400 hover:text-blue-300"
                                >
                                    새로고침
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-700/50 text-gray-400 text-sm uppercase">
                                        <tr>
                                            <th className="px-6 py-4">사용자 정보</th>
                                            <th className="px-6 py-4">가입일</th>
                                            <th className="px-6 py-4">최근 접속</th>
                                            <th className="px-6 py-4">상태</th>
                                            <th className="px-6 py-4">관리</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {users.map((user) => (
                                            <tr key={user.id} className="hover:bg-gray-750 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-white">{user.name}</div>
                                                    <div className="text-sm text-gray-500">{user.email}</div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-400">
                                                    {user.createdAt.toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-400">
                                                    {user.lastLoginAt.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {user.isApproved ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/50 text-green-400 border border-green-700">
                                                            승인됨
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-900/50 text-yellow-400 border border-yellow-700">
                                                            대기 중
                                                        </span>
                                                    )}
                                                    {user.isAdmin && (
                                                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-900/50 text-purple-400 border border-purple-700">
                                                            관리자
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {!user.isApproved && (
                                                        <button
                                                            onClick={() => handleApprove(user.id)}
                                                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded shadow transition-colors"
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
    const colorClasses = {
        blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        yellow: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
        red: 'bg-red-500/10 text-red-500 border-red-500/20',
    }[color];

    return (
        <div className={`p-6 rounded-2xl border ${colorClasses.split(' ')[2]} bg-gray-800 shadow-lg`}>
            <div className="flex items-center justify-between mb-4">
                <span className="text-gray-400 text-sm font-medium">{title}</span>
                <span className={`text-2xl p-2 rounded-lg ${colorClasses.split(' ')[0]} ${colorClasses.split(' ')[1]}`}>
                    {icon}
                </span>
            </div>
            <div className="text-3xl font-bold text-gray-100">{value}</div>
        </div>
    );
};
