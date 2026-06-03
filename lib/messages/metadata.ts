import type { AnswerVisuals } from "@/lib/api/types";
import { isPromptProfile } from "@/lib/quick-questions/profiles";
import { findQuickQuestionById } from "@/lib/quick-questions/questions";
import { getQuickQuestionMenu } from "@/lib/quick-questions/menus";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isVisualCard(value: unknown): value is NonNullable<AnswerVisuals["cards"]>[number] {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.type === "phrase" ||
      value.type === "warning" ||
      value.type === "backup" ||
      value.type === "checklist") &&
    typeof value.title === "string" &&
    typeof value.body === "string"
  );
}

export function readAnswerVisuals(metadata: unknown): AnswerVisuals | undefined {
  if (!isRecord(metadata) || !isRecord(metadata.visuals)) {
    return undefined;
  }

  const visuals = metadata.visuals;
  const heroAssetId =
    typeof visuals.heroAssetId === "string" ? visuals.heroAssetId : undefined;
  const inlineAssetIds = Array.isArray(visuals.inlineAssetIds)
    ? visuals.inlineAssetIds.filter((assetId): assetId is string => typeof assetId === "string")
    : undefined;
  const embeddedAssetIds = Array.isArray(visuals.embeddedAssetIds)
    ? visuals.embeddedAssetIds.filter((assetId): assetId is string => typeof assetId === "string")
    : undefined;
  const cards = Array.isArray(visuals.cards)
    ? visuals.cards.filter(isVisualCard)
    : undefined;

  if (
    !heroAssetId &&
    !inlineAssetIds?.length &&
    !embeddedAssetIds?.length &&
    !cards?.length
  ) {
    return undefined;
  }

  return {
    heroAssetId,
    inlineAssetIds: inlineAssetIds?.length ? inlineAssetIds : undefined,
    embeddedAssetIds: embeddedAssetIds?.length ? embeddedAssetIds : undefined,
    cards: cards?.length ? cards : undefined,
  };
}

export function readPromptProfile(metadata: unknown) {
  if (!isRecord(metadata)) {
    return undefined;
  }

  return isPromptProfile(metadata.promptProfile)
    ? metadata.promptProfile
    : undefined;
}

export function readQuickQuestionMenu(metadata: unknown) {
  if (!isRecord(metadata) || metadata.type !== "quick_question_menu") {
    return undefined;
  }

  const quickQuestion = findQuickQuestionById(metadata.sourceQuestionId);
  const promptProfile = readPromptProfile(metadata);

  if (!quickQuestion || !promptProfile) {
    return undefined;
  }

  const menu = getQuickQuestionMenu(quickQuestion.id);

  if (menu.promptProfile !== promptProfile) {
    return undefined;
  }

  return {
    sourceQuestionId: menu.sourceQuestionId,
    promptProfile: menu.promptProfile,
    subQuestions: menu.subQuestions,
  };
}

export function readAnswerCompletionStatus(metadata: unknown): {
  truncated: boolean;
  maybeTruncated: boolean;
  finishReason: string | null;
} {
  if (!isRecord(metadata)) {
    return {
      truncated: false,
      maybeTruncated: false,
      finishReason: null,
    };
  }

  const finishReason =
    typeof metadata.finishReason === "string" ? metadata.finishReason : null;

  return {
    truncated: metadata.truncated === true || finishReason === "length",
    maybeTruncated: metadata.maybeTruncated === true,
    finishReason,
  };
}

export function createGenerationMetadata(metadata: unknown) {
  const promptProfile = readPromptProfile(metadata);

  return promptProfile ? { promptProfile } : undefined;
}
