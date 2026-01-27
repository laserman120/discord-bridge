import { Devvit, Post, Comment, TriggerContext, User } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { ContentDataManager } from '../managers/contentDataManager.js';
import { ComponentManager } from '../managers/componentManager.js';

export class ModActivityHandler {
    static async handle(event: any, context: TriggerContext, preFetchedContent?: Post | Comment): Promise<void> {
        const targetId = event.id;

        if (!context.subredditName) return;

        const webhookUrl = await context.settings.get('MOD_ACTIVITY_WEBHOOK') as string | undefined;
        if (!webhookUrl) return;

        const checkPosts = await context.settings.get('MOD_ACTIVITY_CHECK_POSTS') as boolean ?? true;
        const checkComments = await context.settings.get('MOD_ACTIVITY_CHECK_COMMENTS') as boolean ?? true;

        const isPost = targetId.startsWith('t3_');

        if (isPost && !checkPosts) return;
        if (!isPost && !checkComments) return;

        let contentItem: Post | Comment | undefined;
        if (preFetchedContent) {
            contentItem = preFetchedContent;
        } else {
            try {
                console.warn(`[ModActivityHandler] No pre-fetched data found, running manual fetch for ${targetId}`);
                if (isPost) {
                    contentItem = await context.reddit.getPostById(targetId);
                } else {
                    contentItem = await context.reddit.getCommentById(targetId);
                }
            } catch (error) {
                console.error(`[ModActivityHandler] Failed to fetch content ${targetId}:`, error);
                return;
            }
        }

        if (!contentItem) return;

        let isMod = false;
        try {
            const author = await contentItem.getAuthor();
            if (author) {
                const mods = await context.reddit.getModerators({ subredditName: context.subredditName, username: author.username }).all();
                isMod = mods.length > 0;
            }
        } catch (e) {
            console.error(`[ModActivityHandler] Failed to check mod status for ${contentItem.authorName}:`, e);
            return;
        }

        if (!isMod) return;

        const details = await ContentDataManager.gatherDetails(contentItem, context);

        const state = ItemState.Live;

        /*const payload = await EmbedManager.createDefaultEmbed(
            details,
            state,
            ChannelType.ModActivity,
            context
        );*/

        const customMessage = await context.settings.get('MOD_ACTIVITY_MESSAGE') as string | undefined;
        /*if (customMessage) {
            payload.content = customMessage;
        }*/

        const payload = await ComponentManager.createDefaultMessage(details, state, ChannelType.ModActivity, context, customMessage);

        

        const messageId = await WebhookManager.sendNewMessage(webhookUrl, payload, context as any);

        if (messageId && !messageId.startsWith('failed')) {
            await StorageManager.createLogEntry({
                redditId: targetId,
                discordMessageId: messageId,
                channelType: ChannelType.ModActivity,
                currentStatus: state,
                webhookUrl: webhookUrl
            }, context as any);
        }
    }
}