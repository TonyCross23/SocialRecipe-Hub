import { z } from '../../../shared/zod.js';

const moderationResponseDto = z.object({
  results: z
    .array(
      z.object({
        flagged: z.boolean(),
        categories: z.record(z.string(), z.boolean()),
      }),
    )
    .min(1),
});

export interface AiModerationResult {
  flagged: boolean;
  categories: string[];
}

export interface AiModerationService {
  check(text: string): Promise<AiModerationResult>;
}

export class OpenAiModerationService implements AiModerationService {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async check(text: string): Promise<AiModerationResult> {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: this.model, input: text }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`OpenAI moderation request failed with status ${response.status}`);
    }

    const result = moderationResponseDto.parse(await response.json()).results[0]!;
    return {
      flagged: result.flagged,
      categories: Object.entries(result.categories)
        .filter(([, matched]) => matched)
        .map(([category]) => category),
    };
  }
}
