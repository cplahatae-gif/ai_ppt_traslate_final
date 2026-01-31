# 🌐 AI PPT 번역기 (Korean → English)

**PowerPoint 파일을 AI로 자동 번역하는 웹 애플리케이션**

PPTX 파일을 업로드하면 AI가 내용을 영어로 번역하여 새로운 파일로 만들어 드립니다.

---

## ✨ 주요 기능

- 📄 **PPTX 파일 번역**: 한국어 PPT를 영어로 자동 번역
- 🎨 **스타일 보존**: 볼드, 이탤릭, 줄바꿈 등 서식 유지
- 📖 **용어집 지원**: 커스텀 용어집으로 일관된 번역
- ⚙️ **프롬프트 커스터마이징**: 번역 스타일 조정 가능
- 🔑 **API 키 지원**: 사용자 Gemini API 키 사용 가능

---

## 🚀 데모

👉 **[라이브 데모 바로가기](https://1-translate-code-6387juvwa-has-projects-d8efd919.vercel.app)**

---

## 🛠️ 기술 스택

- **Frontend**: React + TypeScript + Vite
- **AI**: Google Gemini API
- **배포**: Vercel

---

## 📁 프로젝트 구조

```
project/
├── ai ppt 번역기/
│   ├── 1. translate-code/    # 번역기 웹앱 코드
│   ├── 2. ppt/               # 테스트 PPT 파일들
│   └── 3. text/              # 용어집 파일들
└── 평가code/                  # 품질 평가 도구
```

---

## 📝 사용 방법

1. 웹사이트 접속
2. PPTX 파일 업로드 (최대 50MB)
3. (선택) API 키, 프롬프트, 용어집 설정
4. "번역 시작하기" 클릭
5. 번역된 파일 다운로드

---

## 📜 버전 히스토리

- **v2.1**: (2026.02.01) 스타일 완벽 보존(XML Prepended), 폰트 스케일링 개선, 기본 가이드/용어집 자동 로드
- **v2-update**: 스타일 보존 개선, 줄바꿈 지원, 용어집 통합
- **main**: 초기 안정 버전

---

## 📄 라이선스

MIT License
