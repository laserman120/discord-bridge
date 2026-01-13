import { ItemState, ChannelType, ContentType } from '../config/enums.js';
import { UtilityManager } from '../managers/utilityManager.js';

const modActionOptions = [
    "banuser", "unbanuser", "spamlink", "removelink", "approvelink", "spamcomment",
    "removecomment", "approvecomment", "addmoderator", "showcomment", "invitemoderator",
    "uninvitemoderator", "acceptmoderatorinvite", "removemoderator", "addcontributor",
    "removecontributor", "editsettings", "editflair", "distinguish", "marknsfw",
    "wikibanned", "wikicontributor", "wikiunbanned", "wikipagelisted",
    "removewikicontributor", "wikirevise", "wikipermlevel", "ignorereports",
    "unignorereports", "setpermissions", "setsuggestedsort", "sticky", "unsticky",
    "setcontestmode", "unsetcontestmode", "lock", "unlock", "muteuser", "unmuteuser",
    "createrule", "editrule", "reorderrules", "deleterule", "spoiler", "unspoiler",
    "modmail_enrollment", "community_styling", "community_widgets", "markoriginalcontent",
    "collections", "events", "create_award", "disable_award", "delete_award",
    "enable_award", "mod_award_given", "hidden_award", "add_community_topics",
    "remove_community_topics", "create_scheduled_post", "edit_scheduled_post",
    "delete_scheduled_post", "submit_scheduled_post", "edit_post_requirements",
    "invitesubscriber", "submit_content_rating_survey", "adjust_post_crowd_control_level",
    "enable_post_crowd_control_filter", "disable_post_crowd_control_filter",
    "deleteoverriddenclassification", "overrideclassification", "reordermoderators",
    "snoozereports", "unsnoozereports", "addnote", "deletenote", "addremovalreason",
    "createremovalreason", "updateremovalreason", "deleteremovalreason",
    "reorderremovalreason", "dev_platform_app_changed", "dev_platform_app_disabled",
    "dev_platform_app_enabled", "dev_platform_app_installed", "dev_platform_app_uninstalled"
].map(action => ({ label: action, value: action }));

export const publicNotificationGroup = {
    type: 'group' as const,
    label: 'Public Notifications',
    helpText: 'Configure notifications intended for public viewing (e.g., community Discord).',
    fields: [
        {
            type: 'string' as const,
            name: 'WEBHOOK_PUBLIC_NEW_POSTS',
            label: 'Public New Posts Webhook URL',
            required: false,
            scope: 'installation' as const,
            helpText: 'Channel for new submissions available to everyone. Updates on removal/deletion.',
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateWebhookUrl(value);
            }
        },
        {
            type: 'string' as const,
            name: 'NEW_PUBLIC_POST_MESSAGE',
            label: 'Pingable Message (Public)',
            defaultValue: 'New Post',
            scope: 'installation' as const,
            helpText: 'Custom text sent with the notification (e.g., @here New Post!).',
        },
        {
            type: 'boolean' as const,
            name: 'NEW_PUBLIC_POST_HIDE_NSFW_IMAGES',
            label: 'Do not show a preview image when a post is marked as NSFW',
            defaultValue: false,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'NEW_PUBLIC_POST_HIDE_SPOILER_IMAGE',
            label: 'Do not show a preview image when a post is marked as a Spoiler',
            defaultValue: false,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'NEW_PUBLIC_POST_HIDE_NSFW_BODY',
            label: 'Do not show a preview of the post text when a post is marked as NSFW',
            defaultValue: false,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'NEW_PUBLIC_POST_HIDE_SPOILER_BODY',
            label: 'Do not show a preview of the post text when a post is marked as a Spoiler',
            defaultValue: false,
            scope: 'installation' as const,
        },
    ]
};


export const newPostsGroup = {
    type: 'group' as const,
    label: 'Private New Post Notifications',
    helpText: 'Configure internal notifications for the mod team.',
    fields: [
        {
            type: 'string' as const,
            name: 'WEBHOOK_NEW_POSTS',
            label: 'New Posts Webhook URL',
            required: false,
            scope: 'installation' as const,
            helpText: `Channel for new submissions (${ChannelType.NewPosts}).`,
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateWebhookUrl(value);
            }
        },
        {
            type: 'string' as const,
            name: 'NEW_POST_MESSAGE',
            label: 'Pingable Message (Mods)',
            defaultValue: 'New Post',
            scope: 'installation' as const,
            helpText: 'Custom text sent with the notification.',
        },
    ]
};

export const removalGroup = {
    type: 'group' as const,
    label: 'Removal Settings',
    helpText: 'Configure how removals are handled and notified.',
    fields: [
        {
            type: 'string' as const,
            name: 'WEBHOOK_REMOVALS',
            label: 'Removals Webhook URL',
            required: false,
            scope: 'installation' as const,
            helpText: `Channel for removal notifications (${ChannelType.Removals}).`,
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateWebhookUrl(value);
            }
        },
        {
            type: 'string' as const,
            name: 'REMOVE_MESSAGE_MODERATOR',
            label: 'Moderator Removal Message',
            defaultValue: 'REMOVED by Moderator',
            scope: 'installation' as const,
            helpText: 'Text displayed when content is removed by a human moderator.',
        },
        {
            type: 'string' as const,
            name: 'REMOVE_MESSAGE_AUTOMATIC',
            label: 'Automatic Removal Message',
            defaultValue: 'REMOVED Automatically',
            scope: 'installation' as const,
            helpText: 'Text displayed when content is removed by AutoMod/Filters.',
        },
        {
            type: 'string' as const,
            name: 'REMOVE_MESSAGE_ADMIN',
            label: 'Admin Removal Message',
            defaultValue: ' REMOVED by Reddit Admin (@here)',
            scope: 'installation' as const,
            helpText: 'Text displayed when content is removed by Reddit Administrators.',
        },
        {
            type: 'select' as const,
            name: 'AUTOMATIC_REMOVALS_USERS',
            label: 'Users treated as Automatic',
            options: [
                { label: 'AutoModerator', value: 'automoderator' },
                { label: 'reddit', value: 'reddit' },
            ],
            multiSelect: true,
            defaultValue: ['automoderator', 'reddit'],
            scope: 'installation' as const,
            helpText: 'Select which accounts should trigger the "Automatic Removal" message style. Please check the ReadMe for more information',
        },
        {
            type: 'string' as const,
            name: 'AUTOMATIC_REMOVALS_USERS_CUSTOM',
            label: 'Custom users which removals will be treated as automatic removals',
            defaultValue: 'ExampleBot; ExampleBot2',
            required: false,
            scope: 'installation' as const,
            helpText: `Here you can enter custom usernames which will be treated as automatic, useful if you have other apps running on your subreddit you dont fully trust.`,
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateUsernameList(value)
            }
        },
    ]
};

export const reportGroup = {
    type: 'group' as const,
    label: 'Report Settings',
    helpText: 'Configure how reports are handled and notified.',
    fields: [
        {
            type: 'string' as const,
            name: 'WEBHOOK_REPORTS',
            label: 'Reports Webhook URL',
            required: false,
            scope: 'installation' as const,
            helpText: `Channel that sends messages when an item is reported.`,
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateWebhookUrl(value);
            }
        },
        {
            type: 'string' as const,
            name: 'REPORT_MESSAGE',
            label: 'Pingable Report Message',
            defaultValue: 'New Report',
            scope: 'installation' as const,
            helpText: 'Custom text sent with notification',
        },
    ]
};

export const modmailGroup = {
    type: 'group' as const,
    label: 'ModMail Settings',
    helpText: 'Configure how ModMail is handled and notified.',
    fields: [
        {
            type: 'string' as const,
            name: 'WEBHOOK_MODMAIL',
            label: 'Modmail Webhook URL',
            required: false,
            scope: 'installation' as const,
            helpText: `Channel for any new modmail messages`,
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateWebhookUrl(value);
            }
        },
        {
            type: 'string' as const,
            name: 'MODMAIL_MESSAGE',
            label: 'Pingable Modmail Message',
            defaultValue: 'New Modmail Message (@here)',
            scope: 'installation' as const,
            helpText: 'Custom text sent with notification',
        },
    ]
};

export const modlogGroup = {
    type: 'group' as const,
    label: 'ModLog Settings',
    helpText: 'Configure how ModLog notifications are handled and notified.',
    fields: [
        {
            type: 'string' as const,
            name: 'WEBHOOK_MODLOG',
            label: 'ModLog Webhook URL',
            required: false,
            scope: 'installation' as const,
            helpText: `Channel for modlog entries`,
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateWebhookUrl(value);
            }
        },
        {
            type: 'string' as const,
            name: 'MODLOG_MESSAGE',
            label: 'Pingable ModLog Message',
            defaultValue: 'New Mod Log Entry',
            scope: 'installation' as const,
            helpText: 'Custom text sent with notification',
        },
        {
            type: 'select' as const,
            name: 'MODLOG_ACTIONS',
            label: 'Mod Log Actions to Notify',
            options: modActionOptions,
            multiSelect: true,
            defaultValue: modActionOptions.map(opt => opt.value),
            scope: 'installation' as const,
            helpText: 'Select which Mod Log actions should trigger a notification.',
        },
        {
            type: 'paragraph' as const,
            name: 'MODLOG_CUSTOM_MESSAGES',
            label: 'Custom Mod Log Messages (JSON)',
            helpText: 'JSON list to override the default message for specific actions. Example: [{"action": "banuser", "message": "@here User Banned!"}]',
            defaultValue: JSON.stringify([{ "action": "banuser", "message": "**New ban has been issued**" }], null, 2),
            scope: 'installation' as const,
            onValidate: async ({ value }: { value?: string }) => {
                if (!value) return undefined;
                try {
                    const parsed = JSON.parse(value);
                    if (!Array.isArray(parsed)) return "Must be a JSON Array";
                    for (const item of parsed) {
                        if (!item.action || !item.message) return "Items must have 'action' and 'message' fields";
                    }
                } catch { return "Invalid JSON"; }
                return undefined;
            }
        }
    ]
};

export const flairWatchConfigField = {
    type: 'paragraph' as const,
    name: 'FLAIR_WATCH_CONFIG',
    label: 'Flair Watch Configuration (JSON)',
    helpText: 'Here you can define Flairs to trigger notifications. Copy the default value as a template. See ReadMe for more info.',
    defaultValue: JSON.stringify([
        {
            "flair": "NonExistentFlair_Example",
            "post": true,
            "comment": false,
            "webhook": "https://discord.com/api/webhooks/1234567890/example_token_replace_me",
            "publicFormat": false
        }
    ], null, 2),
    scope: 'installation' as const,
    onValidate: async ({ value }: { value?: string }) => {
        return UtilityManager.validateFlairConfig(value);
    }
};

export const moderatorWatchConfigGrup = {
    type: 'group' as const,
    label: 'Moderator Watching Settings',
    helpText: 'Configure the Moderator notification system.',
    fields: [
        {
            type: 'string' as const,
            name: 'MOD_ACTIVITY_WEBHOOK',
            label: 'Moderator Watching Webhook URL',
            required: false,
            scope: 'installation' as const,
            helpText: `Channel for modlog entries`,
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateWebhookUrl(value);
            }
        },
        {
            type: 'boolean' as const,
            name: 'MOD_ACTIVITY_CHECK_POSTS',
            label: 'Notify when a moderator submits a new post',
            defaultValue: false,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'MOD_ACTIVITY_CHECK_COMMENTS',
            label: 'Notify when a moderator submits a new comment',
            defaultValue: false,
            scope: 'installation' as const,
        },
        {
            type: 'string' as const,
            name: 'MOD_ACTIVITY_MESSAGE',
            label: 'Pingable new moderator notification message',
            defaultValue: 'New Moderator Activity',
            scope: 'installation' as const,
            helpText: 'Custom text sent with notification',
        }
    ]
}

export const modAbuseGroup = {
    type: 'group' as const,
    label: 'Mod Abuse Warning System',
    helpText: 'Configure automatic warnings for high volumes of mod actions.',
    fields: [
        {
            type: 'string' as const,
            name: 'MOD_ABUSE_MESSAGE',
            label: 'Pingable Mod Abuse Message',
            defaultValue: '**Possible Mod Abuse Warning** @here',
            scope: 'installation' as const,
            helpText: 'Custom text sent with notification',
        },
        {
            type: 'number' as const,
            name: 'MOD_ABUSE_TIMEFRAME',
            label: 'Timeframe (Minutes)',
            defaultValue: 10,
            scope: 'installation' as const,
            helpText: 'The rolling window of time to count actions (e.g., 10 minutes).',
        },
        {
            type: 'number' as const,
            name: 'MOD_ABUSE_THRESHOLD',
            label: 'Action Threshold',
            defaultValue: 20,
            scope: 'installation' as const,
            helpText: 'Number of actions within the timeframe to trigger a warning.',
        },
        {
            type: 'select' as const,
            name: 'MOD_ABUSE_ACTIONS',
            label: 'Monitored Actions',
            options: modActionOptions,
            multiSelect: true,
            defaultValue: ['banuser', 'removelink', 'spamlink', 'removecomment'],
            scope: 'installation' as const,
            helpText: 'Select which actions count towards the abuse threshold.',
        },
        {
            type: 'string' as const,
            name: 'WEBHOOK_MOD_ABUSE',
            label: 'Warning Webhook URL',
            scope: 'installation' as const,
            helpText: 'Webhook URL where abuse warnings will be sent.'
        }
    ]
};

export const customizationGroup = {
    type: 'group' as const,
    label: 'Appearance',
    fields: [
        {
            type: 'string' as const,
            name: 'publicPostColorCode',
            label: 'Public Post Color (Hex)',
            defaultValue: '#71c7d6', 
            scope: 'installation' as const,
            helpText: 'Color code for PUBLIC content. Will not change state',
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateHexColor(value);
            }
        },
        {
            type: 'string' as const,
            name: 'liveColorCode',
            label: 'Live Post Color',
            defaultValue: '#71c7d6', 
            scope: 'installation' as const,
            helpText: 'Color code for LIVE content.',
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateHexColor(value);
            }
        },
        {
            type: 'string' as const,
            name: 'approvedColorCode',
            label: 'Approved Post Color',
            defaultValue: '#2ECC71',
            scope: 'installation' as const,
            helpText: 'Color code for APPROVED content.',
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateHexColor(value);
            }
        },
        {
            type: 'string' as const,
            name: 'removedColorCode',
            label: 'Removed Post Color',
            defaultValue: '#E74C3C',
            scope: 'installation' as const,
            helpText: 'Color code for confirmed REMOVED content.',
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateHexColor(value);
            }
        },
        {
            type: 'string' as const,
            name: 'spamColorCode',
            label: 'Spam Removal Post Color',
            defaultValue: '#E74C3C',
            scope: 'installation' as const,
            helpText: 'Color code for content removed due to SPAM.',
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateHexColor(value);
            }
        },
        {
            type: 'string' as const,
            name: 'deletedColorCode',
            label: 'Deleten Post Color',
            defaultValue: '#808080', 
            scope: 'installation' as const,
            helpText: 'Color code for content which has been DELETED.',
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateHexColor(value);
            }
        },
        {
            type: 'string' as const,
            name: 'awaitingReviewColorCode',
            label: 'Awaiting Review Post Color',
            defaultValue: '#E67E22', 
            scope: 'installation' as const,
            helpText: 'Color code for content which has been automatically REMOVED and requires review.',
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateHexColor(value);
            }
        },
        {
            type: 'string' as const,
            name: 'unhandledReportColorCode',
            label: 'Unhandled Report Post Color',
            defaultValue: '#E67E22', 
            scope: 'installation' as const,
            helpText: 'Color code for content which has been REPORTED and not yet reviewed.',
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateHexColor(value);
            }
        },
    ]
};

export const modMailCustomizationGroup = {
    type: 'group' as const,
    label: 'ModMail Appearance',
    fields: [
        {
            type: 'string' as const,
            name: 'newModMailColorCode',
            label: 'New ModMail Post Color',
            defaultValue: '#3498DB', 
            scope: 'installation' as const,
            helpText: 'Color code for NEW ModMail conversations.',
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateHexColor(value);
            }
        },
        {
            type: 'string' as const,
            name: 'answeredModMailColorCode',
            label: 'Answered ModMail Post Color',
            defaultValue: '#2ECC71', 
            scope: 'installation' as const,
            helpText: 'Color code for ModMail conversations that have been ANSWERED by a moderator.',
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateHexColor(value);
            }
        },
        {
            type: 'string' as const,
            name: 'newReplyModMailColorCode',
            label: 'New Reply ModMail Post Color',
            defaultValue: '#9B59B6',
            scope: 'installation' as const,
            helpText: 'Color code for ModMail conversations that recieved a new reply by the user',
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateHexColor(value);
            }
        },
        {
            type: 'string' as const,
            name: 'archivedModMailColorCode',
            label: 'Archived ModMail Post Color',
            defaultValue: '#2ECC71',
            scope: 'installation' as const,
            helpText: 'Color code for Archived ModMail conversations.',
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateHexColor(value);
            }
        },
    ]
};