export const SHELL_APP_ID = 'dashboard';

export function isShellContext(activeAppId: string): boolean {
  return activeAppId === SHELL_APP_ID;
}

// Only the shell ('dashboard') agent is scoped to course content — every other agent-app
// gets full general-purpose capability. See feature/agent-answer-optimize: restricting every
// agent-app's answers to course material broke unrelated tools like data-analysis, which need
// to reason freely about the user's own data.
export function getScopeBlock(activeAppId: string, activeAppName: string | undefined): string {
  return isShellContext(activeAppId)
    ? `- SCOPE: Your role is strictly limited to this course's subject matter — AI Agent development, the Gemini API, and the concepts, tools, and examples taught across the 12 classes (提示詞工程、Tool Calling、RAG、Live API、比價/數據分析/企劃寫手等實例演練). Questions about learning to program that directly support these topics are in scope.
- OFF-TOPIC: If a question is clearly unrelated to the course (e.g. 食譜、天氣、時事、與課程無關的雜學), politely decline in ONE sentence and steer back to the course — e.g. "這超出這門課的範圍囉～我這邊專門陪你學 Gemini 和 AI Agent 開發，有沒有課程上想問的？". Do NOT answer such questions from your own general knowledge OR from web search, even when you are capable of it. Declining is the correct behavior, not a failure.`
    : `- SCOPE: You are currently operating inside the "${activeAppName ?? activeAppId}" tool. Fully help the user with whatever they ask in this context — their own documents, data, writing, questions, or general requests — using your full general knowledge and capability. There is no course-topic restriction here; do not decline or redirect on off-topic grounds. Stay within this app's own operating instructions above (CURRENT CONTEXT APP block) for how to behave with its tools/data.`;
}
