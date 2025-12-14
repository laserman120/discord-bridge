import { Devvit, Post, Comment, TriggerContext, ModAction } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { UtilityManager } from '../managers/utilityManager.js';
import { ContentDataManager, ContentDetails } from '../managers/contentDataManager.js';

export class ModLogHandler {

    static async handle(event: any, context: TriggerContext): Promise<void> {

        const webhookUrl = await context.settings.get('WEBHOOK_MODLOG') as string | undefined;
        if (!webhookUrl) return;

        const enabledActions = await context.settings.get('MODLOG_ACTIONS') as string[] || [];
        if (!enabledActions.includes(event.action || '')) {
            return;
        }

        const contentData = await ContentDataManager.gatherModActionTarget(event, context);

        let payload = EmbedManager.createModLogEmbed(event, contentData, ChannelType.ModLog);

        const notificationString = await UtilityManager.getMessageFromChannelType(ChannelType.ModLog, context);

        if (notificationString && notificationString.length > 0)
        {
            payload.content = notificationString[0];
        }

        console.log(`[ModLogHandler] Creating new modlog notification for ${event.id}`);

        const messageId = await WebhookManager.sendNewMessage(webhookUrl, payload);

        if (messageId && !messageId.startsWith('failed')) {
            await StorageManager.createLogEntry({
                redditId: event.id, 
                discordMessageId: messageId,
                channelType: ChannelType.ModLog,
                currentStatus: ItemState.Live,
                webhookUrl: webhookUrl
            }, context as any);
        }
    }
}