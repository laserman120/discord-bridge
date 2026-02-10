import { Devvit } from '@devvit/public-api';
import { privateMessageCustomizationGroup, publicMessageCustomizationGroup, appNotificationGroup, publicNotificationGroup, newPostsGroup, removalGroup, reportGroup, modmailGroup, modlogGroup, flairWatchConfigField, modAbuseGroup, moderatorWatchConfigGrup, customizationGroup, modMailCustomizationGroup, modQueueGroup } from './config/settings.js';
import { checkForOldMessages } from './scheduledEvents/checkForOldMessages.js';
import { checkModMailStatus } from './scheduledEvents/modMailSyncJob.js';
import { QueueManager } from './managers/queueManager.js';
import { checkModQueue } from './scheduledEvents/modQueueCheckJob.js';
import { checkNewsUpdates } from './scheduledEvents/newsCheckJob.js';
import { checkSpamQueue } from './scheduledEvents/spamQueueCheckJob.js';

/*
Devvit.configure({
    http: true,
    redditAPI: true,
    redis: true
});*/

Devvit.addSettings([
    appNotificationGroup,
    publicMessageCustomizationGroup,
    publicNotificationGroup,
    privateMessageCustomizationGroup,
    newPostsGroup,
    modQueueGroup,
    removalGroup,
    reportGroup,
    modmailGroup,
    modlogGroup,
    flairWatchConfigField,
    moderatorWatchConfigGrup,
    modAbuseGroup,
    customizationGroup,
    modMailCustomizationGroup,
]);

const ActionsRequiringUpdate = ["marknsfw", "lock", "unlock", "sticky", "unsticky", "spoiler", "unspoiler", "editflair"];

Devvit.addTrigger({
    event: 'ModAction',
    onEvent: async (event, context) => {
        await new Promise(resolve => setTimeout(resolve, 4000));

        const redditItemId = event.targetPost?.id || event.targetComment?.id;

        if (redditItemId && context)
        {
            await QueueManager.enqueue({ handler: 'ModQueueHandler', data: event }, context);
            await QueueManager.enqueue({ handler: 'StateSyncHandler', data: event }, context);
            await QueueManager.enqueue({ handler: 'RemovalHandler', data: event }, context);
            await QueueManager.enqueue({ handler: 'RemovalReasonHandler', data: event }, context);
        }

        await QueueManager.enqueue({ handler: 'ModLogHandler', data: event }, context);
        await QueueManager.enqueue({ handler: 'ModAbuseHandler', data: event }, context);

        if (ActionsRequiringUpdate.includes(event.action || ""))
        {
            await QueueManager.enqueue({ handler: 'UpdateHandler', data: event }, context);
        }
    },
});

Devvit.addTrigger({
    event: 'PostSubmit',
    onEvent: async (event, context) => {

        await new Promise(resolve => setTimeout(resolve, 2000));

        if (event.post && context) {

            await QueueManager.enqueue({ handler: 'NewPostHandler', data: event.post }, context);

            // Await plenty of time to ensure the post is fully up to date before checking for public posting
            await new Promise(resolve => setTimeout(resolve, 6000));

            await QueueManager.enqueue({ handler: 'PublicPostHandler', data: event.post }, context);
            await QueueManager.enqueue({ handler: 'FlairWatchHandler', data: event.post }, context);
            await QueueManager.enqueue({ handler: 'ModActivityHandler', data: event.post }, context);

            // Hotfix due to reports by AutoModerator NOT calling the report trigger
            await QueueManager.enqueue({ handler: 'ModQueueHandler', data: event.post }, context);
            await QueueManager.enqueue({ handler: 'ReportHandler', data: event.post }, context);
        }

    },
});

Devvit.addTrigger({
    event: 'CommentSubmit',
    onEvent: async (event, context) => {

        await new Promise(resolve => setTimeout(resolve, 2000));

        if (event.comment && context) {
            // Hotfix due to reports by AutoModerator NOT calling the report trigger
            await QueueManager.enqueue({ handler: 'ModQueueHandler', data: event.comment }, context);
            await QueueManager.enqueue({ handler: 'ReportHandler', data: event.comment }, context);
            await QueueManager.enqueue({ handler: 'FlairWatchHandler', data: event.comment }, context);
            await QueueManager.enqueue({ handler: 'ModActivityHandler', data: event.comment }, context);
        }

    },
});

Devvit.addTrigger({
    events: ['PostDelete', 'CommentDelete'], 
    onEvent: async (event, context) => {
        await new Promise(resolve => setTimeout(resolve, 2000));

        await QueueManager.enqueue({ handler: 'ModQueueHandler', data: event }, context);
        await QueueManager.enqueue({ handler: 'DeletionHandler', data: event }, context);
    },
});

Devvit.addTrigger({
    event: 'ModMail',
    onEvent: async (event, context) => {
        await new Promise(resolve => setTimeout(resolve, 2000));

        await QueueManager.enqueue({ handler: 'ModMailHandler', data: event }, context);
    },
});

Devvit.addTrigger({
    events: ['PostReport', 'CommentReport'],
    onEvent: async (event, context) => {
        await new Promise(resolve => setTimeout(resolve, 3000));

        if (event.type == 'PostReport' && event.post) {
            await QueueManager.enqueue({ handler: 'ReportHandler', data: event.post }, context);
            await QueueManager.enqueue({ handler: 'ModQueueHandler', data: event.post }, context);
        }

        if (event.type == 'CommentReport' && event.comment) {
            await QueueManager.enqueue({ handler: 'ReportHandler', data: event.comment }, context);
            await QueueManager.enqueue({ handler: 'ModQueueHandler', data: event.comment }, context);
        }
    },
});

Devvit.addTrigger({
    events: ['PostUpdate', 'CommentUpdate', 'PostNsfwUpdate', 'PostSpoilerUpdate', 'PostFlairUpdate'],
    onEvent: async (event, context) => {
        await new Promise(resolve => setTimeout(resolve, 3000));

        if ((event.type == 'PostUpdate' || event.type == 'PostNsfwUpdate' || event.type == 'PostSpoilerUpdate' || event.type == 'PostFlairUpdate') && event.post) {
            await QueueManager.enqueue({ handler: 'UpdateHandler', data: event }, context);
        }

        if (event.type == 'CommentUpdate' && event.comment) {
            await QueueManager.enqueue({ handler: 'UpdateHandler', data: event }, context);
        }
    },
});

Devvit.addSchedulerJob({
    name: 'cleanup_old_messages',
    onRun: checkForOldMessages,
});

Devvit.addSchedulerJob({
    name: 'modmail_sync_job',
    onRun: checkModMailStatus,
});

Devvit.addSchedulerJob({
    name: 'check_mod_queue',
    onRun: checkModQueue,
});

Devvit.addSchedulerJob({
    name: 'process_queue',
    onRun: (event, context) => QueueManager.processQueue(event, context),
});

Devvit.addSchedulerJob({
    name: 'check_news',
    onRun: checkNewsUpdates,
});

Devvit.addSchedulerJob({
    name: 'check_spam_queue',
    onRun: checkSpamQueue,
})

Devvit.addTrigger({
    events: ['AppInstall', 'AppUpgrade'],
    onEvent: async (_event, context) => {
        try {
            const jobs = await context.scheduler.listJobs();
            for (const job of jobs) {
                console.log(`[Setup] Cancelling existing job: ${job.id}`);
                await context.scheduler.cancelJob(job.id);
            }

            const jobId = await context.scheduler.runJob({
                name: 'cleanup_old_messages',
                cron: '0 * * * *', // Run once every hour at minute 0
            });
            console.log(`[Setup] Scheduled cleanup job with ID: ${jobId}`);

            const modmailJobId = await context.scheduler.runJob({
                name: 'modmail_sync_job',
                cron: '*/5 * * * *', // Every 5 minutes
            });
            console.log(`[Setup] Scheduled modmail sync job with ID: ${modmailJobId}`);

            const modQueueJobId = await context.scheduler.runJob({
                name: 'check_mod_queue',
                cron: '*/10 * * * *', // Every 10 minutes
            });
            console.log(`[Setup] Scheduled modQueue check job with ID: ${modQueueJobId}`);

            const queueJobId = await context.scheduler.runJob({
                name: 'process_queue',
                cron: '*/30 * * * * *', // Run every 30 seconds
            });
            console.log(`[Setup] Scheduled queue processor with ID: ${queueJobId}`);

            const newsJobId = await context.scheduler.runJob({
                name: 'check_news',
                cron: '*/1 * * * *', // Run every 1 hour 0 * * * *
            });
            console.log(`[Setup] Scheduled news check with ID: ${newsJobId}`);

            const spamQueueJobId = await context.scheduler.runJob({
                name: 'check_spam_queue',
                cron: '*/15 * * * *', // Run every 15 minutes
            });

        } catch (e) {
            console.error('[Setup] Failed to schedule cleanup job:', e);
        }
    },
});



export default Devvit;