CREATE TABLE "life_os"."activity_templates" (
  "key" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "why" text,
  "category" text NOT NULL,
  "default_schedule_rrule" text NOT NULL,
  "default_local_target_time" text NOT NULL,
  "default_available_offset_minutes" integer NOT NULL,
  "default_opportunity_end_offset_minutes" integer NOT NULL,
  "default_tracking_mode" text NOT NULL,
  "default_completion_mode" text NOT NULL,
  "default_approval_mode" text NOT NULL,
  "default_progress_mode" text NOT NULL,
  "default_xp_mode" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "life_os"."activity_templates" (
  "key",
  "title",
  "description",
  "why",
  "category",
  "default_schedule_rrule",
  "default_local_target_time",
  "default_available_offset_minutes",
  "default_opportunity_end_offset_minutes",
  "default_tracking_mode",
  "default_completion_mode",
  "default_approval_mode",
  "default_progress_mode",
  "default_xp_mode"
) VALUES (
  'SELF_MAKE_BED',
  'Make your bed',
  'Make the bed and leave the sleeping space ready for the day.',
  'Caring for your own space is part of becoming more independent.',
  'SELF_RESPONSIBILITY',
  'FREQ=DAILY',
  '07:30',
  -90,
  150,
  'ROUTINE',
  'SELF_CONFIRM',
  'NONE',
  'INDEPENDENCE',
  'TRAINING_ONLY'
)
ON CONFLICT ("key") DO NOTHING;
