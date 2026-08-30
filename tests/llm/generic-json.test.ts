import { describe, it, expect, vi, beforeEach } from "vitest";
import { GenericJSONProvider } from "../../src/llm/generic-json";
import { z } from "zod";

const TestSchema = z.object({
  summary: z.string(),
  findings: z.array(z.any()),
});

describe("GenericJSONProvider", () => {
  let provider: GenericJSONProvider;
  
  beforeEach(() => {
    provider = new GenericJSONProvider();
    provider.init({ apiKey: "test", provider: "gemini", model: "gemini-2.5-pro" });
  });

  it("should parse valid JSON successfully on first attempt", async () => {
    const validJson = `\`\`\`json\n{"summary": "Test", "findings": []}\n\`\`\``;
    
    // Mock callModel to return valid JSON
    (provider as any).callModel = vi.fn().mockResolvedValue(validJson);

    const onAttempt = vi.fn();
    const result = await provider.generateReview("sys", "user", TestSchema, onAttempt);

    expect(result.summary).toBe("Test");
    expect(result.findings).toEqual([]);
    expect(onAttempt).toHaveBeenCalledTimes(1);
    expect(onAttempt).toHaveBeenCalledWith(1, undefined, validJson);
  });

  it("should retry once on invalid JSON and succeed", async () => {
    const invalidJson = `This is not JSON`;
    const validJson = `{"summary": "Fixed", "findings": []}`;
    
    (provider as any).callModel = vi.fn()
      .mockResolvedValueOnce(invalidJson)
      .mockResolvedValueOnce(validJson);

    const onAttempt = vi.fn();
    const result = await provider.generateReview("sys", "user", TestSchema, onAttempt);

    expect(result.summary).toBe("Fixed");
    expect(onAttempt).toHaveBeenCalledTimes(2);
    expect(onAttempt).toHaveBeenNthCalledWith(1, 1, expect.any(Error), invalidJson);
    expect(onAttempt).toHaveBeenNthCalledWith(2, 2, undefined, validJson);
  });

  it("should fail completely if retry also fails", async () => {
    const invalidJson1 = `Still not JSON`;
    const invalidJson2 = `Nope`;
    
    (provider as any).callModel = vi.fn()
      .mockResolvedValueOnce(invalidJson1)
      .mockResolvedValueOnce(invalidJson2);

    const onAttempt = vi.fn();
    
    await expect(provider.generateReview("sys", "user", TestSchema, onAttempt))
      .rejects.toThrow(/Structured output parsing failed after 1 retry/);

    expect(onAttempt).toHaveBeenCalledTimes(2);
    expect(onAttempt).toHaveBeenNthCalledWith(1, 1, expect.any(Error), invalidJson1);
    expect(onAttempt).toHaveBeenNthCalledWith(2, 2, expect.any(Error), invalidJson2);
  });
});
