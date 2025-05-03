const serverUrl = "https://render-com-a2ck.onrender.com"; // Your server on Render

function formatNumber(num) {
 if (num >= 1_000_000) {
 return (num / 1_000_000).toFixed(1).replace('.0', '') + 'M';
 } else if (num >= 1_000) {
 return (num / 1_000).toFixed(1).replace('.0', '') + 'K';
 } else {
 return num.toString();
 }
}

function animateCount(element, start, end, duration) {
 const baseColor = "#58a6ff";
 const updateColor = "#d7fa5a";
 let startTime = null;

 if (start !== end) {
 element.style.transition = "color 0.3s ease";
 element.style.color = updateColor;
 }

 function animate(timestamp) {
 if (!startTime) startTime = timestamp;
 const progress = Math.min((timestamp - startTime) / duration, 1);
 const current = Math.floor(start + (end - start) * progress);
 element.innerText = formatNumber(current);
 if (progress < 1) {
 requestAnimationFrame(animate);
 } else {
 element.style.color = baseColor;
 }
 }

 requestAnimationFrame(animate);
}

// WebSocket Connection
const socket = io(serverUrl);

socket.on('connect', () => {
 console.log('Connected to WebSocket server');
});

socket.on('disconnect', () => {
 console.log('Disconnected from WebSocket server');
});

// Update online users in real-time
socket.on('userUpdate', (data) => {
 const onlineElement = document.getElementById('online');
 const visitorsElement = document.getElementById('visitors');

 if (onlineElement && data.onlineUsers !== undefined) {
 const currentOnline = parseInt(onlineElement.innerText.replace(/\D/g, '')) || 0;
 animateCount(onlineElement, currentOnline, data.onlineUsers, 1000);
 }

 if (visitorsElement && data.uniqueVisitors !== undefined) {
 const currentVisitors = parseInt(visitorsElement.innerText.replace(/\D/g, '')) || 0;
 animateCount(visitorsElement, currentVisitors, data.uniqueVisitors, 1500);
 }
});

// Initial status load
function fetchStatus() {
 fetch(`${serverUrl}/status`)
 .then(response => response.json())
 .then(data => {
 const onlineElement = document.getElementById('online');
 const visitorsElement = document.getElementById('visitors');

 if (onlineElement && data.onlineUsers !== undefined) {
 const currentOnline = parseInt(onlineElement.innerText.replace(/\D/g, '')) || 0;
 animateCount(onlineElement, currentOnline, data.onlineUsers, 1000);
 }

 if (visitorsElement && data.uniqueVisitors !== undefined) {
 const currentVisitors = parseInt(visitorsElement.innerText.replace(/\D/g, '')) || 0;
 animateCount(visitorsElement, currentVisitors, data.uniqueVisitors, 1500);
 }


 })
 .catch(err => console.error("Error loading status:", err));

}

// Initial load after 2 seconds
setTimeout(fetchStatus, 2000);

// Update every 60 seconds
setInterval(fetchStatus, 60000);