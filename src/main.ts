import { Devvit } from '@devvit/public-api';
import { publicNotificationGroup, newPostsGroup, removalGroup, reportGroup, modmailGroup, modlogGroup, flairWatchConfigField, customizationGroup, modMailCustomizationGroup } from './config/settings.js';
import { NewPostHandler } from './handlers/newPostHandler.js';
import { StateSyncHandler } from './handlers/stateSyncHandler.js';
import { RemovalHandler } from './handlers/removalHandler.js';
import { RemovalReasonHandler } from './handlers/removalReasonHandler.js';
import { ReportHandler } from './handlers/reportHandler.js';
import { ModLogHandler } from './handlers/modlogHandler.js';
import { DeletionHandler } from './handlers/deletionHandler.js';
import { PublicPostHandler } from './handlers/publicPostHandler.js';
import { checkForOldMessages } from './scheduledEvents/checkForOldMessages.js';
import { ModMailHandler } from './handlers/modMailHandler.js';
import { checkModMailStatus } from './scheduledEvents/modMailSyncJob.js';
import { FlairWatchHandler } from './handlers/flairWatchHandler.js';

Devvit.configure({
    http: true,
    redditAPI: true,
    redis: true
});

Devvit.addSettings([
    publicNotificationGroup,
    newPostsGroup,
    removalGroup,
    reportGroup,
    modmailGroup,
    modlogGroup,
    flairWatchConfigField,
    customizationGroup,
    modMailCustomizationGroup,
]);

Devvit.addTrigger({
    event: 'ModAction',
    onEvent: async (event, context) => {

        await new Promise(resolve => setTimeout(resolve, 3000));

        const redditItemId = event.targetPost?.id || event.targetComment?.id;

        console.log(`[TRIGGER: ModAction] Action: ${event.action}, Target ID: ${redditItemId}`);
        if (redditItemId && context)
        {
            await StateSyncHandler.handleModAction(event, context);
            await RemovalHandler.handle(event, context);
            await RemovalReasonHandler.handle(event, context);
        }

        await ModLogHandler.handle(event, context);
    },
});

Devvit.addTrigger({
    event: 'PostSubmit',
    onEvent: async (event, context) => {

        await new Promise(resolve => setTimeout(resolve, 2000));

        if (event.post && context) {
            NewPostHandler.handle(event.post, context);

            // Await plenty of time to ensure the post is fully up to date before checking for public posting
            await new Promise(resolve => setTimeout(resolve, 5000));
            await PublicPostHandler.handle(event.post, context);
            await FlairWatchHandler.handle(event.post, context);

            // Hotfix due to reports by AutoModerator NOT calling the report trigger
            ReportHandler.handle(event.post, context);
        }

    },
});

Devvit.addTrigger({
    event: 'CommentSubmit',
    onEvent: async (event, context) => {

        await new Promise(resolve => setTimeout(resolve, 2000));

        if (event.comment && context) {
            // Hotfix due to reports by AutoModerator NOT calling the report trigger
            await ReportHandler.handle(event.comment, context);


            await FlairWatchHandler.handle(event.comment, context);
        }

    },
});

Devvit.addTrigger({
    events: ['PostDelete', 'CommentDelete'], 
    onEvent: async (event, context) => {
        await new Promise(resolve => setTimeout(resolve, 2000));

        DeletionHandler.handle(event, context);
    },
});

Devvit.addTrigger({
    event: 'ModMail',
    onEvent: async (event, context) => {
        await new Promise(resolve => setTimeout(resolve, 2000));

        ModMailHandler.handle(event, context);
    },
});

Devvit.addTrigger({
    events: ['PostReport', 'CommentReport'],
    onEvent: async (event, context) => {
        await new Promise(resolve => setTimeout(resolve, 3000));

        if (event.type == 'PostReport' && event.post) {
            ReportHandler.handle(event.post, context);
        }

        if (event.type == 'CommentReport' && event.comment) {
            ReportHandler.handle(event.comment, context);
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

            
        } catch (e) {
            console.error('[Setup] Failed to schedule cleanup job:', e);
        }
    },
});



export default Devvit;