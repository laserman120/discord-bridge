const ADMIN_ACCOUNTS = new Set([
    'anti_evil_ops',
    'anti_evil ops',
    'anti_evil operations',
    'modcodeofconduct',
    'reddit_legal',    
    'reddit legal', 
    'aevo',             
    'safety',   
    '[ redacted ]',
]);

/**
 * Checks if the given username is in the list of known admin accounts.
 */
export function isAdminAccount(username?: string): boolean {
    if (!username) return false;
    return ADMIN_ACCOUNTS.has(username.toLowerCase());
}