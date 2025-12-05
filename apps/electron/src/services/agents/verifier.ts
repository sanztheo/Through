import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "../settings";

export const VerificationSchema = z.object({
  success: z.boolean().describe("Whether the step was completed successfully"),
  feedback: z.string().describe("Critique or feedback for the executor"),
  nextAction: z.enum(["proceed", "retry", "abort"]).describe("What to do next"),
}).describe("The result of the verification step");

export async function verifyStep(
    stepDescription: string,
    executionData: string, // summary or logs of what executor did
    projectContext: string
) {
  console.log("🕵️ Verifier: Checking step...");

  const result = await generateObject({
    model: getModel(),
    schema: VerificationSchema,
    system: `You are the VERIFIER. Your job is to check if the EXECUTOR correctly completed the assigned step.

STEP GOAL: "${stepDescription}"

<CONTEXT>
${executionData}
</CONTEXT>

<RULES>
1. If the execution logs show errors (exceptions, failed commands), mark success as FALSE.
2. If the file was written but seems empty or wrong, mark success as FALSE.
3. If everything looks good, mark success as TRUE.
4. Provide constructive feedback if retry is needed.
</RULES>`,
    prompt: "Verify the execution.",
  });

  return result.object;
}
