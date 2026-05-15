// DreamFlix Elite — Real-Time Engine v1.1 (PWA & Native Notifications)
// Requires: auth.js to be loaded BEFORE this file

(function injectGSAP() {
    if (typeof gsap === 'undefined') {
        const s = document.createElement('script');
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js";
        document.head.appendChild(s);
    }
})();

// --- Notification Manager ---
window.DFNotif = {
    async register() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('sw.js');
                console.log('[Notification] Service Worker Active');
            } catch(e) { console.warn('[Notification] SW Error:', e); }
        }
    },

    async requestPermission(callback) {
        if (!("Notification" in window)) return;
        const permission = await Notification.requestPermission();
        if (permission === 'granted' && callback) callback();
    },

    async sendLocal(title, message, url = 'index.html') {
        if (Notification.permission === 'granted') {
            try {
                // Priority 1: Service Worker (Background & Persistence)
                const registration = await navigator.serviceWorker.ready;
                if (registration.active) {
                    registration.active.postMessage({
                        type: 'SHOW_NOTIFICATION',
                        title: title,
                        body: message,
                        url: url
                    });
                    return;
                }
            } catch (e) { console.warn('[DFNotif] SW Ready check failed:', e); }

            // Fallback: Legacy Notification (Foreground only)
            const n = new Notification(title, {
                body: message,
                icon: 'img/logo_dreamflix.png',
                badge: 'img/logo_dreamflix.png'
            });
            n.onclick = () => { window.focus(); window.location.href = url; n.close(); };
        }
    }
};

// --- Elite Real-Time Alert System (Popups) ---
window.DFAlert = {
    show(title, message, url = 'index.html') {
        // Create Alert Modal
        const modal = document.createElement('div');
        modal.id = 'df-realtime-alert';
        modal.style = `
            position: fixed; inset: 0; z-index: 10000;
            display: flex; align-items: center; justify-content: center;
            background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
            opacity: 0; transition: opacity 0.4s ease; padding: 20px;
        `;

        modal.innerHTML = `
            <div style="
                background: linear-gradient(145deg, #181818, #0a0a0a);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 24px; padding: 40px; width: 100%; max-width: 450px;
                text-align: center; box-shadow: 0 30px 100px rgba(0,0,0,1);
                transform: scale(0.9); transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                position: relative; overflow: hidden;
            ">
                <!-- Decorative Glow -->
                <div style="position:absolute;top:-50px;left:-50px;width:150px;height:150px;background:var(--brand);filter:blur(100px);opacity:0.3;pointer-events:none"></div>
                
                <i class="fas fa-bullhorn" style="font-size:3rem;color:var(--brand);margin-bottom:20px;display:block"></i>
                <h2 style="font-size:1.8rem;font-weight:900;margin-bottom:12px;color:#fff">${title}</h2>
                <p style="font-size:1rem;color:rgba(255,255,255,0.7);line-height:1.6;margin-bottom:30px">${message}</p>
                
                <div style="display:flex;flex-direction:column;gap:12px">
                    <button id="alert-ok-btn" class="btn-pill btn-pill-white" style="width:100%;justify-content:center;font-weight:900">
                        VOIR LES DÉTAILS
                    </button>
                    <button id="alert-close-btn" style="background:transparent;border:none;color:#808080;font-size:0.8rem;cursor:pointer;text-decoration:underline">
                        Ignorer
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Trigger entrance
        requestAnimationFrame(() => {
            modal.style.opacity = '1';
            modal.querySelector('div').style.transform = 'scale(1)';
        });

        // Event: OK
        modal.querySelector('#alert-ok-btn').addEventListener('click', () => {
            this.hide();
            window.location.href = url;
        });

        // Event: Close
        modal.querySelector('#alert-close-btn').addEventListener('click', () => this.hide());
    },

    hide() {
        const modal = document.getElementById('df-realtime-alert');
        if (!modal) return;
        modal.style.opacity = '0';
        modal.querySelector('div').style.transform = 'scale(0.9)';
        setTimeout(() => modal.remove(), 400);
    }
};

// Start Realtime Listener for Targeted Alerts & Global Broadcasts
if (typeof DFAuth !== 'undefined' && DFAuth._supabase) {
    DFAuth._supabase
        .channel('public:broadcasts')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'broadcasts' }, async payload => {
            const user = DFAuth.getUser();
            if (!user) return;

            const { title, message, url, target_email, type } = payload.new;

            // 0. Check if PUSH_TEST or PUSH_ADMIN (Priority Diagnostic/Annoucement)
            if (type === 'PUSH_TEST' || type === 'PUSH_ADMIN') {
                await DFNotif.sendLocal(title, message, url);
                DFAlert.show(title, message, url);
                return;
            }

            // 1. Check if Targeted (Private Message)
            const isTargeted = target_email && target_email.toLowerCase() === user.email.toLowerCase();
            if (isTargeted) {
                await DFNotif.sendLocal(title, message, url);
                DFAlert.show(title, message, url);
                return;
            }

            // 2. Check if Global (Broadcast)
            const isGlobal = !target_email;
            if (isGlobal) {
                // Specifique: New Content Check
                if (type === 'NEW_CONTENT') {
                    // Check user preference (default true if not set)
                    const { data: profile } = await DFAuth._supabase
                        .from('profiles')
                        .select('notifications_episodes')
                        .eq('id', user.sub)
                        .single();
                    
                    if (profile && profile.notifications_episodes === false) {
                        console.log("[Notification] Ignored: New Content (User opted out)");
                        return;
                    }
                }

                // 1. Browser Notification (for background/other tabs)
                await DFNotif.sendLocal(title, message, url);
                
                // 2. Real-Time UI Modal (The 'Netflix-Grade' Surprise)
                DFAlert.show(title, message, url);
            }
        })
        .subscribe();
}

DFNotif.register();

const NAV_HTML = `
<nav class="df-nav" id="df-nav">
    <div style="display:flex;align-items:center;gap:28px;flex:1">
        <a href="index.html" class="df-logo"><img src="img/logo_dreamflix.png" alt="DreamFlix"></a>
        <ul class="nav-links-top">
            <li onclick="location.href='index.html'">Accueil</li>
            <li onclick="location.href='series.html'">Séries</li>
            <li onclick="location.href='movies.html'">Films</li>
            <li onclick="location.href='mylist.html'">Ma Liste</li>
        </ul>
    </div>
    <div class="nav-center">
        <i class="fas fa-search nav-search-icon"></i>
        <input type="text" class="nav-search" placeholder="Rechercher des séries, films...">
    </div>
    <div class="nav-right">
        <i class="fas fa-bell"></i>
        <div id="nav-profile-area" style="display:flex;align-items:center;gap:10px;cursor:pointer;position:relative">
            <img id="nav-avatar" src="https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"
                 style="width:34px;height:34px;border-radius:8px;object-fit:cover;border:2px solid rgba(255,255,255,0.15)">
            <div style="display:flex;flex-direction:column;justify-content:center">
                <span id="nav-username" style="font-size:0.82rem;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700"></span>
                <span id="nav-plan-badge" style="font-size:0.6rem;font-weight:900;letter-spacing:0.5px;text-transform:uppercase;margin-top:2px;"></span>
            </div>
            <i class="fas fa-caret-down" style="font-size:0.75rem;color:#808080"></i>
            <!-- Profile Dropdown -->
            <div id="nav-dropdown" style="
                display:none;position:absolute;top:calc(100% + 12px);right:0;
                background:rgba(10,10,10,0.97);border:1px solid rgba(255,255,255,0.1);
                border-radius:14px;min-width:190px;padding:8px 0;
                backdrop-filter:blur(20px);box-shadow:0 20px 50px rgba(0,0,0,0.8);z-index:5000;
            ">
                <div id="nav-dropdown-email" style="padding:12px 18px 8px;font-size:0.72rem;color:#808080;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:4px"></div>
                
                <!-- Admin Link -->
                <a href="admin.html" id="nav-admin-link" style="display:none;align-items:center;gap:12px;padding:11px 18px;color:var(--brand);font-size:0.85rem;text-decoration:none;font-weight:700;transition:0.15s" onmouseenter="this.style.opacity='0.8'" onmouseleave="this.style.opacity='1'">
                    <i class="fas fa-user-shield" style="width:16px;text-align:center"></i> Admin Panel
                </a>
                <div id="nav-admin-divider" style="display:none;border-top:1px solid rgba(255,255,255,0.08);margin:4px 0"></div>

                <a href="settings.html" style="display:flex;align-items:center;gap:12px;padding:11px 18px;color:rgba(255,255,255,0.75);font-size:0.85rem;text-decoration:none;transition:0.15s" onmouseenter="this.style.color='#fff'" onmouseleave="this.style.color='rgba(255,255,255,0.75)'">
                    <i class="fas fa-cog" style="width:16px;text-align:center"></i> Paramètres
                </a>
                <a href="mylist.html" style="display:flex;align-items:center;gap:12px;padding:11px 18px;color:rgba(255,255,255,0.75);font-size:0.85rem;text-decoration:none;transition:0.15s" onmouseenter="this.style.color='#fff'" onmouseleave="this.style.color='rgba(255,255,255,0.75)'">
                    <i class="fas fa-bookmark" style="width:16px;text-align:center"></i> Ma Liste
                </a>
                <div style="border-top:1px solid rgba(255,255,255,0.08);margin:4px 0"></div>
                <div id="nav-logout-btn" style="display:flex;align-items:center;gap:12px;padding:11px 18px;color:#E50914;font-size:0.85rem;cursor:pointer;transition:0.15s" onmouseenter="this.style.opacity='0.7'" onmouseleave="this.style.opacity='1'">
                    <i class="fas fa-sign-out-alt" style="width:16px;text-align:center"></i> Déconnexion
                </div>
            </div>
        </div>
    </div>
</nav>`;

const SIDEBAR_HTML = `
<aside class="df-sidebar">
    <div class="sidebar-group" id="sidebar-admin-group" style="display:none">
        <p class="sidebar-label">Administration</p>
        <a href="admin.html" class="sidebar-link" style="font-weight:700"><i class="fas fa-user-shield"></i> Panel Admin</a>
    </div>
    <div class="sidebar-group">
        <p class="sidebar-label">Menu</p>
        <a href="index.html" class="sidebar-link"><i class="fas fa-home"></i> Accueil</a>
        <a href="series.html" class="sidebar-link"><i class="fas fa-tv"></i> Séries</a>
        <a href="movies.html" class="sidebar-link"><i class="fas fa-film"></i> Films</a>
        <a href="popular.html" class="sidebar-link"><i class="fas fa-fire"></i> Populaire</a>
        <a href="mylist.html" class="sidebar-link"><i class="fas fa-bookmark"></i> Ma Liste</a>
        <a href="leaderboard.html" class="sidebar-link"><i class="fas fa-trophy"></i> Classement</a>
        <a href="subscriptions.html" class="sidebar-link"><i class="fas fa-gem rgb-icon"></i> Abonnements</a>
    </div>
    <div class="sidebar-group">
        <p class="sidebar-label">Social</p>
        <a href="teleparty.html" class="sidebar-link"><i class="fas fa-desktop"></i> Teleparty</a>
    </div>
    <div class="sidebar-group">
        <p class="sidebar-label">Général</p>
        <a href="settings.html" class="sidebar-link"><i class="fas fa-cog"></i> Paramètres</a>
        <a href="#" class="sidebar-link" id="sidebar-logout"><i class="fas fa-sign-out-alt"></i> Déconnexion</a>
    </div>
</aside>`;

// --- SVG Filter for Liquid Glass Effect ---
const GLASS_SVG = `
<svg style="display: none">
    <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">
        <feTurbulence type="fractalNoise" baseFrequency="0.01 0.01" numOctaves="1" seed="5" result="turbulence" />
        <feComponentTransfer in="turbulence" result="mapped">
            <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
            <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
            <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
        </feComponentTransfer>
        <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
        <feSpecularLighting in="softMap" surfaceScale="5" specularConstant="1" specularExponent="100" lighting-color="white" result="specLight">
            <fePointLight x="-200" y="-200" z="300" />
        </feSpecularLighting>
        <feComposite in="specLight" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litImage" />
        <feDisplacementMap in="SourceGraphic" in2="softMap" scale="150" xChannelSelector="R" yChannelSelector="G" />
    </filter>
</svg>`;

const MOBILE_BAR_HTML = `
<div class="df-mobile-bar">
    <div class="liquidGlass-wrapper">
        <div class="liquidGlass-effect"></div>
        <div class="liquidGlass-tint"></div>
        <div class="liquidGlass-shine"></div>
        <div class="liquidGlass-icons">
            <a href="index.html" class="mobile-tab mobile-tab-home"><i class="fas fa-home"></i><span>Accueil</span></a>
            <a href="teleparty.html" class="mobile-tab"><i class="fas fa-desktop"></i><span>Party</span></a>
            <a href="leaderboard.html" class="mobile-tab mobile-tab-fans"><i class="fas fa-trophy"></i><span>Classement</span></a>
            <a href="mylist.html" class="mobile-tab"><i class="fas fa-bookmark"></i><span>Liste</span></a>
            <a href="subscriptions.html" class="mobile-tab mobile-tab-subs"><i class="fas fa-gem rgb-icon"></i><span>Offres</span></a>
            <a href="settings.html" class="mobile-tab"><i class="fas fa-user"></i><span>Profil</span></a>
        </div>
    </div>
</div>`;

const GLOBAL_PLAYER_HTML = `
<!-- Global Video Player Modal -->
<div id="video-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:99999;flex-direction:column;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(15px)">
    <div style="position:absolute;top:30px;right:40px;color:#fff;font-size:2rem;cursor:pointer;z-index:10" onclick="DFAuth.UI.closePlayer()"><i class="fas fa-times"></i></div>
    <video id="player-el" controls style="max-width:90%;max-height:80vh;border-radius:12px;box-shadow:0 30px 100px rgba(0,0,0,1)"></video>
    <h2 id="player-title" style="margin-top:25px;font-size:1.8rem;font-weight:900;text-align:center;letter-spacing:-1px"></h2>
</div>

<!-- Global Info Modal -->
<div id="info-modal" class="modal-overlay" style="display:none">
    <div class="info-content-wrap">
        <div class="close-info" id="close-info-modal" onclick="DFAuth.UI.closeInfo()"><i class="fas fa-times"></i></div>
        <div class="info-banner">
            <img id="info-img" src="" alt="">
            <div class="info-banner-overlay"></div>
            <div class="info-banner-detail">
                <h2 id="info-title"></h2>
                <div class="info-meta">
                    <span id="info-match" style="color:#46d369;font-weight:700"></span>
                    <span id="info-year"></span>
                    <span id="info-rating" class="df-hero-rating"></span>
                </div>
                <div style="display:flex;gap:10px;margin-top:20px">
                    <button class="btn-pill btn-pill-white" id="info-play-btn"><i class="fas fa-play"></i> Regarder</button>
                </div>
            </div>
        </div>
        <div class="info-body">
            <div class="info-grid">
                <div class="info-left">
                    <p id="info-desc" style="font-size:1.1rem;line-height:1.6;color:rgba(255,255,255,0.9)"></p>
                </div>
                <div class="info-right">
                    <div style="margin-bottom:15px"><span style="color:#808080">Distribution:</span> <span id="info-cast" style="font-size:0.85rem">Élite IA, Fruits Frais</span></div>
                    <div><span style="color:#808080">Genres:</span> <span id="info-genres" style="font-size:0.85rem">Absurde, Comédie, Drame</span></div>
                </div>
            </div>
        </div>
    </div>
</div>`;

// --- Guard: require auth ONLY on specific pages (handled in those files) ---
// if (typeof DFAuth !== 'undefined') {
//     DFAuth.requireAuth();
// }

// Inject HTML
document.body.insertAdjacentHTML('afterbegin', GLASS_SVG);
document.getElementById('nav-placeholder')?.insertAdjacentHTML('afterend', NAV_HTML);
document.getElementById('sidebar-placeholder')?.insertAdjacentHTML('afterend', SIDEBAR_HTML);
document.body.insertAdjacentHTML('beforeend', MOBILE_BAR_HTML);
document.body.insertAdjacentHTML('beforeend', GLOBAL_PLAYER_HTML);

// --- Populate user info in navbar & Check Admin ---
(function populateUser() {
    if (typeof DFAuth === 'undefined') return;
    const user = DFAuth.getUser();

    const profileArea = document.getElementById('nav-profile-area');
    const sideLinks = document.querySelectorAll('.sidebar-link');
    const myListLink = document.querySelector('a[href="mylist.html"]');
    const settingsLink = document.querySelector('a[href="settings.html"]');

    if (!user) {
        // Guest Mode
        if (profileArea) {
            profileArea.innerHTML = `
                <button class="btn-pill" onclick="location.href='login.html'" 
                        style="background:var(--brand);color:#fff;font-size:0.75rem;padding:6px 14px;white-space:nowrap;display:flex;align-items:center;justify-content:center;">
                    S'identifier
                </button>`;
        }
        // Hide private sidebar items
        sideLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === 'mylist.html' || href === 'friends.html' || href === 'teleparty.html' || href === 'settings.html' || link.id === 'sidebar-logout') {
                link.parentElement.style.display = 'none';
            }
        });
        // Hide private nav items
        document.querySelectorAll('.nav-links-top li').forEach(li => {
            if (li.innerText === 'Ma Liste') li.style.display = 'none';
        });
        return;
    }

    // Logged In Mode
    const avatar = document.getElementById('nav-avatar');
    const username = document.getElementById('nav-username');
    const emailEl = document.getElementById('nav-dropdown-email');

    if (avatar && user.picture) {
        avatar.src = user.picture;
        avatar.onerror = () => { avatar.src = 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png'; };
    }
    if (username) {
        username.textContent = user.name?.split(' ')[0] || 'User';
    }
    const planBadge = document.getElementById('nav-plan-badge');
    if (planBadge) {
        if (user.plan === 'DIAMANT') {
            planBadge.textContent = 'PACK DIAMANT';
            planBadge.style.color = '#00ffff';
            planBadge.style.textShadow = '0 0 5px rgba(0,255,255,0.5)';
        } else if (user.plan === 'GOLD') {
            planBadge.textContent = 'PACK GOLD';
            planBadge.style.color = '#ff3c00';
            planBadge.style.textShadow = '0 0 5px rgba(255,60,0,0.5)';
        } else {
            planBadge.textContent = 'PACK FREE';
            planBadge.style.color = '#808080';
        }
    }
    if (emailEl) {
        emailEl.textContent = user.email || '';
    }

    // Trigger Notification
    if (typeof showGreetingToast === 'function') {
        showGreetingToast(user);
    }

    // --- Admin Link Logic ---
    if (DFAuth.isAdmin()) {
        const navLink = document.getElementById('nav-admin-link');
        const navDiv = document.getElementById('nav-admin-divider');
        const sideGrp = document.getElementById('sidebar-admin-group');
        if (navLink) navLink.style.display = 'flex';
        if (navDiv) navDiv.style.display = 'block';
        if (sideGrp) sideGrp.style.display = 'block';
    }

    // Mobile bar always shows options (inciting conversion)
    
})();

// --- Greeting Notification ---
function showGreetingToast(user) {
    if (!user) return;
    
    // Pour tester, on commente la vérification de session
    // if (sessionStorage.getItem('dreamflix_greeted') === 'true') {
    //     return;
    // }
    // sessionStorage.setItem('dreamflix_greeted', 'true');

    const hour = new Date().getHours();
    let greeting = "Bonjour";
    if (hour >= 18) greeting = "Bonsoir";
    else if (hour >= 12) greeting = "Bonne après-midi";

    const firstName = user.name ? user.name.split(' ')[0] : 'Membre';

    // Remove existing if any
    const existing = document.getElementById('df-greeting-toast');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'df-greeting-toast';
    // Structure inspirée de DFAlert
    modal.style = `
        position: fixed; top: 30px; left: 50%; transform: translateX(-50%) translateY(-60px) scale(0.95);
        z-index: 1000000; opacity: 0; pointer-events: none;
        transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;

    modal.innerHTML = `
        <div style="
            background: rgba(10, 10, 10, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.12); border-radius: 50px;
            padding: 10px 24px 10px 10px; display: flex; align-items: center; gap: 15px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.8);
        ">
            <img src="${user.picture || 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png'}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid var(--brand);">
            <div style="color:#fff;font-size:1rem;font-weight:700;letter-spacing:0.5px;">
                ${greeting}, <span style="color:var(--brand)">${firstName}</span> !
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Double requestAnimationFrame garantit que le navigateur a dessiné l'élément avant d'animer
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modal.style.opacity = '1';
            modal.style.transform = 'translateX(-50%) translateY(0) scale(1)';
        });
    });

    // Disparition au bout de 4.5 secondes
    setTimeout(() => {
        modal.style.opacity = '0';
        modal.style.transform = 'translateX(-50%) translateY(-60px) scale(0.95)';
        setTimeout(() => modal.remove(), 600);
    }, 4500);
}

// --- Search Functionality ---
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('nav-search')) {
        const query = e.target.value.trim().toLowerCase();
        handleGlobalSearch(query);
    }
});

function handleGlobalSearch(query) {
    const resultsRow = document.getElementById('search-results-row');
    const resultsSlider = document.getElementById('search-results-slider');
    if (!resultsRow || !resultsSlider) return;

    if (query.length < 2) {
        resultsRow.style.display = 'none';
        return;
    }

    // Simple client-side search across all currently loaded or discoverable cards
    // In a real app, this would be a Supabase RPC or text search
    resultsRow.style.display = 'block';
    const allContent = document.querySelectorAll('.df-card, .df-grid-card');
    let hits = 0;
    
    // Clear previous results but we match existing cards for now
    // Better: Query Supabase
    DFAuth._supabase.from('content').select('*').ilike('title', `%${query}%`).then(({data}) => {
        if (data && data.length > 0) {
            resultsSlider.innerHTML = data.map(item => `
                <div class="df-card" onclick="DFAuth.UI.showInfo('${item.id}')">
                    <img src="${item.image_url}" alt="${item.title}">
                    <div class="df-card-body">
                        <div class="df-card-title">${item.title}</div>
                        <div class="df-card-sub">${item.category} • ${item.year}</div>
                    </div>
                </div>
            `).join('');
        } else {
            resultsSlider.innerHTML = `<p style="padding:20px;color:#808080">Aucun résultat pour "${query}"</p>`;
        }
    });
}

// --- Global UI Logic Extensions ---
if (typeof DFAuth !== 'undefined') {
    DFAuth.UI = DFAuth.UI || {};
    
    DFAuth.UI.showInfo = async (id) => {
        const modal = document.getElementById('info-modal');
        if (!modal) return;

        // Special case for Skibidi
        let data = null;
        if (id === 'skibidi' || id === 'fruit-island') {
            data = {
                title: "L'ÎLE DE LA SKIBIDITENTAFRUIT",
                image_url: "img/header image.png",
                description: "The Fruit Wars of 2026 have begun. Dans cette production originale explosive, huit couples de fruits frais sont abandonnés sur une île tropicale où les intrigues politiques de jus et les smoothies à enjeux élevés déterminent leur destin. Entre des baisers d'agrumes interdits et la légende des ananas d'or des Caraïbes, qui survivra au mixeur final ? Une épopée juteuse de trahison, de passion et de vitamines.",
                year: "2026",
                rating: "Absurde",
                category: "Série Originale",
                match: "98% d'Adéquation"
            };
        } else {
            const { data: dbData } = await DFAuth._supabase.from('content').select('*').eq('id', id).single();
            data = dbData;
        }

        if (!data) return;

        document.getElementById('info-title').innerText = data.title;
        document.getElementById('info-img').src = data.image_url;
        document.getElementById('info-desc').innerText = data.description || "Aucune description disponible.";
        document.getElementById('info-year').innerText = data.year;
        document.getElementById('info-rating').innerText = data.rating || "18+";
        document.getElementById('info-match').innerText = data.match || "95% Match";

        document.getElementById('info-play-btn').onclick = () => {
            DFAuth.UI.closeInfo();
            window.location.href = 'watch.html';
        };

        modal.style.display = 'flex';
        gsap.fromTo('.info-content-wrap', { y: 100, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power4.out' });
    };

    DFAuth.UI.closeInfo = () => {
        const wrap = document.querySelector('.info-content-wrap');
        const modal = document.getElementById('info-modal');
        if (!wrap || !modal) return;

        if (typeof gsap !== 'undefined') {
            gsap.to(wrap, { y: 100, opacity: 0, duration: 0.3, onComplete: () => {
                modal.style.display = 'none';
            }});
        } else {
            modal.style.display = 'none';
        }
    };

    DFAuth.UI.closeInfo = (instant = false) => {
        const wrap = document.querySelector('.info-content-wrap');
        const modal = document.getElementById('info-modal');
        if (!wrap || !modal) return;

        if (instant || typeof gsap === 'undefined') {
            modal.style.display = 'none';
        } else {
            gsap.to(wrap, { y: 100, opacity: 0, duration: 0.2, onComplete: () => {
                modal.style.display = 'none';
            }});
        }
    };

    // Attach Close Handlers (Escape & Click Overlay)
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') DFAuth.UI.closeInfo(true);
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('#close-info-modal') || e.target.id === 'info-modal') {
            DFAuth.UI.closeInfo(true); // Close instantly on direct intent
        }
    });
}

// --- Profile Dropdown Toggle ---
document.addEventListener('click', (e) => {
    const area = document.getElementById('nav-profile-area');
    const dropdown = document.getElementById('nav-dropdown');
    if (!area || !dropdown) return;

    if (area.contains(e.target)) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    } else {
        dropdown.style.display = 'none';
    }
});

// --- Logout Buttons ---
document.addEventListener('click', (e) => {
    if (e.target.closest('#nav-logout-btn') || e.target.closest('#sidebar-logout')) {
        e.preventDefault();
        if (confirm('Se déconnecter de DreamFlix ?')) {
            DFAuth.logOut();
        }
    }
});

// --- Mobile Bar Active Page ---
const _page = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.mobile-tab').forEach(tab => {
    const href = tab.getAttribute('href') || '';
    if (href === _page || ((_page === '' || _page === 'index.html') && href === 'index.html')) {
        tab.classList.add('active');
    }
});

// --- Sidebar Active Link ---
document.querySelectorAll('.sidebar-link:not(#sidebar-logout)').forEach(link => {
    if ((link.getAttribute('href') || '').includes(_page)) {
        link.classList.add('active');
    }
});

