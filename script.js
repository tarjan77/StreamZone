document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let allEventsData = {};
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
        try {
            const response = await fetch('source.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            allEventsData = data.events;
        } catch (error) {
            eventListEl.innerHTML = `<p style="color: red;">Error loading events: ${error.message}</p>`;
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
        renderSportFilters();
        renderEventList();
    };
    
    const renderSportFilters = () => {
        const allEvents = Object.values(allEventsData).flat();
        const sports = ['All', ...new Set(allEvents.map(event => event.sport).filter(Boolean))].sort();
        
        let sportsHtml = `<button class="filter-btn ${selectedSport === 'Live' ? 'active' : ''}" data-sport="Live">Live Now</button>`;
        
        sportsHtml += sports.map(sport => 
            `<button class="filter-btn ${sport === selectedSport ? 'active' : ''}" data-sport="${sport}">
                ${sport}
            </button>`
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
        eventListEl.innerHTML = '<div class="loader"></div>';
        
        const allUpcomingEvents = Object.values(allEventsData).flat();
        const nowInSeconds = Date.now() / 1000;

        // --- CORE LOGIC CHANGE ---
        // 1. Define the 24-hour time limit from the current time.
        const twentyFourHoursInSeconds = 24 * 60 * 60;
        const timeLimit = nowInSeconds + twentyFourHoursInSeconds;

        // 2. Filter the master list:
        //    - Keep events that are NOT over yet.
        //    - AND keep events that will start within the next 24 hours.
        let events = allUpcomingEvents.filter(event => {
            const isNotOver = nowInSeconds < (event.unix_timestamp + getEventDuration(event));
            const isWithin24Hours = event.unix_timestamp < timeLimit;
            return isNotOver && isWithin24Hours;
        });
        // --- END OF CORE LOGIC CHANGE ---

        // Apply user filters (Live, Sport, Search)
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
                event.match.toLowerCase().includes(searchQuery) || 
                event.tournament.toLowerCase().includes(searchQuery)
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
                    const eventJsonDate = formatDate(eventTime, 'UTC');

                    const watchUrl = `watch.html?date=${eventJsonDate}&ts=${event.unix_timestamp}`;

                    html += `
                        <div class="event-card">
                            <div class="event-time">${formatTime(eventTime)}</div>
                            <div class="live-indicator">
                                ${isLive ? '<div class="dot"></div>LIVE' : ''}
                            </div>
                            <div class="event-details">
                                <div class="match">${event.match}</div>
                                <div class="tournament">${event.tournament}</div>
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
        const lowerCaseTournament = event.tournament.toLowerCase();
        const lowerCaseSport = (event.sport || '').toLowerCase();
        for (const key in DURATION_MAP) {
            if (lowerCaseTournament.includes(key)) return DURATION_MAP[key];
        }
        for (const key in DURATION_MAP) {
            if (lowerCaseSport.includes(key)) return DURATION_MAP[key];
        }
        return DEFAULT_DURATION;
    };

    const formatDate = (date, timezone) => {
        const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
        if (timezone === 'UTC') {
            options.timeZone = 'UTC';
        }
        const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(date);
        const year = parts.find(p => p.type === 'year').value;
        const month = parts.find(p => p.type === 'month').value;
        const day = parts.find(p => p.type === 'day').value;
        return `${year}-${month}-${day}`;
    };
    
    const getDisplayDate = (dateString) => {
        const date = new Date(dateString + 'T12:00:00'); // Use midday to avoid timezone shifts
        return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    };
    
    const formatTime = (date) => {
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    // --- START THE APP ---
    init();
});