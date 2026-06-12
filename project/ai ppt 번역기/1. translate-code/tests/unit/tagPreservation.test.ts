/**
 * 색상 태그 보존 검증 (validateTagPreservation) 테스트
 */
import { describe, it, expect } from 'vitest';
import { validateTagPreservation, extractColorTokens } from '@src/services/aiProvider';

describe('extractColorTokens', () => {
    it('hex와 scheme 토큰을 모두 추출한다', () => {
        expect(extractColorTokens('<color:0000FF>a</color> <color:tx1.lm50000>b</color>'))
            .toEqual(['0000ff', 'tx1.lm50000']);
    });

    it('태그가 없으면 빈 배열', () => {
        expect(extractColorTokens('plain text')).toEqual([]);
    });
});

describe('validateTagPreservation', () => {
    it('색상 토큰이 모두 보존되면 통과', () => {
        expect(validateTagPreservation(
            ['<color:bg1>안녕</color>'],
            ['<color:bg1>Hello</color>'],
        )).toBe(true);
    });

    it('색상 토큰이 소실되면 실패', () => {
        expect(validateTagPreservation(
            ['<color:bg1>안녕</color>'],
            ['Hello'],
        )).toBe(false);
    });

    it('토큰이 변형되면 실패', () => {
        expect(validateTagPreservation(
            ['<color:tx1.lm50000>안녕</color>'],
            ['<color:tx1>Hello</color>'],
        )).toBe(false);
    });

    it('같은 색 조각의 병합은 허용 (집합 비교)', () => {
        expect(validateTagPreservation(
            ['<color:bg1>가</color>나<color:bg1>다</color>'],
            ['<color:bg1>A and C</color> B'],
        )).toBe(true);
    });

    it('배열 길이 불일치는 실패', () => {
        expect(validateTagPreservation(['a', 'b'], ['a'])).toBe(false);
    });

    it('대소문자 차이는 허용', () => {
        expect(validateTagPreservation(
            ['<color:0000FF>안녕</color>'],
            ['<color:0000ff>Hello</color>'],
        )).toBe(true);
    });
});
