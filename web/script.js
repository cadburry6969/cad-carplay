let vehId = null;
let vehIdStr = null;
let songTotal = 0;
let isPaused = false;

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const mainContainer = document.getElementById('maincontainer');
    const songList = document.querySelector(".song-list");
    const playPauseBtn = document.getElementById('play-pause-btn');
    const closeBtn = document.getElementById('close-btn');
    const songForm = document.querySelector('.song-form');
    const songInput = document.querySelector('.song-input');
    const volumeBarBg = document.querySelector('.volume-bar-bg');
    const volumeBarFill = document.querySelector('.volume-bar-fill');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const playlistItems = document.getElementById('playlist-items');
    const shareCodeInput = document.getElementById('share-code-input');
    const importBtn = document.getElementById('import-playlist-btn');
    const createPlaylistBtn = document.getElementById('create-playlist-btn');
    const createPlaylistModal = document.getElementById('create-playlist-modal');
    const closeCreateModal = document.getElementById('close-create-modal');
    const newPlaylistName = document.getElementById('new-playlist-name');
    const newPlaylistFirstSong = document.getElementById('new-playlist-first-song');
    const confirmCreatePlaylist = document.getElementById('confirm-create-playlist');
    const progressBar = document.querySelector('.song-progress');
    const progressFill = document.querySelector('.song-progress-fill');
    const currentTimeEl = document.querySelector('.current-time');
    const songLengthEl = document.querySelector('.song-length');
    const songNameEl = document.getElementById("songname");
    const authorEl = document.getElementById("author");
    const musicThumbEl = document.getElementById('musicthumbanil');
    const atpModal = document.getElementById('add-to-playlist-modal');
    const closeAtpModal = document.getElementById('close-atp-modal');
    const atpSongLabel = document.getElementById('atp-song-label');
    const atpPlaylistList = document.getElementById('atp-playlist-list');
    let atpCurrentLink = null;
    let atpCurrentName = null;
    let cachedPlaylists = [];
    let currentPlayingLink = null;
    let currentPlayingName = null;

    // NUI Listeners
    window.addEventListener('message', (event) => {
        const item = event.data;
        
        if (item.event === "openCarPlay") {
            vehId = item.veh;
            vehIdStr = item.vehIdStr;
            
            updateQueue(item.queue);
            loadPlaylists();
            
            mainContainer.style.display = 'flex';
            mainContainer.classList.add('active');
            
        } else if (item.event === "playbackStarted") {
            updatePlaybackInfo(item.link);
            updateVolumeUI(item.vol);
            setPlayState(true);
            
        } else if (item.event === "updateTime") {
            if (songTotal !== item.time.totalDuration) {
                songTotal = item.time.totalDuration;
            }
            updateMusicProgress(item.time.currentTime, item.time.totalDuration);
            
        } else if (item.event === "resetPlayback") {
            resetPlaybackUI();
            
        } else if (item.event === "nextSong") {
            nextSong();
            
        } else if (item.event === "setPicPaused" || item.event === "pause") {
            setPlayState(false);
        } else if (item.event === "getPlaylists") {
            renderPlaylists(item.playlists, item.songs);
        } else if (item.event === "updateQueue") {
            updateQueue(item.queue);
        } else if (item.event === "playlistCreated") {
            // Close modal and reload playlists
            createPlaylistModal.style.display = 'none';
            newPlaylistName.value = '';
            newPlaylistFirstSong.value = '';
            confirmCreatePlaylist.disabled = false;
            confirmCreatePlaylist.innerHTML = '<i class="fas fa-check"></i> Create';
            loadPlaylists();
        }
    });

    // Close Logic
    const closeMenu = () => {
        mainContainer.classList.remove('active');
        setTimeout(() => {
            mainContainer.style.display = 'none';
            songList.innerHTML = '';
            $.post(`https://${GetParentResourceName()}/closeCarPlay`);
        }, 400);
    };

    closeBtn.addEventListener('click', closeMenu);
    
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Escape') closeMenu();
    });

    // Song Submission
    songForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const songLink = songInput.value;
        if (!songLink) return;

        $.getJSON('https://noembed.com/embed', {format: 'json', url: songLink}, (data) => {
            if (data.error) return;

            const fullTitle = `${data.title} by ${data.author_name}`;
            const queuePos = songList.children.length + 1;
            
            // Add to UI immediately for feedback
            addSongToQueueUI({ songName: data.title, author: data.author_name, link: songLink });

            $.post(`https://${GetParentResourceName()}/callback`, JSON.stringify({
                event: 'url',
                veh: vehId,
                vehStr: vehIdStr,
                link: songLink,
                queuePos: queuePos,
                songName: fullTitle
            }));
        });
        
        songInput.value = '';
    });

    // Direct Add to Playlist from Input
    const addPlaylistDirectBtn = document.getElementById('add-to-playlist-direct');
    addPlaylistDirectBtn.addEventListener('click', () => {
        const songLink = songInput.value;
        if (!songLink) return;

        $.getJSON('https://noembed.com/embed', {format: 'json', url: songLink}, (data) => {
            if (data.error) return;
            openAtpModal(songLink, data.title);
            songInput.value = '';
        });
    });

    // Tab Switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(target).classList.add('active');
            
            if (target === 'playlist-tab') {
                loadPlaylists();
            }
        });
    });

    // Import Playlist
    importBtn.addEventListener('click', () => {
        const code = shareCodeInput.value.trim();
        if (code) {
            $.post(`https://${GetParentResourceName()}/importPlaylist`, JSON.stringify({ code }), (res) => {
                shareCodeInput.value = '';
                loadPlaylists();
            });
        }
    });

    // Create Playlist — open modal
    createPlaylistBtn.addEventListener('click', () => {
        createPlaylistModal.style.display = 'flex';
        newPlaylistName.focus();
    });

    // Close create modal
    closeCreateModal.addEventListener('click', () => {
        createPlaylistModal.style.display = 'none';
        newPlaylistName.value = '';
        newPlaylistFirstSong.value = '';
    });

    // Confirm create playlist
    confirmCreatePlaylist.addEventListener('click', () => {
        const label = newPlaylistName.value.trim();
        if (!label) {
            newPlaylistName.style.borderColor = '#ff3b30';
            setTimeout(() => { newPlaylistName.style.borderColor = ''; }, 1200);
            return;
        }
        const firstSong = newPlaylistFirstSong.value.trim();
        confirmCreatePlaylist.disabled = true;
        confirmCreatePlaylist.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        $.post(`https://${GetParentResourceName()}/createPlaylist`, JSON.stringify({ label, firstSong }));
    });

    // Add Current Song to Playlist
    const addCurrentToPlaylistBtn = document.getElementById('add-current-to-playlist');
    addCurrentToPlaylistBtn.addEventListener('click', () => {
        if (!currentPlayingLink) return;
        openAtpModal(currentPlayingLink, currentPlayingName);
    });

    // Allow Enter key in playlist name field to confirm
    newPlaylistName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmCreatePlaylist.click();
    });

    // Play/Pause Toggle
    playPauseBtn.addEventListener('click', () => {
        if (isPaused) {
            $.post(`https://${GetParentResourceName()}/callback`, JSON.stringify({
                event: 'resume',
                vehStr: vehIdStr,
                veh: vehId,
            }));
            setPlayState(true);
        } else {
            $.post(`https://${GetParentResourceName()}/callback`, JSON.stringify({
                event: 'pause',
                vehStr: vehIdStr,
                veh: vehId,
            }));
            setPlayState(false);
        }
    });

    // Volume Control
    volumeBarBg.addEventListener('click', (e) => {
        const rect = volumeBarBg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const vol = Math.max(0, Math.min(100, (x / rect.width) * 100));
        updateVolumeUI(vol / 100);
        
        $.post(`https://${GetParentResourceName()}/callback`, JSON.stringify({
            event: 'setVolume',
            veh: vehId,
            vehStr: vehIdStr,
            vol: vol,
        }));
    });

    // Progress Bar Seeking
    progressBar.addEventListener('click', (e) => {
        if (songTotal <= 0) return;
        const rect = progressBar.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
        const newTime = (percent / 100) * songTotal;
        
        $.post(`https://${GetParentResourceName()}/callback`, JSON.stringify({
            event: 'selectTime',
            veh: vehId,
            vehStr: vehIdStr,
            newTime: newTime,
        }));
    });

    // Helper Functions
    function updateQueue(queue) {
        songList.innerHTML = '';
        if (queue && Array.isArray(queue)) {
            queue.forEach((item, index) => {
                addSongToQueueUI(item, index + 1);
            });
        }
    }

    function addSongToQueueUI(item, pos) {
        const li = document.createElement("li");
        let name = item.songName || "Unknown Song";
        li.innerHTML = `
            <i class="fas fa-music"></i>
            <span class="queue-song-name">${name}</span>
            <button class="add-to-playlist-btn" title="Add to playlist"><i class="fas fa-list-plus"></i></button>
        `;

        if (name === "Loading...") {
            $.getJSON('https://noembed.com/embed', {format: 'json', url: item.link}, (res) => {
                if (res.title) {
                    name = `${res.title} by ${res.author_name}`;
                    li.querySelector('.queue-song-name').textContent = name;
                    item.songName = name;
                }
            });
        }

        // Add-to-playlist button — stop propagation so it doesn't trigger song play
        li.querySelector('.add-to-playlist-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openAtpModal(item.link, name);
        });

        li.addEventListener("click", () => {
            $.post(`https://${GetParentResourceName()}/callback`, JSON.stringify({
                event: 'breakLoop',
                vehStr: vehIdStr,
                veh: vehId,
            }));
            
            setTimeout(() => {
                $.post(`https://${GetParentResourceName()}/callback`, JSON.stringify({
                    event: 'forceurl',
                    veh: vehId,
                    vehStr: vehIdStr,
                    link: item.link,
                    queuePos: pos || (Array.from(songList.children).indexOf(li) + 1),
                    songName: name
                }));
            }, 100);
        });
        
        songList.appendChild(li);
    }

    function updatePlaybackInfo(link) {
        currentPlayingLink = link;
        $.getJSON('https://noembed.com/embed', {format: 'json', url: link}, (data) => {
            if (data.error) return;
            currentPlayingName = data.title;
            songNameEl.textContent = data.title;
            authorEl.textContent = data.author_name;
            
            // Use placeholder if thumbnail is missing
            musicThumbEl.src = data.thumbnail_url || "placeholder.png";
            
            // Highlight in queue if it exists
            Array.from(songList.children).forEach(li => {
                if (li.textContent.includes(data.title)) {
                    li.classList.add('active');
                } else {
                    li.classList.remove('active');
                }
            });
        });
    }

    function updateMusicProgress(curr, total) {
        const percent = total > 0 ? (curr / total) * 100 : 0;
        progressFill.style.width = `${percent}%`;
        
        currentTimeEl.textContent = formatTime(curr);
        songLengthEl.textContent = formatTime(total);
    }

    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function updateVolumeUI(vol) {
        volumeBarFill.style.width = `${vol * 100}%`;
    }

    function setPlayState(playing) {
        isPaused = !playing;
        playPauseBtn.innerHTML = playing ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
    }

    function resetPlaybackUI() {
        songNameEl.textContent = "No media present";
        authorEl.textContent = "";
        musicThumbEl.src = "placeholder.png";
        updateMusicProgress(0, 0);
        setPlayState(false);
        Array.from(songList.children).forEach(li => li.classList.remove('active'));
    }

    function loadPlaylists() {
        $.post(`https://${GetParentResourceName()}/requestPlaylists`, JSON.stringify({}));
    }

    // --- Add-to-Playlist Modal ---
    function openAtpModal(link, name) {
        atpCurrentLink = link;
        atpCurrentName = name;
        atpSongLabel.textContent = name || link;
        renderAtpPlaylists();
        atpModal.style.display = 'flex';
    }

    function renderAtpPlaylists() {
        atpPlaylistList.innerHTML = '';
        if (!cachedPlaylists || cachedPlaylists.length === 0) {
            atpPlaylistList.innerHTML = '<li class="atp-empty">No playlists yet. Create one first.</li>';
            return;
        }
        cachedPlaylists.forEach(pl => {
            const li = document.createElement('li');
            li.className = 'atp-playlist-item';
            li.innerHTML = `<i class="fas fa-music"></i> <span>${pl.label}</span>`;
            li.addEventListener('click', () => {
                $.post(`https://${GetParentResourceName()}/addSongToPlaylist`, JSON.stringify({
                    playlistId: pl.id,
                    link: atpCurrentLink
                }), () => {
                    atpModal.style.display = 'none';
                    // Briefly flash success toast
                    const flash = document.createElement('div');
                    flash.className = 'atp-toast';
                    flash.textContent = `Added to "${pl.label}"`;
                    document.querySelector('.glass-panel').appendChild(flash);
                    setTimeout(() => flash.remove(), 2200);
                });
            });
            atpPlaylistList.appendChild(li);
        });
    }

    closeAtpModal.addEventListener('click', () => {
        atpModal.style.display = 'none';
    });

    function renderPlaylists(playlists, songs) {
        cachedPlaylists = playlists || [];
        playlistItems.innerHTML = '';
        if (!playlists || playlists.length === 0) {
            playlistItems.innerHTML = '<li style="text-align:center; padding:20px; color:rgba(255,255,255,0.3)">No playlists found</li>';
            return;
        }

        playlists.forEach(playlist => {
            const playlistSongs = songs.filter(s => s.playlist === playlist.id);
            const entry = document.createElement('li');
            entry.className = 'playlist-entry';
            
            let songsHtml = '';
            playlistSongs.forEach(song => {
                songsHtml += `
                    <li class="playlist-song-item" data-link="${song.link}">
                        <i class="fas fa-music"></i>
                        <span>${song.link}</span>
                    </li>
                `;
            });

            entry.innerHTML = `
                <div class="playlist-title-bar">
                    <h4>${playlist.label}</h4>
                    <button class="play-all-btn" data-id="${playlist.id}">PLAY ALL</button>
                </div>
                <ul class="playlist-songs">
                    ${songsHtml || '<li style="padding:10px; font-size:11px; text-align:center; opacity:0.5">Empty</li>'}
                </ul>
            `;

            // Play single song from playlist
            entry.querySelectorAll('.playlist-song-item').forEach(item => {
                item.addEventListener('click', () => {
                    const link = item.getAttribute('data-link');
                    playDirect(link);
                });
            });

            // Play ALL from playlist
            entry.querySelector('.play-all-btn').addEventListener('click', () => {
                $.post(`https://${GetParentResourceName()}/playPlaylist`, JSON.stringify({
                    id: playlist.id,
                    veh: vehId,
                    vehStr: vehIdStr
                }));
                // Switch back to queue
                document.querySelector('[data-target="queue-tab"]').click();
            });

            playlistItems.appendChild(entry);

            // Fetch titles for songs asynchronously
            playlistSongs.forEach((song, idx) => {
                $.getJSON('https://noembed.com/embed', {format: 'json', url: song.link}, (res) => {
                    if (res.title) {
                        const songEl = entry.querySelectorAll('.playlist-song-item')[idx];
                        if (songEl) songEl.querySelector('span').textContent = res.title;
                    }
                });
            });
        });
    }

    function playDirect(link) {
        $.getJSON('https://noembed.com/embed', {format: 'json', url: link}, (data) => {
            if (data.error) return;
            const fullTitle = `${data.title} by ${data.author_name}`;
            $.post(`https://${GetParentResourceName()}/callback`, JSON.stringify({
                event: 'forceurl',
                veh: vehId,
                vehStr: vehIdStr,
                link: link,
                queuePos: 1,
                songName: fullTitle
            }));
        });
    }
});

// Global functions for inline onclick
window.nextSong = () => {
    $.post(`https://${GetParentResourceName()}/callback`, JSON.stringify({
        event: 'breakLoop',
        vehStr: vehIdStr,
        veh: vehId,
    }));
    $.post(`https://${GetParentResourceName()}/callback`, JSON.stringify({
        event: 'nextSong',
        vehStr: vehIdStr,
        veh: vehId
    }));
};

window.backSong = () => {
    $.post(`https://${GetParentResourceName()}/callback`, JSON.stringify({
        event: 'restartSong',
        vehStr: vehIdStr,
        veh: vehId,
    }));
};
