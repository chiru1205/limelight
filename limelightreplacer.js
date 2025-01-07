// Akamai Video Player Replacer with HLS.js and MutationObserver Fix
(function () {
    const config = {
        selectors: {
            playerContainer: '.limelight-player',
            appVideo: 'app-video', // Starting point for DOM traversal
            playerWrapper: '.video-player-wrap', // Wrapper for the video player
            videoElement: 'video', // Video element
            idPrefix: '[id^="c_"]',
            playerIdPrefix: '[player_id^="video_"]',
            dataVideoOrMedia: '[data-video-id], [data-media-id]', // Data attributes for media ID           
        },
        debug: true,
        jsonConfigUrl: 'https://chiru1205.github.io/limelight/akamaitest.json',
        hlsLibraryUrl: 'https://cdn.jsdelivr.net/npm/hls.js@latest',
        jsonLoaded : false,
        jsonConfig : null //cached JSON Configuration
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

    async function loadJsonConfig() {
        if(config.jsonLoaded){
            log('JSON Configuration already loaded');
            return config.jsonConfig
        }
        try {
            const response = await fetch(config.jsonConfigUrl);
            if (!response.ok) {
                throw new Error(`Failed to load JSON configuration: ${response.status}`);
            }
            const data = await response.json();
            config.jsonLoaded = true;
            config.jsonConfig = data;
            log('JSON configuration loaded:', data);
            return data;
        } catch (error) {
            log('Error loading JSON configuration:', error);
            return null;
        }
    }

    function extractVideoId(element, jsonConfig) {
        const methods = [
            (el) => el.closest(config.selectors.idPrefix)?.id.replace('c_', ''),
            (el) => el.closest(config.selectors.playerIdPrefix)?.getAttribute('player_id')?.replace('video_', ''),
            (el) => el.querySelector(config.selectors.videoElement)?.id?.split('_')?.[1],
            (el) => el.closest(config.selectors.dataVideoOrMedia)?.getAttribute('data-video-id') ||
                    el.closest(config.selectors.dataVideoOrMedia)?.getAttribute('data-media-id'),
        ];
        for (const method of methods) {
            const id = method(element);
            if (id && jsonConfig[id]) {
                log('Found video ID:', id);
                return id;
            }
        }
        log('No valid video ID found');
        return null;
    }
    async function replaceAppVideoNode(appVideoElement, jsonConfig) {
        if (appVideoElement.hasAttribute('data-processed')) {
            return; // Skip already processed nodes
        }
        const videoElement = appVideoElement.querySelector(config.selectors.videoElement);
        if (!videoElement) {
            log('No video element found in app-video node');
            return;
        }
        const videoId = extractVideoId(appVideoElement, jsonConfig);
        if (!videoId) {
            appVideoElement.innerHTML = '<div style="color: red;">Error: Video data not found</div>';
            return;
        }
        const videoData = jsonConfig[videoId];
        const { manifestUrl, posterUrl, captions} = videoData;
        await loadHlsLibrary();
        const hlsPlayer = document.createElement('video');
        hlsPlayer.style.cssText = `width: 100%; height: 411px;`;
        hlsPlayer.controls = true;
        hlsPlayer.autoplay = true;
        hlsPlayer.poster = posterUrl || '';
      
        // Add captions dynamically
       if (captions && captions.length) {
        captions.forEach(({ url, language, label }) => {
            if(url && url.length){
                const trackElement = document.createElement('track');
                trackElement.src = url;
                trackElement.kind = 'subtitles';
                trackElement.srclang = language;
                trackElement.label = label;
                hlsPlayer.appendChild(trackElement);
            }           
        });
        }
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
    function processAppVideos(jsonConfig) {
        const appVideoElements = document.querySelectorAll(config.selectors.appVideo);
        appVideoElements.forEach(async (appVideoElement) => {
            await replaceAppVideoNode(appVideoElement,jsonConfig);
        });
    }
    document.addEventListener('DOMContentLoaded', async () => {
        await loadHlsLibrary();
        const jsonConfig = await loadJsonConfig();
       if (!jsonConfig) {
           log('Failed to load JSON configuration. Exiting.');
           return;
       }
       processAppVideos(jsonConfig);
       log('Initial processing complete');
    });
    const observer = new MutationObserver(async (mutations) => {
        const jsonConfig = config.jsonConfig || await loadJsonConfig();
        if (!jsonConfig) {
            log('Failed to load JSON configuration during DOM change. Skipping.');
            return;
        }
        for (const mutation of mutations) {
            mutation.addedNodes.forEach(async (node) => {
                if (node.nodeType === Node.ELEMENT_NODE && node.matches(config.selectors.appVideo)) {
                    await replaceAppVideoNode(node,jsonConfig);
                }
            });
        }
        log('Reprocessing videos on DOM change');
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
 })();
