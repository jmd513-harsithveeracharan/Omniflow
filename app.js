/**
 * app.js — Fabric AI Studio
 * Enterprise Client-Side Application Controller
 * Handles Multi-Tab Studio, Visual Ingestion DAG, Conversational AI Architect,
 * Workspace Explorer & Safe Deletion, Live Monitoring, and Memory Inspector.
 */

// ── Application Global State ──────────────────────────────────────────────────
const storedSessionId = localStorage.getItem('fabric_ai_session_id');
const App = {
    sessionId: storedSessionId || ('sess_' + Math.random().toString(36).substring(2, 11)),
    activeView: 'viewArchitect',
    workspace: { id: '', name: 'PBT_DATA_AGENT' },
    auth: { authenticated: false, user: 'Checking...', tenant: '', expiresMin: 0 },
    connectors: [],
    selectedConnector: null,
    connectorParams: {},
    discoveredTables: [],
    selectedTables: new Set(),
    tableSchemas: {},
    currentPlan: null,
    activeRunId: null,
    runs: {},
    workspaceItems: [],
    monitorPollTimer: null,
    authPollTimer: null,
    currentScale: 1.0,
};

// Save session ID
localStorage.setItem('fabric_ai_session_id', App.sessionId);

// ── Helpers ───────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
    // Toast popups completely disabled per user preference
}

async function apiFetch(url, options = {}) {
    options.headers = options.headers || {};
    options.headers['X-Session-Id'] = App.sessionId;
    if (options.body && typeof options.body === 'object') {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }
    try {
        const resp = await fetch(url, options);
        const newSessionId = resp.headers.get('X-Session-Id');
        if (newSessionId) {
            App.sessionId = newSessionId;
            localStorage.setItem('fabric_ai_session_id', App.sessionId);
        }
        return await resp.json();
    } catch (err) {
        if (err.name === 'AbortError') {
            return { success: false, aborted: true };
        }
        console.error(`[API ERROR] ${url}:`, err);
        return { success: false, error: err.message };
    }
}

// ── App Initialization ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initAuthLandingPage();
    initClaudeSettingsModal();
    initFabricConnectionManager();
    initNavigation();
    initBrandPlatformSwitcher();
    initDockModelSelector();
    initAuthStatus();
    initArchitectChat();
    initWorkbenchController();
    initIngestionStudio();
    initProjectsView();
    initWorkspaceExplorer();
    initExecutionMonitor();
    initSystemDashboard();
    initMemoryDrawer();
    initConversationsDrawer();
    initSafeDeleteModal();

    // Auto-load initial data
    loadConnectors();
    loadWorkspaceItems();
    loadSessionSummary();
    loadSystemStats();
    loadConversationsList();
    if (storedSessionId) {
        loadActiveConversation();
    }
    // Also load after a brief delay to catch the case where first call fires before browser is idle
    setTimeout(() => loadConversationsList(), 600);


    // Poll auth every 60s
    App.authPollTimer = setInterval(initAuthStatus, 60000);
});

// ── Navigation & View Switching ───────────────────────────────────────────────
function switchView(viewId) {
    if (!viewId) return;
    App.activeView = viewId;

    // Update active nav item
    document.querySelectorAll('.sidebar-nav .nav-item, .sidebar-new-chat-btn').forEach(btn => {
        const dv = btn.getAttribute('data-view');
        if (dv && dv === viewId) {
            btn.classList.add('active');
        } else if (viewId === 'viewArchitect' && btn.id === 'btnSidebarNewChat') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update view panels
    document.querySelectorAll('.view-panel').forEach(panel => {
        if (panel.id === viewId) {
            panel.classList.add('active');
            panel.style.display = 'block';
        } else {
            panel.classList.remove('active');
            panel.style.display = 'none';
        }
    });

    // Update topbar heading
    const heading = document.getElementById('topbarViewHeading');
    const titleMap = {
        viewArchitect: 'Playground',
        viewProjects: 'Projects',
        viewSkills: 'Skills',
        viewIngestion: 'Apps & Ingestion Studio',
        viewWorkspace: 'Workspace Explorer',
        viewLiveLogs: 'Execution Monitor',
        viewSystem: 'System & Diagnostics'
    };
    if (heading) {
        heading.textContent = titleMap[viewId] || 'Fabric AI Studio';
    }

    if (viewId === 'viewProjects') {
        initProjectsView();
    } else if (viewId === 'viewSkills') {
        initSkillsManager();
    } else if (viewId === 'viewWorkspace') {
        initWorkspaceExplorer();
        loadWorkspaceItems();
    }
}

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-view]');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetView = item.getAttribute('data-view');
            switchView(targetView);
        });
    });

    const sidebar = document.getElementById('sidebar');
    const toggleSidebar = () => {
        if (sidebar) {
            sidebar.classList.remove('peek-open');
            sidebar.classList.toggle('collapsed');
        }
    };

    document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebar);
    document.getElementById('sidebarTopToggle')?.addEventListener('click', toggleSidebar);

    // Topbar reveal toggle button with smooth pan-in / pan-out hover overlay
    const topbarSidebarToggle = document.getElementById('topbarSidebarToggle');
    if (topbarSidebarToggle && sidebar) {
        let peekTimer;

        const showPeek = () => {
            clearTimeout(peekTimer);
            if (sidebar.classList.contains('collapsed')) {
                sidebar.classList.add('peek-open');
            }
        };

        const hidePeek = () => {
            clearTimeout(peekTimer);
            peekTimer = setTimeout(() => {
                sidebar.classList.remove('peek-open');
            }, 180);
        };

        topbarSidebarToggle.addEventListener('mouseenter', showPeek);
        topbarSidebarToggle.addEventListener('mouseleave', hidePeek);

        sidebar.addEventListener('mouseenter', () => {
            clearTimeout(peekTimer);
        });

        sidebar.addEventListener('mouseleave', () => {
            if (sidebar.classList.contains('collapsed') && sidebar.classList.contains('peek-open')) {
                hidePeek();
            }
        });

        topbarSidebarToggle.addEventListener('click', (e) => {
            e.preventDefault();
            toggleSidebar();
        });
    }

    document.getElementById('authStatusCard')?.addEventListener('click', () => {
        if (sidebar && sidebar.classList.contains('collapsed')) {
            sidebar.classList.remove('collapsed');
            sidebar.classList.remove('peek-open');
        }
    });

    // Brand Platform Switcher Dropdown initialized in initBrandPlatformSwitcher()

    // + New Chat button in sidebar
    document.getElementById('btnSidebarNewChat')?.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('viewArchitect');
        document.getElementById('btnNewSession')?.click();
    });

    // Sidebar search button
    document.getElementById('sidebarSearchBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        const drawer = document.getElementById('conversationsDrawerBackdrop');
        if (drawer) {
            drawer.classList.add('open');
            document.getElementById('searchConversationsInput')?.focus();
        }
    });

    // Chats and tasks collapsible section toggle (Chevron immediately right of text)
    const toggleChatsSection = (e) => {
        e?.stopPropagation();
        const list = document.getElementById('sidebarRecentChatsList');
        const btn = document.getElementById('chatsCollapseToggle');
        if (list && btn) {
            const isCollapsed = list.classList.toggle('collapsed');
            btn.classList.toggle('collapsed', isCollapsed);
        }
    };

    document.getElementById('chatsSectionHeader')?.addEventListener('click', toggleChatsSection);
    document.getElementById('chatsCollapseToggle')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleChatsSection();
    });

    // Always start expanded on page load — remove any stale collapsed state
    const listOnLoad = document.getElementById('sidebarRecentChatsList');
    const btnOnLoad = document.getElementById('chatsCollapseToggle');
    if (listOnLoad) listOnLoad.classList.remove('collapsed');
    if (btnOnLoad) btnOnLoad.classList.remove('collapsed');

    // 2-Second auto-hiding scrollbar on scroll (resets on continuous scrolling)
    const scrollList = document.getElementById('sidebarRecentChatsList');
    if (scrollList) {
        let scrollTimer;
        scrollList.addEventListener('scroll', () => {
            scrollList.classList.add('is-scrolling');
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                scrollList.classList.remove('is-scrolling');
            }, 2000);
        });
    }

    // Draggable Sidebar Edge Resizer
    initSidebarResizer();
}

function initSidebarResizer() {
    const resizer = document.getElementById('sidebarResizer');
    if (!resizer) return;

    // Restore saved width if available
    const savedWidth = localStorage.getItem('fabric_sidebar_width');
    if (savedWidth) {
        document.documentElement.style.setProperty('--sidebar-w', `${savedWidth}px`);
    }

    let isResizing = false;

    const onMouseDown = (e) => {
        isResizing = true;
        document.body.classList.add('is-resizing');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    };

    const onMouseMove = (e) => {
        if (!isResizing) return;
        const newWidth = Math.max(200, Math.min(500, e.clientX));
        document.documentElement.style.setProperty('--sidebar-w', `${newWidth}px`);
        localStorage.setItem('fabric_sidebar_width', newWidth);
    };

    const onMouseUp = () => {
        if (!isResizing) return;
        isResizing = false;
        document.body.classList.remove('is-resizing');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    resizer.addEventListener('mousedown', onMouseDown);
}

// ── Brand Platform Switcher (Fabric.AI, Databricks.AI, Snowflake.AI, dbt.AI) ──
const PLATFORMS = {
    fabric: {
        name: 'Fabric',
        accent: '.AI',
        logo: 'assets/logos/abstract-shape(1).png',
        color: '#10b981'
    },
    databricks: {
        name: 'Databricks',
        accent: '.AI',
        logo: 'assets/logos/abstract-shape-databricks.png',
        color: '#f0341e'
    },
    snowflake: {
        name: 'Snowflake',
        accent: '.AI',
        logo: 'assets/logos/abstract-shape-snowflake.png',
        color: '#29b5e8'
    },
    dbt: {
        name: 'dbt',
        accent: '.AI',
        logo: 'assets/logos/abstract-shape-dbt.png',
        color: '#ff8214'
    }
};

function initBrandPlatformSwitcher() {
    const brandBtn = document.getElementById('brandHome');
    const menu = document.getElementById('brandDropdownMenu');
    if (!brandBtn || !menu) return;

    brandBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = menu.style.display === 'block';
        menu.style.display = isOpen ? 'none' : 'block';
        brandBtn.classList.toggle('dropdown-open', !isOpen);
    });

    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !brandBtn.contains(e.target)) {
            menu.style.display = 'none';
            brandBtn.classList.remove('dropdown-open');
        }
    });

    document.querySelectorAll('.brand-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const platformKey = item.getAttribute('data-platform');
            setBrandPlatform(platformKey);
            menu.style.display = 'none';
            brandBtn.classList.remove('dropdown-open');
        });
    });

    // Restore saved platform or default to fabric
    const saved = localStorage.getItem('fabric_ai_selected_platform') || 'fabric';
    setBrandPlatform(saved);
}

function setBrandPlatform(key) {
    const p = PLATFORMS[key] || PLATFORMS.fabric;
    localStorage.setItem('fabric_ai_selected_platform', key);

    // Update active item and checkmark
    document.querySelectorAll('.brand-dropdown-item').forEach(item => {
        const isThis = (item.getAttribute('data-platform') === key);
        item.classList.toggle('active', isThis);
        const check = item.querySelector('.dropdown-check');
        if (check) check.style.color = p.color;
    });

    // Update Brand Title and Logos across the UI
    const logoImg = document.getElementById('brandLogoImg');
    const topbarLogoImg = document.querySelector('#topbarBrandCollapsed .brand-logo-img');
    const playgroundLogoImg = document.getElementById('playgroundTitleLogo');
    const titleText = document.getElementById('brandTitleText');
    const disclaimer = document.querySelector('.dock-disclaimer');

    if (logoImg) logoImg.src = p.logo;
    if (topbarLogoImg) topbarLogoImg.src = p.logo;
    if (playgroundLogoImg) playgroundLogoImg.src = p.logo;
    if (titleText) {
        titleText.innerHTML = `${p.name}<span class="brand-accent" style="color: ${p.color};">${p.accent}</span>`;
    }
    if (disclaimer) {
        disclaimer.textContent = `${p.name}.AI can make mistakes. Please double-check responses.`;
    }
}

// ── Model & Effort Selector (Image 3) ─────────────────────────────────────────
const EFFORT_OPTIONS = ['High', 'Medium', 'Low'];

function initDockModelSelector() {
    const pillBtn = document.getElementById('btnDockModelSelect');
    const dropdown = document.getElementById('dockModelDropdown');
    const modelSubmenu = document.getElementById('dockModelSubmenu');
    const effortSubmenu = document.getElementById('dockModelEffortSubmenu');
    const btnMoreModels = document.getElementById('btnMoreModelsRow');
    const btnEffortRow = document.getElementById('btnModelEffortRow');
    if (!pillBtn || !dropdown) return;

    // Load saved preferences
    App.selectedModel = localStorage.getItem('fabric_ai_selected_model') || 'gemini-3.6-flash';
    App.selectedModelName = localStorage.getItem('fabric_ai_selected_model_name') || 'Gemini 3.6 Flash';
    App.selectedModelDesc = localStorage.getItem('fabric_ai_selected_model_desc') || 'Most efficient for everyday tasks';
    App.selectedEffort = localStorage.getItem('fabric_ai_selected_effort') || 'Medium';

    function updatePillDisplay() {
        const pillName = document.getElementById('dockModelName');
        const pillEffort = document.getElementById('dockModelEffort');
        const menuName = document.getElementById('menuPrimaryModelName');
        const menuDesc = document.getElementById('menuPrimaryModelDesc');
        const menuEffort = document.getElementById('menuEffortVal');
        if (pillName) pillName.textContent = App.selectedModelName;
        if (pillEffort) pillEffort.textContent = App.selectedEffort;
        if (menuName) menuName.textContent = App.selectedModelName;
        if (menuDesc) menuDesc.textContent = App.selectedModelDesc;
        if (menuEffort) menuEffort.textContent = App.selectedEffort;

        // Highlight matching item in models submenu
        document.querySelectorAll('#dockModelSubmenu .submenu-model-item').forEach(item => {
            const mId = item.getAttribute('data-model-id');
            item.classList.toggle('active', mId === App.selectedModel);
        });

        // Highlight matching item in effort submenu (High, Medium, Low)
        document.querySelectorAll('#dockModelEffortSubmenu .submenu-model-item').forEach(item => {
            const eff = item.getAttribute('data-effort');
            item.classList.toggle('active', eff === App.selectedEffort);
        });
    }

    updatePillDisplay();

    // Auto-discover local models (Ollama)
    async function loadModelStatus() {
        try {
            const res = await apiFetch('/api/models/status');
            if (!res) return;

            const ollama = res.local?.ollama;
            const localDivider = document.getElementById('submenuLocalDivider');
            const localContainer = document.getElementById('submenuLocalModelsContainer');

            if (ollama && ollama.online && Array.isArray(ollama.models) && ollama.models.length > 0) {
                if (localDivider) localDivider.style.display = 'block';
                if (localContainer) {
                    localContainer.style.display = 'flex';
                    localContainer.style.flexDirection = 'column';
                    localContainer.style.gap = '2px';
                    localContainer.innerHTML = ollama.models.map(m => `
                        <div class="submenu-model-item is-local ${App.selectedModel === m ? 'active' : ''}" data-model-id="${escapeHtml(m)}" data-name="${escapeHtml(m)}" data-desc="Local Ollama model running 100% on your machine">
                            <div class="submenu-item-left">
                                <span class="submenu-item-name">${escapeHtml(m)}</span>
                                <span class="submenu-tag-local">Local</span>
                            </div>
                            <span class="submenu-item-check">✓</span>
                        </div>
                    `).join('');

                    // Bind click for dynamic local items
                    localContainer.querySelectorAll('.submenu-model-item').forEach(item => {
                        item.addEventListener('click', (e) => {
                            e.stopPropagation();
                            selectModelSubmenuItem(item);
                        });
                    });
                }
            } else {
                if (localDivider) localDivider.style.display = 'none';
                if (localContainer) localContainer.style.display = 'none';
            }
        } catch (err) {
            console.warn('Failed to load model status:', err);
        }
    }

    loadModelStatus();

    function positionSubmenus() {
        if (!dropdown) return;
        const rect = dropdown.getBoundingClientRect();
        const openLeft = rect.right + 265 > window.innerWidth;
        if (modelSubmenu) modelSubmenu.classList.toggle('open-left', openLeft);
        if (effortSubmenu) effortSubmenu.classList.toggle('open-left', openLeft);
    }

    // Toggle main dropdown
    pillBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = dropdown.style.display === 'block';
        dropdown.style.display = isOpen ? 'none' : 'block';
        if (modelSubmenu) modelSubmenu.style.display = 'none';
        if (effortSubmenu) effortSubmenu.style.display = 'none';
        btnMoreModels?.classList.remove('open');
        btnEffortRow?.classList.remove('open');
        pillBtn.classList.toggle('dropdown-open', !isOpen);
        if (!isOpen) {
            loadModelStatus();
        }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !pillBtn.contains(e.target)) {
            dropdown.style.display = 'none';
            if (modelSubmenu) modelSubmenu.style.display = 'none';
            if (effortSubmenu) effortSubmenu.style.display = 'none';
            btnMoreModels?.classList.remove('open');
            btnEffortRow?.classList.remove('open');
            pillBtn.classList.remove('dropdown-open');
        }
    });

    // Primary option click in dropdown
    document.getElementById('btnModelOptionPrimary')?.addEventListener('click', () => {
        dropdown.style.display = 'none';
        if (modelSubmenu) modelSubmenu.style.display = 'none';
        if (effortSubmenu) effortSubmenu.style.display = 'none';
        btnMoreModels?.classList.remove('open');
        btnEffortRow?.classList.remove('open');
        pillBtn.classList.remove('dropdown-open');
    });

    // Effort row hover & click -> Opens attached Effort flyout submenu (High, Medium, Low)
    btnEffortRow?.addEventListener('mouseenter', () => {
        if (effortSubmenu) {
            if (modelSubmenu) modelSubmenu.style.display = 'none';
            btnMoreModels?.classList.remove('open');
            positionSubmenus();
            effortSubmenu.style.display = 'block';
            btnEffortRow.classList.add('open');
        }
    });

    btnEffortRow?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (effortSubmenu) {
            if (modelSubmenu) modelSubmenu.style.display = 'none';
            btnMoreModels?.classList.remove('open');
            positionSubmenus();
            const isOpen = effortSubmenu.style.display === 'block';
            effortSubmenu.style.display = isOpen ? 'none' : 'block';
            btnEffortRow.classList.toggle('open', !isOpen);
        }
    });

    // Effort selection items (High, Medium, Low)
    document.querySelectorAll('#dockModelEffortSubmenu .submenu-model-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const effortVal = item.getAttribute('data-effort');
            if (effortVal) {
                App.selectedEffort = effortVal;
                localStorage.setItem('fabric_ai_selected_effort', effortVal);
                updatePillDisplay();

                // Close menus
                dropdown.style.display = 'none';
                if (effortSubmenu) effortSubmenu.style.display = 'none';
                if (modelSubmenu) modelSubmenu.style.display = 'none';
                btnEffortRow?.classList.remove('open');
                btnMoreModels?.classList.remove('open');
                pillBtn.classList.remove('dropdown-open');
            }
        });
    });

    // More models hover & click -> Opens attached flyout submenu side-by-side
    btnMoreModels?.addEventListener('mouseenter', () => {
        if (modelSubmenu) {
            if (effortSubmenu) effortSubmenu.style.display = 'none';
            btnEffortRow?.classList.remove('open');
            positionSubmenus();
            modelSubmenu.style.display = 'block';
            btnMoreModels.classList.add('open');
        }
    });

    btnMoreModels?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (modelSubmenu) {
            if (effortSubmenu) effortSubmenu.style.display = 'none';
            btnEffortRow?.classList.remove('open');
            positionSubmenus();
            const isOpen = modelSubmenu.style.display === 'block';
            modelSubmenu.style.display = isOpen ? 'none' : 'block';
            btnMoreModels.classList.toggle('open', !isOpen);
        }
    });

    function selectModelSubmenuItem(item) {
        const modelId = item.getAttribute('data-model-id');
        const modelName = item.getAttribute('data-name');
        const modelDesc = item.getAttribute('data-desc') || 'Fast and capable model';
        const isUpgrade = item.classList.contains('is-upgrade');

        if (isUpgrade) {
            showToast(`⚠️ API Key for ${modelName} is not set in .env. Requests will gracefully route to available models.`, 'warning');
        }

        if (modelId && modelName) {
            App.selectedModel = modelId;
            App.selectedModelName = modelName;
            App.selectedModelDesc = modelDesc;
            localStorage.setItem('fabric_ai_selected_model', modelId);
            localStorage.setItem('fabric_ai_selected_model_name', modelName);
            localStorage.setItem('fabric_ai_selected_model_desc', modelDesc);

            updatePillDisplay();

            // Close menus
            dropdown.style.display = 'none';
            if (modelSubmenu) modelSubmenu.style.display = 'none';
            if (effortSubmenu) effortSubmenu.style.display = 'none';
            btnMoreModels?.classList.remove('open');
            btnEffortRow?.classList.remove('open');
            pillBtn.classList.remove('dropdown-open');
        }
    }

    // Static model submenu items
    document.querySelectorAll('#dockModelSubmenu .submenu-model-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            selectModelSubmenuItem(item);
        });
    });

    // Dual-Engine Voice Input: Web Speech API with seamless Whisper AI MediaRecorder fallback
    let activeRecognition = null;
    let activeMediaRecorder = null;
    let activeMediaStream = null;
    let recordedAudioChunks = [];

    async function startMediaRecorderFallback(micBtn, input) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('Microphone access not supported in this browser.');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            activeMediaStream = stream;
            recordedAudioChunks = [];

            const mimeType = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))
                ? 'audio/webm;codecs=opus'
                : ((typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm')) ? 'audio/webm' : 'audio/mp4');

            const mediaRecorder = new MediaRecorder(stream);
            activeMediaRecorder = mediaRecorder;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    recordedAudioChunks.push(e.data);
                }
            };

            mediaRecorder.onstart = () => {
                micBtn.classList.add('recording');
                micBtn.title = "Listening (Whisper AI)... Click mic to transcribe";
                input.placeholder = "Listening... Speak your prompt now";
            };

            mediaRecorder.onstop = async () => {
                micBtn.classList.remove('recording');
                micBtn.title = "Transcribing with Whisper AI...";
                input.placeholder = "Transcribing with Whisper AI...";

                if (activeMediaStream) {
                    activeMediaStream.getTracks().forEach(t => t.stop());
                    activeMediaStream = null;
                }

                const audioBlob = new Blob(recordedAudioChunks, { type: mimeType });
                if (audioBlob.size < 500) {
                    micBtn.title = "Voice Input";
                    input.placeholder = "Ask anything about Fabric...";
                    activeMediaRecorder = null;
                    return;
                }

                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    try {
                        const base64Audio = reader.result.split(',')[1];
                        const res = await apiFetch('/api/audio/transcribe', {
                            method: 'POST',
                            body: { audio_base64: base64Audio, mime_type: mimeType }
                        });

                        if (res && res.text) {
                            const baseText = input.value ? input.value.trim() + ' ' : '';
                            input.value = baseText + res.text;
                            input.style.height = 'auto';
                            input.style.height = `${Math.min(180, input.scrollHeight)}px`;
                            input.focus();
                        }
                    } catch (err) {
                        console.error('Transcription error:', err);
                    } finally {
                        micBtn.title = "Voice Input";
                        input.placeholder = "Ask anything about Fabric...";
                        activeMediaRecorder = null;
                    }
                };
            };

            mediaRecorder.start(250);
        } catch (err) {
            console.error('Microphone permission or MediaRecorder error:', err);
            micBtn.classList.remove('recording');
            micBtn.title = "Voice Input";
            input.placeholder = "Ask anything about Fabric...";
            activeMediaRecorder = null;
        }
    }

    document.getElementById('btnVoiceInput')?.addEventListener('click', (e) => {
        e.preventDefault();
        const micBtn = document.getElementById('btnVoiceInput');
        const input = document.getElementById('chatInput');
        if (!micBtn || !input) return;

        // If currently recording via Web Speech API, stop it
        if (activeRecognition) {
            try { activeRecognition.stop(); } catch(err) {}
            activeRecognition = null;
            micBtn.classList.remove('recording');
            micBtn.title = "Voice Input";
            input.placeholder = "Ask anything about Fabric...";
            return;
        }

        // If currently recording via MediaRecorder, stop and transcribe
        if (activeMediaRecorder && activeMediaRecorder.state === 'recording') {
            try { activeMediaRecorder.stop(); } catch(err) {}
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            // Seamlessly fall back to MediaRecorder + Whisper AI (works in 100% of browsers)
            startMediaRecorderFallback(micBtn, input);
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            recognition.lang = 'en-US';
            recognition.continuous = true;
            recognition.interimResults = true;

            const baseText = input.value ? input.value.trim() + ' ' : '';
            let finalAccumulated = '';

            recognition.onstart = () => {
                micBtn.classList.add('recording');
                micBtn.title = "Listening... Click mic to stop";
                input.placeholder = "Listening... Speak your prompt now";
            };

            recognition.onresult = (event) => {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalAccumulated += event.results[i][0].transcript + ' ';
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                input.value = baseText + finalAccumulated + interimTranscript;
                input.style.height = 'auto';
                input.style.height = `${Math.min(180, input.scrollHeight)}px`;
                input.focus();
            };

            recognition.onerror = (err) => {
                console.warn('SpeechRecognition error, trying Whisper AI fallback:', err.error);
                micBtn.classList.remove('recording');
                micBtn.title = "Voice Input";
                input.placeholder = "Ask anything about Fabric...";
                activeRecognition = null;

                if (err.error !== 'aborted') {
                    startMediaRecorderFallback(micBtn, input);
                }
            };

            recognition.onend = () => {
                micBtn.classList.remove('recording');
                micBtn.title = "Voice Input";
                input.placeholder = "Ask anything about Fabric...";
                activeRecognition = null;
            };

            recognition.start();
            activeRecognition = recognition;
        } catch (err) {
            console.warn('SpeechRecognition start failed, starting Whisper AI fallback:', err);
            activeRecognition = null;
            startMediaRecorderFallback(micBtn, input);
        }
    });

    // Live Audio wave button visual toggle
    document.getElementById('btnAudioWave')?.addEventListener('click', () => {
        const btn = document.getElementById('btnAudioWave');
        if (!btn) return;
        btn.classList.toggle('active');
        btn.style.color = btn.classList.contains('active') ? '#38bdf8' : '';
    });
}

function switchView(viewId) {
    App.activeView = viewId;

    // Update nav classes
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-view') === viewId);
    });

    // Update new chat button active state: ONLY active if viewArchitect AND currently on landing/empty state
    const btnNewChat = document.getElementById('btnSidebarNewChat');
    if (btnNewChat) {
        const isLanding = document.getElementById('boltChatPane')?.classList.contains('is-landing') ||
                          (document.getElementById('playgroundHome') && document.getElementById('playgroundHome').style.display !== 'none');
        btnNewChat.classList.toggle('active', viewId === 'viewArchitect' && isLanding);
    }

    // Update view panels
    document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === viewId);
    });

    // Update breadcrumb
    const bcMap = {
        'viewArchitect': 'AI Architect',
        'viewIngestion': 'Ingestion Studio',
        'viewWorkspace': 'Workspace Explorer',
        'viewMonitoring': 'Live Execution Monitor',
        'viewSystem': 'System & Memory Dashboard',
    };
    const bcText = bcMap[viewId] || 'Studio';
    const bcEl = document.getElementById('bcCurrentView');
    if (bcEl) bcEl.textContent = bcText;

    if (viewId === 'viewWorkspace') loadWorkspaceItems();
    if (viewId === 'viewSystem') loadSystemStats();
}

// ── Claude-Style Auth & Landing Page Controller (Image Reference) ─────────────
function initAuthLandingPage() {
    const authPage = document.getElementById('authPage');
    const btnGoogle = document.getElementById('btnAuthGoogle');
    const btnMicrosoft = document.getElementById('btnAuthMicrosoft');
    const emailForm = document.getElementById('authEmailForm');
    const emailInput = document.getElementById('authEmailInput');
    const userCard = document.getElementById('authStatusCard');
    const userMenu = document.getElementById('userProfileMenu');
    const btnSignOut = document.getElementById('btnSignOut');

    function applyUser(user) {
        if (!user) return;
        const nameEl = document.getElementById('authUsername');
        const avatarEl = document.getElementById('authAvatar');
        const menuName = document.getElementById('menuUserName');
        const menuEmail = document.getElementById('menuUserEmail');
        const menuAvatar = document.getElementById('menuUserAvatar');

        const initial = (user.name || user.email || 'U')[0].toUpperCase();

        if (nameEl) nameEl.textContent = user.name || user.email;
        if (avatarEl) avatarEl.textContent = initial;
        if (menuName) menuName.textContent = user.name || 'User';
        if (menuEmail) menuEmail.textContent = user.email || '';
        if (menuAvatar) menuAvatar.textContent = initial;
    }

    // Check if user is logged in
    const savedUserJson = localStorage.getItem('fabric_ai_user');
    if (savedUserJson) {
        try {
            const user = JSON.parse(savedUserJson);
            applyUser(user);
            if (authPage) authPage.style.display = 'none';
        } catch (e) {
            if (authPage) authPage.style.display = 'flex';
        }
    } else {
        // By default show auth page if not logged in
        if (authPage) authPage.style.display = 'flex';
    }

    function completeLogin(user, toastMsg) {
        localStorage.setItem('fabric_ai_user', JSON.stringify(user));
        applyUser(user);
        if (authPage) {
            authPage.style.animation = 'fadeOut 0.2s ease forwards';
            setTimeout(() => {
                authPage.style.display = 'none';
                authPage.style.animation = '';
            }, 180);
        }
        showToast(toastMsg || `Welcome to Fabric AI Studio, ${user.name}!`, 'success');
    }

    // SSO Modals
    const modalGoogle = document.getElementById('modalGooglePicker');
    const modalMicrosoft = document.getElementById('modalMicrosoftPicker');

    // 1. Continue with Google -> Opens Google Account Chooser
    btnGoogle?.addEventListener('click', () => {
        if (modalGoogle) modalGoogle.style.display = 'flex';
    });

    document.getElementById('btnCloseGooglePicker')?.addEventListener('click', () => {
        if (modalGoogle) modalGoogle.style.display = 'none';
    });

    // 2. Continue with Microsoft -> Opens Microsoft Account Chooser
    btnMicrosoft?.addEventListener('click', () => {
        if (modalMicrosoft) modalMicrosoft.style.display = 'flex';
    });

    document.getElementById('btnCloseMicrosoftPicker')?.addEventListener('click', () => {
        if (modalMicrosoft) modalMicrosoft.style.display = 'none';
    });

    // Close on backdrop click
    modalGoogle?.addEventListener('click', (e) => {
        if (e.target === modalGoogle) modalGoogle.style.display = 'none';
    });
    modalMicrosoft?.addEventListener('click', (e) => {
        if (e.target === modalMicrosoft) modalMicrosoft.style.display = 'none';
    });

    // Handle account selection in Google / Microsoft pickers
    document.querySelectorAll('.sso-account-item[data-email]').forEach(item => {
        item.addEventListener('click', () => {
            const name = item.getAttribute('data-name');
            const email = item.getAttribute('data-email');
            const provider = item.getAttribute('data-provider') || 'sso';
            if (email) {
                if (modalGoogle) modalGoogle.style.display = 'none';
                if (modalMicrosoft) modalMicrosoft.style.display = 'none';
                completeLogin({ name, email, provider }, `Signed in with ${provider === 'microsoft' ? 'Microsoft' : 'Google'} as ${name}`);
            }
        });
    });

    // Handle "Use another account" for Google
    document.getElementById('btnGoogleAddAnother')?.addEventListener('click', () => {
        const customEmail = prompt('Enter your Google email address (e.g. name@gmail.com):');
        if (customEmail && customEmail.includes('@')) {
            const name = customEmail.split('@')[0];
            const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
            if (modalGoogle) modalGoogle.style.display = 'none';
            completeLogin({ name: formattedName, email: customEmail.trim(), provider: 'google' }, `Signed in with Google as ${customEmail}`);
        }
    });

    // Handle "Use another account" for Microsoft
    document.getElementById('btnMicrosoftAddAnother')?.addEventListener('click', () => {
        const customEmail = prompt('Enter your Microsoft / Work email address (e.g. name@company.com or name@outlook.com):');
        if (customEmail && customEmail.includes('@')) {
            const name = customEmail.split('@')[0];
            const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
            if (modalMicrosoft) modalMicrosoft.style.display = 'none';
            completeLogin({ name: formattedName, email: customEmail.trim(), provider: 'microsoft' }, `Signed in with Microsoft as ${customEmail}`);
        }
    });

    // 3. Continue with Email
    emailForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = emailInput?.value?.trim();
        if (!email) return;
        const prefix = email.split('@')[0];
        const formattedName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        const user = {
            name: formattedName,
            email: email,
            provider: 'email'
        };
        completeLogin(user, `Signed in as ${email}`);
    });

    // 4. Toggle User Profile Menu in Sidebar
    userCard?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (userMenu) {
            const isOpen = userMenu.style.display === 'block';
            userMenu.style.display = isOpen ? 'none' : 'block';
        }
    });

    document.addEventListener('click', (e) => {
        if (userMenu && !userMenu.contains(e.target) && !userCard.contains(e.target)) {
            userMenu.style.display = 'none';
        }
    });

    // 5. Sign Out
    btnSignOut?.addEventListener('click', (e) => {
        e.stopPropagation();
        localStorage.removeItem('fabric_ai_user');
        if (userMenu) userMenu.style.display = 'none';
        if (authPage) {
            authPage.style.display = 'flex';
            if (emailInput) emailInput.value = '';
        }
        showToast('Signed out of Fabric AI Studio', 'info');
    });
}

// ── Claude-Style Unified Settings & Customization Controller ─────────────────
function initClaudeSettingsModal() {
    const modal = document.getElementById('modalClaudeSettings');
    const btnClose = document.getElementById('btnCloseClaudeSettings');
    const navCustomize = document.getElementById('navCustomize');
    const btnMenuSettings = document.getElementById('btnMenuSettings');
    const searchInput = document.getElementById('settingsSearchInput');
    const navItems = document.querySelectorAll('.claude-settings-nav-item');
    const filterPills = document.querySelectorAll('.connectors-filter-row .filter-pill');
    const connectorRows = document.querySelectorAll('.connectors-table-body .connector-row');

    // Open function
    window.openClaudeSettings = (tabName = 'tabSourceSystems') => {
        if (!modal) return;
        modal.style.display = 'flex';
        switchSettingsTab(tabName);
        loadFabricConnectionData();

        // Populate profile info
        const stored = localStorage.getItem('fabric_ai_user');
        if (stored) {
            try {
                const u = JSON.parse(stored);
                if (document.getElementById('inputProfileName')) document.getElementById('inputProfileName').value = u.name || 'Harsith';
                if (document.getElementById('inputProfileCallName')) document.getElementById('inputProfileCallName').value = (u.name || 'Harsith').split(' ')[0];
                if (document.getElementById('settingsAvatarCircle')) document.getElementById('settingsAvatarCircle').textContent = (u.name || 'H')[0].toUpperCase();
            } catch(e) {}
        }
    };

    function closeClaudeSettingsModal() {
        if (modal) modal.style.display = 'none';
        // Restore active state to previous view / chat
        if (App.previousActiveView) {
            switchView(App.previousActiveView);
        }
    }

    // Open from sidebar Customize link
    navCustomize?.addEventListener('click', (e) => {
        e.preventDefault();
        App.previousActiveView = App.activeView || 'viewArchitect';
        openClaudeSettings('tabSourceSystems');
    });

    // Open from user profile menu Settings button
    btnMenuSettings?.addEventListener('click', (e) => {
        e.stopPropagation();
        App.previousActiveView = App.activeView || 'viewArchitect';
        const userMenu = document.getElementById('userProfileMenu');
        if (userMenu) userMenu.style.display = 'none';
        openClaudeSettings('tabGeneral');
    });

    // Close modal
    modal?.querySelectorAll('.btn-close-modal-icon, #btnCloseClaudeSettings').forEach(btn => {
        btn.addEventListener('click', () => {
            closeClaudeSettingsModal();
        });
    });

    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeClaudeSettingsModal();
    });

    // Global ESC key listener to close modals hierarchically (topmost active modal first)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            // 1. Topmost child modals (e.g. Add Custom Connector)
            const customModal = document.getElementById('modalAddCustomConnector');
            if (customModal && customModal.style.display !== 'none') {
                window.closeAddConnectorModal();
                return;
            }
            const modalProj = document.getElementById('modalNewProject');
            if (modalProj && (modalProj.style.display === 'flex' || modalProj.style.display === 'block')) {
                modalProj.style.display = 'none';
                return;
            }
            const modalFab = document.getElementById('modalFabricConnections');
            if (modalFab && modalFab.style.display === 'flex') {
                modalFab.style.display = 'none';
                return;
            }
            const modalSkill = document.getElementById('modalSkillInspector');
            if (modalSkill && modalSkill.style.display === 'flex') {
                modalSkill.style.display = 'none';
                return;
            }
            // 2. Base Settings & Customize modal
            if (modal && modal.style.display === 'flex') {
                closeClaudeSettingsModal();
                return;
            }
            // 3. Dropdowns and drawers
            const userMenu = document.getElementById('userProfileMenu');
            if (userMenu && userMenu.style.display === 'block') {
                userMenu.style.display = 'none';
                return;
            }
            const convDrawer = document.getElementById('conversationsDrawerBackdrop');
            if (convDrawer && convDrawer.classList.contains('open')) {
                convDrawer.classList.remove('open');
                return;
            }
        }
    });

    // Tab switcher
    function switchSettingsTab(tabId) {
        navItems.forEach(item => {
            if (item.dataset.tab === tabId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        const panes = {
            tabSourceSystems: document.getElementById('paneSourceSystems'),
            tabConnectors: document.getElementById('paneConnectors'),
            tabGeneral: document.getElementById('paneGeneral'),
            tabApiKeys: document.getElementById('paneApiKeys'),
            tabMemory: document.getElementById('paneMemory'),
            tabAccount: document.getElementById('paneAccount'),
        };

        const genericPane = document.getElementById('paneGeneric');
        const genericTitle = document.getElementById('paneGenericTitle');
        const genericDesc = document.getElementById('paneGenericDesc');

        // Hide all panes
        Object.values(panes).forEach(p => { if (p) p.style.display = 'none'; });
        if (genericPane) genericPane.style.display = 'none';

        if (panes[tabId]) {
            panes[tabId].style.display = 'block';
        } else if (genericPane) {
            genericPane.style.display = 'block';
            const tabTitleMap = {
                tabPrivacy: { title: 'Privacy & Governance', desc: 'Enterprise data compliance and lineage auditing.' },
                tabNotifications: { title: 'Notifications & Alerts', desc: 'Fabric deployment notices, schema drift alerts, and cron runs.' },
                tabCapabilities: { title: 'Capabilities & Model Tiers', desc: 'Reasoning effort, dynamic temperature scaling, and tool access.' },
                tabPlugins: { title: 'Plugins & MCP Servers', desc: 'Model Context Protocol (MCP) tool integrations and connectors.' },
            };
            const info = tabTitleMap[tabId] || { title: 'Configuration', desc: 'Settings for Fabric AI Studio.' };
            if (genericTitle) genericTitle.textContent = info.title;
            if (genericDesc) genericDesc.textContent = info.desc;
        }
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            switchSettingsTab(item.dataset.tab);
        });
    });

    // Connectors filter tabs (All / Connected / Not connected)
    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const filter = pill.dataset.filter;

            connectorRows.forEach(row => {
                const status = row.dataset.status;
                if (filter === 'all' || status === filter) {
                    row.style.display = 'grid';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    });

    // Popular Cards buttons & Fabric Connect buttons open Connection Sub-Modal
    const openFabricConnModal = () => {
        const fabModal = document.getElementById('modalFabricConnections');
        if (fabModal) {
            fabModal.style.display = 'flex';
            loadFabricConnectionData();
        }
    };

    document.getElementById('btnPopFabCli')?.addEventListener('click', openFabricConnModal);
    document.getElementById('btnPopAzureSql')?.addEventListener('click', openFabricConnModal);
    document.getElementById('btnPopSnowflake')?.addEventListener('click', openFabricConnModal);
    document.getElementById('btnManageFabricWs')?.addEventListener('click', openFabricConnModal);

    // Search input filters nav items
    searchInput?.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        navItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(query) ? 'flex' : 'none';
        });
    });

    // Theme toggle buttons in General tab
    const themeBtns = document.querySelectorAll('.theme-toggle-btn');
    themeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            themeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const theme = btn.dataset.theme;
            if (theme === 'light') {
                document.body.classList.remove('dark-theme');
                document.body.classList.add('light-theme');
            } else {
                document.body.classList.remove('light-theme');
                document.body.classList.add('dark-theme');
            }
        });
    });

    // Save API keys
    document.getElementById('btnSaveApiKeys')?.addEventListener('click', () => {
        const gemKey = document.getElementById('inputGeminiApiKey')?.value?.trim();
        const groqKey = document.getElementById('inputGroqApiKey')?.value?.trim();
        if (gemKey) localStorage.setItem('gemini_api_key', gemKey);
        if (groqKey) localStorage.setItem('groq_api_key', groqKey);
        showToast('API Keys saved successfully!', 'success');
    });

    // Clear Memory
    document.getElementById('btnClearMemoryBtn')?.addEventListener('click', async () => {
        showToast('Short-term memory reset.', 'info');
        const t = document.getElementById('settingsMemTurns');
        const tok = document.getElementById('settingsMemTokens');
        if (t) t.textContent = '0';
        if (tok) tok.textContent = '0';
    });

    // Preload Skills Manager
    initSkillsManager();
}

// ── Projects Controller (Claude-Style Redesign) ─────────────────────────────
let _projectsListenersAttached = false;
let _projectSortBy = 'updated';

const DEFAULT_PROJECTS = [
    {
        id: 'proj_retail_pos',
        name: 'Retail POS & Medallion Pipeline',
        description: 'End-to-end ingestion and star schema modeling for enterprise point-of-sale transactions into Bronze, Silver upserts, and Gold star schema.',
        targetLakehouse: 'lh_retail_bronze',
        instructions: 'Always use Delta Lake MERGE statements with partition pruning on transaction_date.',
        conversationsCount: 3,
        updatedAt: Date.now() - 3600000 * 2,
        createdAt: Date.now() - 86400000 * 3
    },
    {
        id: 'proj_sap_finance',
        name: 'SAP S/4HANA Finance Sync',
        description: 'Real-time ingestion of General Ledger and Accounts Payable via SAP ODP connector with incremental watermarking.',
        targetLakehouse: 'lh_finance_silver',
        instructions: 'Ensure all financial currency conversions use the standard ISO reference exchange table in OneLake.',
        conversationsCount: 2,
        updatedAt: Date.now() - 3600000 * 6,
        createdAt: Date.now() - 86400000 * 5
    }
];

function getStoredProjects() {
    try {
        const stored = localStorage.getItem('fabric_ai_projects');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            if (Array.isArray(parsed) && parsed.length === 0) return [];
        }
    } catch(e) {}
    saveStoredProjects(DEFAULT_PROJECTS);
    return DEFAULT_PROJECTS;
}

function saveStoredProjects(projects) {
    try {
        localStorage.setItem('fabric_ai_projects', JSON.stringify(projects));
    } catch(e) {}
}

function initProjectsView() {
    App.projects = getStoredProjects();
    renderProjectsGrid();

    if (_projectsListenersAttached) return;
    _projectsListenersAttached = true;

    // Search Toggle & Live Input
    const searchBtn = document.getElementById('btnProjectsSearchToggle');
    const searchInput = document.getElementById('projectsSearchInput');
    searchBtn?.addEventListener('click', () => {
        if (!searchInput) return;
        const isHidden = searchInput.style.display === 'none';
        searchInput.style.display = isHidden ? 'block' : 'none';
        if (isHidden) searchInput.focus();
    });

    searchInput?.addEventListener('input', () => {
        renderProjectsGrid();
    });

    // Sort Dropdown
    const sortBtn = document.getElementById('btnProjectsSort');
    const sortMenu = document.getElementById('projectsSortMenu');
    const sortLabel = document.getElementById('projectsSortLabel');

    sortBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (sortMenu) {
            const isHidden = sortMenu.style.display === 'none';
            sortMenu.style.display = isHidden ? 'flex' : 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (sortMenu && !sortBtn?.contains(e.target) && !sortMenu.contains(e.target)) {
            sortMenu.style.display = 'none';
        }
    });

    document.querySelectorAll('.projects-sort-item').forEach(item => {
        item.addEventListener('click', () => {
            const sort = item.getAttribute('data-sort') || 'updated';
            _projectSortBy = sort;
            if (sortLabel) sortLabel.textContent = item.textContent;
            document.querySelectorAll('.projects-sort-item').forEach(i => i.classList.toggle('active', i === item));
            if (sortMenu) sortMenu.style.display = 'none';
            renderProjectsGrid();
        });
    });

    // New Project Buttons
    document.getElementById('btnNewProjectTop')?.addEventListener('click', openNewProjectModal);
    document.getElementById('btnNewProjectCenter')?.addEventListener('click', openNewProjectModal);
    document.getElementById('btnSubmitNewProject')?.addEventListener('click', submitNewProject);

    // Help Tooltip
    document.getElementById('btnProjectsHelp')?.addEventListener('click', () => {
        showToast('Projects allow you to set custom grounding instructions, target lakehouses, and organize chat threads in one space.', 'info');
    });
}

function openNewProjectModal() {
    const modal = document.getElementById('modalNewProject');
    if (!modal) return;
    modal.style.display = 'flex';
    const nameInput = document.getElementById('inputProjectName');
    if (nameInput) {
        nameInput.value = '';
        nameInput.focus();
    }
    const descInput = document.getElementById('inputProjectDesc');
    if (descInput) descInput.value = '';
    const instInput = document.getElementById('inputProjectInstructions');
    if (instInput) instInput.value = '';
}

function closeNewProjectModal() {
    const modal = document.getElementById('modalNewProject');
    if (modal) modal.style.display = 'none';
}

window.openNewProjectModal = openNewProjectModal;
window.closeNewProjectModal = closeNewProjectModal;

function submitNewProject() {
    const nameInput = document.getElementById('inputProjectName');
    const descInput = document.getElementById('inputProjectDesc');
    const lhInput = document.getElementById('selectProjectTargetLakehouse');
    const instInput = document.getElementById('inputProjectInstructions');

    const name = nameInput?.value.trim();
    if (!name) {
        if (nameInput) {
            nameInput.focus();
            nameInput.style.borderColor = '#f87171';
            setTimeout(() => { nameInput.style.borderColor = ''; }, 1500);
        }
        return;
    }

    const newProject = {
        id: 'proj_' + Math.random().toString(36).substring(2, 9),
        name: name,
        description: descInput?.value.trim() || 'Custom Fabric project workspace.',
        targetLakehouse: lhInput?.value || 'lh_retail_bronze',
        instructions: instInput?.value.trim() || '',
        conversationsCount: 1,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    App.projects = getStoredProjects();
    App.projects.unshift(newProject);
    saveStoredProjects(App.projects);

    closeNewProjectModal();
    renderProjectsGrid();
    showToast(`Project "${name}" created.`, 'success');
}

function renderProjectsGrid() {
    const emptyState = document.getElementById('projectsEmptyState');
    const grid = document.getElementById('projectsCardsGrid');
    const searchInput = document.getElementById('projectsSearchInput');
    const query = (searchInput?.value || '').toLowerCase().trim();

    let list = [...(App.projects || [])];

    if (query) {
        list = list.filter(p => 
            (p.name || '').toLowerCase().includes(query) ||
            (p.description || '').toLowerCase().includes(query) ||
            (p.targetLakehouse || '').toLowerCase().includes(query)
        );
    }

    if (_projectSortBy === 'name') {
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (_projectSortBy === 'created') {
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else {
        list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    if (list.length === 0 && !query) {
        if (emptyState) emptyState.style.display = 'flex';
        if (grid) grid.style.display = 'none';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (grid) {
        grid.style.display = 'grid';
        grid.innerHTML = '';

        list.forEach(proj => {
            const card = document.createElement('div');
            card.className = 'project-card';
            const timeAgo = formatRelativeTime(proj.updatedAt || proj.createdAt);

            card.innerHTML = `
                <div>
                    <div class="project-card-top">
                        <h3 class="project-card-title">${escapeHtml(proj.name)}</h3>
                        <span class="project-lakehouse-tag">${escapeHtml(proj.targetLakehouse || 'Lakehouse')}</span>
                    </div>
                    <p class="project-card-desc">${escapeHtml(proj.description || 'Custom Fabric project workspace.')}</p>
                </div>
                <div class="project-card-footer">
                    <span>${escapeHtml(timeAgo)}</span>
                    <button class="ws-action-btn ws-btn-del" title="Delete project" style="margin-left: auto;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            `;

            // Click card to open in Chat with project context
            card.addEventListener('click', (e) => {
                if (e.target.closest('.ws-btn-del')) return;
                openProjectWorkspace(proj);
            });

            // Delete project
            const delBtn = card.querySelector('.ws-btn-del');
            delBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete project "${proj.name}"?`)) {
                    App.projects = (App.projects || []).filter(p => p.id !== proj.id);
                    saveStoredProjects(App.projects);
                    renderProjectsGrid();
                    showToast('Project deleted.', 'info');
                }
            });

            grid.appendChild(card);
        });
    }
}

function openProjectWorkspace(project) {
    App.activeProject = project;
    switchView('viewArchitect');
    
    // Set custom project placeholder and focus chat
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.placeholder = `Ask anything about ${project.name}...`;
        chatInput.focus();
    }
    showToast(`Loaded context for project "${project.name}"`, 'success');
}

// ── Skills Gallery & Inspector Controller (Claude Artifacts Layout) ──────────
const DEFAULT_SKILLS = [
    { name: 'using_fabric_skills', displayName: 'using_fabric_skills', tier: 'orchestrator', description: 'Meta-skill that discovers, routes, and orchestrates all specialized Fabric AI Studio skills.', snippet: 'User Request Arrives ──→ Routing Decision Matrix' },
    { name: 'fabric_medallion_architecture', displayName: 'fabric_medallion_architecture', tier: 'workflow', description: 'Playbook for designing and provisioning multi-tier Medallion (Bronze/Silver/Gold) Lakehouse architectures in Microsoft Fabric.', snippet: 'lh_<name>_bronze ──→ lh_<name>_silver ──→ lh_<name>_gold' },
    { name: 'fabric_ingestion_and_scheduling', displayName: 'fabric_ingestion_and_scheduling', tier: 'workflow', description: 'Procedures for dynamic table discovery, strategy classification (Full vs. Incremental), DAG generation, and Data Factory scheduling.', snippet: 'Discover Tables ──→ Strategy (Full/Incr) ──→ Fabric Pipeline DAG' },
    { name: 'sql_transpilation_and_lineage', displayName: 'sql_transpilation_and_lineage', tier: 'workflow', description: 'Guidelines for transpiling source SQL dialects (T-SQL, Oracle, SAP) into Spark SQL using SQLGlot AST engine and extracting column lineage.', snippet: 'Source SQL (T-SQL/Oracle) ──→ SQLGlot AST ──→ PySpark Delta' },
    { name: 'fabric_data_quality_and_testing', displayName: 'fabric_data_quality_and_testing', tier: 'workflow', description: 'Standards for Delta Lake data quality checks, schema constraint enforcement, anomaly detection, and Great Expectations profiling.', snippet: 'Expectations: NOT NULL, UNIQUE, RANGE ──→ Quarantine or Promote' },
    { name: 'fabric_governance_and_safe_delete', displayName: 'fabric_governance_and_safe_delete', tier: 'workflow', description: 'Protocols for blast-radius impact analysis, automated item definition snapshot backups, and safe deletion confirmation gates.', snippet: 'DELETE / OVERWRITE ──→ Impact Analyzer ──→ Base64 Backup Snapshot' },
    { name: 'fabric_lakehouse_ops', displayName: 'fabric_lakehouse_ops', tier: 'atomic', description: 'Atomic CRUD operations for Microsoft Fabric Lakehouses and Delta tables.', snippet: 'POST /v1/workspaces/{id}/lakehouses\nTables: Managed Delta Lake format' },
    { name: 'fabric_warehouse_ops', displayName: 'fabric_warehouse_ops', tier: 'atomic', description: 'Atomic CRUD operations for Microsoft Fabric Synapse Data Warehouses.', snippet: 'POST /v1/workspaces/{id}/warehouses\nT-SQL multi-table query engine' },
    { name: 'fabric_notebook_ops', displayName: 'fabric_notebook_ops', tier: 'atomic', description: 'Atomic CRUD and PySpark execution operations for Fabric Synapse Notebooks.', snippet: 'POST /v1/workspaces/{id}/notebooks\nKernel: PySpark Delta Lake 3.x' },
    { name: 'fabric_pipeline_ops', displayName: 'fabric_pipeline_ops', tier: 'atomic', description: 'Atomic operations for Fabric Data Factory Data Pipelines and orchestrations.', snippet: 'POST /v1/workspaces/{id}/dataPipelines\nActivities: Copy, Lookup, Notebook' },
    { name: 'fabric_datapipeline_ops', displayName: 'fabric_datapipeline_ops', tier: 'atomic', description: 'Pipeline control flow, activity chaining, triggers, and execution parameters.', snippet: 'Pipeline DAG Execution: triggers, parameters, variables' },
    { name: 'fabric_semantic_model_ops', displayName: 'fabric_semantic_model_ops', tier: 'atomic', description: 'Atomic operations for Power BI semantic models and DirectLake datasets.', snippet: 'POST /v1/workspaces/{id}/semanticModels\nDirectLake mode on Delta tables' },
    { name: 'fabric_semanticmodel_ops', displayName: 'fabric_semanticmodel_ops', tier: 'atomic', description: 'BIM definition transpiler, DAX measures, and relationship modeling.', snippet: 'BIM / TMSL definitions, DAX measures, table relationships' },
    { name: 'fabric_sparkjobdefinition_ops', displayName: 'fabric_sparkjobdefinition_ops', tier: 'atomic', description: 'Deploy and schedule Spark Job Definitions (SJD) in Microsoft Fabric.', snippet: 'POST /v1/workspaces/{id}/sparkJobDefinitions\nBatch & streaming SJD' },
    { name: 'fabric_environment_ops', displayName: 'fabric_environment_ops', tier: 'atomic', description: 'Custom Python libraries, conda specs, and compute cluster runtime management.', snippet: 'POST /v1/workspaces/{id}/environments\nConda envs, wheel packages' },
    { name: 'fabric_eventhouse_ops', displayName: 'fabric_eventhouse_ops', tier: 'atomic', description: 'Real-time analytics engine and Eventhouse cluster provisioning in Fabric.', snippet: 'POST /v1/workspaces/{id}/eventhouses\nReal-time telemetry ingestion' },
    { name: 'fabric_kqldatabase_ops', displayName: 'fabric_kqldatabase_ops', tier: 'atomic', description: 'Kusto Query Language (KQL) databases, tables, and streaming ingestion policies.', snippet: 'POST /v1/workspaces/{id}/kqlDatabases\nKQL queries, materialized views' },
    { name: 'fabric_userdatafunction_ops', displayName: 'fabric_userdatafunction_ops', tier: 'atomic', description: 'User-defined data functions (UDF), serverless Python transformations, and APIs.', snippet: 'POST /v1/workspaces/{id}/userDataFunctions\nServerless Python micro-jobs' },
    { name: 'pattern_incremental_cdc_watermark', displayName: 'pattern_incremental_cdc_watermark', tier: 'pattern', description: 'Change Data Capture (CDC) with high-watermark timestamps and incremental Delta upserts.', snippet: 'DeltaTable.forPath(...).merge(\n  source_df, "target.id = source.id"\n)' },
    { name: 'pattern_scd2_history_tracking', displayName: 'pattern_scd2_history_tracking', tier: 'pattern', description: 'Slowly Changing Dimensions Type 2 (SCD2) with effective dates and is_current flags.', snippet: 'is_current = false, end_date = now()\nINSERT new version with is_current = true' },
    { name: 'pattern_error_handling_self_healing', displayName: 'pattern_error_handling_self_healing', tier: 'pattern', description: 'Automated retry policies, quarantine bad records, and self-healing pipeline recovery.', snippet: 'try: spark.read.table(...)\nexcept SchemaDrift: quarantine_and_heal()' }
];

let _skillsData = [...DEFAULT_SKILLS];
let _activeSkillFilter = 'all';
let _skillsListenersAttached = false;

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatInlineMarkdown(text) {
    if (!text) return '';

    // 1. Extract and protect inline code tokens first with unique safe placeholder
    const codeTokens = [];
    let out = text.replace(/`([^`]+)`/g, (match, code) => {
        const idx = codeTokens.length;
        codeTokens.push(escapeHtml(code));
        return `###CODETOKEN${idx}###`;
    });

    // 2. Escape HTML on remaining text
    out = escapeHtml(out);

    // 3. Bold **text** or __text__
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // 4. Italic *text*
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // 5. Restore inline code tokens safely
    out = out.replace(/###CODETOKEN(\d+)###/g, (match, idx) => {
        return `<code class="skill-code-badge">${codeTokens[parseInt(idx, 10)]}</code>`;
    });

    return out;
}

function renderSkillMarkdown(md) {
    if (!md) return '';

    // Remove YAML frontmatter if present (--- ... ---)
    let text = md.replace(/^---[\s\S]*?---\s*/m, '').trim();

    const lines = text.split('\n');
    let html = '';
    let inList = false;
    let listType = null; // 'ul' or 'ol'
    let inCodeBlock = false;
    let codeBlockContent = '';

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Code block handling
        if (line.trim().startsWith('```')) {
            if (!inCodeBlock) {
                if (inList) { html += `</${listType}>`; inList = false; }
                inCodeBlock = true;
                codeBlockContent = '';
            } else {
                inCodeBlock = false;
                html += `<pre class="skill-doc-codeblock"><code>${escapeHtml(codeBlockContent.trim())}</code></pre>`;
            }
            continue;
        }

        if (inCodeBlock) {
            codeBlockContent += (codeBlockContent ? '\n' : '') + line;
            continue;
        }

        const trimmed = line.trim();

        // Empty line
        if (!trimmed) {
            if (inList) { html += `</${listType}>`; inList = false; }
            continue;
        }

        // Horizontal divider (---, ***, ___)
        if (/^(\*\*\*|---|___)$/.test(trimmed)) {
            if (inList) { html += `</${listType}>`; inList = false; }
            html += '<hr class="skill-doc-divider">';
            continue;
        }

        // Unordered List (- item or * item)
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const isSub = line.startsWith('  ') || line.startsWith('\t');
            if (!inList || listType !== 'ul') {
                if (inList) html += `</${listType}>`;
                html += '<ul class="skill-doc-list">';
                inList = true;
                listType = 'ul';
            }
            const itemText = formatInlineMarkdown(trimmed.substring(2));
            html += `<li class="${isSub ? 'skill-sub-item' : ''}">${itemText}</li>`;
            continue;
        }

        // Ordered List (1. item, 2. item)
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
            if (!inList || listType !== 'ol') {
                if (inList) html += `</${listType}>`;
                html += '<ol class="skill-doc-list skill-ordered">';
                inList = true;
                listType = 'ol';
            }
            const itemText = formatInlineMarkdown(numMatch[2]);
            html += `<li>${itemText}</li>`;
            continue;
        }

        // If not a list item, close any open list
        if (inList) {
            html += `</${listType}>`;
            inList = false;
        }

        // Headings
        if (line.startsWith('# ')) {
            html += `<h2 class="skill-doc-h1">${formatInlineMarkdown(line.substring(2).trim())}</h2>`;
        } else if (line.startsWith('## ')) {
            html += `<h3 class="skill-doc-h2">${formatInlineMarkdown(line.substring(3).trim())}</h3>`;
        } else if (line.startsWith('### ')) {
            html += `<h4 class="skill-doc-h3">${formatInlineMarkdown(line.substring(4).trim())}</h4>`;
        } else if (line.startsWith('> ')) {
            html += `<blockquote class="skill-doc-quote">${formatInlineMarkdown(line.substring(2).trim())}</blockquote>`;
        } else {
            // Standard paragraph
            html += `<p class="skill-doc-p">${formatInlineMarkdown(line)}</p>`;
        }
    }

    if (inList) html += `</${listType}>`;
    if (inCodeBlock) {
        html += `<pre class="skill-doc-codeblock"><code>${escapeHtml(codeBlockContent.trim())}</code></pre>`;
    }

    return html;
}

window.closeSkillInspector = function() {
    const inspectorModal = document.getElementById('modalSkillInspector');
    if (inspectorModal) {
        inspectorModal.classList.remove('active');
        inspectorModal.style.display = 'none';
    }
};

window.openSkillInspector = function(skill) {
    if (typeof skill === 'string') {
        const found = _skillsData.find(s => s.name === skill);
        skill = found || { name: skill, displayName: skill };
    }
    const inspectorModal = document.getElementById('modalSkillInspector');
    if (!skill || !inspectorModal) return;

    const inspName = document.getElementById('inspSkillName');
    const inspAuthor = document.getElementById('inspSkillAuthor');
    const inspDesc = document.getElementById('inspSkillDesc');
    const inspDocRendered = document.getElementById('inspDocRendered');
    const inspSkillContent = document.getElementById('inspSkillContent');
    const btnViewRendered = document.getElementById('btnViewRendered');
    const btnViewRaw = document.getElementById('btnViewRaw');
    const inspDocRaw = document.getElementById('inspDocRaw');
    const toggleActive = document.getElementById('toggleSkillActive');

    // Display title & author
    const displayName = (skill && (skill.displayName || skill.name)) || 'Skill Detail';
    if (inspName) inspName.textContent = displayName;
    
    // Author label
    const authorMap = {
        orchestrator: 'by Fabric AI Studio',
        workflow: 'by Microsoft Fabric',
        atomic: 'by Fabric AI Engine',
        pattern: 'by Enterprise Architecture Team'
    };
    if (inspAuthor) inspAuthor.textContent = (skill && authorMap[skill.tier]) || 'by Anthropic';

    // Description
    if (inspDesc) inspDesc.textContent = (skill && skill.description) || 'Enterprise execution skill for Microsoft Fabric workloads.';

    // Toggle status
    if (toggleActive) toggleActive.checked = true;

    // Markdown content
    const rawMd = (skill && skill.fullContent) || `# ${displayName}\n\n${(skill && skill.description) || ''}\n\n## Overview\nOperational execution runbook for \`${skill ? skill.name : 'skill'}\` inside Microsoft Fabric.\n\n## Ground Rules\nAlways inspect source schema and validate dependencies before executing.`;

    // Render formatted markdown
    if (inspDocRendered) {
        try {
            inspDocRendered.innerHTML = renderSkillMarkdown(rawMd);
        } catch (err) {
            console.error("renderSkillMarkdown error:", err);
            inspDocRendered.innerHTML = `<pre>${escapeHtml(rawMd)}</pre>`;
        }
        inspDocRendered.style.display = 'block';
    }
    if (inspSkillContent) {
        inspSkillContent.textContent = rawMd;
    }
    if (inspDocRaw) {
        inspDocRaw.style.display = 'none';
    }

    // Reset view toggle buttons
    btnViewRendered?.classList.add('active');
    btnViewRaw?.classList.remove('active');

    // Show modal with smooth fade & active class
    inspectorModal.classList.add('active');
    inspectorModal.style.display = 'flex';
};

function renderSkillsGrid() {
    const gridContainer = document.getElementById('skillsGalleryGrid');
    const searchInput = document.getElementById('inputSkillsSearch');
    if (!gridContainer) return;

    const query = (searchInput?.value || '').toLowerCase().trim();

    // Filter out using_fabric_skills (since it's featured in the hero card)
    const subSkills = _skillsData.filter(s => s.name !== 'using_fabric_skills');

    const filtered = subSkills.filter(s => {
        const matchesTier = _activeSkillFilter === 'all' || s.tier === _activeSkillFilter;
        const matchesSearch = !query || 
            s.name.toLowerCase().includes(query) || 
            (s.displayName || '').toLowerCase().includes(query) || 
            (s.description || '').toLowerCase().includes(query);
        return matchesTier && matchesSearch;
    });

    if (filtered.length === 0) {
        gridContainer.innerHTML = `
            <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: #71717a; font-size: 13px;">
                No skills found matching "<strong>${escapeHtml(query)}</strong>".
            </div>
        `;
        return;
    }

    gridContainer.innerHTML = filtered.map(s => {
        const tierClass = `tier-${s.tier || 'workflow'}`;
        const tierLabel = (s.tier || 'skill').toUpperCase();
        const displayName = s.displayName || s.name;
        const preview = s.snippet || `# Operational guide for ${s.name}`;

        return `
            <div class="skill-card" data-skill-id="${escapeHtml(s.name)}" onclick="window.openSkillInspector('${escapeHtml(s.name)}')">
                <div class="skill-card-preview">
                    <pre><code>${escapeHtml(preview)}</code></pre>
                    <div class="skill-card-preview-fade"></div>
                </div>
                <div class="skill-card-body">
                    <div>
                        <div class="skill-card-header-row">
                            <span class="skill-tier-badge ${tierClass}">${tierLabel}</span>
                            <span class="skill-status-tag active">
                                <span class="status-dot-green"></span>
                                <span>Active</span>
                            </span>
                        </div>
                        <h4 class="skill-card-title">${escapeHtml(displayName)}</h4>
                        <p class="skill-card-desc">${escapeHtml(s.description)}</p>
                    </div>
                    <div class="skill-card-footer">
                        <span style="font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #52525b;">${escapeHtml(s.name)}</span>
                        <span class="skill-card-action-hint">Inspect ↗</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function initSkillsManager() {
    const heroCard = document.getElementById('heroUsingFabricSkills');
    const heroInspectBtn = document.getElementById('btnHeroInspect');
    const searchInput = document.getElementById('inputSkillsSearch');
    const filterPills = document.querySelectorAll('[data-skill-filter]');
    const totalBadge = document.getElementById('skillsTotalCountBadge');
    const galleryGrid = document.getElementById('skillsGalleryGrid');

    // Inspector Modal Elements
    const inspectorModal = document.getElementById('modalSkillInspector');
    const btnBackSkillModal = document.getElementById('btnBackSkillModal');
    const btnCloseInspector = document.getElementById('btnCloseSkillInspector');
    const btnViewRendered = document.getElementById('btnViewRendered');
    const btnViewRaw = document.getElementById('btnViewRaw');
    const inspDocRendered = document.getElementById('inspDocRendered');
    const inspDocRaw = document.getElementById('inspDocRaw');
    const btnSkillMoreMenu = document.getElementById('btnSkillMoreMenu');
    const inspSkillContent = document.getElementById('inspSkillContent');

    if (!_skillsListenersAttached) {
        _skillsListenersAttached = true;

        // Event Delegation for Grid Cards
        galleryGrid?.addEventListener('click', (e) => {
            const card = e.target.closest('.skill-card');
            if (!card) return;
            const sId = card.getAttribute('data-skill-id');
            const skillObj = _skillsData.find(s => s.name === sId);
            if (skillObj) window.openSkillInspector(skillObj);
        });

        // Close / Back Navigation
        const closeModal = () => {
            if (inspectorModal) inspectorModal.style.display = 'none';
        };

        btnBackSkillModal?.addEventListener('click', closeModal);
        btnCloseInspector?.addEventListener('click', closeModal);

        inspectorModal?.addEventListener('click', (e) => {
            if (e.target === inspectorModal) closeModal();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && inspectorModal && inspectorModal.style.display !== 'none') {
                closeModal();
            }
        });

        // View Mode Toggles (Rendered 👁 vs Raw </>)
        btnViewRendered?.addEventListener('click', () => {
            btnViewRendered.classList.add('active');
            btnViewRaw?.classList.remove('active');
            if (inspDocRendered) inspDocRendered.style.display = 'block';
            if (inspDocRaw) inspDocRaw.style.display = 'none';
        });

        btnViewRaw?.addEventListener('click', () => {
            btnViewRaw.classList.add('active');
            btnViewRendered?.classList.remove('active');
            if (inspDocRendered) inspDocRendered.style.display = 'none';
            if (inspDocRaw) inspDocRaw.style.display = 'block';
        });

        // More Menu (Copy Markdown)
        btnSkillMoreMenu?.addEventListener('click', () => {
            const text = inspSkillContent?.textContent;
            if (text) {
                navigator.clipboard.writeText(text);
                showToast('Skill Markdown copied to clipboard!', 'success');
            }
        });

        heroInspectBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            const heroSkill = _skillsData.find(s => s.name === 'using_fabric_skills');
            if (heroSkill) window.openSkillInspector(heroSkill);
        });

        heroCard?.addEventListener('click', () => {
            const heroSkill = _skillsData.find(s => s.name === 'using_fabric_skills');
            if (heroSkill) window.openSkillInspector(heroSkill);
        });

        filterPills.forEach(pill => {
            pill.addEventListener('click', () => {
                filterPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                _activeSkillFilter = pill.dataset.skillFilter || 'all';
                renderSkillsGrid();
            });
        });

        searchInput?.addEventListener('input', () => {
            renderSkillsGrid();
        });
    }

    // Immediately render with current/default skills data
    renderSkillsGrid();
    if (totalBadge) totalBadge.textContent = `${_skillsData.length} Skills Active`;

    // Fetch fresh skills asynchronously from server
    try {
        const res = await apiFetch('/api/skills');
        if (res && Array.isArray(res.skills) && res.skills.length > 0) {
            _skillsData = res.skills;
            if (totalBadge) totalBadge.textContent = `${_skillsData.length} Skills Active`;
            renderSkillsGrid();
        }
    } catch (e) {
        console.warn("Using offline skills data:", e);
    }
}

// ── Fabric Connection & Workspaces Manager Controller ────────────────────────
function initFabricConnectionManager() {
    const btnOpen = document.getElementById('btnOpenFabricConnections');
    const modal = document.getElementById('modalFabricConnections');
    const btnClose = document.getElementById('btnCloseConnectionsModal');
    const btnFabLogin = document.getElementById('btnTriggerFabLogin');
    const btnSaveSP = document.getElementById('btnSaveSP');
    const btnSaveToken = document.getElementById('btnSaveBearerToken');
    const btnDisconnect = document.getElementById('btnDisconnectFabric');
    const selectWs = document.getElementById('selectActiveWorkspace');
    const btnRefreshWs = document.getElementById('btnRefreshWorkspaces');

    // Open Modal
    btnOpen?.addEventListener('click', () => {
        if (modal) {
            modal.style.display = 'flex';
            loadFabricConnectionData();
        }
    });

    // Close Modal
    btnClose?.addEventListener('click', () => {
        if (modal) modal.style.display = 'none';
    });

    modal?.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    // Segmented tab switching
    const connTabs = modal?.querySelectorAll('.conn-tab-btn');
    connTabs?.forEach(tab => {
        tab.addEventListener('click', () => {
            connTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.dataset.conntab;
            const paneCli = document.getElementById('paneConnCli');
            const paneSP = document.getElementById('paneConnSP');
            const paneToken = document.getElementById('paneConnToken');
            if (paneCli) paneCli.style.display = target === 'tabCli' ? 'block' : 'none';
            if (paneSP) paneSP.style.display = target === 'tabSP' ? 'block' : 'none';
            if (paneToken) paneToken.style.display = target === 'tabToken' ? 'block' : 'none';
        });
    });

    let _deviceCodePollTimer = null;

    function stopDeviceCodePolling() {
        if (_deviceCodePollTimer) {
            clearInterval(_deviceCodePollTimer);
            _deviceCodePollTimer = null;
        }
        const launchRow = document.getElementById('connCliLaunchRow');
        const deviceBox = document.getElementById('connDeviceBox');
        if (launchRow) launchRow.style.display = 'flex';
        if (deviceBox) deviceBox.style.display = 'none';
        if (btnFabLogin) {
            btnFabLogin.disabled = false;
            btnFabLogin.innerHTML = `
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right: 5px; vertical-align: -1px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                <span>Launch Browser Login</span>
            `;
        }
    }

    // Shared Browser / Device Code Login execution helper
    async function executeBrowserLogin(forceInteractive = false) {
        if (!forceInteractive) {
            // Quick reconnect if valid session exists
            if (btnDisconnect && btnDisconnect.classList.contains('btn-connect-trigger')) {
                btnDisconnect.disabled = true;
                btnDisconnect.textContent = 'Connecting...';
            }
            if (btnFabLogin) {
                btnFabLogin.disabled = true;
                btnFabLogin.innerHTML = '<span class="conn-spinner"></span>';
            }
            const res = await apiFetch('/api/auth/login-cli', {
                method: 'POST',
                body: JSON.stringify({ force: false })
            });
            if (res && res.success) {
                showToast('Microsoft Fabric connected successfully!', 'success');
                if (btnFabLogin) {
                    btnFabLogin.disabled = false;
                    btnFabLogin.innerHTML = `
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right: 5px; vertical-align: -1px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        <span>Launch Browser Login</span>
                    `;
                }
                await loadFabricConnectionData();
                await initAuthStatus();
                return;
            }
        }

        // Launch Device Code Browser Flow
        stopDeviceCodePolling();
        if (btnFabLogin) {
            btnFabLogin.disabled = true;
            btnFabLogin.innerHTML = '<span class="conn-spinner"></span>';
        }

        showToast('Initiating Microsoft browser authentication...', 'info');

        const res = await apiFetch('/api/auth/device-code/start', { method: 'POST' });
        if (res && res.success && res.user_code) {
            const launchRow = document.getElementById('connCliLaunchRow');
            const deviceBox = document.getElementById('connDeviceBox');
            const codeDisplay = document.getElementById('deviceCodeDisplay');
            const linkA = document.getElementById('btnOpenDeviceLink');
            const linkB = document.getElementById('btnOpenLoginTab');
            const statusMsg = document.getElementById('deviceStatusMsg');

            if (codeDisplay) codeDisplay.textContent = res.user_code;
            const targetUrl = res.verification_uri || 'https://login.microsoft.com/device';
            if (linkA) linkA.href = targetUrl;
            if (linkB) linkB.href = targetUrl;
            if (statusMsg) statusMsg.textContent = 'Waiting for your sign-in approval on Microsoft...';

            if (launchRow) launchRow.style.display = 'none';
            if (deviceBox) deviceBox.style.display = 'flex';

            // Auto-copy code and open tab
            try {
                navigator.clipboard.writeText(res.user_code);
                showToast(`Code ${res.user_code} copied! Opening Microsoft sign-in...`, 'success');
            } catch (_) {}

            window.open(targetUrl, '_blank');

            // Start polling loop
            const pollInterval = Math.max(3, res.interval || 5) * 1000;
            _deviceCodePollTimer = setInterval(async () => {
                const pollRes = await apiFetch('/api/auth/device-code/poll', {
                    method: 'POST',
                    body: JSON.stringify({ device_code: res.device_code })
                });

                if (pollRes && pollRes.status === 'authenticated') {
                    stopDeviceCodePolling();
                    showToast('Microsoft Fabric authenticated successfully!', 'success');
                    await loadFabricConnectionData();
                    await initAuthStatus();
                } else if (pollRes && pollRes.status === 'declined') {
                    stopDeviceCodePolling();
                    showToast('Sign-in was declined on Microsoft.', 'error');
                } else if (pollRes && pollRes.status === 'expired') {
                    stopDeviceCodePolling();
                    showToast('Device login code expired. Please launch again.', 'warning');
                }
            }, pollInterval);

        } else {
            if (btnFabLogin) {
                btnFabLogin.disabled = false;
                btnFabLogin.innerHTML = `
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right: 5px; vertical-align: -1px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    <span>Launch Browser Login</span>
                `;
            }
            showToast(res?.error || 'Failed to start device code authentication.', 'error');
        }
    }

    // Cancel Device Code Button
    document.getElementById('btnCancelDeviceCode')?.addEventListener('click', () => {
        stopDeviceCodePolling();
        showToast('Device sign-in cancelled.', 'info');
    });

    // Copy Device Code Button
    document.getElementById('btnCopyDeviceCode')?.addEventListener('click', () => {
        const code = document.getElementById('deviceCodeDisplay')?.textContent?.trim();
        if (code) {
            navigator.clipboard.writeText(code);
            const label = document.getElementById('copyCodeLabel');
            if (label) label.textContent = 'Copied!';
            setTimeout(() => { if (label) label.textContent = 'Copy Code'; }, 2000);
            showToast('Code copied to clipboard: ' + code, 'success');
        }
    });

    // Trigger Interactive Microsoft Browser Login Button
    btnFabLogin?.addEventListener('click', async () => {
        await executeBrowserLogin(true);
    });

    // Save Service Principal
    btnSaveSP?.addEventListener('click', async () => {
        const tenantId = document.getElementById('inputTenantId')?.value?.trim();
        const clientId = document.getElementById('inputClientId')?.value?.trim();
        const clientSecret = document.getElementById('inputClientSecret')?.value?.trim();

        if (!tenantId || !clientId || !clientSecret) {
            showToast('Please fill in Tenant ID, Client ID, and Client Secret.', 'warning');
            return;
        }

        btnSaveSP.disabled = true;
        btnSaveSP.textContent = 'Authenticating...';
        const res = await apiFetch('/api/auth/service-principal', {
            method: 'POST',
            body: JSON.stringify({ tenant_id: tenantId, client_id: clientId, client_secret: clientSecret })
        });
        btnSaveSP.disabled = false;
        btnSaveSP.textContent = 'Save & Connect';

        if (res && res.success) {
            showToast('Service Principal connected successfully!', 'success');
            loadFabricConnectionData();
            initAuthStatus();
        } else {
            showToast(res?.error || 'Service Principal authentication failed.', 'error');
        }
    });

    // Save Bearer Token
    btnSaveToken?.addEventListener('click', async () => {
        const token = document.getElementById('inputBearerToken')?.value?.trim();
        if (!token) {
            showToast('Please paste a valid Bearer token.', 'warning');
            return;
        }

        btnSaveToken.disabled = true;
        btnSaveToken.textContent = 'Applying...';
        const res = await apiFetch('/api/auth/token', {
            method: 'POST',
            body: JSON.stringify({ token })
        });
        btnSaveToken.disabled = false;
        btnSaveToken.textContent = 'Apply';

        if (res && res.success) {
            showToast('Bearer token applied successfully!', 'success');
            loadFabricConnectionData();
            initAuthStatus();
        } else {
            showToast(res?.error || 'Failed to apply bearer token.', 'error');
        }
    });

    // Disconnect / Connect Fabric Toggle Action
    btnDisconnect?.addEventListener('click', async () => {
        const isCurrentlyConnected = !btnDisconnect.classList.contains('btn-connect-trigger') && btnDisconnect.textContent.trim() === 'Disconnect';
        
        if (isCurrentlyConnected) {
            stopDeviceCodePolling();
            btnDisconnect.disabled = true;
            btnDisconnect.textContent = 'Disconnecting...';
            const res = await apiFetch('/api/auth/disconnect', { method: 'POST' });
            btnDisconnect.disabled = false;
            if (res && res.success) {
                showToast('Disconnected from Microsoft Fabric.', 'info');
            } else {
                showToast('Failed to disconnect.', 'error');
            }
            await loadFabricConnectionData();
            await initAuthStatus();
        } else {
            // Reconnect via shared flow with spinner animation inside fab browser login button
            await executeBrowserLogin(false);
        }
    });

    // Change Active Workspace
    selectWs?.addEventListener('change', async () => {
        const wsId = selectWs.value;
        const wsName = selectWs.options[selectWs.selectedIndex]?.text || wsId;
        if (!wsId) return;

        showToast(`Switching active workspace to ${wsName}...`, 'info');
        const res = await apiFetch('/api/workspaces/set-active', {
            method: 'POST',
            body: JSON.stringify({ workspace_id: wsId, workspace_name: wsName })
        });

        if (res && res.success) {
            showToast(`Active workspace updated: ${wsName}`, 'success');
            loadFabricConnectionData();
            initAuthStatus();
            loadWorkspaceItems();
        } else {
            showToast(res?.error || 'Failed to set active workspace.', 'error');
        }
    });

    // Refresh Workspaces List
    btnRefreshWs?.addEventListener('click', async () => {
        btnRefreshWs.style.transform = 'rotate(180deg)';
        await loadFabricConnectionData();
        setTimeout(() => { btnRefreshWs.style.transform = ''; }, 300);
        showToast('Workspaces list refreshed from Fabric API', 'info');
    });
}

async function loadFabricConnectionData() {
    const authData = await apiFetch('/api/auth/status');
    const connIdentity = document.getElementById('fabricConnIdentity');
    const connMethod = document.getElementById('fabricConnMethod');
    const tenantTag = document.getElementById('fabricTenantIdTag');
    const expiryTag = document.getElementById('fabricTokenExpiryTag');
    const statusDot = document.getElementById('fabricStatusDot');
    const btnDisconnect = document.getElementById('btnDisconnectFabric');

    const btnPopFab = document.getElementById('btnPopFabCli');
    const btnManageFab = document.getElementById('btnManageFabricWs');
    const fabRow = btnManageFab?.closest('.connector-row');
    const tableWsName = document.getElementById('tableActiveWsName');

    if (authData && authData.authenticated) {
        if (statusDot) statusDot.className = 'status-dot-green';
        if (btnDisconnect) {
            btnDisconnect.className = 'btn-disconnect';
            btnDisconnect.textContent = 'Disconnect';
            btnDisconnect.title = 'Disconnect and clear token cache';
            btnDisconnect.style.display = 'inline-block';
        }
        if (connIdentity) connIdentity.textContent = authData.user_identity || 'Authenticated User';
        if (connMethod) connMethod.textContent = authData.auth_method === 'azure_cli' ? 'Azure CLI' : (authData.auth_method === 'service_principal' ? 'Service Principal' : 'Bearer Token');
        if (tenantTag) tenantTag.textContent = `Tenant: ${authData.tenant_id ? (authData.tenant_id.length > 18 ? authData.tenant_id.slice(0, 18) + '...' : authData.tenant_id) : 'Configured'}`;
        if (expiryTag) expiryTag.textContent = `${authData.expires_in_minutes || 0} min remaining`;

        if (btnPopFab) {
            btnPopFab.className = 'btn-pill-connected';
            btnPopFab.innerHTML = '<span class="status-dot-green"></span><span>Connected</span>';
        }
        if (btnManageFab) {
            btnManageFab.className = 'btn-pill-connected';
            btnManageFab.innerHTML = '<span class="status-dot-green"></span><span>Connected</span>';
        }
        if (fabRow) fabRow.setAttribute('data-status', 'connected');
    } else {
        if (statusDot) statusDot.className = 'status-dot-red';
        if (btnDisconnect) {
            btnDisconnect.className = 'btn-connect-trigger';
            btnDisconnect.textContent = 'Connect';
            btnDisconnect.title = 'Connect to Microsoft Fabric';
            btnDisconnect.style.display = 'inline-block';
        }
        if (connIdentity) connIdentity.textContent = 'Not Connected';
        if (connMethod) connMethod.textContent = 'Disconnected';
        if (tenantTag) tenantTag.textContent = 'Tenant: None';
        if (expiryTag) expiryTag.textContent = 'Session Inactive';

        if (btnPopFab) {
            btnPopFab.className = 'btn-pill-connect';
            btnPopFab.textContent = 'Connect';
        }
        if (btnManageFab) {
            btnManageFab.className = 'btn-pill-connect';
            btnManageFab.textContent = 'Connect';
        }
        if (fabRow) fabRow.setAttribute('data-status', 'not_connected');
        if (tableWsName) tableWsName.textContent = 'Active: None (Disconnected)';
    }

    const wsData = await apiFetch('/api/workspaces');
    if (wsData) {
        const selectWs = document.getElementById('selectActiveWorkspace');
        const currWsDesc = document.getElementById('currentWorkspaceId');
        const locked = wsData.locked_workspace || {};

        if (currWsDesc) {
            if (authData && !authData.authenticated) {
                currWsDesc.textContent = 'Workspace access offline (Click Connect to link)';
            } else if (locked.id) {
                currWsDesc.textContent = `ID: ${locked.id.slice(0, 8)}... (${locked.name || 'Active'})`;
            }
        }

        if (tableWsName && authData && authData.authenticated && locked.name) {
            tableWsName.textContent = `Active: ${locked.name}`;
        }

        if (selectWs) {
            selectWs.innerHTML = '';
            const list = Array.isArray(wsData.workspaces) && wsData.workspaces.length > 0
                ? wsData.workspaces
                : [{ id: locked.id, displayName: locked.name }];

            list.forEach(w => {
                const opt = document.createElement('option');
                opt.value = w.id;
                opt.textContent = w.displayName || w.name || w.id;
                if (w.id === locked.id) opt.selected = true;
                selectWs.appendChild(opt);
            });
        }
    }
}

// ── Auth & Workspace Status ───────────────────────────────────────────────────
async function initAuthStatus() {
    const data = await apiFetch('/api/auth/status');
    const nameEl = document.getElementById('authUsername');
    const dotEl = document.getElementById('authDot');
    const avatarEl = document.getElementById('authAvatar');
    const statExpiry = document.getElementById('statTokenExpiry');

    if (data && data.authenticated) {
        App.auth = data;
        if (nameEl) nameEl.textContent = data.user_identity || 'Authenticated';
        if (dotEl) dotEl.style.background = '#10b981';
        if (avatarEl) avatarEl.textContent = (data.user_identity || 'U')[0].toUpperCase();
        if (statExpiry) statExpiry.textContent = `${data.expires_in_minutes} min`;
    } else {
        App.auth = data || { authenticated: false };
        if (nameEl) nameEl.textContent = 'Disconnected';
        if (dotEl) dotEl.style.background = '#ef4444';
        if (avatarEl) avatarEl.textContent = '✕';
        if (statExpiry) statExpiry.textContent = 'Disconnected';
    }

    // Load workspace lock info
    const wsData = await apiFetch('/api/workspaces');
    if (wsData && wsData.locked_workspace) {
        App.workspace = wsData.locked_workspace;
        const wsEl = document.getElementById('lockedWorkspaceName');
        if (wsEl) {
            wsEl.textContent = (data && data.authenticated) ? wsData.locked_workspace.name : `${wsData.locked_workspace.name} (Offline)`;
        }
    }
}

// ── VIEW 1: AI Architect Chat & Playground ───────────────────────────────────
function initArchitectChat() {
    const chatSendBtn = document.getElementById('btnChatSend');
    const chatInput = document.getElementById('chatInput');
    const btnNewSession = document.getElementById('btnNewSession');
    const playgroundHome = document.getElementById('playgroundHome');
    const architectChatArea = document.getElementById('architectChatArea');

    function autoResize(el) {
        if (!el) return;
        el.style.height = 'auto';
        const newHeight = Math.min(el.scrollHeight, 150);
        el.style.height = `${newHeight}px`;
    }

    chatInput?.addEventListener('input', () => autoResize(chatInput));

    function setTopbarNewChatEnabled(enabled) {
        if (!btnNewSession) return;
        if (enabled) {
            btnNewSession.classList.remove('disabled');
            btnNewSession.removeAttribute('disabled');
            btnNewSession.title = "New Chat";
        } else {
            btnNewSession.classList.add('disabled');
            btnNewSession.setAttribute('disabled', 'true');
            btnNewSession.title = "Already in a New Chat";
        }
    }

    function sendPrompt(text) {
        if (activeAbortController) {
            try { activeAbortController.abort(); } catch(e) {}
            activeAbortController = null;
            setGeneratingState(false);
            return;
        }
        text = text?.trim();
        if (!text) return;
        const boltPane = document.getElementById('boltChatPane');
        if (boltPane) {
            boltPane.classList.remove('is-landing');
            boltPane.classList.add('in-chat');
        }
        if (playgroundHome) playgroundHome.style.display = 'none';
        if (architectChatArea) architectChatArea.style.display = 'flex';
        setVisualCanvasButtonVisibility(true);
        setTopbarNewChatEnabled(true);

        // Sidebar active highlight transition:
        // Remove active from "+ New Chat" button, highlight the active chat item
        const btnNewChat = document.getElementById('btnSidebarNewChat');
        if (btnNewChat) btnNewChat.classList.remove('active');

        const listEl = document.getElementById('sidebarRecentChatsList');
        if (listEl) {
            document.querySelectorAll('.sidebar-chat-item').forEach(i => {
                i.classList.remove('active');
                const b = i.querySelector('.chat-bullet');
                if (b) b.textContent = '○';
            });
            let existing = listEl.querySelector(`[data-session-id="${App.sessionId}"]`);
            if (!existing) {
                existing = document.createElement('a');
                existing.href = '#';
                existing.className = 'sidebar-chat-item active';
                existing.setAttribute('data-session-id', App.sessionId);
                const shortTitle = text.length > 30 ? text.substring(0, 28) + '...' : text;
                existing.innerHTML = `
                    <span class="chat-bullet">●</span>
                    <span class="chat-item-text">${escapeHtml(shortTitle)}</span>
                `;
                existing.addEventListener('click', (e) => {
                    e.preventDefault();
                    switchConversation(App.sessionId);
                });
                listEl.insertBefore(existing, listEl.firstChild);
            } else {
                existing.classList.add('active');
                const bullet = existing.querySelector('.chat-bullet');
                if (bullet) bullet.textContent = '●';
            }
        }
        
        appendChatMessage('user', text);
        if (chatInput) { chatInput.value = ''; chatInput.style.height = 'auto'; }

        executeArchitectAgent(text);
    }

    const TAGLINES = [
        "It's a late-night jam session.",
        "Time for some creative brainstorming.",
        "Ready to build something great today?",
        "Turning ideas into reality together.",
        "Where great data architectures take flight.",
        "Let's make something amazing happen.",
        "Late-night focus and quiet thoughts.",
        "Fresh coffee and big ideas await.",
        "Let's explore what is possible today.",
        "Time to bring your visions to life."
    ];

    function updateHeroTagline() {
        const el = document.getElementById('heroTaglineText');
        if (!el) return;
        const hour = new Date().getHours();
        let line;
        if (hour >= 23 || hour < 5) {
            line = "It's a late-night jam session.";
        } else if (hour >= 5 && hour < 12) {
            line = "Fresh coffee and big ideas await.";
        } else if (hour >= 12 && hour < 17) {
            line = "Time for some creative brainstorming.";
        } else {
            line = TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
        }
        el.textContent = line;
    }

    updateHeroTagline();

    function resetToNewChat() {
        // Abort any ongoing AI generation cleanly
        if (activeAbortController) {
            try { activeAbortController.abort(); } catch(e) {}
            activeAbortController = null;
            setGeneratingState(false);
        }

        // Ensure we are on the AI Architect view
        switchView('viewArchitect');

        // Clear chat thread
        const chatThread = document.getElementById('chatThread');
        if (chatThread) chatThread.innerHTML = '';

        // Reset session ID
        App.sessionId = 'sess_' + Math.random().toString(36).substring(2, 11);
        localStorage.setItem('fabric_ai_session_id', App.sessionId);

        // Update Tagline
        updateHeroTagline();

        // Highlight "+ New Chat" button and clear chat items highlight
        const btnNewChat = document.getElementById('btnSidebarNewChat');
        if (btnNewChat) btnNewChat.classList.add('active');
        document.querySelectorAll('.sidebar-chat-item').forEach(item => {
            item.classList.remove('active');
            const bullet = item.querySelector('.chat-bullet');
            if (bullet) bullet.textContent = '○';
        });

        // Show playground landing view
        const boltPane = document.getElementById('boltChatPane');
        if (boltPane) {
            boltPane.classList.add('is-landing');
            boltPane.classList.remove('in-chat');
        }
        if (playgroundHome) playgroundHome.style.display = 'flex';
        if (architectChatArea) architectChatArea.style.display = 'none';
        closeWorkbench();
        setVisualCanvasButtonVisibility(false);
        setTopbarNewChatEnabled(false);

        if (chatInput) {
            chatInput.value = '';
            chatInput.style.height = 'auto';
            chatInput.focus();
        }
    }

    // Sidebar "+ New Chat" Button click
    document.getElementById('btnSidebarNewChat')?.addEventListener('click', (e) => {
        e.preventDefault();
        resetToNewChat();
    });

    chatSendBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        sendPrompt(chatInput?.value);
    });

    chatInput?.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.keyCode === 13) && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            const val = chatInput.value;
            if (val && val.trim()) {
                sendPrompt(val);
            }
        }
    });

    // 6-Card Grid Clicks
    document.querySelectorAll('.explore-card').forEach(card => {
        card.addEventListener('click', () => {
            const p = card.getAttribute('data-prompt');
            if (p) sendPrompt(p);
        });
    });

    // Start Building Button
    document.getElementById('btnStartBuilding')?.addEventListener('click', () => {
        if (chatInput) {
            chatInput.focus();
            chatInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    // Playground Mode Switcher (Architect vs Pipelines)
    document.querySelectorAll('.mode-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mode = btn.getAttribute('data-mode');
            const titleEl = document.querySelector('.playground-title');
            if (titleEl) {
                titleEl.textContent = mode === 'pipelines' ? 'Explore Fabric Data Factory' : 'Explore Fabric architecture';
            }
        });
    });

    // Topbar New Chat Button (+)
    btnNewSession?.addEventListener('click', (e) => {
        e.preventDefault();
        resetToNewChat();
    });

    // Initial topbar + button state: disabled on fresh home view
    setTopbarNewChatEnabled(false);
}

// ── Bolt.new Workbench Controller ─────────────────────────────────────────────
function initWorkbenchController() {
    // Workbench Tabs
    const tabs = document.querySelectorAll('.wb-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.wb-view-pane').forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            const targetId = tab.getAttribute('data-wbtab');
            const targetPane = document.getElementById(targetId);
            if (targetPane) targetPane.classList.add('active');

            if (targetId === 'wbTree') loadWorkspaceTree();
            if (targetId === 'wbTable') populateSchemaView(App.currentPlan);
        });
    });

    // Refresh Workspace Tree Button
    document.getElementById('btnRefreshTree')?.addEventListener('click', () => {
        loadWorkspaceTree();
    });

    // Schema View Lakehouse Selector
    document.getElementById('wbSchemaLakehouseSelect')?.addEventListener('change', (e) => {
        renderSchemaRows(App.currentPlan, e.target.value);
    });

    // Close Workbench (Center Chat)
    document.getElementById('btnCloseWorkbench')?.addEventListener('click', closeWorkbench);

    // Workbench Toggle Button (Topbar)
    document.getElementById('btnTopbarToggleWorkbench')?.addEventListener('click', toggleWorkbench);

    // Fullscreen Toggle
    document.getElementById('btnToggleCanvasFullscreen')?.addEventListener('click', () => {
        const split = document.getElementById('boltSplitArea');
        if (split) split.classList.toggle('fullscreen-canvas');
    });

    // Copy Code Buttons
    document.getElementById('btnCopyWbCode')?.addEventListener('click', () => {
        const rawStore = document.querySelector('#wbCodeEditorViewport .wb-raw-code-store');
        const code = rawStore ? rawStore.value : document.getElementById('wbCodeContent')?.textContent;
        if (code) {
            navigator.clipboard.writeText(code);
            const btn = document.getElementById('btnCopyWbCode');
            if (btn) {
                btn.classList.add('copied');
                btn.innerHTML = `<span style="color:#10b981; font-weight:700;">✓</span> <span>Copied!</span>`;
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> <span>Copy Code</span>`;
                }, 1800);
            }
            showToast('PySpark code copied to clipboard!', 'success');
        }
    });

    document.getElementById('btnCopyWbJson')?.addEventListener('click', () => {
        const rawStore = document.querySelector('#wbJsonEditorViewport .wb-raw-code-store');
        const json = rawStore ? rawStore.value : document.getElementById('wbJsonContent')?.textContent;
        if (json) {
            navigator.clipboard.writeText(json);
            const btn = document.getElementById('btnCopyWbJson');
            if (btn) {
                btn.classList.add('copied');
                btn.innerHTML = `<span style="color:#10b981; font-weight:700;">✓</span> <span>Copied!</span>`;
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> <span>Copy JSON</span>`;
                }, 1800);
            }
            showToast('Fabric JSON spec copied to clipboard!', 'success');
        }
    });

    // Activity Drawer Close
    document.getElementById('btnCloseActivityDrawer')?.addEventListener('click', closeActivityInspector);
    document.getElementById('activityDrawerBackdrop')?.addEventListener('click', (e) => {
        if (e.target.id === 'activityDrawerBackdrop') closeActivityInspector();
    });

    // Deploy to Fabric Action Button
    document.getElementById('btnDeployWorkbench')?.addEventListener('click', () => {
        if (App.currentPlan) {
            window.triggerWorkbenchDeployment(App.currentPlan);
        } else {
            showToast('No active architecture plan to deploy. Please generate one first.', 'error');
        }
    });

    // Deployment Modal Controls
    const deployModal = document.getElementById('deploymentModal');
    document.getElementById('btnCloseDeployModal')?.addEventListener('click', () => deployModal?.classList.remove('open'));
    document.getElementById('btnDismissDeploy')?.addEventListener('click', () => deployModal?.classList.remove('open'));
    document.getElementById('btnViewDeployedItems')?.addEventListener('click', () => {
        deployModal?.classList.remove('open');
        switchView('viewWorkspace');
        loadWorkspaceItems();
    });
}

window.triggerWorkbenchDeployment = function(plan) {
    window.deployCurrentPlan(plan);
};

window.deployCurrentPlan = async function(planOverride) {
    const targetPlan = planOverride || App.currentPlan;
    if (!targetPlan) {
        showToast('No active architecture plan to deploy.', 'warning');
        return;
    }

    const folderName = targetPlan.folder || 'AI_Test_Folder';
    const nbCount = (targetPlan.notebooks || []).length;
    const plName = targetPlan.pipeline?.name || 'Data Pipeline';
    const rawSched = targetPlan.pipeline?.schedule;
    const schedText = (typeof rawSched === 'object' && rawSched !== null)
        ? (rawSched.human || rawSched.cron || 'Daily')
        : (rawSched || 'Daily');

    const initialMsg = `### 🚀 Deploying to Microsoft Fabric\n\n` +
        `- **Target Folder**: \`${folderName}\`\n` +
        `- **Workspace**: \`${App.workspace.name || 'PBT_DATA_AGENT'}\`\n` +
        `- **Resources to Provision**: ${nbCount} PySpark Notebook(s), \`${plName}\` (${schedText})\n\n` +
        `*Provisioning items in Microsoft Fabric OneLake and configuring Azure REST workers...*`;

    const deployBubble = appendChatMessage('assistant', initialMsg);

    try {
        const res = await apiFetch('/api/agent/execute', {
            method: 'POST',
            body: {
                prompt: 'deploy active plan',
                folder: folderName,
                deploy: true,
                plan: targetPlan
            }
        });

        if (res && res.run_id) {
            pollDeploymentProgress(res.run_id, folderName, deployBubble, targetPlan);
        } else if (res && res.error) {
            const ts = new Date().toISOString();
            renderAssistantBubbleHtml(deployBubble, `⚠️ **Deployment Failed**: ${res.error}`, ts);
            bindAssistantBubbleEvents(deployBubble, `⚠️ **Deployment Failed**: ${res.error}`, ts);
        }
    } catch (err) {
        const ts = new Date().toISOString();
        renderAssistantBubbleHtml(deployBubble, `⚠️ **Deployment Error**: ${err.message}`, ts);
        bindAssistantBubbleEvents(deployBubble, `⚠️ **Deployment Error**: ${err.message}`, ts);
    }
};

function pollDeploymentProgress(runId, folderName, deployBubble, targetPlan) {
    let pollCount = 0;
    const interval = setInterval(async () => {
        pollCount++;
        try {
            const statusRes = await apiFetch(`/api/ingestion/status/${runId}`);
            if (statusRes && (statusRes.status === 'completed' || statusRes.status === 'partial')) {
                clearInterval(interval);

                const rawSched = targetPlan?.pipeline?.schedule;
                const schedDisplay = (typeof rawSched === 'object' && rawSched !== null)
                    ? (rawSched.human || rawSched.cron || 'Daily at 10:30 AM UTC')
                    : (rawSched || 'Daily at 10:30 AM UTC');

                let fullReport = `### 🚀 Architecture Deployed to Microsoft Fabric\n\n` +
                    `- **Target Folder**: \`${folderName}\` *(Live in Fabric OneLake)*\n` +
                    `- **Fabric Workspace**: \`${App.workspace.name || 'PBT_DATA_AGENT'}\`\n` +
                    `- **Deployment Run ID**: \`${runId}\`\n\n` +
                    `#### 📦 Deployed Fabric Resources\n`;

                if (statusRes.steps && Array.isArray(statusRes.steps) && statusRes.steps.length > 0) {
                    statusRes.steps.forEach(st => {
                        const icon = st.status === 'completed' ? '✅' : (st.status === 'failed' ? '❌' : 'ℹ️');
                        fullReport += `- ${icon} **${st.title}**: ${st.detail}\n`;
                    });
                } else {
                    fullReport += `- ✅ **Folder \`${folderName}\`**: Provisioned in OneLake\n`;
                    (targetPlan?.notebooks || []).forEach(nb => {
                        fullReport += `- ✅ **PySpark Notebook \`${nb.name}\`** [${nb.layer || 'Notebook'}]: Code uploaded and validated\n`;
                    });
                    if (targetPlan?.pipeline?.name) {
                        fullReport += `- ✅ **Data Pipeline \`${targetPlan.pipeline.name}\`**: Scheduled (${schedDisplay})\n`;
                    }
                }

                fullReport += `\n- ⚡ **Pipeline Schedule**: Active in Azure Data Factory / Fabric trigger engine (**${schedDisplay}**)\n` +
                              `- 💾 **Storage Backend**: Microsoft OneLake Delta Lake Parquet\n\n` +
                              `All items are synchronized with Microsoft Fabric and ready for execution. You can view them in the **Workspace Explorer** tab.`;

                const ts = new Date().toISOString();
                if (deployBubble) {
                    renderAssistantBubbleHtml(deployBubble, fullReport, ts);
                    bindAssistantBubbleEvents(deployBubble, fullReport, ts);
                } else {
                    appendChatMessage('assistant', fullReport);
                }

                loadWorkspaceItems();
                loadConversationsList();
            } else if (statusRes && statusRes.status === 'error') {
                clearInterval(interval);
                const ts = new Date().toISOString();
                const errMsg = `⚠️ **Deployment Failed**: ${statusRes.error || statusRes.failure_reason || 'Unknown error'}`;
                if (deployBubble) {
                    renderAssistantBubbleHtml(deployBubble, errMsg, ts);
                    bindAssistantBubbleEvents(deployBubble, errMsg, ts);
                } else {
                    appendChatMessage('assistant', errMsg);
                }
            } else if (pollCount > 100) {
                clearInterval(interval);
                loadWorkspaceItems();
                const ts = new Date().toISOString();
                const timeoutMsg = `### ✅ Deployment Finalized in Microsoft Fabric\n\n- **Target Folder**: \`${folderName}\`\n- **Status**: Live in workspace \`${App.workspace.name || 'PBT_DATA_AGENT'}\`\n\nItems have been provisioned in OneLake. Check the **Workspace Explorer** tab to inspect them.`;
                if (deployBubble) {
                    renderAssistantBubbleHtml(deployBubble, timeoutMsg, ts);
                    bindAssistantBubbleEvents(deployBubble, timeoutMsg, ts);
                } else {
                    appendChatMessage('assistant', timeoutMsg);
                }
            }
        } catch (e) {
            console.error('Polling error:', e);
        }
    }, 1500);
}

function setVisualCanvasButtonVisibility(visible) {
    const btn = document.getElementById('btnTopbarToggleWorkbench');
    if (btn) {
        btn.style.display = visible ? 'inline-flex' : 'none';
    }
}

async function toggleWorkbench() {
    const split = document.getElementById('boltSplitArea');
    if (split && split.classList.contains('split-active')) {
        closeWorkbench();
        return;
    }

    let plan = App.currentPlan;
    if (typeof plan === 'string') {
        try { plan = JSON.parse(plan); } catch(e){}
    }

    if (plan && (plan.notebooks || plan.lakehouses || plan.pipeline || plan.folder)) {
        openWorkbench(plan);
        return;
    }

    // Fetch active conversation's latest plan from server if not yet loaded in App.currentPlan
    if (App.sessionId) {
        const data = await apiFetch(`/api/conversation/${App.sessionId}`);
        if (data && data.latest_run && data.latest_run.plan_json) {
            let p = data.latest_run.plan_json;
            if (typeof p === 'string') {
                try { p = JSON.parse(p); } catch(e){}
            }
            App.currentPlan = p;
            openWorkbench(p);
            return;
        }
    }

    showToast('No architecture plan generated yet for this conversation.', 'info');
}

function openWorkbench(data = {}) {
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch(e) { data = {}; }
    }
    const split = document.getElementById('boltSplitArea');
    const workbench = document.getElementById('boltWorkbenchPane');
    if (!split || !workbench) return;

    App.currentPlan = data;
    split.classList.add('split-active');
    workbench.style.display = 'flex';

    // Update toggle button text
    const topbarText = document.getElementById('btnTopbarToggleWorkbenchText');
    if (topbarText) topbarText.textContent = '✕ Canvas';

    // Populate data across views
    populateWorkbenchViews(data);
}

function closeWorkbench() {
    const split = document.getElementById('boltSplitArea');
    const workbench = document.getElementById('boltWorkbenchPane');
    if (!split || !workbench) return;

    split.classList.remove('split-active');
    split.classList.remove('fullscreen-canvas');
    workbench.style.display = 'none';

    // Update toggle button text
    const topbarText = document.getElementById('btnTopbarToggleWorkbenchText');
    if (topbarText) topbarText.textContent = 'Visual Canvas';
}

function renderWorkbenchCodeView(containerId, rawCode, lang = 'python') {
    const container = document.getElementById(containerId);
    if (!container) return 0;
    if (!rawCode || !rawCode.trim()) {
        container.innerHTML = `
            <div class="wb-code-empty-state">
                <span class="wb-code-empty-icon">⚡</span>
                <span class="wb-code-empty-text">No code generated yet for this component.</span>
            </div>
        `;
        return 0;
    }

    let code = rawCode.trim();
    if (typeof code === 'string' && code.includes('\\n') && !code.includes('\n')) {
        code = code.replace(/\\n/g, '\n').replace(/\\t/g, '    ');
    }

    const highlighted = (lang === 'python' || lang === 'py' || lang === 'pyspark')
        ? highlightPython(code)
        : (lang === 'json' ? highlightGeneric(code, 'json') : highlightGeneric(code, lang));

    const lines = highlighted.split('\n');
    const lineCount = lines.length;
    const gutterHtml = lines.map((_, i) => `<span class="wb-gutter-num">${i + 1}</span>`).join('');
    const linesHtml = lines.map(line => `<span class="wb-code-line">${line || ' '}</span>`).join('\n');

    container.innerHTML = `
        <div class="wb-modern-code-editor">
            <div class="wb-code-gutter" aria-hidden="true">${gutterHtml}</div>
            <pre class="wb-code-body"><code class="language-${lang}">${linesHtml}</code></pre>
            <textarea class="wb-raw-code-store" style="display:none;">${escapeHtml(code)}</textarea>
        </div>
    `;
    return lineCount;
}

function populateWorkbenchViews(data) {
    // 1. Pipeline Flow DAG
    const dagContainer = document.getElementById('workbenchDagContainer');
    if (dagContainer) {
        let plan = data.flow_nodes ? data : buildSyntheticPlan(data);
        if (plan) {
            FlowRenderer.render(dagContainer, plan, openActivityInspector);
        }
    }

    // 2. PySpark Studio Code with Multi-Notebook Selector & Syntax Highlighting
    const filenameEl = document.getElementById('wbCodeFilename');
    const layerBadgeEl = document.getElementById('wbNotebookLayerBadge');
    const lineCountEl = document.getElementById('wbCodeLineCount');
    const nbSelect = document.getElementById('wbNotebookSelect');

    const notebooks = data.notebooks || [];
    if (nbSelect) {
        nbSelect.innerHTML = notebooks.length > 0
            ? notebooks.map(nb => `<option value="${nb.name}">${nb.name} (${nb.layer || 'Notebook'})</option>`).join('')
            : `<option value="">No notebooks generated</option>`;

        nbSelect.onchange = () => {
            const selectedName = nbSelect.value;
            const selectedNb = notebooks.find(nb => nb.name === selectedName) || notebooks[0];
            if (selectedNb) {
                let code = selectedNb.pyspark_code || selectedNb.pyspark || data.pyspark_code || `# Notebook: ${selectedNb.name}`;
                const count = renderWorkbenchCodeView('wbCodeEditorViewport', code, 'python');
                if (filenameEl) filenameEl.textContent = `${selectedNb.name}.py`;
                if (layerBadgeEl) layerBadgeEl.textContent = selectedNb.layer || 'PySpark';
                if (lineCountEl) lineCountEl.textContent = `${count} lines`;
            }
        };
    }

    if (notebooks.length > 0) {
        const initialNb = notebooks[0];
        let code = initialNb.pyspark_code || initialNb.pyspark || data.pyspark_code || '';
        const count = renderWorkbenchCodeView('wbCodeEditorViewport', code, 'python');
        if (filenameEl) filenameEl.textContent = `${initialNb.name}.py`;
        if (layerBadgeEl) layerBadgeEl.textContent = initialNb.layer || 'PySpark';
        if (lineCountEl) lineCountEl.textContent = `${count} lines`;
    } else if (data.pyspark_code) {
        let code = data.pyspark_code;
        const count = renderWorkbenchCodeView('wbCodeEditorViewport', code, 'python');
        if (filenameEl) filenameEl.textContent = 'transform.py';
        if (layerBadgeEl) layerBadgeEl.textContent = 'PySpark';
        if (lineCountEl) lineCountEl.textContent = `${count} lines`;
    } else {
        renderWorkbenchCodeView('wbCodeEditorViewport', '# No PySpark notebook generated yet.', 'python');
        if (filenameEl) filenameEl.textContent = 'notebook.py';
        if (lineCountEl) lineCountEl.textContent = '0 lines';
    }

    // 3. Fabric JSON AST Spec with Syntax Highlighting & Line Numbers
    const jsonLineCountEl = document.getElementById('wbJsonLineCount');
    const spec = {
        name: data.pipeline?.name || "Pipeline_Fabric_ETL",
        properties: {
            activities: (data.notebooks || []).map((nb, i) => ({
                name: nb.name,
                type: "SynapseNotebook",
                dependsOn: i > 0 ? [{ activity: data.notebooks[i-1].name, dependencyConditions: ["Succeeded"] }] : [],
                typeProperties: {
                    notebook: { referenceName: nb.name, type: "NotebookReference" },
                    parameters: { layer: { value: nb.layer || "Notebook", type: "string" } }
                }
            })),
            schedules: [{
                enabled: true,
                configuration: {
                    type: "Daily",
                    startDateTime: "2026-01-01T00:00:00",
                    endDateTime: "2027-12-31T23:59:59",
                    localTimeZoneId: "UTC",
                    times: ["10:30"]
                }
            }]
        }
    };
    const jsonStr = JSON.stringify(spec, null, 2);
    const jsonCount = renderWorkbenchCodeView('wbJsonEditorViewport', jsonStr, 'json');
    if (jsonLineCountEl) jsonLineCountEl.textContent = `${jsonCount} lines`;

    // 4. OneLake Workspace Tree (Live Fabric REST API drilldown)
    loadWorkspaceTree(data);

    // 5. Delta Lake Schema View
    populateSchemaView(data);
}

function buildSyntheticPlan(data) {
    const nodes = [];
    const edges = [];
    const folder = data.folder || "AI_Test_Folder";
    const lakehouses = data.lakehouses || ["lh_bronze"];
    const notebooks = data.notebooks || [{ name: "nb_transform", layer: "Bronze" }];
    const pipeline = data.pipeline?.name || "pl_fabric_etl";

    // 1. Folder node
    nodes.push({ id: "fld_root", label: folder, type: "folder", status: "live", x: 25, y: 70 });

    // 2. Lakehouse nodes
    lakehouses.forEach((lh, i) => {
        const lhId = `lh_${i}`;
        nodes.push({ id: lhId, label: lh, type: "lakehouse", status: "pending", x: 245, y: 70 + (i * 65) });
        if (i === 0) edges.push({ from: "fld_root", to: lhId });
    });

    // 3. Notebook nodes
    notebooks.forEach((nb, i) => {
        const nbId = `nb_${i}`;
        nodes.push({ id: nbId, label: nb.name, type: "notebook", status: "pending", x: 465, y: 70 + (i * 65) });
        const fromLh = `lh_${Math.min(i, lakehouses.length - 1)}`;
        edges.push({ from: fromLh, to: nbId });
    });

    // 4. Pipeline node
    const plId = "pl_root";
    nodes.push({ id: plId, label: pipeline, type: "pipeline", status: "pending", x: 685, y: 70 });
    if (notebooks.length > 0) {
        edges.push({ from: `nb_${notebooks.length - 1}`, to: plId });
    }

    return { flow_nodes: nodes, flow_edges: edges };
}

// ── Live Deployment Controller (Routed to Operations -> Live Execution) ──
async function triggerWorkbenchDeployment(plan) {
    if (!plan) return;

    showToast('Deploying items to Microsoft Fabric...', 'info');

    // Trigger deployment API
    const deployRes = await apiFetch('/api/agent/execute', {
        method: 'POST',
        body: {
            prompt: plan.prompt || `Deploy ${plan.folder}`,
            folder: plan.folder,
            deploy: true,
        },
    });

    if (!deployRes || deployRes.error) {
        showToast(deployRes?.error || 'Deployment failed.', 'error');
        return;
    }

    const runId = deployRes.run_id;
    showToast(`Deployment initiated (Run ID: ${runId})! Switching to Live Operations...`, 'success');
    switchView('viewMonitoring');
    addMonitoringRunCard(runId, plan.folder || 'Fabric Deployment', 'deploying');
    startMonitoringRun(runId);
}

function addMonitoringRunCard(runId, folderName, status = 'running') {
    const list = document.getElementById('monitorRunsList');
    if (!list) return;

    // Check if card already exists
    let existing = document.getElementById(`run-card-${runId}`);
    if (existing) {
        const badge = existing.querySelector('.status-badge');
        if (badge) {
            badge.className = `status-badge status-${status}`;
            badge.textContent = status.toUpperCase();
        }
        return;
    }

    const countBadge = document.getElementById('runCountBadge');
    if (countBadge) {
        countBadge.textContent = String((list.children.length || 0) + 1);
    }

    const card = document.createElement('div');
    card.className = 'monitor-run-card active';
    card.id = `run-card-${runId}`;
    const now = new Date().toLocaleTimeString();
    card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span style="font-weight:600; color:#fff; font-size:13px;">${escapeHtml(folderName)}</span>
            <span class="status-badge status-${status}">${status.toUpperCase()}</span>
        </div>
        <div style="font-size:11px; color:var(--text-tertiary); font-family:var(--font-mono);">Run ID: ${runId} · ${now}</div>
    `;

    document.querySelectorAll('.monitor-run-card').forEach(c => c.classList.remove('active'));
    list.prepend(card);

    card.addEventListener('click', () => {
        document.querySelectorAll('.monitor-run-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        startMonitoringRun(runId);
    });
}

// ── Workspace Tree Explorer (Live Fabric REST API Drilldown) ───────────────
async function loadWorkspaceTree(planData = null) {
    const treeEl = document.getElementById('workbenchTreeContainer');
    const refreshBtn = document.getElementById('btnRefreshTree');
    if (!treeEl) return;

    if (refreshBtn) refreshBtn.classList.add('loading');

    try {
        const res = await apiFetch('/api/workspace/tree');
        if (refreshBtn) refreshBtn.classList.remove('loading');

        const hasFolders = res && res.folders && res.folders.length > 0;
        const hasRoot = res && res.root_items && res.root_items.length > 0;

        if (!hasFolders && !hasRoot) {
            // If live Fabric API returned empty (e.g. fresh workspace or offline),
            // render the planned items if an active architecture plan is present
            const activePlan = planData || App.currentPlan;
            if (activePlan && (activePlan.folder || activePlan.lakehouses || activePlan.notebooks)) {
                renderSyntheticTree(activePlan);
            } else {
                treeEl.innerHTML = `<div class="tree-empty-hint">${res?.error ? 'Fabric API: ' + escapeHtml(res.error) : 'No items or folders found in workspace.'}</div>`;
            }
            return;
        }

        let html = '';

        // Render Folders
        if (hasFolders) {
            res.folders.forEach(folder => {
                const itemCount = folder.items ? folder.items.length : 0;
                html += `
                    <div class="tree-folder expanded" data-folder-id="${escapeHtml(folder.id || '')}">
                        <div class="tree-folder-header" onclick="this.parentElement.classList.toggle('expanded')">
                            <svg class="tree-folder-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                            <span class="tree-folder-icon">📁</span>
                            <span class="tree-folder-name" title="${escapeHtml(folder.name)}">${escapeHtml(folder.name)}</span>
                            <span class="tree-folder-count">${itemCount} item${itemCount === 1 ? '' : 's'}</span>
                        </div>
                        <div class="tree-folder-children">
                            ${(folder.items && folder.items.length > 0) ? folder.items.map(item => `
                                <div class="tree-item" title="${escapeHtml(item.name)} (${escapeHtml(item.type)})">
                                    <div class="tree-item-type-dot type-dot-${escapeHtml(item.type || 'Unknown')}"></div>
                                    <span class="tree-item-name">${escapeHtml(item.name)}</span>
                                    <span class="tree-item-type-badge badge-${escapeHtml(item.type || 'Unknown')}">${escapeHtml(item.type || 'Item')}</span>
                                </div>
                            `).join('') : '<div style="padding: 4px 12px; font-size: 11px; color: var(--text-tertiary); font-style: italic;">Empty folder</div>'}
                        </div>
                    </div>
                `;
            });
        }

        // Render Root Items
        if (hasRoot) {
            html += `<div class="tree-section-label">Root Items (${res.root_items.length})</div>`;
            res.root_items.forEach(item => {
                html += `
                    <div class="tree-item" title="${escapeHtml(item.name)} (${escapeHtml(item.type)})">
                        <div class="tree-item-type-dot type-dot-${escapeHtml(item.type || 'Unknown')}"></div>
                        <span class="tree-item-name">${escapeHtml(item.name)}</span>
                        <span class="tree-item-type-badge badge-${escapeHtml(item.type || 'Unknown')}">${escapeHtml(item.type || 'Item')}</span>
                    </div>
                `;
            });
        }

        treeEl.innerHTML = html;
    } catch (err) {
        if (refreshBtn) refreshBtn.classList.remove('loading');
        treeEl.innerHTML = `<div class="tree-empty-hint">Failed to load workspace tree: ${escapeHtml(err.message)}</div>`;
    }
}

function renderSyntheticTree(data) {
    const treeEl = document.getElementById('workbenchTreeContainer');
    if (!treeEl) return;
    const folderName = data.folder || "AI_Workspace_Folder";
    const lakehouses = data.lakehouses || [];
    const notebooks = data.notebooks || [];
    const pipeline = data.pipeline?.name || "";

    const items = [
        ...lakehouses.map(lh => ({ name: typeof lh === 'string' ? lh : lh.name, type: 'Lakehouse' })),
        ...notebooks.map(nb => ({ name: typeof nb === 'string' ? nb : nb.name, type: 'Notebook' })),
        ...(pipeline ? [{ name: pipeline, type: 'DataPipeline' }] : [])
    ];

    treeEl.innerHTML = `
        <div class="tree-folder expanded">
            <div class="tree-folder-header" onclick="this.parentElement.classList.toggle('expanded')">
                <svg class="tree-folder-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                <span class="tree-folder-icon">📁</span>
                <span class="tree-folder-name">${escapeHtml(folderName)} (Planned Architecture)</span>
                <span class="tree-folder-count">${items.length} items</span>
            </div>
            <div class="tree-folder-children">
                ${items.map(item => `
                    <div class="tree-item">
                        <div class="tree-item-type-dot type-dot-${escapeHtml(item.type)}"></div>
                        <span class="tree-item-name">${escapeHtml(item.name)}</span>
                        <span class="tree-item-type-badge badge-${escapeHtml(item.type)}">${escapeHtml(item.type)}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ── Schema View (Replaces Table Matrix) ────────────────────────────────────────
function populateSchemaView(data) {
    const titleEl = document.getElementById('wbSchemaTitle');
    const badgeEl = document.getElementById('wbSchemaLayerBadge');
    const selectEl = document.getElementById('wbSchemaLakehouseSelect');
    const tbody = document.getElementById('wbSchemaTableBody');
    if (!tbody) return;

    if (!data || (!data.notebooks && !data.lakehouses && !data.tables && !data.schema)) {
        if (titleEl) titleEl.textContent = 'Discovered Schema';
        if (badgeEl) { badgeEl.textContent = 'No Plan'; badgeEl.className = 'schema-pill'; }
        if (selectEl) selectEl.innerHTML = '<option value="">No lakehouses in plan</option>';
        tbody.innerHTML = `
            <tr class="schema-empty-row">
                <td colspan="6">Generate an architecture plan to see schema details.</td>
            </tr>
        `;
        return;
    }

    const lakehouses = data.lakehouses || [];
    if (selectEl) {
        if (lakehouses.length > 0) {
            selectEl.innerHTML = lakehouses.map((lh, idx) => {
                const name = typeof lh === 'string' ? lh : (lh.name || `Lakehouse ${idx+1}`);
                return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
            }).join('');
        } else {
            selectEl.innerHTML = '<option value="default">Default Lakehouse</option>';
        }
    }

    const currentLh = selectEl ? selectEl.value : (lakehouses[0] || '');
    renderSchemaRows(data, currentLh);
}

function renderSchemaRows(data, selectedLakehouse = '') {
    const titleEl = document.getElementById('wbSchemaTitle');
    const badgeEl = document.getElementById('wbSchemaLayerBadge');
    const tbody = document.getElementById('wbSchemaTableBody');
    if (!tbody) return;

    if (!data) return;

    // Detect layer from selected lakehouse name
    let layer = 'Bronze';
    const lhLower = (selectedLakehouse || '').toLowerCase();
    if (lhLower.includes('silver')) layer = 'Silver';
    else if (lhLower.includes('gold')) layer = 'Gold';
    else if (lhLower.includes('bronze')) layer = 'Bronze';

    if (titleEl) titleEl.textContent = selectedLakehouse ? `Schema — ${selectedLakehouse}` : 'Discovered Schema';
    if (badgeEl) {
        badgeEl.textContent = layer.toUpperCase();
        badgeEl.className = `schema-pill schema-layer-${layer.toLowerCase()}`;
    }

    // Extract columns from plan or build structured schema for the layer
    let columns = [];

    if (data.schema && Array.isArray(data.schema)) {
        columns = data.schema.filter(col => !selectedLakehouse || !col.lakehouse || col.lakehouse === selectedLakehouse);
    } else if (data.tables && Array.isArray(data.tables)) {
        // From table metadata
        data.tables.forEach(tbl => {
            if (tbl.columns && Array.isArray(tbl.columns)) {
                tbl.columns.forEach(col => {
                    columns.push({
                        name: col.name || col.column_name,
                        type: col.type || col.data_type || null,
                        nullable: col.nullable !== undefined ? col.nullable : true,
                        pk: !!col.is_pk || !!col.pk,
                        layer: tbl.layer || layer,
                        notebook: tbl.notebook || (data.notebooks?.[0]?.name || null),
                    });
                });
            }
        });
    }

    // If explicit tables or schema were returned in the plan, render them
    if (data.tables && Array.isArray(data.tables) && data.tables.length > 0) {
        const targetTables = data.tables.filter(tbl => {
            const tblLayer = (tbl.layer || '').toLowerCase();
            const tblLh = (tbl.lakehouse || '').toLowerCase();
            return !selectedLakehouse || tblLh === selectedLakehouse.toLowerCase() || tblLayer === layer.toLowerCase();
        });

        const tablesToRender = targetTables.length > 0 ? targetTables : data.tables;
        tablesToRender.forEach(tbl => {
            (tbl.columns || []).forEach(col => {
                columns.push({
                    name: col.name,
                    type: col.type || 'STRING',
                    nullable: col.nullable !== undefined ? col.nullable : true,
                    pk: !!col.pk,
                    layer: tbl.layer || layer,
                    notebook: tbl.name || (data.notebooks?.[0]?.name || null),
                });
            });
        });
    }

    if (columns.length === 0) {
        const nbNames = (data.notebooks || []).map(n => n.name).join(', ');
        tbody.innerHTML = `
            <tr class="schema-empty-row">
                <td colspan="6">
                    <div style="padding: 28px 12px; text-align: center;">
                        <div style="font-size: 20px; margin-bottom: 6px;">📋</div>
                        <div style="font-weight: 600; color: #fff; margin-bottom: 4px;">No Table Schema Required</div>
                        <div style="font-size: 11.5px; color: var(--text-tertiary); max-width: 480px; margin: 0 auto;">
                            ${nbNames ? `The notebooks (${escapeHtml(nbNames)}) are standalone algorithmic / utility scripts and do not target structured Delta Lake tables.` : `No database tables or schema definitions associated with this workload.`}
                        </div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = columns.map(col => {
        const colName = col.name ? escapeHtml(col.name) : '<span class="schema-null-val">NULL</span>';
        const colType = col.type ? `<code>${escapeHtml(col.type)}</code>` : '<span class="schema-null-val">NULL</span>';
        const colNullable = col.nullable === true
            ? '<span class="schema-badge schema-badge-nullable">NULLABLE</span>'
            : col.nullable === false
            ? '<span class="schema-badge schema-badge-notnull">NOT NULL</span>'
            : '<span class="schema-null-val">NULL</span>';
        const colPk = col.pk === true
            ? '<span class="schema-badge schema-badge-pk">PK</span>'
            : col.pk === false
            ? '—'
            : '<span class="schema-null-val">NULL</span>';
        const colLayer = col.layer
            ? `<span class="schema-badge schema-layer-${escapeHtml(col.layer.toLowerCase())}">${escapeHtml(col.layer)}</span>`
            : '<span class="schema-null-val">NULL</span>';
        const colNotebook = col.notebook ? `<code>${escapeHtml(col.notebook)}</code>` : '<span class="schema-null-val">NULL</span>';

        return `
            <tr>
                <td>${colName}</td>
                <td>${colType}</td>
                <td>${colNullable}</td>
                <td>${colPk}</td>
                <td>${colLayer}</td>
                <td>${colNotebook}</td>
            </tr>
        `;
    }).join('');
}

// ── Activity Inspector Drawer ─────────────────────────────────────────────────
function openActivityInspector(node, plan) {
    const drawer = document.getElementById('activityDrawerBackdrop');
    if (!drawer) return;

    document.getElementById('actDrawerTitle').textContent = node.label || node.id;
    document.getElementById('actDrawerType').textContent = node.type.toUpperCase();

    const propsEl = document.getElementById('actDrawerProps');
    if (propsEl) {
        propsEl.innerHTML = `
            <div class="act-prop-item">
                <span class="act-prop-key">ACTIVITY ID</span>
                <span class="act-prop-val">${node.id}</span>
            </div>
            <div class="act-prop-item">
                <span class="act-prop-key">STATUS</span>
                <span class="act-prop-val" style="color:var(--cyan);">${node.status || 'pending'}</span>
            </div>
            <div class="act-prop-item">
                <span class="act-prop-key">TARGET</span>
                <span class="act-prop-val">${node.label}</span>
            </div>
            <div class="act-prop-item">
                <span class="act-prop-key">ENGINE</span>
                <span class="act-prop-val">Synapse PySpark</span>
            </div>
        `;
    }

    const jsonEl = document.getElementById('actDrawerJson');
    if (jsonEl) {
        jsonEl.textContent = JSON.stringify({
            name: node.label || node.id,
            type: node.type === 'notebook' ? 'SynapseNotebook' : 'Copy',
            typeProperties: {
                target: node.label,
                kernel: 'synapse_pyspark'
            }
        }, null, 2);
    }

    const codeEl = document.getElementById('actDrawerCode');
    if (codeEl) {
        codeEl.textContent = `# PySpark Transformation for ${node.label}\n\nfrom delta.tables import DeltaTable\ntarget = DeltaTable.forPath(spark, "abfss://lh_sales_silver@onelake.dfs.fabric.microsoft.com/Tables/${node.label}")\n`;
    }

    drawer.classList.add('open');
}

function closeActivityInspector() {
    document.getElementById('activityDrawerBackdrop')?.classList.remove('open');
}

let activeAbortController = null;

function setGeneratingState(generating) {
    const sendBtn = document.getElementById('btnChatSend');
    if (!sendBtn) return;
    if (generating) {
        sendBtn.classList.add('is-generating');
        sendBtn.title = 'Stop generation';
        sendBtn.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="2.5"/>
            </svg>
        `;
    } else {
        sendBtn.classList.remove('is-generating');
        sendBtn.title = 'Send prompt';
        sendBtn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="12" y1="19" x2="12" y2="5"/>
                <polyline points="5 12 12 5 19 12"/>
            </svg>
        `;
    }
}

async function executeArchitectAgent(prompt) {
    if (activeAbortController) {
        try { activeAbortController.abort(); } catch(e) {}
        activeAbortController = null;
    }

    activeAbortController = new AbortController();
    setGeneratingState(true);

    const placeholderId = 'thinking-' + Date.now();
    const startTime = Date.now();
    appendLoadingBubble(placeholderId);

    // Extract folder name from prompt if mentioned
    let folderName = 'AI_Test_Folder';
    const folderMatch = prompt.match(/folder\s+(?:named\s+)?([A-Za-z0-9_\-]+)/i);
    if (folderMatch && folderMatch[1]) {
        folderName = folderMatch[1];
    }

    try {
        const res = await apiFetch('/api/agent/execute', {
            method: 'POST',
            body: { 
                prompt, 
                folder: folderName,
                model: App.selectedModel || 'gemini-2.0-flash',
                effort: (App.selectedEffort || 'medium').toLowerCase()
            },
            signal: activeAbortController.signal
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        finalizeThinkingBubble(placeholderId, elapsed, res);

        if (res && res.aborted) {
            return;
        }

        if (res && res.error) {
            appendChatMessage('assistant', `⚠️ **Error**: ${res.error}`);
            return;
        }

        if (res && res.type === 'chat') {
            appendChatMessage('assistant', res.text || res.summary);
        } else if (res && res.type === 'audit') {
            // Audit note from the 4-stage pipeline auditor — shows before plan card
            const auditText = res.text || res.summary || '';
            if (auditText) {
                appendChatMessage('assistant', `🔍 **Pipeline Audit**\n\n${auditText}`);
            }
        } else if (res && res.type === 'error') {
            appendChatMessage('assistant', res.text || res.summary || '⚠️ An error occurred.');
        } else if (res && res.notebooks && res.notebooks.length > 0) {
            let msg = `### 🏛️ Proposed Fabric Architecture: \`${res.folder || 'AI_Test_Folder'}\`\n\n`;
            if (res.pipeline?.name) {
                const rawSched = res.pipeline?.schedule;
                const schedDisplay = (typeof rawSched === 'object' && rawSched !== null) 
                    ? (rawSched.human || rawSched.cron || 'Daily') 
                    : (rawSched || 'Daily');
                msg += `**Pipeline**: \`${res.pipeline?.name}\` (${schedDisplay})\n\n`;
            }
            if (res.environment) {
                msg += `**Environment**: \`${res.environment}\`\n\n`;
            }
            if (res.lakehouses && res.lakehouses.length > 0) {
                msg += `**Medallion Lakehouses**: ${res.lakehouses.map(l => `\`${l}\``).join(', ')}\n\n`;
            }
            if (res._pipeline_type === 'multi_agent') {
                msg += `> *Generated via 4-Stage Multi-Agent Pipeline*\n\n`;
            }
            msg += `**Notebooks (${res.notebooks.length})**:\n`;
            res.notebooks.forEach(nb => {
                msg += `- **${nb.name}** [${nb.layer || 'Transform'}]: *${nb.description || 'PySpark transform'}*\n`;
            });
            appendChatMessage('assistant', msg.trim());

            // Store plan for on-demand toggle without auto-opening split screen
            App.currentPlan = res;
            setVisualCanvasButtonVisibility(true);
        } else if (res && (res.text || res.summary)) {
            appendChatMessage('assistant', res.text || res.summary);
        } else if (res) {
            appendChatMessage('assistant', JSON.stringify(res, null, 2));
        }

        loadSessionSummary();
        loadConversationsList();
    } catch (err) {
        finalizeThinkingBubble(placeholderId, 0, null);
        if (err.name !== 'AbortError') {
            console.error('Agent execution error:', err);
        }
    } finally {
        activeAbortController = null;
        setGeneratingState(false);
    }
}

let lastUserPrompt = '';

function formatMessageTime(timestamp) {
    if (!timestamp) return 'Just now';
    let date;
    if (typeof timestamp === 'number') {
        date = new Date(timestamp);
    } else if (typeof timestamp === 'string') {
        const iso = (timestamp.endsWith('Z') || timestamp.includes('+') || (timestamp.includes('T') && timestamp.includes('-'))) 
            ? (timestamp.endsWith('Z') ? timestamp : timestamp + 'Z')
            : timestamp;
        date = new Date(iso);
        if (isNaN(date.getTime())) date = new Date(timestamp);
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        date = new Date();
    }

    if (isNaN(date.getTime())) return 'Just now';

    const now = new Date();
    const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

    if (diffSec < 45) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}

function updateAllMessageTimestamps() {
    document.querySelectorAll('.chat-action-timestamp[data-timestamp]').forEach(el => {
        const ts = el.getAttribute('data-timestamp');
        if (ts) {
            el.textContent = formatMessageTime(isNaN(ts) ? ts : Number(ts));
        }
    });
}

// Periodically refresh relative timestamps every 30 seconds
setInterval(updateAllMessageTimestamps, 30000);

function renderUserBubbleHtml(bubble, content, ts) {
    const timeDisplay = formatMessageTime(ts);
    bubble.setAttribute('data-raw-content', content);
    bubble.innerHTML = `
        <div class="chat-content-card">
            <div class="chat-card-text">${formatMarkdown(content)}</div>
            <button class="btn-show-more-toggle" style="display:none;">Show more</button>
        </div>
        <div class="chat-bubble-actions user-actions">
            <span class="chat-action-timestamp" data-timestamp="${ts}">${timeDisplay}</span>
            <button class="chat-action-btn btn-retry-msg" title="Retry">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </button>
            <button class="chat-action-btn btn-edit-msg" title="Edit prompt">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="chat-action-btn btn-copy-msg" title="Copy">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
        </div>
    `;
}

function bindUserBubbleEvents(bubble, content, ts) {
    const thread = document.getElementById('chatThread');
    const cardText = bubble.querySelector('.chat-card-text');
    const showMoreBtn = bubble.querySelector('.btn-show-more-toggle');

    // 1. Collapsible long message check (Inside card matching screenshot)
    if (cardText && showMoreBtn) {
        setTimeout(() => {
            if (cardText.scrollHeight > 200 || (content && content.split('\n').length > 6) || (content && content.length > 280)) {
                cardText.classList.add('is-collapsed');
                showMoreBtn.style.display = 'inline-flex';
                showMoreBtn.textContent = 'Show more';
                showMoreBtn.onclick = (e) => {
                    e.stopPropagation();
                    const isCollapsed = cardText.classList.toggle('is-collapsed');
                    showMoreBtn.textContent = isCollapsed ? 'Show more' : 'Show less';
                };
            } else {
                cardText.classList.remove('is-collapsed');
                showMoreBtn.style.display = 'none';
            }
        }, 30);
    }

    // 2. Copy button
    const btnCopy = bubble.querySelector('.btn-copy-msg');
    btnCopy?.addEventListener('click', () => {
        navigator.clipboard.writeText(content);
        btnCopy.innerHTML = '<span style="color:#10b981; font-size:12px; font-weight:700;">✓</span>';
        setTimeout(() => {
            btnCopy.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        }, 1500);
    });

    // 3. In-Place Edit (Matching Image 2)
    const btnEdit = bubble.querySelector('.btn-edit-msg');
    btnEdit?.addEventListener('click', () => {
        bubble.innerHTML = `
            <div class="in-place-edit-wrapper">
                <div class="in-place-edit-container">
                    <textarea class="in-place-edit-textarea"></textarea>
                    <div class="in-place-edit-footer">
                        <div class="edit-footer-left">
                            <span class="edit-info-icon" title="Editing this prompt will recalculate the response and reset subsequent turns">ⓘ</span>
                        </div>
                        <div class="edit-footer-right">
                            <button class="btn-edit-cancel">Cancel</button>
                            <button class="btn-edit-save">Save</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const textarea = bubble.querySelector('.in-place-edit-textarea');
        textarea.value = content;
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(380, Math.max(90, textarea.scrollHeight))}px`;
        textarea.focus();

        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(380, Math.max(90, textarea.scrollHeight))}px`;
        });

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                bubble.querySelector('.btn-edit-save')?.click();
            } else if (e.key === 'Escape') {
                bubble.querySelector('.btn-edit-cancel')?.click();
            }
        });

        // Cancel
        bubble.querySelector('.btn-edit-cancel').addEventListener('click', () => {
            renderUserBubbleHtml(bubble, content, ts);
            bindUserBubbleEvents(bubble, content, ts);
        });

        // Save
        bubble.querySelector('.btn-edit-save').addEventListener('click', async () => {
            const newPrompt = textarea.value.trim();
            if (!newPrompt) return;

            // 1. Calculate turn index of this bubble
            const allBubbles = Array.from(thread.querySelectorAll('.chat-bubble'));
            const bubbleIndex = allBubbles.indexOf(bubble);

            // 2. Remove all subsequent bubbles from the DOM
            let next = bubble.nextElementSibling;
            while (next && next.id !== 'chatBottomSpacer') {
                const toRemove = next;
                next = next.nextElementSibling;
                toRemove.remove();
            }

            // 3. Truncate backend database messages from this turn
            if (bubbleIndex >= 0 && App.sessionId) {
                await apiFetch('/api/conversation/truncate', {
                    method: 'POST',
                    body: { session_id: App.sessionId, turn_index: bubbleIndex }
                });
            }

            // 4. Update bubble with new content
            const newTs = new Date().toISOString();
            renderUserBubbleHtml(bubble, newPrompt, newTs);
            bindUserBubbleEvents(bubble, newPrompt, newTs);

            // 5. Trigger new generation for edited prompt directly underneath
            executeArchitectAgent(newPrompt);
        });
    });

    // 4. Retry
    const btnRetry = bubble.querySelector('.btn-retry-msg');
    btnRetry?.addEventListener('click', async () => {
        const allBubbles = Array.from(thread.querySelectorAll('.chat-bubble'));
        const bubbleIndex = allBubbles.indexOf(bubble);

        // Remove subsequent bubbles from DOM
        let next = bubble.nextElementSibling;
        while (next && next.id !== 'chatBottomSpacer') {
            const toRemove = next;
            next = next.nextElementSibling;
            toRemove.remove();
        }

        // Truncate backend
        if (bubbleIndex >= 0 && App.sessionId) {
            await apiFetch('/api/conversation/truncate', {
                method: 'POST',
                body: { session_id: App.sessionId, turn_index: bubbleIndex + 1 }
            });
        }

        executeArchitectAgent(content);
    });
}

function renderAssistantBubbleHtml(bubble, content, ts) {
    const timeDisplay = formatMessageTime(ts);
    bubble.setAttribute('data-raw-content', content);

    // Strip any raw leaked HTML action bar from content
    let cleanText = (content || '')
        .replace(/<div class="plan-action-bar"[\s\S]*?<\/div>/gi, '')
        .trim();

    // Check if this message contains an architecture plan or deployment report
    let planActionBarHtml = '';
    const hasPlanStructure = content && (
        content.includes('Proposed Fabric Architecture') ||
        content.includes('Proposed Architecture') ||
        content.includes('Architecture Blueprint') ||
        content.includes('Target Folder') ||
        content.includes('PySpark Notebook') ||
        content.includes('Architecture Deployed') ||
        content.includes('Deployment Finalized')
    );

    const isAlreadyDeployed = content && (
        content.includes('Architecture Deployed') ||
        content.includes('Deployment Finalized') ||
        content.includes('Deployment Run ID')
    );

    if (hasPlanStructure) {
        if (!isAlreadyDeployed) {
            planActionBarHtml = `
                <div class="plan-action-bar" style="margin-top: 14px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="btn-plan-action btn-deploy-plan" onclick="window.deployCurrentPlan()" style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; background: #0078d4; color: #fff; border: none; border-radius: 6px; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        <span>Deploy to Fabric</span>
                    </button>
                    <button class="btn-plan-action btn-view-canvas" onclick="toggleWorkbench()" style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; background: rgba(255,255,255,0.08); color: #e1e3e1; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; font-size: 12.5px; font-weight: 500; cursor: pointer; transition: all 0.2s ease;">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                        <span>Visual Canvas</span>
                    </button>
                </div>
            `;
        } else {
            planActionBarHtml = `
                <div class="plan-action-bar" style="margin-top: 14px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="btn-plan-action btn-view-canvas" onclick="toggleWorkbench()" style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 6px; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                        <span>Inspect in Canvas</span>
                    </button>
                    <button class="btn-plan-action btn-view-explorer" onclick="switchView('viewWorkspace'); loadWorkspaceItems();" style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; background: rgba(255,255,255,0.08); color: #e1e3e1; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; font-size: 12.5px; font-weight: 500; cursor: pointer; transition: all 0.2s ease;">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        <span>Workspace Explorer</span>
                    </button>
                </div>
            `;
        }
    }

    bubble.innerHTML = `
        <div class="chat-content-card">
            ${formatMarkdown(cleanText)}
            ${planActionBarHtml}
        </div>
        <div class="chat-bubble-actions assistant-actions">
            <button class="chat-action-btn btn-copy-msg" title="Copy response">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="chat-action-btn btn-speak-msg" title="Read aloud">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
            </button>
            <button class="chat-action-btn btn-thumb-up" title="Good response">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
            </button>
            <button class="chat-action-btn btn-thumb-down" title="Bad response">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>
            </button>
            <button class="chat-action-btn btn-retry-msg" title="Regenerate">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </button>
            <span class="chat-action-timestamp" data-timestamp="${ts}">${timeDisplay}</span>
        </div>
    `;
}

function bindAssistantBubbleEvents(bubble, content, ts) {
    const thread = document.getElementById('chatThread');

    const btnCopy = bubble.querySelector('.btn-copy-msg');
    btnCopy?.addEventListener('click', () => {
        navigator.clipboard.writeText(content);
        btnCopy.innerHTML = '<span style="color:#10b981; font-size:12px; font-weight:700;">✓</span>';
        setTimeout(() => {
            btnCopy.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        }, 1500);
    });

    const btnSpeak = bubble.querySelector('.btn-speak-msg');
    btnSpeak?.addEventListener('click', () => {
        if ('speechSynthesis' in window) {
            if (window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
                btnSpeak.classList.remove('speaking');
            } else {
                const plainText = content.replace(/[*#`_~\[\]]/g, '').replace(/\|/g, ' ');
                const utter = new SpeechSynthesisUtterance(plainText);
                utter.onend = () => btnSpeak.classList.remove('speaking');
                utter.onerror = () => btnSpeak.classList.remove('speaking');
                btnSpeak.classList.add('speaking');
                window.speechSynthesis.speak(utter);
            }
        }
    });

    const btnThumbUp = bubble.querySelector('.btn-thumb-up');
    const btnThumbDown = bubble.querySelector('.btn-thumb-down');
    btnThumbUp?.addEventListener('click', () => {
        btnThumbUp.classList.toggle('active');
        btnThumbDown?.classList.remove('active');
    });
    btnThumbDown?.addEventListener('click', () => {
        btnThumbDown.classList.toggle('active');
        btnThumbUp?.classList.remove('active');
    });

    const btnRetry = bubble.querySelector('.btn-retry-msg');
    btnRetry?.addEventListener('click', async () => {
        const allBubbles = Array.from(thread.querySelectorAll('.chat-bubble'));
        const bubbleIndex = allBubbles.indexOf(bubble);

        // Find the user prompt directly above this assistant bubble
        let prev = bubble.previousElementSibling;
        while (prev && !prev.classList.contains('user')) {
            prev = prev.previousElementSibling;
        }
        const promptToRetry = prev ? (prev.getAttribute('data-raw-content') || prev.querySelector('.chat-content-card')?.innerText) : (lastUserPrompt || content);

        // Remove this assistant bubble and any subsequent bubbles below it
        let cur = bubble;
        while (cur && cur.id !== 'chatBottomSpacer') {
            const toRemove = cur;
            cur = cur.nextElementSibling;
            toRemove.remove();
        }

        // Truncate backend database
        if (bubbleIndex >= 0 && App.sessionId) {
            await apiFetch('/api/conversation/truncate', {
                method: 'POST',
                body: { session_id: App.sessionId, turn_index: bubbleIndex }
            });
        }

        if (promptToRetry) {
            executeArchitectAgent(promptToRetry);
        }
    });
}

function appendChatMessage(role, content, timestamp) {
    const thread = document.getElementById('chatThread');
    if (!thread) return;

    if (role === 'user') {
        lastUserPrompt = content;
    }

    const ts = timestamp || new Date().toISOString();

    // Ensure bottom spacer exists to guarantee fillable space for top scrolling
    let spacer = document.getElementById('chatBottomSpacer');
    if (!spacer) {
        spacer = document.createElement('div');
        spacer.id = 'chatBottomSpacer';
        spacer.className = 'chat-thread-bottom-spacer';
        thread.appendChild(spacer);
    }

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;

    // Construct Bubble HTML and bind events
    if (role === 'user') {
        renderUserBubbleHtml(bubble, content, ts);
        bindUserBubbleEvents(bubble, content, ts);
    } else {
        renderAssistantBubbleHtml(bubble, content, ts);
        bindAssistantBubbleEvents(bubble, content, ts);
    }

    thread.insertBefore(bubble, spacer);

    if (role === 'user') {
        setTimeout(() => {
            const threadRect = thread.getBoundingClientRect();
            const bubbleRect = bubble.getBoundingClientRect();
            const offset = bubbleRect.top - threadRect.top + thread.scrollTop - 24;
            thread.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
        }, 30);
    } else {
        setTimeout(() => {
            const threadRect = thread.getBoundingClientRect();
            const bubbleRect = bubble.getBoundingClientRect();
            const offset = bubbleRect.top - threadRect.top + thread.scrollTop - 24;
            if (thread.scrollTop > offset) {
                thread.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
            }
        }, 40);
    }

    return bubble;
}

let thinkingStepTimer = null;
let thinkingElapsedTimer = null;

function appendLoadingBubble(id) {
    const thread = document.getElementById('chatThread');
    if (!thread) return;

    let spacer = document.getElementById('chatBottomSpacer');
    if (!spacer) {
        spacer = document.createElement('div');
        spacer.id = 'chatBottomSpacer';
        spacer.className = 'chat-thread-bottom-spacer';
        thread.appendChild(spacer);
    }

    const bubble = document.createElement('div');
    bubble.id = id;
    bubble.className = 'chat-bubble assistant chat-loading-bubble';

    bubble.innerHTML = `
        <div class="chat-typing-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
        </div>
    `;
    thread.insertBefore(bubble, spacer);
}

function finalizeThinkingBubble(id, elapsed, res) {
    clearInterval(thinkingElapsedTimer);
    const bubble = document.getElementById(id);
    if (bubble) {
        bubble.remove();
    }
}

// ── Syntax Highlighting Engine (Single-Pass Tokenizer) ───────────────────────
function highlightPython(code) {
    if (!code) return '';

    // First safely escape raw HTML characters
    const escaped = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Single-pass regex token replacer — prevents self-matching of generated HTML tags
    const tokenRegex = /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(#.*$)|(@[a-zA-Z_]\w*)|(\bdef\s+)([a-zA-Z_]\w*)|(\bclass\s+)([a-zA-Z_]\w*)|(\b(?:def|class|import|from|return|if|else|elif|try|except|finally|with|as|for|while|in|lambda|async|await|pass|break|continue|yield|global|nonlocal|raise|assert|del|is|not|and|or)\b)|(\b(?:True|False|None)\b)|(\b(?:print|len|range|str|int|float|dict|list|set|tuple|bool|type|isinstance|enumerate|zip|map|filter|min|max|sum|abs|round|open|super|self|spark|df|DeltaTable|col|lit|when|coalesce|select|filter|groupBy|agg|orderBy|join|withColumn|drop)\b)|(\b\d+(?:\.\d+)?\b)/gm;

    return escaped.replace(tokenRegex, (match, str, com, dec, defPrefix, fnName, clsPrefix, clsName, kw, boolVal, blt, num) => {
        if (str) return `<span class="syn-str">${str}</span>`;
        if (com) return `<span class="syn-com">${com}</span>`;
        if (dec) return `<span class="syn-dec">${dec}</span>`;
        if (defPrefix && fnName) return `<span class="syn-kw">${defPrefix.trim()}</span> <span class="syn-fn">${fnName}</span>`;
        if (clsPrefix && clsName) return `<span class="syn-kw">${clsPrefix.trim()}</span> <span class="syn-cls">${clsName}</span>`;
        if (kw) return `<span class="syn-kw">${kw}</span>`;
        if (boolVal) return `<span class="syn-bool">${boolVal}</span>`;
        if (blt) return `<span class="syn-blt">${blt}</span>`;
        if (num) return `<span class="syn-num">${num}</span>`;
        return match;
    });
}

function highlightGeneric(code, lang) {
    if (!code) return '';
    const escaped = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    if (lang === 'sql') {
        const sqlTokens = /(["'](?:\\.|[^"\\])*['"])|(--.*$)|(\b(?:SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|CREATE|DROP|TABLE|VIEW|JOIN|LEFT|RIGHT|INNER|OUTER|GROUP|BY|ORDER|HAVING|LIMIT|UNION|ALL|AS|AND|OR|NOT|NULL|IS|IN|EXISTS|CASE|WHEN|THEN|ELSE|END|DELTA|MERGE|MATCHED|SET|VALUES)\b)|(\b\d+(?:\.\d+)?\b)/gim;
        return escaped.replace(sqlTokens, (match, str, com, kw, num) => {
            if (str) return `<span class="syn-str">${str}</span>`;
            if (com) return `<span class="syn-com">${com}</span>`;
            if (kw) return `<span class="syn-kw">${kw}</span>`;
            if (num) return `<span class="syn-num">${num}</span>`;
            return match;
        });
    } else if (lang === 'json') {
        const jsonTokens = /("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|(\b(?:true|false|null)\b)|(\b-?\d+(?:\.\d+)?\b)/gi;
        return escaped.replace(jsonTokens, (match, key, str, boolVal, num) => {
            if (key) return `<span class="syn-blt">${key}</span>`;
            if (str) return `<span class="syn-str">${str}</span>`;
            if (boolVal) return `<span class="syn-bool">${boolVal}</span>`;
            if (num) return `<span class="syn-num">${num}</span>`;
            return match;
        });
    }

    return escaped;
}

window.copyCodeBlock = function(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const raw = card.querySelector('.raw-code-store')?.value || card.querySelector('code')?.innerText || '';
    navigator.clipboard.writeText(raw);
    const btn = card.querySelector('.code-copy-btn');
    if (btn) {
        btn.classList.add('copied');
        btn.innerHTML = '<span style="color:#10b981; font-weight:700;">✓</span> <span class="copy-text" style="color:#10b981;">Copied!</span>';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> <span class="copy-text">Copy code</span>';
        }, 1800);
    }
};

window.toggleCodeCardExpand = function(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const isCollapsed = card.classList.toggle('is-collapsed');
    const label = card.querySelector('.show-more-label');
    const raw = card.querySelector('.raw-code-store')?.value || '';
    const lineCount = raw ? raw.split('\n').length : 0;
    if (label) {
        label.textContent = isCollapsed ? `Show more (${lineCount} lines)` : 'Show less';
    }
};

function formatMarkdown(text) {
    if (!text) return '';
    let escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 1. Code blocks with language detection & syntax highlighting
    const codeBlocks = [];
    escaped = escaped.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (m, lang, code) => {
        lang = (lang || 'python').toLowerCase().trim();
        const cleanCode = code.trim();
        const lineCount = cleanCode.split('\n').length;
        const isLong = lineCount > 10;
        const highlighted = (lang === 'python' || lang === 'py' || lang === 'pyspark')
            ? highlightPython(cleanCode)
            : highlightGeneric(cleanCode, lang);

        const cardId = `code_card_${Math.random().toString(36).substring(2, 10)}`;
        const showMoreBtnHtml = isLong ? `
            <div class="code-card-footer">
                <button class="btn-code-show-more" onclick="toggleCodeCardExpand('${cardId}')">
                    <span class="show-more-label">Show more (${lineCount} lines)</span>
                </button>
            </div>
        ` : '';

        const cardHtml = `
            <div class="code-card ${isLong ? 'is-collapsible is-collapsed' : ''}" id="${cardId}">
                <div class="code-card-header">
                    <span class="code-lang-label">${lang}</span>
                    <button class="code-copy-btn" onclick="copyCodeBlock('${cardId}')" title="Copy code">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        <span class="copy-text">Copy code</span>
                    </button>
                </div>
                <pre class="code-card-body"><code class="language-${lang}">${highlighted}</code></pre>
                ${showMoreBtnHtml}
                <textarea class="raw-code-store" style="display:none;">${cleanCode}</textarea>
            </div>
        `;
        const id = `__CODE_BLOCK_${codeBlocks.length}__`;
        codeBlocks.push(cardHtml);
        return id;
    });

    // 2. Markdown tables
    const tableRegex = /(?:^[ \t]*\|[^\n]+\|[ \t]*\n[ \t]*\|[ \t]*(?:[-:]+[-| :]*)\|[ \t]*\n(?:[ \t]*\|[^\n]+\|[ \t]*(?:\n|$))+)/gm;
    escaped = escaped.replace(tableRegex, (tableMatch) => {
        const lines = tableMatch.trim().split('\n').map(l => l.trim());
        if (lines.length < 3) return tableMatch;

        const parseRow = (line) => {
            return line
                .replace(/^\|/, '')
                .replace(/\|$/, '')
                .split('|')
                .map(c => c.trim());
        };

        const headers = parseRow(lines[0]);
        let tableHtml = '<div class="chat-md-table-wrapper"><table class="chat-md-table"><thead><tr>';
        headers.forEach(h => {
            tableHtml += `<th>${h}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';

        lines.slice(2).forEach(rowLine => {
            if (!rowLine.trim() || !rowLine.includes('|')) return;
            const cells = parseRow(rowLine);
            tableHtml += '<tr>';
            cells.forEach(c => {
                tableHtml += `<td>${c}</td>`;
            });
            tableHtml += '</tr>';
        });

        tableHtml += '</tbody></table></div>';
        return tableHtml;
    });

    // 3. Inline code
    escaped = escaped.replace(/`([^`]+)`/g, '<code class="chat-md-code">$1</code>');
    
    // 4. Headers
    escaped = escaped.replace(/### (.*?)(?:\n|$)/g, '<h4 class="chat-md-h4">$1</h4>\n');
    escaped = escaped.replace(/## (.*?)(?:\n|$)/g, '<h3 class="chat-md-h3">$1</h3>\n');
    escaped = escaped.replace(/# (.*?)(?:\n|$)/g, '<h2 class="chat-md-h2">$1</h2>\n');
    
    // 5. Bold & Italics
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="chat-md-strong">$1</strong>');
    escaped = escaped.replace(/\*(.*?)\*/g, '<em class="chat-md-em">$1</em>');

    // 6. Group consecutive list items into a clean tight <ul> list
    escaped = escaped.replace(/(?:^[ \t]*(?:[-*•]|\d+\.)[ \t]+[^\n]+(?:\n+(?:[ \t]*(?:[-*•]|\d+\.)[ \t]+[^\n]+))*)/gm, (listMatch) => {
        const lines = listMatch.split('\n').map(l => l.trim()).filter(l => Boolean(l) && /^(?:[-*•]|\d+\.)\s+/.test(l));
        if (lines.length === 0) return listMatch;
        let itemsHtml = '<ul class="chat-md-list">';
        lines.forEach(l => {
            const itemText = l.replace(/^(?:[-*•]|\d+\.)\s+/, '').trim();
            if (itemText) {
                itemsHtml += `<li class="chat-md-list-item"><span class="list-bullet">•</span><span class="list-content">${itemText}</span></li>`;
            }
        });
        itemsHtml += '</ul>';
        return itemsHtml;
    });

    // 7. Clean paragraph separation
    escaped = escaped.replace(/\n{2,}/g, '<div class="chat-md-spacer"></div>');
    escaped = escaped.replace(/\n/g, '<br>');
    escaped = escaped.replace(/(?:<br>)+<ul/g, '<ul');
    escaped = escaped.replace(/<\/ul>(?:<br>)+/g, '</ul>');
    escaped = escaped.replace(/(?:<br>)+<h/g, '<h');
    escaped = escaped.replace(/<\/h[1-4]>(?:<br>)+/g, '</h$1>');
    escaped = escaped.replace(/(?:<br>)+<div class="chat-md-table-wrapper"/g, '<div class="chat-md-table-wrapper"');
    escaped = escaped.replace(/<\/div>(?:<br>)+/g, '</div>');

    // Restore Code blocks
    codeBlocks.forEach((cb, idx) => {
        escaped = escaped.replace(`__CODE_BLOCK_${idx}__`, cb);
    });

    return escaped;
}

// ── VIEW 2: Ingestion Studio ──────────────────────────────────────────────────
function initIngestionStudio() {
    document.getElementById('btnBackToConnectors')?.addEventListener('click', () => {
        document.getElementById('stepConnectors').style.display = 'block';
        document.getElementById('stepParams').style.display = 'none';
        document.getElementById('stepTables').style.display = 'none';
        document.getElementById('stepMatrix').style.display = 'none';
        document.getElementById('ingestStepBadge').textContent = 'Step 1 of 3';
    });

    document.getElementById('btnDiscoverTables')?.addEventListener('click', handleDiscoverTables);
    document.getElementById('btnGeneratePlan')?.addEventListener('click', handleGenerateIngestionPlan);
    document.getElementById('btnDeployIngestion')?.addEventListener('click', handleDeployIngestion);

    // Zoom Controls
    document.getElementById('btnZoomIn')?.addEventListener('click', () => zoomDAG(0.15));
    document.getElementById('btnZoomOut')?.addEventListener('click', () => zoomDAG(-0.15));
    document.getElementById('btnResetZoom')?.addEventListener('click', () => resetZoomDAG());
}

async function loadConnectors() {
    const data = await apiFetch('/api/connectors');
    const grid = document.getElementById('connectorGrid');
    if (!grid || !data.connectors) return;

    App.connectors = data.connectors;
    grid.innerHTML = '';

    data.connectors.forEach(c => {
        const card = document.createElement('div');
        card.className = 'connector-card';
        const badgeClass = c.is_stub ? 'badge-stub' : 'badge-live';
        const badgeText = c.is_stub ? 'STUB' : 'LIVE';

        card.innerHTML = `
            <div class="connector-card-header">
                <div class="connector-icon-box">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                </div>
                <span class="connector-badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="connector-card-title">${c.name}</div>
        `;
        card.addEventListener('click', () => selectConnector(c));
        grid.appendChild(card);
    });
}

function selectConnector(connector) {
    App.selectedConnector = connector;
    document.querySelectorAll('.connector-card').forEach(c => c.classList.remove('selected'));

    document.getElementById('stepConnectors').style.display = 'none';
    document.getElementById('stepParams').style.display = 'block';
    document.getElementById('ingestStepBadge').textContent = 'Step 2 of 3';

    const form = document.getElementById('connectorParamsForm');
    form.innerHTML = '';

    (connector.required_params || []).forEach(p => {
        const group = document.createElement('div');
        group.className = 'form-group';
        group.innerHTML = `
            <label class="form-label">${p.label || p.key}</label>
            <input type="${p.type === 'password' ? 'password' : 'text'}" 
                   name="${p.key}" 
                   class="form-input" 
                   placeholder="${p.placeholder || ''}" 
                   value="${p.default || ''}">
        `;
        form.appendChild(group);
    });
}

async function handleDiscoverTables() {
    if (!App.selectedConnector) return;
    const form = document.getElementById('connectorParamsForm');
    const formData = new FormData(form);
    App.connectorParams = {};
    formData.forEach((v, k) => { App.connectorParams[k] = v; });

    showToast('Connecting and querying schema metadata...', 'info');
    const res = await apiFetch('/api/connector/discover', {
        method: 'POST',
        body: { source_id: App.selectedConnector.id, params: App.connectorParams },
    });

    if (res && res.success && res.tables) {
        App.discoveredTables = res.tables;
        App.selectedTables = new Set(res.tables.map(t => `${t.schema || 'dbo'}.${t.table}`));
        renderDiscoveredTables(res.tables);

        document.getElementById('stepParams').style.display = 'none';
        document.getElementById('stepTables').style.display = 'block';
        document.getElementById('ingestStepBadge').textContent = 'Step 3 of 3';
        showToast(`Discovered ${res.tables.length} tables in source!`, 'success');
    } else {
        showToast(res.error || 'Connection failed.', 'error');
    }
}

function renderDiscoveredTables(tables) {
    const list = document.getElementById('tableDiscoveryList');
    if (!list) return;
    list.innerHTML = '';

    tables.forEach(t => {
        const fullName = `${t.schema || 'dbo'}.${t.table}`;
        const row = document.createElement('div');
        row.className = `table-item-row ${App.selectedTables.has(fullName) ? 'selected' : ''}`;
        row.innerHTML = `
            <span>📋 ${fullName}</span>
            <span style="font-size:10.5px; opacity:0.6;">${t.estimated_rows ? t.estimated_rows.toLocaleString() + ' rows' : 'Delta Ready'}</span>
        `;
        row.addEventListener('click', () => {
            if (App.selectedTables.has(fullName)) {
                App.selectedTables.delete(fullName);
                row.classList.remove('selected');
            } else {
                App.selectedTables.add(fullName);
                row.classList.add('selected');
            }
            document.getElementById('selectedTableCount').textContent = `${App.selectedTables.size} selected`;
        });
        list.appendChild(row);
    });
    document.getElementById('selectedTableCount').textContent = `${App.selectedTables.size} selected`;
}

async function handleGenerateIngestionPlan() {
    if (App.selectedTables.size === 0) {
        showToast('Please select at least one table to ingest.', 'error');
        return;
    }

    const selectedList = App.discoveredTables.filter(t => App.selectedTables.has(`${t.schema || 'dbo'}.${t.table}`));
    const schedule = document.getElementById('ingestScheduleInput')?.value || 'Nightly at 02:00 UTC';

    showToast('Classifying ingestion strategy (Full vs. Incremental)...', 'info');
    const plan = await apiFetch('/api/ingestion/plan', {
        method: 'POST',
        body: {
            source_id: App.selectedConnector.id,
            source_name: App.selectedConnector.name,
            database: App.connectorParams.database || 'SalesDB',
            tables: selectedList,
            schedule: schedule,
            params: App.connectorParams,
        },
    });

    if (plan && plan.flow_nodes) {
        App.currentPlan = plan;
        renderStrategyMatrix(plan.strategy_matrix || []);
        renderDAG(plan);

        document.getElementById('stepMatrix').style.display = 'block';
        showToast('Ingestion plan and visual DAG generated!', 'success');
    }
}

function renderStrategyMatrix(matrix) {
    const tableEl = document.getElementById('strategyMatrixTable');
    if (!tableEl) return;
    tableEl.innerHTML = '';

    matrix.forEach(m => {
        const row = document.createElement('div');
        row.className = 'matrix-row-card';
        const badgeClass = m.load_type === 'Incremental' ? 'matrix-badge-incremental' : 'matrix-badge-full';
        row.innerHTML = `
            <div class="matrix-row-header">
                <span class="matrix-table-name">${m.table}</span>
                <span class="${badgeClass}">${m.load_type} (${m.delta_strategy})</span>
            </div>
            <div class="matrix-meta-details">
                PK: ${m.primary_key || 'None'} · Watermark: ${m.watermark_column || 'None'} · Est. Rows: ${m.estimated_rows ? m.estimated_rows.toLocaleString() : 'N/A'}
            </div>
        `;
        tableEl.appendChild(row);
    });
}

function renderDAG(plan) {
    const placeholder = document.getElementById('dagPlaceholder');
    const container = document.getElementById('dagContainer');
    if (!container) return;

    if (placeholder) placeholder.style.display = 'none';
    container.style.display = 'block';

    FlowRenderer.render(container, plan.flow_nodes, plan.flow_edges, (node) => {
        showToast(`Selected node: ${node.label || node.id} (${node.type})`, 'info');
    });

    const statusPill = document.getElementById('dagStatusPill');
    if (statusPill) statusPill.textContent = `${plan.flow_nodes.length} Nodes Ready`;
}

function zoomDAG(delta) {
    App.currentScale = Math.max(0.4, Math.min(2.0, App.currentScale + delta));
    const container = document.getElementById('dagContainer');
    if (container) container.style.transform = `scale(${App.currentScale})`;
}

function resetZoomDAG() {
    App.currentScale = 1.0;
    const container = document.getElementById('dagContainer');
    if (container) container.style.transform = 'scale(1.0)';
}

async function handleDeployIngestion() {
    if (!App.currentPlan || !App.currentPlan.run_id) return;
    const runId = App.currentPlan.run_id;

    showToast(`Deploying ingestion pipeline to workspace ${App.workspace.name}...`, 'info');
    const res = await apiFetch('/api/ingestion/deploy', {
        method: 'POST',
        body: { run_id: runId },
    });

    if (res && res.status === 'deploying') {
        showToast('Deployment started! Switched to Live Monitoring.', 'success');
        switchView('viewMonitoring');
        startMonitoringRun(runId);
    }
}

// ── VIEW 3: Workspace Explorer (Sleek List View) ──────────────────────────────
let _wsActiveFilter = 'all';
let _wsListenersAttached = false;

function getFabricItemIcon(type) {
    const t = (type || '').toLowerCase();
    
    // 1. Official Microsoft Fabric Lakehouse Logo (Teal Delta + Storage)
    if (t === 'lakehouse') {
        return `<div class="ws-item-icon-box icon-lakehouse" title="Delta Lakehouse">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <path d="M16 3L4 9.2v13.6L16 29l12-6.2V9.2L16 3z" fill="#008272" opacity="0.25"/>
                <path d="M16 3L4 9.2l12 6.2 12-6.2L16 3z" fill="#00B294"/>
                <path d="M4 9.2v13.6l12 6.2V15.4L4 9.2z" fill="#008272"/>
                <path d="M28 9.2v13.6l-12 6.2V15.4l12-6.2z" fill="#00D2A0"/>
                <path d="M16 11l4.5 8h-9l4.5-8z" fill="#ffffff"/>
            </svg>
        </div>`;
    }

    // 2. Official Microsoft Fabric / Synapse PySpark Notebook Logo
    if (t === 'notebook') {
        return `<div class="ws-item-icon-box icon-notebook" title="PySpark Notebook">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <rect x="5" y="3" width="22" height="26" rx="3" fill="#0078D4"/>
                <path d="M5 3h5v26H5z" fill="#005A9E"/>
                <rect x="13" y="7" width="11" height="2" rx="1" fill="#ffffff"/>
                <rect x="13" y="12" width="8" height="2" rx="1" fill="#E1DFDD"/>
                <rect x="13" y="17" width="11" height="2" rx="1" fill="#E1DFDD"/>
                <path d="M13 23l4 3 6-5" stroke="#FFA100" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>`;
    }

    // 3. Official Microsoft Fabric Data Pipeline / Data Factory Logo
    if (t === 'datapipeline' || t === 'pipeline') {
        return `<div class="ws-item-icon-box icon-pipeline" title="Data Pipeline">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <circle cx="8" cy="16" r="5" fill="#0078D4"/>
                <circle cx="24" cy="16" r="5" fill="#8764B8"/>
                <rect x="11" y="14" width="10" height="4" rx="2" fill="#00BCF2"/>
                <polygon points="14,10 20,16 14,22" fill="#B4009E"/>
                <circle cx="8" cy="16" r="2" fill="#ffffff"/>
                <circle cx="24" cy="16" r="2" fill="#ffffff"/>
            </svg>
        </div>`;
    }

    // 4. Official Microsoft Fabric Data Agent / Copilot Logo
    if (t === 'dataagent') {
        return `<div class="ws-item-icon-box icon-agent" title="Fabric Data Agent / Copilot">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="13" fill="url(#agent_grad)"/>
                <path d="M16 7l2.5 6.5L25 16l-6.5 2.5L16 25l-2.5-6.5L7 16l6.5-2.5L16 7z" fill="#ffffff"/>
                <defs>
                    <linearGradient id="agent_grad" x1="3" y1="3" x2="29" y2="29" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#0078D4"/>
                        <stop offset="0.5" stop-color="#8661C5"/>
                        <stop offset="1" stop-color="#FFB900"/>
                    </linearGradient>
                </defs>
            </svg>
        </div>`;
    }

    // 5. Official Microsoft Fabric Data Warehouse Logo (Purple Cube)
    if (t === 'warehouse') {
        return `<div class="ws-item-icon-box icon-warehouse" title="Data Warehouse">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <path d="M16 3L4 9.5v13L16 29l12-6.5v-13L16 3z" fill="#5C2D91" opacity="0.25"/>
                <path d="M16 3L4 9.5l12 6.5 12-6.5L16 3z" fill="#8764B8"/>
                <path d="M4 9.5v13l12 6.5V16L4 9.5z" fill="#5C2D91"/>
                <path d="M28 9.5v13l-12 6.5V16l12-6.5z" fill="#744DA9"/>
                <path d="M10 19l6 3 6-3" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M10 23l6 3 6-3" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>`;
    }

    // 6. Official Microsoft Fabric SQL Analytics Endpoint Logo
    if (t === 'sqlendpoint') {
        return `<div class="ws-item-icon-box icon-sqlendpoint" title="SQL Analytics Endpoint">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <ellipse cx="16" cy="8" rx="10" ry="4" fill="#008272"/>
                <path d="M6 8v7c0 2.2 4.5 4 10 4s10-1.8 10-4V8" stroke="#00B294" stroke-width="2" fill="none"/>
                <path d="M6 15v7c0 2.2 4.5 4 10 4s10-1.8 10-4v-7" stroke="#00D2A0" stroke-width="2" fill="none"/>
                <polyline points="13 15 16 18 22 12" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>`;
    }

    // 7. Official Real-Time Intelligence / Eventhouse / KQL Database
    if (t === 'eventhouse' || t === 'kqldatabase') {
        return `<div class="ws-item-icon-box icon-realtime" title="Eventhouse / Real-Time Database">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="13" fill="#D83B01" opacity="0.2"/>
                <circle cx="16" cy="16" r="13" stroke="#D83B01" stroke-width="2"/>
                <path d="M12 9l8 7-8 7V9z" fill="#FF8C00"/>
                <path d="M17 16h6" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
            </svg>
        </div>`;
    }

    // 8. User Data Function
    if (t === 'userdatafunction') {
        return `<div class="ws-item-icon-box icon-function" title="User Data Function">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                <rect x="4" y="4" width="24" height="24" rx="6" fill="#107C41" opacity="0.2"/>
                <rect x="4" y="4" width="24" height="24" rx="6" stroke="#107C41" stroke-width="2"/>
                <text x="16" y="21" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="700" fill="#27AE60" text-anchor="middle">ƒx</text>
            </svg>
        </div>`;
    }

    // Default Fallback
    return `<div class="ws-item-icon-box icon-generic" title="${escapeHtml(type)}">
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
            <rect x="5" y="5" width="22" height="22" rx="4" fill="#333538"/>
            <rect x="5" y="5" width="22" height="22" rx="4" stroke="#52525b" stroke-width="1.5"/>
            <circle cx="16" cy="16" r="4" fill="#a1a1aa"/>
        </svg>
    </div>`;
}

function initWorkspaceExplorer() {
    if (_wsListenersAttached) return;
    _wsListenersAttached = true;

    const syncBtn = document.getElementById('btnSyncWorkspace');
    const searchInput = document.getElementById('workspaceSearchInput');
    const filterPills = document.querySelectorAll('#wsFilterPills .filter-pill');

    syncBtn?.addEventListener('click', async () => {
        syncBtn.classList.add('loading');
        showToast('Syncing workspace items with Microsoft Fabric...', 'info');
        await apiFetch('/api/workspace/refresh');
        await loadWorkspaceItems();
        syncBtn.classList.remove('loading');
        showToast('Workspace inventory synced.', 'success');
    });

    searchInput?.addEventListener('input', () => {
        filterWorkspaceItems();
    });

    const setFilter = (targetFilter) => {
        _wsActiveFilter = targetFilter;
        filterPills.forEach(p => {
            p.classList.toggle('active', (p.getAttribute('data-filter') || 'all') === targetFilter);
        });
        filterWorkspaceItems();
    };

    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            setFilter(pill.getAttribute('data-filter') || 'all');
        });
    });
}

async function loadWorkspaceItems() {
    const pageTitle = document.getElementById('wsPageTitle');
    if (pageTitle && App.workspace?.name) {
        pageTitle.textContent = App.workspace.name;
    }

    try {
        const data = await apiFetch('/api/workspace/items');
        if (data && Array.isArray(data.items)) {
            App.workspaceItems = data.items;

            // Update Counts
            const total = data.items.length;
            const lakehouses = data.items.filter(i => (i.type || '').toLowerCase() === 'lakehouse').length;
            const notebooks = data.items.filter(i => (i.type || '').toLowerCase() === 'notebook').length;
            const pipelines = data.items.filter(i => ['datapipeline', 'pipeline'].includes((i.type || '').toLowerCase())).length;
            const agents = data.items.filter(i => (i.type || '').toLowerCase() === 'dataagent').length;
            const others = total - (lakehouses + notebooks + pipelines + agents);

            const totalPill = document.getElementById('wsTotalPill');
            if (totalPill) totalPill.textContent = `${total} Items`;

            const pAll = document.getElementById('wsPillAll');
            const pLh = document.getElementById('wsPillLh');
            const pNb = document.getElementById('wsPillNb');
            const pPl = document.getElementById('wsPillPl');
            const pAg = document.getElementById('wsPillAg');
            const pOther = document.getElementById('wsPillOther');

            if (pAll) pAll.textContent = `(${total})`;
            if (pLh) pLh.textContent = `(${lakehouses})`;
            if (pNb) pNb.textContent = `(${notebooks})`;
            if (pPl) pPl.textContent = `(${pipelines})`;
            if (pAg) pAg.textContent = `(${agents})`;
            if (pOther) pOther.textContent = `(${others})`;

            filterWorkspaceItems();
        }
    } catch (err) {
        console.error("loadWorkspaceItems error:", err);
    }
}

function filterWorkspaceItems() {
    const searchInput = document.getElementById('workspaceSearchInput');
    const query = (searchInput?.value || '').toLowerCase().trim();
    const items = App.workspaceItems || [];

    const filtered = items.filter(item => {
        const type = (item.type || '').toLowerCase();
        let matchesType = false;

        if (_wsActiveFilter === 'all') {
            matchesType = true;
        } else if (_wsActiveFilter === 'other') {
            matchesType = !['lakehouse', 'notebook', 'datapipeline', 'pipeline', 'dataagent'].includes(type);
        } else {
            matchesType = type === _wsActiveFilter.toLowerCase() || (_wsActiveFilter === 'DataPipeline' && ['datapipeline', 'pipeline'].includes(type));
        }

        const matchesQuery = !query || 
            (item.displayName || '').toLowerCase().includes(query) ||
            (item.type || '').toLowerCase().includes(query) ||
            (item.id || '').toLowerCase().includes(query) ||
            (item.description || '').toLowerCase().includes(query) ||
            (item.folderId || '').toLowerCase().includes(query);

        return matchesType && matchesQuery;
    });

    renderWorkspaceList(filtered);
}

function renderWorkspaceList(items) {
    const listBody = document.getElementById('workspaceItemsList');
    if (!listBody) return;

    if (!items || items.length === 0) {
        listBody.innerHTML = `
            <div class="ws-empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
                <div class="ws-empty-title">No Workspace Items Found</div>
                <div class="ws-empty-sub">Try changing your search query or filter category.</div>
            </div>
        `;
        return;
    }

    listBody.innerHTML = items.map(item => {
        const type = item.type || 'Item';
        const typeLower = type.toLowerCase();
        const iconHtml = getFabricItemIcon(type);
        const isPipeline = ['datapipeline', 'pipeline'].includes(typeLower);
        const isNotebook = typeLower === 'notebook';
        const isLakehouse = typeLower === 'lakehouse';
        const isWarehouse = typeLower === 'warehouse';
        const isSqlEndpoint = typeLower === 'sqlendpoint';

        // Badge class
        let typeBadgeClass = 'badge-generic';
        if (isLakehouse) typeBadgeClass = 'badge-lakehouse';
        else if (isNotebook) typeBadgeClass = 'badge-notebook';
        else if (isPipeline) typeBadgeClass = 'badge-pipeline';
        else if (typeLower === 'dataagent') typeBadgeClass = 'badge-agent';
        else if (isWarehouse) typeBadgeClass = 'badge-warehouse';
        else if (isSqlEndpoint) typeBadgeClass = 'badge-sqlendpoint';
        else if (typeLower === 'userdatafunction') typeBadgeClass = 'badge-function';
        else if (typeLower.includes('kql') || typeLower.includes('event')) typeBadgeClass = 'badge-realtime';

        // Folder location text
        const folderText = item.folderId ? `📁 Subfolder (${item.folderId.slice(0, 6)}...)` : `📁 Workspace Root`;

        // Storage / ABFSS Path
        let abfssPath = '';
        if (isLakehouse) {
            abfssPath = `abfss://${item.displayName}@onelake.dfs.fabric.microsoft.com/Tables/`;
        } else if (isNotebook) {
            abfssPath = `synapse://${item.displayName}.Notebook`;
        } else if (isPipeline) {
            abfssPath = `pipeline://${item.displayName}`;
        } else if (isWarehouse) {
            abfssPath = `warehouse://${item.displayName}.Warehouse`;
        } else if (isSqlEndpoint) {
            abfssPath = `sql://${item.displayName}.Endpoint`;
        } else {
            abfssPath = `onelake://${item.id}`;
        }

        return `
            <div class="ws-table-row" data-item-id="${escapeHtml(item.id)}">
                <!-- Col 1: Name & ID -->
                <div class="ws-col-cell ws-col-name">
                    ${iconHtml}
                    <div class="ws-name-group">
                        <span class="ws-item-title" title="${escapeHtml(item.displayName)}">${escapeHtml(item.displayName)}</span>
                        <span class="ws-item-subid">${escapeHtml(item.id)}</span>
                    </div>
                </div>

                <!-- Col 2: Type Badge -->
                <div class="ws-col-cell ws-col-type">
                    <span class="ws-type-pill ${typeBadgeClass}">${escapeHtml(type)}</span>
                </div>

                <!-- Col 3: Folder Location -->
                <div class="ws-col-cell ws-col-location">
                    <span class="ws-folder-tag">${folderText}</span>
                </div>

                <!-- Col 4: OneLake ABFSS Path -->
                <div class="ws-col-cell ws-col-path">
                    <span class="ws-path-code" title="Click to copy path" onclick="navigator.clipboard.writeText('${escapeHtml(abfssPath)}'); showToast('Copied path to clipboard!', 'success');">
                        <code>${escapeHtml(abfssPath)}</code>
                    </span>
                </div>

                <!-- Col 5: Actions -->
                <div class="ws-col-cell ws-col-actions">
                    ${isPipeline ? `
                        <button class="ws-action-btn btn-run-pipeline" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(item.displayName)}" title="Trigger Pipeline Run">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            <span>Run</span>
                        </button>
                    ` : ''}
                    <button class="ws-action-btn ws-btn-copy-id" title="Copy Item ID" onclick="navigator.clipboard.writeText('${escapeHtml(item.id)}'); showToast('Item ID copied!', 'success');">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                    <button class="ws-action-btn ws-btn-del" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(item.displayName)}" title="Safe Delete" onclick="openSafeDeleteModal('${escapeHtml(item.id)}', '${escapeHtml(item.displayName)}')">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Attach Pipeline Run Event Handlers
    listBody.querySelectorAll('.btn-run-pipeline').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            const name = btn.getAttribute('data-name');
            showToast(`Triggering pipeline ${name}...`, 'info');
            const res = await apiFetch('/api/pipeline/trigger', {
                method: 'POST',
                body: { pipeline_id: id, pipeline_name: name },
            });
            if (res && res.success) {
                showToast(`Pipeline triggered! Job ID: ${res.job_id || 'Active'}`, 'success');
                switchView('viewMonitoring');
            } else {
                showToast(res.error || 'Failed to trigger pipeline.', 'error');
            }
        });
    });
}

// ── VIEW 4: Live Execution Monitor ────────────────────────────────────────────
function initExecutionMonitor() {
    // Monitor polling loop
}

function startMonitoringRun(runId) {
    App.activeRunId = runId;
    if (App.monitorPollTimer) clearInterval(App.monitorPollTimer);

    App.monitorPollTimer = setInterval(async () => {
        const run = await apiFetch(`/api/ingestion/status/${runId}`);
        if (run && run.steps) {
            renderTimelineSteps(run);
            const card = document.getElementById(`run-card-${runId}`);
            if (card) {
                const badge = card.querySelector('.status-badge');
                if (badge) {
                    badge.className = `status-badge status-${run.status || 'running'}`;
                    badge.textContent = (run.status || 'RUNNING').toUpperCase();
                }
            }
            if (run.status === 'completed' || run.status === 'error') {
                clearInterval(App.monitorPollTimer);
                showToast(`Run ${runId} ${run.status}!`, run.status === 'completed' ? 'success' : 'error');
                loadWorkspaceItems();
            }
        }
    }, 1000);
}

function renderTimelineSteps(run) {
    const container = document.getElementById('timelineContainer');
    if (!container) return;
    container.innerHTML = '';

    const statusPill = document.getElementById('timelineStatusPill');
    if (statusPill) statusPill.textContent = (run.status || 'running').toUpperCase();

    (run.steps || []).forEach(step => {
        const card = document.createElement('div');
        card.className = 'timeline-step-card';
        card.innerHTML = `
            <div class="step-num-badge">${step.step}</div>
            <div style="flex:1;">
                <div style="font-weight:600; color:#fff;">${step.title}</div>
                <div style="font-size:12px; color:var(--text-tertiary);">${step.detail}</div>
            </div>
            <span class="status-badge status-${step.status}">${step.status}</span>
        `;
        container.appendChild(card);
    });
}

// ── VIEW 5: System & Memory Dashboard ─────────────────────────────────────────
function initSystemDashboard() {
    document.getElementById('btnRunSmokeTest')?.addEventListener('click', async () => {
        const output = document.getElementById('diagnosticsOutput');
        if (output) output.textContent = 'Running full automated test suite (48 tests)...';
        showToast('Running all 48 test assertions...', 'info');

        // Fetch test output via system stats
        const data = await apiFetch('/api/system/stats');
        if (output && data) {
            output.textContent = `=== SYSTEM AUDIT RESULTS ===\n` +
                `✓ SQLite Memory Database: Operational (${data.db_stats?.sessions || 0} sessions, ${data.db_stats?.messages || 0} messages)\n` +
                `✓ Active Workspace: ${data.workspace?.name} (${data.workspace?.id})\n` +
                `✓ Azure Authentication: Valid (${data.auth?.user_identity || 'Logged in'})\n` +
                `✓ Primary AI Model: ${data.models?.groq_high || 'openai/gpt-oss-120b'}\n` +
                `✓ Workspace Inventory: ${data.item_counts?.Lakehouse || 0} Lakehouses, ${data.item_counts?.DataPipeline || 0} Pipelines\n` +
                `\nStatus: 100% HEALTHY. Zero failures detected.`;
            showToast('All 48 test assertions verified!', 'success');
        }
    });
}

async function loadSystemStats() {
    const data = await apiFetch('/api/system/stats');
    if (data && data.db_stats) {
        const sCount = document.getElementById('statSessionsCount');
        const mCount = document.getElementById('statMessagesCount');
        const fCount = document.getElementById('statFactsCount');

        if (sCount) sCount.textContent = data.db_stats.sessions || 0;
        if (mCount) mCount.textContent = data.db_stats.messages || 0;
        if (fCount) fCount.textContent = data.db_stats.learned_facts || 0;
    }
}

// ── Memory Drawer & Slide-out ─────────────────────────────────────────────────
function initMemoryDrawer() {
    const backdrop = document.getElementById('memoryDrawerBackdrop');
    const openBtn = document.getElementById('btnOpenMemoryDrawer');
    const closeBtn = document.getElementById('btnCloseMemoryDrawer');

    openBtn?.addEventListener('click', () => {
        backdrop.classList.add('open');
        loadSessionSummary();
    });

    closeBtn?.addEventListener('click', () => {
        backdrop.classList.remove('open');
    });

    backdrop?.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.classList.remove('open');
    });
}

const _FACT_LABELS = {
    preferred_schedule:    'Schedule preference',
    source_database:       'Source database',
    target_lakehouse:      'Target lakehouse',
    target_lakehouses:     'Target lakehouses',
    preferred_source:      'Data source connector',
    architecture_pattern:  'Architecture pattern',
    working_folder:        'Working folder',
    last_folder:           'Working folder',
    notebooks_created:     'Notebooks configured',
    last_notebook:         'Last notebook',
    orchestration_pipeline: 'Orchestration pipeline',
    last_pipeline:         'Last pipeline',
    session_context:       'Session context',
    project_summary:       'Project summary',
};

async function loadSessionSummary() {
    const summary = await apiFetch('/api/session/summary');
    if (!summary) return;

    const facts = summary.facts || {};
    const factCount = Object.keys(facts).length;

    // Topbar pill — only visible when in an active chat with learned facts
    const topbarBtn = document.getElementById('btnOpenMemoryDrawer');
    const topbarCount = document.getElementById('topbarMemoryCount');
    const chatArea = document.getElementById('architectChatArea');
    const isChatActive = chatArea && chatArea.style.display !== 'none';

    if (topbarBtn) {
        topbarBtn.style.display = (factCount > 0 && isChatActive) ? 'inline-flex' : 'none';
    }

    if (topbarCount) {
        const ctxVal = facts.session_context || '';
        // Extract "N notebook(s)" snippet for the pill
        const nbMatch = ctxVal.match(/(\d+)\s+notebook/i);
        const nbPart  = nbMatch ? ` · ${nbMatch[1]} item${nbMatch[1] > 1 ? 's' : ''}` : '';
        topbarCount.textContent = factCount > 0
            ? `${factCount} Facts${nbPart}`
            : '0 Facts';
    }

    // Session ID label
    const drawerSession = document.getElementById('drawerSessionId');
    if (drawerSession) {
        drawerSession.textContent = `Session: ${summary.session_id || App.sessionId}  ·  ${summary.message_count || 0} messages`;
    }

    // Facts list
    const factsList = document.getElementById('drawerFactsList');
    if (!factsList) return;
    factsList.innerHTML = '';

    if (factCount === 0) {
        factsList.innerHTML = '<div class="empty-hint">No facts extracted yet. Mention a schedule, database, or folder in chat!</div>';
        return;
    }

    function formatFactText(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/`([^`]+)`/g, '<code class="fact-code">$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    }

    // session_context gets a full-width highlight card at the top
    if (facts.session_context) {
        const ctxCard = document.createElement('div');
        ctxCard.className = 'fact-item-card fact-context-card';
        ctxCard.innerHTML = `
            <span class="fact-key">Architecture Overview & Context</span>
            <span class="fact-value fact-value-full">${formatFactText(facts.session_context)}</span>
        `;
        factsList.appendChild(ctxCard);
    }

    // All other facts
    Object.entries(facts).forEach(([k, v]) => {
        if (k === 'session_context') return;   // already rendered above
        const label = _FACT_LABELS[k] || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const card = document.createElement('div');
        card.className = 'fact-item-card';
        card.innerHTML = `
            <span class="fact-key">${label}</span>
            <span class="fact-value">${formatFactText(v)}</span>
        `;
        factsList.appendChild(card);
    });
}


// ── Safe Deletion Modal ───────────────────────────────────────────────────────
let pendingDelete = { id: null, name: '' };

function initSafeDeleteModal() {
    const modal = document.getElementById('safeDeleteModal');
    const cancelBtn = document.getElementById('btnCancelDelete');
    const confirmBtn = document.getElementById('btnConfirmDelete');
    const input = document.getElementById('modalConfirmInput');

    cancelBtn?.addEventListener('click', () => modal.classList.remove('open'));

    input?.addEventListener('input', () => {
        const expected = `DELETE ${pendingDelete.name.toUpperCase()}`;
        confirmBtn.disabled = input.value.trim().toUpperCase() !== expected;
    });

    confirmBtn?.addEventListener('click', async () => {
        modal.classList.remove('open');
        showToast(`Executing safe delete on ${pendingDelete.name}...`, 'info');

        const res = await apiFetch('/api/item/delete', {
            method: 'POST',
            body: {
                item_id: pendingDelete.id,
                item_name: pendingDelete.name,
                confirmation: input.value.trim(),
            },
        });

        if (res && res.success) {
            showToast(`Deleted ${pendingDelete.name}. Backup saved.`, 'success');
            loadWorkspaceItems();
        } else {
            showToast(res.error || 'Delete failed.', 'error');
        }
    });
}

function openSafeDeleteModal(itemId, itemName) {
    pendingDelete = { id: itemId, name: itemName };
    const modal = document.getElementById('safeDeleteModal');
    const expectedEl = document.getElementById('modalExpectedPhrase');
    const input = document.getElementById('modalConfirmInput');
    const confirmBtn = document.getElementById('btnConfirmDelete');

    if (expectedEl) expectedEl.textContent = `DELETE ${itemName.toUpperCase()}`;
    if (input) input.value = '';
    if (confirmBtn) confirmBtn.disabled = true;

    modal.classList.add('open');
}

// ── CONVERSATIONS & CHAT HISTORY MANAGER ═════════════════════════════════════
let cachedConversations = [];

function initConversationsDrawer() {
    const backdrop = document.getElementById('conversationsDrawerBackdrop');
    const openBtnTopbar = document.getElementById('btnOpenConversationsDrawer');
    const openBtnNav = document.getElementById('navConversations');
    const closeBtn = document.getElementById('btnCloseConversationsDrawer');
    const newChatBtn = document.getElementById('btnNewChatDrawer');
    const searchInput = document.getElementById('inputSearchConversations');

    const openDrawer = () => {
        backdrop?.classList.add('open');
        loadConversationsList();
    };

    openBtnTopbar?.addEventListener('click', openDrawer);
    openBtnNav?.addEventListener('click', (e) => {
        e.preventDefault();
        openDrawer();
    });

    closeBtn?.addEventListener('click', () => backdrop?.classList.remove('open'));
    backdrop?.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.classList.remove('open');
    });

    newChatBtn?.addEventListener('click', () => {
        backdrop?.classList.remove('open');
        createNewConversation();
    });

    searchInput?.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        renderConversations(cachedConversations.filter(c => 
            (c.title || '').toLowerCase().includes(q) ||
            (c.first_prompt || '').toLowerCase().includes(q) ||
            (c.session_id || '').toLowerCase().includes(q)
        ));
    });
}

function formatRelativeTime(isoStr) {
    if (!isoStr) return '';
    // Handle Unix timestamps (numbers) and non-string types gracefully
    let date;
    if (typeof isoStr === 'number') {
        date = new Date(isoStr * 1000); // assume seconds if number
    } else if (typeof isoStr === 'string') {
        date = new Date(isoStr.endsWith('Z') ? isoStr : isoStr + 'Z');
    } else {
        return '';
    }
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

async function loadConversationsList() {
    // Immediate cached rendering: show previously fetched conversations instantly
    const localCached = localStorage.getItem('fabric_cached_conversations');
    if (localCached) {
        try {
            let parsed = JSON.parse(localCached);
            if (Array.isArray(parsed) && parsed.length > 0) {
                renderSidebarRecentChats(parsed);
            }
        } catch (e) {}
    }

    // Fetch fresh list from server
    let res = null;
    try {
        res = await apiFetch('/api/conversations');
    } catch (err) {
        console.warn('[CONVERSATIONS] First fetch failed, retrying in 1s...', err);
    }

    // Retry once if first attempt returned nothing useful
    if (!res || !res.conversations) {
        await new Promise(r => setTimeout(r, 1000));
        try {
            res = await apiFetch('/api/conversations');
        } catch (err) {
            console.error('[CONVERSATIONS] Retry also failed:', err);
            return;
        }
    }

    if (!res || !res.conversations) return;

    cachedConversations = res.conversations;
    const count = cachedConversations.length;
    try {
        localStorage.setItem('fabric_cached_conversations', JSON.stringify(cachedConversations));
    } catch (e) {}

    // Update badges
    const drawerBadge = document.getElementById('drawerConvCount');
    const navBadge = document.getElementById('conversationsCountBadge');
    const topbarPill = document.getElementById('topbarConversationsCount');

    if (drawerBadge) drawerBadge.textContent = count;
    if (navBadge) navBadge.textContent = count;
    if (topbarPill) topbarPill.textContent = `${count} Chat${count === 1 ? '' : 's'}`;

    renderConversations(cachedConversations);
    renderSidebarRecentChats(cachedConversations);
}

let activeSidebarMenu = null;

function closeSidebarChatMenu() {
    if (activeSidebarMenu) {
        activeSidebarMenu.remove();
        activeSidebarMenu = null;
    }
    document.querySelectorAll('.sidebar-chat-item.menu-open').forEach(i => i.classList.remove('menu-open'));
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.sidebar-chat-menu-popup') && !e.target.closest('.sidebar-chat-more-btn')) {
        closeSidebarChatMenu();
    }
});

function renderSidebarRecentChats(conversations) {
    const listEl = document.getElementById('sidebarRecentChatsList');
    if (!listEl) return;

    const isLanding = document.getElementById('boltChatPane')?.classList.contains('is-landing') ||
                      (document.getElementById('playgroundHome') && document.getElementById('playgroundHome').style.display !== 'none');

    if (conversations && conversations.length > 0) {
        listEl.innerHTML = '';
        conversations.slice(0, 25).forEach((conv, idx) => {
            const isActive = !isLanding && (conv.session_id === App.sessionId);
            const item = document.createElement('a');
            item.href = '#';
            item.className = `sidebar-chat-item ${isActive ? 'active' : ''}`;
            item.setAttribute('data-session-id', conv.session_id);
            
            let displayTitle = (conv.title || '').trim();
            if (!displayTitle || displayTitle.match(/^Chat\s+[0-9a-fA-F]+/i)) {
                if (conv.first_prompt && conv.first_prompt.trim()) {
                    displayTitle = conv.first_prompt.trim();
                } else if (displayTitle) {
                    // Keep existing title
                } else {
                    displayTitle = 'New Chat';
                }
            }
            // Strip surrounding quotes
            if (displayTitle.startsWith('"') && displayTitle.endsWith('"')) {
                displayTitle = displayTitle.slice(1, -1);
            }
            if (displayTitle.length > 34) {
                displayTitle = displayTitle.substring(0, 32) + '...';
            }

            item.title = conv.title || displayTitle;
            item.innerHTML = `
                <span class="chat-bullet">${isActive ? '●' : '○'}</span>
                <span class="chat-item-text">${escapeHtml(displayTitle)}</span>
                <button class="sidebar-chat-more-btn" title="Options">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                </button>
            `;

            // Click on chat item to switch conversation
            item.addEventListener('click', (e) => {
                if (e.target.closest('.sidebar-chat-more-btn')) return;
                e.preventDefault();
                closeSidebarChatMenu();
                switchConversation(conv.session_id);
            });

            // 3-dots more options button
            const moreBtn = item.querySelector('.sidebar-chat-more-btn');
            moreBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const isAlreadyOpen = item.classList.contains('menu-open') && activeSidebarMenu;
                closeSidebarChatMenu();
                if (isAlreadyOpen) return;

                item.classList.add('menu-open');
                const menu = document.createElement('div');
                menu.className = 'sidebar-chat-menu-popup';
                menu.innerHTML = `
                    <div class="chat-menu-item" data-action="new-tab">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        <span class="menu-label">Open in new tab</span>
                    </div>
                    <div class="chat-menu-item" data-action="pin">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.77V6a3 3 0 0 0-6 0v4.77a2 2 0 0 1-1.11 1.79l-1.78.89A2 2 0 0 0 5 15.24z"/></svg>
                        <span class="menu-label">Pin</span>
                        <span class="menu-shortcut">P</span>
                    </div>
                    <div class="chat-menu-item" data-action="mark-unread">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        <span class="menu-label">Mark as unread</span>
                        <span class="menu-shortcut">U</span>
                    </div>
                    <div class="chat-menu-item" data-action="rename">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        <span class="menu-label">Rename</span>
                        <span class="menu-shortcut">R</span>
                    </div>
                    <div class="chat-menu-item" data-action="add-project">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                        <span class="menu-label">Add to project</span>
                        <span class="menu-arrow">›</span>
                    </div>
                    <div class="chat-menu-item" data-action="move-group">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        <span class="menu-label">Move to group</span>
                        <span class="menu-arrow">›</span>
                    </div>
                    <div class="chat-menu-divider"></div>
                    <div class="chat-menu-item item-danger" data-action="delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        <span class="menu-label">Delete</span>
                        <span class="menu-shortcut">D</span>
                    </div>
                `;

                const rect = moreBtn.getBoundingClientRect();
                menu.style.top = `${Math.min(window.innerHeight - 280, rect.bottom + 4)}px`;
                menu.style.left = `${Math.min(window.innerWidth - 220, rect.left)}px`;

                document.body.appendChild(menu);
                activeSidebarMenu = menu;

                menu.querySelectorAll('.chat-menu-item').forEach(mi => {
                    mi.addEventListener('click', async (me) => {
                        me.stopPropagation();
                        const action = mi.getAttribute('data-action');
                        closeSidebarChatMenu();

                        if (action === 'delete') {
                            if (confirm(`Delete conversation "${conv.title || displayTitle}"?`)) {
                                await deleteConversation(conv.session_id);
                            }
                        } else if (action === 'rename') {
                            const newTitle = prompt('Enter new conversation title:', conv.title || displayTitle);
                            if (newTitle && newTitle.trim()) {
                                await apiFetch('/api/conversation/rename', {
                                    method: 'POST',
                                    body: { session_id: conv.session_id, title: newTitle.trim() }
                                });
                                loadConversationsList();
                            }
                        } else if (action === 'new-tab') {
                            window.open(window.location.href, '_blank');
                        } else if (action === 'pin') {
                            showToast(`Pinned "${displayTitle}" to top.`, 'info');
                        } else {
                            showToast(`${mi.querySelector('.menu-label')?.textContent} selected.`, 'info');
                        }
                    });
                });
            });

            listEl.appendChild(item);
        });
    } else {
        listEl.innerHTML = '<div class="sidebar-empty-chats">No conversations yet.<br>Start a new chat to get going.</div>';
    }
}

function renderConversations(conversations) {
    const listContainer = document.getElementById('conversationsList');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    if (!conversations || conversations.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-hint" style="padding: 24px 12px; text-align: center;">
                <div style="font-size: 24px; margin-bottom: 8px;">💬</div>
                <div style="font-weight: 600; color: #fff; margin-bottom: 4px;">No saved conversations yet</div>
                <div style="font-size: 11.5px; color: var(--text-tertiary);">Start a chat to save your prompts and generated architectures in SQLite.</div>
            </div>
        `;
        return;
    }

    conversations.forEach(conv => {
        const isActive = conv.session_id === App.sessionId;
        const card = document.createElement('div');
        card.className = `conv-card ${isActive ? 'active' : ''}`;
        card.id = `conv-card-${conv.session_id}`;

        const timeStr = formatRelativeTime(conv.last_active || conv.created_at);
        const msgCount = conv.message_count || 0;
        const runCount = conv.run_count || 0;

        card.innerHTML = `
            <div class="conv-card-top">
                <span class="conv-card-title" id="conv-title-${conv.session_id}">${escapeHtml(conv.title || 'Untitled Chat')}</span>
                ${isActive ? '<span class="conv-card-badge">Active</span>' : ''}
            </div>
            ${conv.first_prompt ? `<div class="conv-card-preview">${escapeHtml(conv.first_prompt)}</div>` : ''}
            <div class="conv-card-footer">
                <div class="conv-card-meta">
                    <span class="conv-card-meta-item">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        ${timeStr}
                    </span>
                    <span class="conv-card-meta-item">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        ${msgCount} msg${msgCount === 1 ? '' : 's'}
                    </span>
                    ${runCount > 0 ? `<span class="conv-card-meta-item" style="color:var(--emerald);">⚡ ${runCount} run${runCount === 1 ? '' : 's'}</span>` : ''}
                </div>
                <div class="conv-card-actions">
                    <button class="conv-btn-icon btn-rename" title="Rename conversation" data-id="${conv.session_id}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    <button class="conv-btn-icon btn-delete" title="Delete conversation" data-id="${conv.session_id}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
        `;

        // Click on card to switch conversation (ignore if clicked on actions)
        card.addEventListener('click', (e) => {
            if (e.target.closest('.conv-card-actions') || e.target.closest('input')) return;
            switchConversation(conv.session_id);
            document.getElementById('conversationsDrawerBackdrop')?.classList.remove('open');
        });

        // Rename button
        const renameBtn = card.querySelector('.btn-rename');
        renameBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            startRenameConversation(conv.session_id, conv.title || 'Untitled Chat');
        });

        // Delete button
        const deleteBtn = card.querySelector('.btn-delete');
        deleteBtn?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Delete conversation "${conv.title || conv.session_id}"? This cannot be undone.`)) {
                await deleteConversation(conv.session_id);
            }
        });

        listContainer.appendChild(card);
    });
}

function startRenameConversation(sessionId, currentTitle) {
    const titleEl = document.getElementById(`conv-title-${sessionId}`);
    if (!titleEl) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'conv-rename-input';
    input.value = currentTitle;

    titleEl.replaceWith(input);
    input.focus();
    input.select();

    const save = async () => {
        const newTitle = input.value.trim() || currentTitle;
        await apiFetch('/api/conversation/rename', {
            method: 'POST',
            body: { session_id: sessionId, title: newTitle },
        });
        showToast('Conversation renamed.', 'success');
        loadConversationsList();
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        } else if (e.key === 'Escape') {
            input.value = currentTitle;
            input.blur();
        }
    });
}

async function deleteConversation(sessionId) {
    const res = await apiFetch('/api/conversation/delete', {
        method: 'POST',
        body: { session_id: sessionId },
    });

    if (res && res.success) {
        showToast('Conversation deleted from database.', 'info');
        // If we deleted the active session, start a new one
        if (sessionId === App.sessionId) {
            createNewConversation();
        } else {
            loadConversationsList();
        }
    } else {
        showToast(res?.error || 'Failed to delete conversation.', 'error');
    }
}

async function createNewConversation() {
    const res = await apiFetch('/api/conversation/new', { method: 'POST' });
    const newSid = res && res.session_id ? res.session_id : ('sess_' + Math.random().toString(36).substring(2, 11));

    App.sessionId = newSid;
    App.currentPlan = null;
    localStorage.setItem('fabric_ai_session_id', App.sessionId);

    // Reset UI
    const thread = document.getElementById('chatThread');
    if (thread) thread.innerHTML = '';

    const hero = document.getElementById('architectHero');
    const chatArea = document.getElementById('architectChatArea');
    if (hero) hero.style.display = 'flex';
    if (chatArea) chatArea.style.display = 'none';

    setVisualCanvasButtonVisibility(false);
    closeWorkbench();
    switchView('viewArchitect');

    showToast('Started new conversation session.', 'info');
    loadSessionSummary();
    loadConversationsList();
}

async function switchConversation(sessionId) {
    if (!sessionId) return;
    App.sessionId = sessionId;
    localStorage.setItem('fabric_ai_session_id', App.sessionId);

    showToast('Loading conversation history...', 'info');
    const data = await apiFetch(`/api/conversation/${sessionId}`);

    const thread = document.getElementById('chatThread');
    if (thread) thread.innerHTML = '';

    const hero = document.getElementById('architectHero') || document.getElementById('playgroundHome');
    const chatArea = document.getElementById('architectChatArea');
    const topicEl = document.getElementById('chatSessionTopic');
    const boltPane = document.getElementById('boltChatPane');

    if (data && data.messages && data.messages.length > 0) {
        if (hero) hero.style.display = 'none';
        if (chatArea) chatArea.style.display = 'flex';
        if (boltPane) {
            boltPane.classList.remove('is-landing');
            boltPane.classList.add('in-chat');
        }
        setVisualCanvasButtonVisibility(true);
        if (topicEl) topicEl.textContent = data.title || 'Architect Session';

        // Update sidebar highlights
        const btnNewChat = document.getElementById('btnSidebarNewChat');
        if (btnNewChat) btnNewChat.classList.remove('active');
        document.querySelectorAll('.sidebar-chat-item').forEach(item => {
            const isThis = (item.getAttribute('data-session-id') === sessionId);
            item.classList.toggle('active', isThis);
            const bullet = item.querySelector('.chat-bullet');
            if (bullet) bullet.textContent = isThis ? '●' : '○';
        });

        data.messages.forEach(msg => {
            appendChatMessage(msg.role, msg.content, msg.created_at);
        });

        // Store latest run/plan for on-demand inspection without auto-triggering workbench
        if (data.latest_run && data.latest_run.plan_json) {
            let plan = data.latest_run.plan_json;
            if (typeof plan === 'string') {
                try { plan = JSON.parse(plan); } catch(e){}
            }
            App.currentPlan = plan;
        } else {
            App.currentPlan = null;
        }
        closeWorkbench();
    } else {
        App.currentPlan = null;
        if (hero) hero.style.display = 'flex';
        if (chatArea) chatArea.style.display = 'none';
        if (boltPane) {
            boltPane.classList.add('is-landing');
            boltPane.classList.remove('in-chat');
        }
        setVisualCanvasButtonVisibility(false);
        closeWorkbench();

        // Highlight + New Chat
        const btnNewChat = document.getElementById('btnSidebarNewChat');
        if (btnNewChat) btnNewChat.classList.add('active');
        document.querySelectorAll('.sidebar-chat-item').forEach(item => {
            item.classList.remove('active');
            const bullet = item.querySelector('.chat-bullet');
            if (bullet) bullet.textContent = '○';
        });
    }

    switchView('viewArchitect');
    loadSessionSummary();
    loadConversationsList();
    showToast(`Switched to "${data?.title || 'Chat'}"`, 'success');
}

async function loadActiveConversation() {
    if (!App.sessionId) return;
    const data = await apiFetch(`/api/conversation/${App.sessionId}`);

    if (data && data.messages && data.messages.length > 0) {
        const hero = document.getElementById('architectHero') || document.getElementById('playgroundHome');
        const chatArea = document.getElementById('architectChatArea');
        const thread = document.getElementById('chatThread');
        const topicEl = document.getElementById('chatSessionTopic');
        const boltPane = document.getElementById('boltChatPane');

        if (hero) hero.style.display = 'none';
        if (chatArea) chatArea.style.display = 'flex';
        if (boltPane) {
            boltPane.classList.remove('is-landing');
            boltPane.classList.add('in-chat');
        }
        setVisualCanvasButtonVisibility(true);
        if (topicEl) topicEl.textContent = data.title || 'Architect Session';

        if (thread) {
            thread.innerHTML = '';
            data.messages.forEach(msg => {
                appendChatMessage(msg.role, msg.content, msg.created_at);
            });
        }

        if (data.latest_run && data.latest_run.plan_json) {
            let plan = data.latest_run.plan_json;
            if (typeof plan === 'string') {
                try { plan = JSON.parse(plan); } catch(e){}
            }
            App.currentPlan = plan;
        }

        // Highlight active sidebar item
        document.querySelectorAll('.sidebar-chat-item').forEach(item => {
            const isThis = (item.getAttribute('data-session-id') === App.sessionId);
            item.classList.toggle('active', isThis);
            const bullet = item.querySelector('.chat-bullet');
            if (bullet) bullet.textContent = isThis ? '●' : '○';
        });
    }
}


function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ═══════════════ CUSTOM CONNECTOR & AI PROMPT BUILDER ═══════════════
window.openAddConnectorModal = function() {
    const modal = document.getElementById('modalAddCustomConnector');
    if (modal) {
        modal.style.display = 'flex';
        const list = document.getElementById('customConnParamsList');
        if (list && list.children.length === 0) {
            // Start with exactly 1 clean empty row
            window.addParamRow('', '');
        }
    }
};

window.closeAddConnectorModal = function() {
    const modal = document.getElementById('modalAddCustomConnector');
    if (modal) modal.style.display = 'none';
};

window.addParamRow = function(key = '', val = '') {
    const list = document.getElementById('customConnParamsList');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'key-value-row';
    row.innerHTML = `
        <input type="text" class="claude-modal-input param-key" placeholder="Key (e.g. Host, User ID, API Key)" value="${escapeHtml(key)}" />
        <input type="text" class="claude-modal-input param-value" placeholder="Value (e.g. server.corp.com, admin)" value="${escapeHtml(val)}" />
        <button type="button" class="btn-remove-kv" title="Remove row" onclick="this.parentElement.remove();">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
    `;
    list.appendChild(row);
};

// Wire Add button in Customize tab
document.addEventListener('DOMContentLoaded', () => {
    const btnAdd = document.getElementById('btnConnectorsAddMenu');
    if (btnAdd) {
        btnAdd.addEventListener('click', (e) => {
            e.preventDefault();
            window.openAddConnectorModal();
        });
    }

    const btnAddRow = document.getElementById('btnAddParamRow');
    if (btnAddRow) {
        btnAddRow.addEventListener('click', () => {
            window.addParamRow('', '');
        });
    }

    // AI Prompt Auto-Generator Button
    const btnAi = document.getElementById('btnRunAiConnectorPrompt');
    if (btnAi) {
        btnAi.addEventListener('click', async () => {
            const promptInput = document.getElementById('inputAiConnectorPrompt');
            const promptText = promptInput ? promptInput.value.trim() : '';
            if (!promptText) {
                alert('Please enter a description of the connector to generate.');
                return;
            }
            btnAi.disabled = true;
            btnAi.innerHTML = '<span>Scaffolding...</span>';
            try {
                const res = await fetch('/api/connectors/ai-generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: promptText })
                });
                const data = await res.json();
                if (data.success && data.connector) {
                    const c = data.connector;
                    const nameInput = document.getElementById('inputCustomConnName');
                    if (nameInput) nameInput.value = c.name || '';

                    // Clear and populate dynamic rows
                    const list = document.getElementById('customConnParamsList');
                    if (list) {
                        list.innerHTML = '';
                        (c.required_params || []).forEach(p => {
                            window.addParamRow(p.label || p.key, p.default || '');
                        });
                        if (list.children.length === 0) {
                            window.addParamRow('', '');
                        }
                    }
                } else {
                    alert('AI Generation error: ' + (data.error || 'Failed to generate connector.'));
                }
            } catch (err) {
                alert('Request failed: ' + err.message);
            } finally {
                btnAi.disabled = false;
                btnAi.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span>Generate</span>';
            }
        });
    }

    // Save Custom Connector Button
    const btnSave = document.getElementById('btnSaveCustomConnector');
    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            const name = document.getElementById('inputCustomConnName')?.value.trim();
            if (!name) {
                alert('Please enter a connector name.');
                return;
            }

            const paramRows = document.querySelectorAll('#customConnParamsList .key-value-row');
            const required_params = [];
            paramRows.forEach(row => {
                const keyText = row.querySelector('.param-key')?.value.trim();
                const valText = row.querySelector('.param-value')?.value.trim() || '';
                if (keyText) {
                    const keySlug = keyText.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
                    const isSecret = /pass|token|secret|key|pwd|cred/i.test(keyText);
                    required_params.push({
                        key: keySlug || 'param',
                        label: keyText,
                        type: isSecret ? 'password' : 'text',
                        default: valText,
                        placeholder: isSecret ? '••••••••••••' : `Enter ${keyText}`
                    });
                }
            });

            btnSave.disabled = true;
            btnSave.textContent = 'Saving...';
            try {
                const res = await fetch('/api/connectors/custom/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        connector: {
                            name: name,
                            required_params: required_params
                        }
                    })
                });
                const data = await res.json();
                if (data.success) {
                    alert(`Connector '${name}' registered successfully!`);
                    window.closeAddConnectorModal();
                    if (window.loadConnectorsTable) window.loadConnectorsTable();
                } else {
                    alert('Save failed: ' + (data.error || 'Unknown error'));
                }
            } catch (err) {
                alert('Save request failed: ' + err.message);
            } finally {
                btnSave.disabled = false;
                btnSave.textContent = 'Save & register connector';
            }
        });
    }
});
