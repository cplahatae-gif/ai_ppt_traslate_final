export type ProviderId = 'gemini' | 'claude' | 'openai';

export interface ModelOption {
    id: string;
    label: string;
    description: string;
}

export interface ProviderConfig {
    id: ProviderId;
    label: string;
    apiKeyLabel: string;
    apiKeyPlaceholder: string;
    localStorageKey: string;
    models: ModelOption[];
    defaultModel: string;
}

export const PROVIDERS: ProviderConfig[] = [
    {
        id: 'gemini',
        label: 'Google Gemini',
        apiKeyLabel: 'Gemini API Key',
        apiKeyPlaceholder: 'AIza...',
        localStorageKey: 'gemini_api_key',
        models: [
            { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: '빠르고 효율적 (권장)' },
            { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: '고품질, 복잡한 문서에 적합' },
            { id: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Exp', description: '실험적 버전' },
        ],
        defaultModel: 'gemini-2.5-flash',
    },
    {
        id: 'claude',
        label: 'Anthropic Claude',
        apiKeyLabel: 'Anthropic API Key',
        apiKeyPlaceholder: 'sk-ant-...',
        localStorageKey: 'anthropic_api_key',
        models: [
            { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', description: '빠르고 경제적' },
            { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', description: '균형잡힌 성능 (권장)' },
            { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', description: '최고 품질' },
        ],
        defaultModel: 'claude-sonnet-4-6',
    },
    {
        id: 'openai',
        label: 'OpenAI',
        apiKeyLabel: 'OpenAI API Key',
        apiKeyPlaceholder: 'sk-...',
        localStorageKey: 'openai_api_key',
        models: [
            { id: 'gpt-4o-mini', label: 'GPT-4o Mini', description: '빠르고 경제적' },
            { id: 'gpt-4o', label: 'GPT-4o', description: '균형잡힌 성능 (권장)' },
            { id: 'gpt-5', label: 'GPT-5', description: '최고 품질 (요금 유의)' },
        ],
        defaultModel: 'gpt-4o',
    },
];

export const getProviderConfig = (id: ProviderId): ProviderConfig =>
    PROVIDERS.find(p => p.id === id) ?? PROVIDERS[0];

const REMEMBER_KEY = 'api_key_remember';

export const isApiKeyRemembered = (): boolean => {
    const val = localStorage.getItem(REMEMBER_KEY);
    return val === null ? true : val === 'true';
};

export const setApiKeyRemember = (remember: boolean): void => {
    localStorage.setItem(REMEMBER_KEY, String(remember));
    if (!remember) {
        PROVIDERS.forEach(p => localStorage.removeItem(p.localStorageKey));
    }
};

export const getApiKeyFromStorage = (providerId: ProviderId): string => {
    const config = getProviderConfig(providerId);
    return (
        sessionStorage.getItem(config.localStorageKey) ||
        (isApiKeyRemembered() ? localStorage.getItem(config.localStorageKey) : '') ||
        ''
    );
};

export const saveApiKeyToStorage = (providerId: ProviderId, key: string): void => {
    const config = getProviderConfig(providerId);
    sessionStorage.setItem(config.localStorageKey, key);
    if (isApiKeyRemembered()) {
        localStorage.setItem(config.localStorageKey, key);
    }
};
