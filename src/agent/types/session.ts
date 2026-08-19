import type { Message } from './message';

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  activeAppId: string;
  createdAt: number;
  updatedAt: number;
}
