/**
 * Audit Logging Utility
 * Logs admin actions to Supabase audit_logs table
 */

import { supabase } from './supabase.js';

export const AUDIT_ACTIONS = {
    PROJECT_CREATE: 'project_create',
    PROJECT_UPDATE: 'project_update',
    PROJECT_DELETE: 'project_delete',
    PHOTO_UPLOAD: 'photo_upload',
    PHOTO_DELETE: 'photo_delete',
    WORKER_APPROVE: 'worker_approve',
    WORKER_REJECT: 'worker_reject',
    WORKER_DELETE: 'worker_delete',
    WORKER_CREATE: 'worker_create',
    RATE_UPDATE: 'rate_update',
};

/**
 * Log an admin action
 * @param {string} action - Action type from AUDIT_ACTIONS
 * @param {object} metadata - Additional metadata about the action
 * @returns {Promise}
 */
export async function logAction(action, metadata = {}) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const logEntry = {
            action,
            user_id: user?.id,
            user_email: user?.email,
            metadata: JSON.stringify(metadata),
            timestamp: new Date().toISOString(),
            ip_address: 'unknown',
        };
        
        const { error } = await supabase
            .from('audit_logs')
            .insert([logEntry]);
        
        if (error) {
            console.error('Failed to log action:', error);
            // Don't throw - audit logging should not break functionality
        }
    } catch (err) {
        console.error('Audit logging error:', err);
    }
}

/**
 * Get audit logs for a specific user
 * @param {string} userId - User ID
 * @param {number} limit - Number of logs to return
 * @returns {Promise}
 */
export async function getUserAuditLogs(userId, limit = 50) {
    try {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Failed to fetch audit logs:', err);
        return [];
    }
}

/**
 * Get all audit logs (admin only)
 * @param {number} limit - Number of logs to return
 * @returns {Promise}
 */
export async function getAllAuditLogs(limit = 100) {
    try {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Failed to fetch all audit logs:', err);
        return [];
    }
}

/**
 * Get audit logs for a specific action type
 * @param {string} action - Action type
 * @param {number} limit - Number of logs to return
 * @returns {Promise}
 */
export async function getActionAuditLogs(action, limit = 50) {
    try {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('action', action)
            .order('timestamp', { ascending: false })
            .limit(limit);
        
        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Failed to fetch action audit logs:', err);
        return [];
    }
}
