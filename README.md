# AI PPT Translator

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
