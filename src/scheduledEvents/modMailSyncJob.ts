import { Devvit, JobContext } from '@devvit/public-api';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { ItemState } from '../config/enums.js';
import { ComponentManager } from '../managers/componentManager.js';

export async function checkModMailStatus(event: any, context: JobContext): Promise<void> {
    console.log('[ModMailSync] Starting ModMail Archival Check...');

    const activeIds = await StorageManager.getActiveModmailIds(context as any);

    if (activeIds.length === 0) {
        console.log('[ModMailSync] No active modmail conversations to check.');
        return;
    }

    console.log(`[ModMailSync] Checking ${activeIds.length} active conversations...`);

    for (const conversationId of activeIds) {
        try {
            const { conversation } = await context.reddit.modMail.getConversation({
                conversationId: conversationId,
                markRead: false
            });

            if (!conversation) {
                console.warn(`[ModMailSync] Could not fetch conversation ${conversationId}. Skipping.`);
                continue;
            }

            const isArchived = conversation.state == "Archived";

            if (isArchived) {
                console.log(`[ModMailSync] Conversation ${conversationId} is now Archived. Updating Discord.`);

                const logEntries = await StorageManager.getLinkedLogEntries(conversationId, context as any);

                for (const entry of logEntries) {
                    if (entry.currentStatus !== ItemState.Archived_Modmail) {

                        const message = await WebhookManager.getMessage(entry.webhookUrl, entry.discordMessageId);

                        if (message && message.components) {
                            const updatedComponents = await ComponentManager.updateModMailState(
                                message.components,
                                ItemState.Archived_Modmail,
                                context as any
                            );

                            await WebhookManager.editMessage(
                                entry.webhookUrl,
                                entry.discordMessageId,
                                {
                                    flags: message.flags,
                                    components: updatedComponents
                                }
                            );
                        } else {
                            console.warn(`[ModMailSync] Message ${entry.discordMessageId} not found or has no components.`);
                        }

                        // 4. Update Database
                        await StorageManager.updateLogStatus(
                            entry.discordMessageId,
                            ItemState.Archived_Modmail,
                            context as any
                        );
                    }
                }

                await StorageManager.untrackActiveModmail(conversationId, context as any);
            }
        } catch (e) {
            console.error(`[ModMailSync] Failed to check/update conversation ${conversationId}:`, e);
        }
    }
    console.log('[ModMailSync] ModMail check complete.');
}