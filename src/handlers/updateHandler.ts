import { Post, Comment, TriggerContext } from '@devvit/public-api';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { ContentDataManager } from '../managers/contentDataManager.js';
import { ComponentManager } from '../managers/componentManager.js';

export class UpdateHandler {
    static async handle(event: any, context: TriggerContext, preFetchedContent?: Post | Comment): Promise<void> {
        let targetId: string | undefined;

        if (event.post) targetId = event.post.id;
        else if (event.comment) targetId = event.comment.id;
        else targetId = event.targetPost?.id || event.targetComment?.id;

        if (!targetId) return;

        const logEntries = await StorageManager.getLinkedLogEntries(targetId, context);
        if (logEntries.length === 0) return;

        console.log(`[PostUpdateHandler] Content update detected for ${targetId}. Syncing ${logEntries.length} messages.`);

        let contentItem: Post | Comment | undefined;
        if (preFetchedContent) {
            contentItem = preFetchedContent;
        } else {
            try {
                console.warn(`[PostUpdateHandler] No pre-fetched data found, running manual fetch for ${targetId}`);
                if (targetId.startsWith('t3_')) {
                    contentItem = await context.reddit.getPostById(targetId);
                } else if (targetId.startsWith('t1_')) {
                    contentItem = await context.reddit.getCommentById(targetId);
                }
            } catch (error) {
                console.error(`[PostUpdateHandler] Failed to fetch content ${targetId}:`, error);
                return;
            }
        }

        if (!contentItem) return;

        const contentData = await ContentDataManager.gatherDetails(contentItem, context);

        for (const entry of logEntries) {
            const currentStatus = entry.currentStatus;

            /*const payload = await EmbedManager.createDefaultEmbed(
                contentData,
                currentStatus,
                entry.channelType,
                context as any
            );*/

            const payload = await ComponentManager.createDefaultMessage(contentData, currentStatus, entry.channelType, context);

            await WebhookManager.editMessage(
                entry.webhookUrl,
                entry.discordMessageId,
                payload
            );
        }
    }
}