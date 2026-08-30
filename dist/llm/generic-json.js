"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericJSONProvider = void 0;
const genai_1 = require("@google/genai");
class GenericJSONProvider {
    config;
    ai;
    init(config) {
        this.config = config;
        if (this.config.provider === "gemini") {
            this.ai = new genai_1.GoogleGenAI({ apiKey: this.config.apiKey });
        }
        else {
            throw new Error(`Provider ${this.config.provider} is not supported in V0. Use gemini.`);
        }
    }
    async generateReview(systemPrompt, userPrompt, schema, // Zod schema object
    onAttempt) {
        // Attempt 1
        let rawResponse = "";
        try {
            rawResponse = await this.callModel(systemPrompt, userPrompt);
            const parsed = this.parseResponse(rawResponse, schema);
            if (onAttempt)
                onAttempt(1, undefined, rawResponse);
            return { ...parsed, rawResponse };
        }
        catch (e) {
            if (onAttempt)
                onAttempt(1, e, rawResponse);
            // Fall through to retry
        }
        // Attempt 2 (Retry 1)
        const retryPrompt = `${userPrompt}\n\n[SYSTEM]: Your previous response failed to parse as valid JSON. Ensure you ONLY output valid JSON conforming strictly to the requested schema. Do not wrap it in markdown blockticks if it breaks the parser. The parser error was: ${rawResponse.substring(0, 200)}...`;
        try {
            rawResponse = await this.callModel(systemPrompt, retryPrompt);
            const parsed = this.parseResponse(rawResponse, schema);
            if (onAttempt)
                onAttempt(2, undefined, rawResponse);
            return { ...parsed, rawResponse };
        }
        catch (e) {
            if (onAttempt)
                onAttempt(2, e, rawResponse);
            throw new Error(`Structured output parsing failed after 1 retry. Diagnostic: ${e.message}`);
        }
    }
    async callModel(systemPrompt, userPrompt) {
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
    parseResponse(rawText, schema) {
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
        return schema.parse(parsedJson);
    }
}
exports.GenericJSONProvider = GenericJSONProvider;
