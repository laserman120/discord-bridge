import { Post, Comment, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { BaseHandler } from './baseHandler.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { ContentDataManager } from '../managers/contentDataManager.js';
import { ComponentManager } from '../managers/componentManager.js';
import { UtilityManager } from '../helpers/utilityHelper.js';
import { DISCORD_ERROR_CODES } from '../config/constants.js';

export class EditedContentHandler extends BaseHandler {
    static async handle(event: any, context: TriggerContext, preFetchedContent?: Post | Comment): Promise<boolean> {
        const targetId = this.getRedditId(event);
        if (!targetId) return true;

        const webhookUrl = await context.settings.get('WEBHOOK_EDITED_CONTENT') as string | undefined;
        if (!webhookUrl) return true;

        const contentItem = await this.fetchContent(targetId, context, preFetchedContent);
        if (!contentItem) return true;

        // Remove previous EditedContent message if one exists to bump the notification
        const existingEntries = await StorageManager.getLinkedLogEntries(targetId, context);
        const oldEditEntry = existingEntries.find(e => e.channelType === ChannelType.EditedContent);

        if (oldEditEntry) {
            await WebhookManager.deleteMessage(oldEditEntry.webhookUrl, oldEditEntry.discordMessageId);
            await StorageManager.deleteLogEntry(oldEditEntry, context);
        }

        let status = ItemState.Live;
        if (contentItem.isSpam()) {
            status = ItemState.Spam;
        } else if (contentItem.isRemoved()) {
            status = ItemState.Removed;
        } else if (contentItem.isApproved()) {
            status = ItemState.Approved;
        }

        const contentData = await ContentDataManager.gatherDetails(contentItem, context, event);
        if (contentData.authorName === '[deleted]') return true;

        const notificationString = await context.settings.get('EDITED_CONTENT_MESSAGE') as string | undefined;

        const payload = await ComponentManager.createDefaultMessage(
            contentData,
            status,
            ChannelType.EditedContent,
            context,
            notificationString
        );

        const messageId = await WebhookManager.sendNewMessage(webhookUrl, payload, context);

        if (messageId && !messageId.startsWith('failed')) {
            await StorageManager.createLogEntry({
                redditId: targetId,
                discordMessageId: messageId,
                channelType: ChannelType.EditedContent,
                currentStatus: status,
                webhookUrl: webhookUrl
            }, context);
            return true;
        } else {
            if (messageId && DISCORD_ERROR_CODES.includes(messageId.replace('failed_id_error_', ''))) {
                UtilityManager.log(`[EditedContentHandler] Discord webhook error: ${messageId.replace('failed_id_error_', '')}`);
                return true;
            }
            return false;
        }
    }
}