/**
 * ResponseAble Content Script
 * 
 * This content script injects AI-powered response generation buttons into Gmail and LinkedIn.
 * It detects the platform, extracts email/message context, classifies the content using AI,
 * and generates multiple response variants for the user to choose from.
 * 
 * @module ContentScript
 */

import API_KEYS from '../../config/apiKeys.js';

/* =============================================================================
 * CONSTANTS AND CONFIGURATION
 * ============================================================================= */

/**
 * Default response variants used when AI classification doesn't provide specific variants.
 * These are generic response styles that work for most email types.
 * @constant {string[]}
 */
const DEFAULT_VARIANTS = [
    'Friendly response',
    'Insightful response',
    'Polite response',
    'Professional neutral response',
    'Concise response',
    'Brief response',
    'Detailed response'
];

/**
 * Gmail DOM Selectors - Centralized configuration for Gmail element selection.
 * Gmail uses obfuscated class names that can change, so we use multiple fallback strategies.
 * Each selector group includes primary and fallback selectors.
 * @constant {Object}
 */
const GMAIL_SELECTORS = {
    /**
     * Send button selectors - Gmail's send button has specific class combinations.
     * The T-I class family is Gmail's button styling system.
     * - T-I: Base button class
     * - J-J5-Ji: Interactive element
     * - aoO: Send action
     * - v7: Button variant
     * - T-I-atl: Primary action styling
     * - L3: Layout class
     */
    sendButton: [
        '.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3',
        '.T-I.J-J5-Ji.aoO.T-I-atl.L3',
        'div[role="button"][data-tooltip*="Send"]',
        'div[aria-label*="Send"][role="button"]'
    ],
    
    /**
     * Compose body selectors - The main text input area for composing emails.
     * Uses aria-label for accessibility and role for semantic identification.
     */
    composeBody: [
        'div[aria-label="Message Body"][role="textbox"]',
        'div[aria-label="Message body"][role="textbox"]',
        'div.Am.Al.editable[role="textbox"]',
        'div[g_editable="true"][role="textbox"]'
    ],
    
    /**
     * To field selectors - The recipient input field.
     * Gmail uses various aria-labels depending on context (compose vs reply).
     */
    toField: [
        'input[aria-label="To recipients"]',
        'input[name="to"]',
        'input[aria-label="To"]',
        'input[aria-label="Add recipients"]'
    ],
    
    /**
     * Subject field selectors - The email subject input.
     */
    subjectField: [
        'input[aria-label="Subject"]',
        'input[name="subjectbox"]',
        'input[placeholder="Subject"]'
    ],
    
    /**
     * Message body selectors (for reading existing messages, not compose).
     * Used to extract thread context.
     */
    messageBody: [
        'div[aria-label="Message Body"]',
        'div.a3s.aiL',
        'div[data-message-id] div.ii.gt'
    ],
    
    /**
     * Sender name selectors - Elements containing sender information.
     * Gmail stores email addresses in custom attributes.
     */
    senderName: [
        'span[email][name]',
        '[email]',
        'span.gD',
        'span[data-hovercard-id]'
    ],
    
    /**
     * Thread container selectors - The parent container for email threads.
     */
    threadContainer: [
        '[role="main"]',
        '.nH',
        '.aDP',
        '[role="dialog"]',
        '.nH.if'
    ],
    
    /**
     * Thread list item selectors - Individual messages in a thread.
     */
    threadListItem: [
        '[role="listitem"]',
        'div[data-message-id]',
        '.h7'
    ]
};

/**
 * LinkedIn DOM Selectors - Centralized configuration for LinkedIn element selection.
 * LinkedIn's DOM is more stable than Gmail's but still requires multiple fallbacks.
 * @constant {Object}
 */
const LINKEDIN_SELECTORS = {
    /**
     * Send button selectors - LinkedIn messaging send button.
     */
    sendButton: [
        'button.msg-form__send-button',
        'button[data-control-name="send"].msg-form__send-button',
        'button[type="submit"].msg-form__send-button'
    ],
    
    /**
     * Compose input selectors - LinkedIn message input field.
     * LinkedIn uses contenteditable divs for rich text input.
     */
    composeInput: [
        'div[contenteditable="true"][role="textbox"].msg-s-message-list__compose-textarea',
        'div[contenteditable="true"].msg-form__message-texteditor',
        'div.msg-form__contenteditable',
        'div[contenteditable="true"].msg-form__msg-content-container--scrollable'
    ],
    
    /**
     * Recipient name selectors - The name of the person you're messaging.
     */
    recipientName: [
        '.msg-conversation-card__participant-name',
        '.msg-conversation-listitem__participant-name',
        '.msg-s-message-list__conversation-header-name'
    ],
    
    /**
     * Message body selectors - Individual messages in a conversation.
     */
    messageBody: [
        '.msg-s-message-list__message-body',
        '.msg-s-event-listitem__body',
        '.msg-s-message-listitem__message-body'
    ],
    
    /**
     * Messaging context indicators - Elements that indicate we're in messaging.
     */
    messagingContext: [
        '.msg-form__message-texteditor',
        '.msg-s-message-list__compose-textarea',
        '.msg-form__contenteditable',
        '.msg-conversation-card',
        '.msg-s-message-list'
    ],
    
    /**
     * Comment editor selectors - LinkedIn post comment input fields.
     */
    commentEditor: [
        'div[contenteditable="true"][data-control-name="commentary_text_input"]',
        'div.comments-comment-texteditor__text-view',
        'div.comments-comment-box__text-editor',
        'div.comments-comment-texteditor',
        'div[contenteditable="true"].comments-comment-texteditor__text-view',
        'div.comments-comment-box__main-container div[contenteditable="true"]',
        'div.comment-shared-texteditor div[contenteditable="true"]',
        '.feed-shared-update-v2 div[contenteditable="true"][role="textbox"]'
    ]
};

/* =============================================================================
 * UTILITY FUNCTIONS
 * ============================================================================= */

/**
 * Gets the Chrome runtime API, with fallback to browser API for Firefox compatibility.
 * Handles extension context invalidation gracefully.
 * 
 * @returns {Object|null} The Chrome/browser runtime object or null if unavailable
 */
const getChromeRuntime = () => {
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            return chrome.runtime;
        }
        if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.id) {
            return browser.runtime;
        }
    } catch (e) {
        // Extension context may be invalidated
        if (e.message && e.message.includes('Extension context invalidated')) {
            console.warn('[ResponseAble] Extension context invalidated - extension may need reload');
        } else {
            console.error('[ResponseAble] Error accessing runtime:', e);
        }
    }
    return null;
};

/* =============================================================================
 * API CONFIGURATION
 * ============================================================================= */

/**
 * API configuration object - stores the current provider, model, and variant settings.
 * This is loaded from Chrome storage and updated when settings change.
 * @type {Object}
 */
let apiConfig = {
    provider: 'grok',
    model: 'grok-4-latest',
    numVariants: 4,
};

/**
 * Retrieves the API key for the specified provider from the config file.
 * 
 * @param {string} provider - The API provider name ('openai' or 'grok')
 * @returns {string} The API key or empty string if not found
 */
const getApiKey = (provider) => {
    return API_KEYS[provider] || '';
};

/**
 * Loads API configuration from Chrome storage.
 * Falls back to default values if storage is unavailable.
 * 
 * @returns {Promise<Object>} The loaded API configuration
 */
const loadApiConfig = async () => {
    return new Promise((resolve) => {
        try {
            const storage = typeof chrome !== 'undefined' ? chrome.storage : (typeof browser !== 'undefined' ? browser.storage : null);
            if (!storage) {
                console.warn('[ResponseAble] Chrome storage API not available, using defaults');
                resolve(apiConfig);
                return;
            }
            storage.sync.get(['apiProvider', 'apiModel', 'numVariants'], (result) => {
                const numVariants = result.numVariants || 4;
                apiConfig = {
                    provider: result.apiProvider || 'grok',
                    model: result.apiModel || 'grok-4-latest',
                    // Clamp numVariants between 1 and 7 to prevent UI issues
                    numVariants: Math.max(1, Math.min(7, numVariants)),
                };
                resolve(apiConfig);
            });
        } catch (error) {
            console.error('[ResponseAble] Error in loadApiConfig:', error.message);
            resolve(apiConfig);
        }
    });
};

// Initialize configuration on script load
loadApiConfig();

/**
 * Set up listener for configuration changes in Chrome storage.
 * This allows the extension to react to settings changes without reload.
 */
const initStorageListener = () => {
    try {
        const storage = typeof chrome !== 'undefined' ? chrome.storage : (typeof browser !== 'undefined' ? browser.storage : null);
        if (storage && storage.onChanged) {
            storage.onChanged.addListener((changes) => {
                if (changes.apiProvider || changes.apiModel || changes.numVariants) {
                    loadApiConfig();
                }
            });
        }
    } catch (error) {
        console.error('[ResponseAble] Error in initStorageListener:', error.message);
    }
};
initStorageListener();

/* =============================================================================
 * PLATFORM DETECTION
 * ============================================================================= */

/**
 * Detects the current platform based on the page hostname.
 * Currently supports Gmail and LinkedIn.
 * 
 * @returns {string|null} 'gmail', 'linkedin', or null if unsupported platform
 */
const detectPlatform = () => {
    const hostname = window.location.hostname;
    
    // Gmail detection - includes both mail.google.com and gmail.com
    if (hostname.includes('mail.google.com') || hostname.includes('gmail.com')) {
        return 'gmail';
    }
    
    // LinkedIn detection
    if (hostname.includes('linkedin.com')) {
        return 'linkedin';
    }
    
    return null;
};

/* =============================================================================
 * EMAIL CLASSIFICATION
 * ============================================================================= */

/**
 * Creates a default classification result when AI classification fails or is unavailable.
 * This ensures the extension can still function with sensible defaults.
 * 
 * @param {Object} richContext - The context object containing recipient info
 * @returns {Object} Default classification with generic response options
 */
const createDefaultClassification = (richContext) => ({
    type: 'other',
    intent: 'general inquiry',
    response_goals: ['respond appropriately'],
    tone_needed: 'professional',
    tone_sets: { 'respond appropriately': ['professional'] },
    variant_sets: {
        'respond appropriately': DEFAULT_VARIANTS.slice(0, apiConfig.numVariants || 4)
    },
    recipient_name: richContext.recipientName || '',
    recipient_company: richContext.recipientCompany || null,
    key_topics: []
});

/**
 * Attempts to fix truncated or malformed JSON from AI responses.
 * AI models sometimes return incomplete JSON due to token limits.
 * This function tries to repair common issues.
 * 
 * @param {string} content - The potentially malformed JSON string
 * @returns {string} The repaired JSON string
 */
const repairTruncatedJson = (content) => {
    let fixedContent = content;
    
    // Step 1: Find and remove incomplete strings (strings without closing quotes)
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
            let beforeQuote = fixedContent.substring(Math.max(0, stringStart - 1), stringStart);
            if (beforeQuote !== '\\') {
                let afterQuote = fixedContent.substring(stringStart + 1, Math.min(fixedContent.length, stringStart + 10)).trim();
                if (afterQuote.startsWith(':') || afterQuote.startsWith(',') || afterQuote.startsWith('}') || afterQuote.startsWith(']')) {
                    stringStart = fixedContent.lastIndexOf('"', stringStart - 1);
                    continue;
                }
                fixedContent = fixedContent.substring(0, stringStart);
                fixedContent = fixedContent.replace(/,\s*$/, '');
                break;
            }
            stringStart = fixedContent.lastIndexOf('"', stringStart - 1);
        }
    } else {
        fixedContent = fixedContent.substring(0, lastValidChar + 1);
    }

    // Step 2: Close incomplete arrays - count [ and ] brackets
    let openBrackets = (fixedContent.match(/\[/g) || []).length;
    let closeBrackets = (fixedContent.match(/\]/g) || []).length;
    while (openBrackets > closeBrackets) {
        fixedContent = fixedContent.trim().replace(/,\s*$/, '') + ']';
        closeBrackets++;
    }

    // Step 3: Close incomplete objects - count { and } braces
    let openBraces = (fixedContent.match(/\{/g) || []).length;
    let closeBraces = (fixedContent.match(/\}/g) || []).length;
    while (openBraces > closeBraces) {
        fixedContent = fixedContent.trim().replace(/,\s*$/, '') + '}';
        closeBraces++;
    }

    // Step 4: Remove trailing commas before closing braces/brackets
    // This regex finds commas followed by optional whitespace and then } or ]
    fixedContent = fixedContent.replace(/,\s*([}\]])/g, '$1');

    return fixedContent;
};

/**
 * Generates a short title from a goal text for use in tab labels.
 * 
 * @param {string} goal - The full goal text
 * @returns {string} A shortened title (2-4 words)
 */
const generateShortTitle = (goal) => {
    const words = goal.split(' ');
    if (words.length <= 3) return goal;
    return words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

/**
 * Processes and validates the classification result from the AI.
 * Ensures all required fields are present and properly formatted.
 * 
 * @param {Object} classification - The raw classification from AI
 * @param {Object} richContext - The context object containing recipient info
 * @returns {Object} The validated and normalized classification
 */
const processClassificationResult = (classification, richContext) => {
    // Extract and validate response_goals
    const response_goals = Array.isArray(classification.response_goals) && classification.response_goals.length > 0
        ? classification.response_goals
        : ['respond appropriately'];

    // Extract tone_sets, variant_sets, and goal_titles with fallbacks
    const tone_sets = classification.tone_sets && typeof classification.tone_sets === 'object'
        ? classification.tone_sets
        : {};

    const variant_sets = classification.variant_sets && typeof classification.variant_sets === 'object'
        ? classification.variant_sets
        : {};

    const goal_titles = classification.goal_titles && typeof classification.goal_titles === 'object'
        ? classification.goal_titles
        : {};

    // Ensure each response_goal has corresponding tone_sets, variant_sets, and goal_titles
    const expectedNumVariants = apiConfig.numVariants || 4;
    response_goals.forEach(goal => {
        // Ensure tone_sets has an entry for this goal
        if (!tone_sets[goal] || !Array.isArray(tone_sets[goal]) || tone_sets[goal].length === 0) {
            tone_sets[goal] = [classification.tone_needed || 'professional'];
        }
        // Ensure variant_sets has the correct number of variants for this goal
        if (!variant_sets[goal] || !Array.isArray(variant_sets[goal]) || variant_sets[goal].length !== expectedNumVariants) {
            variant_sets[goal] = DEFAULT_VARIANTS.slice(0, expectedNumVariants);
        }
        // Ensure goal_titles has an entry for this goal
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
        type: classification.type || 'other',
        intent: classification.intent || 'general inquiry',
        response_goals: response_goals,
        goal_titles: goal_titles,
        tone_needed: tone_needed,
        tone_sets: tone_sets,
        variant_sets: variant_sets,
        recipient_name: classification.recipient_name || richContext.recipientName || '',
        recipient_company: classification.recipient_company || richContext.recipientCompany || null,
        key_topics: classification.key_topics || []
    };
};

/**
 * Classifies an email/message using AI to determine its type, intent, and appropriate response strategies.
 * This is the core intelligence of the extension - it analyzes the email context and generates
 * customized response goals, tones, and variants.
 * 
 * @param {Object} richContext - Context object with recipient info and thread content
 * @param {string} sourceMessageText - The text of the message being replied to
 * @param {string} platform - The platform ('gmail' or 'linkedin')
 * @returns {Promise<Object>} Classification result with type, intent, goals, tones, and variants
 */
const classifyEmail = async (richContext, sourceMessageText, platform) => {
    try {
        await loadApiConfig();
        const apiKey = getApiKey(apiConfig.provider);
        
        // If no API key, return defaults - don't block the user
        if (!apiKey) {
            console.warn('[ResponseAble] API key not available for classification, using defaults');
            return createDefaultClassification(richContext);
        }

        // Use cheaper/faster models for classification
        const classificationModel = apiConfig.provider === 'openai'
            ? 'gpt-4o-mini'
            : 'grok-4-fast';

        const apiEndpoint = apiConfig.provider === 'openai'
            ? 'https://api.openai.com/v1/chat/completions'
            : 'https://api.x.ai/v1/chat/completions';

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        };

        // Get numVariants for the classification prompt
        const numVariants = apiConfig.numVariants || 4;

        const classificationPrompt = `You are an expert email classifier. Analyze the ${platform === 'linkedin' ? 'message' : 'email'} context and return ONLY a JSON object with:
{
  "type": "sales" | "recruiter" | "jobseeker" | "support" | "networking" | "personal" | "other",
  "intent": Suggest the sender's primary intent from the recipient's perspective as a short, descriptive string (e.g., "offering a job", "selling software", "requesting a meeting", "inquiring about services", "complaining about support", "building network", "sharing feedback"). Be specific and natural — no fixed list.
  "response_goals": Array of up to 5 most appropriate goals for the recipient's reply, ranked by suitability. Each is a descriptive string (e.g., "politely decline", "negotiate terms", "express strong interest", "ask clarifying questions", "offer alternative", "acknowledge and redirect"). Base these directly on the detected intent and overall context. Be nuanced and realistic.
  "goal_titles": Object with keys matching response_goals, each containing a short title (2-4 words max) suitable for a tab label. Keep titles concise and action-oriented (e.g., "Decline", "Negotiate", "Express Interest", "Ask Questions", "Offer Alternative"). The title should capture the essence of the goal.
  "tone_needed": The single most appropriate tone for the reply as a short string (e.g., "confident", "empathetic and professional"). This will be used as the primary tone. Base tone_needed directly on the detected intent and overall context. Be nuanced and realistic.
  "tone_sets": Object with keys matching response_goals, each containing array of suggested ranked tone strings based on the response_goals and overall context. Each tone is a short string (e.g., "confident", "empathetic and professional", "polite but firm").
  "variant_sets": Object with keys matching response_goals, each containing array of exactly ${numVariants} specific variant labels ranked by relevance. Each variant is a short descriptive label (e.g., "Warm Follow-Up", "Objection Handler - Price", "Express Strong Interest", "Empathetic Acknowledgment", "Polite Decline").
  "recipient_name": string,
  "recipient_company": string or null,
  "key_topics": array of strings (max 5)
}

Be highly context-specific for intent, goals, tones, and variants. Base everything directly on the actual email content, relationship, and situation. Be accurate and conservative — default to "other" if unclear. Return ONLY valid JSON, no other text.`;

        const requestBody = {
            model: classificationModel,
            messages: [
                {
                    role: 'system',
                    content: classificationPrompt
                },
                {
                    role: 'user',
                    content: `Email context:\n${richContext.fullContext}\n\nSource ${platform === 'linkedin' ? 'message' : 'email'}:\n${sourceMessageText}`
                }
            ],
            temperature: 0.3,
            max_tokens: 1200
        };

        // Add JSON format for OpenAI models that support it (gpt-4o-mini and newer)
        if (apiConfig.provider === 'openai' && (classificationModel.includes('gpt-4o') || classificationModel.includes('gpt-3.5'))) {
            requestBody.response_format = { type: 'json_object' };
        }

        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.warn('Classification API error:', errorData);
            throw new Error(errorData.error?.message || 'Classification failed');
        }

        const data = await response.json();
        let content = data.choices?.[0]?.message?.content || '{}';

        // Clean up content - remove markdown code blocks if present
        content = content.trim();
        if (content.startsWith('```json')) {
            content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (content.startsWith('```')) {
            content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        // Validate content before parsing
        if (!content || content === '{}' || content.length === 0) {
            throw new Error('Empty classification response');
        }

        // Repair truncated JSON from AI response
        const fixedContent = repairTruncatedJson(content);

        // Try to parse the repaired JSON
        try {
            const classification = JSON.parse(fixedContent);
            return processClassificationResult(classification, richContext);
        } catch (parseError) {
            // First parse failed, try aggressive fix - extract last complete JSON object
            try {
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
                    const lastCompleteJson = jsonObjects[jsonObjects.length - 1];
                    const classification = JSON.parse(lastCompleteJson);
                    return processClassificationResult(classification, richContext);
                } else {
                    throw new Error('No complete JSON object found');
                }
            } catch (secondTryError) {
                // All parsing attempts failed, return defaults
                console.error('[ResponseAble] Classification JSON parsing failed:', secondTryError.message);
                return createDefaultClassification(richContext);
            }
        }
    } catch (error) {
        // API or network error, return defaults
        console.error('[ResponseAble] Email classification error:', error.message);
        return createDefaultClassification(richContext);
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
            .filter(text => text && !text.includes('Generate Response') && !text.includes('Generate') && !text.includes('Respond'))
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
            .filter(text => text && text.length > 0 && !text.includes('Generate') && !text.includes('Respond'))
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
        // Check if reply or new message
        isReply: () => {
            const subjectField = document.querySelector('input[aria-label="Subject"]');
            const subjectValue = subjectField?.value || '';
            const allMessageDivs = Array.from(document.querySelectorAll('div[aria-label="Message Body"]'))
                .filter(div => div.getAttribute('role') !== 'textbox');
            return allMessageDivs.length > 0 || subjectValue.toLowerCase().startsWith('re:');
        },
        // Get thread messages for context
        getThreadMessages: () => {
            const composeBody = document.querySelector('div[aria-label="Message Body"][role="textbox"]');
            const composeText = composeBody?.innerText?.trim() || '';
            const allMessageDivs = Array.from(document.querySelectorAll('div[aria-label="Message Body"]'))
                .filter(div => {
                    return div.getAttribute('role') !== 'textbox' && div.innerText?.trim() !== composeText;
                });
            return allMessageDivs
                .map(div => div.innerText.trim())
                .filter(text => text && !text.includes('Generate') && !text.includes('Respond'));
        },
        // Get sender name from email - scoped to the current email thread only
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
        // Check if reply or new message
        isReply: () => {
            // Check if there are existing messages in the conversation
            const existingMessages = document.querySelectorAll('.msg-s-message-list__message, .msg-s-event-listitem, .msg-s-message-listitem');
            return existingMessages.length > 0;
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
                .filter(text => text && text.length > 0 && !text.includes('Generate') && !text.includes('Respond'));
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
            iconImg.onerror = () => {
                console.error('[ResponseAble] Failed to load raiconvector.png');
            };
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
const createButton = (buttonText, buttonTooltip, buttonClass, platform) => {
    const generateButton = document.createElement('button');
    generateButton.type = 'button';

    // Try to add icon, but continue even if it fails
    const runtime = getChromeRuntime();
    if (runtime) {
        try {
            const iconImg = document.createElement('img');
            iconImg.src = runtime.getURL('raicon20x20.png');
            iconImg.alt = 'ResponseAble';
            // Platform-specific icon sizing
            if (platform === 'linkedin') {
                iconImg.style.cssText = 'width: 16px !important; height: 16px !important; max-width: 16px !important; max-height: 16px !important; display: inline-block !important; vertical-align: middle !important; margin-right: 6px !important; opacity: 1 !important; visibility: visible !important; object-fit: contain !important; flex-shrink: 0 !important;';
            } else {
                iconImg.style.cssText = 'width: 20px !important; height: 20px !important; max-width: 20px !important; max-height: 20px !important; display: inline-block !important; vertical-align: middle !important; margin-right: 6px !important; opacity: 1 !important; visibility: visible !important; object-fit: contain !important; flex-shrink: 0 !important;';
            }
            iconImg.onerror = () => console.error('Failed to load raicon20x20.png from:', iconImg.src);
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
        generateButton.style.cssText = 'display: inline-flex !important; align-items: center !important; padding: 6px 12px !important; margin: 0 1px !important; border-radius: 0px !important; background: #D3E3FD !important; color: #444746 !important; border: none !important; cursor: pointer !important; font-size: 14px !important;';
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

        const isReply = adapter.isReply();
        const buttonText = isReply ? 'Respond' : 'Generate';
        const buttonTooltip = isReply ? 'Generate AI response options' : 'Generate AI message drafts';
        const buttonClass = isReply ? 'responseable-respond' : 'responseable-generate';

        const generateButton = createButton(buttonText, buttonTooltip, buttonClass, platform);

        generateButton.onclick = async () => {
            const currentButtonText = buttonText;
            // Get context for API call using enhanced context extraction
            const richContext = getRichContext();
            const threadMessages = adapter.getThreadMessages();
            const sourceMessageText = threadMessages.length > 0 ? threadMessages[threadMessages.length - 1] : '';

            // Use rich context for the prompt
            const context = richContext.fullContext;
            const recipientName = richContext.recipientName;
            const recipientCompany = richContext.recipientCompany;

            // Get sender name if replying (fallback to recipientName from rich context)
            const senderName = isReply ? (adapter.getSenderName() || recipientName) : null;

            // Step 1: Classify email using AI
            generateButton.innerHTML = 'Analyzing...';
            generateButton.style.opacity = '0.7';

            const classification = await classifyEmail(richContext, sourceMessageText, platform);

            generateButton.innerHTML = 'Generating...';

            // Store context needed for regeneration
            const regenerateContext = {
                richContext,
                sourceMessageText,
                context,
                senderName,
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
                    (draftsText) => {
                        showDraftsOverlay(draftsText, context, platform, null, classification, regenerateContext);
                    }
                );
            } catch (err) {
                alert(`${apiConfig.provider} API error: ${err.message}\nCheck API key and network.`);
            } finally {
                // Restore button
                generateButton.innerHTML = '';
                const runtime = getChromeRuntime();
                if (runtime) {
                    try {
                        const iconImg = document.createElement('img');
                        iconImg.src = runtime.getURL('raicon20x20.png');
                        iconImg.alt = 'ResponseAble';
                        // Platform-specific icon sizing
                        if (platform === 'linkedin') {
                            iconImg.style.cssText = 'width: 16px !important; height: 16px !important; max-width: 16px !important; max-height: 16px !important; display: inline-block !important; vertical-align: middle !important; margin-right: 6px !important; opacity: 1 !important; visibility: visible !important; object-fit: contain !important; flex-shrink: 0 !important;';
                        } else {
                            iconImg.style.cssText = 'width: 20px !important; height: 20px !important; max-width: 20px !important; max-height: 20px !important; display: inline-block !important; vertical-align: middle !important; margin-right: 6px !important; opacity: 1 !important; visibility: visible !important; object-fit: contain !important; flex-shrink: 0 !important;';
                        }
                        generateButton.appendChild(iconImg);
                    } catch (error) {
                        console.error('Error loading icon in finally block:', error);
                    }
                }
                generateButton.appendChild(document.createTextNode(currentButtonText));
                generateButton.style.opacity = '1';
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
        };

        // Insert button before send button
        toolbar.insertBefore(generateButton, sendButton.nextSibling);
    });
};

// Simple overlay to show drafts
// Function to generate drafts with a specific tone
const generateDraftsWithTone = async (richContext, sourceMessageText, platform, classification, selectedTone, senderName, recipientName, recipientCompany, adapter, onComplete) => {
    try {
        await loadApiConfig();
        const apiKey = getApiKey(apiConfig.provider);
        if (!apiKey) {
            alert(`API key not configured for ${apiConfig.provider}. Please contact the extension developer.`);
            return;
        }

        // Get the primary goal and its variants/tone
        // Check if a specific goal was passed (for tab switching)
        const currentGoal = classification._currentGoal || (classification.response_goals && classification.response_goals[0]
            ? classification.response_goals[0]
            : 'respond appropriately');

        // Load numVariants setting
        await loadApiConfig();
        const expectedNumVariants = apiConfig.numVariants || 4;

        // Use provided variant set if available (from tab switching), otherwise get from classification
        const variantSet = classification._currentVariantSet || (classification.variant_sets && classification.variant_sets[currentGoal]
            ? classification.variant_sets[currentGoal]
            : DEFAULT_VARIANTS.slice(0, expectedNumVariants));

        const toneSet = classification.tone_sets && classification.tone_sets[currentGoal]
            ? classification.tone_sets[currentGoal]
            : [selectedTone];

        // Use provided tone if available (from tab switching), otherwise use first from tone_set or selectedTone
        const goalTone = classification._currentTone || (toneSet[0] || selectedTone);

        // Build variant list from variant_set
        const variantList = variantSet.map((v, i) => `${i + 1}. ${v}`).join('\n');

        // Step 2: Build role-specific prompts based on classification
        // Helper function to build prompts with variant list and classification context
        const buildRolePrompt = (roleDescription, contextSpecific) => {
            const variantCount = variantSet.length;
            const keyTopicsText = classification.key_topics && Array.isArray(classification.key_topics) && classification.key_topics.length > 0
                ? classification.key_topics.join(", ")
                : "";
            const intentText = classification.intent ? ` The sender's intent: ${classification.intent}.` : "";
            const goalText = currentGoal ? ` Your response goal: ${currentGoal}.` : "";

            return `You are ${roleDescription}. Generate exactly ${variantCount} complete, personalized reply options based on the source email provided. The variant strategies are: ${variantList}. Use a ${goalTone} tone.${intentText}${goalText} Personalize for ${classification.recipient_name || "the recipient"}${classification.recipient_company ? ` at ${classification.recipient_company}` : ""}.${keyTopicsText ? ` Key topics: ${keyTopicsText}.` : ""} ${contextSpecific} 

IMPORTANT FORMATTING REQUIREMENTS:
- Each variant should be a complete email ready to send, including greeting, body text, and closing
- Do NOT include variant labels, numbers, or strategy names in the response text
- Start each email directly with the greeting (e.g., "Dear [Name]," or "Hi [Name],")
- Separate each complete email response with exactly "---RESPONSE---" on its own line
- Keep each reply under 150 words
- Sound human, not robotic

Example format:
Dear [Name],

[Email body text]

Best regards,

---RESPONSE---

Dear [Name],

[Email body text]

Best regards,`;
        };

        const rolePrompts = {
            sales: buildRolePrompt(
                'a world-class B2B sales email writer',
                'Respond appropriately based on your interest level in the product/service.'
            ),
            recruiter: buildRolePrompt(
                'a professional candidate responding to a recruiter\'s job offer',
                'The sender (recruiter) is OFFERING a job position to YOU (the recipient/candidate). Respond as the candidate - express interest, ask questions about the role, or politely decline. Do NOT respond as if you are offering them a job.'
            ),
            jobseeker: buildRolePrompt(
                'a hiring manager or recruiter responding to a job application',
                'The sender is applying for a position. Respond appropriately as the recipient (hiring manager/recruiter).'
            ),
            support: buildRolePrompt(
                'an empathetic customer support specialist',
                'Address the customer\'s concern professionally and helpfully.'
            ),
            networking: buildRolePrompt(
                'a professional building genuine connections',
                'Keep it professional, warm, and relationship-focused.'
            ),
            personal: buildRolePrompt(
                'writing a friendly, personal email',
                'Keep it warm and conversational.'
            ),
            other: buildRolePrompt(
                'a professional email reply writer',
                'Carefully analyze the source email to understand the context, relationship, and intent. Respond appropriately from the recipient\'s perspective.'
            )
        };

        const intentText = classification.intent ? ` The sender's intent: ${classification.intent}.` : "";
        const goalText = currentGoal ? ` Your response goal: ${currentGoal}.` : "";
        const keyTopicsText = classification.key_topics && Array.isArray(classification.key_topics) && classification.key_topics.length > 0
            ? classification.key_topics.join(", ")
            : "";

        const systemPrompt = platform === 'linkedin'
            ? `You are a professional LinkedIn message writer. Generate exactly ${variantSet.length} complete, personalized reply options based on the source message provided. The variant strategies are: ${variantList}. Use a ${goalTone} tone.${intentText}${goalText} Personalize for ${classification.recipient_name || "the recipient"} at ${classification.recipient_company || "their company"}.${keyTopicsText ? ` Key topics: ${keyTopicsText}.` : ""}

IMPORTANT FORMATTING REQUIREMENTS:
- Each variant should be a complete message ready to send, including greeting, body text, and closing
- Do NOT include variant labels, numbers, or strategy names in the response text
- Start each message directly with the greeting (e.g., "Hi [Name]," or "Hello [Name],")
- Separate each complete message response with exactly "---RESPONSE---" on its own line
- Keep it professional, concise, and under 150 words
- Sound human, not robotic

Example format:
Hi [Name],

[Message body text]

Best regards,

---RESPONSE---

Hi [Name],

[Message body text]

Best regards,`
            : rolePrompts[classification.type] || rolePrompts.other;

        // Note: Personalization is now included in the role prompts, so we don't need to add it separately
        const finalSystemPrompt = systemPrompt;

        // Determine API endpoint based on provider
        let apiEndpoint;
        let requestBody;
        let headers = {
            'Content-Type': 'application/json',
        };

        if (apiConfig.provider === 'openai' || apiConfig.provider === 'grok') {
            apiEndpoint = apiConfig.provider === 'openai'
                ? 'https://api.openai.com/v1/chat/completions'
                : 'https://api.x.ai/v1/chat/completions';

            headers['Authorization'] = `Bearer ${apiKey}`;

            requestBody = {
                model: apiConfig.model,
                messages: [
                    {
                        role: 'system',
                        content: finalSystemPrompt
                    },
                    {
                        role: 'user',
                        content: `SOURCE ${platform === 'linkedin' ? 'MESSAGE' : 'EMAIL'} YOU RECEIVED:
${sourceMessageText}

${richContext.fullContext ? `ADDITIONAL CONTEXT:\n${richContext.fullContext}\n\n` : ''}${senderName || recipientName ? `IMPORTANT: The person who sent you this ${platform === 'linkedin' ? 'message' : 'email'} is named "${senderName || recipientName}"${recipientCompany ? ` from ${recipientCompany}` : ''}. You are replying TO them. Address them by their actual name "${senderName || recipientName}" in your greeting. Do NOT use "Google", "Hi there", "Hello", or any generic greeting - use their actual name "${senderName || recipientName}".\n\n` : 'IMPORTANT: Extract the sender\'s name from the email above and use it in your greeting. Do NOT use generic greetings like "Hi Google" or "Hello there".\n\n'}CRITICAL - Do NOT include in your response:
- A subject line (it's already set)
- Your signature, name, email address, phone number, or company name (${platform === 'gmail' ? 'Gmail will automatically add your signature' : 'signatures are not needed'})
- Made-up names, companies, or contact information
- Generic greetings like "Hi Google" or "Hello there" - use the actual sender's name
- Any text after the closing (no signatures, no contact info)
- Labels like "1. Friendly response" or "2. Insightful response" - just write the actual email text`
                    }
                ],
                temperature: 0.8,
                max_tokens: 800
            };
        } else {
            throw new Error('Unknown API provider: ' + apiConfig.provider);
        }

        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!response.ok) {
            const errorMessage = data.error?.message || data.error?.message || `HTTP ${response.status}: ${response.statusText}`;
            throw new Error(errorMessage);
        }

        if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
            console.error('Unexpected API response structure:', data);
            throw new Error(`Invalid response format from ${apiConfig.provider} API`);
        }

        if (!data.choices[0].message || !data.choices[0].message.content) {
            console.error('Unexpected message structure:', data.choices[0]);
            throw new Error('Invalid message structure in API response');
        }
        const draftsText = data.choices[0].message.content;

        onComplete(draftsText);
    } catch (err) {
        console.error('Error generating drafts:', err);
        throw err;
    }
};

const showDraftsOverlay = (draftsText, context, platform, customAdapter = null, classification = null, regenerateContext = null) => {
    // Remove existing overlay
    document.querySelector('.responseable-overlay')?.remove();

    const adapter = customAdapter || platformAdapters[platform];
    const overlay = document.createElement('div');
    overlay.className = 'responseable-overlay';
    overlay.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 80%;
    max-width: 800px;
    max-height: 80vh;
    overflow-y: auto;
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.3);
    z-index: 10000;
    padding: 24px;
    font-family: Google Sans,Roboto,sans-serif;
  `;

    // Parse drafts - split by clear separator markers first
    let draftBlocks = [];

    if (draftsText.includes('---RESPONSE---')) {
        draftBlocks = draftsText.split(/---RESPONSE---/g)
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
    const expectedNumVariants = apiConfig.numVariants || 4;
    const variantSet = classification && classification.variant_sets && classification.variant_sets[currentGoal]
        ? classification.variant_sets[currentGoal]
        : DEFAULT_VARIANTS.slice(0, expectedNumVariants);

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

    overlay.innerHTML = `
    <h2 style="margin-top:0; color:#202124; display: flex; align-items: center; gap: 8px;"><span id="responseable-overlay-icon"></span> Able to Respond Better</h2>
    ${classification ? `<p style="color:#5f6368; margin-top: -8px; margin-bottom: 12px; font-size: 12px;"><strong>Intent:</strong> ${classification.intent || 'general inquiry'}${classification.key_topics && classification.key_topics.length > 0 ? ` | Topics: ${classification.key_topics.join(', ')}` : ''}</p>` : ''}
    ${responseGoals.length > 1 ? `
    <div style="margin-bottom: 16px; border-bottom: 1px solid #dadce0; padding-bottom: 8px;">
      <div style="display: flex; flex-wrap: wrap; gap: 0;">
        ${tabsHtml}
      </div>
      <div id="goal-description" style="margin-top: 12px; padding: 8px 12px; background: #f8f9fa; border-radius: 4px; font-size: 12px; color: #5f6368; min-height: 20px;">
        <strong>Goal:</strong> <span id="goal-description-text">${currentGoal}</span>
      </div>
    </div>
    ` : ''}
    ${classification && classification.tone_sets && classification.tone_sets[currentGoal] && classification.tone_sets[currentGoal].length > 1 ? `
    <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
      <label for="tone-selector" style="font-size: 13px; color: #5f6368; font-weight: 500;">Tone:</label>
      <select id="tone-selector" style="padding: 6px 12px; border: 1px solid #dadce0; border-radius: 4px; font-size: 13px; background: white; color: #202124; cursor: pointer;">
        ${classification.tone_sets[currentGoal].map(tone => `<option value="${tone}" ${tone === currentTone ? 'selected' : ''}>${tone}</option>`).join('')}
      </select>
      <span id="regenerate-status" style="font-size: 12px; color: #5f6368; margin-left: 8px;"></span>
    </div>
    ` : ''}
    <p style="color:#5f6368; margin-top: 0;">Click any draft to insert it</p>
    <div id="drafts-container" style="max-height: 60vh; overflow-y: auto;">
      ${draftsHtml}
    </div>
    <div id="loading-indicator" style="display: none; text-align: center; padding: 20px; color: #5f6368;">
      Generating drafts...
    </div>
    <button id="responseable-close-button" style="margin-top:20px; padding:8px 16px; background:#1a73e8; color:white; border:none; border-radius:4px; cursor:pointer;">
      Close
    </button>
  `;

    // Create and insert icon programmatically
    const runtime = getChromeRuntime();
    const iconContainer = overlay.querySelector('#responseable-overlay-icon');
    if (iconContainer && runtime) {
        try {
            const iconUrl = runtime.getURL('raicon20x20.png');
            const iconImg = document.createElement('img');
            iconImg.src = iconUrl;
            iconImg.alt = 'ResponseAble';
            iconImg.style.cssText = 'width: 24px !important; height: 24px !important; display: inline-block !important; vertical-align: middle !important; object-fit: contain !important; flex-shrink: 0 !important;';
            iconImg.onerror = (e) => {
                console.error('Failed to load raicon20x20.png in overlay from:', iconImg.src);
                iconImg.style.display = 'none';
            };
            iconContainer.appendChild(iconImg);
        } catch (error) {
            console.error('Error loading overlay icon:', error);
        }
    }

    // Add close button handler
    const closeButton = overlay.querySelector('#responseable-close-button');
    if (closeButton) {
        closeButton.onclick = () => overlay.remove();
    }

    // Tab switching logic
    if (classification && regenerateContext && responseGoals.length > 1) {
        const goalTabs = overlay.querySelectorAll('.responseable-goal-tab');
        const draftsContainer = overlay.querySelector('#drafts-container');
        const loadingIndicator = overlay.querySelector('#loading-indicator');

        // Track which goals have been generated
        const generatedGoals = new Set([currentGoal]);

        goalTabs.forEach((tab, index) => {
            const goal = responseGoals[index];

            tab.onclick = async () => {
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
                        (newDraftsText) => {
                            // Parse new drafts using the same robust logic as initial parsing
                            let newDraftBlocks = [];

                            if (newDraftsText.includes('---RESPONSE---')) {
                                newDraftBlocks = newDraftsText.split(/---RESPONSE---/g)
                                    .map(block => {
                                        let cleaned = block.trim();
                                        // Remove variant labels that might appear at the start (e.g., "1. Simple Agreement", "2. Enthusiastic Confirmation")
                                        // Match patterns like: "1. Variant Name", "Variant Name", or numbered lists
                                        cleaned = cleaned.replace(/^\d+\.\s*[A-Z][^\n]*(?:\n|$)/, '');
                                        cleaned = cleaned.replace(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*$/m, ''); // Remove standalone variant names on their own line
                                        // Remove labels like "1. Friendly response", "2. Insightful response", etc.
                                        cleaned = cleaned.replace(/^\d+\.\s*(Friendly|Insightful|Polite|Formal|Professional|Concise)\s+(response|message)[\s:]*\n?/i, '');
                                        cleaned = cleaned.replace(/^(Friendly|Insightful|Polite|Formal|Professional|Concise)\s+(response|message):\s*/i, '');
                                        // Remove any leading numbers followed by labels or variant names
                                        cleaned = cleaned.replace(/^\d+\.\s*[^\n]*\n/, '');
                                        // Remove variant names that appear as standalone lines (e.g., "Simple Agreement" on its own line)
                                        cleaned = cleaned.replace(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*$/m, '');
                                        return cleaned.trim();
                                    })
                                    .filter(block => block.length > 10); // Minimum length check
                            } else {
                                // Try to split by numbered patterns, but be smarter about it
                                const numberedPattern = /(?:^|\n)\s*(\d+)\.\s+[^\n]*\n/g;
                                const matches = [...newDraftsText.matchAll(numberedPattern)];

                                if (matches.length >= 4) {
                                    for (let i = 0; i < matches.length; i++) {
                                        const match = matches[i];
                                        const startIndex = match.index;
                                        const endIndex = i < matches.length - 1 ? matches[i + 1].index : newDraftsText.length;
                                        let content = newDraftsText.substring(startIndex, endIndex).trim();
                                        // Remove the numbered label line
                                        content = content.replace(/^\d+\.\s+[^\n]*\n/, '').trim();
                                        // Remove variant names that appear as standalone lines
                                        content = content.replace(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*$/m, '');
                                        if (content && content.length > 10) {
                                            newDraftBlocks.push(content);
                                        }
                                    }
                                } else {
                                    // Split by multiple newlines, but filter out variant name lines
                                    newDraftBlocks = newDraftsText.split(/\n\n\n+/)
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
                            newDraftBlocks = newDraftBlocks.filter(block => {
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

                            // Render new drafts
                            const newDraftsHtml = renderDraftsHtml(newDraftBlocks, goal);
                            draftsContainer.innerHTML = newDraftsHtml;

                            // Re-attach click handlers for draft insertion
                            attachDraftClickHandlers(overlay, adapter);

                            // Hide loading, show drafts
                            loadingIndicator.style.display = 'none';
                            draftsContainer.style.display = 'block';

                            generatedGoals.add(goal);
                        }
                    );
                } catch (err) {
                    console.error('Error generating drafts for goal:', err);
                    loadingIndicator.innerHTML = 'Error generating drafts. Please try again.';
                }
            };
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
            draftOption.onclick = () => {
                const draftText = draftOption.getAttribute('data-draft-text');
                if (draftText && adapterEl) {
                    adapterEl.insertText(draftText);
                    overlayEl.remove();
                }
            };
        });
    };

    // Attach initial draft click handlers
    attachDraftClickHandlers(overlay, adapter);

    // Tone selector change handler - regenerate variants with new tone for current goal
    if (classification && regenerateContext) {
        const toneSelector = overlay.querySelector('#tone-selector');
        const draftsContainer = overlay.querySelector('#drafts-container');
        const loadingIndicator = overlay.querySelector('#loading-indicator');
        const regenerateStatus = overlay.querySelector('#regenerate-status');

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

                try {
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

                    await generateDraftsWithTone(
                        regenerateContext.richContext,
                        regenerateContext.sourceMessageText,
                        platform,
                        updatedClassification,
                        newTone,
                        regenerateContext.senderName,
                        regenerateContext.recipientName,
                        regenerateContext.recipientCompany,
                        adapter,
                        (newDraftsText) => {
                            // Re-render the drafts with new tone
                            showDraftsOverlay(newDraftsText, regenerateContext.context, platform, adapter, updatedClassification, regenerateContext);
                        }
                    );
                } catch (err) {
                    regenerateStatus.textContent = 'Error regenerating';
                    console.error('Error regenerating drafts:', err);
                    setTimeout(() => {
                        regenerateStatus.textContent = '';
                    }, 2000);
                    draftsContainer.style.display = 'block';
                    loadingIndicator.style.display = 'none';
                } finally {
                    toneSelector.disabled = false;
                }
            });
        }
    }

    // Click draft to insert
    overlay.querySelectorAll('.responseable-draft-option').forEach((block) => {
        block.onclick = () => {
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
            overlay.remove();
        };
    });

    document.body.appendChild(overlay);
};

// Shared click handler for comment buttons
const createCommentButtonHandler = (editor) => {
    return async function () {
        const commentButton = this;
        try {
            await loadApiConfig();
            const apiKey = getApiKey(apiConfig.provider);
            if (!apiKey) {
                alert(`API key not configured for ${apiConfig.provider}. Please contact the extension developer.`);
                return;
            }

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

            // Call AI API to generate comment responses
            let apiEndpoint;
            let requestBody;
            const headers = {
                'Content-Type': 'application/json',
            };

            if (apiConfig.provider === 'openai') {
                apiEndpoint = 'https://api.openai.com/v1/chat/completions';
                headers['Authorization'] = `Bearer ${apiKey}`;
                requestBody = {
                    model: apiConfig.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful assistant that generates professional LinkedIn comment responses.'
                        },
                        {
                            role: 'user',
                            content: `LinkedIn post content:\n\n${postText}\n\n${commentContext ? `Current comment draft:\n${commentContext}\n\n` : ''}Please generate 4 complete comment response variants. Format each response as a complete comment ready to post. Separate each response with exactly "---RESPONSE---" on its own line.\n\n1. Friendly response\n---RESPONSE---\n2. Insightful response\n---RESPONSE---\n3. Professional response\n---RESPONSE---\n4. Concise response`
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 1000
                };
            } else if (apiConfig.provider === 'grok') {
                apiEndpoint = 'https://api.x.ai/v1/chat/completions';
                headers['Authorization'] = `Bearer ${apiKey}`;
                requestBody = {
                    model: apiConfig.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful assistant that generates professional LinkedIn comment responses.'
                        },
                        {
                            role: 'user',
                            content: `LinkedIn post content:\n\n${postText}\n\n${commentContext ? `Current comment draft:\n${commentContext}\n\n` : ''}Please generate 4 complete comment response variants. Format each response as a complete comment ready to post. Separate each response with exactly "---RESPONSE---" on its own line.\n\n1. Friendly response\n---RESPONSE---\n2. Insightful response\n---RESPONSE---\n3. Professional response\n---RESPONSE---\n4. Concise response`
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 1000
                };
            }

            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API returned ${response.status}`);
            }

            const data = await response.json();
            const draftsText = data.choices?.[0]?.message?.content || '';
            if (!draftsText) {
                throw new Error('No response content received from API');
            }

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

            // Show drafts overlay with comment adapter
            showDraftsOverlay(draftsText, postText, 'linkedin', commentAdapter);

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
        return;
    }

    commentTextEditors.forEach((editor) => {
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
                let parent = emojiButton.parentElement;
                while (parent && parent !== document.body) {
                    if (parent.classList && parent.classList.contains('display-flex')) {
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
            commentButton.onclick = createCommentButtonHandler(editor);

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
