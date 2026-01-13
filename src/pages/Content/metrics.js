// Metrics tracking utility for KPI tracking
// Uses chrome.storage.local for private, local storage

const getStorage = () => {
    return typeof chrome !== 'undefined' && chrome.storage
        ? chrome.storage
        : (typeof browser !== 'undefined' && browser.storage ? browser.storage : null);
};

// Initialize metrics structure
const getDefaultMetrics = () => {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return {
        draftsGenerated: 0,
        draftsInserted: 0,
        thumbsUp: 0,
        thumbsDown: 0,
        roleUsage: {}, // { "sales": 5, "recruitment": 3, ... }
        weekStart: startOfWeek.toISOString(),
        monthStart: startOfMonth.toISOString(),
        draftsThisWeek: 0,
        draftsThisMonth: 0,
        lastReset: new Date().toISOString()
    };
};

// Get current week/month start dates
const getWeekStart = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
};

const getMonthStart = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
};

// Check if we need to reset weekly/monthly counters
const checkAndResetCounters = async (metrics) => {
    const now = new Date();
    const currentWeekStart = getWeekStart();
    const currentMonthStart = getMonthStart();
    
    const storedWeekStart = new Date(metrics.weekStart);
    const storedMonthStart = new Date(metrics.monthStart);
    
    let needsUpdate = false;
    
    // Reset weekly counter if new week
    if (currentWeekStart.getTime() !== storedWeekStart.getTime()) {
        metrics.draftsThisWeek = 0;
        metrics.weekStart = currentWeekStart.toISOString();
        needsUpdate = true;
    }
    
    // Reset monthly counter if new month
    if (currentMonthStart.getTime() !== storedMonthStart.getTime()) {
        metrics.draftsThisMonth = 0;
        metrics.monthStart = currentMonthStart.toISOString();
        needsUpdate = true;
    }
    
    if (needsUpdate) {
        await saveMetrics(metrics);
    }
    
    return metrics;
};

// Load metrics from storage
export const loadMetrics = async () => {
    return new Promise((resolve) => {
        const storage = getStorage();
        if (!storage) {
            resolve(getDefaultMetrics());
            return;
        }
        
        storage.local.get(['metrics'], (result) => {
            const metrics = result.metrics || getDefaultMetrics();
            // Check and reset counters if needed
            checkAndResetCounters(metrics).then(updatedMetrics => {
                resolve(updatedMetrics);
            });
        });
    });
};

// Save metrics to storage
export const saveMetrics = async (metrics) => {
    return new Promise((resolve, reject) => {
        const storage = getStorage();
        if (!storage) {
            reject(new Error('Storage API not available'));
            return;
        }
        
        storage.local.set({ metrics }, () => {
            if (chrome?.runtime?.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(metrics);
            }
        });
    });
};

// Increment drafts generated
export const trackDraftGenerated = async (role = null) => {
    try {
        const metrics = await loadMetrics();
        metrics.draftsGenerated += 1;
        metrics.draftsThisWeek += 1;
        metrics.draftsThisMonth += 1;
        
        // Track role usage
        if (role) {
            metrics.roleUsage[role] = (metrics.roleUsage[role] || 0) + 1;
        }
        
        await saveMetrics(metrics);
        return metrics;
    } catch (error) {
        console.error('Error tracking draft generated:', error);
        return null;
    }
};

// Increment drafts inserted
export const trackDraftInserted = async () => {
    try {
        const metrics = await loadMetrics();
        metrics.draftsInserted += 1;
        await saveMetrics(metrics);
        return metrics;
    } catch (error) {
        console.error('Error tracking draft inserted:', error);
        return null;
    }
};

// Track thumbs up
export const trackThumbsUp = async () => {
    try {
        const metrics = await loadMetrics();
        metrics.thumbsUp += 1;
        await saveMetrics(metrics);
        return metrics;
    } catch (error) {
        console.error('Error tracking thumbs up:', error);
        return null;
    }
};

// Track thumbs down
export const trackThumbsDown = async () => {
    try {
        const metrics = await loadMetrics();
        metrics.thumbsDown += 1;
        await saveMetrics(metrics);
        return metrics;
    } catch (error) {
        console.error('Error tracking thumbs down:', error);
        return null;
    }
};

// Get formatted metrics for display
export const getFormattedMetrics = async () => {
    try {
        const metrics = await loadMetrics();
        
        // Calculate insert rate
        const insertRate = metrics.draftsGenerated > 0
            ? Math.round((metrics.draftsInserted / metrics.draftsGenerated) * 100)
            : 0;
        
        // Calculate time saved (drafts inserted × 30 seconds)
        const totalSeconds = metrics.draftsInserted * 30;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        let timeSavedText = '';
        if (hours > 0) {
            timeSavedText = `~${hours} hour${hours > 1 ? 's' : ''}`;
            if (minutes > 0) {
                timeSavedText += ` ${minutes} minute${minutes > 1 ? 's' : ''}`;
            }
        } else {
            timeSavedText = `~${minutes} minute${minutes > 1 ? 's' : ''}`;
        }
        
        // Find most used role
        let mostUsedRole = null;
        let mostUsedRoleCount = 0;
        let totalRoleUsage = 0;
        for (const [role, count] of Object.entries(metrics.roleUsage)) {
            totalRoleUsage += count;
            if (count > mostUsedRoleCount) {
                mostUsedRoleCount = count;
                mostUsedRole = role;
            }
        }
        const mostUsedRolePercentage = totalRoleUsage > 0
            ? Math.round((mostUsedRoleCount / totalRoleUsage) * 100)
            : 0;
        
        // Calculate feedback score
        const totalFeedback = metrics.thumbsUp + metrics.thumbsDown;
        const feedbackScore = totalFeedback > 0
            ? Math.round((metrics.thumbsUp / totalFeedback) * 100)
            : 0;
        
        return {
            draftsGenerated: metrics.draftsGenerated,
            draftsInserted: metrics.draftsInserted,
            insertRate: insertRate,
            timeSaved: timeSavedText,
            draftsThisWeek: metrics.draftsThisWeek,
            draftsThisMonth: metrics.draftsThisMonth,
            mostUsedRole: mostUsedRole,
            mostUsedRolePercentage: mostUsedRolePercentage,
            feedbackScore: feedbackScore,
            totalFeedback: totalFeedback
        };
    } catch (error) {
        console.error('Error getting formatted metrics:', error);
        return {
            draftsGenerated: 0,
            draftsInserted: 0,
            insertRate: 0,
            timeSaved: '0 minutes',
            draftsThisWeek: 0,
            draftsThisMonth: 0,
            mostUsedRole: null,
            mostUsedRolePercentage: 0,
            feedbackScore: 0,
            totalFeedback: 0
        };
    }
};
