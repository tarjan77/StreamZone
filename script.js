document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let allEventsFlat = [];
    let selectedSport = 'All';
    let searchQuery = '';

    // --- CONFIGURATION ---
    const EXCLUDED_SPORTS = [
        'Golf', 'Aussie rules', 'Handball', 'Ice Hockey',
        'Rugby League', 'Rugby Union', 'Darts', 'Snooker',
        'Equestrian', 'Wintersports'
    ];
    const excludedSportsSet = new Set(EXCLUDED_SPORTS);

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

            allEventsFlat = [];
            for (const dateKey in eventsData) {
                if (Array.isArray(eventsData[dateKey])) {
                    eventsData[dateKey].forEach(event => {
                        if (!event.sport || !excludedSportsSet.has(event.sport)) {
                             allEventsFlat.push({ ...event, originalDateKey: dateKey });
                        }
                    });
                }
            }
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
             eventListEl.innerHTML = '<p>No events are currently scheduled for the selected sports.</p>';
        }
    };

    const renderSportFilters = () => {
        const sportsToShow = [...new Set(allEventsFlat.map(event => event.sport).filter(Boolean))].sort();
        selectedSport = 'All'; // Default to 'All' on page load/refresh
        let sportsHtml = `<button class="filter-btn active" data-sport="All">All</button>`;
        sportsHtml += `<button class="filter-btn" data-sport="Live">Live Now</button>`;
        sportsHtml += sportsToShow.map(sport =>
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

        // Start with the pre-filtered flat list
        let baseEvents = allEventsFlat.filter(event => {
            const isNotOver = nowInSeconds < (event.unix_timestamp + getEventDuration(event));
            const isStartingSoonOrLive = event.unix_timestamp < timeLimit;
            return isNotOver && isStartingSoonOrLive;
        });

        // --- NEW: Separate Live Cricket ---
        let liveCricketEvents = [];
        if (selectedSport === 'All' || selectedSport === 'Live' || selectedSport === 'Cricket') {
             liveCricketEvents = baseEvents.filter(event => {
                const duration = getEventDuration(event);
                const isLive = nowInSeconds > event.unix_timestamp && nowInSeconds < (event.unix_timestamp + duration);
                // Specifically look for 'Cricket' sport name
                return isLive && event.sport === 'Cricket';
             });
             
             // Remove live cricket from the main list to avoid duplication
             const liveCricketTimestamps = new Set(liveCricketEvents.map(e => e.unix_timestamp));
             baseEvents = baseEvents.filter(event => !(event.sport === 'Cricket' && liveCricketTimestamps.has(event.unix_timestamp)));
        }
        // --- END OF NEW LOGIC ---

        // Apply user filters to the remaining baseEvents
        let events = baseEvents;
        if (selectedSport === 'Live') {
             events = events.filter(event => {
                const duration = getEventDuration(event);
                return nowInSeconds > event.unix_timestamp && nowInSeconds < (event.unix_timestamp + duration);
            });
        } else if (selectedSport !== 'All') {
            events = events.filter(event => event.sport === selectedSport);
        }

        if (searchQuery) {
            // Apply search to both live cricket and other events if 'All' or 'Live' is selected
             if (selectedSport === 'All' || selectedSport === 'Live') {
                liveCricketEvents = liveCricketEvents.filter(event =>
                    (event.match && event.match.toLowerCase().includes(searchQuery)) ||
                    (event.tournament && event.tournament.toLowerCase().includes(searchQuery))
                );
             }
            events = events.filter(event =>
                (event.match && event.match.toLowerCase().includes(searchQuery)) ||
                (event.tournament && event.tournament.toLowerCase().includes(searchQuery))
            );
        }

        // Check if anything is left to display
        if (events.length === 0 && liveCricketEvents.length === 0) {
            eventListEl.innerHTML = `<p>No events found for the selected criteria.</p>`;
            return;
        }

        // Sort the main list
        events.sort((a, b) => a.unix_timestamp - b.unix_timestamp);

        // Group the main list by date
        const groupedByDate = events.reduce((acc, event) => {
            const localDate = formatDate(new Date(event.unix_timestamp * 1000));
            if (!acc[localDate]) acc[localDate] = [];
            acc[localDate].push(event);
            return acc;
        }, {});

        // --- RENDER HTML ---
        let html = '';
        const todayString = formatDate(new Date());

        // --- NEW: Render Live Cricket Section First ---
        if (liveCricketEvents.length > 0) {
            html += `<div class="sport-group live-cricket-section">`; // Added a class for potential specific styling
            html += `<h2 class="sport-header" style="color: var(--live-color);">🏏 Live Cricket Now</h2>`; // Special header
            liveCricketEvents.sort((a,b) => a.unix_timestamp - b.unix_timestamp).forEach(event => { // Sort live cricket too
                const eventTime = new Date(event.unix_timestamp * 1000);
                const watchUrl = `watch.html?date=${event.originalDateKey}&ts=${event.unix_timestamp}`;
                html += `
                    <div class="event-card">
                        <div class="event-time">${formatTime(eventTime)}</div>
                        <div class="live-indicator"><div class="dot"></div>LIVE</div>
                        <div class="event-details">
                            <div class="match">${event.match || 'N/A'}</div>
                            <div class="tournament">${event.tournament || 'N/A'}</div>
                        </div>
                        <a href="${watchUrl}" class="watch-btn" target="_blank" rel="noopener noreferrer">Watch Now &raquo;</a>
                    </div>
                `;
            });
            html += `</div>`; // Close live-cricket-section
        }
        // --- END OF NEW LOGIC ---

        // Render the rest of the events, grouped by date and sport
        for (const date in groupedByDate) {
            const displayDate = date === todayString ? 'Today' : getDisplayDate(date);
            // Check if there are actually events for this date after potential filtering
            const eventsForThisDate = groupedByDate[date];
            if (eventsForThisDate.length === 0) continue; // Skip date if empty

            html += `<div class="sport-group"><h2 class="sport-header">${displayDate} - ${date}</h2>`;

            const groupedBySport = eventsForThisDate.reduce((acc, event) => {
                 const sport = event.sport || 'General';
                 if (!acc[sport]) acc[sport] = [];
                 acc[sport].push(event);
                return acc;
            }, {});

            const sportsInOrder = Object.keys(groupedBySport).sort();

            for (const sport of sportsInOrder) {
                 // The check `if (selectedSport === 'All' || ...)` is implicitly handled
                 // because `events` was already filtered by selectedSport earlier.
                 html += `<h3 class="tournament-header" style="font-size: 1.5rem; margin-top: 1.5rem;">${sport}</h3>`;
                 groupedBySport[sport].forEach(event => {
                    const eventTime = new Date(event.unix_timestamp * 1000);
                    const duration = getEventDuration(event);
                    // Check liveness again just for display, event is already included based on time limit filter
                    const isCurrentlyLive = nowInSeconds > event.unix_timestamp && nowInSeconds < (event.unix_timestamp + duration);
                    const watchUrl = `watch.html?date=${event.originalDateKey}&ts=${event.unix_timestamp}`;

                    html += `
                        <div class="event-card">
                            <div class="event-time">${formatTime(eventTime)}</div>
                            <div class="live-indicator">
                                ${isCurrentlyLive ? '<div class="dot"></div>LIVE' : ''}
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
            html += `</div>`; // Close sport-group
        }

        eventListEl.innerHTML = html;
    };


    // --- UTILITY FUNCTIONS --- (Keep these exactly as they were)
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
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getDisplayDate = (dateString) => {
         try {
            const date = new Date(dateString + 'T12:00:00Z');
            return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
         } catch(e) { return dateString; }
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    };


    // --- START THE APP ---
    init();
});