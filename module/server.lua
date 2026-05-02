MySQL.ready(function()
    MySQL.query([[
        CREATE TABLE IF NOT EXISTS `playlists` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `citizenid` varchar(50) DEFAULT NULL,
          `label` varchar(60) DEFAULT NULL,
          `share_code` varchar(10) DEFAULT NULL,
          PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]])
    MySQL.query([[
        CREATE TABLE IF NOT EXISTS `playlist_songs` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `playlist` int(11) DEFAULT NULL,
          `link` varchar(500) DEFAULT NULL,
          PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]])
end)

local function getCitizenId(source)
    if GetResourceState('qbx_core') == 'started' then
        local player = exports.qbx_core:GetPlayer(source)
        return player and player.PlayerData.citizenid
    elseif GetResourceState('qb-core') == 'started' then
        local QBCore = exports['qb-core']:GetCoreObject({ 'Functions' })
        local Player = QBCore.Functions.GetPlayer(source)
        return Player and Player.PlayerData.citizenid
    end
end

RegisterNetEvent('cad-carplay:syncmusic', function(peds, vehNet, data)
    local veh = NetworkGetEntityFromNetworkId(vehNet)
    if veh ~= 0 then
        for k, v in pairs(peds) do
            TriggerClientEvent("cad-carplay:playsound", v, data)
        end
    end
end)

lib.callback.register('cad-carplay:requestPlaylistsAndSongs', function(source)
    local citizenid = getCitizenId(source)
    if not citizenid then return {}, {} end

    local playlists = MySQL.query.await('SELECT * FROM playlists WHERE citizenid = ?', { citizenid })
    if #playlists == 0 then return {}, {} end

    local playlistIds = {}
    for _, p in ipairs(playlists) do table.insert(playlistIds, p.id) end

    local songs = MySQL.query.await('SELECT * FROM playlist_songs WHERE playlist IN (?)', { playlistIds })
    return playlists, songs
end)

lib.callback.register('cad-carplay:importPlaylist', function(source, code)
    local citizenid = getCitizenId(source)
    if not citizenid or not code then return false end

    local original = MySQL.single.await('SELECT * FROM playlists WHERE share_code = ?', { code })
    if not original then return false end

    local newId = MySQL.insert.await('INSERT INTO playlists (citizenid, label, share_code) VALUES (?, ?, ?)', {
        citizenid, original.label, code
    })

    if newId then
        local songs = MySQL.query.await('SELECT * FROM playlist_songs WHERE playlist = ?', { original.id })
        for _, song in ipairs(songs) do
            MySQL.insert.await('INSERT INTO playlist_songs (playlist, link) VALUES (?, ?)', { newId, song.link })
        end
        return true
    end
    return false
end)

RegisterServerEvent('cad-carplay:playPlaylist', function(playlistId, vehNet, vehStr)
    local src = source
    local songs = MySQL.query.await('SELECT * FROM playlist_songs WHERE playlist = ?', { playlistId })
    if #songs == 0 then return end

    local veh = NetworkGetEntityFromNetworkId(vehNet)
    if not DoesEntityExist(veh) then return end

    local queue = {}
    for i, song in ipairs(songs) do
        table.insert(queue, {
            event = "url",
            veh = vehNet,
            vehStr = vehStr,
            link = song.link,
            queuePos = i,
            songName = "Loading..."
        })
    end

    local state = Entity(veh).state
    state:set('carplay_queue', queue, true)
    state:set('carplay_queuePos', 1, true)

    local firstSong = queue[1]
    firstSong.shouldForce = true
    TriggerClientEvent('cad-carplay:clientPlayPlaylist', src, firstSong)
end)

-- Generate a random alphanumeric share code
local function generateShareCode(len)
    local chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    local code = ''
    for i = 1, len do
        local idx = math.random(1, #chars)
        code = code .. chars:sub(idx, idx)
    end
    return code
end

lib.callback.register('cad-carplay:createPlaylist', function(source, label, firstSong)
    local citizenid = getCitizenId(source)
    if not citizenid or not label or label == '' then return false end

    -- Generate unique share code
    local shareCode
    repeat
        shareCode = generateShareCode(8)
    until not MySQL.single.await('SELECT id FROM playlists WHERE share_code = ?', { shareCode })

    local newId = MySQL.insert.await(
        'INSERT INTO playlists (citizenid, label, share_code) VALUES (?, ?, ?)',
        { citizenid, label, shareCode }
    )

    if not newId then return false end

    -- Optionally insert first song
    if firstSong and firstSong ~= '' then
        MySQL.insert.await(
            'INSERT INTO playlist_songs (playlist, link) VALUES (?, ?)',
            { newId, firstSong }
        )
    end

    -- Notify client NUI to close modal and reload
    TriggerClientEvent('cad-carplay:nuiMessage', source, { event = 'playlistCreated' })
    return true
end)

lib.callback.register('cad-carplay:addSongToPlaylist', function(source, playlistId, link)
    if not playlistId or not link or link == '' then return false end

    local citizenid = getCitizenId(source)
    if not citizenid then return false end

    local playlist = MySQL.single.await('SELECT id FROM playlists WHERE id = ? AND citizenid = ?', { playlistId, citizenid })
    if not playlist then return false end

    MySQL.insert.await('INSERT INTO playlist_songs (playlist, link) VALUES (?, ?)', { playlistId, link })
    return true
end)
