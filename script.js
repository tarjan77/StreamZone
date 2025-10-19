document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let allEventsFlat = []; // This will store all events in a single, easy-to-use array
    let selectedSport = 'All';
    let searchQuery = '';

    // --- DOM ELEMENTS ---
    const eventListEl = document.getElementById('event-list');
    const sportFilterEl = document.getElementById('sport-filter');
    const searchBarEl = document.getElementById('search-bar');
    
    // --- INITIALIZATION ---
    const init = async () => {
        await fetchEvents();
        setupEventListeners();
        renderPage();
    };

    const fetchEvents = async () => {
        eventListEl.innerHTML = '<div class="loader"></div>';
        try {
            const response = await fetch('https://topembed.pw/api.php?format=json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const eventsData = data.events || {};

            // --- CORRECT & EFFICIENT DATA PROCESSING ---
            // Create a single flat array of all events, and add the original date key to each event.
            // This is done only once for performance.
            allEventsFlat = [];
            for (const dateKey in eventsData) {
                if (Array.isArray(eventsData[dateKey])) {
                    eventsData[dateKey].forEach(event => {
                        allEventsFlat.push({ ...event, originalDateKey: dateKey });
                    });
                }
            }
            // --- END OF FIX ---

        } catch (error) {
            console.error("Fetch Error:", error);
            eventListEl.innerHTML = `<p style="color: red;">Error loading events: ${error.message}. Please try refreshing the page.</p>`;
            allEventsFlat = [];
        }
    };

    const setupEventListeners = () => {
        searchBarEl.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            renderEventList();
        });
    };

    // --- RENDER FUNCTIONS ---
    const renderPage = () => {
        if (allEventsFlat.length > 0) {
            renderSportFilters();
            renderEventList();
        } else if (!eventListEl.querySelector('p[style*="color: red"]')) {
             eventListEl.innerHTML = '<p>No events are currently scheduled.</p>';
        }
    };
    
    const renderSportFilters = () => {
        const sports = ['All', ...new Set(allEventsFlat.map(event => event.sport).filter(Boolean))].sort();
        
        let sportsHtml = `<button class="filter-btn active" data-sport="All">All</button>`;
        sportsHtml += `<button class="filter-btn" data-sport="Live">Live Now</button>`;
        
        // Filter out 'All' as we've manually added it first
        sportsHtml += sports.filter(s => s !== 'All').map(sport => 
            `<button class="filter-btn" data-sport="${sport}">${sport}</button>`
        ).join('');

        sportFilterEl.innerHTML = sportsHtml;
        
        sportFilterEl.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedSport = btn.dataset.sport;
                renderEventList();
                sportFilterEl.querySelector('.active')?.classList.remove('active');
                btn.classList.add('active');
            });
        });
    };

    const renderEventList = () => {
        const nowInSeconds = Date.now() / 1000;
        const twentyFourHoursInSeconds = 24 * 60 * 60;
        const timeLimit = nowInSeconds + twentyFourHoursInSeconds;

        let events = allEventsFlat.filter(event => {
            const isNotOver = nowInSeconds < (event.unix_timestamp + getEventDuration(event));
            const isStartingSoonOrLive = event.unix_timestamp < timeLimit;
            return isNotOver && isStartingSoonOrLive;
        });

        if (selectedSport === 'Live') {
             events = events.filter(event => {
                const duration = getEventDuration(event);
                return nowInSeconds > event.unix_timestamp && nowInSeconds < (event.unix_timestamp + duration);
            });
        } else if (selectedSport !== 'All') {
            events = events.filter(event => event.sport === selectedSport);
        }

        if (searchQuery) {
            events = events.filter(event => 
                (event.match && event.match.toLowerCase().includes(searchQuery)) || 
                (event.tournament && event.tournament.toLowerCase().includes(searchQuery))
            );
        }
        
        if (events.length === 0) {
            eventListEl.innerHTML = `<p>No events found for the selected criteria.</p>`;
            return;
        }
        
        events.sort((a, b) => a.unix_timestamp - b.unix_timestamp);

        const groupedByDate = events.reduce((acc, event) => {
            const localDate = formatDate(new Date(event.unix_timestamp * 1000));
            if (!acc[localDate]) acc[localDate] = [];
            acc[localDate].push(event);
            return acc;
        }, {});
        
        let html = '';
        const todayString = formatDate(new Date());

        for (const date in groupedByDate) {
            const displayDate = date === todayString ? 'Today' : getDisplayDate(date);
            html += `<div class="sport-group"><h2 class="sport-header">${displayDate} - ${date}</h2>`;
            
            const groupedBySport = groupedByDate[date].reduce((acc, event) => {
                const sport = event.sport || 'General';
                if (!acc[sport]) acc[sport] = [];
                acc[sport].push(event);
                return acc;
            }, {});

            for (const sport in groupedBySport) {
                 html += `<h3 class="tournament-header" style="font-size: 1.5rem; margin-top: 1.5rem;">${sport}</h3>`;
                 groupedBySport[sport].forEach(event => {
                    const eventTime = new Date(event.unix_timestamp * 1000);
                    const duration = getEventDuration(event);
                    const isLive = nowInSeconds > event.unix_timestamp && nowInSeconds < (event.unix_timestamp + duration);
                    
                    // --- CORRECTED LINK GENERATION ---
                    // This now correctly uses the stored original date key.
                    const watchUrl = `watch.html?date=${event.originalDateKey}&ts=${event.unix_timestamp}`;

                    html += `
                        <div class="event-card">
                            <div class="event-time">${formatTime(eventTime)}</div>
                            <div class="live-indicator">
                                ${isLive ? '<div class="dot"></div>LIVE' : ''}
                            </div>
                            <div class="event-details">
                                <div class="match">${event.match || 'N/A'}</div>
                                <div class="tournament">${event.tournament || 'N/A'}</div>
                            </div>
                            <a href="${watchUrl}" class="watch-btn" target="_blank" rel="noopener noreferrer">Watch Now &raquo;</a>
                        </div>
                    `;
                 });
            }
            html += `</div>`;
        }
        
        eventListEl.innerHTML = html;
    };

    // --- UTILITY FUNCTIONS ---
    const getEventDuration = (event) => {
        const DURATION_MAP = {
            't20': 4 * 3600, 'cricket': 8 * 3600, 'golf': 6 * 3600,
            'motorsport': 4 * 3600, 'american football': 3.5 * 3600,
            'nfl': 3.5 * 3600, 'football': 2.5 * 3600,
        };
        const DEFAULT_DURATION = 3 * 3600;
        const lowerCaseTournament = (event.tournament || '').toLowerCase();
        const lowerCaseSport = (event.sport || '').toLowerCase();
        for (const key in DURATION_MAP) {
            if (lowerCaseTournament.includes(key)) return DURATION_MAP[key];
        }
        for (const key in DURATION_MAP) {
            if (lowerCaseSport.includes(key)) return DURATION_MAP[key];
        }
        return DEFAULT_DURATION;
    };

    const formatDate = (date) => {
        // Simple and reliable way to get YYYY-MM-DD in local time
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    const getDisplayDate = (dateString) => {
         try {
            const date = new Date(dateString + 'T12:00:00');
            return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
         } catch(e) {
            return dateString;
         }
    };
    
    const formatTime = (date) => {
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    // --- START THE APP ---
    init();
});