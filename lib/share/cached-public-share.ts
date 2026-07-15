import { selectAnswerVisuals } from "@/lib/answer-assets/visuals";
import type { SharedAnswerResponse } from "@/lib/api/types";
import { classifyPromptProfile } from "@/lib/quick-questions/profiles";
import {
  SHARE_CACHE_TTL_SECONDS,
  createShareCacheKey,
  safeGetJson,
  safeSetJson,
} from "@/lib/cache/redis";
import { getPublicShareBySlug } from "./public-share";

export async function getCachedPublicShareBySlug(shareId: string) {
  const cacheKey = createShareCacheKey(shareId);
  const cachedResponse = await safeGetJson<SharedAnswerResponse>(cacheKey);

  if (cachedResponse) {
    return cachedResponse.share;
  }

  const share = await getPublicShareBySlug(shareId);

  if (!share) {
    return null;
  }

  const response: SharedAnswerResponse = {
    share: {
      ...share,
      visuals: selectAnswerVisuals({
        profile: classifyPromptProfile(share.question),
        question: share.question,
        answer: share.answer,
      }),
    },
  };

  await safeSetJson(cacheKey, response, SHARE_CACHE_TTL_SECONDS);

  return response.share;
}
