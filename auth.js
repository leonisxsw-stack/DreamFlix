// ============================================================
// DreamFlix — Auth & Supabase System
// ============================================================

const SESSION_KEY = 'df_user';
const ADMIN_EMAIL = 'the.furtive.guys@gmail.com';

// Supabase Configuration (Public Anon Key)
const SUPABASE_URL = "https://pcmaxibgvpatazpxuqkd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjbWF4aWJndnBhdGF6cHh1cWtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NTA1MzAsImV4cCI6MjA5MDEyNjUzMH0.-hqsL58wE8DT6S7biILN_R88BXaQCY_8i9AwsLVHG6c";

// Obfuscated Admin Secret (Base64 mtq1njm5nq==)
const ADMIN_CHECK = "MTQ1NjM5NQ=="; 

// Initialize Supabase Client with safety check
let _supabase = null;
if (typeof supabase !== 'undefined') {
    const { createClient } = supabase;
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.error('Supabase SDK not loaded. Dynamic features will be disabled.');
}

// --- Decode a Google JWT ---
function parseJwt(token) {
    try {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(base64));
    } catch { return null; }
}

// --- Save user session & Update Supabase ---
async function saveSession(payload) {
    let existingProfile = null;
    if (_supabase) {
        try {
            const { data } = await _supabase.from('profiles').select('*').eq('id', payload.sub).single();
            existingProfile = data;
        } catch(e) {}
    }

    const user = {
        name:    existingProfile?.full_name || payload.name,
        email:   payload.email,
        picture: payload.picture,
        sub:     payload.sub,
        exp:     payload.exp,
        plan:    existingProfile?.subscription_type || 'FREE'
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));

    if (_supabase) {
        try {
            await _supabase.from('profiles').upsert({
                id: payload.sub,
                email: payload.email,
                full_name: user.name,
                avatar_url: payload.picture,
                last_seen: new Date().toISOString()
            });
        } catch (e) { console.error('Supabase Profile Sync failed:', e); }
    }
    return user;
}

// --- Get current user ---
function getUser() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const user = JSON.parse(raw);
        if (user.exp && Date.now() / 1000 > user.exp) {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
        return user;
    } catch { return null; }
}

// --- Admin status check ---
function isAdmin() {
    const user = getUser();
    const isEmailAdmin = (user && user.email === ADMIN_EMAIL);
    const isUnlocked = localStorage.getItem('df_admin_unlocked') === 'true';
    return isEmailAdmin || isUnlocked;
}

function tryUnlockAdmin(code) {
    if (!code) return false;
    // Decode stored ADMIN_CHECK (1456395)
    try {
        if (code === atob(ADMIN_CHECK)) {
            localStorage.setItem('df_admin_unlocked', 'true');
            return true;
        }
    } catch (e) { console.error('Admin Check Error:', e); }
    return false;
}

function requireAdmin() {
    if (!isAdmin()) {
        window.location.href = 'index.html';
    }
}

// --- Status heartbeats ---
async function startHeartbeat() {
    const user = getUser();
    if (!user || !_supabase) return;
    
    // 1. One-minute heartbeat for "Online Status" (Admin Panel)
    setInterval(async () => {
        await _supabase.from('profiles').update({ 
            last_seen: new Date().toISOString() 
        }).eq('id', user.sub);
    }, 60000);

    // 2. Ten-minute heartbeat for "Fidelity Time" (Leaderboard)
    setInterval(async () => {
        try {
            // Increment watch_duration_seconds by 600 (10 mins)
            const { data: profile } = await _supabase.from('profiles').select('watch_duration_seconds').eq('id', user.sub).single();
            const currentSeconds = profile?.watch_duration_seconds || 0;
            
            await _supabase.from('profiles').update({ 
                watch_duration_seconds: currentSeconds + 600 
            }).eq('id', user.sub);
            
            console.log('[Heartbeat] Fidelity updated (+10 min)');
        } catch (e) { console.error('Fidelity update failed:', e); }
    }, 600000); 
}

// --- Auth Controls ---
function logOut() {
    const user = getUser();
    
    // 1. Disable Auto-Select and Revoke Google Token for a "clean" logout
    if (typeof google !== 'undefined' && google.accounts) {
        if (user && user.email) {
            google.accounts.id.revoke(user.email, () => {
                console.log('Google session revoked for:', user.email);
            });
        }
        google.accounts.id.disableAutoSelect();
    }
    
    // 2. Clear local DreamFlix session
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('df_admin_unlocked');
    
    // 3. Redirect to login with logout flag to avoid auto-login loops
    window.location.href = 'login.html?logout=true';
}

function requireAuth() {
    if (!getUser()) {
        window.location.href = 'login.html';
        return false;
    }
    startHeartbeat();
    return true;
}

function canInteract() {
    if (!getUser()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

async function deleteAccount() {
    const user = getUser();
    if (!user) return;

    if (_supabase) {
        try {
            // 1. Delete profile from Supabase
            await _supabase.from('profiles').delete().eq('id', user.sub);
            // (Optional) Delete favorites or other linked data if necessary
            await _supabase.from('favorites').delete().eq('user_id', user.sub);
        } catch (e) {
            console.error('Failed to delete Supabase profile:', e);
        }
    }

    // 2. Perform regular Logout steps (Revoke Google, Clear LocalStorage)
    logOut();
}

function redirectIfLoggedIn(destination = 'index.html') {
    if (getUser()) { window.location.href = destination; }
}

function initGoogleAuth({ onSuccess, onError } = {}) {
    google.accounts.id.initialize({
        client_id: '452977917704-rodjcu8c5kh9f37rt2oam93necl14emo.apps.googleusercontent.com',
        locale: 'fr',
        callback: async (response) => {
            const payload = parseJwt(response.credential);
            if (!payload) { onError?.('Token invalide'); return; }
            const user = await saveSession(payload);
            onSuccess?.(user);
        },
        auto_select: false,
    });
}

function renderGoogleButton(containerId, theme = 'outline') {
    const el = document.getElementById(containerId);
    if (!el) return;
    google.accounts.id.renderButton(el, {
        type: 'standard', size: 'large', theme: theme,
        text: 'signin_with', shape: 'pill', width: 300
    });
}

// --- UI HELPERS (SHARED ACROSS ALL PAGES) ---
const UI = {
    openPlayer(url, title) {
        const modal = document.getElementById('video-modal');
        const player = document.getElementById('player-el');
        const titleEl = document.getElementById('player-title');
        if (!modal || !player || !titleEl) return;

        player.src = url;
        titleEl.innerText = title;
        modal.style.display = 'flex';
        player.play();

        document.getElementById('df-nav').style.opacity = '0';
        document.querySelector('.df-sidebar').style.opacity = '0';
    },

    closePlayer() {
        const modal = document.getElementById('video-modal');
        const player = document.getElementById('player-el');
        if (!modal || !player) return;

        player.pause();
        player.src = '';
        modal.style.display = 'none';

        document.getElementById('df-nav').style.opacity = '1';
        document.querySelector('.df-sidebar').style.opacity = '1';
    },

    createCard(item, isGrid = false) {
        const card = document.createElement('div');
        card.className = isGrid ? 'df-grid-card' : 'df-card';
        
        card.innerHTML = `
            <img src="${item.image_url}" alt="${item.title}">
            <div class="${isGrid ? 'df-grid-card-body' : 'df-card-body'}">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
                    <div class="${isGrid ? 'df-grid-card-title' : 'df-card-title'}">${item.title}</div>
                    <i class="fas fa-plus add-fav-btn" style="font-size:0.8rem;cursor:pointer;color:var(--muted)" onclick="event.stopPropagation(); if(DFAuth.canInteract()) DFAuth.UI.toggleFavorite('${item.id}', this)"></i>
                </div>
                <div class="${isGrid ? 'df-grid-card-meta' : 'df-card-sub'}">${item.category} • ${item.year}</div>
            </div>
        `;

        if (item.video_url) {
            card.addEventListener('click', () => {
                if (!DFAuth.canInteract()) return;
                
                // If it's a page (ends with .html or similar), redirect instead of modal
                if (item.video_url.includes('.html')) {
                    window.location.href = item.video_url;
                } else {
                    this.openPlayer(item.video_url, item.title);
                }
            });
        }
        return card;
    },

    async toggleFavorite(contentId, btnEl) {
        if (!canInteract()) return;
        const user = getUser();
        if (!user || !_supabase) return;

        try {
            // Check if already favorite
            const { data: existing } = await _supabase.from('favorites').select('id').eq('user_id', user.sub).eq('content_id', contentId).single();

            if (existing) {
                await _supabase.from('favorites').delete().eq('id', existing.id);
                btnEl.className = 'fas fa-plus';
                btnEl.style.color = 'var(--muted)';
            } else {
                await _supabase.from('favorites').insert({ user_id: user.sub, content_id: contentId });
                btnEl.className = 'fas fa-check';
                btnEl.style.color = '#46d369';
            }
        } catch (e) { console.error('Favorite Toggle failed:', e); }
    }
};

async function upgradePlan(newPlan) {
    const user = getUser();
    if (!user || !_supabase) return;
    
    try {
        const { error } = await _supabase.from('profiles').update({ 
            subscription_type: newPlan 
        }).eq('id', user.sub);
        
        if (error) throw error;
        
        // Push locally for instant UI update
        const updatedUser = { ...user, plan: newPlan };
        localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
        console.log(`[Auth] Plan upgraded to ${newPlan}`);
        return true;
    } catch(e) {
        console.error('Plan upgrade failed:', e);
        return false;
    }
}

window.DFAuth = { getUser, isAdmin, tryUnlockAdmin, requireAdmin, logOut, requireAuth, canInteract, upgradePlan, deleteAccount, redirectIfLoggedIn, initGoogleAuth, renderGoogleButton, _supabase, UI };
