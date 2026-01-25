# PRD: PPTX 번역 품질 자동 평가 시스템

## 📋 문서 정보
- **문서명**: PPTX Translation Quality Scorer PRD
- **버전**: 1.1
- **작성일**: 2025-01-25
- **수정일**: 2025-01-25
- **작성자**: Claude (AI Assistant)
- **대상 도구**: Vibe Coding / AI Studio / Cursor 등 AI 코딩 도구

---

## 1. 프로젝트 배경 (Background)

### 1.1 현재 상황

사용자는 **한글 PPTX를 영어로 번역하는 웹 애플리케이션**을 개발 중입니다.

**기존 시스템 구성**:
```
┌─────────────────────────────────────────────────────────────┐
│                    AI PPT 번역기 (현재)                      │
├─────────────────────────────────────────────────────────────┤
│  Frontend: React + TypeScript + Tailwind CSS                │
│  Backend: Vite + Node.js                                    │
│  AI: Google Gemini API (gemini-3-flash-preview)             │
│  File Processing: JSZip (PPTX = ZIP 압축 XML)              │
└─────────────────────────────────────────────────────────────┘
```

**핵심 파일 구조**:
```
/project/1. translate-code/
├── App.tsx                 # 메인 앱 컴포넌트
├── services/
│   ├── pptxService.ts      # PPTX 파싱/생성 로직 (★ 핵심)
│   └── geminiService.ts    # Gemini API 호출 로직
├── components/
│   ├── FileUpload.tsx      # 파일 업로드 UI
│   ├── AdvancedOptions.tsx # 프롬프트/단어장 설정
│   └── ...
└── index.html

/project/3. text/
├── Safety_Translation_Guide_prompt.txt  # 번역 가이드라인/프롬프트
└── 단어사전(중처법 포함).txt              # 산업안전 용어 사전 (3,700+ 항목)
```

### 1.2 문제점 (Pain Points)

1. **품질 측정 불가**: 번역 결과의 품질을 객관적으로 평가할 방법 없음
2. **비교 기준 부재**: 유료 프로그램과의 차이를 정량화할 수 없음
3. **개선 추적 불가**: 코드/프롬프트 수정 후 실제로 개선되었는지 확인 어려움
4. **회귀 테스트 부재**: 새로운 변경이 기존 품질을 저하시키는지 감지 불가
5. **용어 일관성 검증 부재**: 단어장 대비 번역 준수율 확인 불가

### 1.3 발견된 품질 이슈 (수동 분석 결과)

| 영역 | 이슈 유형 | 예시 |
|------|----------|------|
| **시각적** | 폰트 크기 변경 | 원본 sz="2800" → 번역 후 sz="2380" (85%) - *의도적 축소* |
| **시각적** | 레이아웃 깨짐 | normAutofit 추가로 텍스트 박스 변형 |
| **시각적** | 테이블 셀 오버플로우 | "고창수" → "Ko Chang-soo" 세로 쪼개짐 |
| **번역** | 용어 불일관 | "Title" vs "Position" 혼용 |
| **번역** | 표기 불일관 | ㈜SP Nature vs SP Nature Co., Ltd. |
| **번역** | 대소문자 | "TABLE OF CONTENTS" (전체 대문자) |
| **번역** | 단어장 미준수 | 단어장에 정의된 용어와 다른 번역 사용 |

---

## 2. 제품 목표 (Product Goals)

### 2.1 핵심 목표

> **PPTX 번역 결과물의 품질을 자동으로 평가하고 점수화하는 시스템 구축**

### 2.2 세부 목표

| # | 목표 | 측정 지표 |
|---|------|----------|
| G1 | 시각적 품질 자동 평가 | 폰트/레이아웃/테이블 점수 |
| G2 | 번역 품질 자동 평가 | 용어 일관성/정확성 점수 |
| G3 | 원본-번역본 비교 분석 | 차이점 상세 리포트 |
| G4 | 단어장 준수율 평가 | 단어장 매핑 일치율 |
| G5 | 번역 가이드라인 준수 평가 | 프롬프트 규칙 준수 여부 |
| G6 | 유료 버전 벤치마크 | 유료 버전 대비 점수 비교 |
| G7 | 개선 추적 | 버전별 점수 히스토리 |

### 2.3 성공 지표 (Success Metrics)

- 평가 자동화율: 90% 이상 (수동 검토 필요 항목 10% 이하)
- 평가 시간: 파일당 30초 이내
- 점수 재현성: 동일 파일 재평가 시 ±2점 이내

---

## 3. 사용자 스토리 (User Stories)

### 3.1 주요 사용자

**페르소나**: 안전관리자 Ha (개발자 겸 사용자)
- 산업안전 분야 PPTX 번역 필요
- 번역 프로그램 직접 개발 중
- 품질 개선을 위한 객관적 지표 필요

### 3.2 사용자 스토리

```
US-1: 단일 파일 평가
AS A 개발자
I WANT TO 번역된 PPTX 파일의 품질 점수를 확인하고 싶다
SO THAT 현재 품질 수준을 파악할 수 있다

US-2: 비교 평가
AS A 개발자  
I WANT TO 내 버전과 유료 버전을 비교 평가하고 싶다
SO THAT 어떤 부분이 부족한지 알 수 있다

US-3: 상세 리포트
AS A 개발자
I WANT TO 어떤 항목에서 점수가 낮은지 상세히 보고 싶다
SO THAT 구체적인 개선 방향을 잡을 수 있다

US-4: 버전 추적
AS A 개발자
I WANT TO 코드 수정 전후의 점수 변화를 보고 싶다
SO THAT 수정이 효과적이었는지 확인할 수 있다

US-5: 단어장 준수 확인
AS A 개발자
I WANT TO 번역이 단어장의 용어를 제대로 사용했는지 확인하고 싶다
SO THAT 용어 일관성을 유지할 수 있다
```

---

## 4. 기능 요구사항 (Functional Requirements)

### 4.1 핵심 기능 (MVP)

#### F1: 파일 입력

```
필수 입력:
- 한글 PPTX (원본) ★ 필수
- 영어 PPTX (번역본) ★ 필수

선택 입력:
- 참조본 PPTX (유료 버전 등) - 선택
- 단어장 파일 (TXT, 형식: "한글 : 영어") - 선택
- 번역 가이드라인 파일 (TXT) - 선택

출력:
- 품질 점수 (0-100)
- 상세 평가 리포트
```

#### F2: 시각적 품질 평가 (Visual Score)

| 평가 항목 | 배점 | 평가 방법 |
|----------|------|----------|
| 폰트 크기 보존 | 20점 | 원본 sz 값과 번역본 sz 값 비교 (85% 축소는 의도적이므로 허용) |
| 레이아웃 보존 | 20점 | bodyPr, xfrm (위치/크기) 비교 |
| 테이블 구조 보존 | 15점 | 셀 너비/높이, 텍스트 오버플로우 감지 |
| 스타일 보존 | 10점 | Bold, Italic, 색상 등 rPr 속성 비교 |
| 텍스트 간격 보존 | 5점 | spc 속성 비교 (음수→0 변환은 의도적) |
| 특수문자 보존 | 5점 | ㈜, ※, □, Ⅰ~Ⅴ 등 특수문자 유지 여부 |
| 언어 속성 적용 | 5점 | 영어 번역본에서 lang="en-US" 적용 여부 |

**총 시각적 점수: 80점 만점**

#### F3: 번역 품질 평가 (Translation Score)

| 평가 항목 | 배점 | 평가 방법 |
|----------|------|----------|
| 단어장 준수율 | 8점 | 단어장에 정의된 용어가 올바르게 번역되었는지 |
| 용어 일관성 | 5점 | 동일 원문에 대해 동일 번역 사용 여부 |
| 대소문자 규칙 | 3점 | Title Case (제목), Sentence case (본문) 준수 |
| 숫자/단위 보존 | 2점 | %, pp, ▲/▼, 날짜 형식 유지 |
| 로마자 변환 | 2점 | Ⅰ→I, Ⅱ→II 등 전각→반각 변환 적용 |

**총 번역 점수: 20점 만점**

#### F4: 종합 점수 계산

```
총점 = 시각적 점수(80) + 번역 점수(20) = 100점 만점

등급:
- A+ : 95-100점
- A  : 90-94점
- B+ : 85-89점
- B  : 80-84점
- C+ : 75-79점
- C  : 70-74점
- D  : 60-69점
- F  : 60점 미만
```

#### F5: 상세 리포트 생성

```markdown
# 번역 품질 평가 리포트

## 종합 점수: 78/100 (B+)

### 시각적 품질: 62/80
- [✅] 폰트 크기: 20/20 - 85% 축소 적용됨 (의도대로)
- [⚠️] 레이아웃: 15/20 - normAutofit 추가됨
- [❌] 테이블: 10/15 - 3개 셀에서 오버플로우
- [✅] 스타일: 9/10
- [✅] 텍스트 간격: 5/5
- [✅] 특수문자: 5/5
- [⚠️] 언어 속성: 3/5 - 일부 미적용

### 번역 품질: 16/20
- [⚠️] 단어장 준수: 6/8 - 5개 용어 미준수
- [⚠️] 용어 일관성: 4/5 - "Title"/"Position" 혼용
- [⚠️] 대소문자: 2/3 - "TABLE OF CONTENTS"
- [✅] 숫자/단위: 2/2
- [✅] 로마자 변환: 2/2

### 단어장 미준수 목록
| 원문 | 기대 번역 (단어장) | 실제 번역 | 슬라이드 |
|------|-------------------|----------|---------|
| 감전 | electric shock | electrical shock | 3 |
| 아차사고 | Near-Miss | Near Miss | 5 |
| 안전담당자 | Safety Officer | Safety Manager | 7 |

### 상세 이슈 목록
| 슬라이드 | 위치 | 이슈 | 심각도 |
|---------|------|------|--------|
| 2 | 테이블 Row 1 | 셀 오버플로우 | High |
| 2 | 헤더 | "Title" → "Position" 권장 | Medium |
| 5 | 본문 | 전체 대문자 사용 | Low |
```

### 4.2 추가 기능 (Phase 2)

| 기능 | 설명 |
|------|------|
| 자동 수정 제안 | 낮은 점수 항목에 대한 수정 코드 제안 |
| 배치 평가 | 여러 파일 일괄 평가 |
| 히스토리 대시보드 | 시간별 점수 추이 그래프 |
| CI/CD 연동 | GitHub Actions 등과 연동하여 자동 평가 |

---

## 5. 기술 요구사항 (Technical Requirements)

### 5.1 기술 스택

```
Frontend:
- React 19 + TypeScript
- Tailwind CSS (기존 프로젝트와 동일)

Core Logic:
- JSZip (PPTX 파싱)
- DOMParser (XML 파싱) ★ 기존 코드와 동일

Glossary Processing:
- TXT 파일 파싱 (형식: "한글 : 영어, 영어2")
- 약 3,700+ 항목의 산업안전 용어 사전 지원

Optional (AI 활용):
- Gemini API (번역 품질 의미 분석)

Output:
- JSON (점수 데이터)
- Markdown (리포트)
- HTML (시각화된 리포트)
```

### 5.2 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                    Translation Quality Scorer                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │    Input     │───▶│    Parser    │───▶│   Analyzer   │       │
│  │    Module    │    │    Module    │    │    Module    │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ Korean PPTX  │    │ Extracted    │    │ Comparison   │       │
│  │ English PPTX │    │ - Texts      │    │ Results      │       │
│  │ Glossary.txt │    │ - Styles     │    │ - Font diff  │       │
│  │ Prompt.txt   │    │ - Layout     │    │ - Layout diff│       │
│  └──────────────┘    └──────────────┘    │ - Term diff  │       │
│                                          │ - Glossary   │       │
│                                          └──────────────┘       │
│                                                 │                │
│  ┌──────────────┐                              │                │
│  │  Glossary    │◀─────────────────────────────┘                │
│  │  Matcher     │                                               │
│  │  Module      │                                               │
│  └──────────────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Scorer     │───▶│   Reporter   │───▶│   Output     │       │
│  │   Module     │    │   Module     │    │ - Score JSON │       │
│  └──────────────┘    └──────────────┘    │ - Report MD  │       │
│                                          │ - Dashboard  │       │
│                                          └──────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 핵심 모듈 상세

#### Module 1: Parser (파서)

```typescript
interface ParsedSlide {
  slideNumber: number;
  shapes: ShapeData[];
  tables: TableData[];
}

interface ShapeData {
  id: string;
  type: 'textbox' | 'title' | 'body';
  position: { x: number; y: number; cx: number; cy: number };
  bodyPr: BodyProperties;
  paragraphs: ParagraphData[];
}

interface ParagraphData {
  index: number;
  runs: RunData[];
}

interface RunData {
  text: string;
  properties: {
    fontSize: number | null;      // sz
    bold: boolean;                // b
    italic: boolean;              // i
    fontFamily: string | null;    // latin/ea typeface
    color: string | null;         // solidFill
    lang: string | null;          // lang
    spacing: number | null;       // spc (텍스트 간격)
  };
}
```

#### Module 2: Glossary Matcher (단어장 매칭)

```typescript
interface GlossaryEntry {
  korean: string;
  english: string[];  // 여러 영어 표현 가능 (콤마 구분)
  category?: string;
}

interface GlossaryMatchResult {
  korean: string;
  expectedEnglish: string[];
  actualEnglish: string;
  isMatch: boolean;
  slideNumber: number;
  position: string;
}

// 단어장 파일 형식 (줄 단위):
// "가공선로 : aerial line, overhead line, overhead wire"
// "감전 : electric shock"
// "아차사고 : Near-Miss"

function parseGlossaryFile(content: string): GlossaryEntry[] {
  return content.split('\n')
    .filter(line => line.includes(':'))
    .map(line => {
      const [korean, english] = line.split(':').map(s => s.trim());
      return {
        korean,
        english: english.split(',').map(e => e.trim())
      };
    });
}
```

#### Module 3: Analyzer (분석기)

```typescript
interface ComparisonResult {
  visual: {
    fontSizeChanges: FontSizeChange[];
    layoutChanges: LayoutChange[];
    tableOverflows: TableOverflow[];
    styleChanges: StyleChange[];
    spacingChanges: SpacingChange[];
    langAttributeIssues: LangAttributeIssue[];
  };
  translation: {
    glossaryMismatches: GlossaryMismatch[];
    termInconsistencies: TermInconsistency[];
    caseViolations: CaseViolation[];
    romanNumeralIssues: RomanNumeralIssue[];
  };
}

interface GlossaryMismatch {
  slideNumber: number;
  position: string;
  korean: string;
  expectedEnglish: string[];
  actualEnglish: string;
}

interface FontSizeChange {
  slideNumber: number;
  shapeId: string;
  original: number;
  translated: number;
  ratio: number;  // translated / original
  isIntentional: boolean;  // 0.85 비율은 의도적
}
```

#### Module 4: Scorer (점수 계산기)

```typescript
interface ScoreResult {
  total: number;           // 0-100
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  
  visual: {
    total: number;         // 0-80
    fontSize: number;      // 0-20
    layout: number;        // 0-20
    table: number;         // 0-15
    style: number;         // 0-10
    spacing: number;       // 0-5
    specialChar: number;   // 0-5
    langAttribute: number; // 0-5
  };
  
  translation: {
    total: number;         // 0-20
    glossaryCompliance: number;  // 0-8
    consistency: number;   // 0-5
    casing: number;        // 0-3
    numbers: number;       // 0-2
    romanNumerals: number; // 0-2
  };
}
```

### 5.4 점수 계산 알고리즘

```typescript
// 폰트 크기 점수 계산 (의도적 85% 축소 허용)
function calculateFontSizeScore(changes: FontSizeChange[]): number {
  if (changes.length === 0) return 20;
  
  const intentionalRatio = 0.85;
  const tolerance = 0.02;  // ±2% 허용
  
  let score = 20;
  for (const change of changes) {
    const expectedRatio = intentionalRatio;
    const deviation = Math.abs(change.ratio - expectedRatio);
    
    if (deviation > tolerance) {
      score -= 2;  // 허용 범위 벗어나면 감점
    }
  }
  
  return Math.max(0, score);
}

// 단어장 준수율 점수 계산
function calculateGlossaryScore(mismatches: GlossaryMismatch[], totalTerms: number): number {
  if (totalTerms === 0) return 8;
  
  const complianceRate = 1 - (mismatches.length / totalTerms);
  return Math.round(complianceRate * 8);
}

// 레이아웃 점수 계산
function calculateLayoutScore(changes: LayoutChange[]): number {
  let score = 20;
  
  for (const change of changes) {
    if (change.type === 'normAutofit_added') score -= 3;
    if (change.type === 'position_changed') score -= 2;
    if (change.type === 'size_changed') score -= 1;
  }
  
  return Math.max(0, score);
}

// 용어 일관성 점수 계산
function calculateConsistencyScore(
  inconsistencies: TermInconsistency[]
): number {
  // 불일치 0개 = 5점, 1개 = 4점, 2개 = 3점, ...
  return Math.max(0, 5 - inconsistencies.length);
}
```

---

## 6. UI/UX 요구사항

### 6.1 화면 구성

```
┌─────────────────────────────────────────────────────────────┐
│  🎯 PPTX Translation Quality Scorer                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📁 파일 업로드                                      │   │
│  │  ┌───────────────┐  ┌───────────────┐              │   │
│  │  │ 한글 원본 (KR)│  │ 영어 번역본(EN)│              │   │
│  │  │ [파일 선택] ★ │  │ [파일 선택] ★ │              │   │
│  │  └───────────────┘  └───────────────┘              │   │
│  │  ┌───────────────┐  ┌───────────────┐              │   │
│  │  │ 참조본 (선택) │  │ 단어장 (선택) │              │   │
│  │  │ [파일 선택]   │  │ [파일 선택]   │              │   │
│  │  └───────────────┘  └───────────────┘              │   │
│  │  ┌───────────────┐                                  │   │
│  │  │ 번역 가이드   │                                  │   │
│  │  │ [파일 선택]   │                                  │   │
│  │  └───────────────┘                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ⚙️ 평가 설정                                        │   │
│  │  ☑ 시각적 평가 (80점)                               │   │
│  │  ☑ 번역 평가 (20점)                                 │   │
│  │  ☑ 단어장 준수 평가 (단어장 업로드 시 활성화)       │   │
│  │  ☐ 참조본 비교 (선택 시 활성화)                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  [ 🔍 평가 시작 ]                                          │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📊 평가 결과                                        │   │
│  │                                                      │   │
│  │  ┌─────────┐                                        │   │
│  │  │   78    │  B+                                    │   │
│  │  │  /100   │                                        │   │
│  │  └─────────┘                                        │   │
│  │                                                      │   │
│  │  시각적 품질 ████████░░ 62/80                       │   │
│  │  번역 품질   ████████░░ 16/20                       │   │
│  │  단어장 준수 ██████░░░░ 75% (150/200 용어)          │   │
│  │                                                      │   │
│  │  [상세 리포트 보기] [JSON 다운로드] [MD 다운로드]   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 상세 리포트 화면

```
┌─────────────────────────────────────────────────────────────┐
│  📋 상세 평가 리포트                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ▼ 시각적 품질 (62/80)                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  항목          점수    상태                          │   │
│  │  ─────────────────────────────────────────────────  │   │
│  │  폰트 크기     20/20   ✅ 85% 축소 (의도대로)       │   │
│  │  레이아웃      15/20   ⚠️ normAutofit 추가          │   │
│  │  테이블        10/15   ❌ 3개 셀 오버플로우          │   │
│  │  스타일        9/10    ✅ 양호                       │   │
│  │  텍스트 간격   5/5     ✅ 완벽                       │   │
│  │  특수문자      5/5     ✅ 완벽                       │   │
│  │  언어 속성     3/5     ⚠️ 일부 미적용               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ▼ 번역 품질 (16/20)                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  항목          점수    상태                          │   │
│  │  ─────────────────────────────────────────────────  │   │
│  │  단어장 준수   6/8     ⚠️ 5개 용어 미준수           │   │
│  │  용어 일관성   4/5     ⚠️ 1개 불일치                │   │
│  │  대소문자      2/3     ⚠️ 1개 위반                  │   │
│  │  숫자/단위     2/2     ✅ 완벽                       │   │
│  │  로마자 변환   2/2     ✅ 완벽                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ▼ 단어장 미준수 목록 (5건)                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  원문           기대 번역           실제 번역        │   │
│  │  ─────────────────────────────────────────────────  │   │
│  │  감전           electric shock      electrical shock │   │
│  │  아차사고       Near-Miss           Near Miss        │   │
│  │  안전담당자     Safety Officer      Safety Manager   │   │
│  │  위험성 평가    Risk Assessment     Risk Evaluation  │   │
│  │  개인보호구     PPE                 Personal gear    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ▼ 이슈 상세 목록 (6건)                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🔴 High                                             │   │
│  │  • Slide 2 테이블: Row 1 "Name" 셀 오버플로우       │   │
│  │                                                      │   │
│  │  🟡 Medium                                           │   │
│  │  • Slide 2: "Title" → "Position" 권장               │   │
│  │  • Slide 5: lang 속성 미적용                        │   │
│  │                                                      │   │
│  │  🟢 Low                                              │   │
│  │  • Slide 3: "TABLE OF CONTENTS" 대문자              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 데이터 모델

### 7.1 입력 데이터

```typescript
interface EvaluationInput {
  koreanFile: File;              // 한글 원본 PPTX (필수)
  translatedFile: File;          // 영어 번역본 PPTX (필수)
  referenceFile?: File;          // 참조본 PPTX (선택)
  glossaryFile?: File;           // 단어장 TXT (선택)
  guidelineFile?: File;          // 번역 가이드라인 TXT (선택)
  options: EvaluationOptions;
}

interface GlossaryEntry {
  korean: string;
  english: string[];
  category?: string;
}

interface EvaluationOptions {
  enableVisualScore: boolean;
  enableTranslationScore: boolean;
  enableGlossaryCheck: boolean;
  enableReferenceComparison: boolean;
  fontSizeTolerancePercent: number;  // 기본값: 2%
  expectedFontSizeRatio: number;     // 기본값: 0.85 (의도적 축소)
}
```

### 7.2 출력 데이터

```typescript
interface EvaluationOutput {
  score: ScoreResult;
  report: ReportData;
  issues: Issue[];
  glossaryResults: GlossaryMatchResult[];
  metadata: {
    evaluatedAt: string;
    koreanFileName: string;
    translatedFileName: string;
    referenceFileName?: string;
    glossaryTermCount: number;
    slideCount: number;
  };
}

interface Issue {
  id: string;
  severity: 'high' | 'medium' | 'low';
  category: 'visual' | 'translation' | 'glossary';
  subcategory: string;
  slideNumber: number;
  location: string;
  description: string;
  suggestion?: string;
}

interface GlossaryMatchResult {
  korean: string;
  expectedEnglish: string[];
  actualEnglish: string;
  isMatch: boolean;
  slideNumber: number;
  position: string;
}
```

---

## 8. 단어장 및 번역 가이드라인 연동

### 8.1 단어장 파일 형식

```
# 단어사전(중처법 포함).txt 형식:
# 한글 : 영어1, 영어2, 영어3 ...

가공선로 : aerial line, overhead line, overhead wire
감전 : electric shock
감전방지용 누전차단기 : residual-current circuit breaker
아차사고 : Near-Miss
안전담당자 : Safety Officer
위험성 평가 : Risk Assessment
개인보호구 : PPE
...
```

### 8.2 번역 가이드라인 (Safety_Translation_Guide_prompt.txt)

평가 시 준수 여부를 확인할 주요 규칙:

| 규칙 | 평가 방법 |
|------|----------|
| 용어 일관성 | 동일 원문 → 동일 번역 사용 여부 |
| 대소문자 규칙 | 제목: Title Case, 본문: Sentence case |
| 분기 표기 | 1분기→1Q, 2분기→2Q 등 |
| 숫자/단위 보존 | %, pp, ▲/▼ 유지 |
| 고유명사 비번역 | 회사명/현장명 번역 안 함 |
| 약어 사용 | GRA, JRA, VFL, RCA, LOTO 등 |
| 강조 유지 | Bold/Underline 보존 |

### 8.3 단어장 매칭 로직

```typescript
function matchGlossaryTerms(
  koreanTexts: TextItem[],
  englishTexts: TextItem[],
  glossary: GlossaryEntry[]
): GlossaryMatchResult[] {
  const results: GlossaryMatchResult[] = [];
  
  for (let i = 0; i < koreanTexts.length; i++) {
    const korean = koreanTexts[i];
    const english = englishTexts[i];
    
    for (const entry of glossary) {
      if (korean.text.includes(entry.korean)) {
        const actualEnglish = english.text;
        const isMatch = entry.english.some(e => 
          actualEnglish.toLowerCase().includes(e.toLowerCase())
        );
        
        results.push({
          korean: entry.korean,
          expectedEnglish: entry.english,
          actualEnglish,
          isMatch,
          slideNumber: korean.slideNumber,
          position: `Paragraph ${korean.paragraphIndex}`
        });
      }
    }
  }
  
  return results;
}
```

---

## 9. 구현 계획 (Implementation Plan)

### 9.1 Phase 1: MVP (2주)

| 주차 | 작업 | 산출물 |
|------|------|--------|
| Week 1 | Parser 모듈 개발 | pptxParser.ts |
| Week 1 | Glossary Parser 개발 | glossaryParser.ts |
| Week 1 | Analyzer 모듈 개발 | comparisonAnalyzer.ts |
| Week 2 | Scorer 모듈 개발 | qualityScorer.ts |
| Week 2 | Reporter 모듈 개발 | reportGenerator.ts |
| Week 2 | 기본 UI 개발 | ScorerApp.tsx |

### 9.2 Phase 2: 고급 기능 (2주)

| 주차 | 작업 | 산출물 |
|------|------|--------|
| Week 3 | 참조본 비교 기능 | referenceComparator.ts |
| Week 3 | 히스토리 저장 | localStorage 연동 |
| Week 4 | 대시보드 UI | Dashboard.tsx |
| Week 4 | 내보내기 기능 | exportService.ts |

### 9.3 Phase 3: 연동 (1주)

| 주차 | 작업 | 산출물 |
|------|------|--------|
| Week 5 | 기존 번역기와 통합 | 통합 빌드 |
| Week 5 | 자동 평가 트리거 | 번역 완료 후 자동 평가 |

---

## 10. 테스트 계획

### 10.1 테스트 케이스

| TC# | 시나리오 | 예상 결과 |
|-----|----------|----------|
| TC1 | 원본과 동일한 파일 평가 (번역 없음) | 번역 점수 0점 |
| TC2 | 완벽하게 번역된 파일 + 85% 폰트 축소 | 95점 이상 |
| TC3 | 단어장 50% 미준수 | 단어장 점수 4점 |
| TC4 | normAutofit 추가된 파일 | 레이아웃 항목 감점 |
| TC5 | 용어 불일치 2건 파일 | 용어 일관성 3점 |
| TC6 | 유료 버전 평가 | 약 90점 예상 |
| TC7 | 3,700개 단어장 로드 테스트 | 5초 이내 |

### 10.2 테스트 파일

- `1__RCA_보고서_원본.pptx` (한글 원본)
- `2__RCA_보고서_내버전.pptx` (번역본 v1)
- `2__RCA_보고서_내버전_v2_.pptx` (번역본 v2)
- `3__RCA_보고서_유료버전.pptx` (참조용)
- `단어사전(중처법 포함).txt` (단어장)
- `Safety_Translation_Guide_prompt.txt` (가이드라인)

---

## 11. 리스크 및 제약사항

### 11.1 리스크

| 리스크 | 영향 | 대응 방안 |
|--------|------|----------|
| PPTX 구조 복잡성 | 파싱 실패 | 점진적 지원 확대 |
| 번역 품질 주관성 | 점수 신뢰도 저하 | 규칙 기반 + AI 보조 |
| 성능 이슈 | 대용량 파일 처리 지연 | Web Worker 활용 |
| 단어장 크기 (3,700+ 항목) | 메모리/성능 이슈 | 인덱싱 최적화, 캐싱 |

### 11.2 제약사항

- 브라우저 환경에서 실행 (Node.js 서버 없음)
- 파일 크기 50MB 이하 지원
- 최신 브라우저 (Chrome, Firefox, Safari) 지원
- 단어장 형식: "한글 : 영어" (콜론 구분)

---

## 12. 용어 정의 (Glossary)

| 용어 | 정의 |
|------|------|
| sz | 폰트 크기 (1/100 pt 단위, sz="2800" = 28pt) |
| bodyPr | 텍스트 박스 속성 (자동맞춤, 여백 등) |
| rPr | 텍스트 런 속성 (폰트, 색상, 굵기 등) |
| normAutofit | 텍스트 자동 축소 설정 |
| spc | 텍스트 간격 (spacing) |
| EMU | English Metric Units (914400 EMU = 1 inch) |
| GRA | General Risk Assessment (일반 위험성 평가) |
| JRA | Job Risk Assessment (작업 위험성 평가) |
| VFL | Visible Felt Leadership (가시적 리더십) |
| RCA | Root Cause Analysis (근본원인분석) |
| LOTO | Lockout-Tagout (에너지 차단) |

---

## 13. 부록

### A. 점수 계산 상세 공식

```
총점 = Visual(80) + Translation(20)

Visual(80):
- FontSize(20) = 20 * (1 - |actualRatio - 0.85| * 10) // 85% 기준
- Layout(20) = 20 - (normAutofit * 3) - (posChange * 2) - (sizeChange * 1)
- Table(15) = 15 - (overflowCells * 3)
- Style(10) = 10 - (styleChanges * 1)
- Spacing(5) = 5 - (unexpectedSpacingChanges * 1)
- SpecialChar(5) = 5 - (missingChars * 1)
- LangAttribute(5) = 5 - (missingLangAttr * 1)

Translation(20):
- GlossaryCompliance(8) = 8 * (matchedTerms / totalTerms)
- Consistency(5) = 5 - (inconsistencies * 1)
- Casing(3) = 3 - (violations * 1)
- Numbers(2) = 2 - (errors * 1)
- RomanNumerals(2) = 2 - (errors * 1)
```

### B. 참고 자료

- PPTX 파일 구조: [ECMA-376 Office Open XML](https://www.ecma-international.org/publications-and-standards/standards/ecma-376/)
- DrawingML 스키마: [DrawingML Reference](https://docs.microsoft.com/en-us/dotnet/api/documentformat.openxml.drawing)
- 기존 번역 코드: `/project/1. translate-code/`
- 단어장: `/project/3. text/단어사전(중처법 포함).txt`
- 번역 가이드: `/project/3. text/Safety_Translation_Guide_prompt.txt`

---

## 14. 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0 | 2025-01-25 | Claude | 초안 작성 |
| 1.1 | 2025-01-25 | Claude | 한글/영어 필수 입력으로 변경, 단어장 연동 추가, 번역 가이드라인 연동 추가, Gemini 모델명 업데이트, 폰트 85% 축소 의도 반영, spc 속성 평가 추가, 단어장 매칭 모듈 추가 |

---

*이 PRD는 바이브 코딩 도구(AI Studio, Cursor 등)에서 직접 사용할 수 있도록 상세하게 작성되었습니다.*
