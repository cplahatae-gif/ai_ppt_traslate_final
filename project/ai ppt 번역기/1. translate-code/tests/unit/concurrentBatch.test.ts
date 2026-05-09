import { describe, it, expect, vi, beforeEach } from 'vitest';

// translateTexts uses dynamic import for providers; mock the dispatcher module
vi.mock('../../src/services/aiProvider', async () => {
    const actual = await vi.importActual<any>('../../src/services/aiProvider');
    return {
        ...actual,
        getTranslateBatch: vi.fn(),
    };
});

import { translateTexts } from '../../src/services/geminiService';
import { getTranslateBatch, categorizeError } from '../../src/services/aiProvider';

const mockedGetTranslateBatch = vi.mocked(getTranslateBatch);

describe('translateTexts — concurrent batch processing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('preserves order across concurrent batches', async () => {
        // Each batch returns its inputs uppercased so we can verify mapping
        mockedGetTranslateBatch.mockResolvedValue(async (batch: string[]) => {
            // Stagger response times to ensure parallel completion order ≠ submission order
            const delay = batch[0].includes('A') ? 30 : 10;
            await new Promise(r => setTimeout(r, delay));
            return batch.map(t => t.toUpperCase());
        });

        // 6 items, batchSize=2 → 3 batches
        const inputs = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];
        const result = await translateTexts(
            inputs,
            undefined,
            undefined,
            undefined,
            2, // batchSize
            'test-key',
            'gemini',
            'gemini-2.5-flash'
        );

        expect(result).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
    });

    it('returns empty array for empty input without calling provider', async () => {
        const fn = vi.fn();
        mockedGetTranslateBatch.mockResolvedValue(fn);

        const result = await translateTexts([]);

        expect(result).toEqual([]);
        expect(fn).not.toHaveBeenCalled();
    });

    it('reports progress per completed batch', async () => {
        mockedGetTranslateBatch.mockResolvedValue(async (batch: string[]) => batch);
        const onProgress = vi.fn();

        const inputs = Array.from({ length: 6 }, (_, i) => `t${i}`);
        await translateTexts(
            inputs,
            onProgress,
            undefined,
            undefined,
            2, // batchSize=2 → 3 batches
            'test-key',
            'gemini',
            'gemini-2.5-flash'
        );

        // Should be called 3 times (once per batch), final call with (3, 3)
        expect(onProgress).toHaveBeenCalledTimes(3);
        expect(onProgress).toHaveBeenLastCalledWith(3, 3);
    });

    it('retries a failing batch up to MAX_RETRIES then succeeds', async () => {
        let attempts = 0;
        mockedGetTranslateBatch.mockResolvedValue(async (batch: string[]) => {
            attempts++;
            if (attempts < 2) {
                throw new Error('transient failure');
            }
            return batch.map(t => `ok-${t}`);
        });

        const result = await translateTexts(
            ['x'],
            undefined,
            undefined,
            undefined,
            10,
            'test-key',
            'gemini',
            'gemini-2.5-flash'
        );

        expect(result).toEqual(['ok-x']);
        expect(attempts).toBeGreaterThanOrEqual(2);
    }, 15000); // 2s × 1 attempt backoff + buffer

    it('throws categorized error after exhausting retries', async () => {
        mockedGetTranslateBatch.mockResolvedValue(async () => {
            throw new Error('401 unauthorized');
        });

        await expect(
            translateTexts(
                ['x'],
                undefined,
                undefined,
                undefined,
                10,
                'bad-key',
                'gemini',
                'gemini-2.5-flash'
            )
        ).rejects.toThrow(/API 키가 잘못/);
    }, 20000); // 2+4 = 6s of backoffs + buffer
});
