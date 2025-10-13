document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let allChannelsData = [];
    let selectedCountry = '';

    // --- DOM ELEMENTS ---
    const channelListEl = document.getElementById('channel-list');
    const countryDropdownEl = document.getElementById('country-dropdown');
    const streamFrame = document.getElementById('stream-frame');
    const playerPlaceholder = document.querySelector('.player-placeholder');
    
    // --- INITIALIZATION ---
    const init = async () => {
        streamFrame.style.display = 'none'; // Hide iframe initially
        await fetchChannels();
        setupDropdown();
        renderChannelList();
    };

    const fetchChannels = async () => {
        try {
            const response = await fetch('tvchannels.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            allChannelsData = await response.json();
            // Rename keys to be consistent
            allChannelsData.forEach(item => {
                item.channel_name = item.channel;
                item.embed_link = item.link;
            });
        } catch (error) {
            channelListEl.innerHTML = `<p style="color: red;">Error loading channels: ${error.message}</p>`;
        }
    };
    
    // --- RENDER & SETUP FUNCTIONS ---
    const setupDropdown = () => {
        const countries = [...new Set(allChannelsData.map(ch => ch.country).filter(Boolean))].sort();
        
        if (countries.length === 0) return;

        // Set the default selected country
        selectedCountry = countries[0];
        
        countryDropdownEl.innerHTML = countries.map(country => 
            `<option value="${country}" ${country === selectedCountry ? 'selected' : ''}>
                ${country}
            </option>`
        ).join('');
        
        countryDropdownEl.addEventListener('change', (e) => {
            selectedCountry = e.target.value;
            renderChannelList();
        });
    };

    const renderChannelList = () => {
        channelListEl.innerHTML = ''; // Clear previous list

        const channels = allChannelsData.filter(ch => ch.country === selectedCountry);
        
        if (channels.length === 0) {
            channelListEl.innerHTML = `<p>No channels found.</p>`;
            return;
        }
        
        let html = '<ul class="channel-group-list">';
        channels.sort((a, b) => a.channel_name.localeCompare(b.channel_name)).forEach(channel => {
            html += `<li><button class="channel-list-btn" data-link="${channel.embed_link}">${channel.channel_name}</button></li>`;
        });
        html += `</ul>`;
        
        channelListEl.innerHTML = html;
        addChannelClickListeners();
    };

    const addChannelClickListeners = () => {
        channelListEl.querySelectorAll('.channel-list-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const link = btn.dataset.link;
                streamFrame.src = link;

                // Show player and hide placeholder
                playerPlaceholder.style.display = 'none';
                streamFrame.style.display = 'block';

                // Highlight active channel
                channelListEl.querySelector('.active')?.classList.remove('active');
                btn.classList.add('active');
            });
        });
    };

    // --- START THE APP ---
    init();
});