export type AgentTaskStatus = 'pending' | 'running' | 'done' | 'failed';

export interface AgentTask {
  id: string;
  title: string;
  description?: string;
  status: AgentTaskStatus;
  /** Short summary of this task's outcome, filled in when the task finishes. */
  resultSummary?: string;
}

export type AgentTaskPlanStatus = 'running' | 'aggregating' | 'completed' | 'failed';

export interface AgentTaskPlan {
  /** The original user request that triggered the plan. */
  objective: string;
  tasks: AgentTask[];
  status: AgentTaskPlanStatus;
  createdAt: number;
}
