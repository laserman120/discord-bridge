import { Post, Comment, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { ComponentManager } from '../managers/componentManager.js';
import { UtilityManager } from '../managers/utilityManager.js';
import { ContentDataManager } from '../managers/contentDataManager.js';

export class SpamRemovalHandler {

    static async handle(event: any, context: TriggerContext, preFetchedContent?: Post | Comment): Promise<void> {
        const targetId = event.targetId || event.id;

        if (!targetId) return;

        const webhookUrl = await context.settings.get('WEBHOOK_REMOVALS') as string | undefined;
        if (!webhookUrl) return;

        const existingLogs = await StorageManager.getLinkedLogEntries(targetId, context);
        const alreadyLogged = existingLogs.some(entry => entry.channelType === ChannelType.Removals);

        if (alreadyLogged) {
            console.log(`[SpamRemovalHandler] Log already exists for ${targetId}. Skipping.`);
            return;
        }

        let contentItem: Post | Comment | undefined;
        if (preFetchedContent) {
            contentItem = preFetchedContent;
        } else {
            try {
                if (targetId.startsWith('t3_')) {
                    contentItem = await context.reddit.getPostById(targetId);
                } else {
                    contentItem = await context.reddit.getCommentById(targetId);
                }
            } catch (e) {
                console.error(`[SpamRemovalHandler] Failed to fetch content: ${e}`);
                return;
            }
        }

        if (!contentItem) return;

        const contentData = await ContentDataManager.gatherDetails(contentItem, context);
        
        if (!contentData.removedBy) {
            contentData.removedBy = "Reddit Filter";
            if (!contentData.removalReason) {
                contentData.removalReason = "Item was silently removed or marked as spam by Reddit.";
            }
        }

        const state = ItemState.Spam;

        const ignoredAuthorsList = await context.settings.get('REMOVAL_IGNORE_AUTHOR') as string || "";
        const ignoredAuthors = ignoredAuthorsList.split(";").map(u => u.trim().toLowerCase()).filter(u => u.length > 0);

        if (contentData.authorName && ignoredAuthors.includes(contentData.authorName.toLowerCase())) {
            console.log(`[SpamRemovalHandler] Author ${contentData.authorName} is ignored.`);
            return;
        }

        // 8. Determine Notification String
        // 0=Mod, 1=Auto/Bot, 2=Admin, 3=Spam
        const notificationStrings = await UtilityManager.getMessageFromChannelType(ChannelType.Removals, context);
        let notificationString: string | undefined;

        if (notificationStrings && notificationStrings.length > 1) {
            notificationString = notificationStrings[3];
        }

        // 9. Build & Send Message
        const payload = await ComponentManager.createDefaultMessage(
            contentData,
            state,
            ChannelType.Removals,
            context,
            notificationString
        );

        console.log(`[SpamRemovalHandler] Sending notification for ${targetId}`);
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