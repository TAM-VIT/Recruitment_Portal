import { z } from "zod";
import { DomainType } from "@prisma/client";

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
export const domainEnum = z.nativeEnum(DomainType);

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(100),
  phone: z
    .string()
    .trim()
    .transform((s) => s.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^(\+91)?[6-9]\d{9}$/, "Enter a valid 10 digit mobile number"))
    .transform((s) => s.slice(-10)),
  // example: 24BCE1234. Change the pattern if your reg numbers look different
  regNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]{3}\d{4,5}$/, "Invalid registration number (example: 24BCE1234)"),
  domains: z
    .array(domainEnum)
    .min(1, "Pick at least one domain")
    .transform((d) => [...new Set(d)]),
});

export const profileUpdateSchema = profileSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");


export const saveAnswerSchema = z.object({
  questionId: objectId,
  text: z.string().max(10000),
});

export const submitFormSchema = z.object({ domain: domainEnum });

export const bookSlotSchema = z.object({ slotId: objectId });

export const calendarQuerySchema = z.object({
  domain: domainEnum,
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM"),
});

export const slotsQuerySchema = z.object({
  domain: domainEnum,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
});