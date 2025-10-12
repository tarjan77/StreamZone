document.addEventListener('DOMContentLoaded', () => {
    const watchContentEl = document.getElementById('watch-content');

    const loadEvent = async () => {
        // Get parameters from the URL
        const params = new URLSearchParams(window.location.search);
        const date = params.get('date');
        const timestamp = params.get('ts');

        if (!date || !timestamp) {
            displayError('Event information not found in URL.');
            return;
        }

        try {
            const response = await fetch('source.json');
            if (!response.ok) throw new Error('Could not load event data.');
            
            const data = await response.json();
            const eventsForDate = data.events[date] || [];
            
            // Find the specific event using the unique timestamp
            const event = eventsForDate.find(e => e.unix_timestamp == timestamp);

            if (event) {
                renderEvent(event);
            } else {
                displayError('Event not found.');
            }
        } catch (error)
        {
            displayError(error.message);
        }
    };
    
    const renderEvent = (event) => {
        // Set the document title
        document.title = `Watch: ${event.match}`;

        // Create the HTML structure
        const firstChannel = event.channels[0];
        let streamLinksHtml = '';
        
        if (event.channels.length > 1) {
             streamLinksHtml = `
                <div class="stream-links">
                    <h3>Available Streams:</h3>
                    ${event.channels.map((channel, index) => {
                        // Extract name like "TSN4[Canada]" from URL if present
                        const match = channel.match(/channel\/([^/\]]+)/);
                        let channelName = `Stream ${index + 1}`;
                        if (match && match[1] && !match[1].startsWith('ex')) {
                            channelName = match[1].replace(/\[/g, ' [');
                        }
                        
                        return `<button class="stream-btn ${index === 0 ? 'active' : ''}" data-url="${channel}">${channelName}</button>`;
                    }).join('')}
                </div>
            `;
        }

        // --- THIS HTML BLOCK IS THE ONLY PART THAT CHANGED ---
        // The order is now: Header, Stream Links, then Video
        watchContentEl.innerHTML = `
            <div class="watch-header">
                <h2 class="match-title">${event.match}</h2>
                <p class="tournament-title">${event.tournament}</p>
            </div>
            ${streamLinksHtml}
            <div class="video-container">
                <iframe id="stream-frame" src="${firstChannel}" frameborder="0" allowfullscreen></iframe>
            </div>
        `;

        // Add event listeners to stream buttons
        document.querySelectorAll('.stream-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('stream-frame').src = btn.dataset.url;
                // Update active state
                document.querySelector('.stream-btn.active')?.classList.remove('active');
                btn.classList.add('active');
            });
        });
    };

    const displayError = (message) => {
        watchContentEl.innerHTML = `<p style="color: red; text-align: center;">${message}</p>`;
    };

    loadEvent();
});