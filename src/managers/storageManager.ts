import { Devvit } from '@devvit/public-api';
import { ItemState, ChannelType, ContentType } from '../config/enums.js';

export interface LogEntry {
    redditId: string;
    discordMessageId: string;
    channelType: ChannelType;
    currentStatus: ItemState;
    webhookUrl: string;
    createdAt: string;
    unixTimestamp: number;
}

export class StorageManager {
    private static getLogKey(discordMessageId: string): string {
        return `log:d:${discordMessageId}`;
    }

    private static getIndexKey(redditId: string): string {
        return `index:r:${redditId}`;
    }

    private static getChronoIndexKey(): string {
        return `chrono:log:index`;
    }

    private static getActiveModmailIndexKey(): string {
        return `index:modmail:active`;
    }

    static async createLogEntry(entry: Omit<LogEntry, 'createdAt' | 'unixTimestamp'>, context: Devvit.Context): Promise<void> {
        const { redis } = context;
        const now = new Date();
        const unixTimestamp = Math.floor(now.getTime() / 1000);

        const fullEntry: LogEntry = {
            ...entry,
            createdAt: now.toISOString(),
            unixTimestamp: unixTimestamp
        };

        const redisPayload: Record<string, string> = {
            redditId: fullEntry.redditId,
            discordMessageId: fullEntry.discordMessageId,
            channelType: fullEntry.channelType,
            currentStatus: fullEntry.currentStatus,
            webhookUrl: fullEntry.webhookUrl,
            createdAt: fullEntry.createdAt,
            unixTimestamp: fullEntry.unixTimestamp.toString()
        };

        await redis.hSet(
            StorageManager.getLogKey(fullEntry.discordMessageId),
            redisPayload
        );

        await redis.zAdd(
            StorageManager.getIndexKey(fullEntry.redditId),
            { score: 1, member: fullEntry.discordMessageId }
        );

        await redis.zAdd(
            StorageManager.getChronoIndexKey(),
            { score: unixTimestamp, member: fullEntry.discordMessageId }
        );
    }

    static async getLogEntry(discordMessageId: string, context: any): Promise<LogEntry | null> {
        const record = await context.redis.hGetAll(StorageManager.getLogKey(discordMessageId));
        if (Object.keys(record).length === 0) {
            return null;
        }

        return {
            ...record,
            unixTimestamp: parseInt(record.unixTimestamp || '0', 10)
        } as unknown as LogEntry;
    }

    static async getLinkedMessageIds(redditId: string, context: any): Promise<string[]> {
        const scoreMembers = await context.redis.zRange(
            StorageManager.getIndexKey(redditId),
            0,
            -1
        );
        return scoreMembers.map((item: { member: any; }) => item.member);
    }

    static async getLinkedLogEntries(redditId: string, context: any): Promise<LogEntry[]> {
        const messageIds = await this.getLinkedMessageIds(redditId, context);

        const entries: LogEntry[] = [];

        for (const discordMessageId of messageIds) {
            const entry = await this.getLogEntry(discordMessageId, context);
            if (entry) {
                entries.push(entry);
            } else {
                await context.redis.zRem(this.getIndexKey(redditId), [discordMessageId]);
            }
        }

        return entries;
    }

    static async updateLogStatus(discordMessageId: string, newStatus: ItemState, context: any): Promise<void> {
        await context.redis.hSet(
            StorageManager.getLogKey(discordMessageId),
            { 'currentStatus': newStatus }
        );
    }

    static async getExpiredLogKeys(ageInSeconds: number, context: any): Promise<string[]> {
        const { redis } = context;
        const cutoffTimestamp = Math.floor(Date.now() / 1000) - ageInSeconds;

        const scoreMembers = await redis.zRange(
            StorageManager.getChronoIndexKey(),
            '-inf',
            cutoffTimestamp.toString(),
            { by: 'score' as const, limit: { offset: 0, count: 1000 } }
        );

        return scoreMembers.map((item: { member: any; }) => item.member);
    }

    static async deleteLogEntry(entry: LogEntry, context: Devvit.Context): Promise<void> {
        const { redis } = context;
        const logKey = StorageManager.getLogKey(entry.discordMessageId);
        const indexKey = StorageManager.getIndexKey(entry.redditId);
        const chronoKey = StorageManager.getChronoIndexKey();

        await redis.del(logKey);

        await redis.zRem(indexKey, [entry.discordMessageId]);

        await redis.zRem(chronoKey, [entry.discordMessageId]);

        const remainingMembers = await redis.zCard(indexKey);
        if (remainingMembers === 0) {
            await redis.del(indexKey);
        }

        console.log(`[DB] Deleted log and index reference for Msg ID ${entry.discordMessageId}`);
    }

    static async trackActiveModmail(conversationId: string, context: Devvit.Context): Promise<void> {
        await context.redis.zAdd(
            StorageManager.getActiveModmailIndexKey(),
            { score: Date.now(), member: conversationId }
        );
    }

    static async untrackActiveModmail(conversationId: string, context: Devvit.Context): Promise<void> {
        await context.redis.zRem(
            StorageManager.getActiveModmailIndexKey(),
            [conversationId]
        );
    }

    static async getActiveModmailIds(context: Devvit.Context): Promise<string[]> {
        const scoreMembers = await context.redis.zRange(
            StorageManager.getActiveModmailIndexKey(),
            0, -1
        );
        return scoreMembers.map((item: { member: any; }) => item.member);
    }

    // Unused until necessary to double check posts/comments
    static async getRecentTrackedPostIds(limit: number, context: any): Promise<string[]> {
        const uniqueIds = new Set<string>();
        let cursor = 0;
        const batchSize = 50;

        while (uniqueIds.size < limit) {
            const scoreMembers = await context.redis.zRange(
                StorageManager.getChronoIndexKey(),
                0,
                -1,
                { reverse: true, limit: { offset: cursor, count: batchSize } }
            );

            if (scoreMembers.length === 0) break;

            for (const item of scoreMembers) {
                const discordId = item.member;
                const logEntry = await this.getLogEntry(discordId, context);

                if (logEntry && logEntry.currentStatus !== ItemState.Deleted && (logEntry.redditId.startsWith('t3_') || logEntry.redditId.startsWith('t1_')))
                {
                    uniqueIds.add(logEntry.redditId);
                }

                if (uniqueIds.size >= limit) break;
            }

            cursor += batchSize;
            if (cursor > 2000) break;
        }

        return Array.from(uniqueIds);
    }
}