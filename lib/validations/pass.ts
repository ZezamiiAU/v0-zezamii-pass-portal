import { z } from "zod"

export const passMetadataSchema = z.object({
  id: z.string().uuid(),
  passTypeId: z.string().uuid(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime(),
  purchaserEmail: z.string().email().optional(),
  vehiclePlate: z.string().optional(),
  status: z.enum(["active", "expired", "cancelled"]),
  singleUse: z.boolean().default(false),
})

export type PassMetadata = z.infer<typeof passMetadataSchema>

export const uploadPassSchema = z.object({
  passTypeId: z.string().uuid("Invalid pass type ID"),
  validFrom: z.string().datetime("Invalid start date"),
  validTo: z.string().datetime("Invalid end date"),
  purchaserEmail: z.string().email("Invalid email").optional(),
  vehiclePlate: z.string().max(20, "Plate too long").optional(),
  singleUse: z.boolean().default(false),
})

export type UploadPassInput = z.infer<typeof uploadPassSchema>
