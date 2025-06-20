document.addEventListener('DOMContentLoaded', async () => {
    const modelNameDisplay = document.getElementById('modelNameDisplay');
    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    // Ensure loading indicator is hidden on initialization
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
    const clearChatButton = document.getElementById('clearChatButton');
    const modelSwitcherButton = document.getElementById('modelSwitcherButton');
    const modelSwitcherDropdown = document.getElementById('modelSwitcherDropdown');
    const conversationSidebar = document.getElementById('conversationSidebar');
    const newChatButton = document.getElementById('newChatButton');
    const collapseSidebarButton = document.getElementById('collapseSidebarButton');
    const conversationList = document.getElementById('conversationList');
    
    // Image upload elements
    const imageButton = document.getElementById('imageButton');
    const imageInput = document.getElementById('imageInput');
    const imagePreviewArea = document.getElementById('imagePreviewArea');
    const dragDropOverlay = document.getElementById('dragDropOverlay');

    let currentModelName = '';
    const storageKeyPrefix = 'ollamaBroChat_';
    const sidebarStateKey = 'ollamaBroSidebarState';
    let availableModels = [];
    let currentAbortController = null; // Track current request for aborting
    let selectedImages = []; // Store selected images for sending

    // Enhanced vision models list with latest models and variations
    const VISION_MODELS = [
        // LLaVA variants
        'llava', 'llava:7b', 'llava:13b', 'llava:34b',
        'llava:7b-v1.6', 'llava:13b-v1.6', 'llava:34b-v1.6',
        'llava-phi', 'llava-phi:3b', 'llava:v1.5-7b', 'llava:v1.5-13b',
        
        // Llama Vision models
        'llama3.2-vision', 'llama3.2-vision:11b', 'llama3.2-vision:90b',
        'llama-vision', 'llama3-vision',
        
        // Other vision models
        'bakllava', 'bakllava:7b',
        'moondream', 'moondream:1.8b', 'moondream2',
        
        // Gemma Vision
        'gemma2-vision', 'gemma-vision', 'gemma3', 'gemma3-vision',
        
        // Qwen Vision
        'qwen2-vl', 'qwen-vl', 'qwen2-vision', 'qwen-vision',
        
        // Other multimodal models
        'minicpm-v', 'minicpm-vision', 'yi-vision', 'cogvlm',
        'internvl', 'deepseek-vl', 'phi3-vision', 'phi-vision'
    ];

    // Enhanced reasoning models list with latest models and coding variants
    const REASONING_MODELS = [
        // Qwen series (excellent reasoning)
        'qwen2.5-coder', 'qwen2.5-coder:1.5b', 'qwen2.5-coder:3b', 'qwen2.5-coder:7b', 'qwen2.5-coder:14b', 'qwen2.5-coder:32b',
        'qwen2.5', 'qwen2.5:0.5b', 'qwen2.5:1.5b', 'qwen2.5:3b', 'qwen2.5:7b', 'qwen2.5:14b', 'qwen2.5:32b', 'qwen2.5:72b',
        'qwen', 'qwen:0.5b', 'qwen:1.8b', 'qwen:4b', 'qwen:7b', 'qwen:14b', 'qwen:32b', 'qwen:72b',
        'qwen-coder', 'qwen2-coder', 'qwen2-instruct',
        
        // DeepSeek series (strong reasoning and coding)
        'deepseek-coder', 'deepseek-coder:1.3b', 'deepseek-coder:6.7b', 'deepseek-coder:33b',
        'deepseek', 'deepseek:1.3b', 'deepseek:6.7b', 'deepseek:33b',
        'deepseek-v2', 'deepseek-v3', 'deepseek-chat', 'deepseek-instruct',
        
        // Code Llama variants
        'codellama', 'codellama:7b', 'codellama:13b', 'codellama:34b',
        'code-llama', 'llama-code', 'codellama-instruct', 'codellama-python',
        
        // Llama 3.x series (good reasoning for larger variants)
        'llama3.1', 'llama3.1:8b', 'llama3.1:70b', 'llama3.1:405b',
        'llama3.2', 'llama3.2:1b', 'llama3.2:3b', 'llama3.2:8b',
        'llama3', 'llama3:8b', 'llama3:70b',
        
        // Mistral series (strong reasoning)
        'mistral', 'mistral:7b', 'mistral-nemo', 'mistral-large',
        'mixtral', 'mixtral:8x7b', 'mixtral:8x22b',
        'codestral', 'codestral:22b',
        
        // Gemma series (reasoning variants)
        'gemma2', 'gemma2:2b', 'gemma2:9b', 'gemma2:27b',
        'gemma', 'gemma:2b', 'gemma:7b',
        'codegemma', 'codegemma:7b',
        
        // Specialized reasoning/thinking models
        'phi3', 'phi3:3.8b', 'phi3:14b', 'phi3-medium', 'phi3-mini',
        'solar', 'solar:10.7b',
        'nous-hermes', 'openhermes', 'wizard', 'wizardcoder',
        'starcoder', 'starcoder2', 'starchat',
        'yi', 'yi:6b', 'yi:34b',
        'openchat', 'orca', 'vicuna'
    ];

    // Cache for model capabilities to avoid repeated API calls
    const modelCapabilitiesCache = new Map();

    // Capability validation and debugging utilities
    function validateAndDebugCapabilities() {
        console.log('[Capability Debug] Current cache state:');
        for (const [modelName, capabilities] of modelCapabilitiesCache.entries()) {
            console.log(`[Capability Debug] ${modelName}:`, {
                vision: capabilities.vision,
                reasoning: capabilities.reasoning,
                source: capabilities.source,
                timestamp: capabilities.timestamp ? new Date(capabilities.timestamp).toISOString() : 'unknown',
                error: capabilities.error || 'none'
            });
        }
        
        // Test some known models
        const testModels = ['llava:7b', 'qwen2.5-coder:7b', 'gemma2:9b', 'llama3.2-vision:11b'];
        console.log('[Capability Debug] Testing known models:');
        testModels.forEach(model => {
            const vision = isVisionModel(model);
            const reasoning = isReasoningModel(model);
            console.log(`[Capability Debug] ${model}: vision=${vision}, reasoning=${reasoning}`);
        });
    }

    function getCacheStats() {
        const stats = {
            total: modelCapabilitiesCache.size,
            apiDetected: 0,
            fallbackDetected: 0,
            withErrors: 0,
            expired: 0
        };
        
        const now = Date.now();
        for (const capabilities of modelCapabilitiesCache.values()) {
            if (capabilities.source === 'api') stats.apiDetected++;
            else if (capabilities.source === 'fallback') stats.fallbackDetected++;
            if (capabilities.error) stats.withErrors++;
            if (capabilities.timestamp && now - capabilities.timestamp > 3600000) stats.expired++;
        }
        
        return stats;
    }

    // Test specific model detection
    async function testModelDetection(modelName) {
        console.log(`[Test] Testing detection for: ${modelName}`);
        
        // Clear cache for this model
        modelCapabilitiesCache.delete(modelName.toLowerCase());
        
        // Test fallback detection first
        const fallbackVision = isVisionModelFallback(modelName);
        const fallbackReasoning = isReasoningModelFallback(modelName);
        console.log(`[Test] Fallback detection: vision=${fallbackVision}, reasoning=${fallbackReasoning}`);
        
        // Test API detection
        try {
            const result = await detectModelCapabilities(modelName);
            console.log(`[Test] API detection result:`, result);
            return result;
        } catch (error) {
            console.log(`[Test] API detection failed:`, error);
            return null;
        }
    }

    // Clear cache for LLaVA models to fix incorrect reasoning classification
    function fixLlavaClassification() {
        const llavaModels = ['llava', 'llava:7b', 'llava:13b', 'llava:34b', 'llava-phi', 'bakllava'];
        llavaModels.forEach(model => {
            modelCapabilitiesCache.delete(model.toLowerCase());
            console.log(`[Fix] Cleared cache for ${model}`);
        });
        console.log('[Fix] LLaVA classification cache cleared. Refresh the page to see updated icons.');
    }

    // Expose debug functions to global scope for console access
    window.ollamaBroDebug = {
        validateCapabilities: validateAndDebugCapabilities,
        getCacheStats: getCacheStats,
        clearCache: () => {
            modelCapabilitiesCache.clear();
            console.log('[Debug] Capability cache cleared');
        },
        forceDetect: (modelName) => {
            modelCapabilitiesCache.delete(modelName.toLowerCase());
            return detectModelCapabilities(modelName);
        },
        testModel: testModelDetection,
        checkPatternMatch: (modelName) => {
            console.log(`[Pattern Test] ${modelName}:`);
            console.log(`  Vision fallback: ${isVisionModelFallback(modelName)}`);
            console.log(`  Reasoning fallback: ${isReasoningModelFallback(modelName)}`);
            console.log(`  isVisionModel() result: ${isVisionModel(modelName)}`);
            console.log(`  isReasoningModel() result: ${isReasoningModel(modelName)}`);
            console.log(`  Current cache:`, modelCapabilitiesCache.get(modelName.toLowerCase()));
            
            // Check if it's in our hardcoded lists
            const inVisionList = VISION_MODELS.some(vm => modelName.toLowerCase().includes(vm.toLowerCase()));
            const inReasoningList = REASONING_MODELS.some(rm => modelName.toLowerCase().includes(rm.toLowerCase()));
            console.log(`  In VISION_MODELS list: ${inVisionList}`);
            console.log(`  In REASONING_MODELS list: ${inReasoningList}`);
        },
        fixLlava: fixLlavaClassification
    };

    function isVisionModel(modelName) {
        if (!modelName) return false;
        const normalizedModel = modelName.toLowerCase();
        
        // Check cache first (handle both old and new cache structure)
        if (modelCapabilitiesCache.has(normalizedModel)) {
            const cached = modelCapabilitiesCache.get(normalizedModel);
            
            // Check if cache entry is expired (older than 1 hour for API-based entries)
            if (cached.timestamp && cached.source === 'api' && 
                Date.now() - cached.timestamp > 3600000) {
                console.log(`[Cache] Expired cache entry for ${modelName}, re-detecting`);
                modelCapabilitiesCache.delete(normalizedModel);
                detectModelCapabilities(modelName);
                // Continue to fallback for immediate response
            } else {
                return cached.vision || false;
            }
        }
        
        // Fallback to pattern matching for immediate response
        const hasVision = VISION_MODELS.some(visionModel => 
            normalizedModel.includes(visionModel.toLowerCase()) ||
            normalizedModel.startsWith(visionModel.toLowerCase()) ||
            // More flexible matching
            normalizedModel.replace(/[:-]/g, '').includes(visionModel.replace(/[:-]/g, '').toLowerCase())
        );
        
        // Trigger async capability detection for future use
        detectModelCapabilities(modelName);
        
        return hasVision;
    }

    function isReasoningModel(modelName) {
        if (!modelName) return false;
        const normalizedModel = modelName.toLowerCase();
        
        // HARD EXCLUSION: LLaVA and other vision models are NOT reasoning models
        if (normalizedModel.includes('llava') || normalizedModel.includes('bakllava') || 
            normalizedModel.includes('moondream') || normalizedModel.includes('minicpm-v') ||
            normalizedModel.includes('-vl') || normalizedModel.includes('vision')) {
            return false;
        }
        
        // Check cache first (handle both old and new cache structure)
        if (modelCapabilitiesCache.has(normalizedModel)) {
            const cached = modelCapabilitiesCache.get(normalizedModel);
            
            // Check if cache entry is expired (older than 1 hour for API-based entries)
            if (cached.timestamp && cached.source === 'api' && 
                Date.now() - cached.timestamp > 3600000) {
                console.log(`[Cache] Expired cache entry for ${modelName}, re-detecting`);
                modelCapabilitiesCache.delete(normalizedModel);
                detectModelCapabilities(modelName);
                // Continue to fallback for immediate response
            } else {
                return cached.reasoning || false;
            }
        }
        
        // Fallback to pattern matching for immediate response
        const hasReasoning = REASONING_MODELS.some(reasoningModel => 
            normalizedModel.includes(reasoningModel.toLowerCase()) ||
            normalizedModel.startsWith(reasoningModel.toLowerCase()) ||
            // More flexible matching
            normalizedModel.replace(/[:-]/g, '').includes(reasoningModel.replace(/[:-]/g, '').toLowerCase())
        );
        
        // Trigger async capability detection for future use
        detectModelCapabilities(modelName);
        
        return hasReasoning;
    }

    // Enhanced smart detection function with retry logic and better error handling
    async function detectModelCapabilities(modelName, retryCount = 0) {
        const maxRetries = 3;
        const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
        
        if (!modelName || modelCapabilitiesCache.has(modelName.toLowerCase())) {
            return modelCapabilitiesCache.get(modelName.toLowerCase()) || null;
        }
        
        console.log(`[Enhanced Detection] Detecting capabilities for ${modelName} (attempt ${retryCount + 1}/${maxRetries + 1})`);
        
        try {
            // Query Ollama for model information with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(`http://localhost:3000/proxy/api/show`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: modelName }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const modelInfo = await response.json();
                
                // Validate that we received meaningful model info
                if (!modelInfo || typeof modelInfo !== 'object') {
                    throw new Error('Invalid model info response');
                }
                
                const capabilities = analyzeModelInfo(modelInfo, modelName);
                
                // Cache the results with timestamp for potential expiration
                modelCapabilitiesCache.set(modelName.toLowerCase(), {
                    ...capabilities,
                    timestamp: Date.now(),
                    source: 'api'
                });
                
                console.log(`[Enhanced Detection] Successfully detected capabilities for ${modelName}:`, capabilities);
                
                // Update UI if this is the current model
                if (modelName === currentModelName) {
                    updateModelDisplay(currentModelName);
                    toggleImageUploadUI(capabilities.vision);
                }
                
                return capabilities;
                
            } else {
                const errorText = await response.text().catch(() => 'Unknown error');
                throw new Error(`API response error: ${response.status} ${errorText}`);
            }
            
        } catch (error) {
            console.log(`[Enhanced Detection] Attempt ${retryCount + 1} failed for ${modelName}:`, error.message);
            
            // Handle specific error types
            if (error.name === 'AbortError') {
                console.log(`[Enhanced Detection] Request timeout for ${modelName}`);
            } else if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
                console.log(`[Enhanced Detection] Network error for ${modelName}`);
            }
            
            // Retry logic with exponential backoff
            if (retryCount < maxRetries && 
                (error.name === 'AbortError' || error.message.includes('NetworkError') || 
                 error.message.includes('500') || error.message.includes('502') || 
                 error.message.includes('503'))) {
                
                console.log(`[Enhanced Detection] Retrying in ${retryDelay}ms for ${modelName}`);
                
                return new Promise(resolve => {
                    setTimeout(async () => {
                        const result = await detectModelCapabilities(modelName, retryCount + 1);
                        resolve(result);
                    }, retryDelay);
                });
            }
            
            // Final fallback to pattern matching after all retries failed
            console.log(`[Enhanced Detection] All retries failed for ${modelName}, using fallback detection`);
            const capabilities = {
                vision: isVisionModelFallback(modelName),
                reasoning: isReasoningModelFallback(modelName),
                timestamp: Date.now(),
                source: 'fallback',
                error: error.message
            };
            
            modelCapabilitiesCache.set(modelName.toLowerCase(), capabilities);
            
            // Update UI if this is the current model
            if (modelName === currentModelName) {
                updateModelDisplay(currentModelName);
                toggleImageUploadUI(capabilities.vision);
            }
            
            return capabilities;
        }
    }

    function analyzeModelInfo(modelInfo, modelName) {
        const name = modelName.toLowerCase();
        const template = (modelInfo.template || '').toLowerCase();
        const system = (modelInfo.system || '').toLowerCase();
        const parameters = JSON.stringify(modelInfo.parameters || {}).toLowerCase();
        const details = JSON.stringify(modelInfo.details || {}).toLowerCase();
        const modelfile = (modelInfo.modelfile || '').toLowerCase();
        
        console.log(`[Enhanced Detection] Analyzing model: ${modelName}`);
        console.log(`[Enhanced Detection] Template: ${template.substring(0, 200)}...`);
        console.log(`[Enhanced Detection] System: ${system.substring(0, 200)}...`);
        console.log(`[Enhanced Detection] Details:`, modelInfo.details);
        console.log(`[Enhanced Detection] Modelfile: ${modelfile.substring(0, 200)}...`);
        
        // Enhanced vision detection
        const vision = detectVisionCapability(modelInfo, name, template, system, parameters, details, modelfile);
        
        // Enhanced reasoning detection  
        const reasoning = detectReasoningCapability(modelInfo, name, template, system, parameters, details, modelfile);
        
        console.log(`[Enhanced Detection] ${modelName} capabilities: vision=${vision}, reasoning=${reasoning}`);
        return { vision, reasoning };
    }

    function detectVisionCapability(modelInfo, name, template, system, parameters, details, modelfile) {
        // 1. Check model architecture families
        if (modelInfo.details && modelInfo.details.families) {
            const families = modelInfo.details.families;
            const hasVisionArch = families.some(family => {
                const f = family.toLowerCase();
                return f.includes('clip') || f.includes('vision') || f.includes('llava') || 
                       f.includes('multimodal') || f.includes('image') || f.includes('gemma') ||
                       f.includes('paligemma') || f.includes('siglip');
            });
            if (hasVisionArch) {
                console.log(`[Vision Detection] Architecture families indicate vision: ${families.join(', ')}`);
                return true;
            }
        }
        
        // 1b. Check for specific architecture types that indicate vision capabilities
        if (modelInfo.details) {
            const architecture = (modelInfo.details.architecture || '').toLowerCase();
            const format = (modelInfo.details.format || '').toLowerCase();
            const parentModel = (modelInfo.details.parent_model || '').toLowerCase();
            
            // Check for vision-specific architectures
            if (architecture.includes('gemma') || architecture.includes('paligemma') ||
                format.includes('vision') || format.includes('multimodal') ||
                parentModel.includes('vision') || parentModel.includes('gemma')) {
                console.log(`[Vision Detection] Architecture details indicate vision: arch=${architecture}, format=${format}, parent=${parentModel}`);
                return true;
            }
        }
        
        // 2. Check for vision-specific template patterns
        const visionTemplatePatterns = [
            'image', 'vision', 'visual', 'photo', 'picture', 'img',
            '<image>', '[img]', 'describe', 'analyze.*image', 'what.*see'
        ];
        const hasVisionTemplate = visionTemplatePatterns.some(pattern => 
            template.includes(pattern) || new RegExp(pattern).test(template)
        );
        if (hasVisionTemplate) {
            console.log(`[Vision Detection] Template contains vision patterns`);
            return true;
        }
        
        // 3. Check system prompt for vision capabilities
        const visionSystemPatterns = [
            'image', 'vision', 'visual', 'multimodal', 'see', 'look', 'analyze.*visual'
        ];
        const hasVisionSystem = visionSystemPatterns.some(pattern => 
            system.includes(pattern) || new RegExp(pattern).test(system)
        );
        if (hasVisionSystem) {
            console.log(`[Vision Detection] System prompt indicates vision capabilities`);
            return true;
        }
        
        // 4. Check model parameters for vision-related configs
        if (parameters.includes('vision') || parameters.includes('image') || 
            parameters.includes('multimodal') || parameters.includes('clip')) {
            console.log(`[Vision Detection] Parameters indicate vision support`);
            return true;
        }
        
        // 5. Check modelfile for vision setup
        if (modelfile.includes('vision') || modelfile.includes('image') || 
            modelfile.includes('multimodal') || modelfile.includes('llava')) {
            console.log(`[Vision Detection] Modelfile indicates vision setup`);
            return true;
        }
        
        // 6. Check for specific model architecture indicators
        if (modelInfo.details) {
            const arch = (modelInfo.details.architecture || '').toLowerCase();
            const format = (modelInfo.details.format || '').toLowerCase();
            
            if (arch.includes('llava') || arch.includes('clip') || 
                format.includes('vision') || format.includes('multimodal')) {
                console.log(`[Vision Detection] Architecture/format indicates vision: ${arch}, ${format}`);
                return true;
            }
        }
        
        // 7. Fallback to enhanced name pattern matching
        return isVisionModelFallback(name);
    }

    function detectReasoningCapability(modelInfo, name, template, system, parameters, details, modelfile) {
        // 1. Check for reasoning-specific template patterns
        const reasoningTemplatePatterns = [
            'think', 'reason', 'step.*step', 'analyze', 'problem.*solving',
            'chain.*thought', 'logical', 'inference', 'deduce', 'conclude',
            '<think>', 'let.*think', 'step.*by.*step'
        ];
        const hasReasoningTemplate = reasoningTemplatePatterns.some(pattern => 
            template.includes(pattern) || new RegExp(pattern).test(template)
        );
        if (hasReasoningTemplate) {
            console.log(`[Reasoning Detection] Template contains reasoning patterns`);
            return true;
        }
        
        // 2. Check system prompt for reasoning instructions
        const reasoningSystemPatterns = [
            'think', 'reason', 'analyze', 'logical', 'step.*by.*step',
            'problem.*solving', 'chain.*of.*thought', 'inference', 'deduce'
        ];
        const hasReasoningSystem = reasoningSystemPatterns.some(pattern => 
            system.includes(pattern) || new RegExp(pattern).test(system)
        );
        if (hasReasoningSystem) {
            console.log(`[Reasoning Detection] System prompt indicates reasoning capabilities`);
            return true;
        }
        
        // 3. Check for coding-specific capabilities
        const codingPatterns = [
            'code', 'programming', 'debug', 'function', 'algorithm',
            'software', 'develop', 'script', 'syntax', 'compile'
        ];
        const hasCodingCapability = codingPatterns.some(pattern => 
            template.includes(pattern) || system.includes(pattern) || 
            new RegExp(pattern).test(template) || new RegExp(pattern).test(system)
        );
        if (hasCodingCapability) {
            console.log(`[Reasoning Detection] Coding capabilities detected`);
            return true;
        }
        
        // 4. Check model size for reasoning capability (large models, but exclude vision-only models)
        if (modelInfo.details && modelInfo.details.parameter_size) {
            const paramSize = parseInt(modelInfo.details.parameter_size);
            
            // Don't classify vision models as reasoning models just because they're large
            const isVisionOnly = name.includes('llava') || name.includes('vision') || 
                                name.includes('minicpm-v') || name.includes('moondream') ||
                                name.includes('bakllava') || name.includes('-vl');
            
            if (paramSize > 7000000000 && !isVisionOnly) { // 7B+ parameters, but not vision-only
                console.log(`[Reasoning Detection] Large model size indicates reasoning: ${paramSize} parameters`);
                return true;
            }
        }
        
        // 5. Check for reasoning-oriented model families
        if (modelInfo.details && modelInfo.details.families) {
            const families = modelInfo.details.families;
            const hasReasoningArch = families.some(family => {
                const f = family.toLowerCase();
                return f.includes('reasoning') || f.includes('think') || 
                       f.includes('chain') || f.includes('cot');
            });
            if (hasReasoningArch) {
                console.log(`[Reasoning Detection] Architecture families indicate reasoning: ${families.join(', ')}`);
                return true;
            }
        }
        
        // 6. Fallback to enhanced name pattern matching
        return isReasoningModelFallback(name);
    }

    function isVisionModelFallback(modelName) {
        const normalizedModel = modelName.toLowerCase();
        
        // Enhanced pattern matching with multiple strategies
        return VISION_MODELS.some(visionModel => {
            const normalizedVisionModel = visionModel.toLowerCase();
            
            // Strategy 1: Direct contains/starts with matching
            if (normalizedModel.includes(normalizedVisionModel) ||
                normalizedModel.startsWith(normalizedVisionModel)) {
                return true;
            }
            
            // Strategy 2: Remove common separators and match
            const cleanModel = normalizedModel.replace(/[:-_.]/g, '');
            const cleanVision = normalizedVisionModel.replace(/[:-_.]/g, '');
            if (cleanModel.includes(cleanVision)) {
                return true;
            }
            
            // Strategy 3: Fuzzy matching for common vision keywords
            const visionKeywords = ['vision', 'visual', 'llava', 'vl', 'multimodal', 'image'];
            if (visionKeywords.some(keyword => 
                normalizedModel.includes(keyword) && normalizedVisionModel.includes(keyword))) {
                return true;
            }
            
            // Strategy 3b: Special case for models that are known to have vision variants
            const visionFamilies = ['gemma3', 'gemma2', 'llama3.2', 'qwen2', 'phi3'];
            if (visionFamilies.some(family => 
                normalizedModel.startsWith(family) && normalizedVisionModel.startsWith(family))) {
                return true;
            }
            
            // Strategy 4: Model family matching (e.g., 'qwen2-vl-7b' matches 'qwen2-vl')
            const baseVisionModel = normalizedVisionModel.split(':')[0]; // Remove size tags
            if (normalizedModel.startsWith(baseVisionModel)) {
                return true;
            }
            
            return false;
        });
    }

    function isReasoningModelFallback(modelName) {
        const normalizedModel = modelName.toLowerCase();
        
        // Enhanced pattern matching with multiple strategies
        return REASONING_MODELS.some(reasoningModel => {
            const normalizedReasoningModel = reasoningModel.toLowerCase();
            
            // Strategy 1: Direct contains/starts with matching
            if (normalizedModel.includes(normalizedReasoningModel) ||
                normalizedModel.startsWith(normalizedReasoningModel)) {
                return true;
            }
            
            // Strategy 2: Remove common separators and match
            const cleanModel = normalizedModel.replace(/[:-_.]/g, '');
            const cleanReasoning = normalizedReasoningModel.replace(/[:-_.]/g, '');
            if (cleanModel.includes(cleanReasoning)) {
                return true;
            }
            
            // Strategy 3: Fuzzy matching for common reasoning keywords
            const reasoningKeywords = ['coder', 'code', 'reasoning', 'think', 'instruct', 'chat'];
            if (reasoningKeywords.some(keyword => 
                normalizedModel.includes(keyword) && normalizedReasoningModel.includes(keyword))) {
                return true;
            }
            
            // Strategy 4: Model family matching (e.g., 'qwen2.5-coder-32b' matches 'qwen2.5-coder')
            const baseReasoningModel = normalizedReasoningModel.split(':')[0]; // Remove size tags
            if (normalizedModel.startsWith(baseReasoningModel)) {
                return true;
            }
            
            // Strategy 5: Size-based reasoning (only for non-vision models)
            const sizePatterns = [':70b', ':72b', ':34b', ':32b', ':14b'];
            const isVisionOnly = normalizedModel.includes('llava') || normalizedModel.includes('vision') || 
                                normalizedModel.includes('minicpm-v') || normalizedModel.includes('moondream') ||
                                normalizedModel.includes('bakllava') || normalizedModel.includes('-vl');
            
            if (!isVisionOnly && sizePatterns.some(size => normalizedModel.includes(size))) {
                return true;
            }
            
            return false;
        });
    }

    function getModelCapabilityIcons(modelName) {
        const icons = [];
        if (isVisionModel(modelName)) {
            icons.push({
                type: 'vision',
                svg: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/><path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/></svg>',
                title: 'Vision model - supports image input'
            });
        }
        if (isReasoningModel(modelName)) {
            icons.push({
                type: 'reasoning',
                svg: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M2 6a6 6 0 1 1 10.174 4.31c-.203.196-.359.4-.453.619l-.762 1.769A.5.5 0 0 1 10.5 13a.5.5 0 0 1 0 1 .5.5 0 0 1 0 1l-.224.447a1 1 0 0 1-.894.553H6.618a1 1 0 0 1-.894-.553L5.5 15a.5.5 0 0 1 0-1 .5.5 0 0 1 0-1 .5.5 0 0 1-.459-.31l-.762-1.77a1.964 1.964 0 0 0-.453-.618A6 6 0 0 1 2 6zm6-5a5 5 0 0 0-3.479 8.592c.263.254.514.564.676.941L5.83 12h4.342l.632-1.467c.162-.377.413-.687.676-.941A5 5 0 0 0 8 1z"/></svg>',
                title: 'Reasoning model - optimized for complex thinking'
            });
        }
        return icons;
    }

    function toggleImageUploadUI(show) {
        if (imageButton) {
            imageButton.style.display = show ? 'flex' : 'none';
        }
    }

    function updateModelDisplay(modelName) {
        // Clear previous content
        modelNameDisplay.innerHTML = '';
        
        // Create container for text and icons
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.gap = 'var(--spacing-xs)';
        
        // Add model name text
        const textSpan = document.createElement('span');
        textSpan.textContent = `Chatting with: ${decodeURIComponent(modelName)}`;
        container.appendChild(textSpan);
        
        // Add capability icons
        const capabilityIcons = getModelCapabilityIcons(modelName);
        if (capabilityIcons.length > 0) {
            const iconsContainer = document.createElement('div');
            iconsContainer.classList.add('model-capabilities');
            
            capabilityIcons.forEach(iconData => {
                const iconSpan = document.createElement('span');
                iconSpan.classList.add('capability-icon', iconData.type);
                iconSpan.innerHTML = iconData.svg;
                iconSpan.title = iconData.title;
                iconsContainer.appendChild(iconSpan);
            });
            
            container.appendChild(iconsContainer);
        }
        
        modelNameDisplay.appendChild(container);
    }

    function getModelStorageKey(model) {
        const key = `${storageKeyPrefix}${model.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
        console.log('[OllamaBro] getModelStorageKey - Model:', model, 'Generated Key:', key);
        return key;
    }

    async function loadModelChatState(modelToLoad) {
        console.log('[OllamaBro] loadModelChatState - Attempting to load for model:', modelToLoad);
        if (!chrome.storage || !chrome.storage.local) {
            console.warn('Chrome storage API not available.');
            return { conversations: {}, activeConversationId: null };
        }
        try {
            const key = getModelStorageKey(modelToLoad); // Key generation will also log
            const storageResult = await chrome.storage.local.get(key);
            console.log('[OllamaBro] loadModelChatState - Key used:', key, 'Data loaded from storage:', storageResult);

            let modelSpecificData = storageResult[key];

            if (modelSpecificData && typeof modelSpecificData === 'object') {
                // Data exists and is an object, proceed with checks
                // Ensure a deep copy for logging to avoid showing mutated object if it's referenced elsewhere
                try {
                    console.log(`Raw chat state loaded for ${modelToLoad}:`, JSON.parse(JSON.stringify(modelSpecificData)));
                } catch (e) {
                    console.warn(`[OllamaBro] loadModelChatState - Could not stringify modelSpecificData for logging for model ${modelToLoad}:`, modelSpecificData);
                }

                if (typeof modelSpecificData.conversations !== 'object' || modelSpecificData.conversations === null) {
                    console.warn(`[OllamaBro] loadModelChatState - 'conversations' property missing or not an object for model ${modelToLoad}. Initializing.`);
                    modelSpecificData.conversations = {};
                }
                if (typeof modelSpecificData.activeConversationId === 'undefined') {
                    console.warn(`[OllamaBro] loadModelChatState - 'activeConversationId' property missing for model ${modelToLoad}. Initializing to null.`);
                    modelSpecificData.activeConversationId = null;
                }
                return modelSpecificData;
            } else if (modelSpecificData) {
                // Data exists but is NOT an object (e.g., string, number, boolean due to corruption)
                console.warn(`[OllamaBro] loadModelChatState - Data for model ${modelToLoad} is not an object:`, modelSpecificData, ". Resetting to default structure.");
                return { conversations: {}, activeConversationId: null }; // Return default structure
            }
            // modelSpecificData is null or undefined (no data for this key)
            console.log(`[OllamaBro] loadModelChatState - No data found for ${modelToLoad}. Returning default structure.`);
            return { conversations: {}, activeConversationId: null }; // Default if nothing stored
        } catch (error) {
            console.error('Error loading chat state:', error);
            return { conversations: {}, activeConversationId: null };
        }
    }

    async function saveModelChatState(modelToSave, modelData) {
        console.log('[OllamaBro] saveModelChatState - Attempting to save for model:', modelToSave, 'Data:', modelData);
        if (!chrome.storage || !chrome.storage.local) {
            console.warn('Chrome storage API not available.');
            return;
        }
        try {
            const key = getModelStorageKey(modelToSave); // Key generation will also log
            await chrome.storage.local.set({ [key]: modelData });
            console.log('[OllamaBro] saveModelChatState - Key used:', key, 'Save successful.');
            console.log(`Chat state saved for ${modelToSave}`);
        } catch (error) {
            console.error('Error saving chat state:', error);
        }
    }

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function getConversationSummary(messages) {
        if (!messages || messages.length === 0) return 'New Chat';
        const firstUserMessage = messages.find(msg => msg.role === 'user');
        return firstUserMessage ? firstUserMessage.content.substring(0, 40) : 'Chat'; // Max 40 chars for summary
    }

    function getCurrentConversationMessages(modelData) {
        if (modelData && modelData.activeConversationId && modelData.conversations && modelData.conversations[modelData.activeConversationId]) {
            return modelData.conversations[modelData.activeConversationId].messages || [];
        }
        return [];
    }

    function generateFilename(extension, modelName, messages) {
        const now = new Date();
        const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
        const summary = getConversationSummary(messages).replace(/[^a-zA-Z0-9_\-\.]/g, '_').substring(0, 30) || 'chat';
        const cleanModelName = modelName.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
        return `${summary}_${cleanModelName}_${timestamp}.${extension}`;
    }

    async function copyToClipboard(text, buttonElement) {
        try {
            await navigator.clipboard.writeText(text);
            if (buttonElement) {
                const originalInnerHTML = buttonElement.innerHTML;
                buttonElement.textContent = 'Copied!';
                buttonElement.disabled = true;
                setTimeout(() => {
                    buttonElement.innerHTML = originalInnerHTML;
                    buttonElement.disabled = false;
                }, 1500);
            }
        } catch (err) {
            console.error('Failed to copy text: ', err);
            if (buttonElement) {
                const originalInnerHTML = buttonElement.innerHTML;
                buttonElement.textContent = 'Error';
                setTimeout(() => {
                    buttonElement.innerHTML = originalInnerHTML;
                }, 1500);
            }
        }
    }

    function downloadMessage(text, filename, mimeType) {
        const blob = new Blob([text], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function parseAndStyleThinking(text) {
        const fragment = document.createDocumentFragment();
        // Ensure text is a string; treat null/undefined as empty string
        if (typeof text !== 'string' || text === null) {
            if (text === null || typeof text === 'undefined') text = '';
            else text = String(text);
        }

        const regex = /<\s*think\s*>([\s\S]*?)<\/\s*think\s*>/gi; // Handles raw <think> tags, case-insensitive, allows spaces
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Add text before the <think> tag
            if (match.index > lastIndex) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
            }
            // Add the <think> content, styled
            const thinkingSpan = document.createElement('span');
            thinkingSpan.className = 'thinking-block';
            thinkingSpan.textContent = match[1]; // Content between <think> and </think>
            fragment.appendChild(thinkingSpan);
            lastIndex = regex.lastIndex;
        }

        // Add any remaining text after the last </think>
        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }
        return fragment;
    }

    // Image processing functions
    function validateImageFile(file) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 20 * 1024 * 1024; // 20MB limit
        
        if (!allowedTypes.includes(file.type)) {
            throw new Error(`Unsupported file type: ${file.type}. Supported types: JPEG, PNG, GIF, WebP`);
        }
        
        if (file.size > maxSize) {
            throw new Error(`File too large: ${(file.size / (1024 * 1024)).toFixed(1)}MB. Maximum size: 20MB`);
        }
        
        return true;
    }

    async function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Remove the data:image/...;base64, prefix
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    async function compressImage(file, maxWidth = 1024, maxHeight = 1024, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // Calculate new dimensions while maintaining aspect ratio
                let { width, height } = img;
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(resolve, file.type, quality);
            };
            
            img.onerror = () => reject(new Error('Failed to load image for compression'));
            img.src = URL.createObjectURL(file);
        });
    }

    async function processImageForUpload(file) {
        try {
            validateImageFile(file);
            
            // Compress if the file is large
            let processedFile = file;
            if (file.size > 2 * 1024 * 1024) { // Compress files larger than 2MB
                processedFile = await compressImage(file);
            }
            
            const base64 = await fileToBase64(processedFile);
            const previewUrl = URL.createObjectURL(processedFile);
            
            return {
                base64,
                previewUrl,
                fileName: file.name,
                fileSize: processedFile.size,
                fileType: file.type
            };
        } catch (error) {
            console.error('Error processing image:', error);
            throw error;
        }
    }

    function addImageToPreview(imageData, index) {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'image-preview';
        previewDiv.dataset.index = index;
        
        const img = document.createElement('img');
        img.src = imageData.previewUrl;
        img.alt = imageData.fileName;
        
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-image';
        removeButton.innerHTML = '×';
        removeButton.title = 'Remove image';
        removeButton.addEventListener('click', () => removeImageFromPreview(index));
        
        previewDiv.appendChild(img);
        previewDiv.appendChild(removeButton);
        imagePreviewArea.appendChild(previewDiv);
        
        updatePreviewAreaVisibility();
    }

    function removeImageFromPreview(index) {
        // Clean up the preview URL to prevent memory leaks
        if (selectedImages[index] && selectedImages[index].previewUrl) {
            URL.revokeObjectURL(selectedImages[index].previewUrl);
        }
        
        selectedImages.splice(index, 1);
        refreshImagePreview();
    }

    function refreshImagePreview() {
        imagePreviewArea.innerHTML = '';
        selectedImages.forEach((imageData, index) => {
            addImageToPreview(imageData, index);
        });
        updatePreviewAreaVisibility();
    }

    function updatePreviewAreaVisibility() {
        if (selectedImages.length > 0) {
            imagePreviewArea.style.display = 'flex';
        } else {
            imagePreviewArea.style.display = 'none';
        }
    }

    function clearSelectedImages() {
        // Clean up preview URLs
        selectedImages.forEach(imageData => {
            if (imageData.previewUrl) {
                URL.revokeObjectURL(imageData.previewUrl);
            }
        });
        selectedImages = [];
        imagePreviewArea.innerHTML = '';
        updatePreviewAreaVisibility();
    }

    async function handleImageFiles(files) {
        for (const file of files) {
            try {
                const imageData = await processImageForUpload(file);
                selectedImages.push(imageData);
                addImageToPreview(imageData, selectedImages.length - 1);
            } catch (error) {
                alert(`Error processing image "${file.name}": ${error.message}`);
            }
        }
    }

    function addMessageToChatUI(sender, initialText, messageClass, modelDataForFilename, images = null) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', messageClass);

        // Sender name (You or Model Name)
        const senderDiv = document.createElement('div');
        senderDiv.classList.add('message-sender');
        senderDiv.textContent = sender;
        messageDiv.appendChild(senderDiv);

        // Add images if present (for user messages)
        if (images && images.length > 0) {
            const imagesContainer = document.createElement('div');
            imagesContainer.classList.add('message-images');
            images.forEach(imageData => {
                const img = document.createElement('img');
                img.src = `data:${imageData.fileType};base64,${imageData.base64}`;
                img.alt = imageData.fileName || 'Uploaded image';
                img.classList.add('message-image');
                imagesContainer.appendChild(img);
            });
            messageDiv.appendChild(imagesContainer);
        }

        // Message text content wrapper
        const textContentDiv = document.createElement('div');
        textContentDiv.classList.add('message-text-content'); 
        if (messageClass === 'bot-message') {
            // Ensure initialText is treated as a string, even if null or undefined, before parsing
            const textToParse = (initialText === null || typeof initialText === 'undefined') ? '' : String(initialText);
            const fragment = parseAndStyleThinking(textToParse);
            textContentDiv.appendChild(fragment);
            textContentDiv.dataset.fullMessage = textToParse; // Initialize dataset for consistency
        } else {
            textContentDiv.textContent = initialText; // User messages don't need parsing for <think> tags
        }
        messageDiv.appendChild(textContentDiv);

        if (messageClass === 'bot-message') {
            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('message-actions');

            // Copy Button
            const copyButton = document.createElement('button');
            copyButton.classList.add('action-button', 'copy-button');
            copyButton.title = 'Copy to clipboard';

            const svgCopyIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgCopyIcon.setAttribute('viewBox', '0 0 24 24');
            svgCopyIcon.setAttribute('fill', 'currentColor');
            svgCopyIcon.setAttribute('width', '18'); 
            svgCopyIcon.setAttribute('height', '18');

            const pathCopy = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathCopy.setAttribute('d', 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z');

            svgCopyIcon.appendChild(pathCopy);
            copyButton.appendChild(svgCopyIcon);

            copyButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent message click if any
                copyToClipboard(textContentDiv.textContent, copyButton);
            });
            actionsDiv.appendChild(copyButton);

            // Download TXT Button
            const downloadTxtButton = document.createElement('button');
            downloadTxtButton.classList.add('action-button', 'download-txt-button');
            downloadTxtButton.title = 'Download as .txt';

            const svgTxtIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgTxtIcon.setAttribute('viewBox', '0 0 24 24');
            svgTxtIcon.setAttribute('fill', 'currentColor');
            svgTxtIcon.setAttribute('width', '18');
            svgTxtIcon.setAttribute('height', '18');

            const pathTxt = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathTxt.setAttribute('d', 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z');

            svgTxtIcon.appendChild(pathTxt);
            downloadTxtButton.appendChild(svgTxtIcon);

            downloadTxtButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                const currentMessages = getCurrentConversationMessages(await loadModelChatState(currentModelName));
                const filename = generateFilename('txt', currentModelName, currentMessages);
                downloadMessage(textContentDiv.textContent, filename, 'text/plain;charset=utf-8');
            });
            actionsDiv.appendChild(downloadTxtButton);

            // Download MD Button
            const downloadMdButton = document.createElement('button');
            downloadMdButton.classList.add('action-button', 'download-md-button');
            downloadMdButton.title = 'Download as .md';

            const svgMdIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgMdIcon.setAttribute('viewBox', '0 0 24 24');
            svgMdIcon.setAttribute('fill', 'currentColor');
            svgMdIcon.setAttribute('width', '18');
            svgMdIcon.setAttribute('height', '18');

            const pathMd = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathMd.setAttribute('d', 'M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z');

            svgMdIcon.appendChild(pathMd);
            downloadMdButton.appendChild(svgMdIcon);

            downloadMdButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                const currentMessages = getCurrentConversationMessages(await loadModelChatState(currentModelName));
                const filename = generateFilename('md', currentModelName, currentMessages);
                // Basic MD: just the text. Could be enhanced to include sender.
                const mdContent = `## ${sender}\n\n${textContentDiv.textContent}`;
                downloadMessage(mdContent, filename, 'text/markdown;charset=utf-utf-8');
            });
            actionsDiv.appendChild(downloadMdButton);

            // Stop Button (only show during streaming)
            const stopButton = document.createElement('button');
            stopButton.classList.add('action-button', 'stop-button');
            stopButton.title = 'Stop generation';
            stopButton.style.display = 'none'; // Hidden by default

            const svgStopIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgStopIcon.setAttribute('viewBox', '0 0 24 24');
            svgStopIcon.setAttribute('fill', 'currentColor');
            svgStopIcon.setAttribute('width', '18');
            svgStopIcon.setAttribute('height', '18');

            const pathStop = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathStop.setAttribute('d', 'M6 6h12v12H6z');

            svgStopIcon.appendChild(pathStop);
            stopButton.appendChild(svgStopIcon);

            stopButton.addEventListener('click', (e) => {
                e.stopPropagation();
                if (currentAbortController) {
                    currentAbortController.abort();
                    stopButton.style.display = 'none';
                }
            });
            actionsDiv.appendChild(stopButton);

            // Store reference to stop button for later use
            messageDiv.stopButton = stopButton;

            messageDiv.appendChild(actionsDiv);
        }

        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        return textContentDiv; // Return the element where text is displayed for streaming
    }

    function updateBotMessageInUI(botTextElement, newContentChunk) {
        const previousRawFullText = botTextElement.dataset.fullMessage || ''; // Get raw from previous step
        const currentRawFullText = previousRawFullText + newContentChunk; // Accumulate raw
        
        // Clear existing content and apply parsing to the whole updated text
        botTextElement.innerHTML = ''; // Clear previous spans/text nodes
        const fragment = parseAndStyleThinking(currentRawFullText); // Parse accumulated raw
        botTextElement.appendChild(fragment);
        
        // Store the full accumulated raw message content (with tags) in the botTextElement's data attribute
        botTextElement.dataset.fullMessage = currentRawFullText; 

        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function displayConversationMessages(modelData, conversationId) {
        chatContainer.innerHTML = ''; // Clear current messages
        if (modelData.conversations[conversationId] && modelData.conversations[conversationId].messages) {
            modelData.conversations[conversationId].messages.forEach(msg => {
                addMessageToChatUI(
                    msg.role === 'user' ? 'You' : currentModelName, 
                    msg.content, 
                    msg.role === 'user' ? 'user-message' : 'bot-message', 
                    modelData,
                    msg.images // Pass images if present
                );
            });
        } else {
             addMessageToChatUI(currentModelName, `Hello! Start a new conversation with ${decodeURIComponent(currentModelName)}.`, 'bot-message', modelData);
        }
    }

    async function startNewConversation(modelForNewChat = currentModelName) {
        console.log(`Starting new conversation for model: ${modelForNewChat}`);
        let modelData = await loadModelChatState(modelForNewChat);
        const newConversationId = generateUUID();
        modelData.conversations[newConversationId] = {
            id: newConversationId,
            messages: [],
            summary: 'New Chat',
            lastMessageTime: Date.now()
        };
        modelData.activeConversationId = newConversationId;
        await saveModelChatState(modelForNewChat, modelData);
        displayConversationMessages(modelData, newConversationId);
        populateConversationSidebar(modelForNewChat, modelData);
        messageInput.focus();
        return newConversationId;
    }

    async function switchActiveConversation(modelToSwitch, newConversationId) {
        console.log(`Switching to conversation ${newConversationId} for model ${modelToSwitch}`);
        let modelData = await loadModelChatState(modelToSwitch);
        if (modelData.conversations[newConversationId]) {
            modelData.activeConversationId = newConversationId;
            await saveModelChatState(modelToSwitch, modelData);
            displayConversationMessages(modelData, newConversationId);
            populateConversationSidebar(modelToSwitch, modelData); // Refresh sidebar to highlight active
        } else {
            console.warn(`Conversation ${newConversationId} not found for model ${modelToSwitch}. Starting new one.`);
            await startNewConversation(modelToSwitch);
        }
        messageInput.focus();
    }

    async function handleDeleteConversation(modelOfConversation, conversationIdToDelete) {
        if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
            return;
        }
        console.log(`Deleting conversation ${conversationIdToDelete} for model ${modelOfConversation}`);
        let modelData = await loadModelChatState(modelOfConversation);
        if (modelData.conversations[conversationIdToDelete]) {
            delete modelData.conversations[conversationIdToDelete];
            if (modelData.activeConversationId === conversationIdToDelete) {
                modelData.activeConversationId = null;
                const remainingConvIds = Object.keys(modelData.conversations);
                if (remainingConvIds.length > 0) {
                    // Switch to the most recent remaining conversation
                    const sortedRemaining = remainingConvIds.map(id => modelData.conversations[id])
                                                      .sort((a, b) => b.lastMessageTime - a.lastMessageTime);
                    modelData.activeConversationId = sortedRemaining[0].id;
                    await saveModelChatState(modelOfConversation, modelData);
                    switchActiveConversation(modelOfConversation, modelData.activeConversationId);
                } else {
                    await saveModelChatState(modelOfConversation, modelData); // Save cleared activeId
                    await startNewConversation(modelOfConversation); // No convs left, start a new one
                }
            } else {
                await saveModelChatState(modelOfConversation, modelData);
                populateConversationSidebar(modelOfConversation, modelData); // Just refresh sidebar if deleted conv wasn't active
            }
        } else {
            console.warn(`Conversation ${conversationIdToDelete} not found for deletion.`);
        }
    }

    function populateConversationSidebar(modelForSidebar, modelData) {
        conversationList.innerHTML = ''; // Clear existing items
        if (!modelData || !modelData.conversations) return;

        const sortedConversations = Object.values(modelData.conversations)
            .sort((a, b) => b.lastMessageTime - a.lastMessageTime); // Newest first

        sortedConversations.forEach(conv => {
            const item = document.createElement('div');
            item.classList.add('conversation-item');
            item.dataset.conversationId = conv.id;
            if (conv.id === modelData.activeConversationId) {
                item.classList.add('active');
            }

            const titleSpan = document.createElement('span');
            titleSpan.classList.add('conversation-item-title');
            titleSpan.textContent = conv.summary || 'Chat';
            titleSpan.title = conv.summary || 'Chat'; // Tooltip for full title

            const deleteButton = document.createElement('button');
            deleteButton.classList.add('delete-conversation-button');
            deleteButton.innerHTML = '&#x1F5D1;'; // Trash can icon
            deleteButton.title = 'Delete chat';
            deleteButton.dataset.conversationId = conv.id;

            item.appendChild(titleSpan);
            item.appendChild(deleteButton);
            conversationList.appendChild(item);

            item.addEventListener('click', (e) => {
                if (e.target === deleteButton || deleteButton.contains(e.target)) return; // Don't switch if delete is clicked
                switchActiveConversation(modelForSidebar, conv.id);
            });
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent item click event
                handleDeleteConversation(modelForSidebar, conv.id);
            });
        });
    }

    async function sendMessageToOllama(prompt) {
        if (!prompt || prompt.trim() === '') return;

        // Check if trying to send images to a non-vision model
        if (selectedImages.length > 0 && !isVisionModel(currentModelName)) {
            alert(`The model "${currentModelName}" doesn't support images. Please select a vision model like LLaVA or remove the images.`);
            return;
        }

        let modelData = await loadModelChatState(currentModelName);
        if (!modelData.activeConversationId || !modelData.conversations[modelData.activeConversationId]) {
            console.warn('No active or valid conversation found, attempting to start a new one.');
            await startNewConversation(currentModelName);
            modelData = await loadModelChatState(currentModelName);
            if (!modelData.activeConversationId || !modelData.conversations[modelData.activeConversationId]) {
                console.error('Failed to start or find an active conversation after attempting to create one.');
                addMessageToChatUI('System', 'Error: Could not establish an active conversation. Please try refreshing or creating a new chat manually.', 'error-message', modelData);
                return;
            }
        }
        const activeConvId = modelData.activeConversationId;
        const currentConversation = modelData.conversations[activeConvId];

        // Prepare user message with images if any
        const userMessage = { role: 'user', content: prompt };
        if (selectedImages.length > 0) {
            userMessage.images = selectedImages.map(img => ({
                base64: img.base64,
                fileName: img.fileName,
                fileType: img.fileType
            }));
        }

        // Add user message to UI and save state
        addMessageToChatUI('You', prompt, 'user-message', modelData, userMessage.images);
        currentConversation.messages.push(userMessage);
        currentConversation.summary = getConversationSummary(currentConversation.messages);
        currentConversation.lastMessageTime = Date.now();
        // Do not save yet, save after bot response or error

        messageInput.value = '';
        clearSelectedImages(); // Clear images after sending
        // Only show loading indicator when actually sending a request
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
        messageInput.disabled = true;
        sendButton.disabled = true;

        const botTextElement = addMessageToChatUI(currentModelName, '', 'bot-message', modelData);
        const botMessageDiv = botTextElement.parentElement;
        const stopButton = botMessageDiv.stopButton;

        // Create AbortController for this request
        currentAbortController = new AbortController();
        
        // Show stop button during streaming
        if (stopButton) {
            stopButton.style.display = 'flex';
        }

        try {
            console.log(`Sending to /proxy/api/chat with model: ${currentModelName} for streaming.`);
            
            // Prepare messages for API - convert image data for Ollama format
            const apiMessages = currentConversation.messages
                .filter(m => m.role === 'user' || m.role === 'assistant')
                .map(message => {
                    const apiMessage = {
                        role: message.role,
                        content: message.content
                    };
                    
                    // Add images if present (only for user messages)
                    if (message.role === 'user' && message.images && message.images.length > 0) {
                        apiMessage.images = message.images.map(img => img.base64);
                    }
                    
                    return apiMessage;
                });

            const requestBody = {
                model: currentModelName,
                messages: apiMessages,
                stream: true
            };

            console.log('Request body for Ollama:', JSON.stringify(requestBody, null, 2));

            const response = await fetch('http://localhost:3000/proxy/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: currentAbortController.signal // Add abort signal
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Failed to get error text from non-OK response.');
                console.error('Ollama API Error (stream):', response.status, errorText);
                throw new Error(`Ollama API Error: ${response.status} ${errorText || response.statusText}`);
            }

            if (!response.body) {
                throw new Error('ReadableStream not available in response body.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let done = false;

            console.log('Starting to read stream...');
            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    const chunk = decoder.decode(value, { stream: true });
                    console.log('Raw chunk from stream:', chunk); // Log raw chunk
                    const jsonResponses = chunk.split('\n').filter(Boolean);
                    jsonResponses.forEach(jsonStr => {
                        console.log('Processing JSON string:', jsonStr); // Log JSON string before parsing
                        try {
                            const jsonResponse = JSON.parse(jsonStr);
                            console.log('Parsed JSON response:', jsonResponse); // Log parsed object

                            if (jsonResponse.message && typeof jsonResponse.message.content === 'string') {
                                console.log('Extracted text (jsonResponse.message.content):', jsonResponse.message.content);
                                updateBotMessageInUI(botTextElement, jsonResponse.message.content);
                            } else {
                                console.log('jsonResponse.message.content is missing, not a string, or message object itself is missing.');
                                // It's possible for 'done' messages to have no content, which is fine.
                                if (!jsonResponse.done) {
                                     console.warn('Received a non-done chunk without message.content text.');
                                }
                            }

                            if (jsonResponse.done) {
                                console.log('Stream finished by Ollama (jsonResponse.done is true)');
                                done = true;
                                // Hide stop button when streaming is complete
                                if (stopButton) {
                                    stopButton.style.display = 'none';
                                }
                            }
                        } catch (e) {
                            console.warn('Failed to parse JSON chunk from stream:', jsonStr, e);
                        }
                    });
                }
            }
            console.log('Stream reading complete.');

            const finalBotMessageToSave = botTextElement.dataset.fullMessage || botTextElement.textContent; // Fallback to textContent if dataset is somehow not set
            currentConversation.messages.push({ role: 'assistant', content: finalBotMessageToSave });
            currentConversation.summary = getConversationSummary(currentConversation.messages);
            currentConversation.lastMessageTime = Date.now();

        } catch (error) {
            console.error('Error sending message to Ollama or processing stream:', error);
            let errorMessage = 'Error communicating with the model. Please check the proxy server and Ollama status.';
            
            // Handle AbortError specifically
            if (error.name === 'AbortError') {
                errorMessage = 'Request was stopped by user.';
                console.log('Request aborted by user');
            } else if (error.message && error.message.includes('Ollama API Error')) {
                errorMessage = error.message;
                
                // Handle vision model specific errors
                if (selectedImages.length > 0 && (
                    error.message.includes('exit status 2') || 
                    error.message.includes('runner process has terminated') ||
                    error.message.includes('500')
                )) {
                    errorMessage = `This model (${currentModelName}) may not support images. Try a vision model like LLaVA instead.`;
                    console.warn(`[Vision Error] Model ${currentModelName} failed with images:`, error.message);
                    
                    // Update cache to mark this model as non-vision
                    const normalizedModel = currentModelName.toLowerCase();
                    const existingCapabilities = modelCapabilitiesCache.get(normalizedModel) || {};
                    modelCapabilitiesCache.set(normalizedModel, {
                        ...existingCapabilities,
                        vision: false
                    });
                    
                    // Update UI to reflect corrected capabilities
                    updateModelDisplay(currentModelName);
                    toggleImageUploadUI(false);
                }
            }
            
            updateBotMessageInUI(botTextElement, `\n\n[Error: ${errorMessage}]`);
            // Get the current content from the botTextElement to avoid using undefined variables
            const currentBotContent = botTextElement.dataset.fullMessage || botTextElement.textContent || '';
            currentConversation.messages.push({ role: 'assistant', content: currentBotContent + `\n\n[Error: ${errorMessage}]` }); 
            currentConversation.lastMessageTime = Date.now();
        } finally {
            console.log('sendMessageToOllama finally block completed');
            
            // Hide stop button and clear abort controller
            if (stopButton) {
                stopButton.style.display = 'none';
            }
            currentAbortController = null;
            
            // Always hide the loading indicator when done, with null check
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.focus();
            
            await saveModelChatState(currentModelName, modelData);
            populateConversationSidebar(currentModelName, modelData); 
            console.log('UI unlocked, state saved, sidebar repopulated in finally block.');
        }
    }


    async function clearAllConversationsForModel(modelToClear) {
        if (!confirm(`Are you sure you want to clear ALL chat history for ${decodeURIComponent(modelToClear)}? This action cannot be undone.`)) {
            return;
        }
        console.log(`Clearing all conversations for model: ${modelToClear}`);
        let modelData = { conversations: {}, activeConversationId: null };
        await saveModelChatState(modelToClear, modelData);
        await startNewConversation(modelToClear); // This will also update UI and sidebar
    }

    async function switchModel(newModelName) {
        const oldModelName = currentModelName;
        if (newModelName === oldModelName) return;
        console.log('[OllamaBro] switchModel - Switching from:', oldModelName, 'to:', newModelName);
        console.log(`Switching model to: ${newModelName}`);
        currentModelName = newModelName;
        updateModelDisplay(currentModelName);
        
        // Clear any selected images when switching models
        clearSelectedImages();
        
        // Show/hide image upload UI based on model capabilities
        toggleImageUploadUI(isVisionModel(currentModelName));
        
        let modelData = await loadModelChatState(currentModelName);
        if (!modelData.activeConversationId || !modelData.conversations[modelData.activeConversationId]) {
            await startNewConversation(currentModelName); // Start new if no active or no convs
        } else {
            displayConversationMessages(modelData, modelData.activeConversationId);
            populateConversationSidebar(currentModelName, modelData);
        }
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    }

    async function fetchAvailableModels() {
        if (availableModels.length > 0) return availableModels;
        const proxyUrl = 'http://localhost:3000/proxy/api/tags';
        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                console.error('Failed to fetch models:', response.status, await response.text());
                return [];
            }
            const data = await response.json();
            availableModels = data.models ? data.models.map(m => m.name) : [];
            
            // Pre-populate capabilities cache for faster detection with throttling
            if (availableModels.length > 0) {
                console.log('[Enhanced Detection] Pre-populating capabilities for', availableModels.length, 'models...');
                
                // Throttle detection to avoid overwhelming the API
                const batchSize = 3; // Process 3 models at a time
                const delay = 500; // 500ms delay between batches
                
                for (let i = 0; i < availableModels.length; i += batchSize) {
                    const batch = availableModels.slice(i, i + batchSize);
                    setTimeout(() => {
                        batch.forEach(modelName => {
                            // Trigger async detection for each model (but don't wait)
                            detectModelCapabilities(modelName);
                        });
                    }, (i / batchSize) * delay);
                }
            }
            
            return availableModels;
        } catch (error) {
            console.error('Error fetching available models:', error);
            return [];
        }
    }

    function populateModelDropdown(models, currentModel) {
        modelSwitcherDropdown.innerHTML = ''; // Clear previous items
        const ul = document.createElement('ul');

        if (models.length === 0) {
            const noModelsItem = document.createElement('li');
            noModelsItem.textContent = 'No models found.';
            noModelsItem.classList.add('model-dropdown-item', 'no-models'); // Add a class for styling if needed
            ul.appendChild(noModelsItem);
            modelSwitcherDropdown.appendChild(ul);
            return;
        }

        models.forEach(mName => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = '#';
            
            // Create model name container
            const modelNameContainer = document.createElement('div');
            modelNameContainer.style.display = 'flex';
            modelNameContainer.style.alignItems = 'center';
            modelNameContainer.style.justifyContent = 'space-between';
            modelNameContainer.style.width = '100%';
            
            const modelNameSpan = document.createElement('span');
            modelNameSpan.textContent = mName;
            modelNameContainer.appendChild(modelNameSpan);
            
            // Add capability icons
            const capabilityIcons = getModelCapabilityIcons(mName);
            if (capabilityIcons.length > 0) {
                const iconsContainer = document.createElement('div');
                iconsContainer.classList.add('model-capabilities');
                
                capabilityIcons.forEach(iconData => {
                    const iconSpan = document.createElement('span');
                    iconSpan.classList.add('capability-icon', iconData.type);
                    iconSpan.innerHTML = iconData.svg;
                    iconSpan.title = iconData.title;
                    iconsContainer.appendChild(iconSpan);
                });
                
                modelNameContainer.appendChild(iconsContainer);
            }
            
            a.appendChild(modelNameContainer);
            a.dataset.modelName = mName;
            
            li.classList.add('model-dropdown-item');
            if (mName === currentModel) {
                li.classList.add('active-model');
            }

            a.addEventListener('click', async (e) => {
                e.preventDefault();
                if (mName !== currentModelName) { // Prevent re-switching to the same model
                    await switchModel(mName);
                }
                modelSwitcherDropdown.style.display = 'none';
                // Re-populate to update active class, or just update class directly
                // For simplicity, direct class update is better if switchModel doesn't recall populate.
                // Assuming switchModel updates currentActiveModel globally.
                const allItems = ul.querySelectorAll('li.model-dropdown-item');
                allItems.forEach(item => item.classList.remove('active-model'));
                li.classList.add('active-model');
            });
            li.appendChild(a);
            ul.appendChild(li);
        });
        modelSwitcherDropdown.appendChild(ul);
    }

    async function init() {
        const urlModel = new URLSearchParams(window.location.search).get('model');
        if (!urlModel) {
            modelNameDisplay.textContent = 'Error: Model name not specified.';
            addMessageToChatUI('System', 'No model specified. Select a model.', 'bot-message');
            messageInput.disabled = true; sendButton.disabled = true;
            return;
        }
        currentModelName = urlModel;
        console.log('[OllamaBro] init - Initializing chat for model from URL:', currentModelName);
        updateModelDisplay(currentModelName);

        // Show/hide image upload UI based on model capabilities
        toggleImageUploadUI(isVisionModel(currentModelName));

        let modelData = await loadModelChatState(currentModelName);
        if (!modelData.activeConversationId || !modelData.conversations[modelData.activeConversationId]) {
            await startNewConversation(currentModelName);
        } else {
            displayConversationMessages(modelData, modelData.activeConversationId);
            populateConversationSidebar(currentModelName, modelData);
        }
        
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();

        // Sidebar collapse/expand persistence
        const savedSidebarState = await chrome.storage.local.get(sidebarStateKey);
        if (savedSidebarState && savedSidebarState[sidebarStateKey] === 'collapsed') {
            conversationSidebar.classList.add('collapsed');
            collapseSidebarButton.innerHTML = '&#x2192;'; // Right arrow
        } else {
            conversationSidebar.classList.remove('collapsed');
            collapseSidebarButton.innerHTML = '&#x2190;'; // Left arrow
        }
    }

    // Event Listeners
    sendButton.addEventListener('click', () => sendMessageToOllama(messageInput.value));
    messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessageToOllama(messageInput.value); });
    
    clearChatButton.addEventListener('click', () => clearAllConversationsForModel(currentModelName));
    
    newChatButton.addEventListener('click', () => startNewConversation(currentModelName));

    // Image upload event listeners
    if (imageButton && imageInput) {
        imageButton.addEventListener('click', () => {
            imageInput.click();
        });

        imageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleImageFiles(Array.from(e.target.files));
                e.target.value = ''; // Clear the input so the same file can be selected again
            }
        });
    }

    // Drag and drop functionality
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (isVisionModel(currentModelName)) {
            dragDropOverlay.classList.add('active');
        }
    });

    document.addEventListener('dragleave', (e) => {
        if (!e.relatedTarget || !document.contains(e.relatedTarget)) {
            dragDropOverlay.classList.remove('active');
        }
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        dragDropOverlay.classList.remove('active');
        
        if (isVisionModel(currentModelName) && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const imageFiles = Array.from(e.dataTransfer.files).filter(file => 
                file.type.startsWith('image/')
            );
            if (imageFiles.length > 0) {
                handleImageFiles(imageFiles);
            }
        }
    });

    modelSwitcherButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (modelSwitcherDropdown.style.display === 'block') {
            modelSwitcherDropdown.style.display = 'none';
        } else {
            const models = await fetchAvailableModels();
            populateModelDropdown(models, currentModelName);
            modelSwitcherDropdown.style.display = 'block';
        }
    });

    document.addEventListener('click', (e) => {
        if (!modelSwitcherButton.contains(e.target) && !modelSwitcherDropdown.contains(e.target)) {
            modelSwitcherDropdown.style.display = 'none';
        }
    });

    collapseSidebarButton.addEventListener('click', async () => {
        conversationSidebar.classList.toggle('collapsed');
        const isCollapsed = conversationSidebar.classList.contains('collapsed');
        collapseSidebarButton.innerHTML = isCollapsed ? '&#x2192;' : '&#x2190;'; // Right/Left arrow
        await chrome.storage.local.set({ [sidebarStateKey]: isCollapsed ? 'collapsed' : 'expanded' });
    });

    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') messageInput.focus(); });

    init();

});
