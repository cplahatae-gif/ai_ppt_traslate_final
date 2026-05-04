import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, categorizeError } from '../../src/services/aiProvider';

describe('buildSystemPrompt', () => {
    it('returns a non-empty string with batch length embedded', () => {
        const result = buildSystemPrompt(5);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
        expect(result).toContain('5');
    });

    it('includes Additional Context section when promptInstruction is provided', () => {
        const result = buildSystemPrompt(3, 'Use formal English.');
        expect(result).toContain('# Additional Context');
        expect(result).toContain('Use formal English.');
    });

    it('omits Additional Context section when promptInstruction is empty', () => {
        const result = buildSystemPrompt(3, '');
        expect(result).not.toContain('# Additional Context');
    });

    it('omits Additional Context section when promptInstruction is only whitespace', () => {
        const result = buildSystemPrompt(3, '   \n  ');
        expect(result).not.toContain('# Additional Context');
    });

    it('includes Glossary section when glossary is provided', () => {
        const result = buildSystemPrompt(3, undefined, '안전: Safety\n사고: Accident');
        expect(result).toContain('# Terminology/Glossary');
        expect(result).toContain('안전: Safety');
    });

    it('omits Glossary section when glossary is empty', () => {
        const result = buildSystemPrompt(3, undefined, '');
        expect(result).not.toContain('# Terminology/Glossary');
    });

    it('includes both sections when both params are provided', () => {
        const result = buildSystemPrompt(10, 'Be concise.', 'LLM: 거대언어모델');
        expect(result).toContain('# Additional Context');
        expect(result).toContain('# Terminology/Glossary');
    });

    it('enforces one-to-one mapping rule', () => {
        const result = buildSystemPrompt(7);
        expect(result).toContain('One-to-One Mapping');
        expect(result).toContain('7');
    });

    it('enforces tag preservation rule', () => {
        const result = buildSystemPrompt(1);
        expect(result).toContain('Tag Preservation');
    });
});

describe('categorizeError', () => {
    it('categorizes 401 as API key error', () => {
        const err = categorizeError(new Error('401 Unauthorized'));
        expect(err.message).toContain('API 키가 잘못되었습니다');
    });

    it('categorizes 403 as API key error', () => {
        const err = categorizeError(new Error('403 Forbidden'));
        expect(err.message).toContain('API 키가 잘못되었습니다');
    });

    it('categorizes API_KEY_INVALID as API key error', () => {
        const err = categorizeError(new Error('API_KEY_INVALID'));
        expect(err.message).toContain('API 키가 잘못되었습니다');
    });

    it('categorizes authentication error as API key error', () => {
        const err = categorizeError(new Error('authentication failed'));
        expect(err.message).toContain('API 키가 잘못되었습니다');
    });

    it('categorizes 404 as model not found', () => {
        const err = categorizeError(new Error('404 model not found'));
        expect(err.message).toContain('선택된 모델을 사용할 수 없습니다');
    });

    it('categorizes model_not_found as model error', () => {
        const err = categorizeError(new Error('model_not_found'));
        expect(err.message).toContain('선택된 모델을 사용할 수 없습니다');
    });

    it('categorizes 429 as rate limit', () => {
        const err = categorizeError(new Error('429 Too Many Requests'));
        expect(err.message).toContain('요청이 많아 일시적으로 제한됩니다');
    });

    it('categorizes RESOURCE_EXHAUSTED as rate limit', () => {
        const err = categorizeError(new Error('RESOURCE_EXHAUSTED: quota exceeded'));
        expect(err.message).toContain('요청이 많아 일시적으로 제한됩니다');
    });

    it('returns original Error for unknown errors', () => {
        const original = new Error('some unexpected error');
        const err = categorizeError(original);
        expect(err).toBe(original);
    });

    it('wraps non-Error string in Error', () => {
        const err = categorizeError('plain string error');
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('plain string error');
    });

    it('wraps non-Error object in Error', () => {
        const err = categorizeError({ code: 500 });
        expect(err).toBeInstanceOf(Error);
    });
});
