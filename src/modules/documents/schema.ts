import { z } from "zod";
import { documentParentEnum, docTypeEnum } from "@/db/schema";

/** Checkbox/string → boolean ("true" or "on" → true, everything else → false). */
const checkboxBool = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => v === true || v === "true" || v === "on");

export const uploadMetaSchema = z.object({
  parentType: z.enum(documentParentEnum.enumValues),
  parentId: z.string().trim().min(1),
  docType: z.enum(docTypeEnum.enumValues),
  visibleToClient: checkboxBool,
});

export type UploadMeta = z.infer<typeof uploadMetaSchema>;

export const visibilityInputSchema = z.object({
  visibleToClient: z.boolean(),
});
