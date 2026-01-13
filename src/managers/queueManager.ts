import { Devvit, JobContext, TriggerContext} from '@devvit/public-api';
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
import { SilentRemovalHandler } from '../handlers/silentRemovalHandler.js';

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
    | 'UpdateHandler'
    | 'SilentRemovalHandler';

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

            let processedCount = 0;
            const MAX_BATCH_SIZE = 150;

            while (processedCount < MAX_BATCH_SIZE) {

                const range = await context.redis.zRange(this.QUEUE_KEY, 0, 0);

                if (!range || range.length === 0) {
                    break;
                }

                const taskId = range[0].member;

                const taskStr = await context.redis.hGet(this.DATA_KEY, taskId);

                await context.redis.zRem(this.QUEUE_KEY, [taskId]);
                await context.redis.hDel(this.DATA_KEY, [taskId]);

                if (!taskStr) {
                    console.warn(`[Queue] Task ID ${taskId} found in index but missing data. Skipping.`);
                    continue;
                }

                const task: QueueTask = JSON.parse(taskStr);

                try {
                    console.log("[Queue] Processing task for:", task.handler);
                    await this.dispatch(task, context);
                } catch (err) {
                    console.error(`[Queue] Error processing ${task.handler}:`, err);
                }

                processedCount++;

                await new Promise(resolve => setTimeout(resolve, 150));
            }
        } finally {
            await context.redis.del(this.LOCK_KEY);
            console.log('[Queue] Worker finished batch.');
        }
    }

    private static async dispatch(task: QueueTask, context: JobContext): Promise<void> {
        const ctx = context as any;
        const { handler, data } = task;

        switch (handler) {
            case 'NewPostHandler':
                await NewPostHandler.handle(data, ctx);
                break;
            case 'PublicPostHandler':
                await PublicPostHandler.handle(data, ctx);
                break;
            case 'StateSyncHandler':
                await StateSyncHandler.handleModAction(data, ctx);
                break;
            case 'RemovalHandler':
                await RemovalHandler.handle(data, ctx);
                break;
            case 'RemovalReasonHandler':
                await RemovalReasonHandler.handle(data, ctx);
                break;
            case 'ModLogHandler':
                await ModLogHandler.handle(data, ctx);
                break;
            case 'UpdateHandler':
                await UpdateHandler.handle(data, ctx);
                break;
            case 'FlairWatchHandler':
                await FlairWatchHandler.handle(data, ctx);
                break;
            case 'ModActivityHandler':
                await ModActivityHandler.handle(data, ctx);
                break;
            case 'ModAbuseHandler':
                await ModAbuseHandler.handle(data, ctx);
                break;
            case 'ModMailHandler':
                await ModMailHandler.handle(data, ctx);
                break;
            case 'ReportHandler':
                await ReportHandler.handle(data, ctx);
                break;
            case 'DeletionHandler':
                await DeletionHandler.handle(data, ctx);
                break;
            case 'SilentRemovalHandler':
                await SilentRemovalHandler.handle(data, ctx)
                break;
            default:
                console.warn(`[Queue] Unknown handler type: ${handler}`);
        }
    }
}