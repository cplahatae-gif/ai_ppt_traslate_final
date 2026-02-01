/**
 * EmailService - 이메일 알림 서비스
 * 
 * Requirements: 6.1 ~ 6.5
 * 
 * EmailJS를 사용하여 클라이언트 사이드에서 이메일을 발송합니다.
 * 환경 변수(.env)에 다음 키들이 설정되어 있어야 합니다:
 * - VITE_EMAILJS_SERVICE_ID
 * - VITE_EMAILJS_TEMPLATE_ID
 * - VITE_EMAILJS_PUBLIC_KEY
 */

import emailjs from '@emailjs/browser';

export interface EmailParams extends Record<string, unknown> {
    to_name: string;
    to_email: string;
    filename: string;
    message?: string;
    stats?: string;
    link?: string;
}

export class EmailService {
    private serviceId: string;
    private templateId: string;
    private publicKey: string;

    constructor() {
        // 실제 운영 시에는 .env 파일에서 불러옵니다.
        // 사용자가 직접 설정하지 않은 경우 콘솔 로그로 대체합니다.
        this.serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
        this.templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
        this.publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';
    }

    /**
     * 번역 완료 알림을 보냅니다.
     */
    async sendTranslationComplete(email: string, name: string, filename: string, tokenUsage: number): Promise<boolean> {
        return this.sendEmail({
            to_name: name,
            to_email: email,
            filename: filename,
            message: '번역이 성공적으로 완료되었습니다.',
            stats: `사용된 토큰: ${tokenUsage.toLocaleString()}`
        });
    }

    /**
     * 번역 실패 알림을 보냅니다.
     */
    async sendTranslationFailed(email: string, name: string, filename: string, errorMsg: string): Promise<boolean> {
        return this.sendEmail({
            to_name: name,
            to_email: email,
            filename: filename,
            message: `번역 중 오류가 발생했습니다: ${errorMsg}`,
            stats: '-'
        });
    }

    /**
     * 이메일을 발송합니다.
     */
    private async sendEmail(params: EmailParams): Promise<boolean> {
        console.log(`[EmailService] Sending email to ${params.to_email}...`, params);

        // 키가 설정되지 않은 경우 시뮬레이션만 수행
        if (!this.serviceId || !this.templateId || !this.publicKey) {
            console.warn('[EmailService] EmailJS keys are missing. Skipping actual send.');
            return true; // 에러를 내지 않고 성공 처리 (사용자 경험 저하 방지)
        }

        try {
            await emailjs.send(
                this.serviceId,
                this.templateId,
                params,
                this.publicKey
            );
            console.log('[EmailService] Email sent successfully!');
            return true;
        } catch (error) {
            console.error('[EmailService] Failed to send email:', error);
            return false;
        }
    }
}

export const emailService = new EmailService();
