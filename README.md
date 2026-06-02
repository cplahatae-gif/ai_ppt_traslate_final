# AI PPT Translator

<!-- PROJECT-INTRO:START -->

## 프로젝트가 중요한 이유

발표 자료는 조직의 지식이 압축된 결과물입니다. 언어 장벽 때문에 그 지식이 특정 사람이나 지역 안에만 머물러서는 안 됩니다. 이 프로젝트는 한국어 PowerPoint 자료를 영어로 번역하면서 슬라이드 구조와 표현을 최대한 보존해, 교육·업무·안전 자료의 전달 범위를 넓히는 것을 목표로 합니다.

## 기술적으로 보여주는 것

React 19, Vite, TypeScript 기반 웹앱으로 PPTX 업로드, 텍스트 추출, Gemini 번역 배치 처리, 안전 용어 glossary, prompt guidance, 번역 품질 검사, PPT 재구성을 수행합니다. 단순 텍스트 번역이 아니라 글꼴 크기, bold/italic, 줄바꿈, 문단 구조 같은 발표 자료의 맥락을 보존하는 데 초점을 둡니다.

## 공개 프로젝트로서의 의미

기술적으로는 AI 번역과 문서 구조 보존을 결합한 생산성 도구이며, 사회적으로는 전문 지식과 안전 지식의 접근성을 높이는 번역 인프라입니다.

<!-- PROJECT-INTRO:END -->


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
