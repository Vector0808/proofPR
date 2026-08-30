import { LLMProvider, LLMProviderConfig, StructuredReviewResult } from "./provider";
import { GoogleGenAI } from "@google/genai";

export class GenericJSONProvider implements LLMProvider {
  private config!: LLMProviderConfig;
  private ai!: GoogleGenAI;

  init(config: LLMProviderConfig): void {
    this.config = config;
    if (this.config.provider === "gemini") {
      this.ai = new GoogleGenAI({ apiKey: this.config.apiKey });
    } else {
      throw new Error(`Provider ${this.config.provider} is not supported in V0. Use gemini.`);
    }
  }

  async generateReview<T>(
    systemPrompt: string, 
    userPrompt: string,
    schema: any, // Zod schema object
    onAttempt?: (attempt: number, error?: Error, rawResponse?: string) => void
  ): Promise<StructuredReviewResult<T>> {
    
    // Attempt 1
    let rawResponse = "";
    try {
      rawResponse = await this.callModel(systemPrompt, userPrompt);
      const parsed = this.parseResponse<T>(rawResponse, schema);
      if (onAttempt) onAttempt(1, undefined, rawResponse);
      return { ...parsed, rawResponse };
    } catch (e: any) {
      if (onAttempt) onAttempt(1, e as Error, rawResponse);
      // Fall through to retry
    }

    // Attempt 2 (Retry 1)
    const retryPrompt = `${userPrompt}\n\n[SYSTEM]: Your previous response failed to parse as valid JSON. Ensure you ONLY output valid JSON conforming strictly to the requested schema. Do not wrap it in markdown blockticks if it breaks the parser. The parser error was: ${rawResponse.substring(0, 200)}...`;
    
    try {
      rawResponse = await this.callModel(systemPrompt, retryPrompt);
      const parsed = this.parseResponse<T>(rawResponse, schema);
      if (onAttempt) onAttempt(2, undefined, rawResponse);
      return { ...parsed, rawResponse };
    } catch (e: any) {
      if (onAttempt) onAttempt(2, e as Error, rawResponse);
      throw new Error(`Structured output parsing failed after 1 retry. Diagnostic: ${e.message}`);
    }
  }

  private async callModel(systemPrompt: string, userPrompt: string): Promise<string> {
    if (this.config.provider === "gemini") {
      const response = await this.ai.models.generateContent({
        model: this.config.model,
        contents: [
            { role: "user", parts: [{ text: userPrompt }] }
        ],
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            // Note: Since GoogleGenAI typing can vary, we rely on standard generation params
        }
      });
      return response.text || "";
    }
    throw new Error("Unsupported provider");
  }

  private parseResponse<T>(rawText: string, schema: any): T {
    let cleanText = rawText.trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.substring(7);
    }
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith("```")) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    
    const parsedJson = JSON.parse(cleanText);
    return schema.parse(parsedJson) as T;
  }
}
