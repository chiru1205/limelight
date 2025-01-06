// Akamai Video Player Replacer with HLS.js and Limelight Embed Removal
(function () {
    const config = {
        selectors: {
            appVideo: 'app-video',
            playerWrapper: '.video-player-wrap', // Wrapper for the video player
            videoElement: 'video', // Video element selector
            limelightContainer: '[.limelight-player]', // Limelight-specific selector
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
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    function extractVideoId(element) {
        if (!element) return null;
        const idMatch = element.id && element.id.match(/video_([a-zA-Z0-9-]+)_video_/);
        return idMatch ? idMatch[1] : null;
    }
    async function fetchVideoData(mediaId) {
        try {
            const url = `${config.apiEndpoint}?mediaId=${encodeURIComponent(mediaId)}`;
            const response = await fetch(url, { method: 'GET' });
            if (!response.ok) {
                throw new Error(`API response status: ${response.status}`);
            }
            const data = await response.json();
            log('Video data fetched:', data);
            return {
                manifestUrl: data.manifestUrl,
                posterUrl: data.posterUrl,
                captionsUrl: data.captionsUrl
            };
        } catch (error) {
            log('Error fetching video data:', error);
            return null;
        }
    }
    async function replaceAppVideoNode(appVideoElement) {
        const videoId = extractVideoId(appVideoElement.querySelector(config.selectors.videoElement));
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
        hlsPlayer.id = `hls_${videoId}`;
        hlsPlayer.style.cssText = `width: ${appVideoElement.offsetWidth || '100%'}; height: 411px;`;
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
    }
    async function interceptLimelightEmbed() {
        const originalEmbed = window.LimelightPlayerUtil?.embed;
        window.LimelightPlayerUtil = window.LimelightPlayerUtil || {};
        window.LimelightPlayerUtil.embed = async function (params) {
            log('Intercepted Limelight embed call:', params);
            const { playerId, mediaId } = params;
            const targetElement = document.getElementById(playerId);
            if (!targetElement) {
                log('Target element not found:', playerId);
                return;
            }
            const videoData = await fetchVideoData(mediaId);
            if (!videoData) {
                targetElement.innerHTML = '<div style="color: red;">Error: Failed to fetch video data</div>';
                return;
            }
            const { manifestUrl, posterUrl } = videoData;
            await loadHlsLibrary();
            const hlsPlayer = document.createElement('video');
            hlsPlayer.id = `hls_${mediaId}`;
            hlsPlayer.style.cssText = `width: ${targetElement.offsetWidth || '100%'}; height: 411px;`;
            hlsPlayer.controls = true;
            hlsPlayer.autoplay = true;
            hlsPlayer.poster = posterUrl || '';
            targetElement.innerHTML = ''; // Clear content
            targetElement.appendChild(hlsPlayer);
            if (Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(manifestUrl);
                hls.attachMedia(hlsPlayer);
                log('HLS.js initialized for media ID:', mediaId);
            } else if (hlsPlayer.canPlayType('application/vnd.apple.mpegurl')) {
                hlsPlayer.src = manifestUrl;
                log('Native HLS support used for media ID:', mediaId);
            } else {
                log('HLS is not supported on this browser');
                targetElement.innerHTML = '<div style="color: red;">HLS is not supported on this browser</div>';
            }
        };
        log('Limelight embed interception enabled');
    }
    const observer = new MutationObserver(async (mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE && node.matches(config.selectors.appVideo)) {
                    await replaceAppVideoNode(node);
                }
            }
        }
    });
    document.addEventListener('DOMContentLoaded', async () => {
        await interceptLimelightEmbed();
        const appVideoElements = document.querySelectorAll(config.selectors.appVideo);
        for (const appVideoElement of appVideoElements) {
            await replaceAppVideoNode(appVideoElement);
        }
        log('Initial processing complete');
        observer.observe(document.documentElement, { childList: true, subtree: true });
        log('Mutation observer initialized');
    });
 })();