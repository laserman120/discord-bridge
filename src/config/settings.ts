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

export const appNotificationGroup = {
    type: 'group' as const,
    label: 'App Notifications',
    helpText: 'Configure notifications regarding the Discord Bridge App. These will be sent to the ModMail of your subreddit.',
    fields: [
        {
            type: 'boolean' as const,
            name: 'ENABLE_UPDATE_NOTIFICATIONS',
            label: 'If enabled the app will send a notification when a new update is released',
            defaultValue: true,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'ENABLE_NEWS_NOTIFICATIONS',
            label: 'If enabled the app will send a notification when an announcement regarding the app is made',
            defaultValue: true,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'ALLOW_NOTIFICATIONS_IN_DISCORD',
            label: 'If enabled the notifications can create a discord message in the ModMail channel (If enabled)',
            defaultValue: true,
            scope: 'installation' as const,
        },
    ]
}

export const publicMessageCustomizationGroup = {
    type: 'group' as const,
    label: 'Public Message Configuration',
    helpText: 'Configure how notifications intended for public viewing are displayed.',
    fields: [
        {
            type: 'boolean' as const,
            name: 'PUBLIC_SHOW_DEFAULT_ICON',
            label: 'Will use the default Discord Bridge icon for the Webhook Avatar ( Overrides manually set icons )',
            defaultValue: true,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'PUBLIC_DISPLAY_MORE_BODY',
            label: 'Will increase the maximum size of the body preview text (From 400 characters to 1000)',
            defaultValue: false,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'PUBLIC_SHOW_NSFW_IMAGES',
            label: 'Show a preview image even if a post is marked as NSFW',
            defaultValue: true,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'PUBLIC_SHOW_SPOILER_IMAGE',
            label: 'Show a preview image even if a post is marked as a Spoiler',
            defaultValue: true,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'PUBLIC_SHOW_NSFW_BODY',
            label: 'Show a preview of the post text even if a post is marked as NSFW',
            defaultValue: true,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'PUBLIC_SHOW_SPOILER_BODY',
            label: 'Show a preview of the post text even if a post is marked as a Spoiler',
            defaultValue: true,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'PUBLIC_SHOW_AUTHOR',
            label: 'Show the name of the Author in public posts',
            defaultValue: true,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'PUBLIC_SHOW_FLAIR',
            label: 'Show the selected post flair in public posts',
            defaultValue: true,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'PUBLIC_SHOW_CONTENT_WARNING',
            label: 'Show the content warning (Spoiler|NSFW) in public posts',
            defaultValue: true,
            scope: 'installation' as const,
        },
    ]
}

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
    ]
};

export const privateMessageCustomizationGroup = {
    type: 'group' as const,
    label: 'Private Message Configuration',
    helpText: 'Configure how notifications intended for private viewing are displayed.',
    fields: [
        {
            type: 'boolean' as const,
            name: 'PRIVATE_SHOW_DEFAULT_ICON',
            label: 'Will use the default Discord Bridge icon for the Webhook Avatar ( Overrides manually set icons )',
            defaultValue: true,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'PRIVATE_DISPLAY_MORE_BODY',
            label: 'Will increase the maximum size of the body preview text (From 400 characters to 1000)',
            defaultValue: false,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'PRIVATE_SHOW_ARCTIC_SHIFT_BUTTON',
            label: 'Add an additional button to open a user profile in Arctic-Shift',
            defaultValue: false,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'PRIVATE_SHOW_DEFAULT_AUTHOR_BUTTON',
            label: 'Hide the default Author button which links to the reddit profile',
            defaultValue: true,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'PRIVATE_SHOW_AUTHOR_AGE',
            label: 'Adds the account age of the author to the messages',
            defaultValue: false,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'PRIVATE_SHOW_AUTHOR_FLAIR',
            label: 'Adds the applied flair of the author to the message',
            defaultValue: false,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'PRIVATE_SHOW_POST_FLAIR',
            label: 'Adds the post flair to the message',
            defaultValue: false,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'PRIVATE_SHOW_TOTAL_KARMA',
            label: 'Adds the total Karma of the Author.',
            defaultValue: false,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'PRIVATE_SHOW_LINK_KARMA',
            label: 'Adds the post (link) Karma of the Author.',
            defaultValue: false,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'PRIVATE_SHOW_COMMENT_KARMA',
            label: 'Adds the comment Karma of the Author.',
            defaultValue: false,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'PRIVATE_SHOW_TOTAL_SUB_KARMA',
            label: 'Adds the total Subreddit Karma of the Author.',
            defaultValue: false,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'PRIVATE_SHOW_LINK_SUB_KARMA',
            label: 'Adds the post (link) Subreddit Karma of the Author.',
            defaultValue: false,
            scope: 'installation' as const,
        },
        {
            type: 'boolean' as const,
            name: 'PRIVATE_SHOW_COMMENT_SUB_KARMA',
            label: 'Adds the comment Subreddit Karma of the Author.',
            defaultValue: false,
            scope: 'installation' as const,
        },
    ]
}

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
            helpText: `Channel for new submissions.`,
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

export const modQueueGroup = {
    type: 'group' as const,
    label: 'Mod Queue Settings',
    helpText: 'Configure how the Mod Queue stream is handled and notified.',
    fields: [
        {
            type: 'string' as const,
            name: 'WEBHOOK_MOD_QUEUE',
            label: 'Mod Queue Webhook',
            required: false,
            scope: 'installation' as const,
            helpText: `The Channel to which new entries in the Mod Queue are sent.`,
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateWebhookUrl(value);
            }
        },
        {
            type: 'string' as const,
            name: 'MOD_QUEUE_MESSAGE_REMOVAL',
            label: 'Pingable Mod Queue Message for removals',
            defaultValue: 'New Item Requiring Review due to **Removal**',
            scope: 'installation' as const,
            helpText: 'Custom text sent with notification',
        },
        {
            type: 'string' as const,
            name: 'MOD_QUEUE_MESSAGE_REPORT',
            label: 'Pingable Mod Queue Message for reports',
            defaultValue: 'New Item Requiring Review due to **Report**',
            scope: 'installation' as const,
            helpText: 'Custom text sent with notification',
        },
        {
            type: 'boolean' as const,
            name: 'MOD_QUEUE_BUTTON',
            label: 'Adds a button to directly open the mod queue of the subreddit.',
            defaultValue: true,
            scope: 'installation' as const,
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
            helpText: `Channel for removal notifications.`,
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateWebhookUrl(value);
            }
        },      
        {
            type: 'boolean' as const,
            name: 'REMOVALS_SCAN_SPAM',
            label: 'Send a new Removal Notification when something is silently removed by reddit. See Wiki for more information.',
            defaultValue: true,
            scope: 'installation' as const,
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
            type: 'string' as const,
            name: 'REMOVE_MESSAGE_SPAM',
            label: 'Silent Removal Messages',
            defaultValue: 'Silently REMOVED by Reddit',
            scope: 'installation' as const,
            helpText: 'Text displayed when content is removed by Reddits automated systems.',
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
        {
            type: 'boolean' as const,
            name: 'REMOVALS_IGNORE_MODERATOR',
            label: 'Ignore removals performed by a moderator or a bot that is not set as automatic removal',
            defaultValue: false,
            scope: 'installation' as const,
        },
        {
            type: 'string' as const,
            name: 'REMOVAL_IGNORE_AUTHOR',
            label: 'Custom authors which removals will be ignored',
            defaultValue: 'ExampleBot; ExampleBot2',
            required: false,
            scope: 'installation' as const,
            helpText: `Here you can enter custom usernames, if these are the author of a post/comment which is removed, it will be ignored.`,
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
            type: 'boolean' as const,
            name: 'MODMAIL_SHOW_DEFAULT_ICON',
            label: 'Will use the default Discord Bridge icon for the Webhook Avatar ( Overrides manually set icons )',
            defaultValue: true,
            scope: 'installation' as const,
        },
        {
            type: 'string' as const,
            name: 'MODMAIL_MESSAGE',
            label: 'Pingable Modmail Message',
            defaultValue: 'New Modmail Message (@here)',
            scope: 'installation' as const,
            helpText: 'Custom text sent with notification',
        },
        {
            type: 'string' as const,
            name: 'MODMAIL_AUTHOR_IGNORED',
            label: 'List of users which ModMail messages will be ignored',
            defaultValue: 'ExampleUser1; ExampleUser2',
            required: false,
            scope: 'installation' as const,
            helpText: `Here you can enter usernames which will be ignored when they are the author of a ModMail message.`,
            onValidate: async ({ value }: { value?: string }) => {
                return UtilityManager.validateUsernameList(value)
            }
        },
        {
            type: 'boolean' as const,
            name: 'MODMAIL_SHOW_ARCTIC_SHIFT_BUTTON',
            label: 'Add an additional button to open a user profile in Arctic-Shift',
            defaultValue: false,
            scope: 'installation' as const,
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