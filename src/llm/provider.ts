export interface LLMProviderConfig {
  apiKey: string;
  provider: string; // e.g., 'gemini', 'openai'
  model: string;    // e.g., 'gemini-2.5-pro'
}

export type StructuredReviewResult<T> = T & {
  rawResponse: string; 
  tokenUsage?: { prompt: number; completion: number };
};

export interface LLMProvider {
  init(config: LLMProviderConfig): void;
  
  /**
   * Generates a review enforcing a JSON schema output.
   * Implementations MUST include strict 1-retry logic for malformed JSON.
   */
  generateReview<T>(
    systemPrompt: string, 
    userPrompt: string,
    schema: any, // We pass a Zod schema or JSON schema definition here
    onAttempt?: (attempt: number, error?: Error, rawResponse?: string) => void
  ): Promise<StructuredReviewResult<T>>; 
}
