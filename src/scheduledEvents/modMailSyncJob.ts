import { Devvit, JobContext } from '@devvit/public-api';
import { StorageManager } from '../managers/storageManager.js';
import { WebhookManager } from '../managers/webhookManager.js';
import { EmbedManager } from '../managers/embedManager.js';
import { ItemState } from '../config/enums.js';

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
                    // Only update if it's not already marked archived (efficiency)
                    if (entry.currentStatus !== ItemState.Archived_Modmail) {
                        await WebhookManager.updateMessageStateOnly(
                            entry.webhookUrl,
                            entry.discordMessageId,
                            ItemState.Archived_Modmail,
                            context as any
                        );

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