

const LOCAL_STORAGE_PLAYLISTS_KEY = 'lampone-K@8$dL%3vZ&nB1xR*';

const LOCAL_STORAGE_CHANNELS_KEY = 'lampone-m^7Y!zR4*P8&kQ3@h';

const m3uUrls = [
    'samplevideos.m3u'
];

let hls; // Variable for the Hls.js instance
let allChannels = {}; // Global object for grouped channels
let currentGroup = 'UK'; // Default group shown

// Get references to HTML elements
const player = document.getElementById('player');
const channelList = document.getElementById('channelList');
const countrySelector = document.getElementById('countrySelector');
const searchBox = document.getElementById('searchBox');
const statusMsg = document.getElementById('statusMessage');
const channelTitle = document.getElementById('channelTitle');
const localM3uFile = document.getElementById('localM3uFile');
const remoteM3uUrlInput = document.getElementById('remoteM3uUrl');
const loadRemoteM3uButton = document.getElementById('loadRemoteM3u');
const clearListButton = document.getElementById('clearListButton');
const localFileNameDisplay = document.getElementById('localFileNameDisplay');
const loadedPlaylistsDisplay = document.getElementById('loadedPlaylistsDisplay');
const totalChannelsCount = document.getElementById('totalChannelsCount');
const listMessage = document.getElementById('listmessage');


function setFallbackPlayerImage() {
    if (hls) hls.destroy?.();
    if (player) {
        player.removeAttribute('src');
        player.innerHTML = '';
    }
}

// --- LocalStorage Functions ---

// Function to save the current allChannels object to localStorage
function saveAllChannels() {
    try {
        // Use JSON.stringify to convert the JavaScript object to a string
        const channelsAsString = JSON.stringify(allChannels);
        localStorage.setItem(LOCAL_STORAGE_CHANNELS_KEY, channelsAsString);
        console.log(`All channels data saved to localStorage (${Object.keys(allChannels).length} groups).`);
    } catch (error) {
        console.error("Error saving channels to localStorage:", error);
        // Handle potential QuotaExceededError (localStorage full)
        if (error.name === 'QuotaExceededError') {
            alert("Unable to save the list in the browser. Local storage is full.");
            console.error("LocalStorage quota exceeded.");
        }
    }
}

// Function to load channels data from localStorage
// Returns the loaded data object or an empty object if not found/error
function loadAllChannels() {
    try {
        // Retrieve the string from localStorage
        const channelsAsString = localStorage.getItem(LOCAL_STORAGE_CHANNELS_KEY);
        if (channelsAsString) {
            // Parse the JSON string back into a JavaScript object
            const loadedChannels = JSON.parse(channelsAsString);
            console.log(`Channels data loaded from localStorage (${Object.keys(loadedChannels).length} groups).`);
            return loadedChannels;
        } else {
            console.log(`No channels data found in localStorage with key: ${LOCAL_STORAGE_CHANNELS_KEY}`);
            return {}; // Return an empty object if no data is found
        }
    } catch (error) {
        console.error("Error loading channels from localStorage:", error);
        return {}; // Return an empty object in case of parsing errors
    }
}

function clearSavedChannels() {
    try {
        localStorage.removeItem(LOCAL_STORAGE_CHANNELS_KEY);
        localStorage.removeItem(LOCAL_STORAGE_PLAYLISTS_KEY);
        localStorage.removeItem("iptvSource"); // elimina anche la fonte salvata
        console.log(`Channels and source data removed from localStorage.`);
        location.reload(); // 🔁 forza il reload della pagina
    } catch (error) {
        console.error("Error clearing channels from localStorage:", error);
    }
}



function addLoadedPlaylistName(name) {
    if (!loadedPlaylistsDisplay) return;

    // Recupera la lista salvata
    const saved = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PLAYLISTS_KEY) || '[]');

    // Se non è già presente, aggiungila
    if (!saved.includes(name)) {
        saved.push(name);
        localStorage.setItem(LOCAL_STORAGE_PLAYLISTS_KEY, JSON.stringify(saved));
    }

    // Mostra nella UI
   const p = document.createElement('p');

const now = new Date();
const pad = n => n.toString().padStart(2, '0');
const timeStr = `[${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}]`;

p.textContent = `${timeStr} ${name}`;
p.style.margin = '5px 0';
p.style.fontSize = '14px';

loadedPlaylistsDisplay.appendChild(p);

}
// Function to update the total channel count
function updateTotalChannelsCount() {
    if (!totalChannelsCount) {
        console.warn("Element with ID 'totalChannelsCount' not found.");
        return; // Exit if the element does not exist
    }

    let total = 0;
    // Iterate over all groups (keys) in the allChannels object
    for (const group in allChannels) {
        // Ensure the property is actually an object property and that it is an array
        if (Object.hasOwnProperty.call(allChannels, group) && Array.isArray(allChannels[group])) {
            total += allChannels[group].length; // Sum the number of channels (array length)
        }
    }
    totalChannelsCount.textContent = total; // Update the text content of the HTML element
}


// Function to parse M3U data and populate the allChannels object
// 'text': the text content of the M3U/M3U8 file
// 'skipFlags': if true, skips updating flags after this parsing (useful for multiple initial loads)
function parseM3UData(text, skipFlags = false) {
    const lines = text.split('\n'); // Split the text into lines
    let name = '', logo = '', group = '', url = ''; // Temporary variables for current channel data

    // Iterate over each line of the M3U file
    lines.forEach((line) => {
        line = line.trim(); // Remove leading/trailing whitespace
        if (line.startsWith('#EXTINF')) {
            // Line containing channel information (#EXTINF)
            const logoMatch = line.match(/tvg-logo="([^"]+)"/); // Extract the logo
            const groupMatch = line.match(/group-title="([^"]+)"/); // Extract the group
            logo = logoMatch ? logoMatch[1] : ''; // Assign the found logo or empty string
            // Assign the found group or use "Other" as a fallback, removing extra spaces
            group = groupMatch && groupMatch[1] ? groupMatch[1].trim() : 'Other';
            const parts = line.split(','); // Split the line by comma to get the name
            // Take the part after the first comma as the channel name, removing extra spaces
            name = parts.length > 1 ? parts.slice(1).join(',').trim() : 'Unnamed';
        } else if (line.startsWith('http')) {
            // Line containing the stream URL (starts with http)
            url = line; // Assign the URL
            if (name && url) { // If both name and URL were found for this channel
                // If the group doesn't exist yet in the allChannels object, create it as an empty array
                if (!allChannels[group]) allChannels[group] = [];
                // Check if a channel with the same URL already exists in this group to avoid duplicates
                const existingChannel = allChannels[group].find(ch => ch.url === url);
                if (!existingChannel) {
                    // Add the new channel to the corresponding group
                    allChannels[group].push({ name, logo, url });
                }
            }
            // Reset temporary variables for the next channel
            name = ''; logo = ''; url = ''; // Do not reset 'group' here, it might be used for subsequent channels without group-title
        }
        // Ignore lines that do not start with #EXTINF or http
    });

    // Update flag display only if skipping is not requested (skipFlags is false)
    // This is useful to update flags only once after loading all initial lists
    if (!skipFlags) {
        updateCountryFlags();
    }
    // Update the total channel count after each parsing operation
    updateTotalChannelsCount();

    // --- Save to localStorage after parsing and adding channels ---
    saveAllChannels();
}

// Function to update country flags in the sidebar
// Called after each playlist load or data load
function updateCountryFlags() {
    if (!countrySelector) { // Safety check: ensure the element exists
        console.warn("Element with ID 'countrySelector' not found.");
        return;
    }
    countrySelector.innerHTML = ''; // Clear existing flags before adding them again
    // Get the names of all groups (countries) present in allChannels, sort alphabetically, putting 'Other' at the end
    const countries = Object.keys(allChannels).sort((a, b) => {
        if (a === 'Other') return 1; // 'Other' goes after 'b'
        if (b === 'Other') return -1; // 'Other' goes after 'a'
        return a.localeCompare(b); // Alphabetical order for other names
    });
    // For each group, create the corresponding flag element
    countries.forEach(c => createCountryFlag(c));

    // Logic for automatically selecting the flag of the country detected by the user's IP
    fetch('https://ipinfo.io/json') // Call API to get IP info
        .then(res => res.json()) // Parse the JSON response
        .then(ipdata => {
            const ipCountryCode = ipdata.country.toLowerCase(); // Get the country code (e.g., "it")
            // Find the group name in allChannels that matches the IP country code
            const groupName = Object.keys(allChannels).find(
                key => getCountryCode(key) === ipCountryCode
            );
            // If a group corresponding to the IP country was found
            if (groupName) {
                // Find the corresponding flag element in the DOM
                const flagElement = document.querySelector(`[data-country="${groupName}"]`);
                if (flagElement) { // If the flag element exists
                    // Remove the 'selected' class from all flags
                    document.querySelectorAll('.flag-wrapper').forEach(w => w.classList.remove('selected'));
                    // Add the 'selected' class to the IP country flag
                    flagElement.parentElement.classList.add('selected');
                    // If the IP country group is not already the current one, simulate a click on the flag
                    // This will load the channel list for that group and select the first channel
                    if (currentGroup !== groupName) {
                        loadCountry(groupName); // Simulate click to load channel list
                    }
                }
            } else {
                // If no group corresponding to the IP is found, try to select the current group's flag
                const currentFlagElement = document.querySelector(`[data-country="${currentGroup}"]`);
                if (currentFlagElement) {
                    document.querySelectorAll('.flag-wrapper').forEach(w => w.classList.remove('selected'));
                    currentFlagElement.parentElement.classList.add('selected');
                } else {
                    // If even the current group doesn't exist, deselect everything and select the first available
                    document.querySelectorAll('.flag-wrapper').forEach(w => w.classList.remove('selected'));
                    const firstAvailableGroup = Object.keys(allChannels).sort((a, b) => {
                        if (a === 'Other') return 1;
                        if (b === 'Other') return -1;
                        return a.localeCompare(b);
                    })[0];
                    if (firstAvailableGroup && allChannels[firstAvailableGroup]?.length > 0) {
                        const firstFlagElement = document.querySelector(`[data-country="${firstAvailableGroup}"]`);
                        if (firstFlagElement) {
                            firstFlagElement.parentElement.classList.add('selected');
                            // The loadCountry for this group will happen in the initial loadAllPlaylists logic
                            // currentGroup = firstAvailableGroup; // loadCountry will do this
                        }
                    }
                }
            }

            const infoElement = document.getElementById('locationInfo');
            if (infoElement) { // Safety check
                const flagUrl = `https://hatscripts.github.io/circle-flags/flags/${ipdata.country.toLowerCase()}.svg`;
                const info = `<a href='https://ipinfo.io/${ipdata.ip}' target='_blank' style='text-decoration: none; color:#c9d1d9; font-weight:;'>
                                  <img src='${flagUrl}' style=' display: none; vertical-align:middle;'>
                                  ${ipdata.country}
                              </a><span style="color:#a47aff;">[${ipdata.ip}]</span>`;
                infoElement.innerHTML = info;
            } else {
                console.warn("Element with ID 'locationInfo' not found.");
            }

        })
        .catch(err => console.warn('IP info not available:', err));
}


// Function to load all default playlists from the m3uUrls array
// This function now also handles loading from localStorage first.
async function loadAllPlaylists(urls) {
    console.log('Loading playlists...');

    // Clear the loaded playlists display at the beginning of default loading
    if (loadedPlaylistsDisplay) {
    loadedPlaylistsDisplay.innerHTML = ``;
}


    // --- Step 1: Attempt to load from localStorage ---
    const savedChannels = loadAllChannels();
    if (savedChannels && Object.keys(savedChannels).length > 0) {
        allChannels = savedChannels; // Use the data from localStorage
        console.log("Loaded channels from localStorage.");
        checkChannelListEmpty('Saved Playlist');
       
    } else {
        // If no data in localStorage, initialize allChannels as empty
        allChannels = {};
        console.log("No saved channels found in localStorage. Starting fresh or loading defaults.");
    }

     // Update flags and count based on loaded data immediately
    updateCountryFlags();
    updateTotalChannelsCount();


    // --- Step 2: Fetch and parse default URLs (adding to existing allChannels) ---
    for (let i = 0; i < urls.length; i++) {
        if (!urls[i]) continue; // Skip empty URLs
        try {
            const res = await fetch(urls[i]);
            if (!res.ok) {
                console.warn(`HTTP error loading list ${urls[i]}: ${res.status}`);
                // Add error feedback to the loaded playlists display
                addLoadedPlaylistName(`${urls[i]} (Error: ${res.status})`);
                continue; // Move to the next list if there's an HTTP error
            }
            const text = await res.text();
            // Parse data and ADD to allChannels.
            // Pass true to skipFlags for all lists except the last default one.
            // Flag update will happen after all initial lists are loaded.
            // parseM3UData now also calls saveAllChannels internally.
            parseM3UData(text, i < urls.length - 1);

            // Add the list name/URL to the display
            addLoadedPlaylistName(urls[i]);

        } catch (err) {
            console.error(`Error fetching list ${urls[i]}:`, err);
            // Add error feedback to the loaded playlists display
            addLoadedPlaylistName(`${urls[i]} (Fetch Error)`);
        }
    }
    console.log('Default playlists loading finished.');

    // --- Step 3: Final UI Update and Initial Channel Load ---
    // Update flags and count one last time after all sources are processed
    updateCountryFlags();
    updateTotalChannelsCount();

    // Find the first available group or use 'Other' as a fallback
    const firstGroup = Object.keys(allChannels).sort((a, b) => {
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return a.localeCompare(b);
    })[0];

    if (firstGroup && allChannels[firstGroup] && allChannels[firstGroup].length > 0) {
        loadCountry(firstGroup); // Load the channel list and start the first channel
    } else {
        // Handle the case where no channels are loaded from any source (localStorage or defaults)
        if (statusMsg) statusMsg.innerHTML = '<span style="">No channels loaded from any source.</span>';
        if (channelList) channelList.innerHTML = '';
        updateChannelTitle('No Channel Selected', '../img/logo.png'); // Update channel title area
        if (hls) hls.destroy(); // Destroy any existing HLS instance
        setFallbackPlayerImage(); // Clear player source
    }
}

// Function to load a single playlist from text (local file or remote URL)
function loadM3uFromText(text) {
    console.log('Parsing M3U text (adding)...');
    // parseM3UData ADDS to allChannels and calls updateCountryFlags(false)
    // parseM3UData now also calls saveAllChannels internally.
    parseM3UData(text, false); // Passing false ensures flags are updated after manual load

    console.log('M3U text parsing finished.'); // Added log for debugging

    // Update the total channel count after loading a new list
    updateTotalChannelsCount();


    // After loading the new list, reload the currently selected group
    // to include the new channels, or load a default group if necessary.
    // This logic was already present and is maintained.
    const groupToLoad = allChannels[currentGroup] && allChannels[currentGroup].length > 0 ? currentGroup : Object.keys(allChannels).sort((a, b) => {
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return a.localeCompare(b);
    })[0] || 'Other'; // Fallback to 'Other'

    if (groupToLoad && allChannels[groupToLoad] && allChannels[groupToLoad].length > 0) {
        loadCountry(groupToLoad); // Load the channel list and start the first channel
    } else {
        // If the current group no longer exists or is empty after loading,
        // try to load another group or show a message
        const firstGroup = Object.keys(allChannels).sort((a, b) => {
            if (a === 'Other') return 1;
            if (b === 'Other') return -1;
            return a.localeCompare(b);
        })[0] || 'Other'; // Fallback to 'Other'
        if (allChannels[firstGroup] && allChannels[firstGroup].length > 0) {
            loadCountry(firstGroup);
        } else {
            if (statusMsg) statusMsg.textContent = "No channels available after loading playlist.";
            if (channelList) channelList.innerHTML = '<p style="text-align:center; margin-top: 20px;">No channels available after loading playlist.</p>';
            updateChannelTitle('No Channel Selected', '');
            if (hls) hls.destroy();
            setFallbackPlayerImage();
        }
    }
    if (statusMsg) statusMsg.textContent = 'Playlist loaded successfully!'; // Update status message
    
    updateTotalChannelsCount();
checkChannelListEmpty();  // 👈 Aggiungilo qui

}



// Function to play a video stream
function playStream(url) {
    if (!player) { // Safety check
        console.warn("Player element not found.");
        return;
    }

    // Destroy any existing HLS instance
    if (hls) {
        hls.destroy();
        console.log("Previous HLS instance destroyed.");
    }

    // Check if HLS is supported by the browser
    if (Hls.isSupported()) {
        console.log("HLS is supported. Using Hls.js");
        hls = new Hls(); // Create a new Hls.js instance
        hls.loadSource(url); // Load the stream URL
        hls.attachMedia(player); // Attach the video element

        // Event listener for when the manifest is parsed (qualities are available)
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
            console.log("HLS Manifest parsed.");
            const qualityOptions = document.getElementById('qualityOptions');
            if (!qualityOptions) {
                console.warn("Element with ID 'qualityOptions' not found.");
                return;
            }

            qualityOptions.innerHTML = ''; // Clear previous quality options

            // Add the "Auto" quality option
            const autoBtn = document.createElement('span');
            autoBtn.className = 'quality-option active'; // 'active' by default
            autoBtn.textContent = 'Auto';
            autoBtn.onclick = () => {
                hls.currentLevel = -1; // -1 means auto quality selection
                updateQualityButtons(-1); // Update button styling
            };
            qualityOptions.appendChild(autoBtn);

            // Add options for each available quality level
            hls.levels.forEach((level, index) => {
                const height = level.height;
                let label = '';

                // Determine a label based on height
                if (height >= 8640) label = '16K';
                else if (height >= 4320) label = '8K';
                else if (height >= 2880) label = '5K';
                else if (height >= 2160) label = '4K';
                else if (height >= 1600) label = '1600p';
                else if (height >= 1440) label = '2K';
                else if (height >= 1280) label = '1280p';
                else if (height >= 1080) label = '1080p';
                else if (height >= 1024) label = '1024p';
                else if (height >= 720) label = '720p';
                else if (height >= 576) label = '576p';
                else if (height >= 480) label = '480p';
                else if (height >= 360) label = '360p';
                else if (height >= 240) label = '240p';
                else if (height >= 144) label = '144p';
                else if (height >= 120) label = '120p';
                else if (height >= 96) label = '96p';
                else label = 'undefined';

                const bitrate = Math.round(level.bitrate / 1000);
                const option = document.createElement('span');
                option.className = 'quality-option';
                option.textContent = `${label}`; // Display label
                option.title = `${height}p, ${bitrate} kbps`; // Tooltip with more info
                option.dataset.level = index; // Store the level index

                // Add click listener to switch quality
                option.onclick = () => {
                    hls.currentLevel = index; // Set the desired quality level
                    updateQualityButtons(index); // Update button styling
                };

                qualityOptions.appendChild(option); // Add option to the display area
            });

            // Helper function to update the 'active' class on quality buttons
            function updateQualityButtons(activeLevel) {
                document.querySelectorAll('.quality-option').forEach(el => {
                    // Check if the element's data-level matches the active level,
                    // or if activeLevel is -1 (Auto) and the element has no data-level
                    el.classList.toggle('active', el.dataset.level == activeLevel || (activeLevel === -1 && !el.dataset.level));
                });
            }


         // 2. Aggiorna visualizzazione qualità corrente
hls.on(Hls.Events.LEVEL_SWITCHED, function (event, data) {
  const level = hls.levels[data.level];
  const qualityInfo = document.getElementById('qualityInfo');

  if (!level) {
    qualityInfo.textContent = 'Quality: Auto';
    qualityInfo.style.color = '#aaa';
    return;
  }

  const height = level.height;
  let label = '';
  let color = '';

  if (height >= 8640) {
  label = '16K Experimental'; color = '#FF44CC'; // Ultra futuristica
} else if (height >= 4320) {
  label = '8K Ultra HD'; color = '#A144FF';
} else if (height >= 2880) {
  label = '5K UltraWide'; color = '#A166FF'; // iMac 27" etc.
} else if (height >= 2160) {
  label = '4K Ultra HD'; color = '#A144FF';
} else if (height >= 1600) {
  label = 'WQXGA+ 1600p'; color = '#33FFC1'; // Monitor alti
} else if (height >= 1440) {
  label = '2K QHD'; color = '#00FFC3';
} else if (height >= 1280) {
  label = 'HD+ 1280p'; color = '#33FFDD'; // Stream HD migliorato
} else if (height >= 1080) {
  label = 'Full HD'; color = '#00FFCC';
} else if (height >= 1024) {
  label = 'XGA+ 1024p'; color = '#66FFCC'; // Qualità media alta
} else if (height >= 720) {
  label = 'HD Ready'; color = '#5AC8FA';
} else if (height >= 576) {
  label = 'PAL SD 576p'; color = '#f7ce3c'; // Standard europeo
} else if (height >= 480) {
  label = 'SD 480p'; color = '#FADA5A';
} else if (height >= 360) {
  label = 'SD 360p'; color = '#FAAC5A';
} else if (height >= 240) {
  label = 'Low 240p'; color = '#D87B7B';
} else if (height >= 144) {
  label = 'Very Low 144p'; color = '#E05252';
} else if (height >= 120) {
  label = 'Low 120p'; color = '#B0413E';
} else if (height >= 96) {
  label = 'Retro 96p'; color = '#964B00';
} else {
  label = 'undefined'; color = '#C0392B'; // Meme mode
}



  const bitrate = Math.round(level.bitrate / 1000);
  qualityInfo.innerHTML = `<p><i class="fa-duotone fa-solid fa-signal-stream"></i> ${label}</p> `;
  qualityInfo.style.color = color;

});





            // Start playback once the manifest is parsed
            player.play();
            if (statusMsg) statusMsg.textContent = ''; // Clear loading message

            // Highlight the channel that is actually starting
            document.querySelectorAll('.channel').forEach(c => c.classList.remove('selected'));
            const selectedChannel = document.querySelector(`.channel[data-url="${url}"]`);
            if (selectedChannel) {
                selectedChannel.classList.add('selected');

                // Update title and favicon ONLY if the channel starts successfully
                const name = selectedChannel.dataset.display;
                const logo = selectedChannel.dataset.logo;


                // Find the currently selected quality or auto
                const currentQualityElement = document.getElementById('qualityInfo')?.querySelector('p');
                // Extract only the relevant part (e.g., "1080p", "Auto")
                const currentQualityText = currentQualityElement ? currentQualityElement.textContent.replace(/.*?(\d+K|\d+p|Auto).*$/, '$1').trim() : '';


                document.title = `${name}${currentQualityText ? ' - ' + currentQualityText : ''}`; // Include quality in the title if available


                const favicon = document.getElementById('dynamic-favicon');
                if (favicon) {
                    favicon.href = logo && logo.trim() !== ''
                        ? logo
                        : '../img/logo.png'; // Fallback favicon
                }

            }
        });


   



     hls.on(Hls.Events.ERROR, function (event, data) {
  if (data.fatal) {
  
    // Rimuove l'elemento dalla sidebar
    const failedChannel = document.querySelector(`.channel[data-url="${url}"]`);
    if (failedChannel) {
  failedChannel.classList.add('channel-error');
  failedChannel.style.opacity = 0.3;
  failedChannel.style.pointerEvents = 'none'; // lo disattiva senza eliminarlo
}

    // Mostra messaggio e passa al prossimo
    statusMsg.innerHTML = `<span> loading</span>` ;

    const visible = Array.from(document.querySelectorAll('.channel')).filter(el => el.style.display !== 'none');
    const i = visible.findIndex(el => el.dataset.url === url);
    const next = visible[i + 1];
    if (next) {
      updateChannelTitle(next.dataset.display, next.dataset.logo);
      playStream(next.dataset.url);
    } else {
      statusMsg.textContent = "No other channel available.";
    }
  }
});

    } else if (player && player.canPlayType('application/vnd.apple.mpegurl')) {
        // If HLS.js is not supported, try native HLS playback (Safari on iOS/macOS)
        console.log("HLS.js not supported, trying native HLS playback.");
        player.src = url; // Set the stream URL
        player.play(); // Start playback
        if (statusMsg) statusMsg.textContent = ''; // Clear loading message
        // For non-HLS.js channels, update title and favicon here
        const selectedChannel = document.querySelector(`.channel[data-url="${url}"]`);
        if (selectedChannel) {
            const name = selectedChannel.dataset.display;
            const logo = selectedChannel.dataset.logo;
            document.title = `${name} - Player`; // Update page title (without quality info)
            const favicon = document.getElementById('dynamic-favicon');
            if (favicon) {
                favicon.href = logo && logo.trim() !== ''
                    ? logo
                    : '../img/logo.png'; // Fallback favicon
            }
        }

    } else {
        // If neither HLS.js nor native HLS is supported
        if (statusMsg) statusMsg.textContent = "Your browser does not support HLS.";
        console.error("Your browser does not support HLS.");
    }
}

function updateChannelTitle(name, logo) {
    channelTitle.innerHTML = `
      <img src="${logo}" alt="" ><p> ${name}<p/>
      `;
      // Carica l'EPG per il canale attuale
  loadEPG(name); // <-- Passa il nome del canale
 }


// Function to create a channel list item element for the sidebar
function createChannelElement(name, logo, url) {
    const div = document.createElement('div');
    div.className = 'channel'; // Apply 'channel' class for styling
    div.dataset.url = url; // Store channel URL
    div.dataset.name = name.toLowerCase(); // Store lowercase name for searching
    div.dataset.display = name; // Store original name for display
    div.dataset.logo = logo; // Store logo URL

    const img = document.createElement('img');
    img.src = logo && logo.trim() !== '' ? logo : '../img/logo.png'; // Use ../img/logo.png as fallback
    img.alt = name;
    img.className = 'channel-logo'; // Apply 'channel-logo' class

    const nameSpan = document.createElement('span');
    nameSpan.textContent = name;
    nameSpan.className = 'channel-name'; // Apply 'channel-name' class

    div.appendChild(img); // Add logo to the div
    div.appendChild(nameSpan); // Add name to the div

    // Add click event listener to play the channel when clicked
    div.addEventListener('click', () => {
        // Remove 'selected' class from all channels
        document.querySelectorAll('.channel').forEach(c => c.classList.remove('selected'));

        // Add 'selected' class only to the clicked channel
        div.classList.add('selected');

        // Show loading message
        if (statusMsg) { // Safety check
            statusMsg.innerHTML = `<span>loading</span`;
        } else {
            console.warn("Element with ID 'statusMsg' not found.");
        }

        playStream(url); // Play the stream
        updateChannelTitle(name, logo); // Update the channel title area
    });

    // Add the created channel element to the channel list
    if (channelList) { // Safety check
        channelList.appendChild(div);
    } else {
        console.warn("Element with ID 'channelList' not found. Cannot append channel.");
    }
}






// Function to get the country code from a group name (for flags)
function getCountryCode(groupName) {
    // Mapping of common group names to ISO 3166-1 alpha-2 country codes
    // This map is quite extensive, ensure it's accurate for your needs.
    const map = {
        "afghanistan": "af", "albania": "al", "algeria": "dz", "american_samoa": "as", "andorra": "ad", "angola": "ao", "anguilla": "ai", "antarctica": "aq", "antigua_barbuda": "ag", "argentina": "ar", "armenia": "am", "aruba": "aw", "australia": "au", "austria": "at", "azerbaijan": "az", "bahamas": "bs", "bahrain": "bh", "bangladesh": "bd", "barbados": "bb", "belarus": "by", "belgium": "be", "belize": "bz", "benin": "bj", "bermuda": "bm", "bhutan": "bt", "bolivia": "bo", "bonaire_sint": "bq", "bosnia": "ba", "botswana": "bw", "bouvet_island": "bv", "brazil": "br", "british_indian_oc": "io", "brunei_darussalam": "bn", "bulgaria": "bg", "burkina_faso": "bf", "burundi": "bi", "cabo_verde": "cv", "cambodia": "kh", "cameroon": "cm", "canada": "ca", "cayman_islands": "ky", "cnt_african_rep": "cf", "chad": "td", "chile": "cl", "china": "cn", "christmas_island": "cx", "cocos_islands": "cc", "colombia": "co", "comoros": "km", "congo": "cg", "congo_the": "cd", "cook_islands": "ck", "costa_rica": "cr", "croatia": "hr", "cuba": "cu", "curaçao": "cw", "cyprus": "cy", "czechia": "cz", "côte_d'ivoire": "ci", "denmark": "dk", "djibouti": "dj", "dominica": "dm", "dominican_rep": "do", "ecuador": "ec", "egypt": "eg", "el_salvador": "sv", "equatorial_guinea": "gq", "eritrea": "er", "estonia": "ee", "eswatini": "sz", "ethiopia": "et", "falkland_islands": "fk", "faroe_islands": "fo", "fiji": "fj", "finland": "fi", "france": "fr", "french_guiana": "gf", "french_polynesia": "pf", "french_st": "tf", "gabon": "ga", "gambia": "gm", "georgia": "ge", "germany": "de", "ghana": "gh", "gibraltar": "gi", "greece": "gr", "greenland": "gl", "grenada": "gd", "guadeloupe": "gp", "guam": "gu", "guatemala": "gt", "guernsey": "gg", "guinea": "gn", "guinea-bissau": "gw", "guyana": "gy", "haiti": "ht", "heard_island": "hm", "honduras": "hn", "hong_kong": "hk", "hungary": "hu", "iceland": "is", "india": "in", "indonesia": "id", "iran": "ir", "iraq": "iq", "ireland": "ie", "isle_of_man": "im", "israel": "il", "italy": "it", "ivory_coast": "ci", "jamaica": "jm", "japan": "jp", "jersey": "je", "jordan": "jo", "kazakhstan": "kz", "kenya": "ke", "kiribati": "ki", "korea": "kr", "kuwait": "kw", "kyrgyzstan": "kg", "laos": "la", "latvia": "lv", "lebanon": "lb", "lesotho": "ls", "liberia": "lr", "libya": "ly", "liechtenstein": "li", "lithuania": "lt", "luxembourg": "lu", "macau": "mo", "madagascar": "mg", "malawi": "mw", "malaysia": "my", "maldives": "mv", "mali": "ml", "malta": "mt", "marshall_islands": "mh", "martinique": "mq", "mauritania": "mr", "mauritius": "mu", "mayotte": "yt", "mexico": "mx", "micronesia": "fm", "moldova": "md", "monaco": "mc", "mongolia": "mn", "montenegro": "me", "montserrat": "ms", "morocco": "ma", "mozambique": "mz", "myanmar": "mm", "namibia": "na", "nauru": "nr", "nepal": "np", "netherlands": "nl", "new_caledonia": "nc", "new_zealand": "nz", "nicaragua": "ni", "niger": "ne", "nigeria": "ng", "niue": "nu", "norfolk_island": "nf", "north_korea": "kp", "north_macedonia": "mk", "mariana_islands": "mp", "norway": "no", "oman": "om", "pakistan": "pk", "palau": "pw", "palestine": "ps", "panama": "pa", "papua_new_guinea": "pg", "paraguay": "py", "peru": "pe", "philippines": "ph", "pitcairn": "pn", "poland": "pl", "portugal": "pt", "puerto_rico": "pr", "qatar": "qa", "romania": "ro", "russia": "ru", "rwanda": "rw", "réunion": "re", "saint_barthélemy": "bl", "saint_helena": "sh", "saint_kitts": "kn", "saint_lucia": "lc", "saint_martin": "mf", "saint_pierre": "pm", "saint_vincent": "vc", "samoa": "ws", "san_marino": "sm", "sao_tome": "st", "saudi_arabia": "sa", "senegal": "sn", "serbia": "rs", "seychelles": "sc", "sierra_leone": "sl", "singapore": "sg", "sint_maarten": "sx", "slovakia": "sk", "slovenia": "si", "solomon_islands": "sb", "somalia": "so", "south_africa": "za", "south_georgia": "gs", "south_sudan": "ss", "spain": "es", "srilanka": "lk", "sudan": "sd", "suriname": "sr", "svalbard": "sj", "sweden": "se", "switzerland": "ch", "syria": "sy", "taiwan": "tw", "tajikistan": "tj", "tanzania_united": "tz", "thailand": "th", "timor-leste": "tl", "togo": "tg", "tokelau": "tk", "tonga": "to", "trinidad": "tt", "tunisia": "tn", "turkey": "tr", "turkmenistan": "tm", "turks_islands": "tc", "tuvalu": "tv", "uganda": "ug", "ukraine": "ua", "emirates": "ae", "uk": "gb", "usa": "us", "usa_isl": "um", "uruguay": "uy", "uzbekistan": "uz", "vanuatu": "vu", "vatican": "va", "venezuela": "ve", "vietnam": "vn", "virgin_isl_british": "vg", "virgin_isl_u.s.": "vi", "wallis_and_futuna": "wf", "western_sahara": "eh", "yemen": "ye", "zambia": "zm", "zimbabwe": "zw", "åland_islands": "ax",
    };
    const key = groupName.toLowerCase().trim(); // Convert group name to lowercase and trim
    return map[key] || key; // Return the corresponding country code or the lowercase group name itself
}


// Function to create a country flag element in the country selector
function createCountryFlag(country) {
    const code = getCountryCode(country); // Get the country code
    const wrapper = document.createElement('div');
    wrapper.className = 'flag-wrapper'; // Apply 'flag-wrapper' class

    const flag = document.createElement('img');
    flag.className = 'flag'; // Apply 'flag' class
    flag.src = `https://hatscripts.github.io/circle-flags/flags/${code}.svg`; // Set flag image source
    flag.onerror = () => {
        // Fallback image if the specific flag is not found
        flag.src = '../img/folder.png'; // Generic placeholder flag https://hatscripts.github.io/circle-flags/flags/xx.svg
    };
    flag.title = country; // Set tooltip text to the country name
    flag.dataset.country = country; // Store country name in a data attribute

    const count = allChannels[country]?.length || 0; // Get the number of channels for this country
    const label = document.createElement('div');
    label.className = 'flag-label'; // Apply 'flag-label' class
    label.textContent = `${country} (${count})`; // Display country name and channel count

    wrapper.appendChild(flag); // Add flag image to the wrapper
    wrapper.appendChild(label); // Add label to the wrapper

    // Add click event listener to load channels for this country
    wrapper.addEventListener('click', () => {
        // Remove 'selected' class from all flag wrappers
        document.querySelectorAll('.flag-wrapper').forEach(w => w.classList.remove('selected'));
        wrapper.classList.add('selected'); // Add 'selected' class to the clicked wrapper
        loadCountry(country); // Load channels for the selected country
    });

    // Add the created flag wrapper to the country selector area
    if (countrySelector) { // Safety check
        countrySelector.appendChild(wrapper);
    } else {
        console.warn("Element with ID 'countrySelector' not found. Cannot append country flag.");
    }
}

function loadCountry(group) {
    currentGroup = group; // Set the current group

    if (!channelList) {
        console.warn("Element with ID 'channelList' not found.");
        return;
    }

    channelList.innerHTML = ''; // Clear current list
    const channels = allChannels[group] || [];

    if (channels.length === 0) {
        channelList.innerHTML = '<p style="text-align:center; margin-top: 20px;">No channels available for this group.</p>';
        updateChannelTitle('No Channel Selected', '../img/logo.png');
        if (hls) hls.destroy();
        setFallbackPlayerImage();
        if (statusMsg) statusMsg.textContent = '';
        setTimeout(() => checkChannelListEmpty(group), 50); // ✅ FIX anche qui
        return;
    }

    channels.forEach(ch => createChannelElement(ch.name, ch.logo, ch.url));

    if (channels[0]) {
        requestAnimationFrame(() => {
            const firstChannelElement = document.querySelector(`.channel[data-url="${channels[0].url}"]`);
            if (firstChannelElement) {
                firstChannelElement.click();
            } else {
                console.warn("First channel element not found after rendering list.");
            }
        });
    }

    // ✅ Aggiunto qui alla fine: assicura che venga eseguito *dopo* la creazione DOM
    setTimeout(() => checkChannelListEmpty(group), 50);
}


// --- Event Listeners ---

// Event listener for local file input change
if (localM3uFile) {
    localM3uFile.addEventListener('change', function (event) {
        const file = event.target.files[0]; // Get the selected file
        if (file) {
            // Display the selected file name
            if (localFileNameDisplay) {
                localFileNameDisplay.textContent = `Selected: ${file.name}`;
            } else {
                console.warn("Element with ID 'localFileNameDisplay' not found.");
            }

            const reader = new FileReader(); // Create a FileReader to read the file
            reader.onload = function (e) {
                // When the file is read, parse its content
                loadM3uFromText(e.target.result);
                checkChannelListEmpty(file.name);
                addLoadedPlaylistName(file.name);
                
                // Clear the file input so the same file can be selected again
                event.target.value = '';
            };
            reader.readAsText(file); // Read the file as text
        } else {
            // Clear the display if no file is selected
            if (localFileNameDisplay) {
                localFileNameDisplay.textContent = '';
            }
        }
    });
} else {
    console.warn("Element with ID 'localM3uFile' not found.");
}

// Event listener for remote URL load button click
if (loadRemoteM3uButton && remoteM3uUrlInput) {
    loadRemoteM3uButton.addEventListener('click', async () => {
        const url = remoteM3uUrlInput.value.trim(); // Get the URL from the input, remove whitespace
        if (url) {
            if (statusMsg) statusMsg.textContent = 'Loading remote playlist...'; // Show loading message
            try {
                const res = await fetch(url);
                if (!res.ok) {
                    console.warn(`HTTP error loading remote list ${url}: ${res.status}`);
                    if (statusMsg) statusMsg.textContent = `Error loading playlist: ${res.status}`;
                    // Add error feedback to the loaded playlists display
                    addLoadedPlaylistName(`${url} (Error: ${res.status})`);
                    return; // Stop if there's an HTTP error
                }
                const text = await res.text();
                loadM3uFromText(text); // Parse and load the text content
                remoteM3uUrlInput.value = ''; // Clear the input field
                // Add the URL to the loaded playlists display
                addLoadedPlaylistName(url);
                checkChannelListEmpty(url);

            } catch (err) {
                console.error(`Error fetching remote list ${url}:`, err);
                if (statusMsg) statusMsg.textContent = 'Error loading playlist.';
                // Add error feedback to the loaded playlists display
                addLoadedPlaylistName(`${url} (Fetch Error)`);
            }
        } else {
            alert("Please enter a valid M3U/M3U8 URL.");
        }
    });
} else {
    console.warn("Elements 'loadRemoteM3uButton' or 'remoteM3uUrlInput' not found.");
}

// Event listener for the Clear Saved List button
// Assumes an HTML element with id="clearListButton" exists.
if (clearListButton) {
    clearListButton.addEventListener('click', () => {
        // Ask for confirmation before clearing
        if (confirm("Sei sicuro di voler svuotare la lista salvata nel browser? Questa azione non può essere annullata.")) {
            clearSavedChannels(); // Remove data from localStorage
            allChannels = {}; // Reset the in-memory channel data
            updateCountryFlags(); // Update flags (will show none)
            updateTotalChannelsCount(); // Update total count (will show 0)
            loadCountry(null); // Clear the channel list display and player
             if (loadedPlaylistsDisplay) {
                loadedPlaylistsDisplay.innerHTML = '<p>Loaded Playlists:</p>'; // Clear loaded playlists display
            }
            if (statusMsg) statusMsg.textContent = "Saved list cleared."; // Update status message
            updateChannelTitle('No Channel Selected', '../img/logo.png'); // Reset channel title area
            document.title = "Player"; // Reset page title
            const favicon = document.getElementById('dynamic-favicon');
            if (favicon) favicon.href = '../img/logo.png'; // Reset favicon
        }
    });
} else {
    console.warn("Element with ID 'clearListButton' not found. Clear functionality disabled.");
}


function checkChannelListEmpty(name = 'Last Playlist') {
    if (!channelList || !listMessage) {
        console.warn("channelList o listMessage non trovati.");
        return;
    }

    const MAX_LENGTH = 100;

    if (channelList.children.length === 0) {
        listMessage.innerHTML = `Please load a list M3U`;
    } else {
        const icon = ``;
        const trimmedName = name.length > MAX_LENGTH
            ? name.slice(-MAX_LENGTH) // ultime 60 lettere
            : name;
        listMessage.innerHTML = `${icon} ${trimmedName}`;
    }
}




// --- Initial Load ---
// Wait for the DOM to be fully loaded before starting
document.addEventListener('DOMContentLoaded', () => {
    // Load playlists (this function now handles loading from localStorage first)
    loadAllPlaylists(m3uUrls);

    const savedPlaylists = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PLAYLISTS_KEY) || '[]');
savedPlaylists.forEach(name => addLoadedPlaylistName(name));


   
    if (searchBox) {
        searchBox.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const channels = document.querySelectorAll('.channel');
            channels.forEach(channel => {
                const channelName = channel.dataset.name;
                if (channelName.includes(searchTerm)) {
                    channel.style.display = 'flex'; // Or block, depending on your CSS
                } else {
                    channel.style.display = 'none';
                }
            });
                checkChannelListEmpty();
        });
    }
        checkChannelListEmpty();
});

(function () {
  const consoleElement = document.getElementById('console');
  if (!consoleElement) return;

  function appendToConsole(type, message) {
    const p = document.createElement('p');
    p.className = `log-${type}`;
    p.textContent = `[${type.toUpperCase()}] ${message}`;
    consoleElement.appendChild(p);
    consoleElement.scrollTop = consoleElement.scrollHeight; // scroll automatico
  }

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = function (...args) {
    originalLog.apply(console, args);
    appendToConsole('log', args.join(' '));
  };

  console.warn = function (...args) {
    originalWarn.apply(console, args);
    appendToConsole('warn', args.join(' '));
  };

  console.error = function (...args) {
    originalError.apply(console, args);
    appendToConsole('error', args.join(' '));
  };
})();



// Number animation from 0 to target (maintained)
function animateNumber(id, target) {
const el = document.getElementById(id);
if (!el) return;

let start = 0;
const duration = 1000; // Animation duration in milliseconds
const startTime = performance.now(); // Get the current time

// Function to update the number on each animation frame
function step(currentTime) {
const elapsed = currentTime - startTime; // Time elapsed since start
const progress = Math.min(elapsed / duration, 1); // Animation progress (0 to 1)
const value = Math.floor(progress * target); // Calculate the current value

el.innerText = value; // Update the element's text

// Continue animation if not finished
if (progress < 1) {
requestAnimationFrame(step);
}
}

// Start the animation loop
requestAnimationFrame(step);
}


// 🚀 Initial loading of stats (maintained here for consistency with your snippet)
// Note: Calling updateStatsInfo() here and in DOMContentLoaded shouldn't cause issues,
// but the call in DOMContentLoaded is safer if stats depend on HTML elements being ready.
updateStatsInfo();


// 🔥 Update stats every 5 minutes (maintained)
setInterval(() => {
updateStatsInfo();
}, 300000); // 300000 milliseconds = 5 minutes






