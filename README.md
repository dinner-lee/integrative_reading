# 엮어 쓰기 (integrative-writing-lab)

「텍스트 마이닝을 통한 주제 통합적 읽기와 정보 전달 글쓰기 AI 융합 수업 모형 개발」(박소미·이정찬·조애영) 연구계획서를 바탕으로 만든 중학생용 협력 글쓰기 웹앱입니다.

학생은 모둠별로 자료를 모으고, TF-IDF·LDA·BERTopic으로 자료를 묶어 본 뒤, 묶음에 이름을 붙이고 선정·보류·제외를 정하고(내용 생성하기), 개요에 배치하고(조직하기), 앞 단계의 정리 내용을 사이드바에서 끌어와 함께 글을 씁니다(표현하기). 교사는 초대 코드로 학생을 받고, 단계를 열고, 모둠을 편성하고, 연구용 로그를 내려받습니다.

## 단계와 기능

| 단계 | 과정 중심 쓰기 | 학생 활동 | 저장 위치 |
| --- | --- | --- | --- |
| 1 계획하기 | 계획하기 | 모둠 화제·목적·독자·형식, 개인별 목적·독자·궁금한 점 | Liveblocks Storage |
| 2 자료 모으기 | 생성하기 | 온라인/오프라인 선택, 매체, 제목, 링크(온라인 필수), 출처, 발행일, 본문, 고른 까닭. PDF·DOCX·PPTX·HWPX는 markitdown으로 글자 변환 후 원문 PDF와 나란히 비교·수정 | Postgres `Material` |
| 3 자료 분석하기 | 생성하기 | 방법(TF-IDF+k-평균 / LDA / BERTopic), 묶음 수(자동=실루엣), 품사, 불용어, 최소 등장 자료 수, 두 낱말 묶음, 분석에 넣을 자료 고르기 → 묶음·자료 지도·낱말 점수(TF·IDF·TF-IDF)·유사도 열지도·전처리 결과, 전처리 미리보기, 실행 기록·두 결과 비교·해석 메모, 결과에서 낱말을 바로 불용어로 빼기 | Postgres `AnalysisRun` |
| 4 내용 생성하기 | 생성하기 | 채택한 분석 결과로 묶음 보드 생성 → 묶음 이름·메모 함께 편집, 우선순위(순서), 자료별 선정/보류/제외 + 근거, 끌어다 놓아 묶음 바꾸기, 새 묶음, 묶음별 논의 댓글 | Liveblocks Storage + Threads |
| 5 조직하기 | 조직하기 | 처음·가운데·끝 개요 칸, 칸별 중심 내용, 선정 자료를 칸에 배치(끌어다 놓기/고르기)·순서 바꾸기, 칸별 논의 댓글 | Liveblocks Storage + Threads |
| 6 표현하기 | 표현하기 | Tiptap+Yjs 공동 편집기, 본문에 고정된 주석 댓글과 답글, 사이드바(개요·묶음·자료·계획)에서 개요 뼈대·고른 부분 인용·출처 표시·출처 목록 넣기. 교사 설정에 따라 모둠 글 / 개인 글(모둠원 댓글) / 둘 다 | Liveblocks Yjs |
| 7 고쳐쓰기·성찰 | 고쳐쓰기 | 다른 모둠 글 읽기(읽기 전용), 성찰 질문 5개 | Postgres `Reflection` |

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
