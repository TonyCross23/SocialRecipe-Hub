import type { PostRepository } from '../post.types.js';

export class ContentModerationService {
  constructor(private readonly repository: PostRepository) {}

  async evaluate(text: string) {
    const policy = await this.repository.getModerationPolicy();
    const normalizedText = text.toLocaleLowerCase();
    const matchedKeywords = policy.bannedKeywords.filter((keyword) =>
      normalizedText.includes(keyword.toLocaleLowerCase()),
    );

    return {
      status: matchedKeywords.length > 0 ? ('FLAGGED' as const) : ('PUBLISHED' as const),
      matchedKeywords,
      enqueueAiModeration: policy.enabled,
    };
  }
}
