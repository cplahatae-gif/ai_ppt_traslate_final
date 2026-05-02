# PPT 번역기 개선 로드맵

> 작성일: 2026-05-02  
> 기준 브랜치: `v2-update`  
> 배포 URL: https://1-translate-code.vercel.app

---

## 1. 현재 상태 (v2-update 기준)

### 아키텍처 개요
- **프론트엔드**: React 19 + Vite + TypeScript + Tailwind CSS
- **번역 엔진**: Google Gemini API (`@google/genai`) — 브라우저에서 직접 호출
- **인증/DB**: Supabase (로그인, 계정 승인, 토큰 사용량 추적)
- **이메일**: EmailJS (클라이언트 사이드)
- **배포**: Vercel (정적 빌드, 서버리스 함수 없음)

### 핵심 워크플로우 (3단계)
```
Step 1: 파일 업로드
Step 2: 설정 (Document Preview + 번역 옵션)
Step 3: 번역 실행 → 품질 검증 → 다운로드
```

### 기능 구현 현황

| 기능 | 상태 | 비고 |
|---|---|---|
| PPTX 업로드 및 파싱 | ✅ 정상 | |
| 로그인 / 회원가입 | ✅ 정상 | Supabase Auth |
| 관리자 계정 승인 | ✅ 정상 | 관리자 대시보드에서 승인 |
| 번역 실행 | ❌ **불작동** | 모델명 오류 (아래 P0 참고) |
| 토큰 사용량 추적 | ✅ 정상 | Supabase 연동 |
| 품질 검증 보고서 | ⚠️ 미확인 | 번역 후 자동 실행되나 번역 자체가 안 됨 |
| 수정 반영 (Apply Fixes) | ⚠️ 부분 작동 | 선택 범위만 재생성 — 아래 P5 참고 |
| 이메일 알림 | ❌ **불작동** | EmailJS 환경변수 미설정 |
| Document Preview | ✅ 렌더링됨 | UX 혼동 문제 — P4 참고 |
| AI 모델 선택 | ❌ 미구현 | Gemini 단일 하드코딩 |
| 관리자 대시보드 | ✅ 정상 | |

---

## 2. 확인된 이슈 목록

### 🔴 P0 — 번역 실행 안 됨 (즉시 수정 필요)

**원인**: `services/geminiService.ts` 내 모델명이 존재하지 않는 값으로 되어 있음.

```typescript
// 현재 (오류)
model: 'gemini-3-flash-preview'  // 존재하지 않는 모델

// 수정 대상
model: 'gemini-2.5-flash'        // 현재 안정 버전
```

**증거**: `git_log.txt`에 `d0fddba "fix: Revert to gemini-2.0-flash-exp (3.0 not found)"` 커밋이 존재 — 동일 문제가 한 번 고쳐졌다가 다시 잘못된 값으로 돌아옴.

**증상**: 번역 시작 후 약 12초(3회 재시도) 대기 후 오류 메시지.

**수정 파일**: `project/ai ppt 번역기/1. translate-code/src/services/geminiService.ts`

---

### 🔴 P1 — 글자색 전염 버그 ("파란 글자 한 개 → 전체가 파란색")

**원인**: `pptxService.ts`의 텍스트 재조립 로직에서 첫 번째 run의 서식(`rPr`)을 단락 전체의 기본값으로 복사함.

```
원본 단락:
  run 1: 파란색 "안전"
  run 2: 검은색 "보건 관리"

번역 후:
  첫 run의 rPr(파란색 포함)을 defaultProps로 cloneNode → 모든 run이 파란색 상속
```

**수정 방향**:
1. `defaultProps` 클론 직후 색상 관련 노드(`solidFill`, `schemeClr`) 제거
2. `<color:>` 태그가 있을 때만 색상 부여, 없으면 PowerPoint 기본값으로 fallback

**수정 파일**: `pptxService.ts` — `representativeRPr` 선택 로직 (약 374-395번째 줄)

---

### 🟡 P2 — 자간(Character Spacing) 미정규화

**원인**: 현재 음수 자간(`spc < 0`)만 0으로 강제함. 양수 좁은 자간은 그대로 유지되어 영문 번역 시 글자 겹침 발생.

**수정 방향**: 영문 번역 시 모든 `spc` 속성을 무조건 제거 (표준값으로 리셋)

**수정 파일**: `pptxService.ts` — `createRunsFromTaggedText` 함수 내 spc 처리 로직 (약 213-217번째 줄)

---

### 🟡 P3 — 줄간격(Line Spacing) 미조정

**원인**: 줄간격(`lnSpc`) 처리 로직이 없음. 한국어는 넓은 줄간격(1.2~1.5)이 가독성에 유리하지만, 영문 번역 시 문장이 길어져 동일 간격이면 텍스트 박스를 초과함.

**수정 방향**: 번역 후 줄간격을 한 단계 낮춤

| 원본 줄간격 | 변환 후 |
|---|---|
| 1.5 이상 (150%) | 1.2 (120%) |
| 1.2 ~ 1.49 | 1.0 (100%) |
| 1.0 미만 | 유지 |

**수정 파일**: `pptxService.ts` — `replaceTextInPptx` 함수 내 paragraph 처리 루프 (신규 로직 추가)

---

### 🟡 P4 — Document Preview UX 혼동

**현황**: `FilePreviewCard` 컴포넌트가 Step 2에서 파일명과 슬라이드 수를 표시함. 사용자들이 "왜 이게 보이는지" 이해하지 못해 혼란.

**수정 방향** (두 가지 중 선택):
- **옵션 A (삭제)**: Step 2에서 FilePreviewCard를 제거하고 파일 정보를 TranslationOptions 상단에 인라인으로 표시
- **옵션 B (개선)**: 카드 내 툴팁이나 레이블 추가로 역할 명확히 — "업로드한 파일 정보"

**현재 권고**: 옵션 B (개선) — 제거보다 역할을 명확히 하는 게 UX에 유리

**수정 파일**: `components/preview/FilePreviewCard.tsx`, `App.tsx`(Step 2 레이아웃)

---

### 🟡 P5 — "수정 반영" 후 일부 슬라이드만 출력

**현황**: 품질 보고서에서 수정 항목을 선택하고 "Apply Fixes"를 누르면, 원래 번역 범위(startPage~endPage)의 슬라이드만 재생성됨. 사용자는 전체 파일을 기대하지만 일부만 나옴.

**원인**: `handleApplyFixes`는 `textItemsRef`(번역한 범위의 텍스트만)로 PPTX를 재생성하므로, 나머지 슬라이드는 포함되지 않음.

**수정 방향**:
- 재생성 시 전체 PPTX 구조를 유지하고 해당 슬라이드만 교체
- 또는 UX를 명확히: "선택한 범위(X~Y 페이지)의 수정본이 다운로드됩니다" 안내 문구 추가

---

### 🟡 P6 — 이메일 알림 불작동

**현황**: EmailJS 코드는 구현되어 있으나 Vercel 환경변수가 설정되지 않아 실제 발송이 안 됨.

**필요한 환경변수**:
```
VITE_EMAILJS_SERVICE_ID=
VITE_EMAILJS_TEMPLATE_ID=
VITE_EMAILJS_PUBLIC_KEY=
```

**수정 방향**:
1. Vercel 프로젝트 설정 > Environment Variables에 위 3개 추가
2. EmailJS 대시보드에서 서비스/템플릿 ID 발급 (무료 플랜: 월 200건)
3. 이메일 알림 On/Off 설정 UI가 어디에 있는지 사용자에게 명확히 표시

---

### 🟢 P7 — AI 모델/프로바이더 선택 기능 (신규)

**요청 배경**: 현재 Gemini 모델 1개만 하드코딩. 상황에 따라 다른 모델을 선택하고 싶음.

**지원할 프로바이더**:
- **Gemini**: `gemini-2.5-flash` (기본), `gemini-2.5-pro`, `gemini-2.0-flash-exp`
- **Claude**: `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-4-7`
- **OpenAI**: `gpt-4o`, `gpt-5`

**설계**:
1. `services/aiProvider.ts` — 공통 인터페이스
2. `services/providers/geminiProvider.ts` — 기존 로직 이동
3. `services/providers/claudeProvider.ts` — `@anthropic-ai/sdk` 사용
4. `services/providers/openaiProvider.ts` — `openai` SDK 사용
5. `services/modelCatalog.ts` — provider별 모델 목록 정의
6. UI: `TranslationOptions` 내 Provider/Model 드롭다운 추가

**에러 메시지 개선** (P0과 연계):
- 401/403 → "API 키가 잘못되었습니다"
- 404 → "선택된 모델을 사용할 수 없습니다. 다른 모델을 시도해주세요"
- 429 → "요청이 많아 일시 제한됩니다. 잠시 후 다시 시도해주세요"

---

### 🟢 P8 — 텍스트 박스 레이아웃 개선 (보류)

**현황**: 한→영 번역 시 문장이 길어지면 텍스트 박스를 초과함. 현재는 `normAutofit` 플래그만 추가하여 PowerPoint에 위임.

**트레이드오프**: 박스를 임의로 늘리면 다른 요소와 겹칠 수 있음.

**현재 결정**: P0~P7 완료 후 별도 검토. 우선 동적 폰트 스케일링(85% 최소)으로 완화 중.

---

## 3. 단계별 실행 계획

### Phase 1 — 핵심 버그 수정 (1~2일)

| 항목 | 우선순위 | 예상 소요 |
|---|---|---|
| P0 모델명 수정 | 즉시 | 10분 |
| P1 색상 전염 수정 | 높음 | 2~3시간 |
| P2 자간 정규화 | 높음 | 30분 |
| P3 줄간격 조정 | 높음 | 1~2시간 |

### Phase 2 — 멀티 프로바이더 (2~3일)

| 항목 | 우선순위 | 예상 소요 |
|---|---|---|
| P7 Provider Abstraction 레이어 | 높음 | 반나절 |
| P7 Gemini 프로바이더 | 높음 | 1시간 |
| P7 Claude 프로바이더 | 높음 | 2~3시간 |
| P7 OpenAI 프로바이더 | 높음 | 2~3시간 |
| P7 UI (드롭다운) 추가 | 높음 | 1~2시간 |

### Phase 3 — UX 개선 및 기능 완성 (2~3일)

| 항목 | 우선순위 | 예상 소요 |
|---|---|---|
| P4 Document Preview 개선 | 중간 | 1시간 |
| P5 수정 반영 전체 슬라이드 출력 | 중간 | 2~3시간 |
| P6 이메일 알림 Vercel 환경변수 설정 | 중간 | 30분 |

### Phase 4 — 장기 과제 (별도 검토)

| 항목 | 비고 |
|---|---|
| P8 텍스트 박스 자동 크기 조정 | 겹침 문제 해결 방안 포함해서 설계 필요 |
| 평가 앱(`project/평가code/`) 번역기 통합 | 별도 설계 회의 필요 |
| 모바일 반응형 개선 | |

---

## 4. 기술 부채 목록

| 항목 | 내용 |
|---|---|
| `src/` 루트 | MyMemory 기반 구 버전 — 삭제 또는 `.gitignore` 처리 권장 |
| `geminiService.ts` | 멀티 프로바이더 전환 후 thin wrapper 또는 제거 |
| `project/평가code/` | 번역기와 별도 Vite 앱으로 분리되어 있음 — 통합 또는 명확한 분리 결정 필요 |
| `desktop.ini` 파일들 | Windows 탐색기 메타데이터 — `.gitignore`에 추가 권장 |
| `guide.md` 자동 로드 | 사용자가 "추가 지시사항"을 입력해도 기본값에 묻히는 UX 문제 |

---

## 5. 환경변수 체크리스트

Vercel 프로젝트 설정에서 확인/추가 필요:

| 변수명 | 설명 | 상태 |
|---|---|---|
| `VITE_GEMINI_API_KEY` | Gemini 공용 API 키 (사용자 미입력 시 fallback) | 확인 필요 |
| `VITE_EMAILJS_SERVICE_ID` | EmailJS 서비스 ID | ❌ 미설정 추정 |
| `VITE_EMAILJS_TEMPLATE_ID` | EmailJS 템플릿 ID | ❌ 미설정 추정 |
| `VITE_EMAILJS_PUBLIC_KEY` | EmailJS 공개 키 | ❌ 미설정 추정 |
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL | ✅ 설정됨 추정 (로그인 동작 중) |
| `VITE_SUPABASE_ANON_KEY` | Supabase 익명 키 | ✅ 설정됨 추정 |
| (Phase 2 추가) `VITE_ANTHROPIC_API_KEY` | Claude 공용 fallback 키 | 추후 추가 |
| (Phase 2 추가) `VITE_OPENAI_API_KEY` | OpenAI 공용 fallback 키 | 추후 추가 |
