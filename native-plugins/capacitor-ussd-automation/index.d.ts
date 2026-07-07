export interface SimSlotInfo {
  slotIndex: number;
  subscriptionId: number;
  carrierName: string;
  matchedNetwork: 'MTN' | 'TELECEL' | 'AT' | null;
}

export interface UssdTemplateStep {
  inputType: 'menu_option' | 'amount' | 'phone' | 'literal' | 'pin_wait';
  value?: string;
  placeholder?: string;
}

export interface UssdSessionOptions {
  subscriptionId: number;
  ussdCode: string;
  steps: UssdTemplateStep[];
  successPatterns: string[];
  failurePatterns: string[];
  pinPromptPatterns: string[];
  stepTimeoutMs: number;
  maxRetries: number;
  // Resolves 'amount'/'phone' placeholders declared in steps above.
  values: Record<string, string>;
}

export interface UssdAutomationPlugin {
  getSimSlots(): Promise<{ slots: SimSlotInfo[] }>;
  isAccessibilityServiceEnabled(): Promise<{ enabled: boolean }>;
  openAccessibilitySettings(): Promise<void>;
  startSession(options: UssdSessionOptions): Promise<{ started: boolean }>;
  cancelSession(): Promise<void>;
  addListener(eventName: string, callback: (data: any) => void): Promise<{ remove: () => void }>;
}

export declare const UssdAutomation: UssdAutomationPlugin;
