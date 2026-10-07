export type Material = {
  id: string;
  groupId: string;
  isOnline: boolean;
  mediaType: string;
  title: string;
  url: string | null;
  source: string | null;
  publishedAt: string | null;
  content: string;
  note: string | null;
  inputMethod: "manual" | "file";
  fileName: string | null;
  extractedChars: number | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string } | null;
};

export type Me = {
  student: { id: string; name: string };
  group: { id: string; name: string; roomId: string } | null;
  members: { id: string; name: string }[];
  classroom: {
    id: string;
    name: string;
    openStages: string[];
    writingMode: "group" | "individual" | "both";
    allowPeerView: boolean;
    selfSelectGroup: boolean;
    enabledMethods: string[];
  };
  groups: { id: string; name: string; roomId: string; students: number; materials: number }[];
};

export type Term = { term: string; weight: number; tf?: number; idf?: number };

export type RunResult = {
  method: "tfidf_kmeans" | "lda" | "bertopic";
  k: number;
  vocabSize: number;
  docs: {
    id: string;
    title: string;
    cluster: number;
    fit: number;
    tokenCount: number;
    topTerms: Term[];
    coords: [number, number];
    topicDist?: number[];
  }[];
  clusters: { id: number; size: number; terms: Term[]; docIds: string[] }[];
  similarity: number[][];
  metrics: { silhouette?: number; inertia?: number; perplexity?: number };
  kCandidates: { k: number; silhouette: number }[];
  preprocessing: {
    id: string;
    title: string;
    stats: PreprocessStats;
    removed: Removed;
    morphemes: Morpheme[];
    tokensPreview: string[];
  }[];
  warnings: string[];
};

export type PreprocessStats = {
  chars: number;
  morphemes: number;
  kept: number;
  removedByPos: number;
  removedByStopword: number;
  removedByLength: number;
};
export type Removed = Record<"pos" | "stopword" | "length", { word: string; count: number }[]>;
export type Morpheme = { form: string; tag: string; kept: boolean };

export type RunParams = {
  preprocess: { pos: "nouns" | "nouns_verbs" | "content"; stopwords: string[]; minLength: number };
  mining: { k: number | null; minDf: number; maxDf: number; ngram: 1 | 2 };
};

export type RunSummary = {
  id: string;
  method: RunResult["method"];
  params: RunParams;
  materialIds: string[];
  note: string | null;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  summary: { k: number; clusters: { size: number; terms: string[] }[]; metrics: RunResult["metrics"]; warnings: number };
};

export type RunFull = Omit<RunSummary, "summary"> & { result: RunResult; groupId: string };
