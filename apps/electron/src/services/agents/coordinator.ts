import { generateObject, LanguageModel } from "ai";
import { z } from "zod";

// Schema for the plan
export const PlanSchema = z.object({
  goal: z.string().describe("The high-level goal of the user's request"),
  steps: z.array(
    z.object({
      id: z.string().describe("Unique identifier for the step"),
      description: z.string().describe("Clear description of what needs to be done in this step"),
      reasoning: z.string().describe("Why this step is necessary"),
      type: z.enum(["command", "code_change", "verification", "analysis"]).describe("Type of action required"),
    })
  ).describe("Ordered list of steps to achieve the goal"),
}).describe("The implementation plan structure");

export type Plan = z.infer<typeof PlanSchema>;

export async function createPlan(userPrompt: string, projectContext: string, model: LanguageModel) {
  console.log("🧠 Coordinator: Creating plan for:", userPrompt);

  const result = await generateObject({
    model: model,
    schema: PlanSchema,
    system: `You are the COORDINATOR of an advanced AI coding system.
Your role is to ANALYZE the user's request and create a detailed, step-by-step PLAN for the EXECUTOR agent.

<CONTEXT>
Project Path: ${projectContext}
User Request: "${userPrompt}"
</CONTEXT>

<RULES>
1. Break down complex tasks into small, manageable steps.
2. Ensure the order is logical (e.g., read file -> modify file -> verify).
3. Be specific in your descriptions so the Executor knows exactly what to do.
4. If the request is simple (e.g., "list files"), create a plan with just that one step.
5. Verification steps are crucial after code changes.
</RULES>`,
    prompt: "Generate the implementation plan.",
    // @ts-ignore
    mode: 'json',
  });

  return result.object;
}
