import { Devvit, Post, Comment, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { UtilityManager } from '../managers/utilityManager.js';
import { ContentDataManager, ContentDetails } from '../managers/contentDataManager.js';
import { PublicPostHandler } from '../handlers/publicPostHandler.js';


export class ModMailHandler {

    static async handle(event: any, context: TriggerContext): Promise<void> {
        const webhookUrl = await context.settings.get('WEBHOOK_MODMAIL') as string | undefined;
        if (!webhookUrl) return;

        const targetId = event.conversationId;
        if (!targetId) return;

        const cleanId = targetId.replace('ModmailConversation_', '');

        const { conversation } = await context.reddit.modMail.getConversation({
            conversationId: cleanId,
            markRead: false,
        });

        if (!conversation) {
            console.log("[ModMailHandler] failed to fetch conversation!");
            return;
        }

        const messages = conversation.messages;
        const messageList = Object.values(messages).sort((a: any, b: any) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        if (messageList.length === 0) return;

        const latestMessage = messageList[0];

        const isModAuthor = latestMessage.participatingAs === 'moderator' || latestMessage.author?.isMod;

        const logEntries = await StorageManager.getLinkedLogEntries(cleanId, context);

        logEntries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const latestLogEntry = logEntries[0];

        let shouldCreateNew = false;
        let state = ItemState.New_Modmail;

        if (!latestLogEntry) {
            shouldCreateNew = true;
            state = ItemState.New_Modmail;
        } else if (isModAuthor) {
            shouldCreateNew = false;
            state = ItemState.Answered_Modmail;
        } else {
            if (latestLogEntry.currentStatus === ItemState.Answered_Modmail || latestLogEntry.currentStatus === ItemState.Archived_Modmail) {
                shouldCreateNew = true;
                state = ItemState.New_Reply_Modmail;
            } else {
                shouldCreateNew = false;
                state = ItemState.New_Reply_Modmail;
            }
        }

        let moderatorMessage;
        let userMessage;

        if (state === ItemState.Answered_Modmail) {
            moderatorMessage = latestMessage;
            userMessage = messageList.find((msg: any) => msg.participatingAs !== 'moderator') || messageList[1];
        } else {
            userMessage = latestMessage;
        }

        const payload = await EmbedManager.createModMailEmbed(
            conversation.subject ?? "(No Subject)",
            cleanId,
            userMessage,
            moderatorMessage,
            state,
            context
        );

        const customMessages = await UtilityManager.getMessageFromChannelType(ChannelType.ModMail, context);
        if (customMessages && customMessages.length > 0 && customMessages[0]) {
            (payload as any).content = customMessages[0];
        }

        if (shouldCreateNew) {
            console.log(`[ModMailHandler] Creating NEW notification for ${cleanId} (State: ${state})`);
            const messageId = await WebhookManager.sendNewMessage(webhookUrl, payload, context as any);

            if (messageId && !messageId.startsWith('failed')) {
                await StorageManager.createLogEntry({
                    redditId: cleanId,
                    discordMessageId: messageId,
                    channelType: ChannelType.ModMail,
                    currentStatus: state,
                    webhookUrl: webhookUrl
                }, context as any);

                // Ensure it's tracked for archival checks
                await StorageManager.trackActiveModmail(cleanId, context as any);
            }
        } else {
            console.log(`[ModMailHandler] Updating EXISTING notification for ${cleanId} (State: ${state})`);

            // If updating, we usually only want to update the LATEST log entry, 
            // leaving older "tickets" in the history alone.
            if (latestLogEntry) {
                await WebhookManager.editMessage(
                    latestLogEntry.webhookUrl,
                    latestLogEntry.discordMessageId,
                    payload
                );

                if (latestLogEntry.currentStatus !== state) {
                    await StorageManager.updateLogStatus(latestLogEntry.discordMessageId, state, context);
                }
            }
        }
    }
}