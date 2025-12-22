import { Devvit, Post, Comment, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { UtilityManager } from '../managers/utilityManager.js';
import { ContentDataManager, ContentDetails } from '../managers/contentDataManager.js';

export class RemovalHandler {

    static async handle(event: any, context: TriggerContext): Promise<void> {
        const actionString = event.action;
        const targetId = event.targetPost?.id || event.targetComment?.id || event.targetId;

        if (!targetId) return;

        let state = UtilityManager.getStateFromModAction(actionString);
        if (state !== ItemState.Removed && state !== ItemState.Spam) {
            return;
        }

        const webhookUrl = await context.settings.get('WEBHOOK_REMOVALS') as string | undefined;
        if (!webhookUrl) return;

        const existingLogs = await StorageManager.getLinkedLogEntries(targetId, context);
        const alreadyLogged = existingLogs.some(entry => entry.channelType === ChannelType.Removals);

        if (alreadyLogged) {
            console.log(`[RemovalHandler] Removal log already exists for ${targetId}. Skipping creation.`);
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
            console.error(`[RemovalHandler] Failed to fetch content: ${e}`);
            return;
        }


        const contentData = await ContentDataManager.gatherDetails(contentItem, context);

        console.log("[RemovalHandler] Determining notification string... removed by: " + contentData.removedBy)

        if (state == ItemState.Removed) {
            let automatedRemovalUsers = await context.settings.get('AUTOMATIC_REMOVALS_USERS') as string[] || [];
            let automatedRemovalUsersCustom = await context.settings.get('AUTOMATIC_REMOVALS_USERS_CUSTOM') as string || "";
            let customAutomatedUsers = automatedRemovalUsersCustom.split(";");

            automatedRemovalUsers = automatedRemovalUsers.concat(customAutomatedUsers.map(u => u.trim().toLowerCase()).filter(u => u.length > 0));

            console.log("[RemovalHandler] Automatic removal users: " + automatedRemovalUsers.join(", "))
            if (automatedRemovalUsers.includes(contentData.removedBy?.toLowerCase() || '')) {
                state = ItemState.Awaiting_Review;
            }
        }

        

        const notificationStrings = await UtilityManager.getMessageFromChannelType(ChannelType.Removals, context);

        let notificationString;

        if (notificationStrings) {

            // 0=Mod, 1=Auto, 2=Admin
            
            notificationString = notificationStrings[0];

            if (state == ItemState.Awaiting_Review) {
                notificationString = notificationStrings[1];
            }

            if (state == ItemState.Removed && context.subredditName) {
                const subredditModerators = await context.reddit.getModerators({ subredditName: context.subredditName }).all();

                let subredditModeratorNames: string[] = [];

                subredditModerators.forEach(mod => {
                    subredditModeratorNames.push(mod.username.toLowerCase());
                });

                subredditModeratorNames.push("automoderator", "anti_evil_ops", "reddit");

                console.log("Current Moderators: " + subredditModeratorNames.join(", "))

                if (!subredditModeratorNames.includes(contentData.removedBy?.toLowerCase() || ""))
                {
                    notificationString = notificationStrings[2];
                }
            }
        }

        let payload = await EmbedManager.createDefaultEmbed(contentData, state, ChannelType.Removals, context);

        if (notificationString) {
            payload.content = notificationString;
        }

        console.log(`[RemovalHandler] Creating new removal notification for ${targetId}`);
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