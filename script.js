document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let allEventsData = {};
    let selectedDate;
    let selectedSport = 'All';
    let searchQuery = '';

    // --- DOM ELEMENTS ---
    const eventListEl = document.getElementById('event-list');
    const dateFilterEl = document.getElementById('date-filter');
    const sportFilterEl = document.getElementById('sport-filter');
    const searchBarEl = document.getElementById('search-bar');
    const timezoneEl = document.getElementById('timezone');

    // --- INITIALIZATION ---
    const init = async () => {
        const currentTime = new Date();
        selectedDate = formatDate(currentTime);
        
        displayUserTimezone();
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
        renderDateFilters();
        renderSportFilters();
        renderEventList();
    };

    const displayUserTimezone = () => {
        try {
            timezoneEl.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch (e) {
            timezoneEl.textContent = 'N/A';
        }
    };
    
    const renderDateFilters = () => {
        const dates = Object.keys(allEventsData).sort();
        dateFilterEl.innerHTML = dates.map(date => 
            `<button class="filter-btn ${date === selectedDate ? 'active' : ''}" data-date="${date}">
                ${getDisplayDate(date)}
            </button>`
        ).join('');
        
        dateFilterEl.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                selectedDate = btn.dataset.date;
                selectedSport = 'All';
                searchQuery = '';
                searchBarEl.value = '';
                renderPage();
            });
        });
    };
    
    const renderSportFilters = () => {
        const eventsForDate = allEventsData[selectedDate] || [];
        const sports = ['All', ...new Set(eventsForDate.map(event => event.sport).filter(Boolean))].sort();
        
        sportFilterEl.innerHTML = sports.map(sport => 
            `<button class="filter-btn ${sport === selectedSport ? 'active' : ''}" data-sport="${sport}">
                ${sport}
            </button>`
        ).join('');
        
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
        let events = allEventsData[selectedDate] || [];
        const nowInSeconds = Date.now() / 1000;

        const today = new Date();
        const todayString = formatDate(today);
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yesterdayString = formatDate(yesterday);
        
        // Filter out completed events using the new dynamic duration function
        if (selectedDate === yesterdayString || selectedDate === todayString) {
            events = events.filter(event => nowInSeconds < (event.unix_timestamp + getEventDuration(event)));
        }

        if (selectedSport !== 'All') {
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

        const groupedEvents = events.reduce((acc, event) => {
            const sport = event.sport || 'General';
            const tournament = event.tournament;
            if (!acc[sport]) acc[sport] = {};
            if (!acc[sport][tournament]) acc[sport][tournament] = [];
            acc[sport][tournament].push(event);
            return acc;
        }, {});
        
        let html = '';
        
        for (const sport in groupedEvents) {
            html += `<div class="sport-group"><h2 class="sport-header">${sport}</h2>`;
            for (const tournament in groupedEvents[sport]) {
                html += `<div class="tournament-group"><h3 class="tournament-header">${tournament}</h3>`;
                groupedEvents[sport][tournament].forEach(event => {
                    const eventTime = new Date(event.unix_timestamp * 1000);
                    const duration = getEventDuration(event);
                    const isLive = nowInSeconds > event.unix_timestamp && nowInSeconds < (event.unix_timestamp + duration);
                    const watchUrl = `watch.html?date=${selectedDate}&ts=${event.unix_timestamp}`;

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
                html += `</div>`;
            }
            html += `</div>`;
        }
        
        eventListEl.innerHTML = html;
    };

    // --- UTILITY FUNCTIONS ---

    // NEW: Function to get event duration based on sport/tournament
    const getEventDuration = (event) => {
        const DURATION_MAP = {
            // Specific tournament keywords (checked first)
            't20': 4 * 3600, // 4 hours
            
            // General sport keywords
            'cricket': 8 * 3600, // 8 hours (ODI default)
            'golf': 6 * 3600, // 6 hours
            'motorsport': 4 * 3600, // 4 hours
            'american football': 3.5 * 3600, // 3.5 hours
            'nfl': 3.5 * 3600,
            'football': 2.5 * 3600, // 2.5 hours (Soccer)
        };
        const DEFAULT_DURATION = 3 * 3600; // 3 hours

        const lowerCaseTournament = event.tournament.toLowerCase();
        const lowerCaseSport = (event.sport || '').toLowerCase();

        // Check for specific keywords first for overrides
        for (const key in DURATION_MAP) {
            if (lowerCaseTournament.includes(key)) {
                return DURATION_MAP[key];
            }
        }
        
        // If no specific keyword, check for general sport
        for (const key in DURATION_MAP) {
            if (lowerCaseSport.includes(key)) {
                return DURATION_MAP[key];
            }
        }

        return DEFAULT_DURATION;
    };

    const formatDate = (date) => {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getDisplayDate = (dateString) => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        if (dateString === formatDate(today)) return 'Today';
        if (dateString === formatDate(yesterday)) return 'Yesterday';
        if (dateString === formatDate(tomorrow)) return 'Tomorrow';
        
        return dateString;
    };
    
    const formatTime = (date) => {
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    // --- START THE APP ---
    init();
});
