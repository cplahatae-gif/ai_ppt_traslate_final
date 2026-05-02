/**
 * EmailNotifier - 이메일 알림 서비스
 * 
 * Requirements: 6.1 ~ 6.5
 * 
 * 이 서비스는 다음 기능을 담당합니다:
 * - 번역 완료 이메일 알림
 * - 이메일 템플릿 관리
 * - 오류 처리 및 재시도
 */

import type {
    TranslationJob,
    User,
    EmailNotification,
    EmailResult
} from '../../types';

export class EmailNotifier {
    /**
     * 번역 완료 알림 이메일을 발송합니다
     */
    async sendTranslationComplete(
        user: User,
        translationJob: TranslationJob
    ): Promise<EmailResult> {
        try {
            const notification: EmailNotification = {
                to: user.email,
                subject: `[PPT Translator] 번역 완료: ${translationJob.fileName}`,
                body: this.buildTranslationCompleteBody(translationJob),
                translationJobId: translationJob.id,
            };

            // TODO: 실제 이메일 발송 로직 구현
            console.log('Email would be sent:', notification);

            return {
                success: true,
                messageId: `msg_${Date.now()}`,
            };
        } catch (error) {
            // Requirement 6.4: 이메일 실패 시 오류 로그만 남기고 정상 진행
            console.error('Failed to send email:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * 환영 이메일을 발송합니다
     */
    async sendWelcomeEmail(user: User): Promise<EmailResult> {
        try {
            const notification: EmailNotification = {
                to: user.email,
                subject: '[PPT Translator] 가입을 환영합니다!',
                body: this.buildWelcomeBody(user),
            };

            // TODO: 실제 이메일 발송 로직 구현
            console.log('Welcome email would be sent:', notification);

            return {
                success: true,
                messageId: `msg_${Date.now()}`,
            };
        } catch (error) {
            console.error('Failed to send welcome email:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * 계정 승인 알림 이메일을 발송합니다
     */
    async sendApprovalNotification(user: User): Promise<EmailResult> {
        try {
            const notification: EmailNotification = {
                to: user.email,
                subject: '[PPT Translator] 계정이 승인되었습니다',
                body: this.buildApprovalBody(user),
            };

            // TODO: 실제 이메일 발송 로직 구현
            console.log('Approval email would be sent:', notification);

            return {
                success: true,
                messageId: `msg_${Date.now()}`,
            };
        } catch (error) {
            console.error('Failed to send approval email:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    private buildTranslationCompleteBody(job: TranslationJob): string {
        return `
번역이 완료되었습니다!

파일명: ${job.fileName}
상태: ${job.status}
품질 점수: ${job.qualityScore ?? 'N/A'}
${job.downloadUrl ? `다운로드 링크: ${job.downloadUrl}` : ''}

감사합니다.
PPT Translator 팀
    `.trim();
    }

    private buildWelcomeBody(user: User): string {
        return `
안녕하세요 ${user.name}님,

PPT Translator에 가입해 주셔서 감사합니다!

현재 계정은 관리자 승인 대기 중입니다.
승인이 완료되면 별도로 안내 드리겠습니다.

감사합니다.
PPT Translator 팀
    `.trim();
    }

    private buildApprovalBody(user: User): string {
        return `
안녕하세요 ${user.name}님,

계정이 승인되었습니다!

이제 PPT Translator의 모든 기능을 사용하실 수 있습니다.
로그인하여 서비스를 이용해 주세요.

감사합니다.
PPT Translator 팀
    `.trim();
    }
}

export const emailNotifier = new EmailNotifier();
