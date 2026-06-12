/**
 * 색상 태그 보존 검증 (validateTagPreservation) + 결정적 복원 (repairColorTags) 테스트
 */
import { describe, it, expect } from 'vitest';
import { validateTagPreservation, repairColorTags, extractColorTokens, unifyTranslations } from '@src/services/aiProvider';

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

    it('LLM이 원본에 없는 색을 발명하면 실패', () => {
        expect(validateTagPreservation(
            ['<color:282828>※ 주의사항</color>'],
            ['<color:FF0000>※ Note</color>'],
        )).toBe(false);
        // 원본 색은 유지하면서 새 색을 추가한 경우도 실패
        expect(validateTagPreservation(
            ['<color:282828>본문</color>'],
            ['<color:FF0000>Warning</color> <color:282828>body</color>'],
        )).toBe(false);
    });
});

describe('repairColorTags (결정적 복원)', () => {
    it('토큰 집합이 일치하면 그대로 반환', () => {
        const t = '<color:0000FF>Hello</color> world';
        expect(repairColorTags('<color:0000FF>안녕</color> 세상', t)).toBe(t);
    });

    it('원본에 색이 없으면 발명된 색 태그를 모두 제거', () => {
        expect(repairColorTags(
            '일반 텍스트',
            '<color:FF0000>Invented red</color> text',
        )).toBe('Invented red text');
    });

    it('단색 전체 문단은 원본 색으로 통째 재래핑 (보안경 ※줄 케이스)', () => {
        // 원본: 전체가 282828인데 LLM이 FF0000으로 바꿔버린 실제 사례
        expect(repairColorTags(
            '<b><color:282828>※ 보안경, 마스크, 소음용 귀마개 등 작업환경에 따라 착용</color></b>',
            '<color:FF0000>※ Wear safety glasses, masks, earplugs, etc.</color>',
        )).toBe('<color:282828>※ Wear safety glasses, masks, earplugs, etc.</color>');
    });

    it('단색 문단 + 부분 색 발명 혼합도 재래핑으로 정리 (①② 케이스)', () => {
        const orig = '<b><color:282828>① 보안경은 착용</color></b><br><color:282828>- 세부사항</color>';
        const trans = '<color:FF0000>① Wear safety glasses</color><br><color:282828>- details</color>';
        expect(repairColorTags(orig, trans))
            .toBe('<color:282828>① Wear safety glasses<br>- details</color>');
    });

    it('다색 문단은 원본에 없는 색의 여는 태그만 제거', () => {
        const orig = '<color:FF0000>빨강</color> <color:0000FF>파랑</color>';
        const trans = '<color:FF0000>Red</color> <color:00FF00>Green</color> <color:0000FF>Blue</color>';
        const repaired = repairColorTags(orig, trans);
        expect(repaired).toContain('<color:FF0000>Red</color>');
        expect(repaired).not.toContain('<color:00FF00>');
        expect(repaired).toContain('Green');
        expect(repaired).toContain('<color:0000FF>Blue</color>');
    });
});

describe('unifyTranslations (동일 원문 → 동일 번역)', () => {
    it('반복 라벨의 비일관 번역을 첫 번역으로 통일 (지참→Bring/Required 실사례)', () => {
        const orig = ['지참', '골재', '지참', '지참'];
        const trans = ['Required', 'Aggregate', 'Bring', 'Required'];
        expect(unifyTranslations(orig, trans))
            .toEqual(['Required', 'Aggregate', 'Required', 'Required']);
    });

    it('서로 다른 원문은 건드리지 않음', () => {
        const orig = ['하나', '둘'];
        const trans = ['One', 'Two'];
        expect(unifyTranslations(orig, trans)).toEqual(['One', 'Two']);
    });

    it('빈 원문은 통일 대상에서 제외', () => {
        const orig = ['', ''];
        const trans = ['A', 'B'];
        expect(unifyTranslations(orig, trans)).toEqual(['A', 'B']);
    });
});
