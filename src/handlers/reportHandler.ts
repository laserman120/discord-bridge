import { Devvit, Post, Comment, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { ContentDataManager, ContentDetails } from '../managers/contentDataManager.js';

export class ReportHandler {
    static async handle(triggerPost: { id: string }, context: TriggerContext): Promise<void> {
        const targetId = triggerPost.id;

        console.log(`[ReportHandler] Received possible report for ID: ${targetId}`)

        const webhookUrl = await context.settings.get('WEBHOOK_REPORTS') as string | undefined;

        if (!webhookUrl) {
            return;
        }

        const logEntries = await StorageManager.getLinkedLogEntries(targetId, context);

        let contentItem: Post | Comment;
        try {
            if (targetId.startsWith('t3_')) {
                contentItem = await context.reddit.getPostById(targetId);
            } else {
                contentItem = await context.reddit.getCommentById(targetId);
            }
        } catch (e) {
            console.error(`[RemovalHandler] Failed to fetch content: ${e}`);
            return;
        }

        let status = ItemState.Unhandled_Report;

        const contentData = await ContentDataManager.gatherDetails(contentItem, context);

        if (contentData.reportCount === undefined || contentData.reportCount == 0) {
            console.log("[ReportHandler] Content has no reports, skipping handling.")
            return;
        }

        if (!contentData.reportCount) {
            console.log("[ReportHandler] Report already hidden and handled, no message will be sent")
            return;
        }

        const payload = await EmbedManager.createDefaultEmbed(contentData, status, ChannelType.Reports, context);

        const discordMessageId = await WebhookManager.sendNewMessage(webhookUrl, payload, context as any);

        if (discordMessageId && !discordMessageId.startsWith('failed_id')) {
            await StorageManager.createLogEntry({
                redditId: targetId,
                discordMessageId: discordMessageId,
                channelType: ChannelType.Reports,
                currentStatus: status,
                webhookUrl: webhookUrl
            }, context as any);
        }

        if (logEntries.length === 0) {
            console.log(`[ReportHandler] No tracked messages found for ${targetId}. None to update`);
            return;
        }

        for (const entry of logEntries) {
            let payload;
            switch (entry.channelType) {
                case ChannelType.NewPosts:
                    payload = await EmbedManager.createDefaultEmbed(contentData, status, entry.channelType, context);
                    break;
                case ChannelType.Removals:
                    payload = await EmbedManager.createDefaultEmbed(contentData, status, entry.channelType, context);
                    break;
                default:
                    console.log(`[ReportHandler] Unsupported channel type ${entry.channelType} for message update.`);
                    continue;
            }

            await WebhookManager.editMessage(
                entry.webhookUrl,
                entry.discordMessageId,
                payload
            );
        }

    }
}