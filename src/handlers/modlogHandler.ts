import { TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { BaseHandler } from './baseHandler.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { UtilityManager } from '../helpers/utilityHelper.js';
import { ContentDataManager } from '../managers/contentDataManager.js';
import { DISCORD_ERROR_CODES } from '../config/constants.js';

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
    static async handle(event: any, context: TriggerContext): Promise<boolean> {
        const webhookUrl = await context.settings.get('WEBHOOK_MODLOG') as string | undefined;
        if (!webhookUrl) return true;

        const enabledActions = await context.settings.get('MODLOG_ACTIONS') as string[] || [];
        if (!enabledActions.includes(event.action || '')) return true;

        const uniqueId = `modlog:${event.action}:${event.actionedAt}:${event.moderator?.name || 'unknown_mod'}`;

        const existingLogs = await StorageManager.getLinkedLogEntries(uniqueId, context);
        const alreadyPosted = existingLogs.some(
            entry => entry.channelType === ChannelType.ModLog
        );

        if (alreadyPosted) {
            UtilityManager.log(`[ModLogHandler] Already logged action ${event.action} with ID ${uniqueId}, skipping.`);
            return true;
        }

        const contentData = await ContentDataManager.gatherModActionTarget(event, context);

        const payload = await EmbedManager.createModLogEmbed(event, contentData, ChannelType.ModLog, context);

        const notificationStrings = await UtilityManager.getMessageFromChannelType(ChannelType.ModLog, context);
        if (notificationStrings && notificationStrings?.length > 0) {
            payload.content = notificationStrings[0];
        }

        payload.content = await this.getCustomMessageOverride(event.action, payload.content, context);

        UtilityManager.log(`[ModLogHandler] Dispatching notification for: ${event.action}`);

        // Dispatch and Log
        const messageId = await WebhookManager.sendNewMessage(webhookUrl, payload);

        if (messageId && !messageId.startsWith('failed')) {
            await StorageManager.createLogEntry({
                redditId: uniqueId, // We use the unique action ID as the reference for logs
                discordMessageId: messageId,
                channelType: ChannelType.ModLog,
                currentStatus: ItemState.Live,
                webhookUrl: webhookUrl
            }, context);
            return true;
        } else {
            if(messageId && DISCORD_ERROR_CODES.includes(messageId.replace('failed_id_error_', ''))) 
            {
                UtilityManager.log(`[ModLogHandler] Discord webhook ran into error: ${messageId.replace('failed_id_error_', '')}`);
                return true;
            }
            return false;
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
            UtilityManager.error('[ModLogHandler] JSON parsing failed for custom messages:', e);
        }

        return defaultContent;
    }
}