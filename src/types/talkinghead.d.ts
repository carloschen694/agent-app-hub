declare module '@met4citizen/talkinghead' {
  export class TalkingHead {
    lipsync: Record<string, any>;
    avatar: any;
    constructor(node: HTMLElement, options?: any);
    showAvatar(options: any, onProgress?: (ev: any) => void): Promise<void>;
    speakText(text: string, options?: any): void;
    speakEmoji(emoji: string): void;
    stopSpeaking(): void;
    setMood(mood: string): void;
    stop(): void;
  }
}

declare module '@met4citizen/talkinghead/modules/lipsync-en.mjs' {
  export class LipsyncEn {
    constructor();
  }
}
