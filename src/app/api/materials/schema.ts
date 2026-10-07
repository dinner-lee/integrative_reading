import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const MaterialInput = z
  .object({
    isOnline: z.boolean(),
    mediaType: z.string().trim().max(30).default("other"),
    title: z.string().trim().min(1, "제목을 적어 주세요.").max(200),
    url: optionalText(2000),
    source: optionalText(200),
    publishedAt: optionalText(50),
    content: z.string().trim().min(1, "내용을 적거나 파일을 올려 주세요.").max(200_000, "내용이 너무 길어요(20만 자까지)."),
    note: optionalText(2000),
    inputMethod: z.enum(["manual", "file"]).default("manual"),
    fileName: optionalText(300),
    extractedChars: z.number().int().nonnegative().optional().nullable(),
  })
  .refine((m) => !m.isOnline || !!m.url, { message: "온라인 자료는 링크를 붙여 주세요.", path: ["url"] })
  .refine((m) => !m.url || /^https?:\/\//i.test(m.url), { message: "링크는 http:// 또는 https://로 시작해야 해요.", path: ["url"] });

export type MaterialInputType = z.infer<typeof MaterialInput>;

export const materialSelect = {
  id: true,
  groupId: true,
  isOnline: true,
  mediaType: true,
  title: true,
  url: true,
  source: true,
  publishedAt: true,
  content: true,
  note: true,
  inputMethod: true,
  fileName: true,
  extractedChars: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } },
} as const;
