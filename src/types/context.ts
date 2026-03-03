import { TriggerContext, JobContext } from '@devvit/public-api';

/**
 * A union type representing any valid Devvit execution context.
 */
export type DevvitContext = TriggerContext | JobContext;

/**
 * Type guard to determine if a context is a TriggerContext.
 * Useful when you need to access properties like 'event' or trigger-specific metadata.
 */
export function isTriggerContext(ctx: DevvitContext): ctx is TriggerContext {
    return 'ui' in ctx && !('job' in ctx);
}

/**
 * Type guard to determine if a context is a JobContext (Scheduler).
 */
export function isJobContext(ctx: DevvitContext): ctx is JobContext {
    return 'job' in ctx;
}