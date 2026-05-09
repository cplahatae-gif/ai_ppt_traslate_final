import '@testing-library/jest-dom';
import { beforeAll, afterAll } from 'vitest';

// Global test setup
beforeAll(() => {
    // Setup code that runs before all tests
});

afterAll(() => {
    // Cleanup code that runs after all tests
});

// Mock environment variables for testing
Object.defineProperty(import.meta, 'env', {
    value: {
        VITE_GEMINI_API_KEY: 'test-api-key',
    },
});
