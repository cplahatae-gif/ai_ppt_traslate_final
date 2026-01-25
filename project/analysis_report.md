## 분석 결과

### 1. 레이아웃 비교
| 슬라이드 | 항목 | RCA_내버전 | RCA_유료버전 | 차이점 |
|---|---|---|---|---|
| 1 | Text Block 2 | Font: Default, Size: Default | Font: Malgun Gothic, Size: 16.0 | Font: Default vs Malgun Gothic |
| 1 | Text Block 3 | Font: Default, Size: Default | Font: Calibri, Size: Default | Font: Default vs Calibri |
| 1 | Text Block 4 | Font: Default, Size: Default | Font: Malgun Gothic, Size: 16.0 | Font: Default vs Malgun Gothic |
| 2 | Text Block 1 | Font: Default, Size: Default | Font: Calibri, Size: Default | Font: Default vs Calibri, Bold: False vs True |
| 2 | Text Block 2 | Font: Default, Size: Default | Font: Calibri, Size: 16.0 | Font: Default vs Calibri |
| 3 | Text Block 1 | Font: Default, Size: Default | Font: Calibri, Size: Default | Font: Default vs Calibri, Bold: False vs True |
| 3 | Text Block 2 | Font: Default, Size: Default | Font: Calibri, Size: 16.0 | Font: Default vs Calibri |
| 3 | Text Block 4 | Font: Default, Size: Default | Font: Malgun Gothic, Size: Default | Font: Default vs Malgun Gothic |

### 2. 번역 품질 비교
| 슬라이드 | 내버전 번역 | 유료버전 번역 | 문제점 |
|---|---|---|---|
| 1 | [Aggregate Anseong Plant] Electrical Shock RCA Rep... | [Aggregate Anseong Plant] Electric Shock RCA Repor... | Content mismatch |
| 1 | Ⅰ. RCA Attendees Ⅱ. Accident Overview Ⅲ. Accident ... | I. RCA Attendees II. Accident Summary III. Root Ca... | Content mismatch |
| 2 | RCA (Root Cause Analysis) | RCA(Root Cause Analysis) | Content mismatch |
| 3 | Ⅱ. Accident Overview | II. Accident overview | Content mismatch |
| 3 | Aggregate Anseong Plant Electrocution Accident | Aggregate Anseong Plant electrocution accident | Content mismatch |

### 3. 개선 우선순위 To-Do List
- [ ] **폰트 통일**: 모든 텍스트의 폰트를 `Calibri` (영문) 및 `맑은 고딕 (Malgun Gothic)` (한글)으로 명시적 설정.
- [ ] **스타일 복원**: 제목 및 강조 텍스트의 `Bold` 속성 적용 (특히 슬라이드 2, 3).
- [ ] **용어 수정**:
    - "Electrical Shock" -> "Electric Shock"
    - "Accident Overview" -> "Accident Summary"
- [ ] **대소문자 규정**: 제목은 Title Case, 본문은 Sentence Case로 통일 (예: "Accident overview").
- [ ] **레이아웃 조정**: 텍스트 박스 위치 및 크기 정밀 보정 (오차 > 20pt 발생 항목).
