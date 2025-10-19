document.addEventListener('DOMContentLoaded', () => {
    const watchContentEl = document.getElementById('watch-content');

    const loadEvent = async () => {
        // Get parameters from the URL
        const params = new URLSearchParams(window.location.search);
        const date = params.get('date'); // This should be the YYYY-MM-DD key used in the API/JSON
        const timestamp = params.get('ts');

        if (!date || !timestamp) {
            displayError('Event information not found in URL.');
            return;
        }

        try {
            // --- THIS FETCH URL WAS CHANGED ---
            const response = await fetch('https://topembed.pw/api.php?format=json');
            // --- END OF CHANGE ---

            if (!response.ok) throw new Error('Could not load event data from API.');

            const data = await response.json();

            // --- ACCESSING DATA BASED ON API STRUCTURE ---
            // Assuming the API returns an object like { events: { "YYYY-MM-DD": [...] } }
            // If the API structure is different, this needs adjustment.
            const eventsData = data.events || {}; // Access the 'events' object
            const eventsForDate = eventsData[date] || []; // Access the array for the specific date key
            // --- END OF DATA ACCESS CHANGE ---

            // Find the specific event using the unique timestamp
            const event = eventsForDate.find(e => e.unix_timestamp == timestamp);

            if (event) {
                renderEvent(event);
            } else {
                console.error(`Event not found for date: ${date}, timestamp: ${timestamp}`, eventsData); // Log for debugging
                displayError('Event details could not be found for this timestamp on the specified date.');
            }
        } catch (error) {
            console.error("Fetch Error on watch page:", error); // Log the specific error
            displayError(`Error loading event data: ${error.message}`);
        }
    };

    const renderEvent = (event) => {
        // Set the document title dynamically
        document.title = `Watch: ${event.match || 'Live Event'} - StreamZone`;

        // Update meta tags dynamically (basic example)
        const ogTitle = document.querySelector('meta[property="og:title"]');
        const ogDescription = document.querySelector('meta[property="og:description"]');
        if (ogTitle) ogTitle.setAttribute('content', `Watch Live: ${event.match || 'Event'} - StreamZone`);
        if (ogDescription) ogDescription.setAttribute('content', `Streaming ${event.match || 'live event'} from the ${event.tournament || 'tournament'} on StreamZone.`);


        const firstChannel = event.channels && event.channels.length > 0 ? event.channels[0] : 'about:blank';
        let streamLinksHtml = '';

        if (event.channels && event.channels.length > 1) {
             streamLinksHtml = `
                <div class="stream-links">
                    <h3>Available Streams:</h3>
                    ${event.channels.map((channel, index) => {
                        const match = channel.match(/channel\/([^/?]+)/); // Try to extract name before '?' if present
                        let channelName = `Stream ${index + 1}`;
                         if (match && match[1] && !match[1].startsWith('ex') && match[1].includes('[')) {
                            // Extract name if it contains brackets like [USA]
                             channelName = match[1].replace(/\[/g, ' [');
                         } else if (match && match[1] && !match[1].startsWith('ex')) {
                            // Use the segment if it doesn't start with 'ex' and lacks brackets
                             channelName = match[1];
                         }

                        return `<button class="stream-btn ${index === 0 ? 'active' : ''}" data-url="${channel}">${channelName}</button>`;
                    }).join('')}
                </div>
            `;
        }

        watchContentEl.innerHTML = `
            <div class="watch-header">
                <h2 class="match-title">${event.match || 'Live Event'}</h2>
                <p class="tournament-title">${event.tournament || 'Details unavailable'}</p>
            </div>
            ${streamLinksHtml}
            <div class="video-container">
                <iframe id="stream-frame" src="${firstChannel}" frameborder="0" allowfullscreen></iframe>
            </div>
        `;

        document.querySelectorAll('.stream-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('stream-frame').src = btn.dataset.url;
                document.querySelector('.stream-btn.active')?.classList.remove('active');
                btn.classList.add('active');
            });
        });
    };

    const displayError = (message) => {
        watchContentEl.innerHTML = `<p style="color: red; text-align: center; margin-top: 2rem;">${message}</p>`;
         // Update title for error
         document.title = 'Error Loading Event - StreamZone';
         const ogTitle = document.querySelector('meta[property="og:title"]');
         if (ogTitle) ogTitle.setAttribute('content', 'Error Loading Event - StreamZone');
    };

    loadEvent();
});
