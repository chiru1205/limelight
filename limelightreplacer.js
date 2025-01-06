// Akamai Video Player Replacer with HLS.js and MutationObserver Fix
(function () {
    const config = {
        selectors: {
            playerContainer: '.limelight-player',
            appVideo: 'app-video', // Starting point for DOM traversal
            playerWrapper: '.video-player-wrap', // Wrapper for the video player
            videoElement: 'video' // Video element            
        },
        debug: true,
        apiEndpoint: 'https://localhost:5000/api/get-video-url',
        hlsLibraryUrl: 'https://cdn.jsdelivr.net/npm/hls.js@latest'
    };
    const log = (...args) => {
        if (config.debug) {
            console.log('[HLS Replacer]:', ...args);
        }
    };
    async function loadHlsLibrary() {
        return new Promise((resolve, reject) => {
            if (window.Hls) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = config.hlsLibraryUrl;
            script.onload = resolve;
            script.onerror = () => reject('Failed to load HLS.js');
            document.head.appendChild(script);
        });
    }
    async function fetchVideoData(mediaId) {
        try {
            const url = `${config.apiEndpoint}?mediaId=${encodeURIComponent(mediaId)}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`API response status: ${response.status}`);
            }
            const data = await response.json();
            log('Video data fetched:', data);
            return data;
        } catch (error) {
            log('Error fetching video data:', error);
            return null;
        }
    }
    async function replaceAppVideoNode(appVideoElement) {
        if (appVideoElement.hasAttribute('data-processed')) {
            return; // Skip already processed nodes
        }
        const videoElement = appVideoElement.querySelector(config.selectors.videoElement);
        if (!videoElement) {
            log('No video element found in app-video node');
            return;
        }
        const videoId = videoElement.id.match(/video_([a-zA-Z0-9-]+)_video_/)?.[1];
        if (!videoId) {
            log('No valid video ID found');
            return;
        }
        const videoData = await fetchVideoData(videoId);
        if (!videoData) {
            appVideoElement.innerHTML = '<div style="color: red;">Error: Failed to fetch video data</div>';
            return;
        }
        const { manifestUrl, posterUrl } = videoData;
        await loadHlsLibrary();
        const hlsPlayer = document.createElement('video');
        hlsPlayer.style.cssText = `width: 100%; height: 411px;`;
        hlsPlayer.controls = true;
        hlsPlayer.autoplay = true;
        hlsPlayer.poster = posterUrl || '';
        appVideoElement.innerHTML = ''; // Clear content
        appVideoElement.appendChild(hlsPlayer);
        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(manifestUrl);
            hls.attachMedia(hlsPlayer);
            log('HLS.js initialized for video ID:', videoId);
        } else if (hlsPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            hlsPlayer.src = manifestUrl;
            log('Native HLS support used for video ID:', videoId);
        } else {
            log('HLS is not supported on this browser');
            appVideoElement.innerHTML = '<div style="color: red;">HLS is not supported on this browser</div>';
        }
        // Mark this node as processed
        appVideoElement.setAttribute('data-processed', 'true');
    }
    function processAppVideos() {
        const appVideoElements = document.querySelectorAll(config.selectors.appVideo);
        appVideoElements.forEach(async (appVideoElement) => {
            await replaceAppVideoNode(appVideoElement);
        });
    }
    document.addEventListener('DOMContentLoaded', async () => {
        await loadHlsLibrary();
        processAppVideos();
        log('Initial processing complete');
    });
    const observer = new MutationObserver(async (mutations) => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach(async (node) => {
                if (node.nodeType === Node.ELEMENT_NODE && node.matches(config.selectors.appVideo)) {
                    await replaceAppVideoNode(node);
                }
            });
        }
        log('Reprocessing videos on DOM change');
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
 })();
