import { Devvit, Post, Comment, TriggerContext } from '@devvit/public-api';
import { ChannelType, ItemState } from '../config/enums.js';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { ComponentManager } from '../managers/componentManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { UtilityManager } from '../managers/utilityManager.js';
import { ContentDataManager, ContentDetails } from '../managers/contentDataManager.js';
import { PublicPostHandler } from '../handlers/publicPostHandler.js';

const APP_NAME = "discord-bridge";
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
        } else {
            const lastStatus = latestLogEntry.currentStatus;

            if (isModAuthor) {
                shouldCreateNew = false;
                state = ItemState.Answered_Modmail;
            } else {
                if (lastStatus === ItemState.Answered_Modmail || lastStatus === ItemState.Archived_Modmail) {
                    shouldCreateNew = true;
                    state = ItemState.New_Reply_Modmail;
                } else {

                    shouldCreateNew = false;

                    state = lastStatus === ItemState.New_Reply_Modmail ? ItemState.New_Reply_Modmail : ItemState.New_Modmail;
                }
            }
        }

        if (state == ItemState.New_Modmail && isModAuthor) {
            const allowNews = await context.settings.get('ALLOW_NOTIFICATIONS_IN_DISCORD') as boolean;
            if (allowNews && latestMessage.author?.name && latestMessage.author?.name.toLowerCase() == APP_NAME) {
                console.log(`[ModMailHandler] New conversation started by discord bridge app, creating notification...`)
            } else {
                console.log(`[ModMailHandler] New conversation started by Moderator, ignoring`)
                return;
            }
            
        }

        let ignoredUsersList = await context.settings.get('MODMAIL_AUTHOR_IGNORED') as string || "";
        let ignoredUsers = ignoredUsersList.split(";");

        if (latestMessage.author?.name && ignoredUsers.map(u => u.trim().toLowerCase()).includes(latestMessage.author.name.toLowerCase())) {
            console.log(`[ModMailHandler] Latest message author ${latestMessage.author.name} is in ignored list, skipping notification.`);
            return;
        }

        if (shouldCreateNew) {
            console.log(`[ModMailHandler] Creating NEW notification for ${cleanId} (State: ${state})`);

            const messageToShow = (!latestLogEntry) ? messageList[messageList.length - 1] : latestMessage;

            const notificationString = await context.settings.get('MODMAIL_MESSAGE') as string | undefined;

            const payload = await ComponentManager.createModMailMessage(
                conversation.subject ?? "(No Subject)",
                cleanId,
                messageToShow,
                state,
                context,
                notificationString
            );

            const messageId = await WebhookManager.sendNewMessage(webhookUrl, payload, context as any);

            if (messageId && !messageId.startsWith('failed')) {
                await StorageManager.createLogEntry({
                    redditId: cleanId,
                    discordMessageId: messageId,
                    channelType: ChannelType.ModMail,
                    currentStatus: state,
                    webhookUrl: webhookUrl
                }, context as any);

                await StorageManager.trackActiveModmail(cleanId, context as any);
            }

        } else {
            console.log(`[ModMailHandler] Updating EXISTING ${cleanId} (State: ${state})`);

            if (latestLogEntry) {
                const currentMessage = await WebhookManager.getMessage(latestLogEntry.webhookUrl, latestLogEntry.discordMessageId);
                if (!currentMessage) {
                    console.error(`[ModMailHandler] Could not fetch message ${latestLogEntry.discordMessageId} to append/update.`);
                    return;
                }

                let components = currentMessage.components || [];
                let needsUpdate = false;

                if (latestLogEntry.currentStatus !== state) {
                    components = await ComponentManager.updateModMailState(components, state, context);
                    await StorageManager.updateLogStatus(latestLogEntry.discordMessageId, state, context);
                    needsUpdate = true;
                }

                if (isModAuthor) {
                    if (latestLogEntry.currentStatus == ItemState.Answered_Modmail) {
                        console.log(`[ModMailHandler] Skipping append for Mod Reply (Already Answered).`);
                    } else {
                        const replyComponents = ComponentManager.createModMailReply(latestMessage, true);
                        components = [...components, ...replyComponents];
                        needsUpdate = true;
                    }
                } else {
                    components = await ComponentManager.updateModMailBody(components, latestMessage.bodyMarkdown || "...");
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    await WebhookManager.editMessage(
                        latestLogEntry.webhookUrl,
                        latestLogEntry.discordMessageId,
                        {
                            flags: currentMessage.flags,
                            components: components
                        }
                    );
                }
            }
        }
    }
}