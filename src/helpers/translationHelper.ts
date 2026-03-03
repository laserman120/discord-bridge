import { DevvitContext } from '../types/context.js';
import { TranslationKey } from '../config/enums.js';

export class TranslationHelper {
    private static readonly DEFAULTS: Record<string, string> = {
        // Labels
    [TranslationKey.LABEL_AUTHOR]: "**Author:** u/{{author}}",
    [TranslationKey.LABEL_AGE]: "**Age:** {{age}}",
    [TranslationKey.LABEL_USER_FLAIR]: "**User Flair:** {{flair}}",
    [TranslationKey.LABEL_POST_FLAIR]: "**Post Flair:** {{flair}}",
    [TranslationKey.LABEL_WARNING]: "**Warning:** {{warning}}",
    [TranslationKey.LABEL_CROSSPOST]: "**Crosspost From:** [r/{{sub}}]({{url}})",
    [TranslationKey.LABEL_REPORTS_WITH_REASONS]: "**Reports:** {{count}} ({{reasons}})",
    [TranslationKey.LABEL_REPORTS_COUNT_ONLY]: "**Reports:** {{count}}",
    [TranslationKey.LABEL_REMOVAL_REASON]: "**Removal Reason:** {{reason}}",
    [TranslationKey.LABEL_BANNED]: "⚠️ **(Banned)**",
    [TranslationKey.LABEL_META_USER]: "**User:** u/{{user}}",
    [TranslationKey.LABEL_META_STATUS]: "**Status:** {{status}}",
    [TranslationKey.LABEL_META_ID]: "**ID:** {{id}}",
    [TranslationKey.META_SEPARATOR]: " • ",

    // Karma Templates
    [TranslationKey.KARMA_TOTAL]: "Total: {{val}}",
    [TranslationKey.KARMA_POST]: "P: {{val}}",
    [TranslationKey.KARMA_COMMENT]: "C: {{val}}",
    [TranslationKey.KARMA_GLOBAL_HEADER]: "**Global Karma:**",
    [TranslationKey.KARMA_SUB_HEADER]: "**Subreddit Karma:**",

    // Status Line Templates
    [TranslationKey.STATUS_LINE_WITH_BY]: "**Status:** {{status}} • **Action:** {{action}} by {{user}}",
    [TranslationKey.STATUS_LINE_SIMPLE]: "**Status:** {{status}} • **Action:** {{action}}",

    // States (statusText)
    [TranslationKey.STATE_APPROVED]: "✅ Approved",
    [TranslationKey.STATE_REMOVED]: "🔴 Removed",
    [TranslationKey.STATE_SPAM]: "🔴 Removed (Spam)",
    [TranslationKey.STATE_AWAITING_REVIEW]: "⏳ Awaiting Review",
    [TranslationKey.STATE_DELETED]: "🗑️ Deleted",
    [TranslationKey.STATE_LIVE]: "🟢 Live",
    [TranslationKey.STATE_REPORTED]: "⚠️ Reported",

    // Actions (actionText)
    [TranslationKey.ACTION_APPROVED]: "Approved",
    [TranslationKey.ACTION_REMOVED]: "Removed",
    [TranslationKey.ACTION_IDENTIFIED_SPAM]: "Identified as Spam",
    [TranslationKey.ACTION_AUTO_REMOVED]: "Auto-Removed",
    [TranslationKey.ACTION_DELETED_BY_USER]: "Deleted by User/Reddit",
    [TranslationKey.ACTION_NONE]: "None",
    [TranslationKey.ACTION_AWAITING_REVIEW]: "Awaiting Review",

    // Content Placeholders
    [TranslationKey.TEXT_HIDDEN_NSFW]: "*[Hidden due to potential NSFW content]*",
    [TranslationKey.TEXT_HIDDEN_SPOILER]: "*[Hidden due to potential Spoilers]*",
    [TranslationKey.TEXT_COMMENT_BY]: "Comment by {{author}}",
    [TranslationKey.TEXT_IMAGE_POST]: "_Image post_",
    [TranslationKey.TEXT_NO_CONTENT]: "No content.",
    [TranslationKey.LABEL_PERMALINK_FOOTER]: "r/{{sub}} • <t:{{time}}:f>",
    [TranslationKey.TEXT_NO_USERNAME]: "Unknown User",
    [TranslationKey.TEXT_REMOVED_SILENTLY_BY_REDDIT_REASON]: "Item was silently removed or marked as spam by Reddit.",
    [TranslationKey.TEXT_REMOVED_SILENTLY_BY_REDDIT]: "Reddit Filter",

    // Buttons
    [TranslationKey.BUTTON_POST]: "Post",
    [TranslationKey.BUTTON_COMMENT]: "Comment",
    [TranslationKey.BUTTON_AUTHOR]: "Author",
    [TranslationKey.BUTTON_ARCTIC_SHIFT]: "Author A-S",
    [TranslationKey.BUTTON_OPEN_QUEUE]: "Open Queue",
    [TranslationKey.BUTTON_OPEN_MODMAIL]: "Open Modmail",
    [TranslationKey.BUTTON_AUTHOR_MODMAIL]: "User Profile",

    // Modmail
    [TranslationKey.MODMAIL_NEW]: "New Modmail",
    [TranslationKey.MODMAIL_REPLIED]: "Replied",
    [TranslationKey.MODMAIL_ARCHIVED]: "Archived",
    [TranslationKey.MODMAIL_NEW_REPLY]: "New Reply",
    [TranslationKey.MODMAIL_SUBJECT_HEADER]: "{{subject}}",
    [TranslationKey.MODMAIL_MOD_REPLIED]: "Moderator Replied: u/{{user}}",
    [TranslationKey.MODMAIL_USER_REPLIED]: "User Replied: u/{{user}}",
    [TranslationKey.MODMAIL_NO_SUBJECT]: "(No Subject)"
    };

    /**
     * Used to populate the setting default value
     */
    static getDefaults(): Record<string, string> {
        return this.DEFAULTS;
    }

    /**
     * Fetches a translated string.
     * @param key The TranslationKey to look up
     * @param context The Devvit context (to access settings)
     * @param vars Optional variables to replace in the string (e.g. { user: 'name' })
     */
    static async t(key: TranslationKey, context: DevvitContext, vars?: Record<string, string | number>): Promise<string> {
        let template = this.DEFAULTS[key] || `[[${key}]]`;

        try {
            const customJson = await context.settings.get<string>('TRANSLATION_OVERRIDES_JSON');
            if (customJson) {
                const overrides = JSON.parse(customJson);
                if (overrides[key]) {
                    template = overrides[key];
                }
            }
        } catch (e) {
            // Fallback to default if JSON is malformed
            console.log(`[TranslationHelper] Failed to parse custom translations JSON: ${e}`);
        }

        if (!vars) return template;

        // Replace {{variable}} with the value provided
        return Object.entries(vars).reduce((str, [vKey, vVal]) => {
            return str.replace(new RegExp(`{{${vKey}}}`, 'g'), String(vVal));
        }, template);
    }

    // Generates a regex from a translation template, treating {{variables}} as wildcards
    // Used For the ModMail state update
    static async getRegexFor(key: TranslationKey, context: DevvitContext): Promise<RegExp> {
        const template = await this.t(key, context);
        // Escape special regex characters like * or [ ] but keep {{variables}} as wildcards
        const escaped = template
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex chars
            .replace(/\\\{\\\{.*?\\\}\\\}/g, '.*'); // Replace {{var}} with wildcard '.*'
        
        return new RegExp(escaped, 'g');
    }
}