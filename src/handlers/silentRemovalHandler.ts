import { Post, Comment, TriggerContext, } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { UtilityManager } from '../managers/utilityManager.js';
import { ContentDataManager, ContentDetails } from '../managers/contentDataManager.js';

export class SilentRemovalHandler {

    static async handle(event: any, context: TriggerContext): Promise<void> {
        const targetId = event.itemId;

        if (!targetId) return;

        const SilentRemovalsEnabled = await context.settings.get('REMOVAL_SILENT_NOTIFICATION_ENABLED') as boolean || false;
        if (!SilentRemovalsEnabled) return;

        const webhookUrl = await context.settings.get('WEBHOOK_REMOVALS') as string | undefined;
        if (!webhookUrl) return;

        const existingLogs = await StorageManager.getLinkedLogEntries(targetId, context);
        const alreadyLogged = existingLogs.some(entry => entry.channelType === ChannelType.Removals);

        if (alreadyLogged) {
            console.log(`[SilentRemovalHandler] Removal log already exists for ${targetId}. Skipping creation.`);
            return;
        }

        let contentItem: Post | Comment;
        try {
            if (targetId.startsWith('t3_')) {
                contentItem = await context.reddit.getPostById(targetId);
            } else {
                contentItem = await context.reddit.getCommentById(targetId);
            }
        } catch (e) {
            console.error(`[SilentRemovalHandler] Failed to fetch content: ${e}`);
            return;
        }

        if (!contentItem.isRemoved() && !contentItem.isSpam() || contentItem.isApproved()) {
            console.log(`[SilentRemovalHandler] Content ${targetId} is not removed or spam, or is approved. Skipping.`);
            return;
        }

        const contentData = await ContentDataManager.gatherDetails(contentItem, context);

        let notificationString = await context.settings.get('REMOVE_MESSAGE_SILENT') as string | undefined;

        const isAutomatic = await context.settings.get('REMOVAL_SILENT_NOTIFICATION_TYPE') as boolean || false;
        let state = ItemState.Removed;

        if (isAutomatic) {
            state = ItemState.Awaiting_Review;
        }

        let payload = await EmbedManager.createDefaultEmbed(contentData, state, ChannelType.Removals, context);

        if (notificationString) {
            payload.content = notificationString;
        }

        console.log(`[SilentRemovalHandler] Creating new removal notification for ${targetId}`);
        const messageId = await WebhookManager.sendNewMessage(webhookUrl, payload);

        if (messageId && !messageId.startsWith('failed')) {
            await StorageManager.createLogEntry({
                redditId: targetId,
                discordMessageId: messageId,
                channelType: ChannelType.Removals,
                currentStatus: state,
                webhookUrl: webhookUrl
            }, context as any);
        }
    }
}