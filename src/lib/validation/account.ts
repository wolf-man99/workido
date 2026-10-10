import { z } from "zod";

/** The sentence people type to confirm deleting their account. */
export const DELETE_ACCOUNT_PHRASE = "Delete my Workido account";

export const deleteAccountSchema = z.object({
  confirmation: z
    .string()
    .trim()
    .refine((value) => value === DELETE_ACCOUNT_PHRASE, { error: `Type "${DELETE_ACCOUNT_PHRASE}" exactly to confirm.` }),
});
