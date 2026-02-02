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
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1 mb-1">
                        <span className="material-symbols-outlined text-xs">mail</span> 이메일 알림
                    </label>
                    <p className="text-[10px] text-gray-400">
                        번역 완료/실패 시 {userEmail}로 알림
                    </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={enabled}
                        onChange={(e) => handleToggle(e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
            </div>

            {enabled && (
                <div className="p-2.5 bg-gray-50 rounded-md border border-gray-200 flex justify-between items-center">
                    <span className="text-[9px] text-gray-400">
                        * EmailJS 미설정 시 콘솔에만 기록됩니다.
                    </span>
                    <button
                        onClick={handleTestSend}
                        disabled={loading}
                        className="px-2 py-1 bg-white hover:bg-gray-100 text-[10px] text-gray-600 font-bold rounded border border-gray-200 transition-colors disabled:opacity-50"
                    >
                        {loading ? '발송 중...' : '테스트'}
                    </button>
                </div>
            )}
        </div>
    );
};

