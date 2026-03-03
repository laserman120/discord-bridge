import { JobContext, TriggerContext, Post, Comment } from '@devvit/public-api';
import { NewPostHandler } from '../handlers/newPostHandler.js';
import { StateSyncHandler } from '../handlers/stateSyncHandler.js';
import { RemovalHandler } from '../handlers/removalHandler.js';
import { RemovalReasonHandler } from '../handlers/removalReasonHandler.js';
import { ReportHandler } from '../handlers/reportHandler.js';
import { ModLogHandler } from '../handlers/modlogHandler.js';
import { DeletionHandler } from '../handlers/deletionHandler.js';
import { PublicPostHandler } from '../handlers/publicPostHandler.js';
import { ModMailHandler } from '../handlers/modMailHandler.js';
import { FlairWatchHandler } from '../handlers/flairWatchHandler.js';
import { ModAbuseHandler } from '../handlers/modAbuseHandler.js';
import { ModActivityHandler } from '../handlers/modActivityHandler.js';
import { UpdateHandler } from '../handlers/updateHandler.js'; 
import { ModQueueHandler } from '../handlers/modQueueHandler.js';
import { SpamRemovalHandler } from '../handlers/spamRemovalHandler.js';

export type HandlerName =
    | 'NewPostHandler' | 'PublicPostHandler' | 'StateSyncHandler'
    | 'RemovalHandler' | 'RemovalReasonHandler' | 'ReportHandler'
    | 'ModLogHandler' | 'DeletionHandler' | 'FlairWatchHandler'
    | 'ModActivityHandler' | 'ModAbuseHandler' | 'ModMailHandler'
    | 'ModQueueHandler' | 'UpdateHandler' | 'SpamRemovalHandler';

export interface QueueTask {
    handler: HandlerName;
    data: any;
}

/**
 * Orchestrates a persistent task queue using Redis.
 * Supports batch fetching of Reddit content and scheduled delays.
 */
export class QueueManager {
    static readonly QUEUE_KEY = 'msg_queue:ids'; 
    static readonly DATA_KEY = 'msg_queue:data'; 
    static readonly LOCK_KEY = 'msg_queue:lock';

    /**
     * Adds a task to the queue with an optional delay.
     * @param task - The handler name and data payload.
     * @param context - The execution context.
     * @param delaySeconds - (Optional) Seconds to wait before processing.
     */
    static async enqueue(task: QueueTask, context: TriggerContext, delaySeconds: number = 0): Promise<void> {
        try {
            const taskId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            const processAt = Date.now() + (delaySeconds * 1000);

            await context.redis.hSet(this.DATA_KEY, { [taskId]: JSON.stringify(task) });
            
            // The score is the timestamp when the task becomes 'ready'
            await context.redis.zAdd(this.QUEUE_KEY, { score: processAt, member: taskId });

            console.log(`[Queue] Enqueued ${task.handler} (Ready in ${delaySeconds}s)`);
        } catch (e) {
            console.error('[Queue] Failed to enqueue task:', e);
        }
    }

    /**
     * The main worker loop. Fetches ready tasks, batch-fetches Reddit data, 
     * and dispatches to appropriate handlers.
     */
    static async processQueue(_event: any, context: JobContext): Promise<void> {
        const isLocked = await context.redis.get(this.LOCK_KEY);
        if (isLocked) return;

        // Lock for 2 minutes to prevent overlapping workers
        await context.redis.set(this.LOCK_KEY, 'true', { expiration: new Date(Date.now() + 120000) });

        try {
            const now = Date.now();
            const MAX_BATCH_SIZE = 100;

            // Fetch only tasks where score (processAt) is <= now
            const taskIds = await context.redis.zRange(
                this.QUEUE_KEY, 
                0, 
                now, 
                { by: 'score', limit: { offset: 0, count: MAX_BATCH_SIZE } }
            );

            if (!taskIds || taskIds.length === 0) return;

            console.log(`[Queue] Worker processing ${taskIds.length} tasks.`);

            // 1. Batch fetch task payloads
            const taskDataStrings = await Promise.all(taskIds.map(t => context.redis.hGet(this.DATA_KEY, t.member)));
            const tasks: { id: string, payload: QueueTask }[] = [];
            const allItemIds = new Set<string>();

            // 2. Parse payloads and collect Reddit IDs for batch fetching
            taskDataStrings.forEach((str, index) => {
                if (!str) return;
                try {
                    const payload: QueueTask = JSON.parse(str);
                    tasks.push({ id: taskIds[index].member, payload });

                    const itemId = this.extractItemId(payload);
                    if (itemId?.startsWith('t3_') || itemId?.startsWith('t1_')) {
                        allItemIds.add(itemId);
                    }
                } catch (e) {
                    console.error('[Queue] Payload parse error', e);
                }
            });

            // 3. Perform Batch Fetch from Reddit API
            const contentCache = new Map<string, Post | Comment>();
            let modQueue: (Post | Comment)[] = [];

            if (allItemIds.size > 0) {
                try {
                    const subreddit = await context.reddit.getCurrentSubreddit();
                    const [items, queueItems] = await Promise.all([
                        subreddit.getCommentsAndPostsByIds(Array.from(allItemIds)).all(),
                        subreddit.getModQueue().all()
                    ]);
                    
                    items.forEach(item => contentCache.set(item.id, item));
                    modQueue = queueItems;
                } catch (e) {
                    console.error('[Queue] Batch fetch failed:', e);
                }
            }

            // 4. Dispatch Tasks
            for (const task of tasks) {
                const itemId = this.extractItemId(task.payload);
                const preFetchedItem = itemId ? contentCache.get(itemId) : undefined;

                try {
                    await this.dispatch(task.payload, context, modQueue, preFetchedItem);
                } catch (err) {
                    console.error(`[Queue] Dispatch error for ${task.payload.handler}:`, err);
                }

                // Cleanup
                await Promise.all([
                    context.redis.zRem(this.QUEUE_KEY, [task.id]),
                    context.redis.hDel(this.DATA_KEY, [task.id])
                ]);

                // Small sleep to avoid hitting rate limits too hard during dispatch
                await new Promise(resolve => setTimeout(resolve, 150));
            }
                
        } catch(e) {
            console.error('[Queue] Worker fatal error:', e);
        } finally {
            await context.redis.del(this.LOCK_KEY);
        }
    }

    /**
     * Utility to extract Reddit ThingID from various event data shapes.
     * Keeps logic identical to original implementation.
     */
    private static extractItemId(payload: QueueTask): string | undefined {
        const d = payload.data;
        if (d.type === 'CommentDelete') return d.commentId;
        if (d.type === 'PostDelete') return d.postId;
        return d.id || d.itemId || d.postId || d.commentId || d.targetPost?.id || d.targetComment?.id;
    }

    private static async dispatch(task: QueueTask, context: JobContext, currentQueue?: (Post | Comment)[], preFetchedContent?: Post | Comment): Promise<void> {
        const { handler, data } = task;
        // The handlers expect TriggerContext; JobContext is a compatible subset for these operations.
        const ctx = context as any; 

        switch (handler) {
            case 'NewPostHandler': await NewPostHandler.handle(data, ctx, preFetchedContent); break;
            case 'PublicPostHandler': await PublicPostHandler.handle(data, ctx, preFetchedContent); break;
            case 'StateSyncHandler': await StateSyncHandler.handleModAction(data, ctx, preFetchedContent); break;
            case 'RemovalHandler': await RemovalHandler.handle(data, ctx, preFetchedContent); break;
            case 'SpamRemovalHandler': await SpamRemovalHandler.handle(data, ctx, preFetchedContent); break;
            case 'RemovalReasonHandler': await RemovalReasonHandler.handle(data, ctx, preFetchedContent); break;
            case 'ModLogHandler': await ModLogHandler.handle(data, ctx); break;
            case 'UpdateHandler': await UpdateHandler.handle(data, ctx, preFetchedContent); break;
            case 'FlairWatchHandler': await FlairWatchHandler.handle(data, ctx, preFetchedContent); break;
            case 'ModActivityHandler': await ModActivityHandler.handle(data, ctx, preFetchedContent); break;
            case 'ModAbuseHandler': await ModAbuseHandler.handle(data, ctx); break;
            case 'ModMailHandler': await ModMailHandler.handle(data, ctx); break;
            case 'ReportHandler': await ReportHandler.handle(data, ctx, preFetchedContent); break;
            case 'DeletionHandler': await DeletionHandler.handle(data, ctx, preFetchedContent); break;
            case 'ModQueueHandler': 
                if (currentQueue) await ModQueueHandler.handle(data, ctx, currentQueue, preFetchedContent); 
                break;
            default: console.warn(`[Queue] Unknown handler: ${handler}`);
        }
    }
}