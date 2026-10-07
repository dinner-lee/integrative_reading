/** 과정 중심 쓰기 모형(계획하기-생성하기-조직하기-표현하기-고쳐쓰기)에 맞춘 활동 단계 */
export const STAGES = [
  { key: "plan", label: "계획하기", short: "계획", process: "계획하기", desc: "화제, 글의 목적, 예상 독자를 정해요." },
  { key: "collect", label: "자료 모으기", short: "수집", process: "생성하기", desc: "자료를 찾아 등록하고 출처를 적어요." },
  { key: "analyze", label: "자료 분석하기", short: "분석", process: "생성하기", desc: "텍스트 마이닝으로 자료를 묶어 보고, 묶음에 이름을 붙이고 선정·보류·제외를 정해요." },
  { key: "organize", label: "조직하기", short: "조직", process: "조직하기", desc: "개요를 짜고 자료를 어디에 쓸지 정해요." },
  { key: "write", label: "표현하기", short: "표현", process: "표현하기", desc: "개요와 자료를 보며 함께 글을 쓰고 댓글을 남겨요." },
  { key: "reflect", label: "고쳐쓰기·성찰", short: "성찰", process: "고쳐쓰기", desc: "다른 모둠 글을 읽고 자료 선별 과정을 돌아봐요." },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

export const STAGE_KEYS = STAGES.map((s) => s.key) as StageKey[];

export function isStageKey(v: unknown): v is StageKey {
  return typeof v === "string" && (STAGE_KEYS as string[]).includes(v);
}

export const METHODS = [
  {
    key: "tfidf_kmeans",
    label: "TF-IDF + k-평균 묶기",
    short: "TF-IDF",
    desc: "자료마다 '그 자료에서 자주 나오지만 다른 자료에는 드문 낱말'에 높은 점수를 주고, 점수 모양이 비슷한 자료끼리 묶어요. 한 자료는 한 묶음에만 들어가요.",
  },
  {
    key: "lda",
    label: "LDA 주제 모형",
    short: "LDA",
    desc: "자료 전체에 숨어 있는 주제 몇 개를 찾고, 자료마다 주제가 얼마씩 섞여 있는지 보여 줘요. 한 자료에 여러 주제가 섞일 수 있어요.",
  },
  {
    key: "bertopic",
    label: "BERTopic(문장 의미)",
    short: "BERTopic",
    desc: "낱말 대신 문장의 의미를 숫자로 바꾼 뒤 비슷한 자료끼리 묶어요. 같은 낱말이 없어도 뜻이 비슷하면 가까워질 수 있어요.",
  },
] as const;

export type MethodKey = (typeof METHODS)[number]["key"];

export const WRITING_MODES = {
  group: "모둠이 한 편을 함께 쓰기",
  individual: "각자 쓰고 모둠원이 댓글 달기",
  both: "모둠 글과 개인 글 모두",
} as const;

export type WritingMode = keyof typeof WRITING_MODES;
