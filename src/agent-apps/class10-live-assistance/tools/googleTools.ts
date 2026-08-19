import type { ToolDefinition } from '../../../agent/types/agent';
import type { ToolHandler } from '../../../agent/types/tool';
import { searchContacts, createContact, updateContact, deleteContact } from '../services/googleContactsService';
import { listCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../services/googleCalendarService';
import { listRecentEmails, sendEmail } from '../services/googleGmailService';

export const googleToolDefinitions: ToolDefinition[] = [
  {
    name: 'searchContacts',
    description: '搜尋 Google 聯絡人 (依姓名或 Email)',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'STRING', description: '搜尋關鍵字' } },
      required: ['query']
    }
  },
  {
    name: 'createContact',
    description: '新增 Google 聯絡人資料',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: '聯絡人姓名' },
        email: { type: 'STRING', description: 'Email 地址' },
        phone: { type: 'STRING', description: '電話號碼' },
        note: { type: 'STRING', description: '備註' }
      },
      required: ['name']
    }
  },
  {
    name: 'updateContact',
    description: '更新 Google 聯絡人資料',
    parameters: {
      type: 'OBJECT',
      properties: {
        resourceName: { type: 'STRING', description: '聯絡人資源 ID (people/c...)' },
        name: { type: 'STRING', description: '姓名' },
        email: { type: 'STRING', description: 'Email' },
        phone: { type: 'STRING', description: '電話' }
      },
      required: ['resourceName']
    }
  },
  {
    name: 'deleteContact',
    description: '刪除 Google 聯絡人',
    parameters: {
      type: 'OBJECT',
      properties: { resourceName: { type: 'STRING', description: '聯絡人資源 ID' } },
      required: ['resourceName']
    }
  },
  {
    name: 'listCalendarEvents',
    description: '查詢 Google 行事曆行程與待辦事項',
    parameters: {
      type: 'OBJECT',
      properties: {
        timeMin: { type: 'STRING', description: '起始時間 (ISO 字串)' },
        maxResults: { type: 'NUMBER', description: '最多傳回筆數' }
      }
    }
  },
  {
    name: 'createCalendarEvent',
    description: '建立 Google 行事曆行程或待辦事項',
    parameters: {
      type: 'OBJECT',
      properties: {
        summary: { type: 'STRING', description: '行程標題/待辦內容' },
        description: { type: 'STRING', description: '詳細說明' },
        startDateTime: { type: 'STRING', description: '開始時間 (ISO 字串)' },
        endDateTime: { type: 'STRING', description: '結束時間 (ISO 字串)' },
        location: { type: 'STRING', description: '地點' }
      },
      required: ['summary', 'startDateTime', 'endDateTime']
    }
  },
  {
    name: 'updateCalendarEvent',
    description: '更新 Google 行事曆行程',
    parameters: {
      type: 'OBJECT',
      properties: {
        eventId: { type: 'STRING', description: '行程 ID' },
        summary: { type: 'STRING' },
        startDateTime: { type: 'STRING' },
        endDateTime: { type: 'STRING' }
      },
      required: ['eventId']
    }
  },
  {
    name: 'deleteCalendarEvent',
    description: '刪除 Google 行事曆行程',
    parameters: {
      type: 'OBJECT',
      properties: { eventId: { type: 'STRING', description: '行程 ID' } },
      required: ['eventId']
    }
  },
  {
    name: 'listRecentEmails',
    description: '檢查 Gmail 最新收件與重要信件提醒',
    parameters: {
      type: 'OBJECT',
      properties: {
        maxResults: { type: 'NUMBER', description: '筆數上限' },
        q: { type: 'STRING', description: 'Gmail 搜尋查詢' }
      }
    }
  },
  {
    name: 'sendEmail',
    description: '發送 Gmail 電子郵件',
    parameters: {
      type: 'OBJECT',
      properties: {
        to: { type: 'STRING', description: '收件人 Email' },
        subject: { type: 'STRING', description: '信件主旨' },
        body: { type: 'STRING', description: '信件正文' }
      },
      required: ['to', 'subject', 'body']
    }
  }
];

export function createGoogleToolHandlers(): Record<string, ToolHandler> {
  return {
    searchContacts: async (args) => searchContacts(args.query as string),
    createContact: async (args) => createContact(args as any),
    updateContact: async (args) => {
      const { resourceName, ...rest } = args;
      return updateContact(resourceName as string, rest as any);
    },
    deleteContact: async (args) => deleteContact(args.resourceName as string),
    listCalendarEvents: async (args) => listCalendarEvents(args as any),
    createCalendarEvent: async (args) => createCalendarEvent(args as any),
    updateCalendarEvent: async (args) => {
      const { eventId, ...rest } = args;
      return updateCalendarEvent(eventId as string, rest as any);
    },
    deleteCalendarEvent: async (args) => deleteCalendarEvent(args.eventId as string),
    listRecentEmails: async (args) => listRecentEmails(args as any),
    sendEmail: async (args) => sendEmail(args as any)
  };
}
