export enum ItemState {
    Live = 'LIVE',
    Removed = 'REMOVED',
    Approved = 'APPROVED',
    Deleted = 'DELETED',
    Spam = 'SPAM',
    Awaiting_Review = 'AWAITING_REVIEW',
    Unhandled_Report = 'UNHANDLED_REPORT',
    Public_Post = 'PUBLIC_POST',
    New_Modmail = 'NEW_MODMAIL',
    Answered_Modmail = 'ANSWERED_MODMAIL',
    New_Reply_Modmail = 'NEW_REPLY_MODMAIL',
    Archived_Modmail = 'ARCHIVED_MODMAIL',
}

export enum ChannelType {
    PublicNewPosts = 'PUBLIC_NEW_POSTS_CHANNEL',
    NewPosts = 'NEW_POSTS_CHANNEL',
    Reports = 'REPORTS_CHANNEL',
    Removals = 'REMOVALS_CHANNEL',
    ModMail = 'MODMAIL_CHANNEL',
    ModLog = 'MODLOG_CHANNEL',
    FlairWatch = 'FLAIR_WATCH_CHANNEL',
    PublicFlairWatch = 'PUBLIC_FLAIR_WATCH_CHANNEL',
    ModActivity = 'MOD_ACTIVITY_CHANNEL',
    ModQueue = 'MOD_QUEUE_CHANNEL',
}
export enum ContentType {
    Post = 'POST',
    Comment = 'COMMENT',
    Modmail = 'MODMAIL',
}

export enum TranslationKey {
    // Labels & Headers
    LABEL_AUTHOR = 'label_author',
    LABEL_AGE = 'label_age',
    LABEL_USER_FLAIR = 'label_user_flair',
    LABEL_POST_FLAIR = 'label_post_flair',
    LABEL_WARNING = 'label_warning',
    LABEL_CROSSPOST = 'label_crosspost',
    LABEL_REPORTS_WITH_REASONS = 'label_reports',
    LABEL_REPORTS_COUNT_ONLY = 'label_reports_count_only',    // "Reports: {{count}}"
    LABEL_REMOVAL_REASON = 'label_removal_reason',
    LABEL_BANNED = 'label_banned',
    LABEL_META_USER = 'label_meta_user',     // "**User:** u/{{user}}"
    LABEL_META_STATUS = 'label_meta_status', // "**Status:** {{status}}"
    LABEL_META_ID = 'label_meta_id',         // "**ID:** {{id}}"
    META_SEPARATOR = 'meta_separator',       // " • "

    KARMA_TOTAL = 'karma_total',     // "Total: {{val}}"
    KARMA_POST = 'karma_post',       // "P: {{val}}"
    KARMA_COMMENT = 'karma_comment', // "C: {{val}}"
    KARMA_GLOBAL_HEADER = 'karma_global_header', // "**Global Karma:**"
    KARMA_SUB_HEADER = 'karma_sub_header', // "**Subreddit Karma:**"

    // Status Line Templates (The "Glue")
    // Use these to define the sentence structure
    STATUS_LINE_WITH_BY = 'status_line_with_by', // "Status: {{status}} • Action: {{action}} by {{user}}"
    STATUS_LINE_SIMPLE = 'status_line_simple',   // "Status: {{status}} • Action: {{action}}"

    // Item States (Used for statusText)
    STATE_APPROVED = 'state_approved',
    STATE_REMOVED = 'state_removed',
    STATE_SPAM = 'state_spam',
    STATE_AWAITING_REVIEW = 'state_awaiting_review',
    STATE_DELETED = 'state_deleted',
    STATE_LIVE = 'state_live',
    STATE_REPORTED = 'state_reported',

    // Action Texts (Used for actionText)
    ACTION_APPROVED = 'action_approved',
    ACTION_REMOVED = 'action_removed',
    ACTION_IDENTIFIED_SPAM = 'action_identified_spam',
    ACTION_AUTO_REMOVED = 'action_auto_removed',
    ACTION_DELETED_BY_USER = 'action_deleted_by_user',
    ACTION_NONE = 'action_none',
    ACTION_AWAITING_REVIEW = 'action_awaiting_review',

    // Content Placeholders
    TEXT_HIDDEN_NSFW = 'text_hidden_nsfw',
    TEXT_HIDDEN_SPOILER = 'text_hidden_spoiler',
    TEXT_COMMENT_BY = 'text_comment_by',
    TEXT_IMAGE_POST = 'text_image_post',
    TEXT_NO_CONTENT = 'text_no_content',
    LABEL_PERMALINK_FOOTER = 'label_permalink_footer', // "r/{{sub}} • <t:{{time}}:f>"
    TEXT_NO_USERNAME = 'text_no_username', // "Unknown User"
    TEXT_REMOVED_SILENTLY_BY_REDDIT_REASON = 'text_removed_silently_by_reddit_reason', // "Item was silently removed or marked as spam by Reddit."
    TEXT_REMOVED_SILENTLY_BY_REDDIT = "text_removed_silently_by_reddit", 

    // Buttons
    BUTTON_POST = 'button_post',
    BUTTON_COMMENT = 'button_comment',
    BUTTON_AUTHOR = 'button_author',
    BUTTON_ARCTIC_SHIFT = 'button_arctic_shift',
    BUTTON_OPEN_QUEUE = 'button_open_queue',
    BUTTON_OPEN_MODMAIL = 'button_open_modmail',
    BUTTON_AUTHOR_MODMAIL = 'button_author_modmail',

    // Modmail Specific
    MODMAIL_NEW = 'modmail_new',
    MODMAIL_REPLIED = 'modmail_replied',
    MODMAIL_ARCHIVED = 'modmail_archived',
    MODMAIL_NEW_REPLY = 'modmail_new_reply',
    MODMAIL_SUBJECT_HEADER = 'modmail_subject_header',
    MODMAIL_MOD_REPLIED = 'modmail_mod_replied',
    MODMAIL_USER_REPLIED = 'modmail_user_replied',
    MODMAIL_NO_SUBJECT = 'modmail_no_subject',
}