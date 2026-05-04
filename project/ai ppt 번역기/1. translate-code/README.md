# AI PPT 번역기 v3

PowerPoint 한→영 자동 번역 웹앱. 브라우저에서 직접 실행하며, 번역 결과 AI 품질 검증과 이슈 수정 재생성 기능을 포함합니다.

## 주요 기능

- **멀티 프로바이더**: Gemini (2.5 Flash/Pro), Claude (Haiku/Sonnet/Opus), OpenAI (GPT-4o/GPT-5)
- **100% 클라이언트 사이드**: 파일이 서버에 전송되지 않음
- **포맷 보존**: 볼드/이탤릭/색상, 자간, 줄간격 OOXML 수준으로 유지
- **AI 품질 검증**: 번역 완료 후 자동으로 품질 점수 산출 및 이슈 목록 제공
- **수정 반영**: 품질 이슈를 선택하면 해당 텍스트만 교정하여 PPTX 재생성
- **페이지 범위 선택**: 원하는 슬라이드만 번역

## 시작하기

```bash
npm install
npm run dev
# http://localhost:5173 에서 실행
```

## API 키 설정

`.env` 파일 불필요. 앱의 "번역 설정" 패널에서 직접 입력합니다.

| 프로바이더 | API 키 발급 |
|---|---|
| Gemini | [Google AI Studio](https://aistudio.google.com/apikey) |
| Claude | [Anthropic Console](https://console.anthropic.com/settings/keys) |
| OpenAI | [OpenAI Platform](https://platform.openai.com/api-keys) |

## 개발

```bash
npm run dev            # 개발 서버 (localhost:5173)
npm run test           # 유닛 테스트
npm run test:ui        # 테스트 UI (브라우저)
npm run test:coverage  # 커버리지 리포트
```

## 배포

로컬 `npm run build` 대신 Vercel 원격 빌드를 권장합니다 (Windows 한글 경로 문제 우회).

```bash
npx vercel --prod --yes
```

배포 후 [https://1-translate-code.vercel.app](https://1-translate-code.vercel.app) 에서 확인.

## 프로젝트 구조

```
src/
├── components/
│   ├── config/TranslationOptions.tsx  # 번역 설정 패널 (Provider/Model/API Key)
│   ├── upload/                        # 파일 업로드 UI
│   └── ...
├── services/
│   ├── pptxService.ts                 # PPTX 파싱/재조립 (OOXML)
│   ├── geminiService.ts               # 번역 진입점, 배치 처리, 재시도
│   ├── QualityService.ts              # 번역 품질 검증 (Gemini 고정)
│   ├── aiProvider.ts                  # Provider 추상화, 시스템 프롬프트 생성, 에러 분류
│   ├── modelCatalog.ts                # Provider/Model 카탈로그, API 키 스토리지 관리
│   └── providers/
│       ├── geminiProvider.ts          # Google GenAI SDK 구현체
│       ├── claudeProvider.ts          # Anthropic fetch 기반 구현체
│       └── openaiProvider.ts          # OpenAI fetch 기반 구현체
└── App.tsx                            # 메인 상태 및 번역 플로우
```

## 번역 플로우

```
PPTX 업로드 → 슬라이드 분석
→ 번역 설정 (Provider/Model/API Key/범위/지침)
→ 텍스트 추출 (OOXML 파싱)
→ AI 번역 (배치, 재시도)
→ PPTX 재조립 (색상/자간/줄간격 보정)
→ AI 품질 검증
→ 다운로드 / 이슈 수정 후 재생성
```

## 알려진 제약

| 항목 | 내용 |
|---|---|
| 로컬 빌드 | 경로에 한글/공백 포함 시 Node.js v24에서 빌드 실패 (`ERR_INVALID_PACKAGE_CONFIG`). `npx vercel --prod --yes` 사용할 것 |
| API 키 저장 | 브라우저 스토리지에 보관됨. 공용 PC에서는 사용 후 키를 직접 삭제할 것 |
| Supabase | 설정 전까지 로그인/토큰 추적 비활성. 번역 기능은 API 키만 있으면 정상 작동 |
| 품질 검증 | 선택 Provider와 무관하게 Gemini API 키 필요 (별도 처리) |
