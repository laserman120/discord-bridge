import { Devvit, JobContext, TriggerContext, Post, Comment, AboutSubredditTypes} from '@devvit/public-api';
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
    | 'NewPostHandler'
    | 'PublicPostHandler'
    | 'StateSyncHandler'
    | 'RemovalHandler'
    | 'RemovalReasonHandler'
    | 'ReportHandler'
    | 'ModLogHandler'
    | 'DeletionHandler'
    | 'FlairWatchHandler'
    | 'ModActivityHandler'
    | 'ModAbuseHandler'
    | 'ModMailHandler'
    | 'ModQueueHandler'
    | 'UpdateHandler'
    | 'SpamRemovalHandler';

export interface QueueTask {
    handler: HandlerName;
    data: any;
}

export class QueueManager {
    static readonly QUEUE_KEY = 'msg_queue:ids'; 
    static readonly DATA_KEY = 'msg_queue:data'; 
    static readonly LOCK_KEY = 'msg_queue:lock';


    static async enqueue(task: QueueTask, context: TriggerContext): Promise<void> {
        try {
            const taskId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

            await context.redis.hSet(this.DATA_KEY, { [taskId]: JSON.stringify(task) });

            await context.redis.zAdd(this.QUEUE_KEY, { score: Date.now(), member: taskId });

            console.log(`[Queue] Enqueued task for: ${task.handler}`);

        } catch (e) {
            console.error('[Queue] Failed to enqueue task:', e);
        }
    }

    static async processQueue(event: any, context: JobContext): Promise<void> {
        const isLocked = await context.redis.get(this.LOCK_KEY);
        if (isLocked) {
            console.log('[Queue] Worker already running. Skipping.');
            return;
        }

        await context.redis.set(this.LOCK_KEY, 'true', { expiration: new Date(Date.now() + 120000) });

        try {
            console.log('[Queue] Worker started.');

            try {
                const queueSize = await context.redis.zCard(this.QUEUE_KEY);
                console.log(`[Queue] Current Queue Size: ${queueSize}`);
            } catch (e) {
                console.warn('[Queue] Failed to fetch queue size:', e);
            }

            const MAX_BATCH_SIZE = 100;
            const taskIds = await context.redis.zRange(this.QUEUE_KEY, 0, MAX_BATCH_SIZE - 1);

            if (!taskIds || taskIds.length === 0) {
                return;
            }

            const taskDataPromises = taskIds.map(t => context.redis.hGet(this.DATA_KEY, t.member));
            const taskDataStrings = await Promise.all(taskDataPromises);

            const tasks: { id: string, payload: QueueTask }[] = [];

            const allIds = new Set<string>();

            taskDataStrings.forEach((str, index) => {
                if (!str) return;
                try {
                    const payload: QueueTask = JSON.parse(str);
                    tasks.push({ id: taskIds[index].member, payload });

                    let itemId: string | undefined;

                    if (payload.data.type === 'CommentDelete' && payload.data.commentId) {
                        itemId = payload.data.commentId;
                    }
                    else if (payload.data.type === 'PostDelete' && payload.data.postId) {
                        itemId = payload.data.postId;
                    }
                    else if (payload.data.id) {
                        itemId = payload.data.id;
                    }
                    else if (payload.data.itemId) {
                        itemId = payload.data.itemId;
                    }
                    else if (payload.data.postId) {
                        itemId = payload.data.postId;
                    }
                    else if (payload.data.commentId) {
                        itemId = payload.data.commentId;
                    }

                    if (!itemId && payload.data.targetPost?.id) itemId = payload.data.targetPost.id;
                    if (!itemId && payload.data.targetComment?.id) itemId = payload.data.targetComment.id;

                    if (!itemId && payload.data.permalink) {
                        itemId = payload.data.id;
                    }

                    if (itemId && typeof itemId === 'string') {
                        if (itemId.startsWith('t3_') || itemId.startsWith('t1_')) {
                            allIds.add(itemId);
                            console.log("[Queue] Added item with id: " + itemId + " to batch fetch list.")
                        }
                    }
                } catch (e) {
                    console.error('[Queue] Failed to parse task data', e);
                }
            });

            const contentCache = new Map<string, Post | Comment>();
            let modQueue;
            if (allIds.size > 0) {
                try {
                    console.log(`[Queue] Batch fetching ${allIds.size} unique items...`);

                    const subreddit = await context.reddit.getCurrentSubreddit();
                    const items = await subreddit.getCommentsAndPostsByIds(Array.from(allIds)).all();
                    modQueue = await subreddit.getModQueue().all();

                    items.forEach(item => contentCache.set(item.id, item));
                } catch (e) {
                    console.error('[Queue] Batch fetch failed:', e);
                }
            }

            let processedCount = 0;
            for (const task of tasks) {
                let itemId: string | undefined;

                if (task.payload.data.type === 'CommentDelete' && task.payload.data.commentId) itemId = task.payload.data.commentId;
                else if (task.payload.data.type === 'PostDelete' && task.payload.data.postId) itemId = task.payload.data.postId;
                else if (task.payload.data.id) itemId = task.payload.data.id;
                else if (task.payload.data.itemId) itemId = task.payload.data.itemId;
                else if (task.payload.data.commentId) itemId = task.payload.data.commentId;
                else if (task.payload.data.postId) itemId = task.payload.data.postId;
                else if (task.payload.data.targetPost?.id) itemId = task.payload.data.targetPost.id;
                else if (task.payload.data.targetComment?.id) itemId = task.payload.data.targetComment.id;
                else if (task.payload.data.permalink) itemId = task.payload.data.id;

                const preFetchedItem = itemId ? contentCache.get(itemId) : undefined;

                try {
                    await this.dispatch(task.payload, context, modQueue, preFetchedItem);
                } catch (err) {
                    console.error(`[Queue] Error processing ${task.payload.handler}:`, err);
                }

                await context.redis.zRem(this.QUEUE_KEY, [task.id]);
                await context.redis.hDel(this.DATA_KEY, [task.id]);
                processedCount++;

                await new Promise(resolve => setTimeout(resolve, 150));
            }

            console.log(`[Queue] Processed ${processedCount} tasks.`);
                
        } catch(e) {
            console.error('[Queue] Worker fatal error:', e);
        } finally {
            await context.redis.del(this.LOCK_KEY);
            console.log('[Queue] Worker finished batch.');
        }
    }

    private static async dispatch(task: QueueTask, context: JobContext, currentQueue?: (Post | Comment)[], preFetchedContent?: Post | Comment): Promise<void> {
        const ctx = context as any;
        const { handler, data } = task;

        switch (handler) {
            case 'NewPostHandler':
                await NewPostHandler.handle(data, ctx, preFetchedContent);
                break;
            case 'PublicPostHandler':
                await PublicPostHandler.handle(data, ctx, preFetchedContent);
                break;
            case 'StateSyncHandler':
                await StateSyncHandler.handleModAction(data, ctx, preFetchedContent);
                break;
            case 'RemovalHandler':
                await RemovalHandler.handle(data, ctx, preFetchedContent);
                break;
            case 'SpamRemovalHandler':
                await SpamRemovalHandler.handle(data, ctx, preFetchedContent);
                break;
            case 'RemovalReasonHandler':
                await RemovalReasonHandler.handle(data, ctx, preFetchedContent);
                break;
            case 'ModLogHandler':
                await ModLogHandler.handle(data, ctx);
                break;
            case 'UpdateHandler':
                await UpdateHandler.handle(data, ctx, preFetchedContent);
                break;
            case 'FlairWatchHandler':
                await FlairWatchHandler.handle(data, ctx, preFetchedContent);
                break;
            case 'ModActivityHandler':
                await ModActivityHandler.handle(data, ctx, preFetchedContent);
                break;
            case 'ModAbuseHandler':
                await ModAbuseHandler.handle(data, ctx);
                break;
            case 'ModMailHandler':
                await ModMailHandler.handle(data, ctx);
                break;
            case 'ReportHandler':
                await ReportHandler.handle(data, ctx, preFetchedContent);
                break;
            case 'DeletionHandler':
                await DeletionHandler.handle(data, ctx, preFetchedContent);
                break;
            case 'ModQueueHandler':
                if (!currentQueue) return;
                await ModQueueHandler.handle(data, ctx, currentQueue, preFetchedContent)
                break;
            default:
                console.warn(`[Queue] Unknown handler type: ${handler}`);
        }
    }
}