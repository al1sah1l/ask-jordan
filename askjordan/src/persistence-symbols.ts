
/**
 * Internal persistence hooks.
 *
 * Symbol-keyed methods are intentionally excluded from
 * sync-engine's string-named action/query protocol.
 */
export const EXPORT_STATE = Symbol("export-state");
export const RESTORE_STATE = Symbol("restore-state");
export const REMOVE_USER_STATE = Symbol("remove-user-state");
