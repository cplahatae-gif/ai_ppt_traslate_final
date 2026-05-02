/**
 * Task 1.1: Project Structure Setup Tests
 * 
 * 이 테스트는 프로젝트 구조가 올바르게 설정되었는지 검증합니다.
 * Requirements: 8.2 (React + TypeScript + Vite 아키텍처 보존)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('Project Structure Setup', () => {
    describe('Required Directories', () => {
        const requiredDirs = [
            'src',
            'src/types',
            'src/lib',
            'tests',
            'tests/unit',
            'src/components',
            'src/services',
        ];

        it.each(requiredDirs)('should have %s directory', (dir) => {
            const dirPath = path.join(PROJECT_ROOT, dir);
            expect(fs.existsSync(dirPath)).toBe(true);
        });
    });

    describe('Required Files', () => {
        const requiredFiles = [
            'package.json',
            'tsconfig.json',
            'vite.config.ts',
            'vitest.config.ts',
            '.env.example',
            'src/types/index.ts',
            'src/lib/supabase.ts',
        ];

        it.each(requiredFiles)('should have %s file', (file) => {
            const filePath = path.join(PROJECT_ROOT, file);
            expect(fs.existsSync(filePath)).toBe(true);
        });
    });

    describe('Package.json Configuration', () => {
        let packageJson: Record<string, unknown>;

        beforeAll(() => {
            const packagePath = path.join(PROJECT_ROOT, 'package.json');
            packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        });

        it('should have test scripts', () => {
            const scripts = packageJson.scripts as Record<string, string>;
            expect(scripts.test).toBeDefined();
            expect(scripts['test:coverage']).toBeDefined();
        });

        it('should have Supabase dependency', () => {
            const deps = packageJson.dependencies as Record<string, string>;
            expect(deps['@supabase/supabase-js']).toBeDefined();
        });

        it('should have React Router dependency', () => {
            const deps = packageJson.dependencies as Record<string, string>;
            expect(deps['react-router-dom']).toBeDefined();
        });

        it('should have Vitest dev dependency', () => {
            const devDeps = packageJson.devDependencies as Record<string, string>;
            expect(devDeps['vitest']).toBeDefined();
        });

        it('should have Fast-check dev dependency', () => {
            const devDeps = packageJson.devDependencies as Record<string, string>;
            expect(devDeps['fast-check']).toBeDefined();
        });
    });

    describe('TypeScript Types', () => {
        it('should export User type', async () => {
            const types = await import('../../src/types');
            expect(types).toHaveProperty('DocumentType');
        });
    });
});
