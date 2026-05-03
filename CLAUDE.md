# AI PPT Translator — Claude Code 지침

## 프로젝트 구조

- 실제 앱: `project/ai ppt 번역기/1. translate-code/` (Vite + React + TypeScript)
- 배포: Vercel (`npx vercel --prod --yes`)
- 브랜치: 개발은 `v2-update`, 배포는 `main`에 머지

## 배포 워크플로우

```
코드 수정 → git commit → git push v2-update
→ git checkout main && git merge v2-update --no-ff
→ git push origin main
→ cd "project/ai ppt 번역기/1. translate-code" && npx vercel --prod --yes
```

## 배포 후 필수 검증 (browse 스킬로 직접 테스트)

웹앱을 배포한 뒤에는 반드시 browse 스킬로 직접 테스트한다. "코드 수정했으니 테스트해보세요"로 끝내지 않는다.

**검증 체크리스트:**
1. `$B goto https://1-translate-code.vercel.app` → 스크린샷으로 UI 확인
2. `$B upload "input[type=file]" "/tmp/test.pptx"` → 파일 업로드 테스트
3. API Key 입력 → 번역 시작 → Step 3 진입 확인
4. 번역 완료 후 다운로드 파일 내용 텍스트 추출로 품질 확인
5. 콘솔 에러 확인: `$B console --errors`
6. 발견된 문제 즉시 수정 → 재배포 → 재테스트

**테스트용 PPTX 위치:**
`project/ai ppt 번역기/2. ppt/1. RCA 보고서_원본.pptx` (browse 접근은 /tmp로 복사 필요)

## 알려진 제약

- 원본 디렉토리 경로에 한글/공백 포함 → npm install은 Google Drive 동기화 끄고 실행
- browse 스킬 파일 업로드: `C:/Users/nomus/AppData/Local/Temp` 또는 translate-code 디렉토리만 접근 가능
- Supabase 미설정 상태 → 로그인/토큰 추적 비활성, 번역 기능은 정상 작동

## 핵심 서비스 파일

| 파일 | 역할 |
|------|------|
| `src/services/geminiService.ts` | 번역 진입점, provider 디스패치 |
| `src/services/providers/geminiProvider.ts` | Gemini API 호출 |
| `src/services/providers/claudeProvider.ts` | Claude API 호출 (fetch 기반) |
| `src/services/providers/openaiProvider.ts` | OpenAI API 호출 (fetch 기반) |
| `src/services/pptxService.ts` | PPTX 파싱/재조립, 색상/자간/줄간격 수정 |
| `src/services/QualityService.ts` | 번역 품질 검증 (Gemini) |
| `src/services/modelCatalog.ts` | Provider/Model 카탈로그, localStorage API Key 관리 |
