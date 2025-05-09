// Normalize channel names
function normalizeEPGName(str) {
  return str
    .replace(/\.uk$/i, '') // Remove ".uk" at the end
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Insert spaces between lowercase and uppercase
    .replace(/([A-Za-z])(\d)/g, '$1 $2') // Insert spaces between letters and numbers
    .replace(/(\d)([A-Za-z])/g, '$1 $2') // Insert spaces between numbers and letters
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\[.*?\]|\(.*?\)/g, '') // Remove brackets
    // Special fixes for BBC and UK channels
    .replace(/\bbc\s*one\b/g, 'bbc1')
    .replace(/\bbc\s*two\b/g, 'bbc2')
    .replace(/\bbc\s*three\b/g, 'bbc3')
    .replace(/\bbc\s*four\b/g, 'bbc4')
    .replace(/\bbc\s*news\b/g, 'bbcnews')
    .replace(/\bbc\s*world\s*news\b/g, 'bbcworldnews')
    .replace(/\bbbc\s*one\s*london\b/g, 'bbc1') // BBC One London
    .replace(/\bbbc\s*one\s*north\b/g, 'bbc1') // BBC One North
    .replace(/\bbbc\s*one\s*south\b/g, 'bbc1') // BBC One South
    .replace(/\bbbc\s*one\s*(.*)/g, 'bbc1') // Other regional BBC One
    .replace(/\bbbc\s*two\s*(.*)/g, 'bbc2') // Other regional BBC Two
    .replace(/\bchannel\s*four\b/g, 'channel4')
    .replace(/\bitv\s*one\b/g, 'itv1')
    .replace(/\bitv\s*2\b/g, 'itv2')
    .replace(/\bitv\s*3\b/g, 'itv3')
    .replace(/\bitv\s*4\b/g, 'itv4')
    .replace(/\b(e4|film4|more4|4seven)\b/g, match => match.replace('4', ' 4'))
    // Remove unnecessary suffixes
    .replace(/\b(hd|fhd|sd|uhd|plus|extra|direct|premium|now|live|east|west|north|south|central)\b/g, '')
    // Italian fixes
    .replace(/(rete\s*4|retequattro)/g, 'rete4')
    .replace(/canale\s*5/g, 'canale5')
    .replace(/italia\s*1/g, 'italia1')
    .replace(/tv\s*8/g, 'tv8')
    .replace(/\bnove\b/g, '9')
    .replace(/[^a-z0-9]/g, '') // Only letters and numbers
    .trim();
}

// Load epg-name-map.json dictionary
let channelNameMap = {};
let currentEPGEndTime = null; // 

async function loadChannelNameMap() {
  try {
    const response = await fetch('https://raw.githubusercontent.com/jonalinuxdev/auto-epg-updater/refs/heads/main/epg/epg-name-map.json');
    if (!response.ok) throw new Error('HTTP error! Status: ' + response.status);
    channelNameMap = await response.json();
  } catch (error) {
    console.error('Error loading epg-name-map.json file:', error);
    channelNameMap = {}; 
  }
}

// Parse EPG dates
function parseEPGDate(str) {
  if (!str) return new Date(0);
  const match = str.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/);
  if (!match) return new Date(0);
  let dateStr = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || '00'}`;
  dateStr += match[7] ? match[7].replace(/(\d{2})(\d{2})/, '$1:$2') : 'Z';
  return new Date(dateStr);
}

// Format time as HH:MM
function formatHourMinutes(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// Load the EPG guide
async function loadEPG(channelName) {
  const container = document.getElementById('epg-container');
  container.innerHTML = '';
  const now = new Date();

  const normalizedChannelName = normalizeEPGName(channelName);
  const epgTargetName = channelNameMap[normalizedChannelName] || normalizedChannelName;

  let epgMap = {};
  try {
    const res = await fetch('https://raw.githubusercontent.com/jonalinuxdev/auto-epg-updater/refs/heads/main/epg/stable-epg-sources.json');
    if (!res.ok) throw new Error('Error fetching epg-sources');
    epgMap = await res.json();
  } catch (err) {
    console.error('EPG sources error:', err);
    container.innerHTML = ``;
    return;
  }

  const currentGroup = window.currentGroup || 'Italy';
  const primaryList = epgMap[currentGroup] || [];
  const fallbackList = Object.values(epgMap).flat().filter(url => !primaryList.includes(url));
  const guideFiles = [...primaryList, ...fallbackList];

  for (const guideFile of guideFiles) {
    try {
      const res = await fetch(guideFile);
      if (!res.ok) continue;
      const xml = new DOMParser().parseFromString(await res.text(), "application/xml");

      const programmes = Array.from(xml.querySelectorAll('programme')).filter(p => {
        const ch = normalizeEPGName(p.getAttribute('channel') || '');
        return ch === epgTargetName;
      });

      if (programmes.length === 0) continue;

      const nowProgram = programmes.find(p => {
        const start = parseEPGDate(p.getAttribute('start'));
        const stop = parseEPGDate(p.getAttribute('stop'));
        return now >= start && now <= stop;
      });

      const nextProgram = programmes.find(p => {
        const start = parseEPGDate(p.getAttribute('start'));
        return start > now;
      });

      let html = '';

 const epgStartEl = document.getElementById('epgStart');
const epgEndEl = document.getElementById('epgEnd');
const epgBar = document.getElementById('epgProgressBar');
const epgTitleEl = document.querySelector('.playername span');

if (nowProgram) {
  const start = parseEPGDate(nowProgram.getAttribute('start'));
  const stop = parseEPGDate(nowProgram.getAttribute('stop'));
  currentEPGEndTime = stop;

  const title = nowProgram.querySelector('title')?.textContent || 'No title';
  const progress = Math.min(100, ((now - start) / (stop - start)) * 100).toFixed(1);

  if (epgBar) epgBar.style.width = `${progress}%`;
  if (epgStartEl) epgStartEl.textContent = formatHourMinutes(start);
  if (epgEndEl) epgEndEl.textContent = formatHourMinutes(stop);
  if (epgTitleEl) epgTitleEl.textContent = title;

  html += `
    <div class="program" style="padding-left:10px;">
      <span class="cal-sans-regular" style="font-size:22px;">${channelName}</span> 
      <div style="display:flex; justify-content:space-between;">
        <div>
          <span style="font-size:14px; color:#f9c855;">
            <i class="fa-duotone fa-solid fa-timer"></i> ${formatHourMinutes(start)} 
            <span style="color:#fff;">${title}
              <a href="https://www.google.com/search?q=tv+guide+${encodeURIComponent(channelName)}" target="_blank" style="color:#f9c855; font-size:12px; text-decoration:none; margin-left:5px;">
                <i class="fa-duotone fa-solid fa-arrow-up-right-from-square fa-fade"></i>
              </a>    
            </span>
          </span>
        </div>
      </div>
      <div class="progress-bar">
        <div class="progress" style="width: ${progress}%"></div>
      </div>
    </div>`;
} else {
  currentEPGEndTime = null;

  if (epgBar) epgBar.style.width = '0%';
  if (epgStartEl) epgStartEl.textContent = '';
  if (epgEndEl) epgEndEl.textContent = '';
  if (epgTitleEl) epgTitleEl.textContent = '';
}




      if (nextProgram) {
        const start = parseEPGDate(nextProgram.getAttribute('start'));
        const title = nextProgram.querySelector('title')?.textContent || 'No title';
        html += `<div class="program" style="background:#1c2128; padding-top:0px; padding-left:10px;">
          <span style="color:#ff6cb8;">  Next ${formatHourMinutes(start)} <i class="fa-duotone fa-solid fa-chevrons-right"></i> </span> ${title} </div>`;
      }

      container.innerHTML = html || `<p>No program available.</p>`;
      try {
  const hostname = new URL(guideFile, window.location.origin).hostname;
  container.innerHTML += `<p style="font-size:0px;color:#888;">Source: ${hostname}</p>`;
} catch (e) {
  console.warn('Invalid URL for guideFile:', guideFile);
}

      return;

    } catch (err) {
      console.error(`Error parsing ${guideFile}:`, err);
    }
  }

  container.innerHTML = `<div style="text-align:center;"><i class="fa-duotone fa-solid fa-circle-info"></i> EPG not found for this channel.</div>`;
}

// Check every 60 seconds if the program has ended
setInterval(() => {
  const now = new Date();
  if (currentEPGEndTime && now > currentEPGEndTime) {
    console.log("Program ended. Reloading EPG...");

    const selectedChannel = document.querySelector('.channel.selected');
    if (selectedChannel) {
      const channelName = selectedChannel.dataset.display;
      if (channelName) {
        loadEPG(channelName); // Reload only the EPG
      }
    }
  }
}, 60000); // Every 60 seconds
