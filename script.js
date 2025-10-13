document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let allEventsData = {};
    let selectedDate;
    // CHANGED: selectedSport is no longer hardcoded to 'All' here. It will be set in init().
    let selectedSport;
    let searchQuery = '';
    const EVENT_DURATION_SECONDS = 3 * 60 * 60; // Assume a 3-hour duration for events

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
        
        // --- NEW LOGIC TO SET DEFAULT SPORT ---
        // 1. Get the default sport for the user's region.
        const regionalSport = getRegionalDefaultSport();
        // 2. Check if that sport has any events scheduled for today.
        const todaysSports = new Set((allEventsData[selectedDate] || []).map(e => e.sport));
        if (todaysSports.has(regionalSport)) {
            // 3. If yes, set it as the default filter.
            selectedSport = regionalSport;
        } else {
            // 4. Otherwise, fallback to 'All'.
            selectedSport = 'All';
        }
        // --- END OF NEW LOGIC ---

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
    
    // NEW: Function to determine default sport from timezone
    const getRegionalDefaultSport = () => {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // USA & Canada -> American Football
        if (timeZone.startsWith('America/')) {
            return 'American Football';
        }
        // South Asia -> Cricket
        if (timeZone.startsWith('Asia/Kolkata') || timeZone.startsWith('Asia/Dhaka') || timeZone.startsWith('Asia/Karachi')) {
            return 'Cricket';
        }
        // Europe -> Football (Soccer)
        if (timeZone.startsWith('Europe/')) {
            return 'Football';
        }
        // Australia -> Cricket or Rugby; Cricket is a good default
        if (timeZone.startsWith('Australia/')) {
            return 'Cricket';
        }
        
        // You can add more rules here for other regions

        // Default for everyone else
        return 'All';
    };

    const getEventDuration = (event) => {
        const DURATION_MAP = {
            't20': 4 * 3600,
            'cricket': 8 * 3600,
            'golf': 6 * 3600,
            'motorsport': 4 * 3600,
            'american football': 3.5 * 3600,
            'nfl': 3.5 * 3600,
            'football': 2.5 * 3600,
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
