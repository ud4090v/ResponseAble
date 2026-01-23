import React from 'react';
import { createRoot } from 'react-dom/client';
import { VERCEL_PROXY_URL } from '../../config/apiKeys.js';
import { trackDraftGenerated, trackDraftInserted, trackThumbsUp, trackThumbsDown } from './metrics.js';

// Ensure chrome API is available
const getChromeRuntime = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        return chrome.runtime;
    }
    if (typeof browser !== 'undefined' && browser.runtime) {
        return browser.runtime;
    }
    console.error('Chrome runtime API not available');
    return null;
};

// API configuration - loaded from Chrome storage
let apiConfig = {
    provider: 'grok',
    model: 'grok-4-latest',
    numVariants: 4,
    numGoals: 3,
    numTones: 3,
    classificationConfidenceThreshold: 0.85,
    enableStyleMimicking: true,
};

// Fixed separator for parsing response variants - must match what we instruct AI to use
const RESPONSE_VARIANT_SEPARATOR = '|||RESPONSE_VARIANT|||';

// Helper function to call new streaming API endpoints
const callNewStreamingAPI = async (url, body, onChunk = null, abortSignal = null) => {
    // Get license key from storage and add it to the request body
    const licenseKey = await new Promise((resolve) => {
        const storage = typeof chrome !== 'undefined' ? chrome.storage : (typeof browser !== 'undefined' ? browser.storage : null);
        if (!storage) {
            resolve(null);
            return;
        }
        storage.sync.get(['licenseKey'], (result) => {
            resolve(result.licenseKey || null);
        });
    });

    // Add license key to request body
    const requestBody = {
        ...body,
        licenseKey: licenseKey || null
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: abortSignal
    });

    if (!response.ok) {
        let errorData = {};
        try {
            errorData = await response.json();
        } catch (e) {
            errorData = { error: { message: response.statusText } };
        }
        const errorMessage = errorData.error?.message || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
    }

    // Read the stream (Server-Sent Events format)
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            // Decode the chunk
            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE frames (lines ending with \n\n)
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);

                    if (data === '[DONE]') {
                        continue;
                    }

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content || '';

                        if (content) {
                            fullContent += content;
                            if (onChunk) {
                                onChunk(fullContent, content);
                            }
                        }
                    } catch (e) {
                        // Skip malformed JSON chunks
                    }
                } else if (line.trim() && !line.startsWith('data:')) {
                    // Handle direct content (non-SSE format)
                    const content = line.trim();
                    if (content) {
                        fullContent += content;
                        if (onChunk) {
                            onChunk(fullContent, content);
                        }
                    }
                }
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            // Request was cancelled, return what we have
            return fullContent;
        }
        throw error;
    }

    return fullContent;
};

// Load API configuration from storage
const loadApiConfig = async () => {
    return new Promise((resolve) => {
        const storage = typeof chrome !== 'undefined' ? chrome.storage : (typeof browser !== 'undefined' ? browser.storage : null);
        if (!storage) {
            console.error('Chrome storage API not available');
            resolve(apiConfig);
            return;
        }
        storage.sync.get(['apiProvider', 'apiModel', 'numVariants', 'numGoals', 'numTones', 'classificationConfidenceThreshold', 'enableStyleMimicking'], (result) => {
            const numVariants = result.numVariants || 4;
            const numGoals = result.numGoals || 3;
            const numTones = result.numTones || 3;
            const confidenceThreshold = result.classificationConfidenceThreshold !== undefined ? result.classificationConfidenceThreshold : 0.85;
            const enableStyleMimicking = result.enableStyleMimicking !== undefined ? result.enableStyleMimicking : true;
            apiConfig = {
                provider: result.apiProvider || 'grok',
                model: result.apiModel || 'grok-4-latest',
                numVariants: Math.max(1, Math.min(7, numVariants)), // Clamp between 1 and 7
                numGoals: Math.max(1, Math.min(5, numGoals)), // Clamp between 1 and 5
                numTones: Math.max(1, Math.min(5, numTones)), // Clamp between 1 and 5
                classificationConfidenceThreshold: Math.max(0.0, Math.min(1.0, confidenceThreshold)), // Clamp between 0.0 and 1.0
                enableStyleMimicking: enableStyleMimicking,
            };
            resolve(apiConfig);
        });
    });
};

// Load config on startup
loadApiConfig();

// Listen for config changes
const storage = typeof chrome !== 'undefined' ? chrome.storage : (typeof browser !== 'undefined' ? browser.storage : null);
if (storage) {
    storage.onChanged.addListener((changes) => {
        if (changes.apiProvider || changes.apiModel || changes.numVariants || changes.numGoals || changes.numTones || changes.classificationConfidenceThreshold || changes.enableStyleMimicking) {
            loadApiConfig();
        }
    });
}

// User writing style profile management
const defaultStyleProfile = {
    formality: 'professional',
    sentence_length: 'medium',
    word_choice: 'moderate',
    punctuation_style: 'standard',
    greeting_patterns: [],
    closing_patterns: [],
    usesEmojis: false,
    usesExclamations: false,
    startsWithGreeting: true,
    endsWithSignOff: true,
    sample_count: 0,
    last_updated: null
};

// Load user writing style profile from storage
const loadStyleProfile = async () => {
    return new Promise((resolve) => {
        const storage = typeof chrome !== 'undefined' ? chrome.storage : (typeof browser !== 'undefined' ? browser.storage : null);
        if (!storage) {
            resolve(defaultStyleProfile);
            return;
        }
        storage.sync.get(['userWritingStyle'], (result) => {
            const profile = result.userWritingStyle || defaultStyleProfile;
            // Ensure all required fields exist
            resolve({
                formality: profile.formality || defaultStyleProfile.formality,
                sentence_length: profile.sentence_length || defaultStyleProfile.sentence_length,
                word_choice: profile.word_choice || defaultStyleProfile.word_choice,
                punctuation_style: profile.punctuation_style || defaultStyleProfile.punctuation_style,
                greeting_patterns: profile.greeting_patterns || [],
                closing_patterns: profile.closing_patterns || [],
                usesEmojis: profile.usesEmojis !== undefined ? profile.usesEmojis : defaultStyleProfile.usesEmojis,
                usesExclamations: profile.usesExclamations !== undefined ? profile.usesExclamations : defaultStyleProfile.usesExclamations,
                startsWithGreeting: profile.startsWithGreeting !== undefined ? profile.startsWithGreeting : defaultStyleProfile.startsWithGreeting,
                endsWithSignOff: profile.endsWithSignOff !== undefined ? profile.endsWithSignOff : defaultStyleProfile.endsWithSignOff,
                sample_count: profile.sample_count || 0,
                last_updated: profile.last_updated || null
            });
        });
    });
};

// Save user writing style profile to storage
const saveStyleProfile = async (profile) => {
    return new Promise((resolve, reject) => {
        const storage = typeof chrome !== 'undefined' ? chrome.storage : (typeof browser !== 'undefined' ? browser.storage : null);
        if (!storage) {
            reject(new Error('Storage API not available'));
            return;
        }
        profile.last_updated = new Date().toISOString();
        storage.sync.set({ userWritingStyle: profile }, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(profile);
            }
        });
    });
};

// Merge new style observations with existing profile (fine-tuning)
const mergeStyleProfile = (existingProfile, newObservations) => {
    const existingCount = existingProfile.sample_count || 0;
    const newCount = newObservations.sample_count || 1;
    const totalCount = existingCount + newCount;

    // Weighted average for numeric-like values
    const mergeValue = (existing, newVal, weight) => {
        if (!existing || existingCount === 0) return newVal;
        // Simple merge: favor existing if we have many samples, favor new if we have few
        const existingWeight = Math.min(existingCount / 10, 0.7); // Cap at 70% weight for existing
        const newWeight = 1 - existingWeight;
        return existingWeight > 0.5 ? existing : newVal; // Use existing if we have enough samples, otherwise use new
    };

    // Merge arrays (keep most common patterns, add new ones)
    const mergePatterns = (existing, newPatterns, maxPatterns = 5) => {
        const combined = [...(existing || []), ...(newPatterns || [])];
        // Count frequency and keep most common
        const frequency = {};
        combined.forEach(pattern => {
            frequency[pattern] = (frequency[pattern] || 0) + 1;
        });
        return Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxPatterns)
            .map(([pattern]) => pattern);
    };

    // Merge boolean values: use weighted voting (favor existing if we have many samples)
    const mergeBoolean = (existing, newVal) => {
        if (existingCount === 0) return newVal;
        // If we have many samples, favor existing; if few samples, favor new
        const existingWeight = Math.min(existingCount / 10, 0.7);
        return existingWeight > 0.5 ? existing : newVal;
    };

    return {
        formality: mergeValue(existingProfile.formality, newObservations.formality, totalCount),
        sentence_length: mergeValue(existingProfile.sentence_length, newObservations.sentence_length, totalCount),
        word_choice: mergeValue(existingProfile.word_choice, newObservations.word_choice, totalCount),
        punctuation_style: mergeValue(existingProfile.punctuation_style, newObservations.punctuation_style, totalCount),
        greeting_patterns: mergePatterns(existingProfile.greeting_patterns, newObservations.greeting_patterns),
        closing_patterns: mergePatterns(existingProfile.closing_patterns, newObservations.closing_patterns),
        usesEmojis: mergeBoolean(existingProfile.usesEmojis, newObservations.usesEmojis),
        usesExclamations: mergeBoolean(existingProfile.usesExclamations, newObservations.usesExclamations),
        startsWithGreeting: mergeBoolean(existingProfile.startsWithGreeting, newObservations.startsWithGreeting),
        endsWithSignOff: mergeBoolean(existingProfile.endsWithSignOff, newObservations.endsWithSignOff),
        sample_count: totalCount,
        last_updated: new Date().toISOString()
    };
};

// Platform detection
const detectPlatform = () => {
    const hostname = window.location.hostname;
    if (hostname.includes('mail.google.com') || hostname.includes('gmail.com')) {
        return 'gmail';
    }
    if (hostname.includes('linkedin.com')) {
        return 'linkedin';
    }
    return null;
};

// Cache for packages loaded from API
let cachedPackages = null;
let packagesLoadPromise = null;

// Minimal generic package fallback (used if API fails)
const FALLBACK_GENERIC_PACKAGE = {
    name: 'generic',
    base: true,
    description: 'general professional emails not fitting specific categories',
    intent: 'general inquiry or communication',
    userIntent: 'I am writing a general professional email',
    roleDescription: 'a professional email writer',
    contextSpecific: 'Write a professional, clear, and appropriate response'
};

// Helper function to load packages from API or cache
const loadPackagesFromAPI = async () => {
    // Return cached packages if available
    if (cachedPackages) {
        return cachedPackages;
    }

    // If already loading, wait for that promise
    if (packagesLoadPromise) {
        return packagesLoadPromise;
    }

    // Start loading
    packagesLoadPromise = (async () => {
        try {
            // Try to get from storage first (cached by Options page)
            const browserAPI = typeof chrome !== 'undefined' && chrome.storage ? chrome : (typeof browser !== 'undefined' && browser.storage ? browser : null);
            if (browserAPI && browserAPI.storage) {
                const stored = await new Promise((resolve) => {
                    browserAPI.storage.sync.get(['cachedPackages', 'cachedPackagesTimestamp'], (result) => {
                        resolve(result);
                    });
                });

                // Use cached packages if less than 1 hour old
                if (stored.cachedPackages && stored.cachedPackagesTimestamp) {
                    const cacheAge = Date.now() - stored.cachedPackagesTimestamp;
                    if (cacheAge < 3600000) { // 1 hour
                        cachedPackages = stored.cachedPackages;
                        packagesLoadPromise = null;
                        return cachedPackages;
                    }
                }
            }

            // Fetch from API
            const response = await fetch(`${VERCEL_PROXY_URL}/packages/definitions`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.packages && Array.isArray(data.packages)) {
                cachedPackages = data.packages;

                // Cache in storage
                if (browserAPI && browserAPI.storage) {
                    browserAPI.storage.sync.set({
                        cachedPackages: cachedPackages,
                        cachedPackagesTimestamp: Date.now(),
                    });
                }

                packagesLoadPromise = null;
                return cachedPackages;
            } else {
                throw new Error('Invalid API response');
            }
        } catch (error) {
            console.error('Failed to load packages from API:', error);
            // Fallback to generic package only
            cachedPackages = [FALLBACK_GENERIC_PACKAGE];
            packagesLoadPromise = null;
            return cachedPackages;
        }
    })();

    return packagesLoadPromise;
};

// Helper function to get the base package name dynamically
const getBasePackageName = async () => {
    const packages = await loadPackagesFromAPI();
    const basePackage = packages.find(p => p.base === true);
    return basePackage ? basePackage.name : 'generic'; // Fallback if no base package found
};

// Function to get user's default role from storage
const getDefaultRole = async () => {
    return new Promise(async (resolve) => {
        const browserAPI = typeof chrome !== 'undefined' && chrome.storage ? chrome : (typeof browser !== 'undefined' && browser.storage ? browser : null);
        if (!browserAPI || !browserAPI.storage) {
            const baseName = await getBasePackageName();
            resolve(baseName);
            return;
        }

        browserAPI.storage.sync.get(['defaultRole'], async (result) => {
            const baseName = await getBasePackageName();
            const defaultRole = result.defaultRole && typeof result.defaultRole === 'string'
                ? result.defaultRole
                : baseName;
            resolve(defaultRole);
        });
    });
};

// Function to get user-selected packages from storage, defaulting to base package if none selected
const getUserPackages = async () => {
    return new Promise(async (resolve) => {
        // Load packages from API first
        const allPackages = await loadPackagesFromAPI();

        const browserAPI = typeof chrome !== 'undefined' && chrome.storage ? chrome : (typeof browser !== 'undefined' && browser.storage ? browser : null);
        if (!browserAPI || !browserAPI.storage) {
            // Fallback to base package if storage is not available
            resolve(allPackages.filter(p => p.base));
            return;
        }

        browserAPI.storage.sync.get(['selectedPackages', 'subscriptionPlan', 'licenseKey'], async (result) => {
            // Get subscription plan, default to 'free' if not set
            const subscriptionPlanName = result.subscriptionPlan && typeof result.subscriptionPlan === 'string'
                ? result.subscriptionPlan
                : 'free';

            // Check if Ultimate plan (allContent) - get from license validation if available
            // For now, check if subscriptionPlan is 'ultimate'
            const isUltimatePlan = subscriptionPlanName === 'ultimate';

            // Check if allContent is enabled (Ultimate plan)
            if (isUltimatePlan) {
                // Return all packages - no filtering needed
                resolve(allPackages);
                return;
            }

            // Otherwise, use existing logic with selectedPackages
            const basePackageName = await getBasePackageName();
            const selectedPackageNames = result.selectedPackages && Array.isArray(result.selectedPackages) && result.selectedPackages.length > 0
                ? result.selectedPackages
                : [basePackageName]; // Default to base package if none selected

            // Filter packages to only include selected packages
            const userPackages = allPackages.filter(p => selectedPackageNames.includes(p.name));

            // Ensure base package is always available as fallback
            if (userPackages.length === 0 || !userPackages.find(p => p.base)) {
                const genericPackage = allPackages.find(p => p.base);
                if (genericPackage) {
                    userPackages.push(genericPackage);
                }
            }

            resolve(userPackages);
        });
    });
};

// Extract user's sent emails from thread (for style analysis)
const extractUserEmails = (platform, richContext) => {
    const userEmails = [];
    const seenTexts = new Set(); // Avoid duplicates

    if (platform === 'gmail') {
        // Method 1: Look for "Sent" labels or indicators in thread items
        const threadItems = document.querySelectorAll('div[role="listitem"]');
        threadItems.forEach(item => {
            // Check for "Sent" indicator (Gmail shows this for sent messages)
            const hasSentLabel = item.innerText?.includes('Sent') ||
                item.querySelector('[aria-label*="Sent"]') ||
                item.querySelector('.g2, .g3, .g4, .g5, .g6, .g7, .g8, .g9, .gA, .gB'); // Gmail sent message classes

            if (hasSentLabel) {
                const messageDiv = item.querySelector('div[dir="ltr"], div[aria-label="Message Body"]');
                if (messageDiv && messageDiv.getAttribute('role') !== 'textbox') {
                    const text = messageDiv.innerText?.trim() || messageDiv.textContent?.trim() || '';
                    // Clean text: remove quoted replies, signatures, etc.
                    const cleanText = text
                        .replace(/On .* wrote:.*/gs, '')
                        .replace(/From:.*/gi, '')
                        .replace(/Sent:.*/gi, '')
                        .replace(/To:.*/gi, '')
                        .replace(/Subject:.*/gi, '')
                        .trim();

                    if (cleanText && cleanText.length > 30 && !seenTexts.has(cleanText)) {
                        seenTexts.add(cleanText);
                        userEmails.push(cleanText);
                    }
                }
            }
        });

        // Method 2: Look for messages that don't have "From:" indicators (likely sent by user)
        // This is a fallback if Method 1 doesn't find enough
        if (userEmails.length === 0) {
            const allMessageBodies = document.querySelectorAll('div[aria-label="Message Body"]');
            allMessageBodies.forEach(body => {
                if (body.getAttribute('role') === 'textbox') return; // Skip compose box

                const text = body.innerText?.trim() || '';
                // If message doesn't have "From:" or "On ... wrote:" patterns, it might be from user
                if (text && text.length > 30 &&
                    !text.match(/^From:/i) &&
                    !text.match(/^On .+ wrote:/i) &&
                    !seenTexts.has(text)) {
                    seenTexts.add(text);
                    userEmails.push(text);
                }
            });
        }
    } else if (platform === 'linkedin') {
        // For LinkedIn, user's messages are typically in containers with specific classes
        // User messages are usually on the right side or have "msg-s-message-listitem--by-current-user" class
        const userMessageItems = document.querySelectorAll(
            '.msg-s-message-listitem--by-current-user .msg-s-message-list__message-body, ' +
            '.msg-s-message-listitem[data-test-id*="current-user"] .msg-s-message-list__message-body'
        );

        userMessageItems.forEach(block => {
            const text = block.innerText?.trim() || block.textContent?.trim() || '';
            if (text && text.length > 20 && !seenTexts.has(text)) {
                seenTexts.add(text);
                userEmails.push(text);
            }
        });

        // Fallback: Look for all message bodies and try to identify user's messages
        if (userEmails.length === 0) {
            const messageBlocks = document.querySelectorAll('.msg-s-message-list__message-body');
            messageBlocks.forEach(block => {
                const parent = block.closest('.msg-s-message-listitem');
                // Check if message is aligned right (user's messages) or has specific attributes
                const isRightAligned = parent && (
                    parent.classList.contains('msg-s-message-listitem--by-current-user') ||
                    parent.querySelector('[data-test-id*="current-user"]') ||
                    window.getComputedStyle(parent).textAlign === 'right'
                );

                if (isRightAligned) {
                    const text = block.innerText?.trim() || block.textContent?.trim() || '';
                    if (text && text.length > 20 &&
                        !text.includes('connected') &&
                        !text.includes('viewed') &&
                        !text.includes('liked') &&
                        !seenTexts.has(text)) {
                        seenTexts.add(text);
                        userEmails.push(text);
                    }
                }
            });
        }
    }

    return userEmails;
};

// Analyze writing style from user's emails
const analyzeWritingStyle = async (userEmails, platform) => {
    if (!userEmails || userEmails.length === 0) {
        return null; // No user emails to analyze
    }

    // Use new API endpoint for style analysis
    await loadApiConfig();
    const classificationModel = apiConfig.provider === 'openai'
        ? 'gpt-4o-mini'
        : 'grok-4-fast';

    try {
        const response = await fetch(`${VERCEL_PROXY_URL}/analyze-style`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userEmails: userEmails,
                provider: apiConfig.provider,
                model: classificationModel
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        // API returns structured response with defaults already applied
        const styleAnalysis = await response.json();

        // Return the response directly (API already handles defaults and formatting)
        return styleAnalysis;
    } catch (error) {
        console.error('Style analysis error:', error);
        return null;
    }
};

// OPTIMIZATION: Helper function to truncate text to reduce token count
const truncateText = (text, maxChars = 2000) => {
    if (!text || text.length <= maxChars) return text;
    // Truncate and add indicator
    return text.substring(0, maxChars) + '\n...[truncated for brevity]';
};

// OPTIMIZATION: Helper function to create compact package description for prompts
const getCompactPackageInfo = (pkg) => {
    // Only include essential fields to reduce tokens
    return `${pkg.name}: ${pkg.description}`;
};

// Email classification function - uses AI to classify email type and extract entities
// onProgress callback is called with { step: 'type'|'goals'|'tone', data: {...} } as each step completes
const classifyEmail = async (richContext, sourceMessageText, platform, threadHistory = '', senderName = null, onProgress = null) => {
    try {
        await loadApiConfig();

        // Load cached style profile only if style mimicking is enabled
        let currentStyleProfile = null;
        if (apiConfig.enableStyleMimicking) {
            currentStyleProfile = await loadStyleProfile();

            // OPTIMIZATION: Defer style analysis to run in background (not on critical path)
            // Extract user emails for background analysis
            const userEmails = extractUserEmails(platform, richContext);

            // Start style analysis in background (don't await - fire and forget)
            // This will update the cached profile for future requests
            if (userEmails.length > 0) {
                // Run style analysis asynchronously without blocking classification
                (async () => {
                    try {
                        const newStyleObservations = await analyzeWritingStyle(userEmails, platform);
                        if (newStyleObservations) {
                            // Merge with existing profile (fine-tuning)
                            const updatedProfile = mergeStyleProfile(currentStyleProfile, newStyleObservations);
                            // Save updated profile for future use
                            await saveStyleProfile(updatedProfile);
                        }
                    } catch (styleError) {
                        console.warn('Background style analysis failed:', styleError);
                    }
                })();
            }
        } else {
            // If style mimicking is disabled, use default profile (won't be used in prompts anyway)
            currentStyleProfile = defaultStyleProfile;
        }

        // Use cheaper/faster models for classification
        const classificationModel = apiConfig.provider === 'openai'
            ? 'gpt-4o-mini'
            : 'grok-4-fast';

        // Get numVariants for the classification prompt
        const numVariants = apiConfig.numVariants || 4;

        // Get user-selected packages from storage (defaults to base package if none selected)
        const userPackages = await getUserPackages();

        // Step 1: Determine email type based on packages using new API endpoint
        // CRITICAL: This determines the type based on the SPECIFIC email being replied to, NOT the overall thread

        // Extract the actual email being replied to and thread history separately
        // sourceMessageText is the ACTUAL email being replied to (not latest, but the specific one)
        const emailBeingRepliedTo = sourceMessageText || '';
        // Use provided threadHistory if available, otherwise fall back to richContext.thread
        // threadHistory should NOT include the email being replied to
        const previousThreadHistory = threadHistory || (richContext.thread && richContext.thread !== 'New message'
            ? richContext.thread
            : '');

        // Use senderName if provided (extracted from the email being replied to), otherwise fall back to richContext
        const actualSenderName = senderName || richContext.recipientName || '';

        // First API call: Determine type using new endpoint
        // CRITICAL: Do NOT include thread history here - LLMs are influenced by text even when told to "ignore" it
        // The user's test showed that the same email text produces correct classification when standalone,
        // but wrong classification when thread history is included (even with "IGNORE" instructions)
        let typeMatchResult;
        try {
            const response = await fetch(`${VERCEL_PROXY_URL}/classify-email-type`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    emailContent: emailBeingRepliedTo,
                    recipientName: richContext.recipientName || richContext.to || actualSenderName,
                    recipientCompany: richContext.recipientCompany,
                    subject: richContext.subject && richContext.subject !== 'LinkedIn Message' ? richContext.subject : undefined,
                    availablePackages: userPackages,
                    confidenceThreshold: apiConfig.classificationConfidenceThreshold !== undefined ? apiConfig.classificationConfidenceThreshold : 0.85,
                    provider: apiConfig.provider,
                    model: classificationModel
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            typeMatchResult = await response.json();
        } catch (typeError) {
            console.error('Type determination error:', typeError);
            // Fallback to base package type
            typeMatchResult = {
                matched_type: userPackages.find(p => p.base),
                confidence: 1.0,
                reason: 'Type determination failed, using base package fallback'
            };
        }

        let matchedType = typeMatchResult.matched_type || userPackages.find(p => p.base);

        // Check confidence threshold - force base package if below threshold
        const confidence = typeMatchResult.confidence !== undefined ? typeMatchResult.confidence : 0;
        const minConfidence = apiConfig.classificationConfidenceThreshold !== undefined ? apiConfig.classificationConfidenceThreshold : 0.85;
        if (confidence < minConfidence && matchedType && !matchedType.base) {
            // userPackages always includes base package, so this should always find it
            matchedType = userPackages.find(p => p.base);
        }

        // Ensure matchedType has the base property by finding it in userPackages
        if (matchedType && !matchedType.hasOwnProperty('base')) {
            const foundPackage = userPackages.find(p => p.name === matchedType.name);
            if (foundPackage) {
                matchedType = foundPackage;
            }
        }

        // CRITICAL: Verify that matchedType is actually in userPackages - if not, fall back to base package
        if (matchedType && !userPackages.find(p => p.name === matchedType.name)) {
            matchedType = userPackages.find(p => p.base); // getUserPackages() always includes base package, so this should always find it
        }

        const packageName = matchedType.name;
        const typeIntent = matchedType.intent;

        // Report type determination progress
        if (onProgress) {
            onProgress({ step: 'type', data: { type: packageName, confidence: typeMatchResult.confidence } });
        }

        // ============================================================================
        // STEP 2: INTENT/GOALS DETERMINATION - FOCUS_EMAIL ONLY (COMPLETELY ISOLATED)
        // ============================================================================
        let intentGoalsResult;

        // Check if this is the base package - use base property
        const isBasePackage = matchedType && matchedType.base === true;

        if (isBasePackage) {          // if package is base package
            // Type not available in user's packages - use base package intent logic
            // Intent is defaulted to base package intent, goals are determined based on base package intent
            const genericIntent = matchedType.intent;

            try {
                // Use new API endpoint for generic goals determination
                const response = await fetch(`${VERCEL_PROXY_URL}/determine-goals-generic`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        emailContent: emailBeingRepliedTo,
                        genericIntent: genericIntent,
                        recipientName: actualSenderName || richContext.recipientName || richContext.to,
                        recipientCompany: richContext.recipientCompany,
                        subject: richContext.subject && richContext.subject !== 'LinkedIn Message' ? richContext.subject : undefined,
                        numGoals: apiConfig.numGoals || 3,
                        numVariants: numVariants,
                        provider: apiConfig.provider,
                        model: classificationModel
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
                }

                const genericGoalsResult = await response.json();

                // API already handles defaults and ensures intent is generic
                // Use generic intent and goals from the result
                intentGoalsResult = {
                    intent: genericGoalsResult.intent || genericIntent,  // API returns generic intent
                    response_goals: genericGoalsResult.response_goals || ['Respond appropriately', 'Address the question', 'Provide information'],
                    goal_titles: genericGoalsResult.goal_titles || {},
                    variant_sets: genericGoalsResult.variant_sets || {},
                    recipient_name: genericGoalsResult.recipient_name || actualSenderName || 'there',
                    recipient_company: genericGoalsResult.recipient_company || null,
                    key_topics: genericGoalsResult.key_topics || []
                };
            } catch (genericError) {
                console.error('Generic goals determination error:', genericError);
                // Fallback with generic values
                intentGoalsResult = {
                    intent: genericIntent,
                    response_goals: ['Respond appropriately', 'Address the question', 'Provide information'],
                    goal_titles: {},
                    variant_sets: {},
                    recipient_name: actualSenderName || 'there',
                    recipient_company: null,
                    key_topics: []
                };
            }

            // ============================================================================
            // LIMIT GOALS TO CONFIGURED numGoals
            // ============================================================================
            const maxGoals = apiConfig.numGoals || 3;
            if (intentGoalsResult.response_goals && intentGoalsResult.response_goals.length > maxGoals) {
                intentGoalsResult.response_goals = intentGoalsResult.response_goals.slice(0, maxGoals);
                // Update goal_titles and variant_sets to match
                const limitedGoalTitles = {};
                const limitedVariantSets = {};
                intentGoalsResult.response_goals.forEach(goal => {
                    if (intentGoalsResult.goal_titles && intentGoalsResult.goal_titles[goal]) {
                        limitedGoalTitles[goal] = intentGoalsResult.goal_titles[goal];
                    }
                    if (intentGoalsResult.variant_sets && intentGoalsResult.variant_sets[goal]) {
                        limitedVariantSets[goal] = intentGoalsResult.variant_sets[goal];
                    }
                });
                intentGoalsResult.goal_titles = limitedGoalTitles;
                intentGoalsResult.variant_sets = limitedVariantSets;
            }

            // Limit tones per goal to configured numTones
            const maxTones = apiConfig.numTones || 3;
            if (intentGoalsResult.tone_sets) {
                Object.keys(intentGoalsResult.tone_sets).forEach(goal => {
                    if (Array.isArray(intentGoalsResult.tone_sets[goal]) && intentGoalsResult.tone_sets[goal].length > maxTones) {
                        intentGoalsResult.tone_sets[goal] = intentGoalsResult.tone_sets[goal].slice(0, maxTones);
                    }
                });
            }

            // ============================================================================
            // LIMIT BASE PACKAGE TO CONFIGURED numGoals - FOR REPLIES
            // ============================================================================
            // Limit base package to configured numGoals (already limited above, but ensure variants are correct)
            if (intentGoalsResult.response_goals && intentGoalsResult.response_goals.length > 0) {
                // Ensure variants are correct for each goal
                intentGoalsResult.response_goals.forEach(goal => {
                    if (intentGoalsResult.variant_sets && intentGoalsResult.variant_sets[goal]) {
                        const variants = intentGoalsResult.variant_sets[goal];
                        // Ensure we have the expected number of variants
                        if (variants.length < numVariants) {
                            // Pad with fallback variants if needed
                            const fallbackVariants = ['Professional', 'Friendly', 'Concise', 'Warm', 'Direct', 'Polite'];
                            const needed = numVariants - variants.length;
                            const additional = fallbackVariants.filter(v => !variants.includes(v)).slice(0, needed);
                            variants.push(...additional);
                        }
                        // Limit to numVariants if more than expected
                        intentGoalsResult.variant_sets[goal] = variants.slice(0, numVariants);
                    }
                });
            }
        } else {
            // Type is available - use normal intent/goals determination from email
            // CRITICAL: This call sees ONLY the FOCUS_EMAIL - NO thread history at all
            // This ensures intent and goals are determined solely from the specific email
            // BUT: We now include type-specific context to guide appropriate intent and variant generation
            try {
                // Use new API endpoint for reply goals determination
                const response = await fetch(`${VERCEL_PROXY_URL}/determine-goals-reply`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        emailContent: emailBeingRepliedTo,
                        package: matchedType,
                        recipientName: actualSenderName || richContext.recipientName || richContext.to,
                        recipientCompany: richContext.recipientCompany,
                        subject: richContext.subject && richContext.subject !== 'LinkedIn Message' ? richContext.subject : undefined,
                        numGoals: apiConfig.numGoals || 3,
                        numVariants: numVariants,
                        provider: apiConfig.provider,
                        model: classificationModel
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
                }

                intentGoalsResult = await response.json();
            } catch (intentError) {
                console.error('Intent/Goals determination error:', intentError);
                // Fallback with generic values
                intentGoalsResult = {
                    intent: 'General inquiry or follow-up',
                    response_goals: ['Respond appropriately', 'Address the question', 'Provide information'],
                    goal_titles: {},
                    variant_sets: {},
                    recipient_name: actualSenderName || 'there',
                    recipient_company: null,
                    key_topics: []
                };
            }

            // Limit variant_sets to configured numVariants for specialized packages
            if (intentGoalsResult.variant_sets && intentGoalsResult.response_goals) {
                intentGoalsResult.response_goals.forEach(goal => {
                    if (intentGoalsResult.variant_sets[goal] && Array.isArray(intentGoalsResult.variant_sets[goal])) {
                        intentGoalsResult.variant_sets[goal] = intentGoalsResult.variant_sets[goal].slice(0, numVariants);
                    }
                });
            }
        }

        // Report goals determination progress
        if (onProgress) {
            onProgress({
                step: 'goals',
                data: {
                    intent: intentGoalsResult.intent,
                    response_goals: intentGoalsResult.response_goals,
                    goal_titles: intentGoalsResult.goal_titles
                }
            });
        }

        // ============================================================================
        // STEP 3: TONE/DYNAMIC DETERMINATION - CAN USE FULL THREAD
        // ============================================================================
        // This call can see the full thread to determine appropriate tone and dynamic
        // The intent and goals are already locked from Step 2
        let toneResult;
        try {
            // Use new API endpoint for tone determination
            const response = await fetch(`${VERCEL_PROXY_URL}/determine-tones-reply`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    emailContent: emailBeingRepliedTo,
                    threadHistory: previousThreadHistory,
                    intent: intentGoalsResult.intent,
                    responseGoals: intentGoalsResult.response_goals,
                    numTones: apiConfig.numTones || 3,
                    provider: apiConfig.provider,
                    model: classificationModel
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            toneResult = await response.json();

            // Clean and validate tone values - they should be short tone names, not full email text
            const cleanToneValue = (tone) => {
                if (!tone || typeof tone !== 'string') return 'professional';
                const trimmed = tone.trim();

                // If tone is clearly email content (too long), extract first meaningful word
                if (trimmed.length > 50) {
                    // Likely email content - extract first word and capitalize properly
                    const firstWord = trimmed.split(/\s+/)[0].toLowerCase();
                    // Capitalize first letter
                    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
                }

                // For normal tones, limit to 2 words max and preserve capitalization
                const words = trimmed.split(/\s+/).slice(0, 2);
                const cleaned = words.join(' ');

                // Capitalize first letter of each word for proper display
                const capitalized = cleaned.split(' ').map(word =>
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                ).join(' ');

                // If result is empty or still too long, fallback to professional
                return capitalized && capitalized.length <= 30 ? capitalized : 'Professional';
            };

            // Clean tone_needed
            if (toneResult.tone_needed) {
                toneResult.tone_needed = cleanToneValue(toneResult.tone_needed);
            }

            // Clean all tone_sets values
            if (toneResult.tone_sets && typeof toneResult.tone_sets === 'object') {
                Object.keys(toneResult.tone_sets).forEach(goal => {
                    if (Array.isArray(toneResult.tone_sets[goal])) {
                        toneResult.tone_sets[goal] = toneResult.tone_sets[goal].map(cleanToneValue).filter((t, i, arr) => arr.indexOf(t) === i); // Remove duplicates
                    }
                });
            }
        } catch (toneError) {
            console.error('Tone determination error:', toneError);
            // Fallback with professional tone
            toneResult = {
                tone_needed: 'Professional and friendly',
                tone_sets: {}
            };
        }

        // Report tone determination progress
        if (onProgress) {
            onProgress({
                step: 'tone',
                data: {
                    tone_needed: toneResult.tone_needed || 'Professional',
                    tone_sets: toneResult.tone_sets || {},
                    currentGoal: intentGoalsResult.response_goals?.[0] || null
                }
            });
        }

        // ============================================================================
        // COMBINE RESULTS FROM ALL STEPS
        // ============================================================================
        // Merge results: type from Step 1, intent/goals from Step 2, tone from Step 3
        const combinedResult = {
            type: packageName,
            intent: intentGoalsResult.intent,
            response_goals: intentGoalsResult.response_goals,
            goal_titles: intentGoalsResult.goal_titles || {},
            tone_needed: toneResult.tone_needed || 'Professional',
            tone_sets: toneResult.tone_sets || {},
            variant_sets: intentGoalsResult.variant_sets || {},
            recipient_name: intentGoalsResult.recipient_name || actualSenderName || 'there',
            recipient_company: intentGoalsResult.recipient_company || null,
            key_topics: intentGoalsResult.key_topics || []
        };

        // Use the combined result as our content for further processing
        let content = JSON.stringify(combinedResult);

        // Clean up content - remove markdown code blocks if present
        content = content.trim();
        if (content.startsWith('```json')) {
            content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (content.startsWith('```')) {
            content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        // Validate content before parsing
        if (!content || content === '{}' || content.length === 0) {
            console.warn('Classification API returned empty or invalid content:', content);
            throw new Error('Empty classification response');
        }

        // Try to fix common JSON issues - handle truncated responses
        let fixedContent = content;

        // Step 1: Find and remove incomplete strings (strings that don't have a closing quote)
        // Track string state properly, accounting for escaped quotes
        let inString = false;
        let escapeNext = false;
        let lastValidChar = -1;

        for (let i = 0; i < fixedContent.length; i++) {
            const char = fixedContent[i];
            if (escapeNext) {
                escapeNext = false;
                lastValidChar = i;
                continue;
            }
            if (char === '\\') {
                escapeNext = true;
                lastValidChar = i;
                continue;
            }
            if (char === '"') {
                inString = !inString;
                lastValidChar = i;
            } else if (!inString) {
                lastValidChar = i;
            }
        }

        // If we're still in a string at the end, truncate before the incomplete string
        if (inString && lastValidChar >= 0) {
            // Find where the incomplete string started
            let searchStart = Math.max(0, lastValidChar - 200);
            let stringStart = fixedContent.lastIndexOf('"', lastValidChar);

            // Verify it's actually a string start (not escaped and followed by :)
            while (stringStart > searchStart) {
                // Check if the quote is escaped
                let beforeQuote = fixedContent.substring(Math.max(0, stringStart - 1), stringStart);
                if (beforeQuote !== '\\') {
                    // Check if it looks like a key (has : after) or value (has , or } or ] after)
                    let afterQuote = fixedContent.substring(stringStart + 1, Math.min(fixedContent.length, stringStart + 10)).trim();
                    if (afterQuote.startsWith(':') || afterQuote.startsWith(',') || afterQuote.startsWith('}') || afterQuote.startsWith(']')) {
                        // This might be a key, keep looking
                        stringStart = fixedContent.lastIndexOf('"', stringStart - 1);
                        continue;
                    }
                    // This looks like a value string that's incomplete
                    fixedContent = fixedContent.substring(0, stringStart);
                    // Remove trailing comma if present
                    fixedContent = fixedContent.replace(/,\s*$/, '');
                    break;
                }
                stringStart = fixedContent.lastIndexOf('"', stringStart - 1);
            }
        } else {
            fixedContent = fixedContent.substring(0, lastValidChar + 1);
        }

        // Step 2: Fix common pattern where array closes with } instead of ]
        // Pattern: ["item1", "item2" } should be ["item1", "item2"] }
        // This must happen BEFORE we calculate depths

        // First, count brackets to see if we have unclosed arrays
        let openBrackets = (fixedContent.match(/\[/g) || []).length;
        let closeBrackets = (fixedContent.match(/\]/g) || []).length;

        if (openBrackets > closeBrackets) {
            // We have unclosed arrays - fix patterns where arrays close with } instead of ]
            // Pattern 1: Direct array content followed by }
            // ["item1", "item2" } -> ["item1", "item2"] }
            fixedContent = fixedContent.replace(/(\[[^\]]*"[^"]*"(?:\s*,\s*"[^"]*")*)\s*\}\s*([,}])/g, '$1]$2');

            // Pattern 2: More aggressive - find "text" } patterns and fix them if we're in array context
            // This handles: "Keep door open" } -> "Keep door open"] }
            // We'll do a simple replacement: if we have unclosed brackets, replace "text" } with "text"] }
            // But only if the } is followed by , or } (indicating it's closing a structure)
            fixedContent = fixedContent.replace(/"([^"]*)"\s*\}\s*([,}])/g, (match, text, after, offset) => {
                // Check if we're likely in an array by counting brackets before this position
                const before = fixedContent.substring(0, offset);
                const openBefore = (before.match(/\[/g) || []).length;
                const closeBefore = (before.match(/\]/g) || []).length;
                // If we have more open brackets than close brackets, we're in an array
                if (openBefore > closeBefore) {
                    return `"${text}"]${after}`;
                }
                return match;
            });
        }

        // Step 3: Close incomplete structures (arrays first, then objects)
        // Track depth to properly close nested structures
        let bracketDepth = 0;
        let braceDepth = 0;
        // Reset string tracking for depth calculation
        inString = false;
        escapeNext = false;

        for (let i = 0; i < fixedContent.length; i++) {
            const char = fixedContent[i];
            if (escapeNext) {
                escapeNext = false;
                continue;
            }
            if (char === '\\') {
                escapeNext = true;
                continue;
            }
            if (char === '"') {
                inString = !inString;
            } else if (!inString) {
                if (char === '[') bracketDepth++;
                else if (char === ']') bracketDepth--;
                else if (char === '{') braceDepth++;
                else if (char === '}') braceDepth--;
            }
        }

        // Close arrays first (they're nested inside objects)
        while (bracketDepth > 0) {
            fixedContent = fixedContent.trim().replace(/,\s*$/, '') + ']';
            bracketDepth--;
        }

        // Then close objects
        while (braceDepth > 0) {
            fixedContent = fixedContent.trim().replace(/,\s*$/, '') + '}';
            braceDepth--;
        }

        // Step 4: Remove trailing commas before closing braces/brackets
        fixedContent = fixedContent.replace(/,\s*([}\]])/g, '$1');

        try {
            const classification = JSON.parse(fixedContent);

            // Extract and validate new structure
            let response_goals = Array.isArray(classification.response_goals) && classification.response_goals.length > 0
                ? classification.response_goals
                : ['respond appropriately'];

            const tone_sets = classification.tone_sets && typeof classification.tone_sets === 'object'
                ? classification.tone_sets
                : {};

            let variant_sets = classification.variant_sets && typeof classification.variant_sets === 'object'
                ? classification.variant_sets
                : {};

            let goal_titles = classification.goal_titles && typeof classification.goal_titles === 'object'
                ? classification.goal_titles
                : {};

            // Limit goals to configured numGoals
            const maxGoals = apiConfig.numGoals || 3;
            if (response_goals.length > maxGoals) {
                response_goals = response_goals.slice(0, maxGoals);
                // Also limit goal_titles and variant_sets to match
                const limitedGoalTitles = {};
                const limitedVariantSets = {};
                const limitedToneSets = {};
                response_goals.forEach(goal => {
                    if (goal_titles[goal]) limitedGoalTitles[goal] = goal_titles[goal];
                    if (variant_sets[goal]) limitedVariantSets[goal] = variant_sets[goal];
                    if (tone_sets[goal]) limitedToneSets[goal] = tone_sets[goal];
                });
                goal_titles = limitedGoalTitles;
                variant_sets = limitedVariantSets;
                // Update tone_sets in classification object
                Object.keys(tone_sets).forEach(goal => {
                    if (!response_goals.includes(goal)) {
                        delete tone_sets[goal];
                    } else if (Array.isArray(tone_sets[goal]) && tone_sets[goal].length > maxGoals) {
                        // Limit tones per goal to configured numTones
                        const maxTones = apiConfig.numTones || 3;
                        tone_sets[goal] = tone_sets[goal].slice(0, maxTones);
                    }
                });
            } else {
                // Limit tones per goal to configured numTones even if goals are within limit
                const maxTones = apiConfig.numTones || 3;
                Object.keys(tone_sets).forEach(goal => {
                    if (Array.isArray(tone_sets[goal]) && tone_sets[goal].length > maxTones) {
                        tone_sets[goal] = tone_sets[goal].slice(0, maxTones);
                    }
                });
            }

            // Helper function to generate short title from goal text
            const generateShortTitle = (goal) => {
                const words = goal.split(' ');
                if (words.length <= 3) return goal;
                return words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            };

            // Ensure tone_sets, variant_sets, and goal_titles have entries for each response_goal
            response_goals.forEach(goal => {
                if (!tone_sets[goal] || !Array.isArray(tone_sets[goal]) || tone_sets[goal].length === 0) {
                    tone_sets[goal] = [classification.tone_needed || 'professional'];
                }
                const expectedNumVariants = apiConfig.numVariants || 4;
                if (!variant_sets[goal] || !Array.isArray(variant_sets[goal]) || variant_sets[goal].length !== expectedNumVariants) {
                    const defaultVariants = [
                        'Friendly response',
                        'Insightful response',
                        'Polite response',
                        'Professional neutral response',
                        'Concise response',
                        'Brief response',
                        'Detailed response'
                    ];
                    variant_sets[goal] = defaultVariants.slice(0, expectedNumVariants);
                }
                if (!goal_titles[goal]) {
                    goal_titles[goal] = generateShortTitle(goal);
                }
            });

            // Get primary tone from first goal's tone_set
            const primaryGoal = response_goals[0];
            const tone_needed = (tone_sets[primaryGoal] && tone_sets[primaryGoal][0])
                ? tone_sets[primaryGoal][0]
                : (classification.tone_needed || 'professional');

            return {
                type: classification.type || packageName || getBasePackageName(),
                intent: classification.intent || 'general inquiry',
                response_goals: response_goals,
                goal_titles: goal_titles,
                tone_needed: tone_needed,
                tone_sets: tone_sets,
                variant_sets: variant_sets,
                recipient_name: classification.recipient_name || richContext.recipientName || '',
                recipient_company: classification.recipient_company || richContext.recipientCompany || null,
                key_topics: classification.key_topics || [],
                writing_style: currentStyleProfile // Include style profile for generation
            };
        } catch (parseError) {
            console.warn('Failed to parse classification JSON:', parseError);
            console.warn('Original content length:', content.length);
            console.warn('Fixed content length:', fixedContent.length);
            console.warn('Content preview (first 500 chars):', content.substring(0, 500));
            console.warn('Content preview (last 500 chars):', content.substring(Math.max(0, content.length - 500)));

            // Try one more time with a more aggressive fix
            try {
                // Remove everything after the last complete JSON object
                let lastCompleteJson = fixedContent;
                const jsonObjects = [];
                let depth = 0;
                let start = 0;

                for (let i = 0; i < fixedContent.length; i++) {
                    if (fixedContent[i] === '{') {
                        if (depth === 0) start = i;
                        depth++;
                    } else if (fixedContent[i] === '}') {
                        depth--;
                        if (depth === 0) {
                            jsonObjects.push(fixedContent.substring(start, i + 1));
                        }
                    }
                }

                if (jsonObjects.length > 0) {
                    lastCompleteJson = jsonObjects[jsonObjects.length - 1];
                    const classification = JSON.parse(lastCompleteJson);
                    console.warn('Successfully parsed after aggressive fix');

                    // Process the classification the same way as the normal path
                    const response_goals = Array.isArray(classification.response_goals) && classification.response_goals.length > 0
                        ? classification.response_goals
                        : ['respond appropriately'];

                    const tone_sets = classification.tone_sets && typeof classification.tone_sets === 'object'
                        ? classification.tone_sets
                        : {};

                    const variant_sets = classification.variant_sets && typeof classification.variant_sets === 'object'
                        ? classification.variant_sets
                        : {};

                    const goal_titles = classification.goal_titles && typeof classification.goal_titles === 'object'
                        ? classification.goal_titles
                        : {};

                    // Helper function to generate short title from goal text
                    const generateShortTitle = (goal) => {
                        const words = goal.split(' ');
                        if (words.length <= 3) return goal;
                        return words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    };

                    response_goals.forEach(goal => {
                        if (!tone_sets[goal] || !Array.isArray(tone_sets[goal]) || tone_sets[goal].length === 0) {
                            tone_sets[goal] = [classification.tone_needed || 'professional'];
                        }
                        const expectedNumVariants = apiConfig.numVariants || 4;
                        if (!variant_sets[goal] || !Array.isArray(variant_sets[goal]) || variant_sets[goal].length !== expectedNumVariants) {
                            const defaultVariants = [
                                'Friendly response',
                                'Insightful response',
                                'Polite response',
                                'Professional neutral response',
                                'Concise response',
                                'Brief response',
                                'Detailed response'
                            ];
                            variant_sets[goal] = defaultVariants.slice(0, expectedNumVariants);
                        }
                        if (!goal_titles[goal]) {
                            goal_titles[goal] = generateShortTitle(goal);
                        }
                    });

                    const primaryGoal = response_goals[0];
                    const tone_needed = (tone_sets[primaryGoal] && tone_sets[primaryGoal][0])
                        ? tone_sets[primaryGoal][0]
                        : (classification.tone_needed || 'professional');

                    return {
                        type: classification.type || packageName || getBasePackageName(),
                        intent: classification.intent || 'general inquiry',
                        response_goals: response_goals,
                        goal_titles: goal_titles,
                        tone_needed: tone_needed,
                        tone_sets: tone_sets,
                        variant_sets: variant_sets,
                        recipient_name: classification.recipient_name || richContext.recipientName || '',
                        recipient_company: classification.recipient_company || richContext.recipientCompany || null,
                        key_topics: classification.key_topics || [],
                        writing_style: currentStyleProfile // Include style profile for generation
                    };
                } else {
                    throw new Error('No complete JSON object found');
                }
            } catch (secondTryError) {
                console.warn('Second parse attempt also failed:', secondTryError);
                return {
                    type: 'other',
                    intent: 'general inquiry',
                    response_goals: ['respond appropriately'],
                    tone_needed: 'professional',
                    tone_sets: { 'respond appropriately': ['professional'] },
                    variant_sets: {
                        'respond appropriately': [
                            'Friendly response',
                            'Insightful response',
                            'Polite response',
                            'Professional neutral response',
                            'Concise response'
                        ]
                    },
                    recipient_name: richContext.recipientName || '',
                    recipient_company: richContext.recipientCompany || null,
                    key_topics: [],
                    writing_style: currentStyleProfile
                };
            }
        }
    } catch (error) {
        const errorMessage = error?.message || String(error) || 'Unknown error';
        console.warn('Email classification error:', JSON.stringify({
            message: errorMessage,
            error: error?.toString(),
            stack: error?.stack
        }, null, 2));
        // Return safe defaults
        // Load style profile for fallback only if style mimicking is enabled
        const fallbackStyleProfile = apiConfig.enableStyleMimicking
            ? await loadStyleProfile().catch(() => defaultStyleProfile)
            : defaultStyleProfile;
        return {
            type: 'other',
            intent: 'general inquiry',
            response_goals: ['respond appropriately'],
            tone_needed: 'professional',
            tone_sets: { 'respond appropriately': ['professional'] },
            variant_sets: {
                'respond appropriately': [
                    'Friendly response',
                    'Insightful response',
                    'Polite response',
                    'Professional neutral response',
                    'Concise response'
                ]
            },
            recipient_name: richContext.recipientName || '',
            recipient_company: richContext.recipientCompany || null,
            key_topics: [],
            writing_style: fallbackStyleProfile
        };
    }
};

// Enhanced context extraction function - robust for both Gmail and LinkedIn
const getRichContext = () => {
    let to = '';
    let from = '';
    let subject = '';
    let thread = '';
    let recipientName = '';
    let recipientCompany = '';

    if (window.location.href.includes('mail.google.com')) {
        // Gmail
        to = Array.from(document.querySelectorAll('input[aria-label="To recipients"], input[name="to"], input[aria-label="To"]'))
            .map(i => i.value)
            .filter(v => v)
            .join(', ');
        subject = document.querySelector('input[aria-label="Subject"]')?.value || '';
        from = document.querySelector('span[gmail_address]')?.getAttribute('email') || '';

        // Thread messages (reverse chronological → oldest first)
        const messages = Array.from(document.querySelectorAll('div[role="listitem"] div[dir="ltr"]'))
            .map(div => div.innerText.trim())
            .filter(text => text && !text.includes('Generate Response') && !text.includes('xReplAI') && !text.includes('Respond'))
            .reverse();

        thread = messages.join('\n\n---\n\n');

        // Extract name from To field (simple heuristic)
        if (to) {
            recipientName = to.split(',')[0].split('<')[0].trim();
        }
    }
    else if (window.location.href.includes('linkedin.com/messaging')) {
        // LinkedIn Messaging
        to = document.querySelector('.msg-conversation-list__participant-name, .msg-conversation-card__participant-name, .msg-conversation-listitem__participant-name')?.innerText?.trim() || '';
        recipientName = to;
        recipientCompany = document.querySelector('.msg-conversation-list__participant-headline, .msg-conversation-card__participant-headline')?.innerText?.trim() || '';

        // Current conversation thread
        const messageBlocks = Array.from(document.querySelectorAll('.msg-s-message-list__message-body, .msg-s-event-listitem__body, .msg-s-message-listitem__message-body'));
        const messages = messageBlocks
            .map(block => block.innerText?.trim() || block.textContent?.trim() || '')
            .filter(text => text && text.length > 0 && !text.includes('xReplAI') && !text.includes('Respond'))
            .reverse();
        thread = messages.join('\n\n---\n\n');

        subject = 'LinkedIn Message';
    }

    // Clean thread: remove signatures, quoted text, timestamps
    thread = thread
        .replace(/On .* wrote:.*/gs, '') // Gmail quotes
        .replace(/Sent from my iPhone.*/gs, '')
        .replace(/Best regards|Regards|Thanks|Cheers/gs, '')
        .replace(/.*@.*\.com.*/gs, '') // Email addresses
        .replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, '') // Dates
        .replace(/\d{1,2}:\d{2}\s*(AM|PM)?/gi, '') // Times
        .trim();

    return {
        to,
        from,
        subject,
        recipientName,
        recipientCompany,
        thread: thread || 'New message',
        fullContext: `Recipient: ${recipientName}${recipientCompany ? ` (${recipientCompany})` : ''}\nTo: ${to}\nSubject: ${subject}\n\nPrevious conversation:\n${thread}`
    };
};

// Platform-specific adapters
const platformAdapters = {
    gmail: {
        // Find send buttons
        findSendButtons: () => {
            return document.querySelectorAll('.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3');
        },
        // Find compose/message input
        findComposeInput: () => {
            return document.querySelector('div[aria-label="Message Body"][role="textbox"]');
        },
        // Find recipient field
        findRecipientField: () => {
            return document.querySelector('input[aria-label="To"]');
        },
        // Find subject field (Gmail-specific)
        findSubjectField: () => {
            return document.querySelector('input[aria-label="Subject"]');
        },
        // Multi-factor detection: Check if compose action is Reply, Forward, or New Email
        // Priority: Attribution line > Content patterns > DOM structure > Subject line
        // Optional scopedComposeBody parameter allows scoping detection to a specific compose box
        detectComposeAction: (scopedComposeBody = null) => {
            const composeBody = scopedComposeBody || document.querySelector('div[aria-label="Message Body"][role="textbox"]');
            if (!composeBody) return 'new';

            const composeContainer = composeBody.closest('.nH, .aO9, [role="dialog"], .M9, .iN, .aoP') ||
                composeBody.closest('form') ||
                composeBody.parentElement?.parentElement?.parentElement;

            // PRIORITY 1: Check attribution line (most reliable for replies)
            if (composeContainer) {
                const gmailAttr = composeContainer.querySelector('.gmail_attr');
                if (gmailAttr) {
                    const attrText = gmailAttr.innerText || gmailAttr.textContent || '';
                    // "wrote:" is the key indicator of a reply
                    if (/wrote:/i.test(attrText)) {
                        return 'reply';
                    }
                }

                // Check for attribution as sibling of quoted content
                const quotedContent = composeContainer.querySelector('div.gmail_quote, blockquote.gmail_quote, blockquote');
                if (quotedContent) {
                    const attrLine = quotedContent.previousElementSibling;
                    if (attrLine) {
                        const attrText = attrLine.innerText || attrLine.textContent || '';
                        if (/wrote:/i.test(attrText)) {
                            return 'reply';
                        }
                        if (/Forwarded message|Original Message/i.test(attrText)) {
                            return 'forward';
                        }
                    }
                }
            }

            // PRIORITY 2: Check content patterns in compose body
            const composeText = composeBody.innerText || composeBody.textContent || '';

            // Check for Forward patterns (more specific, check first)
            const forwardPatterns = [
                /-{3,}\s*Forwarded message\s*-{3,}/i,
                /Begin forwarded message:/i,
                /^From:\s+.+\n(Sent|Date):\s+/im,
                /^Original Message\s*-+/im,
                /From:\s+.+\nSent:\s+/i,
                /From:\s+.+\nDate:\s+/i
            ];

            for (const pattern of forwardPatterns) {
                if (pattern.test(composeText)) {
                    return 'forward';
                }
            }

            // Check for Reply patterns
            const replyPatterns = [
                /On\s+.+?,\s+.+?\s*<[^>]+>\s*wrote:/i,  // "On date, name <email> wrote:"
                /On\s+.+?,\s+.+?\s+wrote:/i             // "On date, name wrote:"
            ];

            for (const pattern of replyPatterns) {
                if (pattern.test(composeText)) {
                    return 'reply';
                }
            }

            // PRIORITY 3: Check DOM structure
            console.log('[ResponseAble DEBUG detectComposeAction] PRIORITY 3: Checking DOM structure');
            if (composeContainer) {
                const quotedContent = composeContainer.querySelector('div.gmail_quote, blockquote');
                console.log('[ResponseAble DEBUG detectComposeAction] PRIORITY 3: quotedContent found:', !!quotedContent);
                if (quotedContent) {
                    const quoteText = quotedContent.innerText || quotedContent.textContent || '';
                    console.log('[ResponseAble DEBUG detectComposeAction] PRIORITY 3: quoteText length:', quoteText.length);
                    // Check if it looks like a forward (has forward headers but no "wrote:")
                    if (/Forwarded message|Original Message|From:\s+.+\n(Sent|Date):/i.test(quoteText) &&
                        !/wrote:/i.test(quoteText)) {
                        console.log('[ResponseAble DEBUG detectComposeAction] PRIORITY 3: Found forward pattern, returning forward');
                        return 'forward';
                    }
                    // If it has "wrote:" it's likely a reply
                    if (/wrote:/i.test(quoteText)) {
                        console.log('[ResponseAble DEBUG detectComposeAction] PRIORITY 3: Found "wrote:" in quoteText, returning reply');
                        return 'reply';
                    }
                }
            }

            // PRIORITY 4: Fallback to subject line (least reliable)
            const subjectField = document.querySelector('input[aria-label="Subject"]');
            const subjectValue = subjectField?.value || '';
            console.log('[ResponseAble DEBUG detectComposeAction] PRIORITY 4: subjectValue:', subjectValue);

            // Check forward first (more specific)
            if (/fwd?:/i.test(subjectValue)) {
                console.log('[ResponseAble DEBUG detectComposeAction] PRIORITY 4: Found fwd: in subject, returning forward');
                return 'forward';
            }

            // Then check reply
            if (subjectValue.toLowerCase().startsWith('re:')) {
                console.log('[ResponseAble DEBUG detectComposeAction] PRIORITY 4: Found Re: in subject, returning reply');
                return 'reply';
            }

            // PRIORITY 5: Check if there's an email message body above the compose box
            // This is a robust fallback for inline replies where quoted content isn't in the compose container
            const composeRect = composeBody.getBoundingClientRect();
            console.log('[ResponseAble DEBUG detectComposeAction] PRIORITY 5: composeRect top:', composeRect.top);
            const messageBodySelectors = [
                'div.a3s.aiL',      // Primary Gmail message body class
                'div.ii.gt',        // Alternative Gmail message class
                'div[data-message-id] div.a3s',  // Message with ID
                'div.afn',          // Gmail collapsed/expanded message body (discovered in earlier debugging)
            ];

            for (const selector of messageBodySelectors) {
                const messageDivs = document.querySelectorAll(selector);
                console.log('[ResponseAble DEBUG detectComposeAction] PRIORITY 5: selector', selector, 'found', messageDivs.length, 'divs');
                for (const div of messageDivs) {
                    const divRect = div.getBoundingClientRect();
                    // Check if this div is above the compose box and has content
                    if (divRect.bottom <= composeRect.top && divRect.height > 0) {
                        // Found a message body above compose - this is a reply
                        console.log('[ResponseAble DEBUG detectComposeAction] PRIORITY 5: Found message body above compose, returning reply');
                        return 'reply';
                    }
                }
            }

            console.log('[ResponseAble DEBUG detectComposeAction] No reply/forward detected, returning new');
            return 'new';
        },
        // Check if reply or new message (legacy method, kept for backward compatibility)
        isReply: () => {
            const action = platformAdapters.gmail.detectComposeAction();
            return action === 'reply';
        },
        // Check if forward
        isForward: () => {
            const action = platformAdapters.gmail.detectComposeAction();
            return action === 'forward';
        },
        // Get the ACTUAL email being replied to (not the latest, but the specific one the user clicked "Reply" on)
        // CRITICAL FIX: Gmail uses different selectors for thread messages vs compose box
        // Thread messages use: div.a3s.aiL, div.ii.gt, div[data-message-id]
        // Compose box uses: div[aria-label="Message Body"][role="textbox"]
        getEmailBeingRepliedTo: () => {
            const composeBody = document.querySelector('div[aria-label="Message Body"][role="textbox"]');
            if (!composeBody) return null;

            // Gmail message body selectors (in order of preference)
            const messageBodySelectors = [
                'div.a3s.aiL',      // Primary Gmail message body class
                'div.ii.gt',        // Alternative Gmail message class
                'div[data-message-id] div.a3s',  // Message with ID
            ];

            // Strategy 1: Find the message that's visually closest to (above) the compose box
            // This is the email the user clicked "Reply" on
            const composeRect = composeBody.getBoundingClientRect();
            let closestMessage = null;
            let closestDistance = Infinity;

            for (const selector of messageBodySelectors) {
                const messageDivs = document.querySelectorAll(selector);
                for (const div of messageDivs) {
                    const divRect = div.getBoundingClientRect();
                    // Check if this div is above the compose box (its bottom is above compose top)
                    if (divRect.bottom <= composeRect.top && divRect.height > 0) {
                        const distance = composeRect.top - divRect.bottom;
                        if (distance < closestDistance) {
                            closestDistance = distance;
                            closestMessage = div;
                        }
                    }
                }
                // If found with this selector, don't try others
                if (closestMessage) break;
            }

            // Strategy 2: If no message found above compose, find the expanded/active message
            // Gmail typically expands the message being replied to
            if (!closestMessage) {
                for (const selector of messageBodySelectors) {
                    const messageDivs = document.querySelectorAll(selector);
                    if (messageDivs.length > 0) {
                        // Use the last visible message (most recently expanded)
                        for (let i = messageDivs.length - 1; i >= 0; i--) {
                            const div = messageDivs[i];
                            const rect = div.getBoundingClientRect();
                            if (rect.height > 0 && rect.width > 0) {
                                closestMessage = div;
                                break;
                            }
                        }
                        if (closestMessage) break;
                    }
                }
            }

            return closestMessage;
        },
        // Get thread messages for context (all messages except the one being replied to)
        // CRITICAL FIX: Use correct Gmail selectors for thread messages
        getThreadMessages: () => {
            const composeBody = document.querySelector('div[aria-label="Message Body"][role="textbox"]');
            const composeText = composeBody?.innerText?.trim() || '';

            // Gmail message body selectors (same as getEmailBeingRepliedTo)
            const messageBodySelectors = [
                'div.a3s.aiL',      // Primary Gmail message body class
                'div.ii.gt',        // Alternative Gmail message class
            ];

            let allMessageDivs = [];
            for (const selector of messageBodySelectors) {
                const divs = document.querySelectorAll(selector);
                if (divs.length > 0) {
                    allMessageDivs = Array.from(divs).filter(div => {
                        const text = div.innerText?.trim() || '';
                        return text !== composeText && text.length > 0;
                    });
                    break;
                }
            }

            return allMessageDivs
                .map(div => div.innerText.trim())
                .filter(text => text && text.length > 0 && !text.includes('xReplAI') && !text.includes('Respond'));
        },
        // Get detailed information about the SPECIFIC email being replied to
        // CRITICAL: This function extracts the email the user clicked "Reply" on, NOT the latest email in the thread
        // When replying to email #9 in a 25-email thread, this should return email #9's content
        // 
        // KEY FIX: All DOM queries are scoped to the compose container to avoid picking up
        // .gmail_quote elements from other rendered messages on the page
        getRepliedToEmailDetails: () => {
            // Subject - always the compose input (includes "Re:" for replies)
            const subjectInput = document.querySelector('input[aria-label="Subject"], input[name="subjectbox"]');
            const subject = subjectInput ? subjectInput.value : '';

            let senderName = '';
            let senderEmail = '';
            let body = '';

            // STRATEGY 1: Extract from Gmail's quoted content WITHIN the compose window ONLY
            // When you click "Reply" on a specific email, Gmail quotes that email in the compose window
            // CRITICAL: We must scope all queries to the compose container to avoid finding
            // .gmail_quote elements from other rendered messages on the page
            const composeBody = document.querySelector('div[aria-label="Message Body"][role="textbox"]');
            if (composeBody) {
                // Find the compose container - this is the parent that contains the compose form
                // We search progressively outward to find a suitable container
                const composeContainer = composeBody.closest('.nH, .aO9, [role="dialog"], .M9, .iN, .aoP') ||
                    composeBody.closest('form') ||
                    composeBody.parentElement?.parentElement?.parentElement;

                if (composeContainer) {
                    // Look for the quoted content ONLY within the compose container
                    // Gmail uses various selectors for quoted content
                    const quotedSelectors = [
                        'div.gmail_quote',
                        'blockquote.gmail_quote',
                        'div.gmail_extra div.gmail_quote',
                        '.gmail_attr + div'
                    ];

                    let quotedContent = null;
                    for (const selector of quotedSelectors) {
                        // ONLY search within the compose container - NO global document fallback
                        quotedContent = composeContainer.querySelector(selector);
                        if (quotedContent) break;
                    }

                    if (quotedContent) {
                        // CRITICAL: Strip nested quotes to get ONLY the top-level quoted message
                        // Gmail often includes the entire thread history as nested quotes
                        // We want only Rusty's message, not TJ's original job offer below it
                        const clonedQuote = quotedContent.cloneNode(true);

                        // Remove all nested .gmail_quote and blockquote elements
                        const nestedQuotes = clonedQuote.querySelectorAll('div.gmail_quote, blockquote.gmail_quote, blockquote');
                        nestedQuotes.forEach(nested => nested.remove());

                        // Get the text after removing nested quotes
                        body = clonedQuote.innerText?.trim() || clonedQuote.textContent?.trim() || '';

                        // Extract sender info from the attribution line (e.g., "On Jan 5, 2026, John Doe <john@example.com> wrote:")
                        // The attribution line is typically a sibling element before the quote
                        const attrLine = quotedContent.previousElementSibling;
                        if (attrLine) {
                            const attrText = attrLine.innerText || attrLine.textContent || '';
                            // Pattern: "On [date], [Name] <[email]> wrote:"
                            const attrMatch = attrText.match(/On\s+.+?,\s+(.+?)\s*<([^>]+)>\s*wrote:/i);
                            if (attrMatch) {
                                senderName = attrMatch[1].trim();
                                senderEmail = attrMatch[2].trim();
                            } else {
                                // Try simpler pattern: "[Name] <[email]>"
                                const simpleMatch = attrText.match(/([^<]+?)\s*<([^>]+)>/);
                                if (simpleMatch) {
                                    senderName = simpleMatch[1].trim();
                                    senderEmail = simpleMatch[2].trim();
                                }
                            }
                        }

                        // Also look for attribution within the quote itself (sometimes Gmail puts it inside)
                        if (!senderName) {
                            const attrDiv = composeContainer.querySelector('.gmail_attr');
                            if (attrDiv) {
                                const attrText = attrDiv.innerText || attrDiv.textContent || '';
                                const attrMatch = attrText.match(/On\s+.+?,\s+(.+?)\s*<([^>]+)>\s*wrote:/i);
                                if (attrMatch) {
                                    senderName = attrMatch[1].trim();
                                    senderEmail = attrMatch[2].trim();
                                }
                            }
                        }
                    }
                }
            }

            // STRATEGY 2: If no quoted content found in compose, use the email div above the compose box
            // This is the email the user is replying to in the thread view
            if (!body) {
                const emailBeingRepliedTo = platformAdapters.gmail.getEmailBeingRepliedTo();
                if (emailBeingRepliedTo) {
                    // Clone and strip nested quotes from this too
                    const clonedEmail = emailBeingRepliedTo.cloneNode(true);
                    const nestedQuotes = clonedEmail.querySelectorAll('div.gmail_quote, blockquote.gmail_quote, blockquote');
                    nestedQuotes.forEach(nested => nested.remove());

                    body = clonedEmail.innerText?.trim() || clonedEmail.textContent?.trim() || '';

                    // Get sender info from the message container
                    // CRITICAL FIX: Gmail uses div.adn.ads[data-message-id] as the message container
                    // The sender info (span.gD[email][name]) is inside this container
                    const container = emailBeingRepliedTo.closest('div.adn.ads[data-message-id]') ||
                        emailBeingRepliedTo.closest('[data-message-id]') ||
                        emailBeingRepliedTo.closest('[role="listitem"]') ||
                        emailBeingRepliedTo.parentElement;
                    if (container) {
                        // Look for sender name/email in the header using Gmail's span.gD selector
                        const senderSpan = container.querySelector('span.gD[email][name]');
                        if (senderSpan) {
                            senderName = senderSpan.getAttribute('name') || '';
                            senderEmail = senderSpan.getAttribute('email') || '';
                        } else {
                            // Fallback to generic span[name]/span[email]
                            const nameSpan = container.querySelector('span[name]');
                            const emailSpan = container.querySelector('span[email]');
                            if (nameSpan) senderName = nameSpan.getAttribute('name') || '';
                            if (emailSpan) senderEmail = emailSpan.getAttribute('email') || '';
                        }
                    }
                }
            }

            // STRATEGY 3: Fallback - look for sender header elements WITHIN the compose context
            if (!senderName && composeBody) {
                const composeContainer = composeBody.closest('.nH, .aO9, [role="dialog"], .M9, .iN, .aoP') ||
                    composeBody.closest('form') ||
                    composeBody.parentElement?.parentElement?.parentElement;

                if (composeContainer) {
                    // Try to find sender header within compose container
                    let senderHeader = composeContainer.querySelector('div.iw, h3.iw');

                    // If not found, try to find it near the quoted content within compose
                    if (!senderHeader) {
                        const quotedBodyElement = composeContainer.querySelector('div.gmail_quote, blockquote.gmail_quote');
                        if (quotedBodyElement) {
                            let currentElement = quotedBodyElement.previousElementSibling;
                            while (currentElement && !senderHeader) {
                                if (currentElement.classList.contains('iw') ||
                                    currentElement.querySelector('span[name], span[email]')) {
                                    senderHeader = currentElement;
                                    break;
                                }
                                currentElement = currentElement.previousElementSibling;
                            }
                        }
                    }

                    if (senderHeader) {
                        // Try to get name from span[name] attribute
                        const nameSpan = senderHeader.querySelector('span[name]');
                        if (nameSpan) {
                            senderName = nameSpan.getAttribute('name') || '';
                        }

                        // Try to get email from span[email] attribute
                        const emailSpan = senderHeader.querySelector('span[email]');
                        if (emailSpan) {
                            senderEmail = emailSpan.getAttribute('email') || '';
                        }

                        // If name not found, try extracting from text content
                        if (!senderName) {
                            const text = senderHeader.innerText || senderHeader.textContent || '';
                            // Look for patterns like "Name <email@domain.com>" or "Name (Company)"
                            const nameMatch = text.match(/^([^<(]+?)(?:\s*<|$)/);
                            if (nameMatch) {
                                senderName = nameMatch[1].trim();
                            } else {
                                senderName = text.trim();
                            }
                        }
                    }
                }
            }

            // STRATEGY 4: Last resort - use getEmailBeingRepliedTo for sender info
            // CRITICAL FIX: Use correct Gmail container selector (div.adn.ads[data-message-id])
            if (!senderName) {
                const emailBeingRepliedTo = platformAdapters.gmail.getEmailBeingRepliedTo();
                if (emailBeingRepliedTo) {
                    const container = emailBeingRepliedTo.closest('div.adn.ads[data-message-id]') ||
                        emailBeingRepliedTo.closest('[data-message-id]') ||
                        emailBeingRepliedTo.closest('[role="listitem"]') ||
                        emailBeingRepliedTo.parentElement;
                    if (container) {
                        // Look for sender using Gmail's span.gD selector first
                        const senderSpan = container.querySelector('span.gD[email][name]');
                        if (senderSpan) {
                            senderName = senderSpan.getAttribute('name') || '';
                            senderEmail = senderSpan.getAttribute('email') || '';
                        } else {
                            // Fallback to generic span[name]/span[email]
                            const nameSpan = container.querySelector('span[name]');
                            const emailSpan = container.querySelector('span[email]');
                            if (nameSpan) senderName = nameSpan.getAttribute('name') || '';
                            if (emailSpan) senderEmail = emailSpan.getAttribute('email') || '';
                        }
                    }
                }
            }

            // Recipients (To/CC) of the replied-to message
            // For replies, Gmail pre-fills the compose fields with the original sender
            const toInput = document.querySelector('input[aria-label="To recipients"], input[name="to"], input[aria-label="To"]');
            const toRecipients = toInput ? toInput.value : '';

            const ccInput = document.querySelector('input[name="cc"], input[aria-label="Cc"]');
            const ccRecipients = ccInput ? ccInput.value : '';

            // Clean up the body - remove common noise and strip any remaining nested quote markers
            // CRITICAL: Gmail often includes the entire thread as plain text within a single quote block
            // We need to extract ONLY the first message segment (the actual email being replied to)
            if (body) {
                // First, remove any leading attribution line
                body = body.replace(/^On .+ wrote:\s*/i, '');

                // CRITICAL: Find and remove everything after common thread boundary markers
                // These markers indicate where the replied-to email ends and older thread content begins
                const threadBoundaryPatterns = [
                    /\nOn [A-Z][a-z]{2},? [A-Z][a-z]{2} \d{1,2}, \d{4}.+wrote:/i,  // "On Mon, Jan 5, 2026... wrote:"
                    /\nOn \d{1,2}\/\d{1,2}\/\d{2,4}.+wrote:/i,  // "On 1/5/2026... wrote:"
                    /\n-{3,}\s*Original Message\s*-{3,}/i,  // "--- Original Message ---"
                    /\n_{10,}/,                            // Long underscore separator (10+ underscores)
                    /\nFrom:\s+.+\nSent:\s+/i,            // Outlook-style "From: ... Sent: ..."
                    /\nFrom:\s+.+\nDate:\s+/i,            // "From: ... Date: ..."
                    /\n-{3,}\s*Forwarded message\s*-{3,}/i,  // "--- Forwarded message ---"
                    /\nBegin forwarded message:/i,        // Apple Mail style
                ];

                // Find the earliest boundary marker and truncate there
                let earliestBoundary = body.length;
                for (const pattern of threadBoundaryPatterns) {
                    const match = body.match(pattern);
                    if (match && match.index !== undefined && match.index < earliestBoundary) {
                        earliestBoundary = match.index;
                    }
                }

                // Truncate at the earliest boundary
                if (earliestBoundary < body.length) {
                    body = body.substring(0, earliestBoundary);
                }

                // Additional cleanup for any remaining noise at the start
                body = body
                    .replace(/^-+\s*Original Message\s*-+/im, '')  // Remove "Original Message" header at start
                    .replace(/^From:.+$/m, '')  // Remove From: line at start
                    .replace(/^Sent:.+$/m, '')  // Remove Sent: line at start
                    .replace(/^To:.+$/m, '')  // Remove To: line at start
                    .replace(/^Subject:.+$/m, '')  // Remove Subject: line at start
                    .trim();
            }

            return {
                subject,
                senderName: senderName || '',
                senderEmail: senderEmail || '',
                body: body || '',
                to: toRecipients || '',
                cc: ccRecipients || ''
            };
        },
        // Get sender name from the ACTUAL email being replied to (not latest, but the specific one)
        // This is critical for threads where different people send emails and you might reply to a middle email
        getEmailBeingRepliedToSenderName: () => {
            // Get the actual email being replied to (the one above the compose box)
            // Use platformAdapters.gmail since we're inside the gmail adapter object
            const emailBeingRepliedTo = platformAdapters.gmail.getEmailBeingRepliedTo();
            if (!emailBeingRepliedTo) return null;

            // Find the container for this specific message - look for the listitem that contains this message
            let messageContainer = emailBeingRepliedTo.closest('[role="listitem"]');
            if (!messageContainer) {
                // Fallback: look for parent containers
                messageContainer = emailBeingRepliedTo.closest('.nH, .aDP, [role="main"]') || emailBeingRepliedTo.parentElement;
            }

            if (!messageContainer) return null;

            // Method 1: Look for span elements with email attribute in this message container ONLY
            // Prioritize elements that are closest to the email being replied to
            const senderSpans = Array.from(messageContainer.querySelectorAll('span[email][name]'))
                .filter(span => messageContainer.contains(span))
                .sort((a, b) => {
                    // Prefer spans that are closer to the email being replied to
                    const aDist = Math.abs(a.compareDocumentPosition(emailBeingRepliedTo));
                    const bDist = Math.abs(b.compareDocumentPosition(emailBeingRepliedTo));
                    return aDist - bDist;
                });

            for (const span of senderSpans) {
                const name = span.getAttribute('name');
                if (name && name.length > 0 && !name.includes('@') && name.length < 100) {
                    if (!['Google', 'Gmail', 'LinkedIn', 'Notification', 'LinkedIn Notifications'].includes(name)) {
                        // Verify this span is associated with the latest message (not an earlier one)
                        // Check if it's in the same listitem or close to the latest message
                        const spanContainer = span.closest('[role="listitem"]');
                        if (!spanContainer || spanContainer === messageContainer || messageContainer.contains(span)) {
                            return name.trim();
                        }
                    }
                }
            }

            // Method 2: Look for email header metadata in the message container
            // Gmail shows sender info in a header above the message body
            // Look for the header that's immediately before the email being replied to
            let headerBeforeMessage = null;
            let currentElement = emailBeingRepliedTo.previousElementSibling;
            while (currentElement && !headerBeforeMessage) {
                const text = currentElement.textContent || '';
                // Check if this looks like an email header (contains date, "to me", email pattern, etc.)
                if (text.match(/\d{1,2}[:\/]\d{1,2}/) || text.match(/to me/i) || text.match(/@.*\.com/i)) {
                    headerBeforeMessage = currentElement;
                    break;
                }
                currentElement = currentElement.previousElementSibling;
            }

            // Also check parent's previous siblings
            if (!headerBeforeMessage) {
                const parent = emailBeingRepliedTo.parentElement;
                if (parent) {
                    currentElement = parent.previousElementSibling;
                    while (currentElement && !headerBeforeMessage) {
                        const text = currentElement.textContent || '';
                        if (text.match(/\d{1,2}[:\/]\d{1,2}/) || text.match(/to me/i) || text.match(/@.*\.com/i)) {
                            headerBeforeMessage = currentElement;
                            break;
                        }
                        currentElement = currentElement.previousElementSibling;
                    }
                }
            }

            // Search in header elements and the message container
            const searchElements = headerBeforeMessage
                ? [headerBeforeMessage, ...Array.from(messageContainer.querySelectorAll('div, span'))]
                : Array.from(messageContainer.querySelectorAll('div, span'));

            for (const header of searchElements) {
                if (!messageContainer.contains(header) && header !== headerBeforeMessage) continue;
                const text = header.textContent || '';
                // Look for patterns like "Jagoe, Rusty (CGI Federal)" or "Rusty Jagoe"
                // Pattern: "Last, First (Company) <email>" - this is the Gmail format
                const namePatterns = [
                    /([A-Z][a-z]+,\s+[A-Z][a-z]+(?:\s+\([^)]+\))?)\s*</i,  // "Jagoe, Rusty (CGI Federal) <"
                    /([A-Z][a-z]+,\s+[A-Z][a-z]+)/,                          // "Jagoe, Rusty"
                    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*\(/i,                // "Rusty Jagoe (Company)"
                    /From:\s*([^<\n]+?)\s*</i,                                // "From: Name <"
                ];

                for (const pattern of namePatterns) {
                    const match = text.match(pattern);
                    if (match && match[1]) {
                        let name = match[1].trim();
                        // Remove company name in parentheses if present
                        name = name.replace(/\s*\([^)]+\)\s*$/, '');
                        // Handle "Last, First" format - convert to "First Last"
                        if (name.includes(',')) {
                            const parts = name.split(',').map(p => p.trim());
                            if (parts.length === 2) {
                                name = `${parts[1]} ${parts[0]}`; // Convert "Jagoe, Rusty" to "Rusty Jagoe"
                            }
                        }
                        if (name && name.length > 2 && name.length < 100 && !name.includes('@') &&
                            !name.match(/^\d+$/) &&
                            !['Google', 'Gmail', 'LinkedIn', 'Notification', 'LinkedIn Notifications'].includes(name)) {
                            return name;
                        }
                    }
                }
            }

            // Method 3: Look for elements with email attribute in this message container
            const emailElements = Array.from(messageContainer.querySelectorAll('[email]'))
                .filter(elem => messageContainer.contains(elem))
                .sort((a, b) => {
                    // Sort by proximity to the email being replied to
                    const aDist = Math.abs(a.compareDocumentPosition(emailBeingRepliedTo));
                    const bDist = Math.abs(b.compareDocumentPosition(emailBeingRepliedTo));
                    return aDist - bDist;
                });

            for (const elem of emailElements) {
                const name = elem.getAttribute('name') || elem.textContent?.trim();
                if (name && name.length > 0 && !name.includes('@') && name.length < 100 && name.length > 1) {
                    if (!name.match(/^[^\s]+@[^\s]+\.[^\s]+$/) &&
                        !['Google', 'Gmail', 'LinkedIn', 'Notification', 'LinkedIn Notifications'].includes(name)) {
                        const elemContainer = elem.closest('[role="listitem"]');
                        if (!elemContainer || elemContainer === messageContainer || messageContainer.contains(elem)) {
                            return name.trim();
                        }
                    }
                }
            }

            // Method 4: Look for "From: Name <email>" pattern in this message container's text
            const containerText = messageContainer.textContent || '';
            const patterns = [
                /From:\s*([^<\n]+?)\s*</i,
                /^([^<\n@]+?)\s*<[^>]+@[^>]+>/m,
                /([A-Z][a-z]+\s+[A-Z][a-z]+)\s*<[^>]+@/,
                /([A-Z][a-z]+\s+[A-Z]\.?)\s*<[^>]+@/
            ];

            for (const pattern of patterns) {
                const match = containerText.match(pattern);
                if (match && match[1]) {
                    let name = match[1].trim();
                    // Handle "Last, First" format
                    if (name.includes(',')) {
                        const parts = name.split(',').map(p => p.trim());
                        if (parts.length === 2) {
                            name = `${parts[1]} ${parts[0]}`;
                        }
                    }
                    if (name && name.length > 2 && name.length < 100 && !name.includes('@') &&
                        !name.match(/^\d+$/) &&
                        !['Google', 'Gmail', 'LinkedIn', 'Notification', 'LinkedIn Notifications'].includes(name)) {
                        return name;
                    }
                }
            }

            return null;
        },
        // Legacy method - kept for compatibility but should use getEmailBeingRepliedToSenderName instead
        getLatestEmailSenderName: () => {
            return platformAdapters.gmail.getEmailBeingRepliedToSenderName ? platformAdapters.gmail.getEmailBeingRepliedToSenderName() : null;
        },
        // Get sender name from email - scoped to the current email thread only (legacy method, kept for compatibility)
        getSenderName: () => {
            // First, find the compose/reply window container to scope our search
            const composeBody = document.querySelector('div[aria-label="Message Body"][role="textbox"]');
            if (!composeBody) return null;

            // Find the email thread container - look for the closest thread container
            // Gmail wraps the thread in various containers, try to find the one containing the compose box
            let threadContainer = composeBody.closest('[role="main"], .nH, .aDP, [role="dialog"], .nH.if, .aDP');
            if (!threadContainer) {
                // Fallback: look for the thread list item that contains message bodies
                const messageBodies = document.querySelectorAll('div[aria-label="Message Body"]');
                if (messageBodies.length > 0) {
                    // Find the container that holds all these message bodies (the thread)
                    threadContainer = messageBodies[0].closest('[role="listitem"], .nH, .aDP');
                }
            }

            // If we found a thread container, scope our search to it; otherwise search the whole page but prioritize compose area
            const searchScope = threadContainer || composeBody.closest('[role="main"]') || document.body;

            // Method 1: Look for span elements with email attribute and name attribute within the thread
            const senderSpans = searchScope.querySelectorAll('span[email][name]');
            for (const span of senderSpans) {
                // Make sure this span is in the thread, not in the inbox list
                if (threadContainer && !threadContainer.contains(span)) continue;

                const name = span.getAttribute('name');
                if (name && name.length > 0 && !name.includes('@') && name.length < 100) {
                    // Skip common non-name values
                    if (!['Google', 'Gmail', 'LinkedIn', 'Notification', 'LinkedIn Notifications'].includes(name)) {
                        return name.trim();
                    }
                }
            }

            // Method 2: Look for elements with email attribute within the thread
            const emailElements = searchScope.querySelectorAll('[email]');
            for (const elem of emailElements) {
                // Make sure this element is in the thread, not in the inbox list
                if (threadContainer && !threadContainer.contains(elem)) continue;

                const name = elem.getAttribute('name') || elem.textContent?.trim();
                if (name && name.length > 0 && !name.includes('@') && name.length < 100 && name.length > 1) {
                    // Skip if it's just an email address or common non-name values
                    if (!name.match(/^[^\s]+@[^\s]+\.[^\s]+$/) &&
                        !['Google', 'Gmail', 'LinkedIn', 'Notification', 'LinkedIn Notifications'].includes(name)) {
                        return name.trim();
                    }
                }
            }

            // Method 3: Look in email thread headers within the thread container for "From: Name <email>" pattern
            const threadItems = searchScope.querySelectorAll('[role="listitem"]');
            for (const item of threadItems) {
                // Make sure this item is in the thread, not in the inbox list
                if (threadContainer && !threadContainer.contains(item)) continue;

                const text = item.textContent || '';
                // Look for "From: Name <email>" or "Name <email@domain.com>"
                const patterns = [
                    /From:\s*([^<\n]+?)\s*</i,
                    /^([^<\n@]+?)\s*<[^>]+@[^>]+>/m,
                    /([A-Z][a-z]+\s+[A-Z][a-z]+)\s*<[^>]+@/,
                    /([A-Z][a-z]+\s+[A-Z]\.?)\s*<[^>]+@/
                ];

                for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (match && match[1]) {
                        const name = match[1].trim();
                        if (name && name.length > 2 && name.length < 100 && !name.includes('@') &&
                            !name.match(/^\d+$/) &&
                            !['Google', 'Gmail', 'LinkedIn', 'Notification', 'LinkedIn Notifications'].includes(name)) {
                            return name;
                        }
                    }
                }
            }

            // Method 4: Look for "From:" label within the thread and extract name
            const fromLabels = Array.from(searchScope.querySelectorAll('span, div')).filter(elem => {
                // Make sure this element is in the thread
                if (threadContainer && !threadContainer.contains(elem)) return false;

                const text = elem.textContent?.trim() || '';
                return text.toLowerCase().includes('from:') || text.toLowerCase().startsWith('from');
            });

            for (const label of fromLabels) {
                const parentText = label.parentElement?.textContent || label.textContent || '';
                const match = parentText.match(/From:\s*([^<\n]+?)(?:\s*<|$)/i);
                if (match && match[1]) {
                    const name = match[1].trim();
                    if (name && name.length > 2 && name.length < 100 && !name.includes('@') &&
                        !['Google', 'Gmail', 'LinkedIn', 'Notification', 'LinkedIn Notifications'].includes(name)) {
                        return name;
                    }
                }
            }

            // Method 5: Extract from the source message text itself (most reliable for replies)
            const messageBodies = document.querySelectorAll('div[aria-label="Message Body"]');
            for (const body of messageBodies) {
                // Skip the compose box (role="textbox")
                if (body.getAttribute('role') === 'textbox') continue;

                // Make sure this is in the thread
                if (threadContainer && !threadContainer.contains(body)) continue;

                const text = body.textContent || '';
                // Look for name patterns at the start of the message
                const namePatterns = [
                    /^([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z]\.?)?)\s*<[^>]+@/m,
                    /^([A-Z][a-z]+\s+[A-Z]\.?)\s*<[^>]+@/m,
                    /From:\s*([^<\n]+?)\s*</i
                ];

                for (const pattern of namePatterns) {
                    const match = text.match(pattern);
                    if (match && match[1]) {
                        const name = match[1].trim();
                        if (name && name.length > 2 && name.length < 100 && !name.includes('@') &&
                            !['Google', 'Gmail', 'LinkedIn', 'Notification', 'LinkedIn Notifications'].includes(name)) {
                            return name;
                        }
                    }
                }
            }

            return null;
        },
        // Get context string for API
        getContext: () => {
            const toField = document.querySelector('input[aria-label="To"]')?.value || '';
            const subjectField = document.querySelector('input[aria-label="Subject"]')?.value || '';
            const threadMessages = platformAdapters.gmail.getThreadMessages();
            const previousThread = threadMessages.length > 1
                ? threadMessages.slice(0, -1).reverse().join('\n\n---\n\n')
                : '';
            return previousThread
                ? `To: ${toField}\nSubject: ${subjectField}\n\nPrevious thread:\n${previousThread}`
                : `To: ${toField}\nSubject: ${subjectField}`;
        },
        // Insert text into compose field
        insertText: (text) => {
            const composeBody = document.querySelector('div[aria-label="Message Body"][role="textbox"]');
            if (composeBody) {
                composeBody.focus();
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);
                document.execCommand('insertText', false, text);
            }
        },
        // Button CSS classes
        buttonClass: 'T-I J-J5-Ji',
    },
    linkedin: {
        // Check if we're in messaging area (not news feed)
        isMessagingContext: () => {
            // Check for messaging-specific elements that indicate we're in the messaging interface
            return !!(
                document.querySelector('.msg-form__message-texteditor') ||
                document.querySelector('.msg-s-message-list__compose-textarea') ||
                document.querySelector('.msg-form__contenteditable') ||
                document.querySelector('.msg-conversation-card') ||
                document.querySelector('.msg-s-message-list')
            );
        },
        // Find send buttons - LinkedIn uses different selectors
        findSendButtons: () => {
            // Only find send buttons in messaging context
            // Use more specific selectors to avoid news feed buttons
            return document.querySelectorAll('button.msg-form__send-button, button[data-control-name="send"].msg-form__send-button');
        },
        // Find compose/message input
        findComposeInput: () => {
            // Try multiple selectors for LinkedIn message input
            return document.querySelector('div[contenteditable="true"][role="textbox"].msg-s-message-list__compose-textarea, div[contenteditable="true"].msg-form__message-texteditor, div.msg-form__contenteditable');
        },
        // Find recipient field (LinkedIn shows recipient name, not input)
        findRecipientField: () => {
            // LinkedIn shows recipient in header, try to find it
            return document.querySelector('.msg-conversation-card__participant-name, .msg-conversation-listitem__participant-name');
        },
        // No subject field in LinkedIn
        findSubjectField: () => null,
        // Multi-factor detection: Check if compose action is Reply, Forward, or New Email
        // LinkedIn messaging is simpler - mostly conversation-based
        detectComposeAction: () => {
            const composeInput = platformAdapters.linkedin.findComposeInput();
            if (!composeInput) return 'new';

            const composeText = composeInput.innerText || composeInput.textContent || '';

            // Check for Forward patterns in content (LinkedIn rarely has forwards, but check anyway)
            const forwardPatterns = [
                /-{3,}\s*Forwarded message\s*-{3,}/i,
                /Begin forwarded message:/i,
                /^From:\s+.+\n(Sent|Date):\s+/im,
                /^Original Message\s*-+/im
            ];

            for (const pattern of forwardPatterns) {
                if (pattern.test(composeText)) {
                    return 'forward';
                }
            }

            // Check for Reply patterns
            const replyPatterns = [
                /On\s+.+?,\s+.+?\s*<[^>]+>\s*wrote:/i,
                /On\s+.+?,\s+.+?\s+wrote:/i
            ];

            for (const pattern of replyPatterns) {
                if (pattern.test(composeText)) {
                    return 'reply';
                }
            }

            // Check if there are existing messages in the conversation (indicates reply)
            const existingMessages = document.querySelectorAll('.msg-s-message-list__message, .msg-s-event-listitem, .msg-s-message-listitem');
            if (existingMessages.length > 0) {
                return 'reply';
            }

            return 'new';
        },
        // Check if reply or new message (legacy method, kept for backward compatibility)
        isReply: () => {
            const action = platformAdapters.linkedin.detectComposeAction();
            return action === 'reply';
        },
        // Check if forward
        isForward: () => {
            const action = platformAdapters.linkedin.detectComposeAction();
            return action === 'forward';
        },
        // Get thread messages for context
        getThreadMessages: () => {
            // Find all message content in LinkedIn conversation
            const messages = Array.from(document.querySelectorAll('.msg-s-message-list__message-body, .msg-s-event-listitem__body, .msg-s-message-listitem__message-body'));
            return messages
                .map(msg => {
                    const text = msg.innerText?.trim() || msg.textContent?.trim() || '';
                    return text;
                })
                .filter(text => text && text.length > 0 && !text.includes('xReplAI') && !text.includes('Respond'));
        },
        // Get sender name from LinkedIn message
        getSenderName: () => {
            // The recipient name in a conversation is the sender when replying
            // For LinkedIn, the participant name is the person you're messaging with
            const recipientName = document.querySelector('.msg-conversation-card__participant-name, .msg-conversation-listitem__participant-name, .msg-s-message-list__conversation-header-name')?.innerText?.trim();
            if (recipientName) {
                return recipientName;
            }
            // Fallback: try to find name in message headers
            const messageHeaders = document.querySelectorAll('.msg-s-message-list__message-header, .msg-s-event-listitem__header');
            if (messageHeaders.length > 0) {
                const lastHeader = messageHeaders[messageHeaders.length - 1];
                const nameElem = lastHeader.querySelector('.msg-s-message-list__message-header-name, .msg-s-event-listitem__participant-name');
                if (nameElem) {
                    return nameElem.innerText?.trim() || nameElem.textContent?.trim() || null;
                }
            }
            return null;
        },
        // Get context string for API
        getContext: () => {
            const recipientName = document.querySelector('.msg-conversation-card__participant-name, .msg-conversation-listitem__participant-name')?.innerText?.trim() || '';
            const threadMessages = platformAdapters.linkedin.getThreadMessages();
            const previousThread = threadMessages.length > 1
                ? threadMessages.slice(0, -1).reverse().join('\n\n---\n\n')
                : '';
            return previousThread
                ? `To: ${recipientName}\n\nPrevious conversation:\n${previousThread}`
                : `To: ${recipientName}`;
        },
        // Insert text into compose field
        insertText: (text) => {
            const composeInput = platformAdapters.linkedin.findComposeInput();
            if (composeInput) {
                composeInput.focus();
                // For contenteditable divs, we need to set the text differently
                composeInput.innerHTML = '';
                composeInput.innerText = text;
                // Trigger input event for LinkedIn
                const inputEvent = new Event('input', { bubbles: true });
                composeInput.dispatchEvent(inputEvent);
            }
        },
        // Button CSS classes (LinkedIn uses different classes)
        buttonClass: 'msg-form__send-button artdeco-button',
    }
};

// Create icon-only button for LinkedIn comments
const createIconOnlyButton = (buttonTooltip, platform) => {
    const generateButton = document.createElement('button');
    generateButton.type = 'button';
    generateButton.className = 'responseable-button responseable-comment-button';
    generateButton.setAttribute('aria-label', buttonTooltip);
    generateButton.setAttribute('data-tooltip', buttonTooltip);

    // Add icon only - use raiconvector.png for LinkedIn comments
    const runtime = getChromeRuntime();
    if (runtime && runtime.getURL) {
        try {
            const iconImg = document.createElement('img');
            const iconUrl = runtime.getURL('raiconvector.png');
            iconImg.src = iconUrl;
            iconImg.alt = 'ResponseAble';
            iconImg.style.cssText = 'width: 20px !important; height: 20px !important; max-width: 20px !important; max-height: 20px !important; display: inline-block !important; vertical-align: middle !important; opacity: 1 !important; visibility: visible !important; object-fit: contain !important; flex-shrink: 0 !important; position: relative !important;';
            iconImg.addEventListener('error', (e) => {
                console.error('Failed to load raiconvector.png from:', iconUrl, e);
            });
            generateButton.appendChild(iconImg);
        } catch (error) {
            // Handle extension context errors
            if (error.message && error.message.includes('Extension context invalidated')) {
                console.warn('Extension context invalidated, icon not loaded');
            } else {
                console.error('Error loading raiconvector.png icon:', error);
            }
        }
    } else {
        console.warn('Chrome runtime not available for loading raiconvector.png');
    }

    // Icon-only button styling for LinkedIn comments
    generateButton.style.cssText = 'display: inline-flex !important; align-items: center !important; justify-content: center !important; padding: 4px !important; margin: 4px 4px !important; border: none !important; background: transparent !important; cursor: pointer !important; width: 32px !important; height: 32px !important; border-radius: 4px !important; visibility: visible !important; opacity: 1 !important; z-index: 1000 !important; position: relative !important;';

    // Hover effect
    generateButton.onmouseenter = () => {
        generateButton.style.background = 'rgba(0, 0, 0, 0.05)';
    };
    generateButton.onmouseleave = () => {
        generateButton.style.background = 'transparent';
    };

    return generateButton;
};

// Create button with icon
// Helper function to update button text while preserving icon, with fade-in animation
const updateButtonText = (button, newText) => {
    // Check if this is a status update (Analyzing/Generating) to apply animations
    const isStatusUpdate = newText === 'Analyzing...' || newText === 'Generating...';

    // Find the icon and apply pulsating animation during status updates
    const iconImg = button.querySelector('img');
    if (iconImg) {
        if (isStatusUpdate) {
            iconImg.style.animation = 'responseable-icon-pulse 0.8s ease-in-out infinite';
        } else {
            iconImg.style.animation = 'none';
        }
    }

    // Apply button glow animation during status updates
    if (isStatusUpdate) {
        button.style.animation = 'responseable-button-glow 1.5s ease-in-out infinite';
    } else {
        button.style.animation = 'none';
    }

    // Find the text span or create one
    let textSpan = button.querySelector('.responseable-button-text');
    if (!textSpan) {
        // Convert existing text node to span for animation support
        const textNodes = Array.from(button.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
        if (textNodes.length > 0) {
            textSpan = document.createElement('span');
            textSpan.className = 'responseable-button-text';
            textSpan.textContent = textNodes[textNodes.length - 1].textContent;
            textNodes[textNodes.length - 1].replaceWith(textSpan);
        } else {
            textSpan = document.createElement('span');
            textSpan.className = 'responseable-button-text';
            button.appendChild(textSpan);
        }
    }

    // Apply slow fade-in for status updates with animated dots
    if (isStatusUpdate) {
        // Extract the word (Analyzing or Generating) without the dots
        const word = newText.replace('...', '');

        // Create HTML with word + animated dots
        textSpan.innerHTML = '';
        textSpan.style.opacity = '0';
        textSpan.style.transition = 'opacity 0.8s ease-in';
        textSpan.style.display = 'inline-flex';
        textSpan.style.alignItems = 'baseline';

        // Add the word
        const wordSpan = document.createElement('span');
        wordSpan.textContent = word;
        textSpan.appendChild(wordSpan);

        // Add animated dots with wave effect
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('span');
            dot.textContent = '.';
            dot.style.display = 'inline-block';
            dot.style.animation = `responseable-dot-wave 1.2s ease-in-out infinite`;
            dot.style.animationDelay = `${i * 0.15}s`;
            textSpan.appendChild(dot);
        }

        requestAnimationFrame(() => {
            textSpan.style.opacity = '1';
        });
    } else {
        textSpan.style.transition = 'none';
        textSpan.style.opacity = '1';
        textSpan.innerHTML = '';
        textSpan.textContent = newText;
    }
};

const createButton = (buttonText, buttonTooltip, buttonClass, platform) => {
    const generateButton = document.createElement('button');
    generateButton.type = 'button';

    // Inject CSS keyframes for icon pulse animation (only once)
    if (!document.querySelector('#responseable-button-animations')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'responseable-button-animations';
        styleSheet.textContent = `
            @keyframes responseable-icon-pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.2); }
            }
            @keyframes responseable-button-glow {
                0%, 100% { box-shadow: 0 0 5px rgba(85, 103, 185, 0.3); }
                50% { box-shadow: 0 0 15px rgba(85, 103, 185, 0.6); }
            }
            @keyframes responseable-dot-wave {
                0%, 60%, 100% { transform: translateY(0); }
                30% { transform: translateY(-4px); }
            }
        `;
        document.head.appendChild(styleSheet);
    }

    // Try to add icon, but continue even if it fails
    const runtime = getChromeRuntime();
    if (runtime) {
        try {
            const iconImg = document.createElement('img');
            iconImg.src = runtime.getURL('xrepl-dark.png');
            iconImg.alt = 'xRepl.ai';
            // Platform-specific icon sizing
            if (platform === 'linkedin') {
                iconImg.style.cssText = 'width: 16px !important; height: 16px !important; max-width: 16px !important; max-height: 16px !important; display: inline-block !important; vertical-align: middle !important; margin-right: 6px !important; opacity: 1 !important; visibility: visible !important; object-fit: contain !important; flex-shrink: 0 !important;';
            } else {
                iconImg.style.cssText = 'width: 20px !important; height: 20px !important; max-width: 28px !important; max-height: 28px !important; display: inline-block !important; vertical-align: middle !important; margin-right: 6px !important; opacity: 1 !important; visibility: visible !important; object-fit: contain !important; flex-shrink: 0 !important;';
            }
            iconImg.addEventListener('error', () => console.error('Failed to load xrepl-dark.png from:', iconImg.src));
            generateButton.appendChild(iconImg);
        } catch (error) {
            console.error('Error loading icon:', error);
        }
    }

    generateButton.appendChild(document.createTextNode(buttonText));
    generateButton.className = `${buttonClass} responseable-button${platform === 'linkedin' ? ' responseable-linkedin-button' : ''}`;
    generateButton.setAttribute('data-tooltip', buttonTooltip);

    // Platform-specific styling
    if (platform === 'linkedin') {
        // LinkedIn style: skinnier button with more rounded corners, matching Send button
        generateButton.style.cssText = 'display: inline !important; align-items: center !important; padding: 4px 12px !important; margin: 0 8px 0 4px !important; border-radius: 16px !important; background: #D3E3FD !important; color: #444746 !important; border: none !important; cursor: pointer !important; font-size: 14px !important; font-weight: 600 !important; height: 28px !important; line-height: 20px !important; min-width: auto !important;';
    } else {
        // Gmail style: original styling
        generateButton.style.cssText = 'display: inline-flex !important; align-items: center !important; padding: 0px 12px 0px 8px !important; !important; margin: 0 1px !important; border-radius: 0px !important; background: #D3E3FD !important; font-weight: bold !important; color: #444746 !important; border: none !important; cursor: pointer !important; font-size: 14px !important;';
    }

    return generateButton;
};

const injectGenerateButton = () => {
    const platform = detectPlatform();
    if (!platform || !platformAdapters[platform]) {
        return; // Not a supported platform
    }

    const adapter = platformAdapters[platform];

    // For LinkedIn, only inject in messaging context (not news feed)
    if (platform === 'linkedin' && adapter.isMessagingContext && !adapter.isMessagingContext()) {
        return; // Not in messaging area
    }

    const sendButtons = adapter.findSendButtons();

    sendButtons.forEach(sendButton => {
        // For LinkedIn, verify the send button is in a messaging context
        if (platform === 'linkedin') {
            // Check if the send button is within a messaging form
            const msgForm = sendButton.closest('.msg-form, .msg-s-message-list');
            if (!msgForm) {
                return; // Skip if not in messaging form
            }
        }

        // Find the container/toolbar for the button
        const toolbar = sendButton.parentElement;
        if (!toolbar || toolbar.querySelector('.responseable-button')) return;

        const generateButton = createButton('xReplAI', 'Generate AI message drafts', 'responseable-generate', platform);

        generateButton.addEventListener('click', async () => {
            const currentButtonText = 'xReplAI';
            // Get context for API call using enhanced context extraction
            const richContext = getRichContext();

            // Find the compose body associated with THIS button (not a global search)
            // This fixes issues when multiple compose windows are open
            // IMPROVED: Traverse up from sendButton (not generateButton) to find compose body
            // This is more robust than relying on specific Gmail classnames
            let scopedComposeBody = null;
            if (platform === 'gmail') {
                // Walk up the DOM from sendButton, checking each ancestor for a compose body
                let ancestor = sendButton.parentElement;
                let depth = 0;
                const maxDepth = 15; // Don't go too far up
                console.log('[ResponseAble DEBUG] Starting ancestor traversal from sendButton');
                while (ancestor && depth < maxDepth && !scopedComposeBody) {
                    scopedComposeBody = ancestor.querySelector('div[aria-label="Message Body"][role="textbox"]');
                    if (scopedComposeBody) {
                        console.log('[ResponseAble DEBUG] Found scopedComposeBody at depth:', depth, 'ancestor tag:', ancestor.tagName);
                    }
                    ancestor = ancestor.parentElement;
                    depth++;
                }
                console.log('[ResponseAble DEBUG] Final scopedComposeBody found:', !!scopedComposeBody);
            }

            // Use multi-factor detection to determine compose action type
            // Pass the scoped compose body to ensure we detect the correct compose window
            let composeAction = 'new';
            if (adapter.detectComposeAction) {
                composeAction = adapter.detectComposeAction(scopedComposeBody);
                console.log('[ResponseAble DEBUG] composeAction result:', composeAction);
            } else {
                // Fallback to old method if detectComposeAction not available
                if (adapter.isReply && adapter.isReply()) {
                    composeAction = 'reply';
                } else if (adapter.isForward && adapter.isForward()) {
                    composeAction = 'forward';
                }
            }

            const isReply = composeAction === 'reply';
            const isForward = composeAction === 'forward';

            // CRITICAL: Get detailed information about the email being replied to (only for replies)
            let emailDetails = null;
            let sourceMessageText = '';
            let actualSenderName = null;
            let actualSenderEmail = null;
            let emailSubject = '';
            let toRecipients = '';
            let ccRecipients = '';
            let forwardedMessageContent = ''; // For forwards

            if (isReply && adapter.getRepliedToEmailDetails) {
                emailDetails = adapter.getRepliedToEmailDetails();
                if (emailDetails) {
                    sourceMessageText = emailDetails.body || '';
                    actualSenderName = emailDetails.senderName || null;
                    actualSenderEmail = emailDetails.senderEmail || null;
                    emailSubject = emailDetails.subject || '';
                    toRecipients = emailDetails.to || '';
                    ccRecipients = emailDetails.cc || '';
                }
            } else if (isForward) {
                // Extract forwarded message content (treat as context, not source)
                const composeBody = adapter.findComposeInput();
                if (composeBody) {
                    const composeContainer = composeBody.closest('.nH, .aO9, [role="dialog"], .M9, .iN, .aoP') ||
                        composeBody.closest('form') ||
                        composeBody.parentElement?.parentElement?.parentElement;

                    if (composeContainer) {
                        // Look for forwarded content
                        const quotedContent = composeContainer.querySelector('div.gmail_quote, blockquote.gmail_quote, blockquote');
                        if (quotedContent) {
                            // Clone and strip nested quotes
                            const clonedQuote = quotedContent.cloneNode(true);
                            const nestedQuotes = clonedQuote.querySelectorAll('div.gmail_quote, blockquote.gmail_quote, blockquote');
                            nestedQuotes.forEach(nested => nested.remove());
                            forwardedMessageContent = clonedQuote.innerText?.trim() || clonedQuote.textContent?.trim() || '';
                        } else {
                            // Fallback: extract from compose text directly
                            const composeText = composeBody.innerText || composeBody.textContent || '';
                            // Try to extract forwarded message (everything after forward header)
                            const forwardMatch = composeText.match(/(?:-{3,}\s*Forwarded message\s*-{3,}|Begin forwarded message:)([\s\S]*)/i);
                            if (forwardMatch) {
                                forwardedMessageContent = forwardMatch[1].trim();
                            }
                        }
                    }
                }
            }

            // Update button text and class based on compose action
            if (isForward) {
                updateButtonText(generateButton, 'Forward');
                generateButton.className = 'responseable-forward responseable-button' + (platform === 'linkedin' ? ' responseable-linkedin-button' : '');
                generateButton.setAttribute('data-tooltip', 'Generate AI forward message drafts');
            } else if (isReply) {
                updateButtonText(generateButton, 'Respond');
                generateButton.className = 'responseable-respond responseable-button' + (platform === 'linkedin' ? ' responseable-linkedin-button' : '');
                generateButton.setAttribute('data-tooltip', 'Generate AI response options');
            }

            // Fallback: if getRepliedToEmailDetails didn't work or didn't return body, use the old method
            if (isReply && !sourceMessageText) {
                const emailBeingRepliedTo = adapter.getEmailBeingRepliedTo
                    ? adapter.getEmailBeingRepliedTo()
                    : null;

                if (emailBeingRepliedTo) {
                    sourceMessageText = emailBeingRepliedTo.innerText?.trim() || emailBeingRepliedTo.textContent?.trim() || '';
                } else {
                    // Fallback: if we can't find the specific email, use the latest one
                    const threadMessages = adapter.getThreadMessages();
                    sourceMessageText = threadMessages.length > 0 ? threadMessages[threadMessages.length - 1] : '';
                }
            }

            // Get all thread messages for context (excluding the one being replied to)
            const allThreadMessages = adapter.getThreadMessages();
            // Remove the email being replied to from thread history (if it's in there)
            const threadHistory = allThreadMessages.filter(msg => {
                // Don't include the email being replied to in the thread history
                if (sourceMessageText) {
                    return msg !== sourceMessageText && !sourceMessageText.includes(msg) && !msg.includes(sourceMessageText);
                }
                return true;
            });

            // Convert thread history array to text string
            const threadHistoryText = threadHistory.length > 0
                ? threadHistory.reverse().join('\n\n---\n\n')
                : '';

            // Use rich context for the prompt
            const context = richContext.fullContext;
            const recipientName = richContext.recipientName;
            const recipientCompany = richContext.recipientCompany;

            // Get sender name from the ACTUAL email being replied to (not latest, not original)
            // Prefer the sender name from emailDetails if available, otherwise fall back to other methods
            const senderName = isReply
                ? (actualSenderName || (adapter.getEmailBeingRepliedToSenderName ? adapter.getEmailBeingRepliedToSenderName() : (adapter.getLatestEmailSenderName ? adapter.getLatestEmailSenderName() : adapter.getSenderName()))) || recipientName
                : null;

            // Handle forward, new email, and reply differently
            // Forward is treated as New Email with forwarded message as context
            if (isForward || !isReply) {
                // NEW EMAIL: Extract compose window content and generate drafts
                // Show progress overlay immediately for instant feedback
                const iconUrl = getChromeRuntime()?.runtime?.getURL ? getChromeRuntime().runtime.getURL('icon-128.png') : null;
                showProgressOverlay(iconUrl);

                updateButtonText(generateButton, 'Working...');
                generateButton.style.opacity = '0.7';
                generateButton.disabled = true; // Disable button during generation

                // Get user packages and default role
                const userPackages = await getUserPackages();
                const defaultRole = await getDefaultRole();

                // Extract compose window content
                let composeBodyText = '';
                let composeSubject = richContext.subject || '';
                let composeRecipient = richContext.to || '';

                // Get body text from compose window
                // For forwards, exclude the forwarded message content (only get user's typed content)
                if (platform === 'gmail') {
                    const composeBody = adapter.findComposeInput();
                    if (composeBody) {
                        let fullText = composeBody.innerText || composeBody.textContent || '';
                        if (isForward && forwardedMessageContent) {
                            // Remove forwarded message content to get only user's typed content
                            // Find where forwarded content starts and remove it
                            const forwardHeaderPattern = /(?:-{3,}\s*Forwarded message\s*-{3,}|Begin forwarded message:)/i;
                            const forwardIndex = fullText.search(forwardHeaderPattern);
                            if (forwardIndex !== -1) {
                                composeBodyText = fullText.substring(0, forwardIndex).trim();
                            } else {
                                // Try to remove forwarded content by matching it
                                const forwardedIndex = fullText.indexOf(forwardedMessageContent.substring(0, 50));
                                if (forwardedIndex !== -1) {
                                    composeBodyText = fullText.substring(0, forwardedIndex).trim();
                                } else {
                                    composeBodyText = fullText;
                                }
                            }
                        } else {
                            composeBodyText = fullText;
                        }
                    }
                } else if (platform === 'linkedin') {
                    // LinkedIn compose input
                    const composeInput = document.querySelector('.msg-form__contenteditable, .msg-form__texteditor');
                    if (composeInput) {
                        let fullText = composeInput.innerText || composeInput.textContent || '';
                        if (isForward && forwardedMessageContent) {
                            // Remove forwarded message content
                            const forwardHeaderPattern = /(?:-{3,}\s*Forwarded message\s*-{3,}|Begin forwarded message:)/i;
                            const forwardIndex = fullText.search(forwardHeaderPattern);
                            if (forwardIndex !== -1) {
                                composeBodyText = fullText.substring(0, forwardIndex).trim();
                            } else {
                                composeBodyText = fullText;
                            }
                        } else {
                            composeBodyText = fullText;
                        }
                    }
                }

                // Extract recipient name from To field if available
                let actualRecipientName = recipientName;
                if (!actualRecipientName && composeRecipient) {
                    const toValue = composeRecipient.split(',')[0].trim();
                    if (toValue.includes('<')) {
                        actualRecipientName = toValue.split('<')[0].trim();
                    } else if (!toValue.includes('@')) {
                        actualRecipientName = toValue;
                    }
                }

                // Get user's account info for signature
                let userAccountName = '';
                let userAccountEmail = '';
                if (platform === 'gmail') {
                    const accountButton = document.querySelector('a[aria-label*="Google Account"], a[aria-label*="Account"], button[aria-label*="Google Account"]');
                    if (accountButton) {
                        const accountText = accountButton.getAttribute('aria-label') || '';
                        const nameMatch = accountText.match(/Google Account:\s*([^(]+)/);
                        if (nameMatch) {
                            userAccountName = nameMatch[1].trim();
                        }
                    }
                    if (!userAccountName) {
                        const fromField = document.querySelector('span[email], div[email]');
                        if (fromField) {
                            const emailAttr = fromField.getAttribute('email');
                            if (emailAttr) {
                                userAccountEmail = emailAttr;
                            }
                        }
                    }
                    if (!userAccountName && richContext.from) {
                        userAccountEmail = richContext.from;
                    }
                }

                // Progress callback to update the overlay as each step completes
                const onProgress = (progress) => {
                    if (progress.step === 'type') {
                        updateProgressStep('step-type', 'completed', formatTypeResult(progress.data.type));
                        updateProgressStep('step-goals', 'active');
                    } else if (progress.step === 'goals') {
                        updateProgressStep('step-goals', 'completed', formatGoalsResult(progress.data.response_goals, progress.data.goal_titles));
                        updateProgressStep('step-tone', 'active');
                    } else if (progress.step === 'tone') {
                        updateProgressStep('step-tone', 'completed', formatToneResult(progress.data.tone_needed, progress.data.tone_sets, progress.data.currentGoal));
                        updateProgressStep('step-generate', 'active');
                    }
                };

                // Determine type based on typed content (if available)
                let selectedRole = defaultRole;
                let shouldUseGenericSingleDraft = false;

                if (composeBodyText.trim().length > 0 || composeSubject.trim().length > 0) {
                    // User has typed content - determine type from it
                    try {
                        await loadApiConfig();
                        const classificationModel = apiConfig.classificationModel || apiConfig.model;

                        // Build context for type determination
                        // For forwards, only use user's typed content (forwarded message is ignored)
                        let composeContext = `${composeSubject ? `Subject: ${composeSubject}\n` : ''}${composeRecipient ? `To: ${composeRecipient}\n` : ''}${composeBodyText ? `\nEmail content:\n${composeBodyText}` : ''}`;

                        // Determine type from typed content using new API endpoint
                        // CRITICAL: This is for NEW EMAIL drafting, not reply classification
                        // Match based on what YOU (the user) are drafting, not based on email direction
                        const response = await fetch(`${VERCEL_PROXY_URL}/classify-draft-type`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                typedContent: composeBodyText,
                                subject: composeSubject,
                                recipient: composeRecipient,
                                availablePackages: userPackages,
                                confidenceThreshold: apiConfig.classificationConfidenceThreshold !== undefined ? apiConfig.classificationConfidenceThreshold : 0.85,
                                provider: apiConfig.provider,
                                model: classificationModel
                            })
                        });

                        if (!response.ok) {
                            const error = await response.json();
                            throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
                        }

                        const typeResult = await response.json();
                        const matchedTypeData = typeResult.matched_type;
                        const determinedTypeName = matchedTypeData && matchedTypeData.name ? matchedTypeData.name : (typeof typeResult.matched_type === 'string' ? typeResult.matched_type : null);

                        // Check confidence threshold - force generic if below threshold
                        const confidence = typeResult.confidence !== undefined ? typeResult.confidence : 0;
                        const minConfidence = apiConfig.classificationConfidenceThreshold !== undefined ? apiConfig.classificationConfidenceThreshold : 0.85;
                        const isLowConfidence = confidence < minConfidence;

                        if (!determinedTypeName || isLowConfidence) {
                            // Fallback to base package if no type determined or low confidence
                            const basePackageName = getBasePackageName();
                            selectedRole = basePackageName;
                            shouldUseGenericSingleDraft = true;
                        } else {
                            // Check if determined type is in user's packages
                            const determinedPackage = userPackages.find(p => p.name === determinedTypeName);
                            if (determinedPackage) {
                                // Type matches user package - use it
                                // NOTE: We do NOT auto-update defaultRole here - it should only be changed by user in settings
                                selectedRole = determinedTypeName;
                            } else {
                                // Type doesn't match any user package - use base package single draft
                                const basePackageName = getBasePackageName();
                                selectedRole = basePackageName;
                                shouldUseGenericSingleDraft = true;
                            }
                        }

                        // Report type determination progress
                        if (onProgress) {
                            onProgress({
                                step: 'type',
                                data: {
                                    type: selectedRole,
                                    confidence: confidence
                                }
                            });
                        }
                    } catch (typeError) {
                        console.error('Error determining type from content:', typeError);
                        // Fallback to default role
                        selectedRole = defaultRole;
                        // Still report type progress with fallback
                        if (onProgress) {
                            onProgress({
                                step: 'type',
                                data: {
                                    type: selectedRole,
                                    confidence: 0
                                }
                            });
                        }
                    }
                } else {
                    // No typed content - use default role and report immediately
                    if (onProgress) {
                        onProgress({
                            step: 'type',
                            data: {
                                type: selectedRole,
                                confidence: 1.0
                            }
                        });
                    }
                }

                // Switch to "Generating..." before starting draft generation
                updateButtonText(generateButton, 'Generating...');

                // Generate drafts
                try {
                    if (shouldUseGenericSingleDraft) {
                        // Generate single generic draft based on typed content
                        await generateGenericSingleDraft(
                            richContext,
                            platform,
                            composeSubject,
                            composeRecipient,
                            composeBodyText,
                            actualRecipientName,
                            recipientCompany,
                            adapter,
                            userAccountName,
                            userAccountEmail,
                            async (draftsText, classificationOrPartial) => {
                                // Remove progress overlay when streaming starts (first partial update)
                                if (typeof classificationOrPartial === 'boolean' && classificationOrPartial) {
                                    document.querySelector('.responseable-overlay.responseable-progress-overlay')?.remove();
                                }

                                // Create regenerateContext for new emails so tone selector works
                                const newEmailRegenerateContext = {
                                    richContext: context,
                                    sourceMessageText: '', // No source message for new emails
                                    threadHistory: '', // No thread history for new emails
                                    context: context,
                                    senderName: userAccountName || '[Name]',
                                    recipientName: actualRecipientName || '[Recipient]',
                                    recipientCompany: recipientCompany || null,
                                    composeSubject: composeSubject,
                                    composeBodyText: composeBodyText,
                                    composeRecipient: composeRecipient,
                                    isNewEmail: true,
                                    userAccountName: userAccountName,
                                    userAccountEmail: userAccountEmail
                                };

                                const newEmailParams = {
                                    isNewEmail: true,
                                    userPackages: userPackages,
                                    defaultRole: selectedRole,
                                    recipientName: actualRecipientName,
                                    recipientCompany: recipientCompany,
                                    userAccountName: userAccountName,
                                    userAccountEmail: userAccountEmail,
                                    skipAutoGenerate: true
                                };

                                // Handle both streaming (isPartial=true) and final (classification object) cases
                                if (typeof classificationOrPartial === 'boolean') {
                                    // This is a streaming update (isPartial flag) - pass isPartial directly like Reply flow
                                    await showDraftsOverlay(draftsText, context, platform, adapter, null, newEmailRegenerateContext, newEmailParams, classificationOrPartial);
                                    return;
                                }

                                // This is the final call with classification object
                                const classification = classificationOrPartial;

                                await showDraftsOverlay(draftsText, context, platform, adapter, classification, newEmailRegenerateContext, newEmailParams);
                            }
                        );
                    } else {
                        // Use normal flow with determined/default role
                        await generateDraftsForNewEmail(
                            richContext,
                            platform,
                            selectedRole,
                            actualRecipientName,
                            recipientCompany,
                            adapter,
                            userAccountName,
                            userAccountEmail,
                            composeSubject,
                            composeBodyText,
                            composeRecipient,
                            async (draftsText, classificationOrPartial) => {
                                // Remove progress overlay when streaming starts (first partial update)
                                if (typeof classificationOrPartial === 'boolean' && classificationOrPartial) {
                                    document.querySelector('.responseable-overlay.responseable-progress-overlay')?.remove();
                                }

                                // Create regenerateContext for new emails so tone selector works
                                const newEmailRegenerateContext = {
                                    richContext: context,
                                    sourceMessageText: '', // No source message for new emails
                                    threadHistory: '', // No thread history for new emails
                                    context: context,
                                    senderName: userAccountName || '[Name]',
                                    recipientName: actualRecipientName || '[Recipient]',
                                    recipientCompany: recipientCompany || null,
                                    composeSubject: composeSubject,
                                    composeBodyText: composeBodyText,
                                    composeRecipient: composeRecipient,
                                    isNewEmail: true,
                                    userAccountName: userAccountName,
                                    userAccountEmail: userAccountEmail
                                };

                                const newEmailParams = {
                                    isNewEmail: true,
                                    userPackages: userPackages,
                                    defaultRole: selectedRole,
                                    recipientName: actualRecipientName,
                                    recipientCompany: recipientCompany,
                                    userAccountName: userAccountName,
                                    userAccountEmail: userAccountEmail,
                                    skipAutoGenerate: true
                                };

                                // Handle both streaming (isPartial=true) and final (classification object) cases
                                if (typeof classificationOrPartial === 'boolean') {
                                    // This is a streaming update (isPartial flag) - pass isPartial directly like Reply flow
                                    await showDraftsOverlay(draftsText, context, platform, adapter, null, newEmailRegenerateContext, newEmailParams, classificationOrPartial);
                                    return;
                                }

                                // This is the final call with classification object
                                const classification = classificationOrPartial;

                                await showDraftsOverlay(draftsText, context, platform, adapter, classification, newEmailRegenerateContext, newEmailParams);
                            },
                            onProgress
                        );
                    }
                } catch (err) {
                    // Remove progress overlay on error
                    document.querySelector('.responseable-overlay.responseable-progress-overlay')?.remove();
                    alert(`${apiConfig.provider} API error: ${err.message}\nCheck API key and network.`);
                } finally {
                    updateButtonText(generateButton, currentButtonText);
                    generateButton.style.opacity = '1';
                    generateButton.disabled = false; // Re-enable button after generation
                }
                return;
            }

            // REPLY: Use classification flow with immediate progress overlay
            // Show progress overlay immediately for instant feedback
            const iconUrl = getChromeRuntime()?.runtime?.getURL ? getChromeRuntime().runtime.getURL('icon-128.png') : null;
            showProgressOverlay(iconUrl);

            // Update button to show we're working
            updateButtonText(generateButton, 'Working...');
            generateButton.style.opacity = '0.7';

            // Progress callback to update the overlay as each step completes
            const onProgress = (progress) => {
                if (progress.step === 'type') {
                    updateProgressStep('step-type', 'completed', formatTypeResult(progress.data.type));
                    updateProgressStep('step-goals', 'active');
                } else if (progress.step === 'goals') {
                    updateProgressStep('step-goals', 'completed', formatGoalsResult(progress.data.response_goals, progress.data.goal_titles));
                    updateProgressStep('step-tone', 'active');
                } else if (progress.step === 'tone') {
                    updateProgressStep('step-tone', 'completed', formatToneResult(progress.data.tone_needed, progress.data.tone_sets, progress.data.currentGoal));
                    updateProgressStep('step-generate', 'active');
                }
            };

            // Classify email with progress updates
            const classification = await classifyEmail(richContext, sourceMessageText, platform, threadHistoryText, senderName, onProgress);

            // Store context needed for regeneration
            // threadHistory excludes the email being replied to (for context only)
            const regenerateContext = {
                richContext,
                sourceMessageText,  // The actual email being replied to
                threadHistory: threadHistoryText,  // All other emails in thread (context only)
                context,
                senderName,
                senderEmail: actualSenderEmail,  // Sender email from emailDetails
                emailSubject: emailSubject,  // Subject of the email being replied to
                toRecipients: toRecipients,  // To recipients
                ccRecipients: ccRecipients,  // CC recipients
                emailDetails: emailDetails,  // Full email details (subject, senderName, senderEmail, body, to, cc)
                recipientName,
                recipientCompany
            };

            // Generate drafts with the classified tone
            try {
                await generateDraftsWithTone(
                    richContext,
                    sourceMessageText,
                    platform,
                    classification,
                    classification.tone_needed || 'professional',
                    senderName,
                    recipientName,
                    recipientCompany,
                    adapter,
                    async (draftsText, isPartial = false) => {
                        // Remove progress overlay when streaming starts (first partial update)
                        if (isPartial) {
                            document.querySelector('.responseable-overlay.responseable-progress-overlay')?.remove();
                        }
                        await showDraftsOverlay(draftsText, context, platform, null, classification, regenerateContext, null, isPartial);
                    },
                    regenerateContext  // Pass regenerateContext so function can access threadHistory
                );
            } catch (err) {
                // Remove progress overlay on error
                document.querySelector('.responseable-overlay.responseable-progress-overlay')?.remove();
                alert(`${apiConfig.provider} API error: ${err.message}\nCheck API key and network.`);
            } finally {
                // Remove progress overlay if still present
                document.querySelector('.responseable-overlay.responseable-progress-overlay')?.remove();
                // Restore button text (icon should still be there)
                updateButtonText(generateButton, currentButtonText);
                generateButton.style.opacity = '1';
                generateButton.disabled = false; // Re-enable button
                // Restore platform-specific styles
                if (platform === 'linkedin') {
                    generateButton.style.borderRadius = '16px';
                    generateButton.style.height = '28px';
                    generateButton.style.padding = '4px 12px';
                    generateButton.style.margin = '0 8px 0 0';
                    generateButton.style.background = '#0A66C2';
                    generateButton.style.fontWeight = '600';
                    generateButton.style.display = 'inline-flex';
                    generateButton.style.alignItems = 'center';
                    generateButton.style.verticalAlign = 'middle';
                    generateButton.style.alignSelf = 'center';
                }
            }
        });

        // Insert button before send button
        toolbar.insertBefore(generateButton, sendButton.nextSibling);
    });
};

// Simple overlay to show drafts
// Function to generate drafts with a specific tone
// Generate single base package draft based on typed content (when type doesn't match user packages)
const generateGenericSingleDraft = async (richContext, platform, subject, recipient, bodyText, recipientName, recipientCompany, adapter, userAccountName = '', userAccountEmail = '', onComplete = null) => {
    try {
        await loadApiConfig();

        // Get base package
        const userPackages = await getUserPackages();
        const genericPackage = userPackages.find(p => p.base); // getUserPackages() always includes base package

        // Build context from typed content only (forwarded messages are ignored)
        let composeContext = `${subject ? `Subject: ${subject}\n` : ''}${recipient ? `To: ${recipient}\n` : ''}${bodyText ? `\nEmail content:\n${bodyText}` : ''}`;

        const recipientDisplay = recipientName || '[Recipient]';
        const recipientText = recipientName
            ? ` to ${recipientName}${recipientCompany ? ` at ${recipientCompany}` : ''}`
            : '';

        const signatureInstructions = userAccountName
            ? `Use "${userAccountName}" as your name in the signature.`
            : `Use "[Name]" as placeholder for your name in the signature.`;

        // Use new streaming API endpoint for generic draft generation
        // Note: systemPrompt and related prompt building code removed - prompts are now built server-side
        let draftText;
        try {
            const typedContent = `${composeSubject ? `Subject: ${composeSubject}\n` : ''}${composeRecipient ? `To: ${composeRecipient}\n` : ''}${bodyText ? `\nEmail content:\n${bodyText}` : ''}`;

            draftText = await callNewStreamingAPI(
                `${VERCEL_PROXY_URL}/generate-drafts-draft`,
                {
                    typedContent: typedContent,
                    package: genericPackage,
                    variantSet: variantLabels,
                    currentGoal: goal,
                    goalTone: toneResult.tone_needed,
                    recipientName: recipientName,
                    recipientCompany: recipientCompany,
                    userIntent: genericPackage.userIntent,
                    keyTopics: [],
                    writingStyle: null,
                    enableStyleMimicking: false,
                    platform: platform,
                    provider: apiConfig.provider,
                    model: apiConfig.model,
                    temperature: 0.8,
                    max_tokens: 2000
                },
                (fullContent, newChunk) => {
                    if (onComplete) {
                        onComplete(fullContent, true); // true = isPartial
                    }
                }
            );
        } catch (fetchError) {
            // Handle network errors (CORS, connection issues, etc.)
            const networkError = fetchError.message || String(fetchError);
            console.error('Network error during draft generation API call:', networkError);
            if (networkError.includes('Failed to fetch') || networkError.includes('NetworkError')) {
                throw new Error(`Network error: Unable to connect to ${apiConfig.provider} API. Please check:\n1. Your internet connection\n2. CORS settings (if testing locally)\n3. API endpoint is accessible\n\nError: ${networkError}`);
            }
            // Re-throw other errors (they're already formatted by the API)
            throw fetchError;
        }

        if (!draftText || draftText.trim().length === 0) {
            console.error('Empty response from streaming API');
            throw new Error(`Empty response from ${apiConfig.provider} API`);
        }

        draftText = draftText.trim();

        // Parse drafts - split by fixed separator
        let draftBlocks = [];

        if (draftText.includes(RESPONSE_VARIANT_SEPARATOR)) {
            draftBlocks = draftText.split(RESPONSE_VARIANT_SEPARATOR)
                .map(block => block.trim())
                .filter(block => block.length > 10);
        } else {
            // Single draft fallback
            draftBlocks = [draftText.trim()];
        }

        // Ensure we have the expected number of variants
        const expectedNumVariants = apiConfig.numVariants || 4;
        if (draftBlocks.length < expectedNumVariants) {
            // Pad with the last draft if needed (shouldn't happen, but safety)
            while (draftBlocks.length < expectedNumVariants && draftBlocks.length > 0) {
                draftBlocks.push(draftBlocks[draftBlocks.length - 1]);
            }
        } else if (draftBlocks.length > expectedNumVariants) {
            // Limit to expected number
            draftBlocks = draftBlocks.slice(0, expectedNumVariants);
        }

        // Create variant labels
        const defaultVariants = [
            'Friendly response',
            'Insightful response',
            'Polite response',
            'Professional neutral response',
            'Concise response',
            'Brief response',
            'Detailed response'
        ];
        const variantLabels = defaultVariants.slice(0, expectedNumVariants);

        // Determine tone options for base package (similar to other packages)
        // Use default tones for base package
        const defaultTones = ['Professional', 'Friendly', 'Warm', 'Casual', 'Formal', 'Polite', 'Concise'];
        const goal = 'Generate appropriate draft';

        // Try to determine tones based on context, but fallback to defaults
        let toneResult = {
            tone_needed: 'Professional',
            tone_sets: { [goal]: defaultTones.slice(0, apiConfig.numTones || 3) } // Use configured number of default tones
        };

        // If we have typed content, try to determine more appropriate tones
        if (composeContext && composeContext.trim().length > 10) {
            try {
                await loadApiConfig();
                const classificationModel = apiConfig.classificationModel || apiConfig.model;

                // Use new API endpoint for tone determination
                const response = await fetch(`${VERCEL_PROXY_URL}/determine-tones-draft-generic`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        typedContent: bodyText || '',
                        subject: subject || '',
                        recipient: recipient || '',
                        numTones: apiConfig.numTones || 3,
                        provider: apiConfig.provider,
                        model: classificationModel
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
                }

                const parsedToneResult = await response.json();

                // Update tone result with API response (tone values are already cleaned server-side)
                if (parsedToneResult.tone_needed) {
                    toneResult.tone_needed = parsedToneResult.tone_needed;
                }

                if (parsedToneResult.tone_sets && parsedToneResult.tone_sets[goal]) {
                    toneResult.tone_sets[goal] = parsedToneResult.tone_sets[goal];
                    // Ensure we have at least 2 tones for dropdown to show
                    if (toneResult.tone_sets[goal].length < 2) {
                        toneResult.tone_sets[goal] = defaultTones.slice(0, apiConfig.numTones || 3);
                    }
                } else {
                    toneResult.tone_sets[goal] = defaultTones.slice(0, apiConfig.numTones || 3);
                }
            } catch (toneError) {
                console.error('Tone determination error for generic draft:', toneError);
                // Use defaults
                toneResult.tone_sets[goal] = defaultTones.slice(0, apiConfig.numTones || 3);
            }
        }

        // Create classification for display (single goal, no tabs, but multiple variants)
        const classification = {
            type: genericPackage.name, // Use actual package name, not hardcoded 'generic'
            intent: genericPackage.userIntent,
            response_goals: [goal],
            goal_titles: { [goal]: 'Draft' },
            variant_sets: { [goal]: variantLabels },
            tone_needed: toneResult.tone_needed,
            tone_sets: toneResult.tone_sets,
            recipient_name: recipientName || null,
            recipient_company: recipientCompany || null,
            key_topics: [],
            isNewEmail: true,
            isGenericSingleDraft: false // Changed to false since we now have multiple variants
        };

        // Join drafts with separator for showDraftsOverlay
        const draftsText = draftBlocks.join(RESPONSE_VARIANT_SEPARATOR);

        // Final call with complete content (if onComplete callback provided, it will handle the overlay)
        if (onComplete) {
            await onComplete(draftsText, classification);
        } else {
            // Fallback: show overlay directly if no callback provided
            // Create regenerateContext for generic new emails so tone selector works
            const newEmailRegenerateContext = {
                richContext: richContext,
                sourceMessageText: '', // No source message for new emails
                threadHistory: '', // No thread history for new emails
                context: richContext,
                senderName: userAccountName || '[Name]',
                recipientName: recipientName || '[Recipient]',
                recipientCompany: recipientCompany || null,
                composeSubject: subject || '',
                composeBodyText: bodyText || '',
                composeRecipient: recipient || '',
                isNewEmail: true,
                userAccountName: userAccountName,
                userAccountEmail: userAccountEmail
            };

            await showDraftsOverlay(draftsText, richContext, platform, adapter, classification, newEmailRegenerateContext, {
                isNewEmail: true,
                userPackages: userPackages,
                defaultRole: genericPackage.name, // Use actual package name
                recipientName: recipientName,
                recipientCompany: recipientCompany,
                userAccountName: userAccountName,
                userAccountEmail: userAccountEmail,
                skipAutoGenerate: true
            });
        }
    } catch (error) {
        console.error('Error generating generic single draft:', error);
        throw error;
    }
};

// Generate drafts for new emails (mimics reply generation flow)
const generateDraftsForNewEmail = async (richContext, platform, selectedRole, recipientName, recipientCompany, adapter, userAccountName = '', userAccountEmail = '', composeSubject = '', composeBodyText = '', composeRecipient = '', onComplete, onProgress = null) => {
    try {
        await loadApiConfig();
        const numVariants = apiConfig.numVariants || 4;
        const classificationModel = apiConfig.classificationModel || apiConfig.model;

        // Get the package for the selected role
        const userPackages = await getUserPackages();
        let selectedPackage = userPackages.find(p => p.name === selectedRole);

        // Fallback to base package if selected role not found
        if (!selectedPackage) {
            selectedPackage = userPackages.find(p => p.base); // getUserPackages() always includes base package
        }

        if (!selectedPackage.userIntent) {
            throw new Error(`Selected package "${selectedRole}" does not have userIntent defined`);
        }

        // Check if this is the base package - will limit to 1 goal for free plan
        const isGenericPackage = selectedPackage && selectedPackage.base === true;

        const userIntent = selectedPackage.userIntent;
        const roleDescription = selectedPackage.roleDescription;

        // ============================================================================
        // STEP 1: GOALS DETERMINATION BASED ON userIntent AND TYPED CONTENT (similar to intent/goals for replies)
        // ============================================================================
        // Build context from typed content if available (forwarded messages are ignored)
        const typedContentContext = (composeSubject || composeBodyText || composeRecipient)
            ? `\n\nTYPED EMAIL CONTENT (use this to inform goals and topics):
Subject: ${composeSubject || '(not provided)'}
To: ${composeRecipient || '(not provided)'}
Email body: ${composeBodyText || '(not provided)'}`
            : '';

        let intentGoalsResult;
        try {
            // Use new API endpoint for draft goals determination
            const response = await fetch(`${VERCEL_PROXY_URL}/determine-goals-draft`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    typedContent: composeBodyText,
                    package: selectedPackage,
                    recipientName: recipientName,
                    recipientCompany: recipientCompany,
                    platform: platform,
                    numGoals: apiConfig.numGoals || 5,
                    numVariants: numVariants,
                    provider: apiConfig.provider,
                    model: classificationModel
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            intentGoalsResult = await response.json();
        } catch (goalsError) {
            console.error('Goals determination error:', goalsError);
            // Fallback with generic values
            intentGoalsResult = {
                response_goals: ['Introduce yourself', 'Build rapport', 'Make a request'],
                goal_titles: {
                    'Introduce yourself': 'Introduction',
                    'Build rapport': 'Rapport',
                    'Make a request': 'Request'
                },
                variant_sets: {
                    'Introduce yourself': ['Professional', 'Warm', 'Concise', 'Value-focused'],
                    'Build rapport': ['Friendly', 'Professional', 'Casual', 'Engaging'],
                    'Make a request': ['Direct', 'Polite', 'Value-first', 'Relationship-based']
                },
                recipient_name: recipientName || null,
                recipient_company: recipientCompany || null,
                key_topics: []
            };
        }

        // Report goals determination progress
        if (onProgress) {
            onProgress({
                step: 'goals',
                data: {
                    intent: userIntent,
                    response_goals: intentGoalsResult.response_goals,
                    goal_titles: intentGoalsResult.goal_titles
                }
            });
        }

        // ============================================================================
        // LIMIT GOALS TO CONFIGURED numGoals
        // ============================================================================
        const maxGoals = apiConfig.numGoals || 3;
        if (intentGoalsResult.response_goals && intentGoalsResult.response_goals.length > maxGoals) {
            intentGoalsResult.response_goals = intentGoalsResult.response_goals.slice(0, maxGoals);
            // Update goal_titles and variant_sets to match
            const limitedGoalTitles = {};
            const limitedVariantSets = {};
            intentGoalsResult.response_goals.forEach(goal => {
                if (intentGoalsResult.goal_titles && intentGoalsResult.goal_titles[goal]) {
                    limitedGoalTitles[goal] = intentGoalsResult.goal_titles[goal];
                }
                if (intentGoalsResult.variant_sets && intentGoalsResult.variant_sets[goal]) {
                    limitedVariantSets[goal] = intentGoalsResult.variant_sets[goal];
                }
            });
            intentGoalsResult.goal_titles = limitedGoalTitles;
            intentGoalsResult.variant_sets = limitedVariantSets;
        }

        // Limit tones per goal to configured numTones
        const maxTones = apiConfig.numTones || 3;
        if (intentGoalsResult.tone_sets) {
            Object.keys(intentGoalsResult.tone_sets).forEach(goal => {
                if (Array.isArray(intentGoalsResult.tone_sets[goal]) && intentGoalsResult.tone_sets[goal].length > maxTones) {
                    intentGoalsResult.tone_sets[goal] = intentGoalsResult.tone_sets[goal].slice(0, maxTones);
                }
            });
        }

        // ============================================================================
        // ENSURE VARIANTS ARE CORRECT FOR ALL GOALS (for base package)
        // ============================================================================
        // Ensure variants are correct for each goal (already limited to numGoals above)
        if (isGenericPackage && intentGoalsResult.response_goals && intentGoalsResult.response_goals.length > 0) {
            intentGoalsResult.response_goals.forEach(goal => {
                if (intentGoalsResult.variant_sets && intentGoalsResult.variant_sets[goal]) {
                    const variants = intentGoalsResult.variant_sets[goal];
                    // Ensure we have the expected number of variants
                    if (variants.length < numVariants) {
                        // Pad with fallback variants if needed
                        const fallbackVariants = ['Professional', 'Friendly', 'Concise', 'Warm', 'Direct', 'Polite'];
                        const needed = numVariants - variants.length;
                        const additional = fallbackVariants.filter(v => !variants.includes(v)).slice(0, needed);
                        variants.push(...additional);
                    }
                    // Limit to numVariants if more than expected
                    intentGoalsResult.variant_sets[goal] = variants.slice(0, numVariants);
                }
            });
        }

        // ============================================================================
        // STEP 2: TONE DETERMINATION (simpler for new emails)
        // ============================================================================
        let toneResult;
        try {
            // Use new API endpoint for draft tone determination
            const response = await fetch(`${VERCEL_PROXY_URL}/determine-tones-draft-specific`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userIntent: userIntent,
                    responseGoals: intentGoalsResult.response_goals,
                    numTones: apiConfig.numTones || 3,
                    provider: apiConfig.provider,
                    model: classificationModel
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            toneResult = await response.json();

            // Clean and validate tone values - they should be short tone names, not full email text
            const cleanToneValue = (tone) => {
                if (!tone || typeof tone !== 'string') return 'professional';
                const trimmed = tone.trim();

                // If tone is clearly email content (too long), extract first meaningful word
                if (trimmed.length > 50) {
                    // Likely email content - extract first word and capitalize properly
                    const firstWord = trimmed.split(/\s+/)[0].toLowerCase();
                    // Capitalize first letter
                    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
                }

                // For normal tones, limit to 2 words max and preserve capitalization
                const words = trimmed.split(/\s+/).slice(0, 2);
                const cleaned = words.join(' ');

                // Capitalize first letter of each word for proper display
                const capitalized = cleaned.split(' ').map(word =>
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                ).join(' ');

                // If result is empty or still too long, fallback to professional
                return capitalized && capitalized.length <= 30 ? capitalized : 'Professional';
            };

            // Clean tone_needed
            if (toneResult.tone_needed) {
                toneResult.tone_needed = cleanToneValue(toneResult.tone_needed);
            }

            // Clean all tone_sets values
            if (toneResult.tone_sets && typeof toneResult.tone_sets === 'object') {
                Object.keys(toneResult.tone_sets).forEach(goal => {
                    if (Array.isArray(toneResult.tone_sets[goal])) {
                        toneResult.tone_sets[goal] = toneResult.tone_sets[goal].map(cleanToneValue).filter((t, i, arr) => arr.indexOf(t) === i); // Remove duplicates
                    }
                });
            }
        } catch (toneError) {
            console.error('Tone determination error:', toneError);
            // Fallback
            toneResult = {
                tone_needed: 'professional',
                tone_sets: {}
            };
            intentGoalsResult.response_goals.forEach(goal => {
                toneResult.tone_sets[goal] = ['professional', 'friendly', 'warm'];
            });
        }

        // Report tone determination progress
        if (onProgress) {
            onProgress({
                step: 'tone',
                data: {
                    tone_needed: toneResult.tone_needed || 'Professional',
                    tone_sets: toneResult.tone_sets || {},
                    currentGoal: intentGoalsResult.response_goals?.[0] || null
                }
            });
        }

        // ============================================================================
        // STEP 3: BUILD CLASSIFICATION OBJECT (similar to reply flow)
        // ============================================================================
        const classification = {
            type: selectedRole,
            intent: userIntent,
            response_goals: intentGoalsResult.response_goals || [],
            goal_titles: intentGoalsResult.goal_titles || {},
            variant_sets: intentGoalsResult.variant_sets || {},
            tone_needed: toneResult.tone_needed || 'professional',
            tone_sets: toneResult.tone_sets || {},
            recipient_name: intentGoalsResult.recipient_name || recipientName || null,
            recipient_company: intentGoalsResult.recipient_company || recipientCompany || null,
            key_topics: intentGoalsResult.key_topics || [],
            isNewEmail: true
        };

        // ============================================================================
        // STEP 4: GENERATE DRAFTS WITH TONE (same as reply flow)
        // ============================================================================
        // Store typed content in classification for use in draft generation
        classification.composeSubject = composeSubject;
        classification.composeBodyText = composeBodyText;
        classification.composeRecipient = composeRecipient;

        await generateDraftsWithTone(
            richContext,
            '', // No source message for new emails
            platform,
            classification,
            classification.tone_needed,
            userAccountName || '[Name]',
            recipientName || '[Recipient]',
            recipientCompany || null,
            adapter,
            async (draftsText, isPartial = false) => {
                // Remove progress overlay when streaming starts (first partial update)
                if (isPartial) {
                    document.querySelector('.responseable-overlay.responseable-progress-overlay')?.remove();
                }

                // Pass classification along with draftsText to onComplete
                // Note: generateDraftsWithTone calls onComplete(draftsText, isPartial)
                // so we need to handle isPartial and pass classification separately
                if (onComplete) {
                    // For partial updates, pass isPartial flag; for final, pass classification
                    if (isPartial) {
                        // For streaming updates, pass isPartial as boolean to indicate it's a partial update
                        // The callback will handle this by calling showDraftsOverlay with isPartial=true
                        await onComplete(draftsText, true); // Pass isPartial=true (boolean)
                    } else {
                        // For final update, pass classification object
                        await onComplete(draftsText, classification); // Pass classification object
                    }
                }
            },
            null // No regenerateContext for new emails
        );
    } catch (error) {
        console.error('Error generating drafts for new email:', error);
        throw error;
    }
};

/**
 * Validate license key and check/increment usage if needed
 * Returns validation result with plan info
 */
const validateLicenseBeforeGeneration = async () => {
    try {
        // Get license key from storage
        return new Promise((resolve) => {
            chrome.storage.sync.get(['licenseKey'], async (result) => {
                const licenseKey = result.licenseKey;

                // If no license key, allow free tier usage
                if (!licenseKey) {
                    resolve({ valid: true, plan: 'free' });
                    return;
                }

                try {
                    // Validate license with increment flag for Basic plan
                    const response = await fetch(`${VERCEL_PROXY_URL}/validate`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            key: licenseKey,
                            increment: true // Increment usage for Basic plan
                        }),
                    });

                    const data = await response.json();

                    if (data.valid) {
                        resolve({
                            valid: true,
                            plan: data.plan,
                            active_packages: data.active_packages || [],
                            generations_remaining: data.generations_remaining,
                        });
                    } else {
                        // License invalid - show error but don't block (graceful degradation)
                        console.warn('License validation failed:', data.error);
                        resolve({
                            valid: false,
                            error: data.error,
                            plan: data.plan || 'free'
                        });
                    }
                } catch (error) {
                    console.error('License validation error:', error);
                    // On error, allow free tier (graceful degradation)
                    resolve({ valid: true, plan: 'free' });
                }
            });
        });
    } catch (error) {
        console.error('License validation error:', error);
        // On error, allow free tier
        return { valid: true, plan: 'free' };
    }
};

const generateDraftsWithTone = async (richContext, sourceMessageText, platform, classification, selectedTone, senderName, recipientName, recipientCompany, adapter, onComplete, regenerateContext = null) => {
    try {
        await loadApiConfig();

        // Validate license before generation (for Basic plan usage tracking)
        const licenseValidation = await validateLicenseBeforeGeneration();

        // If license invalid and not free tier, show warning but continue
        if (!licenseValidation.valid && licenseValidation.plan !== 'free') {
            console.warn('License validation failed, using free tier limits');
        }

        // Get the primary goal and its variants/tone
        // Check if a specific goal was passed (for tab switching)
        const currentGoal = classification._currentGoal || (classification.response_goals && classification.response_goals[0]
            ? classification.response_goals[0]
            : 'respond appropriately');

        // Load numVariants setting
        await loadApiConfig();
        const expectedNumVariants = apiConfig.numVariants || 4;

        // Get default variants based on numVariants setting
        const defaultVariants = [
            'Friendly response',
            'Insightful response',
            'Polite response',
            'Professional neutral response',
            'Concise response',
            'Brief response',
            'Detailed response'
        ];

        // Use provided variant set if available (from tab switching), otherwise get from classification
        let variantSet = classification._currentVariantSet || (classification.variant_sets && classification.variant_sets[currentGoal]
            ? classification.variant_sets[currentGoal]
            : defaultVariants.slice(0, expectedNumVariants));

        // Ensure variantSet is limited to expectedNumVariants (safety check)
        if (Array.isArray(variantSet) && variantSet.length > expectedNumVariants) {
            variantSet = variantSet.slice(0, expectedNumVariants);
        }

        const toneSet = classification.tone_sets && classification.tone_sets[currentGoal]
            ? classification.tone_sets[currentGoal]
            : [selectedTone];

        // Use provided tone if available (from tab switching), otherwise use first from tone_set or selectedTone
        const goalTone = classification._currentTone || (toneSet[0] || selectedTone);

        // Get user-selected packages from storage (defaults to base package if none selected)
        const userPackages = await getUserPackages();

        // Get matched type from userPackages based on classification.type
        const matchedPackage = userPackages.find(p => p.name === classification.type) || userPackages.find(p => p.base); // getUserPackages() always includes base package

        // Check if this is a new email
        const isNewEmail = classification.isNewEmail === true;

        // Extract userIntent early to avoid initialization issues
        const userIntent = matchedPackage && matchedPackage.userIntent ? matchedPackage.userIntent : '';

        // Extract the actual email being replied to and thread history separately
        // sourceMessageText is the ACTUAL email being replied to (the specific one, not necessarily latest)
        // Use threadHistory from regenerateContext if available (it excludes the email being replied to)
        const emailBeingRepliedTo = sourceMessageText || '';
        const previousThreadHistory = (regenerateContext && regenerateContext.threadHistory)
            ? regenerateContext.threadHistory
            : (richContext.thread && richContext.thread !== 'New message'
                ? richContext.thread
                : '');

        let draftsText;
        try {
            // Use new streaming API endpoint for draft generation
            if (isNewEmail) {
                // New email draft - use generate-drafts-draft endpoint
                draftsText = await callNewStreamingAPI(
                    `${VERCEL_PROXY_URL}/generate-drafts-draft`,
                    {
                        typedContent: classification.composeBodyText,
                        package: matchedPackage,
                        variantSet: variantSet,
                        currentGoal: currentGoal,
                        goalTone: goalTone,
                        recipientName: classification.recipient_name,
                        recipientCompany: classification.recipient_company,
                        userIntent: userIntent,
                        keyTopics: classification.key_topics,
                        writingStyle: classification.writing_style,
                        enableStyleMimicking: apiConfig.enableStyleMimicking,
                        platform: platform,
                        provider: apiConfig.provider,
                        model: apiConfig.model,
                        temperature: 0.8,
                        max_tokens: 2000
                    },
                    (fullContent, newChunk) => {
                        if (onComplete) {
                            onComplete(fullContent, true); // true = isPartial
                        }
                    }
                );
            } else {
                // Reply draft - use generate-drafts-reply endpoint
                draftsText = await callNewStreamingAPI(
                    `${VERCEL_PROXY_URL}/generate-drafts-reply`,
                    {
                        emailContent: emailBeingRepliedTo,
                        threadHistory: previousThreadHistory,
                        package: matchedPackage,
                        variantSet: variantSet,
                        currentGoal: currentGoal,
                        goalTone: goalTone,
                        recipientName: senderName || recipientName,
                        recipientCompany: recipientCompany,
                        subject: richContext.subject && richContext.subject !== 'LinkedIn Message' ? richContext.subject : undefined,
                        senderName: senderName,
                        intent: classification.intent,
                        keyTopics: classification.key_topics,
                        writingStyle: classification.writing_style,
                        enableStyleMimicking: apiConfig.enableStyleMimicking,
                        platform: platform,
                        provider: apiConfig.provider,
                        model: apiConfig.model,
                        temperature: 0.8,
                        max_tokens: 2000
                    },
                    (fullContent, newChunk) => {
                        if (onComplete) {
                            onComplete(fullContent, true); // true = isPartial
                        }
                    }
                );
            }
        } catch (fetchError) {
            // Handle network errors (CORS, connection issues, etc.)
            const networkError = fetchError.message || String(fetchError);
            console.error('Network error during draft generation API call:', networkError);
            if (networkError.includes('Failed to fetch') || networkError.includes('NetworkError')) {
                throw new Error(`Network error: Unable to connect to ${apiConfig.provider} API. Please check:\n1. Your internet connection\n2. CORS settings (if testing locally)\n3. API endpoint is accessible\n\nError: ${networkError}`);
            }
            // Re-throw other errors (they're already formatted by the API)
            throw fetchError;
        }

        if (!draftsText || draftsText.trim().length === 0) {
            console.error('Empty response from streaming API');
            throw new Error(`Empty response from ${apiConfig.provider} API`);
        }

        // Final call with complete content
        onComplete(draftsText, false); // false = not partial, this is the final content
    } catch (err) {
        console.error('Error generating drafts:', err);
        throw err;
    }
};

// Create a streaming overlay that shows content as it arrives
const showStreamingOverlay = (initialText = '') => {
    // Remove any existing overlay
    document.querySelector('.responseable-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'responseable-overlay responseable-streaming';
    overlay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 80%;
        max-width: 800px;
        max-height: 90vh;
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.3);
        z-index: 2147483647;
        padding: 24px;
        font-family: Google Sans,Roboto,sans-serif;
        display: flex;
        flex-direction: column;
    `;

    // Add CSS animation for typing cursor
    const style = document.createElement('style');
    style.textContent = `
        @keyframes responseable-blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
        }
        .responseable-typing-cursor {
            animation: responseable-blink 1s infinite;
        }
    `;
    overlay.appendChild(style);

    // Get icon URL for streaming overlay
    const streamingRuntime = getChromeRuntime();
    const streamingIconUrl = streamingRuntime ? streamingRuntime.getURL('xrepl-light.png') : '';

    overlay.innerHTML += `
        <div style="flex-shrink: 0;">
            <h2 style="margin-top:0; display: flex; align-items: center; gap: 8px;">
                <img src="${streamingIconUrl}" alt="xRepl.ai" style="width: 24px; height: 24px; animation: responseable-pulse 1.5s ease-in-out infinite;" onerror="this.style.display='none'">
                <span style="color:#5567b9;">xRepl.ai</span><span style="color:#9b9fa8;"> - Generating Drafts...</span>
            </h2>
            <style>@keyframes responseable-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.8; } }</style>
        </div>
        <div class="responseable-drafts-scroll" style="flex: 1; overflow-y: auto; margin: 16px 0; padding-right: 8px;">
            <div class="responseable-streaming-content" style="font-size: 14px; line-height: 1.6; color: #202124; white-space: pre-wrap; font-family: inherit;">
                ${initialText ? initialText.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '<span style="color: #5f6368;">Waiting for response...</span>'}
            </div>
        </div>
        <div style="flex-shrink: 0; display: flex; justify-content: flex-end; padding-top: 16px; border-top: 1px solid #dadce0;">
            <button class="responseable-close-btn" style="padding: 10px 24px; background: #f1f3f4; color: #5f6368; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">Cancel</button>
        </div>
    `;

    document.body.appendChild(overlay);

    // Add close button handler
    overlay.querySelector('.responseable-close-btn').addEventListener('click', () => {
        overlay.remove();
    });

    // Close on escape key
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    return overlay;
};

// Format streaming content with variant labels and separators
const formatStreamingContent = (content) => {
    // Escape HTML
    let displayText = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Split by the variant separator
    const separator = '|||RESPONSE_VARIANT|||';
    const parts = displayText.split(separator);

    if (parts.length <= 1) {
        // No separators yet, just return the content as-is
        return displayText;
    }

    // Format each variant with a label and horizontal separator
    // Keep the full body including greeting - don't extract title from content
    const formattedParts = parts.map((part, index) => {
        const variantNum = index + 1;
        const body = part.trim();

        // Variant label on its own line, styled with blue color
        const variantLabel = `<div style="color: #5567b9; font-weight: bold; margin-bottom: 8px;">Variant ${variantNum}</div>`;

        if (index === 0) {
            // First variant - no separator before it
            return `${variantLabel}${body}`;
        } else {
            // Add horizontal separator before subsequent variants
            return `<hr style="border: none; border-top: 1px solid #dadce0; margin: 16px 0;">${variantLabel}${body}`;
        }
    });

    return formattedParts.join('');
};

// Update streaming overlay content
const updateStreamingOverlay = (content) => {
    const overlay = document.querySelector('.responseable-overlay.responseable-streaming');
    if (!overlay) return false;

    const streamingContent = overlay.querySelector('.responseable-streaming-content');
    if (streamingContent) {
        const formattedContent = formatStreamingContent(content);
        streamingContent.innerHTML = `${formattedContent}<span class="responseable-typing-cursor" style="display: inline-block; width: 2px; height: 1em; background: #1a73e8; margin-left: 2px;"></span>`;

        // Scroll to bottom
        const scrollContainer = overlay.querySelector('.responseable-drafts-scroll');
        if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
    }
    return true;
};

// Show progress overlay immediately when user clicks the button
// This provides instant feedback while analysis steps complete
const showProgressOverlay = (iconUrl) => {
    // Remove any existing overlay
    document.querySelector('.responseable-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'responseable-overlay responseable-progress-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 80%;
        max-width: 600px;
        max-height: 90vh;
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.3);
        z-index: 2147483647;
        padding: 24px;
        font-family: Google Sans,Roboto,sans-serif;
        display: flex;
        flex-direction: column;
    `;

    overlay.innerHTML = `
        <style>
            @keyframes responseable-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.8; } }
            @keyframes responseable-dot-bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-4px); } }
            @keyframes responseable-fade-in { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes responseable-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            .responseable-progress-step { display: flex; align-items: flex-start; margin-bottom: 16px; padding: 12px; border-radius: 8px; background: #f8f9fa; transition: all 0.3s ease; }
            .responseable-progress-step.active { background: #e8f0fe; }
            .responseable-progress-step.completed { background: #e6f4ea; }
            .responseable-step-icon { width: 24px; height: 24px; margin-right: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
            .responseable-step-spinner { width: 18px; height: 18px; border: 2px solid #dadce0; border-top-color: #1a73e8; border-radius: 50%; animation: responseable-spin 0.8s linear infinite; }
            .responseable-step-check { color: #34a853; font-size: 18px; }
            .responseable-step-pending { color: #9aa0a6; font-size: 14px; }
            .responseable-step-content { flex: 1; }
            .responseable-step-title { font-weight: 500; color: #202124; margin-bottom: 4px; }
            .responseable-step-result { font-size: 13px; color: #5f6368; animation: responseable-fade-in 0.3s ease; }
            .responseable-step-result-value { color: #1a73e8; font-weight: 500; }
            .responseable-goals-preview { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
            .responseable-goal-chip { background: #e8f0fe; color: #1967d2; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
            .responseable-tones-preview { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
            .responseable-tone-chip { background: #e8f0fe; color: #1967d2; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
        </style>
        <div style="display: flex; align-items: center; margin-bottom: 20px;">
            ${iconUrl ? `<img src="${iconUrl}" alt="xRepl.ai" style="width: 24px; height: 24px; margin-right: 8px; animation: responseable-pulse 2s ease-in-out infinite;">` : ''}
            <h2 style="margin: 0; font-size: 18px; font-weight: 500;">
                <span style="color: #5567b9;">xRepl.ai</span>
                <span style="color: #9b9fa8;"> - Analyzing Email</span>
            </h2>
        </div>
        <div class="responseable-progress-steps">
            <div class="responseable-progress-step active" id="step-type">
                <div class="responseable-step-icon">
                    <div class="responseable-step-spinner"></div>
                </div>
                <div class="responseable-step-content">
                    <div class="responseable-step-title">Determining Semantic Context...</div>
                    <div class="responseable-step-result" id="result-type"></div>
                </div>
            </div>
            <div class="responseable-progress-step" id="step-goals">
                <div class="responseable-step-icon">
                    <span class="responseable-step-pending">○</span>
                </div>
                <div class="responseable-step-content">
                    <div class="responseable-step-title">Analyzing strategies...</div>
                    <div class="responseable-step-result" id="result-goals"></div>
                </div>
            </div>
            <div class="responseable-progress-step" id="step-tone">
                <div class="responseable-step-icon">
                    <span class="responseable-step-pending">○</span>
                </div>
                <div class="responseable-step-content">
                    <div class="responseable-step-title">Selecting optimal tones...</div>
                    <div class="responseable-step-result" id="result-tone"></div>
                </div>
            </div>
            <div class="responseable-progress-step" id="step-generate">
                <div class="responseable-step-icon">
                    <span class="responseable-step-pending">○</span>
                </div>
                <div class="responseable-step-content">
                    <div class="responseable-step-title">Generating drafts...</div>
                    <div class="responseable-step-result" id="result-generate"></div>
                </div>
            </div>
        </div>
        <div style="flex-shrink: 0; display: flex; justify-content: flex-end; padding-top: 16px; border-top: 1px solid #dadce0; margin-top: auto;">
            <button class="responseable-close-btn" style="padding: 10px 24px; background: #f1f3f4; color: #5f6368; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">Cancel</button>
        </div>
    `;

    document.body.appendChild(overlay);

    // Add close button handler
    overlay.querySelector('.responseable-close-btn').addEventListener('click', () => {
        overlay.remove();
    });

    // Close on escape key
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    return overlay;
};

// Update progress overlay step status
const updateProgressStep = (stepId, status, result = null) => {
    const overlay = document.querySelector('.responseable-overlay.responseable-progress-overlay');
    if (!overlay) return;

    const step = overlay.querySelector(`#${stepId}`);
    if (!step) return;

    const icon = step.querySelector('.responseable-step-icon');
    const resultEl = step.querySelector('.responseable-step-result');

    // Update step class
    step.classList.remove('active', 'completed');

    if (status === 'active') {
        step.classList.add('active');
        icon.innerHTML = '<div class="responseable-step-spinner"></div>';
    } else if (status === 'completed') {
        step.classList.add('completed');
        icon.innerHTML = '<span class="responseable-step-check">✓</span>';
        if (result && resultEl) {
            resultEl.innerHTML = result;
        }
    } else if (status === 'pending') {
        icon.innerHTML = '<span class="responseable-step-pending">○</span>';
    }
};

// Format type result for display
const formatTypeResult = (typeName) => {
    const displayName = typeName.charAt(0).toUpperCase() + typeName.slice(1);
    return `Semantic context: <span class="responseable-step-result-value">${displayName}</span>`;
};

// Format goals result for display
const formatGoalsResult = (goals, goalTitles) => {
    if (!goals || goals.length === 0) return '';
    const chips = goals.map(goal => {
        const title = goalTitles && goalTitles[goal] ? goalTitles[goal] : goal;
        return `<span class="responseable-goal-chip">${title}</span>`;
    }).join('');
    return `<div class="responseable-goals-preview">${chips}</div>`;
};

// Format tone result for display
const formatToneResult = (toneNeeded, toneSets, currentGoal) => {
    if (!toneNeeded) return '';
    let tones = [toneNeeded];
    if (toneSets && currentGoal && toneSets[currentGoal]) {
        tones = toneSets[currentGoal].slice(0, 3);
    }
    const chips = tones.map(tone => `<span class="responseable-tone-chip">${tone}</span>`).join('');
    return `<div class="responseable-tones-preview">${chips}</div>`;
};

// Show drafts overlay with formatted content
const showDraftsOverlay = async (draftsText, context, platform, customAdapter = null, classification = null, regenerateContext = null, newEmailParams = null, isPartial = false) => {
    // For partial (streaming) updates, just update the streaming content
    if (isPartial) {
        // If streaming overlay exists, update it
        if (updateStreamingOverlay(draftsText)) {
            return;
        }
        // Otherwise create a new streaming overlay
        showStreamingOverlay(draftsText);
        return;
    }

    // Track draft generation (only for final, non-streaming overlays)
    const roleName = classification?.type || 'generic';
    trackDraftGenerated(roleName).catch(err => console.warn('Failed to track draft generation:', err));

    // Remove existing overlay for final render (including streaming overlay)
    document.querySelector('.responseable-overlay')?.remove();

    const adapter = customAdapter || platformAdapters[platform];

    // Check if this is a new email (not a reply)
    const isNewEmail = newEmailParams && newEmailParams.isNewEmail === true;

    // Get selected packages for display (only show the matched package, not all available packages)
    const selectedPackages = await getUserPackages();
    
    // Get matched type information from classification
    // Load all packages to find the matched type (may not be in userPackages)
    let matchedTypeInfo = null;
    let selectedPackageNames = '';
    if (classification && classification.type) {
        const allPackages = await loadPackagesFromAPI();
        const matchedPackage = allPackages.find(p => p.name === classification.type);
        if (matchedPackage) {
            matchedTypeInfo = {
                name: matchedPackage.base === true ? (matchedPackage.name.charAt(0).toUpperCase() + matchedPackage.name.slice(1)) : matchedPackage.name,
                description: matchedPackage.description
            };
            // Only show the matched package name, not all available packages
            selectedPackageNames = matchedPackage.name;
        }
    } else {
        // Fallback: if no classification, show all user packages (legacy behavior)
        selectedPackageNames = selectedPackages.map(p => p.name).join(', ');
    }
    const overlay = document.createElement('div');
    overlay.className = 'responseable-overlay';
    overlay.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 80%;
    max-width: 800px;
    max-height: 90vh;
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.3);
    z-index: 2147483647;
    padding: 24px;
    font-family: Google Sans,Roboto,sans-serif;
    display: flex;
    flex-direction: column;
  `;

    // Parse drafts - split by clear separator markers first
    let draftBlocks = [];

    // Check if this is a single draft (no separator) - for generic single draft case
    // Use fixed separator - simpler and more reliable
    if (!draftsText.includes(RESPONSE_VARIANT_SEPARATOR) && draftsText.trim().length > 0) {
        // Single draft - use as-is
        draftBlocks = [draftsText.trim()];
    } else if (draftsText.includes(RESPONSE_VARIANT_SEPARATOR)) {
        draftBlocks = draftsText.split(RESPONSE_VARIANT_SEPARATOR)
            .map(block => {
                let cleaned = block.trim();
                // Remove variant labels that might appear at the start (e.g., "1. Simple Agreement", "2. Enthusiastic Confirmation")
                // Match patterns like: "1. Variant Name", "Variant Name", or numbered lists
                // First remove numbered labels (e.g., "1. Strong Role Interest")
                cleaned = cleaned.replace(/^\d+\.\s+[^\n]+\n+/g, '');
                // Remove standalone variant names on their own line (Title Case words)
                cleaned = cleaned.replace(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*$/m, '');
                // Remove labels like "1. Friendly response", "2. Insightful response", etc.
                cleaned = cleaned.replace(/^\d+\.\s*(Friendly|Insightful|Polite|Formal|Professional|Concise|Brief|Detailed|Strong|Enthusiastic|Role|Interest|Follow-Up)\s*(response|message|Follow-Up)?[\s:]*\n?/i, '');
                cleaned = cleaned.replace(/^(Friendly|Insightful|Polite|Formal|Professional|Concise)\s+(response|message):\s*/i, '');
                // Remove any remaining leading numbers followed by labels or variant names
                cleaned = cleaned.replace(/^\d+\.\s*[^\n]*\n/, '');
                // Remove variant names that appear as standalone lines (e.g., "Simple Agreement" on its own line)
                cleaned = cleaned.replace(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*$/m, '');
                // Remove any leading dashes or separators
                cleaned = cleaned.replace(/^---+\s*\n?/g, '');
                return cleaned.trim();
            })
            .filter(block => block.length > 10); // Minimum length check
    } else {
        // Try to split by numbered patterns, but be smarter about it
        const numberedPattern = /(?:^|\n)\s*(\d+)\.\s+[^\n]*\n/g;
        const matches = [...draftsText.matchAll(numberedPattern)];

        if (matches.length >= 4) {
            for (let i = 0; i < matches.length; i++) {
                const match = matches[i];
                const startIndex = match.index;
                const endIndex = i < matches.length - 1 ? matches[i + 1].index : draftsText.length;
                let content = draftsText.substring(startIndex, endIndex).trim();
                // Remove the numbered label line
                content = content.replace(/^\d+\.\s+[^\n]*\n/, '').trim();
                // Remove variant names that appear as standalone lines
                content = content.replace(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*$/m, '');
                if (content && content.length > 10) {
                    draftBlocks.push(content);
                }
            }
        } else {
            // Split by multiple newlines, but filter out variant name lines
            draftBlocks = draftsText.split(/\n\n\n+/)
                .map(d => {
                    let cleaned = d.trim();
                    // Remove variant names that appear as standalone lines
                    cleaned = cleaned.replace(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*$/m, '');
                    return cleaned;
                })
                .filter(d => d.length > 0 && !d.match(/^---+$/) && d.length > 10);
        }
    }

    // Post-process: Remove any blocks that are just variant names or labels
    draftBlocks = draftBlocks.filter(block => {
        const trimmed = block.trim();
        // Skip if it's just a variant name (Title Case words, no punctuation except maybe at end)
        if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\.?\s*$/.test(trimmed)) {
            return false;
        }
        // Skip if it's just a numbered label
        if (/^\d+\.\s*[A-Z][^\n]*$/.test(trimmed)) {
            return false;
        }
        return true;
    });

    // Get response goals and current goal
    const responseGoals = classification && classification.response_goals && Array.isArray(classification.response_goals) && classification.response_goals.length > 0
        ? classification.response_goals
        : ['respond appropriately'];

    const currentGoal = responseGoals[0]; // Start with first goal
    // Get default variants based on numVariants setting
    const defaultVariants = [
        'Friendly response',
        'Insightful response',
        'Polite response',
        'Professional neutral response',
        'Concise response',
        'Brief response',
        'Detailed response'
    ];
    const expectedNumVariants = apiConfig.numVariants || 4;
    const variantSet = classification && classification.variant_sets && classification.variant_sets[currentGoal]
        ? classification.variant_sets[currentGoal]
        : defaultVariants.slice(0, expectedNumVariants);

    const currentTone = classification && classification.tone_sets && classification.tone_sets[currentGoal] && classification.tone_sets[currentGoal][0]
        ? classification.tone_sets[currentGoal][0]
        : (classification && classification.tone_needed ? classification.tone_needed : 'professional');

    // Helper function to render drafts HTML
    const renderDraftsHtml = (drafts, goal) => {
        const goalVariants = classification && classification.variant_sets && classification.variant_sets[goal]
            ? classification.variant_sets[goal]
            : variantSet;
        const goalTone = classification && classification.tone_sets && classification.tone_sets[goal] && classification.tone_sets[goal][0]
            ? classification.tone_sets[goal][0]
            : currentTone;

        return drafts.map((draft, index) => {
            const draftText = draft.trim();
            const variantName = goalVariants[index] || null;
            const tone = goalTone || null;

            const variantHeader = variantName || tone
                ? `<div style="font-size: 11px; font-weight: 600; color: #5f6368; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">${variantName ? variantName : ''}${variantName && tone ? ' • ' : ''}${tone ? tone : ''}</div>`
                : '';

            const escapedDraftText = draftText.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            return `<div class="responseable-draft-option" data-draft-text="${escapedDraftText}" style="cursor:pointer; padding:16px; margin:12px 0; border:1px solid #dadce0; border-radius:8px; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor='white'">${variantHeader}<span class="responseable-draft-content">${draftText.replace(/\n/g, '<br>')}</span></div>`;
        }).join('');
    };

    const draftsHtml = renderDraftsHtml(draftBlocks, currentGoal);

    // Get goal titles (short titles for tabs)
    const goalTitles = classification && classification.goal_titles && typeof classification.goal_titles === 'object'
        ? classification.goal_titles
        : {};

    // Helper to get short title for a goal
    const getGoalTitle = (goal) => {
        if (goalTitles[goal]) {
            return goalTitles[goal];
        }
        // Fallback: generate short title from goal text
        const words = goal.split(' ');
        if (words.length <= 3) return goal;
        // Take first 2 words and capitalize
        return words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    // Build tabs HTML
    const tabsHtml = responseGoals.map((goal, index) => {
        const isFirst = index === 0;
        const tabId = `goal-tab-${index}`;
        const tabTitle = getGoalTitle(goal);
        const escapedGoal = goal.replace(/"/g, '&quot;');
        return `
            <button 
                id="${tabId}" 
                class="responseable-goal-tab" 
                data-goal="${escapedGoal}" 
                data-goal-index="${index}"
                title="${goal}"
                style="
                    padding: 8px 16px; 
                    margin-right: 8px; 
                    border: 1px solid #dadce0; 
                    border-radius: 6px 6px 0 0; 
                    background: ${isFirst ? '#f8f9fa' : 'white'}; 
                    color: ${isFirst ? '#1a73e8' : '#5f6368'}; 
                    font-size: 13px; 
                    font-weight: ${isFirst ? '600' : '500'}; 
                    cursor: pointer; 
                    border-bottom: ${isFirst ? '2px solid #1a73e8' : '1px solid #dadce0'};
                    position: relative;
                    transition: all 0.2s;
                "
                onmouseover="if(!this.classList.contains('active')) this.style.background='#f1f3f4'"
                onmouseout="if(!this.classList.contains('active')) this.style.background='white'"
            >
                ${tabTitle}${isFirst ? ' <span style="font-size: 10px; background: #1a73e8; color: white; padding: 2px 6px; border-radius: 10px; margin-left: 4px;">Recommended</span>' : ''}
            </button>
        `;
    }).join('');

    // No dropdown for new emails - using default role from settings
    let newEmailDropdownHtml = '';
    if (isNewEmail && newEmailParams) {
        // Just show a message that generation will use default role
        const basePackageName = getBasePackageName();
        const defaultRole = newEmailParams.defaultRole || basePackageName;
        const userPackages = newEmailParams.userPackages || selectedPackages;
        const defaultPackage = userPackages.find(p => p.name === defaultRole) || userPackages.find(p => p.base);
        const displayName = defaultPackage && defaultPackage.base === true ? 'Generic' : (defaultRole.charAt(0).toUpperCase() + defaultRole.slice(1));

        newEmailDropdownHtml = `
    <div style="margin-bottom: 16px; padding: 12px; background: #f8f9fa; border-radius: 8px; border: 1px solid #dadce0;">
      <p style="font-size: 13px; color: #5f6368; margin: 0;">Using <strong>${displayName}</strong> package (default).${classification && classification.isGenericSingleDraft ? ' Generated a generic draft based on your content.' : ''}</p>
    </div>`;
    }

    overlay.innerHTML = `
    <div style="flex-shrink: 0;">
      <h2 style="margin-top:0; display: flex; align-items: center; gap: 8px;"><span id="responseable-overlay-icon"></span> <span style="color:#5567b9;">xRepl.ai</span><span style="color:#5f6368;"> - ${isNewEmail ? 'Smart Drafts, Instantly' : 'Smart Replies, Instantly'}</span></h2>
      ${isNewEmail ? '' : (selectedPackageNames ? `<p style="color:#5f6368; margin-top: -8px; margin-bottom: 8px; font-size: 12px;"><strong>Selected Packages:</strong> ${selectedPackageNames}</p>` : '')}
      ${newEmailDropdownHtml}
      ${!isNewEmail && matchedTypeInfo ? `<p style="color:#5f6368; margin-top: ${selectedPackageNames ? '0' : '-8px'}; margin-bottom: 8px; font-size: 12px;"><strong>Matched Type:</strong> <span style="text-transform: capitalize;">${matchedTypeInfo.name}</span> - ${matchedTypeInfo.description}</p>` : ''}
      ${classification ? `<p id="sender-intent-text" style="color:#5f6368; margin-top: ${matchedTypeInfo || selectedPackageNames ? '0' : '-8px'}; margin-bottom: 12px; font-size: 12px;"><strong>${isNewEmail ? 'Sender Intent' : 'Intent'}:</strong> ${classification.intent || 'general inquiry'}${classification.key_topics && classification.key_topics.length > 0 ? ` | Topics: ${classification.key_topics.join(', ')}` : ''}</p>` : ''}
      ${responseGoals.length > 1 && !(classification && classification.isGenericSingleDraft) ? `
      <div id="goals-tabs-container" style="margin-bottom: 16px; border-bottom: 1px solid #dadce0; padding-bottom: 8px;">
      <div style="display: flex; flex-wrap: wrap; gap: 0;">
        ${tabsHtml}
      </div>
      <div id="goal-description" style="margin-top: 12px; padding: 8px 12px; background: #f8f9fa; border-radius: 4px; font-size: 12px; color: #5f6368; min-height: 20px;">
        <strong>Goal:</strong> <span id="goal-description-text">${currentGoal}</span>
      </div>
    </div>
    ` : ''}
    ${classification && classification.tone_sets && classification.tone_sets[currentGoal] && classification.tone_sets[currentGoal].length > 1 ? `
      <div id="tone-selector-container" style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
      <label for="tone-selector" style="font-size: 13px; color: #5f6368; font-weight: 500;">Tone:</label>
      <select id="tone-selector" style="padding: 6px 12px; border: 1px solid #dadce0; border-radius: 4px; font-size: 13px; background: white; color: #202124; cursor: pointer;">
        ${classification.tone_sets[currentGoal].map(tone => `<option value="${tone}" ${tone === currentTone ? 'selected' : ''}>${tone}</option>`).join('')}
      </select>
      <span id="regenerate-status" style="font-size: 12px; color: #5f6368; margin-left: 8px;"></span>
    </div>
    ` : ''}
      <p id="draft-instruction-text" style="color:#5f6368; margin-top: 0; display: ${draftsHtml ? 'block' : 'none'};">Click any draft to insert it</p>
    </div>
    <div id="drafts-container" style="flex: 1; overflow-y: auto; min-height: 0; margin: 12px 0;">
      ${draftsHtml}
    </div>
    <div id="loading-indicator" style="display: none; text-align: center; padding: 20px; color: #5f6368;">
      Generating drafts...
    </div>
    <div style="flex-shrink: 0; margin-top: 16px; padding-top: 16px; border-top: 1px solid #dadce0;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 12px; color: #5f6368;">Was this helpful?</span>
          <button id="responseable-thumbs-up" style="padding: 6px 10px; background: transparent; border: 1px solid #dadce0; border-radius: 4px; cursor: pointer; font-size: 16px; color: #5f6368; transition: all 0.2s;" title="Thumbs up">
            👍
          </button>
          <button id="responseable-thumbs-down" style="padding: 6px 10px; background: transparent; border: 1px solid #dadce0; border-radius: 4px; cursor: pointer; font-size: 16px; color: #5f6368; transition: all 0.2s;" title="Thumbs down">
            👎
          </button>
        </div>
      </div>
      <button id="responseable-close-button" style="width: 100%; padding:10px 16px; background:#1a73e8; color:white; border:none; border-radius:4px; cursor:pointer; font-size: 14px; font-weight: 500;">
      Close
    </button>
    </div>
  `;

    // Create and insert icon programmatically
    const runtime = getChromeRuntime();
    const iconContainer = overlay.querySelector('#responseable-overlay-icon');
    if (iconContainer && runtime) {
        try {
            const iconUrl = runtime.getURL('xrepl-light.png');
            const iconImg = document.createElement('img');
            iconImg.src = iconUrl;
            iconImg.alt = 'xRepl.ai';
            iconImg.style.cssText = 'width: 24px !important; height: 24px !important; display: inline-block !important; vertical-align: middle !important; object-fit: contain !important; flex-shrink: 0 !important;';
            iconImg.addEventListener('error', (e) => {
                console.error('Failed to load xrepl-light.png in overlay from:', iconImg.src);
                iconImg.style.display = 'none';
            });
            iconContainer.appendChild(iconImg);
        } catch (error) {
            console.error('Error loading overlay icon:', error);
        }
    }

    // Add close button handler
    const closeButton = overlay.querySelector('#responseable-close-button');
    if (closeButton) {
        closeButton.addEventListener('click', () => overlay.remove());
    }

    // No handler needed for new emails - generation happens when main Generate button is clicked

    // Tab switching logic
    if (classification && regenerateContext && responseGoals.length > 1) {
        const goalTabs = overlay.querySelectorAll('.responseable-goal-tab');
        const draftsContainer = overlay.querySelector('#drafts-container');
        const loadingIndicator = overlay.querySelector('#loading-indicator');

        // Track which goals have been generated
        const generatedGoals = new Set([currentGoal]);

        goalTabs.forEach((tab, index) => {
            const goal = responseGoals[index];

            tab.addEventListener('click', async () => {
                // Update active tab styling
                goalTabs.forEach(t => {
                    const isActive = t === tab;
                    t.style.background = isActive ? '#f8f9fa' : 'white';
                    t.style.color = isActive ? '#1a73e8' : '#5f6368';
                    t.style.fontWeight = isActive ? '600' : '500';
                    t.style.borderBottom = isActive ? '2px solid #1a73e8' : '1px solid #dadce0';
                    if (isActive) {
                        t.classList.add('active');
                    } else {
                        t.classList.remove('active');
                    }
                });

                // Update goal description
                const goalDescription = overlay.querySelector('#goal-description-text');
                if (goalDescription) {
                    goalDescription.textContent = goal;
                }

                // Update tone selector for this goal
                const toneSelector = overlay.querySelector('#tone-selector');
                if (toneSelector && classification.tone_sets && classification.tone_sets[goal]) {
                    const goalTones = classification.tone_sets[goal];
                    const currentGoalTone = goalTones[0] || currentTone;

                    // Update options
                    toneSelector.innerHTML = goalTones.map(tone =>
                        `<option value="${tone}" ${tone === currentGoalTone ? 'selected' : ''}>${tone}</option>`
                    ).join('');
                }

                // If already generated, just show it
                if (generatedGoals.has(goal)) {
                    // Find stored drafts for this goal (we'll need to store them)
                    // For now, regenerate
                }

                // Show loading
                draftsContainer.style.display = 'none';
                loadingIndicator.style.display = 'block';
                // Hide instruction text during generation
                const instructionText = overlay.querySelector('#draft-instruction-text');
                if (instructionText) instructionText.style.display = 'none';

                try {
                    // Get variant set and tone for this goal
                    const goalVariantSet = classification.variant_sets && classification.variant_sets[goal]
                        ? classification.variant_sets[goal]
                        : variantSet;
                    const goalTone = classification.tone_sets && classification.tone_sets[goal] && classification.tone_sets[goal][0]
                        ? classification.tone_sets[goal][0]
                        : currentTone;

                    // Generate drafts for this goal
                    await generateDraftsWithTone(
                        regenerateContext.richContext,
                        regenerateContext.sourceMessageText,
                        platform,
                        { ...classification, _currentGoal: goal, _currentVariantSet: goalVariantSet, _currentTone: goalTone },
                        goalTone,
                        regenerateContext.senderName,
                        regenerateContext.recipientName,
                        regenerateContext.recipientCompany,
                        adapter,
                        async (newDraftsText) => {
                            // Re-render the drafts with new goal
                            await showDraftsOverlay(newDraftsText, regenerateContext.context, platform, adapter, { ...classification, _currentGoal: goal, _currentVariantSet: goalVariantSet, _currentTone: goalTone }, regenerateContext);
                        },
                        regenerateContext  // Pass regenerateContext
                    );
                } catch (err) {
                    console.error('Error generating drafts for goal:', err);
                    loadingIndicator.innerHTML = 'Error generating drafts. Please try again.';
                }
            });
        });

        // Mark first tab as active and set initial description
        if (goalTabs.length > 0) {
            goalTabs[0].classList.add('active');
            const goalDescription = overlay.querySelector('#goal-description-text');
            if (goalDescription) {
                goalDescription.textContent = currentGoal;
            }
        }
    }

    // Helper function to attach draft click handlers
    const attachDraftClickHandlers = (overlayEl, adapterEl) => {
        const draftOptions = overlayEl.querySelectorAll('.responseable-draft-option');
        draftOptions.forEach(draftOption => {
            draftOption.addEventListener('click', () => {
                const draftText = draftOption.getAttribute('data-draft-text');
                if (draftText && adapterEl) {
                    adapterEl.insertText(draftText);
                    // Track draft insertion
                    trackDraftInserted().catch(err => console.warn('Failed to track draft insertion:', err));
                    overlayEl.remove();
                }
            });
        });
    };

    // Attach initial draft click handlers
    attachDraftClickHandlers(overlay, adapter);

    // Add thumbs up/down button handlers
    const thumbsUpBtn = overlay.querySelector('#responseable-thumbs-up');
    const thumbsDownBtn = overlay.querySelector('#responseable-thumbs-down');

    if (thumbsUpBtn) {
        thumbsUpBtn.addEventListener('click', () => {
            trackThumbsUp().catch(err => console.warn('Failed to track thumbs up:', err));
            thumbsUpBtn.style.background = '#e8f0fe';
            thumbsUpBtn.style.borderColor = '#1a73e8';
            thumbsUpBtn.style.color = '#1a73e8';
            thumbsUpBtn.disabled = true;
            if (thumbsDownBtn) {
                thumbsDownBtn.disabled = true;
                thumbsDownBtn.style.opacity = '0.5';
            }
        });
    }

    if (thumbsDownBtn) {
        thumbsDownBtn.addEventListener('click', () => {
            trackThumbsDown().catch(err => console.warn('Failed to track thumbs down:', err));
            thumbsDownBtn.style.background = '#fce8e6';
            thumbsDownBtn.style.borderColor = '#d93025';
            thumbsDownBtn.style.color = '#d93025';
            thumbsDownBtn.disabled = true;
            if (thumbsUpBtn) {
                thumbsUpBtn.disabled = true;
                thumbsUpBtn.style.opacity = '0.5';
            }
        });
    }

    // Tone selector change handler - regenerate variants with new tone for current goal
    // Works for both replies (regenerateContext) and new emails (newEmailParams)
    if (classification && (regenerateContext || (newEmailParams && newEmailParams.isNewEmail))) {
        const toneSelector = overlay.querySelector('#tone-selector');
        const draftsContainer = overlay.querySelector('#drafts-container');
        const loadingIndicator = overlay.querySelector('#loading-indicator');
        const regenerateStatus = overlay.querySelector('#regenerate-status');
        const goalDescription = overlay.querySelector('#goal-description-text');

        // Get current goal (from active tab or default)
        const getCurrentGoal = () => {
            const activeTab = overlay.querySelector('.responseable-goal-tab.active') || overlay.querySelector('.responseable-goal-tab');
            if (activeTab) {
                return activeTab.getAttribute('data-goal');
            }
            return responseGoals[0];
        };

        if (toneSelector) {
            toneSelector.addEventListener('change', async (e) => {
                const newTone = e.target.value;
                const currentGoal = getCurrentGoal();

                regenerateStatus.textContent = 'Regenerating...';
                toneSelector.disabled = true;
                draftsContainer.style.display = 'none';
                loadingIndicator.style.display = 'block';
                // Hide instruction text during regeneration
                const instructionText = overlay.querySelector('#draft-instruction-text');
                if (instructionText) instructionText.style.display = 'none';

                try {
                    // Get variant set for current goal
                    const goalVariantSet = classification.variant_sets && classification.variant_sets[currentGoal]
                        ? classification.variant_sets[currentGoal]
                        : variantSet;

                    // Update classification to use new tone for this goal
                    const updatedClassification = { ...classification };
                    if (!updatedClassification.tone_sets) {
                        updatedClassification.tone_sets = {};
                    }
                    if (!updatedClassification.tone_sets[currentGoal]) {
                        updatedClassification.tone_sets[currentGoal] = [];
                    }
                    // Update first tone in the set (the one being used)
                    updatedClassification.tone_sets[currentGoal][0] = newTone;
                    updatedClassification._currentGoal = currentGoal;
                    updatedClassification._currentTone = newTone;

                    // Get context - use regenerateContext if available, otherwise create from newEmailParams for new emails
                    const contextToUse = regenerateContext || (newEmailParams && newEmailParams.isNewEmail ? {
                        richContext: context,
                        sourceMessageText: '',
                        threadHistory: '',
                        context: context,
                        senderName: newEmailParams.userAccountName || '[Name]',
                        recipientName: newEmailParams.recipientName || '[Recipient]',
                        recipientCompany: newEmailParams.recipientCompany || null,
                        composeSubject: classification.composeSubject || '',
                        composeBodyText: classification.composeBodyText || '',
                        composeRecipient: classification.composeRecipient || '',
                        isNewEmail: true,
                        userAccountName: newEmailParams.userAccountName,
                        userAccountEmail: newEmailParams.userAccountEmail
                    } : null);

                    if (!contextToUse) {
                        throw new Error('No context available for regeneration');
                    }

                    const isNewEmail = contextToUse.isNewEmail === true || classification.isNewEmail === true;

                    await generateDraftsWithTone(
                        contextToUse.richContext,
                        contextToUse.sourceMessageText || '',
                        platform,
                        updatedClassification,
                        newTone,
                        contextToUse.senderName,
                        contextToUse.recipientName,
                        contextToUse.recipientCompany,
                        adapter,
                        async (newDraftsText) => {
                            // Re-render the drafts with new tone
                            if (isNewEmail) {
                                // For new emails, pass newEmailParams
                                await showDraftsOverlay(newDraftsText, contextToUse.context, platform, adapter, updatedClassification, contextToUse, {
                                    isNewEmail: true,
                                    userPackages: newEmailParams?.userPackages,
                                    defaultRole: newEmailParams?.defaultRole,
                                    recipientName: contextToUse.recipientName,
                                    recipientCompany: contextToUse.recipientCompany,
                                    userAccountName: contextToUse.userAccountName,
                                    userAccountEmail: contextToUse.userAccountEmail,
                                    skipAutoGenerate: true
                                });
                            } else {
                                // For replies, use existing flow
                                await showDraftsOverlay(newDraftsText, contextToUse.context, platform, adapter, updatedClassification, contextToUse);
                            }
                        },
                        contextToUse  // Pass context
                    );
                } catch (err) {
                    regenerateStatus.textContent = 'Error regenerating';
                    console.error('Error regenerating drafts:', err);
                    setTimeout(() => {
                        regenerateStatus.textContent = '';
                    }, 2000);
                    draftsContainer.style.display = 'block';
                    loadingIndicator.style.display = 'none';
                    // Show instruction text when drafts are ready
                    const instructionText = overlay.querySelector('#draft-instruction-text');
                    if (instructionText) instructionText.style.display = 'block';
                } finally {
                    toneSelector.disabled = false;
                }
            });
        }
    }

    // Click draft to insert
    overlay.querySelectorAll('.responseable-draft-option').forEach((block) => {
        block.addEventListener('click', () => {
            // Get the draft text from the data attribute (excludes the variant header)
            // Decode HTML entities
            let draftText = block.getAttribute('data-draft-text');
            if (!draftText) {
                // Fallback: get text from the content span, or full text if span not found
                const contentSpan = block.querySelector('.responseable-draft-content');
                draftText = contentSpan ? (contentSpan.innerText || contentSpan.textContent) : (block.innerText || block.textContent);
            } else {
                // Decode HTML entities
                const textarea = document.createElement('textarea');
                textarea.innerHTML = draftText;
                draftText = textarea.value;
            }
            adapter.insertText(draftText);
            // Track draft insertion
            trackDraftInserted().catch(err => console.warn('Failed to track draft insertion:', err));
            overlay.remove();
        });
    });

    // Try to find the compose container and attach overlay to it
    // This ensures the overlay closes when the compose window closes
    let composeContainer = null;
    if (platform === 'gmail') {
        const composeBody = adapter.findComposeInput();
        if (composeBody) {
            composeContainer = composeBody.closest('.nH, .aO9, [role="dialog"], .M9, .iN, .aoP') ||
                composeBody.closest('form') ||
                composeBody.parentElement?.parentElement?.parentElement;
        }
    } else if (platform === 'linkedin') {
        const composeInput = adapter.findComposeInput();
        if (composeInput) {
            composeContainer = composeInput.closest('[role="dialog"], .msg-form, .msg-s-message-list__compose-container') ||
                composeInput.closest('form');
        }
    }

    // Always attach overlay to body to avoid stacking context issues with Gmail's compose container
    // This ensures the overlay appears above all Gmail UI elements
    document.body.appendChild(overlay);

    // Ensure overlay is positioned correctly and has maximum z-index
    overlay.style.position = 'fixed';
    overlay.style.top = '50%';
    overlay.style.left = '50%';
    overlay.style.transform = 'translate(-50%, -50%)';
    overlay.style.zIndex = '2147483647'; // Maximum z-index to ensure it's above Gmail toolbar

    // Monitor compose container removal - close overlay if compose window is closed
    if (composeContainer) {
        let intervalId = null;

        const checkComposeClosed = () => {
            // Check multiple conditions to detect if compose window is closed
            const composeBody = adapter.findComposeInput();
            const isContainerRemoved = !document.body.contains(composeContainer) || !composeContainer.isConnected;
            const isContainerHidden = composeContainer.offsetParent === null ||
                composeContainer.style.display === 'none' ||
                composeContainer.style.visibility === 'hidden';
            const isComposeBodyGone = !composeBody || !document.body.contains(composeBody);

            // If any of these conditions are true, the compose window is likely closed
            if (isContainerRemoved || (isContainerHidden && isComposeBodyGone)) {
                overlay.remove();
                return true;
            }
            return false;
        };

        // Use MutationObserver to watch for changes
        const observer = new MutationObserver((mutations) => {
            if (checkComposeClosed()) {
                observer.disconnect();
                if (intervalId) clearInterval(intervalId);
            }
        });

        // Start observing the compose container and its parent
        if (composeContainer.parentNode) {
            observer.observe(composeContainer.parentNode, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });
        }
        observer.observe(composeContainer, {
            attributes: true,
            attributeFilter: ['style', 'class']
        });

        // Also use polling as a fallback (check every 500ms)
        intervalId = setInterval(() => {
            if (checkComposeClosed()) {
                clearInterval(intervalId);
                intervalId = null;
            }
        }, 500);

        // Clean up when overlay is removed
        const overlayObserver = new MutationObserver(() => {
            if (!document.body.contains(overlay)) {
                observer.disconnect();
                overlayObserver.disconnect();
                if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                }
            }
        });
        overlayObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
};

// Shared click handler for comment buttons
const createCommentButtonHandler = (editor) => {
    return async function () {
        const commentButton = this;
        try {
            await loadApiConfig();

            // Get the post/comment context
            const postText = editor.closest('.feed-shared-update-v2, .feed-shared-update-v2__commentary, .update-components-text')?.innerText?.trim() || '';
            const commentContext = editor.innerText?.trim() || '';

            commentButton.innerHTML = '';
            commentButton.style.opacity = '0.7';
            const runtime = getChromeRuntime();
            if (runtime) {
                try {
                    const loadingImg = document.createElement('img');
                    loadingImg.src = runtime.getURL('raiconvector.png');
                    loadingImg.style.cssText = 'width: 20px !important; height: 20px !important; opacity: 0.5;';
                    commentButton.appendChild(loadingImg);
                } catch (e) { }
            }

            // Show streaming overlay immediately for instant feedback
            const iconUrl = runtime?.getURL ? runtime.getURL('icon-128.png') : null;
            showStreamingOverlay('', iconUrl);

            // Create a custom adapter for comment insertion
            const commentAdapter = {
                insertText: (text) => {
                    editor.focus();
                    editor.innerHTML = '';
                    editor.innerText = text;
                    const inputEvent = new Event('input', { bubbles: true });
                    editor.dispatchEvent(inputEvent);
                }
            };

            // Use new streaming API endpoint for LinkedIn comment generation
            // Note: LinkedIn comments use the same draft generation endpoint but with comment-specific context
            const draftsText = await callNewStreamingAPI(
                `${VERCEL_PROXY_URL}/generate-drafts-draft`,
                {
                    typedContent: commentContext || '',
                    package: {
                        name: 'generic',
                        userIntent: 'Generate professional LinkedIn comment responses',
                        roleDescription: 'Professional LinkedIn comment writer',
                        contextSpecific: 'Generate engaging, professional comments for LinkedIn posts'
                    },
                    variantSet: ['Friendly', 'Insightful', 'Professional', 'Concise'],
                    currentGoal: 'Generate appropriate comment',
                    goalTone: 'Professional',
                    recipientName: null,
                    recipientCompany: null,
                    userIntent: 'Generate professional LinkedIn comment responses',
                    keyTopics: [],
                    writingStyle: null,
                    enableStyleMimicking: false,
                    platform: 'linkedin',
                    provider: apiConfig.provider,
                    model: apiConfig.model,
                    temperature: 0.7,
                    max_tokens: 1000
                },
                (fullContent, newChunk) => {
                    // Update streaming overlay with partial content
                    updateStreamingOverlay(fullContent);
                }
            );
            if (!draftsText) {
                throw new Error('No response content received from API');
            }

            // Remove streaming overlay before showing final drafts
            document.querySelector('.responseable-overlay.responseable-streaming')?.remove();

            // Show drafts overlay with comment adapter
            (async () => {
                await showDraftsOverlay(draftsText, postText, 'linkedin', commentAdapter);
            })();

            // Restore button after overlay closes (handled by overlay removal)
            const restoreButton = () => {
                commentButton.innerHTML = '';
                commentButton.style.opacity = '1';
                const runtime = getChromeRuntime();
                if (runtime) {
                    try {
                        const iconImg = document.createElement('img');
                        iconImg.src = runtime.getURL('raiconvector.png');
                        iconImg.style.cssText = 'width: 20px !important; height: 20px !important;';
                        commentButton.appendChild(iconImg);
                    } catch (e) { }
                }
            };

            // Listen for overlay removal
            const checkOverlay = setInterval(() => {
                if (!document.querySelector('.responseable-overlay')) {
                    restoreButton();
                    clearInterval(checkOverlay);
                }
            }, 100);

            // Timeout fallback
            setTimeout(() => {
                clearInterval(checkOverlay);
                restoreButton();
            }, 30000);
        } catch (err) {
            // Remove streaming overlay on error
            document.querySelector('.responseable-overlay.responseable-streaming')?.remove();
            alert(`${apiConfig.provider} API error: ${err.message}\nCheck API key and network.`);
            // Restore button
            commentButton.innerHTML = '';
            commentButton.style.opacity = '1';
            const runtime = getChromeRuntime();
            if (runtime) {
                try {
                    const iconImg = document.createElement('img');
                    iconImg.src = runtime.getURL('raiconvector.png');
                    iconImg.style.cssText = 'width: 20px !important; height: 20px !important;';
                    commentButton.appendChild(iconImg);
                } catch (e) { }
            }
        }
    };
};

// Inject icon-only button into LinkedIn comment sections
const injectCommentButton = () => {
    const platform = detectPlatform();
    if (platform !== 'linkedin') {
        return; // Only for LinkedIn
    }

    // Don't inject in messaging context (already handled by injectGenerateButton)
    const adapter = platformAdapters.linkedin;
    if (adapter.isMessagingContext && adapter.isMessagingContext()) {
        return;
    }

    // Find comment text editors (active comment compose fields)
    // Try multiple selectors to find LinkedIn comment input fields
    const commentTextEditors = document.querySelectorAll(
        'div[contenteditable="true"][data-control-name="commentary_text_input"], ' +
        'div.comments-comment-texteditor__text-view, ' +
        'div.comments-comment-box__text-editor, ' +
        'div.comments-comment-texteditor, ' +
        'div[contenteditable="true"].comments-comment-texteditor__text-view, ' +
        'div.comments-comment-box__main-container div[contenteditable="true"], ' +
        'div.comment-shared-texteditor div[contenteditable="true"], ' +
        '.feed-shared-update-v2 div[contenteditable="true"][role="textbox"]'
    );

    if (commentTextEditors.length === 0) {
        return; // No comment editors found
    }

    commentTextEditors.forEach((editor, index) => {
        // Skip if already has our button
        const commentContainer = editor.closest('.comments-comment-box, .comment-shared-texteditor, .feed-shared-update-v2');
        if (commentContainer?.querySelector('.responseable-comment-button')) {
            return;
        }

        // Find the container with class "display-flex justify-space-between"
        // This is the parent container that has the toolbar with emoji/image buttons
        let toolbarContainer = null;

        // Search from the editor up to find the display-flex justify-space-between container
        let current = editor;
        while (current && current !== document.body) {
            if (current.classList && current.classList.contains('justify-space-between')) {
                // Found it! Now find the first child div with class "display-flex"
                const displayFlexChild = current.querySelector('> .display-flex:first-child');
                if (displayFlexChild) {
                    toolbarContainer = displayFlexChild;
                    break;
                }
            }
            current = current.parentElement;
        }

        // If not found with that approach, try finding by the emoji button
        if (!toolbarContainer) {
            const emojiButton = commentContainer?.querySelector('button.comments-comment-box__emoji-picker-trigger, button[aria-label*="Emoji"]');
            if (emojiButton) {
                // Find the parent div with class "display-flex" that contains both emoji and image buttons
                let parent = emojiButton.parentElement;
                while (parent && parent !== document.body) {
                    if (parent.classList && parent.classList.contains('display-flex')) {
                        // Check if this container has both emoji and image buttons
                        const hasImageButton = parent.querySelector('button.comments-comment-box__detour-icons, button[aria-label*="photo"], button[aria-label*="image"]');
                        if (hasImageButton) {
                            toolbarContainer = parent;
                            break;
                        }
                    }
                    parent = parent.parentElement;
                }
            }
        }

        if (toolbarContainer) {
            // Check if we already injected
            if (toolbarContainer.querySelector('.responseable-comment-button')) {
                return;
            }

            // Create and insert icon-only button before the first child div
            const commentButton = createIconOnlyButton('Generate AI comment response', 'linkedin');
            commentButton.addEventListener('click', createCommentButtonHandler(editor));

            // Insert before the first child (emoji button container)
            const firstChild = toolbarContainer.firstElementChild;
            if (firstChild) {
                toolbarContainer.insertBefore(commentButton, firstChild);
            } else {
                toolbarContainer.appendChild(commentButton);
            }
        }
    });
};

const observer = new MutationObserver(() => {
    injectGenerateButton();
    injectCommentButton();
});
observer.observe(document.body, { childList: true, subtree: true });

injectGenerateButton();
injectCommentButton();
setInterval(() => {
    injectGenerateButton();
    injectCommentButton();
}, 1000);
