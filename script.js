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
        await fetchEvents(); // Fetch data first
        setupEventListeners();
        renderPage(); // Then render based on fetched data
    };

    const fetchEvents = async () => {
        eventListEl.innerHTML = '<div class="loader"></div>'; // Show loader while fetching
        try {
            // --- THIS LINE WAS CHANGED ---
            const response = await fetch('https://topembed.pw/api.php?format=json');
            // --- END OF CHANGE ---

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            // Assuming the API returns the same structure as your old source.json
            // If the API structure is different, you might need to adjust this line:
            allEventsData = data.events || {}; // Use data.events or an empty object if 'events' isn't there
        } catch (error) {
            console.error("Fetch Error:", error); // Log the error to console for debugging
            eventListEl.innerHTML = `<p style="color: red;">Error loading events: ${error.message}. Please try refreshing the page.</p>`;
            allEventsData = {}; // Ensure it's an empty object on error
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
        // Only render if data was successfully fetched
        if (Object.keys(allEventsData).length > 0) {
            renderSportFilters();
            renderEventList();
        } else if (!eventListEl.querySelector('p[style*="color: red"]')) {
             // If fetch failed, the error message is already shown. Otherwise show loader or no events.
             eventListEl.innerHTML = '<p>Loading events...</p>'; // Or keep the loader
        }
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
                // Ensure only the clicked button is active
                sportFilterEl.querySelector('.active')?.classList.remove('active');
                btn.classList.add('active');
            });
        });
    };

    const renderEventList = () => {
        // If allEventsData is empty (e.g., fetch failed), don't try to render list
        if (Object.keys(allEventsData).length === 0) {
             if (!eventListEl.querySelector('p[style*="color: red"]')) {
                 eventListEl.innerHTML = '<p>Could not load event data.</p>';
             }
             return;
        }

        eventListEl.innerHTML = '<div class="loader"></div>'; // Show loader initially

        const allUpcomingEvents = Object.values(allEventsData).flat();
        const nowInSeconds = Date.now() / 1000;
        const twentyFourHoursInSeconds = 24 * 60 * 60;
        const timeLimit = nowInSeconds + twentyFourHoursInSeconds;

        let events = allUpcomingEvents.filter(event => {
            const isNotOver = nowInSeconds < (event.unix_timestamp + getEventDuration(event));
            // Only include events starting within the next 24 hours OR currently live
            const isStartingSoonOrLive = event.unix_timestamp < timeLimit || (nowInSeconds > event.unix_timestamp && isNotOver);
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
                    const eventJsonDate = formatDate(eventTime, 'UTC'); // Get the UTC date key

                    // Find the original date key from allEventsData that contains this event's timestamp
                    let originalDateKey = eventJsonDate; // Default assumption
                    for (const keyDate in allEventsData) {
                        if (allEventsData[keyDate].some(e => e.unix_timestamp === event.unix_timestamp)) {
                            originalDateKey = keyDate;
                            break;
                        }
                    }

                    const watchUrl = `watch.html?date=${originalDateKey}&ts=${event.unix_timestamp}`; // Use original key

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

    const formatDate = (date, timezone) => {
        const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
        if (timezone === 'UTC') {
            options.timeZone = 'UTC';
        }
        try {
            // Use 'sv' locale (Swedish) for YYYY-MM-DD format, which is less ambiguous than en-CA
            const formatter = new Intl.DateTimeFormat('sv', options);
            return formatter.format(date);
        } catch (e) {
             // Fallback for older browsers or environments
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    };
    
    const getDisplayDate = (dateString) => {
         try {
            // Attempt to parse the date string assuming YYYY-MM-DD format
            const [year, month, day] = dateString.split('-').map(Number);
            // Create date object in UTC to avoid timezone shifting the date
            const date = new Date(Date.UTC(year, month - 1, day, 12)); // Use midday UTC

            // Format it using the user's local settings for display
            return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
         } catch(e) {
            return dateString; // Fallback if parsing fails
         }
    };
    
    const formatTime = (date) => {
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    // --- START THE APP ---
    init();
});
