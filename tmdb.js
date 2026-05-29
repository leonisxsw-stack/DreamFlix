const TMDB_API_KEY = '3fd2be6d0c70a2a598f084ddfb75487c'; // Clé publique standard TMDB pour dev
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMG_URL = 'https://image.tmdb.org/t/p/w500';
const TMDB_IMG_URL_LG = 'https://image.tmdb.org/t/p/w1280';

const TMDB = {
    async fetchTrending(type = 'all', timeWindow = 'day') {
        try {
            const res = await fetch(`${TMDB_BASE_URL}/trending/${type}/${timeWindow}?api_key=${TMDB_API_KEY}&language=fr-FR`);
            const data = await res.json();
            return data.results;
        } catch (e) { console.error('TMDB Error:', e); return []; }
    },
    
    async fetchMovies(category = 'popular') {
        try {
            const res = await fetch(`${TMDB_BASE_URL}/movie/${category}?api_key=${TMDB_API_KEY}&language=fr-FR&page=1`);
            const data = await res.json();
            return data.results;
        } catch (e) { console.error('TMDB Error:', e); return []; }
    },

    async fetchSeries(category = 'popular') {
        try {
            const res = await fetch(`${TMDB_BASE_URL}/tv/${category}?api_key=${TMDB_API_KEY}&language=fr-FR&page=1`);
            const data = await res.json();
            return data.results;
        } catch (e) { console.error('TMDB Error:', e); return []; }
    },

    async fetchDetails(id, type = 'movie') {
        try {
            const res = await fetch(`${TMDB_BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&language=fr-FR`);
            return await res.json();
        } catch (e) { console.error('TMDB Error:', e); return null; }
    },

    createCardHTML(item, type = 'movie') {
        const title = item.title || item.name;
        const year = (item.release_date || item.first_air_date || '').split('-')[0];
        const img = item.poster_path ? `${TMDB_IMG_URL}${item.poster_path}` : 'https://via.placeholder.com/500x750?text=No+Image';
        const itemType = item.media_type || type;
        
        return `
            <div class="df-card" onclick="if(DFAuth.canInteract()) window.location.href='watch.html?id=${item.id}&type=${itemType}'">
                <img src="${img}" alt="${title}">
                <div class="df-card-body">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
                        <div class="df-card-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${title}</div>
                        <i class="fas fa-play" style="font-size:0.8rem;color:var(--brand)"></i>
                    </div>
                    <div class="df-card-sub">${itemType === 'tv' ? 'Série' : 'Film'} • ${year}</div>
                </div>
            </div>
        `;
    }
};
