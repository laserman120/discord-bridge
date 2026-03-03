import { TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { BaseHandler } from './baseHandler.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { UtilityManager } from '../helpers/utilityHelper.js';
import { ContentDataManager } from '../managers/contentDataManager.js';

/**
 * Bridges General Moderator Logs from Reddit to Discord.
 * Captures actions like locks, NSFW toggles, and sticky status.
 */
export class ModLogHandler extends BaseHandler {
    /**
     * Processes a moderator action and dispatches a notification to the ModLog channel.
     * @param event - The ModAction event data.
     * @param context - The Devvit execution context.
     */
    static async handle(event: any, context: TriggerContext): Promise<void> {
        // 1. Resolve Settings and Filters
        const webhookUrl = await context.settings.get('WEBHOOK_MODLOG') as string | undefined;
        if (!webhookUrl) return;

        const enabledActions = await context.settings.get('MODLOG_ACTIONS') as string[] || [];
        if (!enabledActions.includes(event.action || '')) return;

        // 2. Data Gathering
        // Note: ModLogs use a specific gatherer because the target can be a user, post, or comment.
        const contentData = await ContentDataManager.gatherModActionTarget(event, context);

        // 3. Build Payload
        const payload = await EmbedManager.createModLogEmbed(event, contentData, ChannelType.ModLog, context);

        // 4. Handle Notification Strings & Custom Overrides
        const notificationStrings = await UtilityManager.getMessageFromChannelType(ChannelType.ModLog, context);
        if (notificationStrings && notificationStrings?.length > 0) {
            payload.content = notificationStrings[0];
        }

        // Apply action-specific message overrides if they exist in settings
        payload.content = await this.getCustomMessageOverride(event.action, payload.content, context);

        console.log(`[ModLogHandler] Dispatching notification for: ${event.action}`);

        // 5. Dispatch and Log
        const messageId = await WebhookManager.sendNewMessage(webhookUrl, payload);

        if (messageId && !messageId.startsWith('failed')) {
            await StorageManager.createLogEntry({
                redditId: event.id, // We use the unique action ID as the reference for logs
                discordMessageId: messageId,
                channelType: ChannelType.ModLog,
                currentStatus: ItemState.Live,
                webhookUrl: webhookUrl
            }, context);
        }
    }

    /**
     * Parses the MODLOG_CUSTOM_MESSAGES setting to find an action-specific message override.
     * @private
     */
    private static async getCustomMessageOverride(action: string, defaultContent: string | undefined, context: TriggerContext): Promise<string | undefined> {
        const customConfigString = await context.settings.get('MODLOG_CUSTOM_MESSAGES') as string | undefined;
        if (!customConfigString) return defaultContent;

        try {
            const customConfig = JSON.parse(customConfigString);
            if (Array.isArray(customConfig)) {
                const match = customConfig.find((entry: any) => entry.action === action);
                if (match?.message) {
                    return match.message;
                }
            }
        } catch (e) {
            console.error('[ModLogHandler] JSON parsing failed for custom messages:', e);
        }

        return defaultContent;
    }
}