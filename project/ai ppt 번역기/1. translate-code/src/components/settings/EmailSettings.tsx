import React, { useEffect, useState } from 'react';
import { emailService } from '../../services/email/EmailService';

interface EmailSettingsProps {
    userEmail: string;
    userName: string;
}

export const EmailSettings: React.FC<EmailSettingsProps> = ({ userEmail, userName }) => {
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // 로컬 스토리지에서 설정 불러오기
        const saved = localStorage.getItem(`email_notify_${userEmail}`);
        if (saved) {
            setEnabled(saved === 'true');
        }
    }, [userEmail]);

    const handleToggle = (checked: boolean) => {
        setEnabled(checked);
        localStorage.setItem(`email_notify_${userEmail}`, String(checked));
    };

    const handleTestSend = async () => {
        if (!enabled) return;
        setLoading(true);
        try {
            await emailService.sendTranslationComplete(
                userEmail,
                userName,
                '테스트_파일.pptx',
                100
            );
            alert('테스트 이메일 발송 요청을 보냈습니다. (콘솔 확인)');
        } catch (e) {
            alert('발송 실패');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mt-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span>📧</span> 이메일 알림 설정
            </h3>

            <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="text-gray-300 font-medium">번역 완료 알림 받기</p>
                    <p className="text-sm text-gray-500">
                        번역이 완료되거나 실패했을 때 가입된 이메일({userEmail})로 알림을 보냅니다.
                    </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={enabled}
                        onChange={(e) => handleToggle(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            {enabled && (
                <div className="mt-4 p-4 bg-gray-900/50 rounded border border-gray-700 flex justify-between items-center">
                    <span className="text-sm text-gray-400">
                        * 현재 EmailJS 설정이 되어있지 않다면 실제 메일은 가지 않고 콘솔에만 기록됩니다.
                    </span>
                    <button
                        onClick={handleTestSend}
                        disabled={loading}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-xs text-white rounded transition-colors"
                    >
                        {loading ? '발송 중...' : '테스트 발송'}
                    </button>
                </div>
            )}
        </div>
    );
};
