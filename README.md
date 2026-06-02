# AI PPT Translator

<!-- PUBLIC-PURPOSE-INTRO:START -->

## 왜 이 프로젝트가 중요한가

좋은 발표 자료는 언어 장벽 때문에 사라지지 않아야 합니다. 이 프로젝트는 PPT 자료의 의미와 구조를 보존하면서 번역 과정을 자동화해, 지식 전달의 범위를 넓히는 것을 목표로 합니다.

## 기술적으로 무엇을 보여주는가

TypeScript 기반 애플리케이션 구조로 문서 입력, 번역 처리, 결과 검토 흐름을 나눕니다. 단순 문자열 치환이 아니라 슬라이드의 구조와 맥락을 최대한 유지하는 방향을 지향합니다.

## 공개 저장소로서의 의미

기술적으로는 문서 자동화와 AI 번역의 결합이며, 사회적으로는 교육·업무 자료의 접근성과 재사용성을 높이는 도구입니다.

<!-- PUBLIC-PURPOSE-INTRO:END -->


Web app for translating Korean PowerPoint files into English with Gemini while
preserving as much slide structure and text styling as possible.

The main application lives in `project/ai ppt 번역기/1. translate-code`.

## What It Does

- Uploads `.pptx` files in the browser
- Extracts slide text and sends translation batches to Gemini
- Supports a safety terminology glossary and custom prompt guidance
- Rebuilds a translated `.pptx` file for download
- Preserves common text styling such as bold, italic, font size, line breaks,
  and paragraph structure where possible
- Includes quality-check and PPT inspection utilities used during development

## Current Status

| Item | Status |
| --- | --- |
| Main app | `project/ai ppt 번역기/1. translate-code` |
| UI stack | React 19 + Vite |
| AI provider | Google Gemini |
| Test runner | Vitest |
| Deployment target | Vercel/static web hosting |

## Repository Layout

```text
.
├── project/
│   ├── ai ppt 번역기/
│   │   ├── 1. translate-code/    # Main translator web app
│   │   ├── 2. ppt/               # Sample and analysis PPT assets
│   │   └── 3. text/              # Glossary and translation guide files
│   └── 평가code/                 # Translation quality evaluation prototype
├── docs/                         # Roadmap and dev notes
└── README.md
```

## Run Locally

```bash
cd "project/ai ppt 번역기/1. translate-code"
npm install
npm run dev
```

## Build

```bash
cd "project/ai ppt 번역기/1. translate-code"
npm run build
```

## Test

```bash
cd "project/ai ppt 번역기/1. translate-code"
npm test
```

## Environment

Create `project/ai ppt 번역기/1. translate-code/.env.local` if you want to
provide a default Gemini key for local development.

```text
VITE_GEMINI_API_KEY=your_gemini_api_key
```

Users can also enter their own Gemini API key in the app UI.

## Development Notes

- The repository contains analysis scripts for comparing PPT XML, layout, and
  style preservation.
- Highlight/background-color handling has been investigated separately and is
  documented in `docs/DEVLOG_2026-02-01.md`.
- Some sample materials are domain-specific. Review sample files before using
  this repository as a public template.

## License

MIT License
