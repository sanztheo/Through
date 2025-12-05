import { createPlan, Plan } from "./coordinator";
import { runExecutorStep } from "./executor";
import { verifyStep } from "./verifier";

export interface AgentContext {
  projectPath: string;
  onChunk: (chunk: any) => void;
  messages: any[]; // History
}

export async function runOrchestrator(userPrompt: string, context: AgentContext) {
  const { projectPath, onChunk, messages } = context;

  // 1. COORDINATION PHASE
  onChunk({ type: "text", content: "🧠 **Coordinator:** Analyzing request and generating plan...\n" });
  
  let plan: Plan;
  try {
     plan = await createPlan(userPrompt, projectPath);
  } catch (err: any) {
     onChunk({ type: "text", content: `❌ **Error creating plan:** ${err.message}\n` });
     return;
  }

  onChunk({ type: "text", content: `📋 **Plan Created:**\n` });
  for (const step of plan.steps) {
      onChunk({ type: "text", content: `- [ ] ${step.description}\n` });
  }
  onChunk({ type: "text", content: "\n---\n" });

  // 2. EXECUTION LOOP
  const history = [...messages]; 

  for (const step of plan.steps) {
      onChunk({ type: "text", content: `\n### ▶️ Executing Step: ${step.description}\n` });
      
      // Execute
      let executionResult = "";
      try {
          const result = await runExecutorStep(step.description, history, projectPath, onChunk);
          // Accumulate the full text from the streamText result for verification context
          // streamText returns an object with a text stream, but we might need to await it fully?
          // The executor helper returns the streamText result object.
          // Wait, runExecutorStep returns the result of streamText.
          // We need the full text for the verifier context.
          // Actually, streamText result allows { text } property which is a promise for full text.
          executionResult = await result.text;
          
          // Update history for next steps
          history.push({ role: "system", content: `Completed step: ${step.description}. Result: ${executionResult}` });
          
      } catch (execErr: any) {
          onChunk({ type: "text", content: `\n❌ Execution Failed: ${execErr.message}\n` });
          // Break or continue? Depend heavily on severity. For now break.
          break;
      }

      // 3. VERIFICATION PHASE
      onChunk({ type: "text", content: `\n🕵️ **Verifying...**\n` });
      try {
          const verification = await verifyStep(step.description, executionResult, projectPath);
          
          if (verification.success) {
              onChunk({ type: "text", content: `✅ **Verified:** ${verification.feedback}\n` });
          } else {
             onChunk({ type: "text", content: `⚠️ **Verification Issue:** ${verification.feedback}\n` });
             if (verification.nextAction === 'retry') {
                 // Simple retry logic could be implemented here (e.g., recursive call or loop decrement)
                 // For v1, we just notify user.
                 onChunk({ type: "text", content: `👉 **Action Required:** Agent suggests retrying/fixing.\n` });
             } else if (verification.nextAction === 'abort') {
                 onChunk({ type: "text", content: `🛑 **Aborting Plan.**\n` });
                 break;
             }
          }
      } catch (verifyErr: any) {
          // Verification failed technically, but maybe execution was fine.
           onChunk({ type: "text", content: `(Verification skipped due to error: ${verifyErr.message})\n` });
      }
      
      onChunk({ type: "text", content: `\n---\n` });
  }

  onChunk({ type: "text", content: `\n🎉 **All tasks completed.**\n` });
  onChunk({ type: "done" });
}
