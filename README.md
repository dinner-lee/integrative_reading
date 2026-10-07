# 엮어 쓰기 (integrative-writing-lab)

「텍스트 마이닝을 통한 주제 통합적 읽기와 정보 전달 글쓰기 AI 융합 수업 모형 개발」(박소미·이정찬·조애영) 연구계획서를 바탕으로 만든 중학생용 협력 글쓰기 웹앱입니다.

학생은 모둠별로 자료를 모으고, TF-IDF·LDA·BERTopic으로 자료를 묶어 본 뒤, 묶음에 이름을 붙이고 선정·보류·제외를 정하고(내용 생성하기), 개요에 배치하고(조직하기), 앞 단계의 정리 내용을 사이드바에서 끌어와 함께 글을 씁니다(표현하기). 교사는 초대 코드로 학생을 받고, 단계를 열고, 모둠을 편성하고, 연구용 로그를 내려받습니다.

## 단계와 기능

| 단계 | 과정 중심 쓰기 | 학생 활동 | 저장 위치 |
| --- | --- | --- | --- |
| 1 계획하기 | 계획하기 | 모둠 화제·목적·독자·형식, 개인별 목적·독자·궁금한 점 | Liveblocks Storage |
| 2 자료 모으기 | 생성하기 | 온라인/오프라인 선택, 매체, 제목, 링크(온라인 필수), 출처, 발행일, 본문, 고른 까닭. PDF·DOCX·PPTX·HWPX는 markitdown으로 글자 변환 후 원문 PDF와 나란히 비교·수정 | Postgres `Material` |
| 3 자료 분석하기 | 생성하기 | 다섯 걸음: ① 자료·전처리(넣을 자료, 품사, 불용어, 전처리 미리보기) → ② 묶기(TF-IDF+k-평균 / LDA / BERTopic, 묶음 수, 자세한 조건) → ③ 결과(지표 타일, 전처리 결과·낱말 점수·자료 사이 거리·묶음·자료 지도 순) → ④ 비교·채택(기록, 두 결과 비교, 해석 메모) → ⑤ 이름·선별(묶음 이름·우선순위, 선정/보류/제외 + 근거, 끌어다 놓기, 묶음별 논의) | Postgres `AnalysisRun` + Liveblocks Storage/Threads |
| 4 조직하기 | 조직하기 | 왼쪽 선정 자료 목록(묶음별, 넣은 것은 체크), 오른쪽 처음·가운데·끝 카드. 자료는 끌어다 놓고 칸 안에서 끌어 순서를 바꿈. 칸의 위치·역할·지우기·논의는 ⋯ 메뉴 하나 | Liveblocks Storage + Threads |
| 5 표현하기 | 표현하기 | 둥근 카드 안에 글 도구 줄과 본문이 바로 들어감(Tiptap+Yjs, 주석 댓글·답글). 왼쪽 참고 목록은 메일 폴더처럼 개요·묶음·자료·계획 항목 + 개수, 아래에 한 가지 모양의 행; 행에 마우스를 올리면 '넣기'. 모둠 글 / 개인 글 전환은 분할 탭 | Liveblocks Yjs |
| 6 고쳐쓰기·성찰 | 고쳐쓰기 | 다른 모둠 글 읽기(읽기 전용), 성찰 질문 5개 | Postgres `Reflection` |

- 다른 모둠 둘러보기: 교사가 허용하면 같은 학급 다른 모둠의 모든 단계를 읽기 전용으로 볼 수 있습니다(Liveblocks `READ_ACCESS`).
- 함께 접속한 사람과 그 사람이 보는 단계·묶음·개요 칸이 실시간으로 표시됩니다.

## 연구용 로그 (`EventLog`)

교사 화면 → 「연구 자료 내보내기」에서 CSV(엑셀용 UTF-8 BOM)/JSON으로 받습니다.

| 종류 | 대표 사건(`type`) |
| --- | --- |
| 입장 | `auth.join`, `auth.rejoin`, `group.self_select`, `teacher.assign_group` |
| 단계 | `stage.enter`, `stage.leave`(머문 ms), 둘러보기는 `payload.peer` |
| 계획 | `plan.edit`, `plan.member_edit` (입력이 멈춘 뒤 마지막 값) |
| 자료 | `material.create/update/delete/extract/view/open_link` (변환 글자 수 vs 고친 뒤 글자 수 포함) |
| 분석 | `analysis.run`(조건·뺀 자료·요약), `analysis.preview`, `analysis.tab`, `analysis.select_run`, `analysis.compare`, `analysis.note`, `analysis.add_stopword_from_result`, `analysis.adopt` |
| 생성 | `cluster.rename/note/reorder/move_material/create/delete`, `decision.set`, `decision.reason` |
| 조직 | `outline.edit/place/unplace/reorder/add_section/delete_section` |
| 표현 | `draft.snapshot`(15초마다 본인이 고친 경우만: 전문, 글자 수, 편집 횟수, 입력·삭제량), `write.insert_from_sidebar`, `write.switch_doc` |
| 댓글 | `comment.create` (단계·대상 포함). 댓글 본문은 Liveblocks에 저장 |
| 성찰 | `reflection.save` |

그 밖에 「모둠 보드」 내보내기는 각 모둠의 Liveblocks Storage(묶음 이름·순서·선정 근거·개요) 최종 상태를 JSON으로 줍니다.

## 화면과 움직임의 원칙

색과 모서리는 HeroUI 테마(`theme.css`, oklch, 색상각 253.83)를 옮긴 토큰입니다. 연회색 바탕 + 흰 카드(1.25rem) + 파랑 강조 하나. 버튼·칩·내비는 알약이고 보조 버튼은 테두리 없이 연회색 채움, 입력은 0.875rem 모서리에 옅은 테두리입니다. 상단은 왼쪽 로고 + 수업 제목, 가운데 6단계 stepper(연회색 알약 트랙 안의 아이콘+라벨, 선택은 흰 알약이 스프링으로 미끄러짐), 오른쪽 톱니바퀴 '설정' 버튼 하나입니다. 설정 패널 안에 내 정보·모둠·학급, 접속자, 다른 모둠 보기, 화면 모드, 나가기를 모았습니다. 글꼴은 테마가 지정한 Inter 대신 한글을 포함한 시스템 서체·Pretendard를 씁니다. 카드는 외곽선 없이 흰 바탕(1.5rem 모서리)과 부드러운 그림자(`.card`, `.card-sm`)만으로 구분하되, 항목(자료·묶음·개요 칸·지표)에만 쓰고 폼·설정 화면은 h2 섹션 + divider + 입력란 제목(h3 크기의 label) + 흰 입력 상자(테두리 없이 은은한 그림자) + 회색 도움말로 구성합니다(`Sections`, `Section`, `Field`). 또 표현하기의 글쓰기 영역은 별도 입력 상자 없이 카드 안에 도구 줄과 본문이 바로 들어갑니다.


Apple의 WWDC 디자인 원칙(응답성, 직접 조작, 중단 가능한 스프링 모션, 재질과 깊이, 크기별 타이포그래피, 감소 동작 존중)을 웹에 맞게 옮겼습니다.

- **모션은 모두 스프링**(`src/components/motion.ts`). 기본은 튀지 않는 임계 감쇠, 손가락 속도가 실린 동작(시트·드래그 놓기)만 살짝 튑니다. `MotionConfig reducedMotion="user"`로 시스템의 감소 동작 설정을 따릅니다.
- **직접 조작**: 내용 생성·조직하기의 자료 옮기기는 포인터에 1:1로 붙는 드래그(`src/components/workspace/dnd.tsx`)입니다. 끄는 동안 놓을 자리가 실시간으로 강조되고, 놓으면 스프링으로 안착합니다. 묶음 우선순위는 손잡이를 끌어 바꿉니다. 키보드·선택 상자 경로도 그대로 남겨 두었습니다.
- **시트와 모달**: 모바일에서는 아래에서 올라오는 시트가 손가락을 따라오고, 놓는 속도를 투영해 닫힐지 돌아올지 정합니다. 데스크톱 모달은 흐림+축소에서 또렷해지며 등장하고 뒤 화면은 어두워지며 살짝 물러납니다.
- **재질**: 상단 크롬은 반투명 재질로 떠 있고 내용이 그 아래로 스크롤됩니다. 1px 구분선 대신 스크롤했을 때만 번지는 가장자리 효과를 씁니다. `prefers-reduced-transparency`·`prefers-contrast`에서는 불투명하게 바뀝니다.
- **피드백**: 버튼은 누르는 순간 반응합니다. 되돌릴 수 있는 삭제(자료)는 확인 창 대신 "되돌리기" 토스트, 되돌릴 수 없는 일(학급·모둠 삭제)만 대화상자로 묻습니다. 브라우저 기본 `confirm/prompt/alert`는 쓰지 않습니다.
- **타이포그래피**: 시스템 서체를 먼저 쓰고(Apple 기기는 San Francisco·Apple SD Gothic Neo), 그 밖에는 자체 제공 Pretendard를 씁니다. 큰 글자는 자간을 조이고 작은 글자는 살짝 벌립니다.
- **로고**: 따옴표 두 쌍 모양의 SVG(`public/logo-black.svg`·`logo-white.svg`, 앱 아이콘은 `src/app/icon.svg`)를 `Logo` 컴포넌트가 밝은 모드엔 검정, 어두운 모드엔 흰색으로 바꿔 보여 줍니다(CSS `.logo-light`/`.logo-dark`). 글자 로고 "엮어 쓰기"는 Cafe24 PRO UP(눈누 CDN, `.brand`)이며 글자 높이를 아이콘 높이에 맞춥니다.
- **단순함**: 분석 조건은 자주 쓰는 것(방법·묶음 수·품사·자료)을 먼저 보이고, 불용어 편집·최소 등장 수·낱말 단위는 "자세한 조건" 아래에 둡니다.

## 구성

```
Next.js 16 (App Router, Vercel)  ──  Postgres (Neon) : 교사·학급·모둠·학생·자료·분석 기록·성찰·로그
        │                         └─ Liveblocks       : 실시간 보드(Storage), 공동 편집(Yjs), 댓글(Threads), 접속 표시
        └── FastAPI 분석 서버 (analysis/) : Kiwi 형태소 분석, scikit-learn TF-IDF/k-평균/LDA, BERTopic(선택), markitdown 변환
```

- 로그인: 학생은 `초대 코드 + 이름`(같은 이름이면 이어서 하기), 교사는 이메일·비밀번호. 서명된 쿠키(jose) 세션.
- Liveblocks 방은 모둠마다 하나(`c:{학급}:g:{모둠}`). 인증 엔드포인트가 본인 모둠은 쓰기, 다른 모둠은 읽기만 줍니다.
- 분석 서버는 `x-analysis-secret` 헤더로 Next 서버만 호출합니다. 업로드 파일은 저장하지 않고 변환한 글자만 저장합니다.

### 기술 선택에 대한 제안

- **Next.js + Neon + Liveblocks 조합은 그대로 좋습니다.** Neon은 서버리스(Vercel)와 궁합이 좋고 무료 용량으로 2개 학급 50명 규모는 충분합니다.
- **분석 서버는 Python으로 따로 둡니다.** Kiwi·scikit-learn·BERTopic은 Python 전용이고 Vercel 함수 크기 제한에 맞지 않습니다. `analysis/Dockerfile`로 Railway·Render·Fly.io·Cloud Run 중 하나에 올리면 됩니다. BERTopic(torch 포함)은 메모리 2GB 이상이 필요하니, 처음에는 TF-IDF·LDA만 켜고 필요할 때 `--build-arg EXTRAS=bertopic`으로 빌드하길 권합니다.
- PDF 원본 파일까지 보관하려면 Supabase(Postgres + 파일 저장소 + 인증)가 대안이지만, 지금 요구에는 Neon으로 충분합니다. 원본 보관이 필요해지면 Vercel Blob만 덧붙이면 됩니다.

## 내 컴퓨터에서 실행

```bash
cp .env.example .env.local      # 값 채우기 (Prisma CLI용으로 .env에도 같은 값)
npm install
npx prisma db push              # 테이블 만들기

# 분석 서버
cd analysis && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && cd ..
npm run dev:analysis            # http://127.0.0.1:8000/health

npm run dev                     # http://localhost:3000
```

- Liveblocks는 대시보드의 `sk_dev_…` 키를 쓰면 됩니다. 인터넷 없이 시험하려면 `npm run dev:liveblocks`(Bun 필요)로 로컬 서버를 띄우고 `LIVEBLOCKS_SECRET_KEY=sk_localdev`, 두 `*_BASE_URL`을 `http://127.0.0.1:1153`으로 둡니다. (`localhost`는 Node가 IPv4로 접속해 실패할 수 있어 `127.0.0.1`을 씁니다.)
- 분석 모듈 단독 확인: `npm run test:analysis`

## 배포 (Vercel + Neon + 분석 서버)

1. Neon에서 DB 생성 → `DATABASE_URL`(pooler), `DIRECT_URL`(direct).
2. 분석 서버를 Docker로 배포 → 공개 주소를 `ANALYSIS_URL`, 같은 `ANALYSIS_SECRET`을 양쪽에.
3. Vercel 환경 변수: `.env.example` 항목 모두(`SESSION_SECRET`은 새로 생성, Liveblocks는 운영용 `sk_prod_…` 권장).
4. 첫 배포 뒤 `npx prisma db push`(DIRECT_URL 사용).
5. 운영 중 교사 가입을 막으려면 `TEACHER_SIGNUP_CODE` 설정.

## 알려진 한계

- 학생 로그인은 이름만 확인하므로 같은 학급에서 다른 학생 이름으로 들어갈 수 있습니다(연구계획 요구사항에 따른 단순화). 필요하면 4자리 PIN을 덧붙일 수 있습니다.
- 자료가 4개 미만이면 묶음 결과가 불안정하다는 경고를 띄웁니다. BERTopic은 자료 수가 적은 교실 상황에 맞춰 UMAP/HDBSCAN 대신 PCA+k-평균을 씁니다.
- 스캔 이미지 PDF는 글자를 뽑지 못합니다(경고 표시). OCR은 넣지 않았습니다.
