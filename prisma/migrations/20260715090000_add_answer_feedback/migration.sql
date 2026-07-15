-- CreateEnum
CREATE TYPE "AnswerFeedbackReaction" AS ENUM ('up', 'down');

-- CreateEnum
CREATE TYPE "AnswerFeedbackReason" AS ENUM (
  'inaccurate',
  'outdated',
  'not_specific',
  'not_helpful',
  'hard_to_understand'
);

-- CreateTable
CREATE TABLE "answer_feedback" (
  "id" UUID NOT NULL,
  "assistant_message_id" UUID NOT NULL,
  "profile_id" UUID,
  "anonymous_session_id" UUID,
  "reaction" "AnswerFeedbackReaction" NOT NULL,
  "reason" "AnswerFeedbackReason",
  "comment" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "answer_feedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "answer_feedback_one_owner_check" CHECK (
    (CASE WHEN "profile_id" IS NULL THEN 0 ELSE 1 END) +
    (CASE WHEN "anonymous_session_id" IS NULL THEN 0 ELSE 1 END) = 1
  )
);

-- CreateIndex
CREATE UNIQUE INDEX "answer_feedback_assistant_message_id_profile_id_key"
  ON "answer_feedback"("assistant_message_id", "profile_id");
CREATE UNIQUE INDEX "answer_feedback_assistant_message_id_anonymous_session_id_key"
  ON "answer_feedback"("assistant_message_id", "anonymous_session_id");
CREATE INDEX "answer_feedback_assistant_message_id_created_at_idx"
  ON "answer_feedback"("assistant_message_id", "created_at");
CREATE INDEX "answer_feedback_reaction_reason_created_at_idx"
  ON "answer_feedback"("reaction", "reason", "created_at");

-- AddForeignKey
ALTER TABLE "answer_feedback" ADD CONSTRAINT "answer_feedback_assistant_message_id_fkey"
  FOREIGN KEY ("assistant_message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "answer_feedback" ADD CONSTRAINT "answer_feedback_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "answer_feedback" ADD CONSTRAINT "answer_feedback_anonymous_session_id_fkey"
  FOREIGN KEY ("anonymous_session_id") REFERENCES "anonymous_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
