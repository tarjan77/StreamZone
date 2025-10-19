document.addEventListener('DOMContentLoaded', () => {
    const watchContentEl = document.getElementById('watch-content');

    const loadEvent = async () => {
        const params = new URLSearchParams(window.location.search);
        // We primarily need the timestamp now. The date is less critical.
        // const dateKey = params.get('date'); // We won't rely solely on this anymore
        const timestamp = params.get('ts');

        if (!timestamp) {
            displayError('Event timestamp missing in URL.');
            return;
        }

        watchContentEl.innerHTML = '<div class="loader"></div>'; // Show loader

        try {
            const response = await fetch('https://topembed.pw/api.php?format=json');
            if (!response.ok) throw new Error('Could not load event data from API.');

            const data = await response.json();
            const eventsData = data.events || {};

            // --- ROBUST EVENT FINDING LOGIC ---
            let event = null;
            // Iterate through all date keys in the API response
            for (const dateKey in eventsData) {
                const eventsForDate = eventsData[dateKey] || [];
                // Try to find the event with the matching timestamp within this date's array
                const foundEvent = eventsForDate.find(e => e.unix_timestamp == timestamp);
                if (foundEvent) {
                    event = foundEvent; // Found it!
                    break; // Stop searching
                }
            }
            // --- END OF ROBUST FINDING LOGIC ---


            if (event) {
                renderEvent(event);
            } else {
                console.error(`Event not found anywhere for timestamp: ${timestamp}`, eventsData);
                displayError('Event details could not be found for this timestamp.');
            }
        } catch (error) {
            console.error("Fetch Error on watch page:", error);
            displayError(`Error loading event data: ${error.message}`);
        }
    };

    const renderEvent = (event) => {
        document.title = `Watch: ${event.match || 'Live Event'} - StreamZone`;
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
                        const match = channel.match(/channel\/([^/?]+)/);
                        let channelName = `Stream ${index + 1}`;
                         if (match && match[1] && !match[1].startsWith('ex') && match[1].includes('[')) {
                             channelName = match[1].replace(/\[/g, ' [');
                         } else if (match && match[1] && !match[1].startsWith('ex')) {
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
        document.title = 'Error Loading Event - StreamZone';
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute('content', 'Error Loading Event - StreamZone');
    };

    loadEvent();
});